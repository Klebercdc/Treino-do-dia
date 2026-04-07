import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin';
import { logger } from '../../../../lib/utils/logger';
import { LAB_REPORTS_BUCKET, uploadLabReportFile } from '../../../../core/labs/labRepository';
import {
  createLabReportRecord,
  enqueueLabReportProcessing,
  processLabReportUpload,
} from '../../../../server/internal/labReports/service';

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

    await enqueueLabReportProcessing(admin, created.id);

    try {
      const processed = await processLabReportUpload(admin, {
        labReportId: created.id,
        storageBucket: LAB_REPORTS_BUCKET,
        storagePath: uploaded.path,
        mimeType: file.type,
      });

      return NextResponse.json({
        ok: true,
        uploaded: true,
        labReportId: created.id,
        status: processed.status,
        biomarkersCount: processed.biomarkersCount,
      });
    } catch (processingError) {
      await admin
        .from('lab_reports')
        .update({
          status: 'failed',
          parse_status: 'failed',
          processing_error: processingError instanceof Error ? processingError.message.slice(0, 280) : 'processing_failed',
          is_valid: false,
        })
        .eq('id', created.id);

      logger.warn('labs_upload_process_failed', {
        userId: auth.user.id,
        labReportId: created.id,
        reason: processingError instanceof Error ? processingError.message : 'unknown',
      });

      return NextResponse.json({
        ok: true,
        uploaded: true,
        labReportId: created.id,
        status: 'failed',
      });
    }
  } catch (error) {
    logger.error('labs_upload_internal_error', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return buildError(500, 'Não foi possível processar o exame agora.');
  }
}
