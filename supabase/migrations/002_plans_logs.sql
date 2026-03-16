-- ══════════════════════════════════════════════════════
-- TITAN PRO — Migração 002: Planos, Logs de uso, LGPD
-- Execute este script no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════

-- ─── Planos de usuário ────────────────────────────────
-- plan: 'free' | 'pro'
-- ai_requests_used: contador mensal de chamadas de IA
-- period_start: início do período de quota atual
-- hotmart_subscriber_code: código do assinante no Hotmart (opcional)
CREATE TABLE IF NOT EXISTS user_plans (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                  TEXT        NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  ai_requests_used      INTEGER     NOT NULL DEFAULT 0,
  period_start          TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
  hotmart_subscriber_code TEXT,
  kiwify_subscriber_id  TEXT,
  activated_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Logs de uso de IA (tokens NVIDIA) ───────────────
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint        TEXT        NOT NULL, -- 'chat' | 'agent' | 'agente-*'
  prompt_tokens   INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER   NOT NULL DEFAULT 0,
  total_tokens    INTEGER     NOT NULL DEFAULT 0,
  model           TEXT,
  cost_usd        NUMERIC(10,6) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Webhooks recebidos (Hotmart / Kiwify) ────────────
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT        NOT NULL, -- 'hotmart' | 'kiwify'
  event        TEXT        NOT NULL,
  buyer_email  TEXT,
  payload      JSONB       NOT NULL DEFAULT '{}',
  processed    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Solicitações de exclusão de dados (LGPD) ─────────
CREATE TABLE IF NOT EXISTS deletion_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed'))
);

-- ─── Índices ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id    ON ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_email   ON payment_webhooks (buyer_email);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user   ON deletion_requests (user_id);

-- ════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════

ALTER TABLE user_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhooks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

-- user_plans: usuário lê o próprio plano
CREATE POLICY "plans: leitura própria"    ON user_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "plans: inserção própria"   ON user_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "plans: atualização própria" ON user_plans FOR UPDATE USING (auth.uid() = user_id);

-- ai_usage_logs: usuário lê os próprios logs
CREATE POLICY "ai_logs: leitura própria"  ON ai_usage_logs FOR SELECT USING (auth.uid() = user_id);

-- payment_webhooks: somente serviço (sem acesso público via RLS)
-- (acesso apenas via service_role key no backend)
CREATE POLICY "webhooks: nenhum acesso público" ON payment_webhooks FOR ALL USING (false);

-- deletion_requests: usuário lê/cria a própria solicitação
CREATE POLICY "deletion: leitura própria"  ON deletion_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "deletion: inserção própria" ON deletion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════
-- FUNÇÃO: garantir criação de plano free ao registrar
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan, ai_requests_used, period_start)
  VALUES (NEW.id, 'free', 0, date_trunc('month', NOW()))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: cria plano free para todo novo usuário
DROP TRIGGER IF EXISTS on_auth_user_created_plan ON auth.users;
CREATE TRIGGER on_auth_user_created_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_plan();

-- ════════════════════════════════════════════════════
-- FUNÇÃO: reset mensal automático de quota
-- Execute mensalmente via pg_cron ou Supabase Edge Function
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reset_monthly_quotas()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.user_plans
  SET ai_requests_used = 0,
      period_start     = date_trunc('month', NOW()),
      updated_at       = NOW()
  WHERE period_start < date_trunc('month', NOW());
END;
$$;
