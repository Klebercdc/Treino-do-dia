// NOTE: rota de referência para App Router. Produção Vercel atual usa /api/system (__route=kronia-labs-*) via vercel.json.
import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { logger } from '../../../../../lib/utils/logger';
import { LAB_REPORTS_BUCKET } from '../../../../../core/labs/labRepository';
import {
  createLabReportRecord,
  deleteLabReportRecord,
  dispatchLabReportToEdgeBestEffort,
} from '../../../../../server/internal/labReports/service';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
// Formato esperado: {uuid}/{uuid}.{ext}  — sem traversal, sem espaços
const SAFE_STORAGE_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/;

function splitStoragePath(storagePath: string): { directory: string; fileName: string } | null {
  const idx = storagePath.lastIndexOf('/');
  if (idx <= 0 || idx === storagePath.length - 1) return null;
  return {
    directory: storagePath.slice(0, idx),
    fileName: storagePath.slice(idx + 1),
  };
}

async function ensureObjectExistsInStorage(admin: ReturnType<typeof createAdminSupabaseClient>, storagePath: string) {
  const parts = splitStoragePath(storagePath);
  if (!parts) return false;

  const { data, error } = await admin.storage.from(LAB_REPORTS_BUCKET).list(parts.directory, {
    limit: 100,
    search: parts.fileName,
  });

  if (error) throw new Error(`Falha ao validar objeto no storage: ${error.message}`);
  return Boolean((data || []).some((item) => item?.name === parts.fileName));
}

export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const storagePath = String(body?.storagePath || '').trim();
  const fileName = String(body?.fileName || '').trim();
  const mimeType = String(body?.mimeType || '').trim();

  if (!storagePath || !fileName) {
    return NextResponse.json({ ok: false, error: 'storagePath e fileName são obrigatórios.' }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ ok: false, error: 'Tipo de arquivo inválido. Use PDF, JPEG ou PNG.' }, { status: 400 });
  }
  // Bloqueia path traversal (../) e garante ownership: path deve começar com userId do JWT
  if (
    storagePath.includes('..') ||
    storagePath.includes('//') ||
    !storagePath.startsWith(auth.user.id + '/') ||
    !SAFE_STORAGE_PATH_RE.test(storagePath)
  ) {
    return NextResponse.json({ ok: false, error: 'Caminho de storage inválido.' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('labs_register_missing_service_key', {});
    return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }, { status: 500 });
  }

  let createdLabReportId: string | null = null;
  try {
    const admin = createAdminSupabaseClient();

    const storageObjectExists = await ensureObjectExistsInStorage(admin, storagePath);
    if (!storageObjectExists) {
      return NextResponse.json(
        { ok: false, error: 'Arquivo não encontrado no storage. Refaça o upload antes de registrar.' },
        { status: 409 },
      );
    }

    const created = await createLabReportRecord(admin, {
      userId: auth.user.id,
      storageBucket: LAB_REPORTS_BUCKET,
      storagePath,
      fileName,
      mimeType,
    });
    createdLabReportId = created.id;

    await dispatchLabReportToEdgeBestEffort(admin, {
      labReportId: created.id,
      source: 'app_router_register_uploaded',
    });

    logger.info('labs_register_ok', { userId: auth.user.id, labReportId: created.id, mimeType });
    return NextResponse.json({ ok: true, labReportId: created.id, status: 'processing' });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    try {
      const admin = createAdminSupabaseClient();
      await admin.storage.from(LAB_REPORTS_BUCKET).remove([storagePath]);
    } catch (cleanupError) {
      logger.warn('labs_register_cleanup_storage_failed', {
        reason: cleanupError instanceof Error ? cleanupError.message : 'unknown',
      });
    }
    try {
      const admin = createAdminSupabaseClient();
      if (createdLabReportId) {
        await deleteLabReportRecord(admin, createdLabReportId);
      }
    } catch (cleanupError) {
      logger.warn('labs_register_cleanup_db_failed', {
        reason: cleanupError instanceof Error ? cleanupError.message : 'unknown',
      });
    }
    logger.error('labs_register_error', { reason });
    return NextResponse.json({ ok: false, error: reason.slice(0, 200) }, { status: 500 });
  }
}
