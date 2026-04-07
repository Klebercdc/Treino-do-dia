import { NextResponse } from 'next/server';
import {
  isAuthorizedCronRequest,
  runExerciseSyncTask,
} from '../../../../server/internal/cron/dispatcher';

function jsonEnvelope(success: boolean, type: string, message: string, data: Record<string, unknown> = {}, code?: string) {
  return {
    success,
    type,
    message,
    ...(code ? { error: { code } } : {}),
    data,
  };
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(jsonEnvelope(false, 'cron_sync_error', 'CRON_SECRET não configurado.', {}, 'MISSING_CRON_SECRET'), { status: 500 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(jsonEnvelope(false, 'cron_sync_error', 'Não autorizado para execução do cron.', {}, 'UNAUTHORIZED'), { status: 401 });
  }

  const task = await runExerciseSyncTask(new Date());
  if (task.status === 'success') {
    return NextResponse.json(jsonEnvelope(true, 'cron_sync_exercises', 'Sincronização semanal concluída com sucesso.', { summary: task.details?.summary }), { status: 200 });
  }
  if (task.status === 'skipped') {
    return NextResponse.json(jsonEnvelope(true, 'cron_sync_exercises_skipped', 'Sincronização semanal ignorada fora da janela de execução.', { reason: task.details?.reason || 'skipped' }), { status: 200 });
  }

  return NextResponse.json(
    jsonEnvelope(false, 'cron_sync_error', 'Falha ao sincronizar catálogo de exercícios.', { cause: task.error || 'unknown' }, 'SYNC_FAILED'),
    { status: 500 },
  );
}
