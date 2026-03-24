-- ══════════════════════════════════════════════════════════════
-- KRONIA — Migração 006: Correções críticas no schema
--
-- Problemas corrigidos:
--   1. CHECK constraint de plan só permitia 'free' e 'pro' —
--      agora inclui 'trial' e 'ultra' (usados pelo _plans.js)
--   2. Coluna trial_started_at ausente — referenciada no _plans.js
--   3. auth_users_view ausente — usada em payment-webhook.js para
--      encontrar o user_id a partir do email de compra
--   4. Coluna tools em ai_usage_logs — adicionada para rastrear
--      quais ferramentas do agent foram usadas
-- ══════════════════════════════════════════════════════════════

-- ── 1. CORRIGIR CHECK CONSTRAINT em user_plans ───────────────
-- Remove a constraint antiga e recria com todos os planos válidos
ALTER TABLE user_plans
  DROP CONSTRAINT IF EXISTS user_plans_plan_check;

ALTER TABLE user_plans
  ADD CONSTRAINT user_plans_plan_check
  CHECK (plan IN ('free', 'trial', 'pro', 'ultra'));

-- ── 2. ADICIONAR trial_started_at ────────────────────────────
-- Referenciado em _plans.js para calcular expiração do trial
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- ── 3. CRIAR auth_users_view ──────────────────────────────────
-- Usada pelo payment-webhook.js para lookup de user_id por email
-- Necessita service_role (acesso a auth.users)
CREATE OR REPLACE VIEW public.auth_users_view AS
SELECT
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users;

-- RLS: apenas service_role acessa (webhook backend)
ALTER VIEW public.auth_users_view OWNER TO service_role;

-- ── 4. ADICIONAR coluna tools em ai_usage_logs ───────────────
-- Rastreia ferramentas usadas pelo agent (ex: "analisar_progresso,calcular_dieta")
ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS tools TEXT;

-- ── 5. TRIGGER: setar trial_started_at ao ativar trial ───────
-- Garante que trial_started_at seja preenchido automaticamente
CREATE OR REPLACE FUNCTION public.handle_trial_activation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.plan = 'trial' AND OLD.plan != 'trial' THEN
    NEW.trial_started_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trial_activation ON user_plans;
CREATE TRIGGER on_trial_activation
  BEFORE UPDATE ON user_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_trial_activation();

-- ── 6. ÍNDICE: lookup de plano por plan (útil para analytics) ─
CREATE INDEX IF NOT EXISTS idx_user_plans_plan ON user_plans (plan);
