import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import {
  isAuthorizedCronRequest,
  runLabsWatchdogTask,
} from '../../../../../server/internal/cron/dispatcher';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 5);
  const admin = createAdminSupabaseClient();
  const task = await runLabsWatchdogTask(admin, limit);
  const details = task.details || {};

  return NextResponse.json({
    ok: task.status !== 'failed',
    task: task.task,
    status: task.status,
    durationMs: task.durationMs,
    details,
    ...(task.error ? { error: task.error } : {}),
  }, { status: task.status === 'failed' ? 500 : 200 });
}
