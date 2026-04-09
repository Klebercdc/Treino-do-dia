import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { logger } from '../../../../../lib/utils/logger';
import {
  LAB_REPORTS_BUCKET,
  MAX_LAB_REPORT_SIZE_BYTES,
  buildLabReportStoragePath,
  resolveAllowedLabMimeType,
} from '../../../../../core/labs/labRepository';
import { createLabReportUploadDraft } from '../../../../../server/internal/labReports/service';

export const runtime = 'nodejs';

type InitUploadPayload = {
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | string | null;
};

function buildError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  logger.info('[labs/init-upload] start');

  const auth = await requireBearerAuth(req);
  if (!auth.ok) return auth.response;

  logger.info('[labs/init-upload] auth', { userId: auth.user.id });

  let payload: InitUploadPayload | null = null;
  let createdLabReportId = '';
  try {
    payload = await req.json();
  } catch {
    return buildError(400, 'Payload JSON inválido.');
  }

  const bodyKeys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
  const fileName = String(payload?.fileName || '').trim();
  const fileSize = Number(payload?.fileSize || 0);

  logger.info('[labs/init-upload] payload', {
    bodyKeys,
    fileName,
    mimeType: payload?.mimeType || null,
    fileSize,
  });

  if (!fileName) return buildError(400, 'Nome do arquivo é obrigatório.');
  if (!Number.isFinite(fileSize) || fileSize <= 0) return buildError(400, 'Tamanho do arquivo é obrigatório.');
  if (fileSize > MAX_LAB_REPORT_SIZE_BYTES) return buildError(413, 'Arquivo acima do limite permitido.');

  let mimeType = '';
  try {
    mimeType = resolveAllowedLabMimeType({
      mimeType: payload?.mimeType,
      filename: fileName,
    });
  } catch (error) {
    return buildError(400, error instanceof Error ? error.message : 'Tipo de arquivo inválido.');
  }

  const storagePath = buildLabReportStoragePath(auth.user.id, fileName);
  const admin = createAdminSupabaseClient();

  logger.info('[labs/init-upload] storage', {
    createSignedUploadUrlType: typeof admin.storage.from(LAB_REPORTS_BUCKET).createSignedUploadUrl,
  });

  try {
    logger.info('[labs/init-upload] insert-payload', {
      userId: auth.user.id,
      storageBucket: LAB_REPORTS_BUCKET,
      storagePath,
      fileName,
      mimeType,
    });

    const created = await createLabReportUploadDraft(admin, {
      userId: auth.user.id,
      storageBucket: LAB_REPORTS_BUCKET,
      storagePath,
      fileName,
      mimeType,
    });
    createdLabReportId = created.id;

    logger.info('[labs/init-upload] insert-result', { hasData: Boolean(created.id), hasError: false });

    const { data, error } = await admin.storage.from(LAB_REPORTS_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data?.signedUrl || !data?.token) {
      throw new Error(error?.message || 'Falha ao gerar signed upload URL.');
    }

    logger.info('[labs/init-upload] signed-result', {
      hasSignedUrl: Boolean(data.signedUrl),
      hasToken: Boolean(data.token),
    });

    return NextResponse.json({
      ok: true,
      labReportId: created.id,
      storageBucket: LAB_REPORTS_BUCKET,
      storagePath,
      uploadUrl: data.signedUrl,
      uploadToken: data.token,
    });
  } catch (error) {
    if (createdLabReportId) {
      await admin.from('lab_reports').delete().eq('id', createdLabReportId).eq('user_id', auth.user.id);
    }
    logger.error('labs_init_upload_internal_error', {
      userId: auth.user.id,
      storagePath,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return buildError(500, 'Não foi possível iniciar o upload agora.');
  }
}
