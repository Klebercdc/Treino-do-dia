-- ══════════════════════════════════════════════════════════════════════
-- KRONIA — Bootstrap completo do banco de dados (idempotente)
-- Execute este script no SQL Editor do Supabase em caso de banco vazio
-- ou parcialmente aplicado. Seguro para rodar mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. TABELAS PRINCIPAIS
-- ────────────────────────────────────────────────────────────────────

-- Perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  config     JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de treinos
CREATE TABLE IF NOT EXISTS public.workout_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_data JSONB       NOT NULL,
  trained_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Templates de treino
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  templates  JSONB       NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Planos de usuário
CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                    TEXT        NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('free','trial','trial_ultra_7_days','pro','ultra')),
  ai_requests_used        INTEGER     NOT NULL DEFAULT 0,
  period_start            TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
  hotmart_subscriber_code TEXT,
  kiwify_subscriber_id    TEXT,
  activated_at            TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_started_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de uso de IA
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint          TEXT        NOT NULL,
  prompt_tokens     INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER     NOT NULL DEFAULT 0,
  total_tokens      INTEGER     NOT NULL DEFAULT 0,
  model             TEXT,
  cost_usd          NUMERIC(10,6) DEFAULT 0,
  tools             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhooks de pagamento
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT    NOT NULL,
  event       TEXT    NOT NULL,
  buyer_email TEXT,
  payload     JSONB   NOT NULL DEFAULT '{}',
  processed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solicitações de exclusão LGPD
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed'))
);

-- Logs de uso de features
CREATE TABLE IF NOT EXISTS public.feature_usage_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT        NOT NULL,
  plan_at_use TEXT        NOT NULL,
  quantity    INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  event_key   TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configurações de runtime
CREATE TABLE IF NOT EXISTS public.app_runtime_settings (
  key        TEXT PRIMARY KEY,
  int_value  INTEGER NOT NULL CHECK (int_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_runtime_settings (key, int_value)
VALUES ('trial_days', 7)
ON CONFLICT (key) DO NOTHING;

-- Afiliados — referências
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level            SMALLINT NOT NULL CHECK (level IN (1,2)),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_user_id, level)
);

-- Afiliados — comissões
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           TEXT     NOT NULL,
  buyer_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  affiliate_user_id UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commission_type   TEXT     NOT NULL CHECK (commission_type IN ('direct','recurring','second_level')),
  level             SMALLINT NOT NULL CHECK (level IN (1,2)),
  rate              NUMERIC(5,4) NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  status            TEXT     NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','rejected')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Afiliados — vendas
