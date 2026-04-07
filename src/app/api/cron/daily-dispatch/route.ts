import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import {
  isAuthorizedCronRequest,
  runExerciseSyncTask,
  runLabsWatchdogTask,
  type CronTaskResult,
} from '../../../../../server/internal/cron/dispatcher';
import { logger } from '../../../../../lib/utils/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function runInternalPost(
  input: { url: URL; headers?: Record<string, string>; body?: Record<string, unknown> },
): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> }> {
  const response = await fetch(input.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.headers || {}),
    },
    body: JSON.stringify(input.body || {}),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: 'invalid_json_response' }));
  return { ok: response.ok, status: response.status, payload };
}

async function runMemoryQueueTask(req: Request): Promise<CronTaskResult> {
  const startedAt = Date.now();
  const secret = String(process.env.INTERNAL_WORKER_SECRET || process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return {
      task: 'memory_queue_worker',
      status: 'skipped',
      durationMs: Date.now() - startedAt,
      details: { reason: 'missing_internal_secret' },
    };
  }

  try {
    const url = new URL('/api/internal/process-memory-queue?action=process_queue', req.url);
    const result = await runInternalPost({
      url,
      headers: { Authorization: `Bearer ${secret}` },
      body: {
        action: 'process_queue',
        workerId: 'daily_dispatch',
        batchSize: 20,
      },
    });

    return {
      task: 'memory_queue_worker',
      status: result.ok ? 'success' : 'failed',
      durationMs: Date.now() - startedAt,
      details: {
        statusCode: result.status,
        payload: result.payload,
      },
      ...(result.ok ? {} : { error: String(result.payload?.error || 'memory_queue_worker_failed') }),
    };
  } catch (error) {
    return {
      task: 'memory_queue_worker',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

async function runAutoImportTask(req: Request): Promise<CronTaskResult> {
  const startedAt = Date.now();
  const autoEnabled = ['1', 'true'].includes(String(process.env.AUTO_IMPORT_EXERCISES || '').toLowerCase());
  if (!autoEnabled) {
    return {
      task: 'auto_import_exercises',
      status: 'skipped',
      durationMs: Date.now() - startedAt,
      details: { reason: 'auto_import_disabled' },
    };
  }

  const cronImportSecret = String(process.env.CRON_IMPORT_SECRET || '').trim();
  if (!cronImportSecret) {
    return {
      task: 'auto_import_exercises',
      status: 'skipped',
      durationMs: Date.now() - startedAt,
      details: { reason: 'missing_cron_import_secret' },
    };
  }

  try {
    const url = new URL('/api/cron/auto-import-exercises', req.url);
    const result = await runInternalPost({
      url,
      headers: { 'x-cron-secret': cronImportSecret },
      body: {},
    });

    return {
      task: 'auto_import_exercises',
      status: result.ok ? 'success' : 'failed',
      durationMs: Date.now() - startedAt,
      details: {
        statusCode: result.status,
        payload: result.payload,
      },
      ...(result.ok ? {} : { error: String(result.payload?.error || result.payload?.status || 'auto_import_failed') }),
    };
  } catch (error) {
    return {
      task: 'auto_import_exercises',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const startedAt = Date.now();
  const now = new Date();
  const tasks: CronTaskResult[] = [];

  tasks.push(await runLabsWatchdogTask(admin, 10));
  tasks.push(await runExerciseSyncTask(now));
  tasks.push(await runAutoImportTask(req));
  tasks.push(await runMemoryQueueTask(req));

  const failed = tasks.filter((task) => task.status === 'failed');
  const skipped = tasks.filter((task) => task.status === 'skipped').length;

  logger.info('cron_daily_dispatch_finished', {
    startedAt: now.toISOString(),
    durationMs: Date.now() - startedAt,
    failed: failed.length,
    skipped,
    tasks: tasks.map((task) => ({ task: task.task, status: task.status, durationMs: task.durationMs })),
  });

  return NextResponse.json({
    ok: failed.length === 0,
    summary: {
      startedAt: now.toISOString(),
      durationMs: Date.now() - startedAt,
      total: tasks.length,
      failed: failed.length,
      skipped,
    },
    tasks,
  }, { status: failed.length > 0 ? 207 : 200 });
}
