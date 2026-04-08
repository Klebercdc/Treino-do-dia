import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { logger } from '../../../../../lib/utils/logger';
import { LAB_REPORTS_BUCKET } from '../../../../../core/labs/labRepository';
import {
  createLabReportRecord,
  enqueueLabReportProcessing,
} from '../../../../../server/internal/labReports/service';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
// Formato esperado: {uuid}/{timestamp}-{safename}  — sem traversal, sem espaços
const SAFE_STORAGE_PATH_RE = /^[0-9a-f-]{36}\/[0-9]+-[a-zA-Z0-9._-]{1,120}$/;

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

  try {
    const admin = createAdminSupabaseClient();

    const created = await createLabReportRecord(admin, {
      userId: auth.user.id,
      storageBucket: LAB_REPORTS_BUCKET,
      storagePath,
      fileName,
      mimeType,
    });

    await enqueueLabReportProcessing(admin, created.id);

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      void fetch(new URL('/api/labs/process', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cronSecret}` },
        body: JSON.stringify({ labReportId: created.id }),
      })
        .then((res) => { if (!res.ok) logger.warn('labs_register_dispatch_http_error', { httpStatus: res.status }); })
        .catch((e) => { logger.warn('labs_register_dispatch_failed', { reason: e instanceof Error ? e.message : 'unknown' }); });
    }

    logger.info('labs_register_ok', { userId: auth.user.id, labReportId: created.id, mimeType });
    return NextResponse.json({ ok: true, labReportId: created.id, status: 'processing' });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    logger.error('labs_register_error', { reason });
    return NextResponse.json({ ok: false, error: reason.slice(0, 200) }, { status: 500 });
  }
}