CREATE TABLE IF NOT EXISTS public.affiliate_sales (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id                  TEXT          NOT NULL UNIQUE,
  buyer_user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  level1_affiliate_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  level2_affiliate_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  gross_amount             NUMERIC(10,2) NOT NULL CHECK (gross_amount > 0),
  is_recurring             BOOLEAN       NOT NULL DEFAULT false,
  provider                 TEXT,
  occurred_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
-- 2. ÍNDICES
-- ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workout_history_user_id    ON public.workout_history (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_history_trained_at ON public.workout_history (user_id, trained_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id      ON public.ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at   ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_email     ON public.payment_webhooks (buyer_email);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user     ON public.deletion_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_created ON public.feature_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_created ON public.feature_usage_logs (feature_key, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_feature_usage_event_key ON public.feature_usage_logs (event_key);
CREATE INDEX IF NOT EXISTS idx_user_plans_plan            ON public.user_plans (plan);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_buyer      ON public.affiliate_sales (buyer_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_l1         ON public.affiliate_sales (level1_affiliate_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_l2         ON public.affiliate_sales (level2_affiliate_user_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_affiliate_commissions_sale_affiliate_type_level
  ON public.affiliate_commissions (sale_id, affiliate_user_id, commission_type, level);

-- ────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhooks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_sales     ENABLE ROW LEVEL SECURITY;

-- Políticas (criadas apenas se ainda não existirem)
DO $$ BEGIN

  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles: leitura própria') THEN
    CREATE POLICY "profiles: leitura própria" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles: inserção própria') THEN
    CREATE POLICY "profiles: inserção própria" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles: atualização própria') THEN
    CREATE POLICY "profiles: atualização própria" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;

  -- workout_history
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_history' AND policyname='history: leitura própria') THEN
    CREATE POLICY "history: leitura própria" ON public.workout_history FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_history' AND policyname='history: inserção própria') THEN
    CREATE POLICY "history: inserção própria" ON public.workout_history FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_history' AND policyname='history: exclusão própria') THEN
    CREATE POLICY "history: exclusão própria" ON public.workout_history FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- workout_templates
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_templates' AND policyname='templates: leitura própria') THEN
    CREATE POLICY "templates: leitura própria" ON public.workout_templates FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_templates' AND policyname='templates: inserção própria') THEN
    CREATE POLICY "templates: inserção própria" ON public.workout_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_templates' AND policyname='templates: atualização própria') THEN
    CREATE POLICY "templates: atualização própria" ON public.workout_templates FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  -- user_plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_plans' AND policyname='plans: leitura própria') THEN
    CREATE POLICY "plans: leitura própria" ON public.user_plans FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_plans' AND policyname='plans: inserção própria') THEN
    CREATE POLICY "plans: inserção própria" ON public.user_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_plans' AND policyname='plans: atualização própria') THEN
    CREATE POLICY "plans: atualização própria" ON public.user_plans FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  -- ai_usage_logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_usage_logs' AND policyname='ai_logs: leitura própria') THEN
    CREATE POLICY "ai_logs: leitura própria" ON public.ai_usage_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- payment_webhooks
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_webhooks' AND policyname='webhooks: nenhum acesso público') THEN
    CREATE POLICY "webhooks: nenhum acesso público" ON public.payment_webhooks FOR ALL USING (false);
  END IF;

  -- deletion_requests
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deletion_requests' AND policyname='deletion: leitura própria') THEN
    CREATE POLICY "deletion: leitura própria" ON public.deletion_requests FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deletion_requests' AND policyname='deletion: inserção própria') THEN
    CREATE POLICY "deletion: inserção própria" ON public.deletion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  -- feature_usage_logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feature_usage_logs' AND policyname='feature_usage: own_read') THEN
    CREATE POLICY "feature_usage: own_read" ON public.feature_usage_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feature_usage_logs' AND policyname='feature_usage: service_write') THEN
    CREATE POLICY "feature_usage: service_write" ON public.feature_usage_logs FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;

  -- affiliate_referrals
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliate_referrals' AND policyname='affiliate_referrals: own') THEN
    CREATE POLICY "affiliate_referrals: own" ON public.affiliate_referrals FOR SELECT
      USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);
  END IF;

  -- affiliate_commissions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliate_commissions' AND policyname='affiliate_commissions: own') THEN
    CREATE POLICY "affiliate_commissions: own" ON public.affiliate_commissions FOR SELECT
      USING (auth.uid() = affiliate_user_id);
  END IF;

  -- affiliate_sales
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliate_sales' AND policyname='affiliate_sales: read own') THEN
    CREATE POLICY "affiliate_sales: read own" ON public.affiliate_sales FOR SELECT
      USING (auth.uid() = buyer_user_id OR auth.uid() = level1_affiliate_user_id OR auth.uid() = level2_affiliate_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliate_sales' AND policyname='affiliate_sales: service insert') THEN
    CREATE POLICY "affiliate_sales: service insert" ON public.affiliate_sales FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;

END $$;

-- ────────────────────────────────────────────────────────────────────
-- 4. FUNÇÕES
-- ────────────────────────────────────────────────────────────────────

-- Trigger: novo usuário recebe plano trial
CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan, ai_requests_used, period_start, trial_started_at)
  VALUES (NEW.id, 'trial', 0, date_trunc('month', NOW()), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: preenche trial_started_at ao ativar trial
CREATE OR REPLACE FUNCTION public.handle_trial_activation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.plan IN ('trial','trial_ultra_7_days') AND OLD.plan NOT IN ('trial','trial_ultra_7_days') THEN
    NEW.trial_started_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Reset mensal de quota
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

-- Duração do trial (lê do app_runtime_settings)
CREATE OR REPLACE FUNCTION public.get_trial_days()
RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT int_value FROM public.app_runtime_settings WHERE key = 'trial_days' LIMIT 1),
    7
  )::INTEGER;
$$;

-- Resolve plano efetivo (considera expiração do trial/assinatura)
CREATE OR REPLACE FUNCTION public.resolve_effective_plan(
  p_plan TEXT,
  p_trial_started_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ,
  p_trial_days INTEGER DEFAULT 7
)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_plan IS NULL THEN RETURN 'free'; END IF;

  IF p_plan IN ('pro', 'ultra') THEN
    IF p_expires_at IS NOT NULL AND p_expires_at < NOW() THEN RETURN 'free'; END IF;
    RETURN p_plan;
  END IF;

  IF p_plan IN ('trial', 'trial_ultra_7_days') THEN
    IF p_trial_started_at IS NULL THEN RETURN 'free'; END IF;
    IF p_trial_started_at + make_interval(days => p_trial_days) <= NOW() THEN RETURN 'free'; END IF;
    RETURN 'trial_ultra_7_days';
  END IF;

  RETURN 'free';
END;
$$;

-- Registra uso de feature (idempotente por event_key)
CREATE OR REPLACE FUNCTION public.register_feature_usage(
  p_user_id     UUID,
  p_feature_key TEXT,
  p_plan_at_use TEXT,
  p_quantity    INTEGER DEFAULT 1,
  p_metadata    JSONB   DEFAULT '{}',
  p_event_key   TEXT    DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_event_key TEXT;
BEGIN
  v_event_key := COALESCE(NULLIF(p_event_key, ''), gen_random_uuid()::text);
  INSERT INTO public.feature_usage_logs (user_id, feature_key, plan_at_use, quantity, metadata, event_key)
  VALUES (p_user_id, p_feature_key, p_plan_at_use, GREATEST(1, p_quantity), COALESCE(p_metadata, '{}'::jsonb), v_event_key)
  ON CONFLICT (event_key) DO UPDATE SET event_key = EXCLUDED.event_key
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Self-referral bloqueado
CREATE OR REPLACE FUNCTION public.block_self_referral()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referrer_user_id = NEW.referred_user_id THEN
    RAISE EXCEPTION 'self-referral não permitido';
  END IF;
  RETURN NEW;
END;
$$;

-- Marca comissões como pagas
CREATE OR REPLACE FUNCTION public.mark_commissions_paid(p_sale_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.affiliate_commissions
  SET status = 'paid'
  WHERE sale_id = p_sale_id AND status IN ('pending','approved');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Processa venda de afiliado (atômica e idempotente)
CREATE OR REPLACE FUNCTION public.process_affiliate_sale(
  p_sale        JSONB,
  p_commissions JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sale_id         TEXT;
  v_inserted_sale   BOOLEAN := false;
  v_commission_count INTEGER := 0;
  v_commissions     JSONB := '[]'::jsonb;
BEGIN
  v_sale_id := p_sale->>'sale_id';
  IF v_sale_id IS NULL OR btrim(v_sale_id) = '' THEN
    RAISE EXCEPTION 'sale_id obrigatório';
  END IF;

  INSERT INTO public.affiliate_sales (sale_id, buyer_user_id, level1_affiliate_user_id,
    level2_affiliate_user_id, gross_amount, is_recurring, provider)
  VALUES (
    v_sale_id,
    NULLIF(p_sale->>'buyer_user_id','')::uuid,
    NULLIF(p_sale->>'level1_affiliate_user_id','')::uuid,
    NULLIF(p_sale->>'level2_affiliate_user_id','')::uuid,
    (p_sale->>'gross_amount')::numeric,
    COALESCE((p_sale->>'is_recurring')::boolean, false),
    NULLIF(p_sale->>'provider','')
  )
  ON CONFLICT (sale_id) DO NOTHING;
  v_inserted_sale := FOUND;

  IF v_inserted_sale AND jsonb_typeof(p_commissions) = 'array' AND jsonb_array_length(p_commissions) > 0 THEN
    INSERT INTO public.affiliate_commissions
      (sale_id,buyer_user_id,affiliate_user_id,commission_type,level,rate,amount,status,created_at)
    SELECT c.sale_id,c.buyer_user_id,c.affiliate_user_id,c.commission_type,c.level,
           c.rate,c.amount,COALESCE(c.status,'pending'),COALESCE(c.created_at,NOW())
    FROM jsonb_to_recordset(p_commissions) AS c(
      sale_id text, buyer_user_id uuid, affiliate_user_id uuid,
      commission_type text, level smallint, rate numeric,
      amount numeric, status text, created_at timestamptz)
    ON CONFLICT (sale_id,affiliate_user_id,commission_type,level) DO NOTHING;
  END IF;

  SELECT COALESCE(COUNT(*),0) INTO v_commission_count FROM public.affiliate_commissions WHERE sale_id=v_sale_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at),'[]'::jsonb)
    INTO v_commissions FROM public.affiliate_commissions c WHERE c.sale_id=v_sale_id;

  RETURN jsonb_build_object('ok',true,'sale_id',v_sale_id,'idempotent',NOT v_inserted_sale,
    'commission_count',v_commission_count,'commissions',v_commissions);
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 5. TRIGGERS
-- ────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created_plan ON auth.users;
CREATE TRIGGER on_auth_user_created_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_plan();

DROP TRIGGER IF EXISTS on_trial_activation ON public.user_plans;
CREATE TRIGGER on_trial_activation
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_trial_activation();

DROP TRIGGER IF EXISTS trg_block_self_referral ON public.affiliate_referrals;
CREATE TRIGGER trg_block_self_referral
  BEFORE INSERT ON public.affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.block_self_referral();

-- ────────────────────────────────────────────────────────────────────
-- 6. VIEWS
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.auth_users_view AS
SELECT id, email, created_at, last_sign_in_at FROM auth.users;
ALTER VIEW public.auth_users_view OWNER TO service_role;

CREATE OR REPLACE VIEW public.user_plan_access_snapshot AS
SELECT
  up.user_id,
  up.plan AS raw_plan,
  public.resolve_effective_plan(up.plan, up.trial_started_at, up.expires_at, public.get_trial_days()) AS effective_plan,
  up.ai_requests_used,
  up.period_start,
  up.trial_started_at,
  CASE WHEN up.trial_started_at IS NULL THEN NULL
    ELSE up.trial_started_at + make_interval(days => public.get_trial_days())
  END AS trial_expires_at,
  up.expires_at,
  (up.expires_at IS NOT NULL AND up.expires_at >= NOW()) AS subscription_active
FROM public.user_plans up;
ALTER VIEW public.user_plan_access_snapshot OWNER TO postgres;

-- ────────────────────────────────────────────────────────────────────
-- 7. GRANTS (service_role precisa de acesso direto às tabelas)
-- ────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.user_plans TO service_role;
GRANT SELECT, INSERT ON public.ai_usage_logs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.payment_webhooks TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.deletion_requests TO service_role;
GRANT SELECT, INSERT ON public.feature_usage_logs TO service_role;
GRANT SELECT, INSERT ON public.affiliate_sales TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.affiliate_commissions TO service_role;
GRANT SELECT ON public.user_plan_access_snapshot TO authenticated, service_role;
GRANT SELECT ON public.auth_users_view TO service_role;

GRANT EXECUTE ON FUNCTION public.get_trial_days() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_effective_plan(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_quotas() TO service_role;
GRANT EXECUTE ON FUNCTION public.register_feature_usage(UUID, TEXT, TEXT, INTEGER, JSONB, TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.process_affiliate_sale(JSONB, JSONB) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_commissions_paid(TEXT) TO service_role;
