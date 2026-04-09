import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { logger } from '../../../../../lib/utils/logger';
import {
  LAB_REPORTS_BUCKET,
  MAX_LAB_REPORT_SIZE_BYTES,
  assertOwnedLabReportStoragePath,
  deleteLabReportStorageObject,
  getLabReportStorageObject,
  resolveAllowedLabMimeType,
} from '../../../../../core/labs/labRepository';
import {
  createLabReportRecord,
  markLabReportAsUploaded,
} from '../../../../../server/internal/labReports/service';

export const runtime = 'nodejs';

type RegisterPayload = {
  labReportId?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

function buildError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (!auth.ok) return auth.response;

  let payload: RegisterPayload | null = null;
  try {
    payload = await req.json();
  } catch {
    return buildError(400, 'Payload JSON inválido.');
  }

  const requestedBucket = String(payload?.storageBucket || LAB_REPORTS_BUCKET).trim();
  if (requestedBucket !== LAB_REPORTS_BUCKET) {
    return buildError(400, 'Bucket de exames inválido.');
  }

  const fileName = String(payload?.fileName || '').trim();
  if (!fileName) return buildError(400, 'Nome do arquivo é obrigatório.');
  const labReportId = String(payload?.labReportId || '').trim();
  if (labReportId && !isUuid(labReportId)) {
    return buildError(400, 'labReportId inválido.');
  }

  let storagePath = '';
  let normalizedMimeType = '';
  try {
    storagePath = assertOwnedLabReportStoragePath(auth.user.id, String(payload?.storagePath || ''));
    normalizedMimeType = resolveAllowedLabMimeType({
      mimeType: payload?.mimeType,
      filename: fileName || storagePath,
    });
  } catch (error) {
    return buildError(400, error instanceof Error ? error.message : 'Payload inválido.');
  }

  const admin = createAdminSupabaseClient();

  try {
    let existingQuery = admin
      .from('lab_reports')
      .select('id,status,parse_status')
      .eq('user_id', auth.user.id)
      .eq('storage_bucket', LAB_REPORTS_BUCKET)
      .eq('storage_path', storagePath)
      .limit(1);

    if (labReportId) {
      existingQuery = existingQuery.neq('id', labReportId);
    }

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();

    if (existingError) {
      throw new Error(`Falha ao verificar duplicidade do exame: ${existingError.message}`);
    }

    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        uploaded: true,
        duplicated: true,
        labReportId: String(existing.id),
        status: String(existing.status || existing.parse_status || 'processing'),
        orchestration: 'supabase_db_trigger',
      });
    }

    const object = await getLabReportStorageObject(admin, {
      bucket: LAB_REPORTS_BUCKET,
      path: storagePath,
    });

    if (!object) {
      return buildError(400, 'Arquivo não encontrado no storage.');
    }
    if (object.path !== storagePath) {
      return buildError(400, 'Objeto de storage inválido.');
    }

    const storedMimeType = object.mimeType
      ? resolveAllowedLabMimeType({ mimeType: object.mimeType, filename: fileName })
      : normalizedMimeType;

    if (storedMimeType !== normalizedMimeType) {
      await deleteLabReportStorageObject(admin, { bucket: LAB_REPORTS_BUCKET, path: storagePath });
      return buildError(400, 'Tipo MIME do arquivo não confere com o upload realizado.');
    }
    if (object.size !== null && object.size <= 0) {
      await deleteLabReportStorageObject(admin, { bucket: LAB_REPORTS_BUCKET, path: storagePath });
      return buildError(400, 'Arquivo enviado está vazio.');
    }
    if (object.size !== null && object.size > MAX_LAB_REPORT_SIZE_BYTES) {
      await deleteLabReportStorageObject(admin, { bucket: LAB_REPORTS_BUCKET, path: storagePath });
      return buildError(413, 'Arquivo acima do limite permitido.');
    }

    try {
      let resolvedLabReportId = labReportId;

      if (resolvedLabReportId) {
        const updated = await markLabReportAsUploaded(admin, {
          labReportId: resolvedLabReportId,
          userId: auth.user.id,
          storageBucket: LAB_REPORTS_BUCKET,
          storagePath,
          fileName,
          mimeType: normalizedMimeType,
        });
        if (!updated) {
          return buildError(404, 'labReportId inválido para o usuário autenticado.');
        }
      } else {
        const created = await createLabReportRecord(admin, {
          userId: auth.user.id,
          storageBucket: LAB_REPORTS_BUCKET,
          storagePath,
          fileName,
          mimeType: normalizedMimeType,
        });
        resolvedLabReportId = created.id;
      }

      logger.info('labs_register_enqueued_via_supabase', {
        userId: auth.user.id,
        labReportId: resolvedLabReportId,
        storagePath,
        orchestration: 'supabase_db_trigger',
      });

      return NextResponse.json({
        ok: true,
        uploaded: true,
        labReportId: resolvedLabReportId,
        status: 'processing',
        orchestration: 'supabase_db_trigger',
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      try {
        await deleteLabReportStorageObject(admin, { bucket: LAB_REPORTS_BUCKET, path: storagePath });
      } catch (cleanupError) {
        logger.error('labs_register_cleanup_failed', {
          userId: auth.user.id,
          storagePath,
          reason,
          cleanupReason: cleanupError instanceof Error ? cleanupError.message : 'unknown',
        });
      }
      throw error;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    logger.error('labs_register_internal_error', {
      userId: auth.user.id,
      storagePath,
      reason,
    });
    if (/tipo de arquivo inválido/i.test(reason) || /caminho do arquivo/i.test(reason) || /pertence ao usuário/i.test(reason)) {
      return buildError(400, reason);
    }
    return buildError(500, 'Não foi possível registrar o exame agora.');
  }
}
