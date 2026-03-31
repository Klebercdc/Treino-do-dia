import { NextResponse } from 'next/server';
import { syncExercisesWeekly } from '../../../../lib/exercises/sync-core';

function jsonEnvelope(success: boolean, type: string, message: string, data: Record<string, unknown> = {}, code?: string) {
  return {
    success,
    type,
    message,
    ...(code ? { error: { code } } : {}),
    data,
  };
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(jsonEnvelope(false, 'cron_sync_error', 'CRON_SECRET não configurado.', {}, 'MISSING_CRON_SECRET'), { status: 500 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json(jsonEnvelope(false, 'cron_sync_error', 'Não autorizado para execução do cron.', {}, 'UNAUTHORIZED'), { status: 401 });
  }

  try {
    const summary = await syncExercisesWeekly({ mode: 'sync', useStateFile: false, seedAliases: true, enrichMedia: true });
    return NextResponse.json(jsonEnvelope(true, 'cron_sync_exercises', 'Sincronização semanal concluída com sucesso.', { summary }), { status: 200 });
  } catch (error) {
    return NextResponse.json(
      jsonEnvelope(false, 'cron_sync_error', 'Falha ao sincronizar catálogo de exercícios.', { cause: error instanceof Error ? error.message : 'unknown' }, 'SYNC_FAILED'),
      { status: 500 },
    );
  }
}
