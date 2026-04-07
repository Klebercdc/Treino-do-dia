import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { LAB_REPORTS_BUCKET } from '../../../../../core/labs/labRepository';
import {
  acquireLabReportProcessingLock,
  listStaleProcessingLabReports,
  processLabReportUploadSafely,
} from '../../../../../server/internal/labReports/service';
import { logger } from '../../../../../lib/utils/logger';

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 5);
  const admin = createAdminSupabaseClient();

  const candidates = await listStaleProcessingLabReports(admin, limit);
  const processed: Array<Record<string, unknown>> = [];

  for (const report of candidates) {
    const labReportId = String(report.id || '');
    if (!labReportId) continue;

    const lockAcquired = await acquireLabReportProcessingLock(admin, {
      labReportId,
      currentStatus: String(report.status || ''),
      updatedAt: report.updated_at,
    });
    if (!lockAcquired) {
      processed.push({ labReportId, skipped: true, reason: 'lock_not_acquired' });
      continue;
    }

    const result = await processLabReportUploadSafely(admin, {
      labReportId,
      storageBucket: String(report.storage_bucket || LAB_REPORTS_BUCKET),
      storagePath: String(report.storage_path || ''),
      mimeType: String(report.mime_type || report.file_type || ''),
    });

    processed.push({
      labReportId,
      status: result.status,
      biomarkersCount: result.biomarkersCount,
    });
  }

  logger.info('labs_watchdog_finished', {
    scanned: candidates.length,
    processed: processed.length,
    reprocessed: processed.filter((item) => item.skipped !== true).length,
  });

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    processed,
  });
}
