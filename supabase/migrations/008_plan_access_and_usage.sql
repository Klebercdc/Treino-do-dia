-- KRONIA — Migração 008: integração de plano com banco (snapshot + uso de features)

-- 1) Log central de uso de features (fonte de auditoria e analytics)
CREATE TABLE IF NOT EXISTS feature_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  plan_at_use TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_user_created
  ON feature_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_created
  ON feature_usage_logs (feature_key, created_at DESC);

ALTER TABLE feature_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_usage: own_read"
  ON feature_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "feature_usage: service_write"
  ON feature_usage_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 2) Função SQL para resolver plano efetivo com trial/expiração
CREATE OR REPLACE FUNCTION public.resolve_effective_plan(
  p_plan TEXT,
  p_trial_started_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ,
  p_trial_days INTEGER DEFAULT 7
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_plan IS NULL THEN
    RETURN 'free';
  END IF;

  IF p_plan IN ('pro', 'ultra') THEN
    IF p_expires_at IS NOT NULL AND p_expires_at < NOW() THEN
      RETURN 'free';
    END IF;
    RETURN p_plan;
  END IF;

  IF p_plan IN ('trial', 'trial_ultra_7_days') THEN
    IF p_trial_started_at IS NULL THEN
      RETURN 'free';
    END IF;

    IF p_trial_started_at + make_interval(days => p_trial_days) <= NOW() THEN
      RETURN 'free';
    END IF;

    RETURN 'trial_ultra_7_days';
  END IF;

  RETURN 'free';
END;
$$;

-- 3) Snapshot de acesso por usuário (raw/effective)
CREATE OR REPLACE VIEW public.user_plan_access_snapshot AS
SELECT
  up.user_id,
  up.plan AS raw_plan,
  public.resolve_effective_plan(up.plan, up.trial_started_at, up.expires_at, 7) AS effective_plan,
  up.ai_requests_used,
  up.period_start,
  up.trial_started_at,
  CASE
    WHEN up.trial_started_at IS NULL THEN NULL
    ELSE up.trial_started_at + INTERVAL '7 days'
  END AS trial_expires_at,
  up.expires_at,
  (up.expires_at IS NOT NULL AND up.expires_at >= NOW()) AS subscription_active
FROM public.user_plans up;

ALTER VIEW public.user_plan_access_snapshot OWNER TO postgres;

GRANT SELECT ON public.user_plan_access_snapshot TO authenticated;
GRANT SELECT ON public.user_plan_access_snapshot TO service_role;

-- 4) RPC de escrita padronizada de uso de feature
CREATE OR REPLACE FUNCTION public.register_feature_usage(
  p_user_id UUID,
  p_feature_key TEXT,
  p_plan_at_use TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.feature_usage_logs (user_id, feature_key, plan_at_use, quantity, metadata)
  VALUES (p_user_id, p_feature_key, p_plan_at_use, GREATEST(1, p_quantity), COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
