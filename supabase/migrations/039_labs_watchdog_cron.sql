-- ═══════════════════════════════════════════════════════════════════════════
-- KRONIA 039 — Watchdog de exames via pg_cron + Edge Function
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Objetivo: detectar exames presos em "processing" e dispará-los para
--           reprocessamento a cada 15 minutos, dentro do plano Hobby da Vercel
--           (1 cron/dia Vercel → watchdog frequente via Supabase pg_cron grátis).
--
-- Pré-requisitos (executar UMA VEZ no SQL Editor do Supabase antes desta migration):
--
--   1. Habilitar as extensões (se não estiverem ativas):
--      CREATE EXTENSION IF NOT EXISTS pg_cron;
--      CREATE EXTENSION IF NOT EXISTS pg_net;
--
--   2. Registrar o CRON_SECRET como configuração do banco para que o pg_cron
--      possa passá-lo no header sem expô-lo no código-fonte da migration:
--      ALTER DATABASE postgres SET app.cron_secret = 'SEU_CRON_SECRET_AQUI';
--
--      Após o ALTER DATABASE, reconecte ou execute:
--      SELECT pg_reload_conf();
--
-- O CRON_SECRET deve ser o mesmo valor configurado em:
--   - Vercel: variável de ambiente CRON_SECRET
--   - Supabase Dashboard → Edge Functions → Secrets → CRON_SECRET
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Garante que as extensões necessárias estejam disponíveis ─────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 2. Remove agendamento anterior para idempotência (re-execução segura) ───
SELECT cron.unschedule('labs-watchdog-every-15min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'labs-watchdog-every-15min'
);

-- ── 3. Agenda o watchdog a cada 15 minutos ──────────────────────────────────
--
-- A Edge Function labs-watchdog:
--   - Busca lab_reports com status='processing' e updated_at < now()-20min
--   - Despacha cada um para https://<APP_URL>/api/labs/process em paralelo
--   - Retorna resumo (scanned, dispatched, skipped, failed)
--
-- Timeout de rede: 60 s (< 150 s de wall-clock da Edge Function)
-- Limite por ciclo: 20 exames (paralelo → tempo = o mais lento, não a soma)
--
SELECT cron.schedule(
  'labs-watchdog-every-15min',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://twxoddzogbmaysebhour.supabase.co/functions/v1/labs-watchdog',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
                 ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 60000
    ) AS request_id;
  $$
);

-- ── 4. Verifica se o cron foi criado ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'labs-watchdog-every-15min') THEN
    RAISE EXCEPTION 'Cron labs-watchdog-every-15min não foi criado. Verifique se pg_cron está habilitado.';
  END IF;
END $$;

COMMENT ON EXTENSION pg_cron IS 'Agendamento de tarefas periódicas no banco PostgreSQL.';
COMMENT ON EXTENSION pg_net  IS 'Chamadas HTTP assíncronas a partir do PostgreSQL (pg_net).';
