-- Eventos de adaptação gerados pelo Decision Layer V1
-- Status: pending → accepted | rejected | expired

CREATE TABLE IF NOT EXISTS public.adaptation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adaptation_type TEXT NOT NULL CHECK (adaptation_type IN (
    'VOLUME_INCREASE',
    'VOLUME_DECREASE',
    'DELOAD',
    'PR_CELEBRATED',
    'PROGRESSIVE_OVERLOAD_READY',
    'CONSISTENCY_REWARD',
    'RETURN_REMINDER'
  )),
  load_state      TEXT CHECK (load_state IN ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH')),
  reasoning       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adaptation_events_user_status
  ON public.adaptation_events(user_id, status, created_at DESC);

ALTER TABLE public.adaptation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adaptation_events_select_own" ON public.adaptation_events;
CREATE POLICY "adaptation_events_select_own"
  ON public.adaptation_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "adaptation_events_update_own" ON public.adaptation_events;
CREATE POLICY "adaptation_events_update_own"
  ON public.adaptation_events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "adaptation_events_insert_service" ON public.adaptation_events;
CREATE POLICY "adaptation_events_insert_service"
  ON public.adaptation_events FOR INSERT
  TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "adaptation_events_update_service" ON public.adaptation_events;
CREATE POLICY "adaptation_events_update_service"
  ON public.adaptation_events FOR UPDATE
  TO service_role USING (true);
