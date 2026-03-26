-- KRONIA — Migração 012: fonte única para duração de trial

CREATE TABLE IF NOT EXISTS public.app_runtime_settings (
  key TEXT PRIMARY KEY,
  int_value INTEGER NOT NULL CHECK (int_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_runtime_settings (key, int_value)
VALUES ('trial_days', 7)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_trial_days()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT int_value FROM public.app_runtime_settings WHERE key = 'trial_days' LIMIT 1),
    7
  )::INTEGER;
$$;

GRANT EXECUTE ON FUNCTION public.get_trial_days() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_trial_days() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_effective_plan(
  p_plan TEXT,
  p_trial_started_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ,
  p_trial_days INTEGER DEFAULT public.get_trial_days()
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
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

CREATE OR REPLACE VIEW public.user_plan_access_snapshot AS
SELECT
  up.user_id,
  up.plan AS raw_plan,
  public.resolve_effective_plan(
    up.plan,
    up.trial_started_at,
    up.expires_at,
    public.get_trial_days()
  ) AS effective_plan,
  up.ai_requests_used,
  up.period_start,
  up.trial_started_at,
  CASE
    WHEN up.trial_started_at IS NULL THEN NULL
    ELSE up.trial_started_at + make_interval(days => public.get_trial_days())
  END AS trial_expires_at,
  up.expires_at,
  (up.expires_at IS NOT NULL AND up.expires_at >= NOW()) AS subscription_active
FROM public.user_plans up;

ALTER VIEW public.user_plan_access_snapshot OWNER TO postgres;
