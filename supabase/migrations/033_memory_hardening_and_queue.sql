-- KRONIA 033 - Hardening da memória evolutiva + fila de recomputação

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_memory_events_event_type_check'
  ) THEN
    ALTER TABLE public.user_memory_events
      ADD CONSTRAINT user_memory_events_event_type_check
      CHECK (
        event_type = ANY (ARRAY[
          'workout_completed',
          'workout_generated',
          'diet_generated',
          'diet_feedback',
          'body_metrics',
          'weight_update',
          'checkin',
          'subjective_feedback'
        ])
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_memory_events_payload_size_check'
  ) THEN
    ALTER TABLE public.user_memory_events
      ADD CONSTRAINT user_memory_events_payload_size_check
      CHECK (pg_column_size(payload) <= 8192);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_memory_recompute_jobs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed')),
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocks TEXT[] NOT NULL DEFAULT ARRAY['coaching_summary']::TEXT[],
  attempts INTEGER NOT NULL DEFAULT 0,
  latest_request_id TEXT,
  latest_component TEXT,
  last_error TEXT,
  last_completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_recompute_jobs_status_due_at
  ON public.user_memory_recompute_jobs (status, due_at ASC);

ALTER TABLE public.user_memory_recompute_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_memory_recompute_jobs_service_all" ON public.user_memory_recompute_jobs;
CREATE POLICY "user_memory_recompute_jobs_service_all"
  ON public.user_memory_recompute_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
