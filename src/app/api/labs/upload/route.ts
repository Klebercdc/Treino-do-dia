import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin';
import { logger } from '../../../../lib/utils/logger';
import { LAB_REPORTS_BUCKET, uploadLabReportFile } from '../../../../core/labs/labRepository';
import { createLabReportRecord } from '../../../../server/internal/labReports/service';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function buildError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
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

    logger.info('labs_upload_received', {
      userId: auth.user.id,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
    });

    const uploaded = await uploadLabReportFile(admin, auth.user.id, {
      name: file.name,
      type: file.type,
      bytes,
    });

    const created = await createLabReportRecord(admin, {
      userId: auth.user.id,
      storageBucket: LAB_REPORTS_BUCKET,
      storagePath: uploaded.path,
      fileName: file.name,
      mimeType: file.type,
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
    logger.error('labs_upload_internal_error', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return buildError(500, 'Não foi possível processar o exame agora.');
  }
}
