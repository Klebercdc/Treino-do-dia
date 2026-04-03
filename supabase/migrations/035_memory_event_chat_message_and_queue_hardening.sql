-- KRONIA 035 - Ajustes finais de memória: chat_message + hardening de transição de jobs

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_memory_events_event_type_check'
  ) THEN
    ALTER TABLE public.user_memory_events DROP CONSTRAINT user_memory_events_event_type_check;
  END IF;

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
        'subjective_feedback',
        'chat_message'
      ])
    );
END;
$$;

-- garante lock_token obrigatório quando status=processing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_memory_recompute_jobs_processing_lock_check'
  ) THEN
    ALTER TABLE public.user_memory_recompute_jobs
      ADD CONSTRAINT user_memory_recompute_jobs_processing_lock_check
      CHECK (
        (status <> 'processing') OR (lock_token IS NOT NULL AND locked_at IS NOT NULL)
      );
  END IF;
END;
$$;
