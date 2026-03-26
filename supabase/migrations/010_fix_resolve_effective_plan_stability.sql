-- KRONIA — Migração 010: correção de volatilidade da função resolve_effective_plan
-- Motivo: função usa NOW(), portanto não pode ser IMMUTABLE.

CREATE OR REPLACE FUNCTION public.resolve_effective_plan(
  p_plan TEXT,
  p_trial_started_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ,
  p_trial_days INTEGER DEFAULT 7
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
