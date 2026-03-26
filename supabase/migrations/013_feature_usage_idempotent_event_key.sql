-- KRONIA — Migração 013: idempotência de feature usage por event_key

ALTER TABLE public.feature_usage_logs
  ADD COLUMN IF NOT EXISTS event_key TEXT;

UPDATE public.feature_usage_logs
SET event_key = id::text
WHERE event_key IS NULL;

ALTER TABLE public.feature_usage_logs
  ALTER COLUMN event_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_feature_usage_event_key
  ON public.feature_usage_logs (event_key);

CREATE OR REPLACE FUNCTION public.register_feature_usage(
  p_user_id UUID,
  p_feature_key TEXT,
  p_plan_at_use TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}',
  p_event_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_event_key TEXT;
BEGIN
  v_event_key := COALESCE(NULLIF(p_event_key, ''), gen_random_uuid()::text);

  INSERT INTO public.feature_usage_logs (user_id, feature_key, plan_at_use, quantity, metadata, event_key)
  VALUES (p_user_id, p_feature_key, p_plan_at_use, GREATEST(1, p_quantity), COALESCE(p_metadata, '{}'::jsonb), v_event_key)
  ON CONFLICT (event_key) DO UPDATE
  SET event_key = EXCLUDED.event_key
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_feature_usage(UUID, TEXT, TEXT, INTEGER, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_feature_usage(UUID, TEXT, TEXT, INTEGER, JSONB, TEXT) TO authenticated;
