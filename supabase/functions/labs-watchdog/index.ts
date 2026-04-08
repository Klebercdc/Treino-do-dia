/**
 * KRONIA — Edge Function: labs-watchdog
 * ======================================
 * Roda a cada 15 minutos via pg_cron (migration 039).
 * Detecta exames presos em "processing" por mais de 20 minutos e
 * despacha cada um para /api/labs/process em paralelo.
 *
 * Por que Edge Function e não Vercel cron:
 *   - Vercel Hobby permite apenas 1 cron/dia (já usado por daily-dispatch).
 *   - Supabase pg_cron + Edge Function é gratuito e já está no stack do projeto.
 *   - Edge Function tem 150 s de wall-clock — suficiente para despacho paralelo.
 *   - Queries diretas ao banco sem hop de rede adicional.
 *
 * Autenticação:
 *   - Header: Authorization: Bearer CRON_SECRET
 *   - verify_jwt = false (mesma configuração do check-inactivity)
 *
 * Variáveis de ambiente (Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL              → URL do projeto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY → Service Role Key
 *   CRON_SECRET               → Secret compartilhado com a app Vercel
 *   APP_URL                   → URL da app Vercel (ex: https://treino-do-dia-orpin.vercel.app)
 *
 * Deploy:
 *   supabase functions deploy labs-watchdog --project-ref <PROJECT_REF>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STALE_MINUTES = 20;       // deve coincidir com service.ts PROCESSING_STALE_MINUTES
const BATCH_LIMIT   = 20;       // exames por ciclo; Hobby suporta concorrência paralela
const DISPATCH_TIMEOUT_MS = 55_000; // < maxDuration=60s da rota Vercel

interface StaleReport {
  id: string;
}

interface DispatchResult {
  labReportId: string;
  ok: boolean;
  httpStatus?: number;
  skipped?: boolean;
  timedOut?: boolean;
  error?: string;
}

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function dispatchOne(
  appUrl: string,
  cronSecret: string,
  labReportId: string,
): Promise<DispatchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${appUrl}/api/labs/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ labReportId }),
      signal: controller.signal,
    });

    const skipped = res.status === 202;
    return { labReportId, ok: res.ok || skipped, httpStatus: res.status, skipped };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return {
      labReportId,
      ok: false,
      timedOut,
      error: timedOut ? `dispatch_timeout_${DISPATCH_TIMEOUT_MS}ms` : (err instanceof Error ? err.message : 'unknown'),
    };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret       = Deno.env.get('CRON_SECRET') ?? '';
  const appUrl           = (Deno.env.get('APP_URL') ?? 'https://treino-do-dia-orpin.vercel.app').replace(/\/$/, '');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.' });
  }

  // Autenticação via CRON_SECRET (mesma proteção da rota Vercel)
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return jsonResponse(401, { error: 'Unauthorized.' });
    }
  }

  if (!cronSecret) {
    console.warn('[labs-watchdog] CRON_SECRET ausente — dispatch para /api/labs/process será rejeitado com 401.');
  }

  const executedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Busca exames presos em processing além do threshold de staleness
  const { data, error: queryError } = await sb
    .from('lab_reports')
    .select('id')
    .eq('status', 'processing')
    .lt('updated_at', staleBefore)
    .order('updated_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error('[labs-watchdog] Falha ao consultar exames presos:', queryError.message);
    return jsonResponse(500, { error: `db_query_failed: ${queryError.message}`, executedAt });
  }

  const staleReports = (data ?? []) as StaleReport[];

  if (staleReports.length === 0) {
    console.log('[labs-watchdog] Nenhum exame preso encontrado.', { staleBefore, executedAt });
    return jsonResponse(200, { ok: true, scanned: 0, dispatched: 0, staleBefore, executedAt });
  }

  console.log(`[labs-watchdog] ${staleReports.length} exame(s) preso(s) — despachando em paralelo.`, {
    staleBefore,
    ids: staleReports.map((r) => r.id),
  });

  // Despacho paralelo: cada exame recebe sua própria invocação Vercel com budget de 60 s
  const results = await Promise.allSettled(
    staleReports.map((r) => dispatchOne(appUrl, cronSecret, r.id)),
  );

  const settled = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { labReportId: 'unknown', ok: false, error: 'promise_rejected' },
  ) as DispatchResult[];

  const summary = {
    ok:        settled.filter((r) => r.ok && !r.skipped).length,
    skipped:   settled.filter((r) => r.skipped).length,
    failed:    settled.filter((r) => !r.ok).length,
    timedOut:  settled.filter((r) => r.timedOut).length,
  };

  console.log('[labs-watchdog] Concluído.', {
    scanned:  staleReports.length,
    ...summary,
    staleBefore,
    executedAt,
  });

  const allOk = summary.failed === 0;
  return jsonResponse(allOk ? 200 : 207, {
    ok:        allOk,
    scanned:   staleReports.length,
    ...summary,
    results:   settled,
    staleBefore,
    executedAt,
  });
});
