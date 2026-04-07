/**
 * Endpoint de watchdog manual para exames presos em "processing".
 *
 * USO CORRETO: trigger pontual via curl/admin para recuperar exames após
 * incidente — ex: falha de OCR em lote, degradação de serviço externo.
 *
 * NÃO USE como automação frequente ou cron independente:
 *   - Processa OCR inline e serial (até 45 s por exame) — estoura maxDuration
 *     se houver vários exames presos.
 *   - O agendamento oficial é o daily-dispatch (vercel.json, 04:00 UTC), que
 *     usa a variante de dispatch assíncrono (não-bloqueante) do watchdog.
 *   - Adicionar este endpoint ao vercel.json como cron frequente reproduziria
 *     o risco de cascata corrigido no PR #355.
 *
 * Query param: ?limit=N (padrão 5, máximo 50).
 */
import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import {
  isAuthorizedCronRequest,
  runLabsWatchdogTask,
} from '../../../../../server/internal/cron/dispatcher';

export const runtime = 'nodejs';
// Processamento OCR inline pode levar até 45 s por exame — maxDuration obrigatório.
export const maxDuration = 60;

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
