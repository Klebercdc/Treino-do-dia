import type { SupabaseClient } from '@supabase/supabase-js';
import { syncExercisesWeekly } from '../../../lib/exercises/sync-core';
import { LAB_REPORTS_BUCKET } from '../../../core/labs/labRepository';
import {
  acquireLabReportProcessingLock,
  listStaleProcessingLabReports,
  processLabReportUploadSafely,
} from '../labReports/service';
import { logger } from '../../../lib/utils/logger';

export type CronTaskStatus = 'success' | 'failed' | 'skipped';

export interface CronTaskResult {
  task: string;
  status: CronTaskStatus;
  durationMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export function isUtcWeekday(date: Date, weekday: number): boolean {
  return date.getUTCDay() === weekday;
}

export async function runLabsWatchdogTask(
  admin: SupabaseClient,
  limit: number,
): Promise<CronTaskResult> {
  const startedAt = Date.now();
  try {
    const candidates = await listStaleProcessingLabReports(admin, limit);
    const processed: Array<Record<string, unknown>> = [];

    for (const report of candidates) {
      const labReportId = String(report.id || '');
      if (!labReportId) continue;

      try {
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
      } catch (error) {
        logger.warn('labs_watchdog_item_failed', {
          labReportId,
          reason: error instanceof Error ? error.message : 'unknown',
        });
        processed.push({ labReportId, skipped: true, reason: 'watchdog_item_failed' });
      }
    }

    logger.info('labs_watchdog_finished', {
      scanned: candidates.length,
      processed: processed.length,
      reprocessed: processed.filter((item) => item.skipped !== true).length,
    });

    return {
      task: 'labs_watchdog',
      status: 'success',
      durationMs: Date.now() - startedAt,
      details: {
        scanned: candidates.length,
        processed: processed.length,
        reprocessed: processed.filter((item) => item.skipped !== true).length,
      },
    };
  } catch (error) {
    return {
      task: 'labs_watchdog',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

export async function runExerciseSyncTask(now: Date): Promise<CronTaskResult> {
  const startedAt = Date.now();
  if (!isUtcWeekday(now, 1)) {
    return {
      task: 'sync_exercises_weekly',
      status: 'skipped',
      durationMs: Date.now() - startedAt,
      details: { reason: 'only_monday_utc' },
    };
  }

  try {
    const summary = await syncExercisesWeekly({ mode: 'sync', useStateFile: false, seedAliases: true, enrichMedia: true });
    return {
      task: 'sync_exercises_weekly',
      status: 'success',
      durationMs: Date.now() - startedAt,
      details: { summary },
    };
  } catch (error) {
    return {
      task: 'sync_exercises_weekly',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}
