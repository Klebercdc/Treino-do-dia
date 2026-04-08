import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin';
import { logger } from '../../../../lib/utils/logger';
import { LAB_REPORTS_BUCKET, uploadLabReportFile } from '../../../../core/labs/labRepository';
import {
  createLabReportRecord,
  enqueueLabReportProcessing,
} from '../../../../server/internal/labReports/service';

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

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const processUrl = new URL('/api/labs/process', req.url);
      void fetch(processUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ labReportId: created.id }),
      }).then((res) => {
        if (!res.ok) {
          logger.warn('labs_upload_dispatch_http_error', {
            userId: auth.user.id,
            labReportId: created.id,
            httpStatus: res.status,
          });
        }
      }).catch((dispatchError) => {
        logger.warn('labs_upload_dispatch_failed', {
          userId: auth.user.id,
          labReportId: created.id,
          reason: dispatchError instanceof Error ? dispatchError.message : 'unknown',
        });
      });
    } else {
      logger.warn('labs_upload_missing_cron_secret', {
        userId: auth.user.id,
        labReportId: created.id,
      });
    }

    return NextResponse.json({
      ok: true,
      uploaded: true,
      labReportId: created.id,
      status: 'processing',
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    logger.error('labs_upload_internal_error', { reason });
    return buildError(500, reason.slice(0, 200));
  }
}
