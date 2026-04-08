import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin';
import { logger } from '../../../../lib/utils/logger';
import { LAB_REPORTS_BUCKET, resolveAllowedLabMimeType, uploadLabReportFile } from '../../../../core/labs/labRepository';
import { createLabReportRecord } from '../../../../server/internal/labReports/service';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function buildError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  // Pre-flight: verifica variáveis de ambiente críticas antes de qualquer operação
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('labs_upload_missing_env', { vars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k]) });
    return buildError(500, 'Configuração do servidor incompleta. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  }

  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok) return auth.response;

    const form = await req.formData().catch(() => null);
    if (!form) return buildError(400, 'Payload de upload inválido.');

    const file = form.get('file');
    if (!(file instanceof File)) {
      return buildError(400, 'Arquivo é obrigatório.');
    }
    if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
      return buildError(413, 'Arquivo inválido ou acima do limite permitido.');
    }

    const admin = createAdminSupabaseClient();
    const bytes = Buffer.from(await file.arrayBuffer());
    const normalizedMimeType = resolveAllowedLabMimeType({
      mimeType: file.type,
      filename: file.name,
    });

    logger.info('labs_upload_received', {
      userId: auth.user.id,
      fileName: file.name,
      fileType: file.type,
      normalizedMimeType,
      size: file.size,
    });

    const uploaded = await uploadLabReportFile(admin, auth.user.id, {
      name: file.name,
      type: normalizedMimeType,
      bytes,
    });

    const created = await createLabReportRecord(admin, {
      userId: auth.user.id,
      storageBucket: LAB_REPORTS_BUCKET,
      storagePath: uploaded.path,
      fileName: file.name,
      mimeType: normalizedMimeType,
    });

    logger.info('labs_upload_enqueued_via_supabase', {
      userId: auth.user.id,
      labReportId: created.id,
      orchestration: 'supabase_db_trigger',
    });

    return NextResponse.json({
      ok: true,
      uploaded: true,
      labReportId: created.id,
      status: 'processing',
      orchestration: 'supabase_db_trigger',
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    logger.error('labs_upload_internal_error', { reason });
    if (/Tipo de arquivo inválido/i.test(reason)) {
      return buildError(400, 'Tipo de arquivo inválido. Envie PDF, JPG ou PNG.');
    }
    return buildError(500, reason.slice(0, 200));
  }
}
