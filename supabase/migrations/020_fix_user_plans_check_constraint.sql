-- KRONIA — Migração 020: corrige CHECK constraint de user_plans
--
-- Problema:
--   planRules.toDbPlan(PLAN.TRIAL_ULTRA_7_DAYS) retorna 'trial_ultra_7_days'
--   mas o CHECK constraint só permitia ('free', 'trial', 'pro', 'ultra').
--   Usuários sem linha em user_plans recebiam INSERT com 'trial_ultra_7_days'
--   → constraint violation → callback de erro → 503 no chat.
--
-- Correção:
--   1. Expande o CHECK constraint para incluir 'trial_ultra_7_days'
--   2. Atualiza o trigger de novo usuário para criar plano 'trial' (em vez de 'free')
--      garantindo consistência com a intenção de dar trial a novos usuários

-- ── 1. Expandir CHECK constraint ─────────────────────────────────────────────
ALTER TABLE public.user_plans
  DROP CONSTRAINT IF EXISTS user_plans_plan_check;

ALTER TABLE public.user_plans
  ADD CONSTRAINT user_plans_plan_check
  CHECK (plan IN ('free', 'trial', 'trial_ultra_7_days', 'pro', 'ultra'));

-- ── 2. Atualizar trigger de novo usuário para conceder trial ─────────────────
-- Antes: criava com plan='free'
-- Depois: cria com plan='trial' (mapeado para TRIAL_ULTRA_7_DAYS em toCanonicalPlan)
CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan, ai_requests_used, period_start, trial_started_at)
  VALUES (NEW.id, 'trial', 0, date_trunc('month', NOW()), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 3. Garantir que o trigger está ativo ─────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created_plan ON auth.users;
CREATE TRIGGER on_auth_user_created_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_plan();

-- ── 4. Grants do service_role para escrita em user_plans ─────────────────────
-- Necessário para o backend usar SUPABASE_SERVICE_KEY sem bloqueio de RLS
GRANT SELECT, INSERT, UPDATE ON public.user_plans TO service_role;
GRANT SELECT ON public.user_plan_access_snapshot TO service_role;
GRANT EXECUTE ON FUNCTION public.get_trial_days() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_effective_plan(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_quotas() TO service_role;
GRANT EXECUTE ON FUNCTION public.register_feature_usage(UUID, TEXT, TEXT, INTEGER, JSONB, TEXT) TO service_role;
