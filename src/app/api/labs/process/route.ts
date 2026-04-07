import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin';
import { LAB_REPORTS_BUCKET } from '../../../../core/labs/labRepository';
import { logger } from '../../../../lib/utils/logger';
import {
  acquireLabReportProcessingLock,
  processLabReportUploadSafely,
} from '../../../../server/internal/labReports/service';

export const runtime = 'nodejs';
// OCR pode levar até 45 s (EXAM_OCR_TIMEOUT_MS). Sem maxDuration explícito,
// o Next.js usa ~15 s de padrão — processamento silenciosamente abortado.
export const maxDuration = 60;

function isAuthorizedInternalCall(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedInternalCall(req)) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const labReportId = String(payload?.labReportId || '').trim();
  if (!labReportId) {
    return NextResponse.json({ ok: false, error: 'labReportId obrigatório.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: report, error } = await admin
    .from('lab_reports')
    .select('id,storage_bucket,storage_path,mime_type,file_type,status,updated_at')
    .eq('id', labReportId)
    .maybeSingle();

  if (error || !report) {
    return NextResponse.json({ ok: false, error: 'Exame não encontrado.' }, { status: 404 });
  }

  if (report.status === 'analyzed') {
    logger.info('labs_process_route_skipped', { labReportId, reason: 'already_analyzed' });
    return NextResponse.json({ ok: true, status: 'analyzed', skipped: true, reason: 'already_analyzed' });
  }

  const lockAcquired = await acquireLabReportProcessingLock(admin, {
    labReportId,
    currentStatus: String(report.status || ''),
    updatedAt: report.updated_at ? String(report.updated_at) : null,
  });
  if (!lockAcquired) {
    logger.info('labs_process_route_skipped', {
      labReportId,
      currentStatus: String(report.status || ''),
      reason: 'lock_not_acquired',
    });
    return NextResponse.json(
      { ok: true, status: String(report.status || 'processing'), skipped: true, reason: 'lock_not_acquired' },
      { status: 202 },
    );
  }

  const result = await processLabReportUploadSafely(admin, {
    labReportId,
    storageBucket: String(report.storage_bucket || LAB_REPORTS_BUCKET),
    storagePath: String(report.storage_path || ''),
    mimeType: String(report.mime_type || report.file_type || ''),
  });

  logger.info('labs_process_route_finished', {
    labReportId,
    status: result.status,
    biomarkersCount: result.biomarkersCount,
  });

  return NextResponse.json({ ok: true, ...result });
}
