-- ══════════════════════════════════════════════════════════════
-- KRONOS Workout Engine — tabelas de suporte
-- Migration: 20260603000000
-- ══════════════════════════════════════════════════════════════

-- ── 1. Respostas de anamnese de treino ────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_anamnesis_responses (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode             text        NOT NULL CHECK (mode IN ('full_workout','specific_workout','protocol_adjustment')),
  answers          jsonb       NOT NULL DEFAULT '{}',
  context_snapshot jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_anamnesis_user_created
  ON public.workout_anamnesis_responses (user_id, created_at DESC);

-- ── 2. Logs de geração de treino pelo KRONOS ──────────────────
CREATE TABLE IF NOT EXISTS public.workout_generation_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode             text        NOT NULL,
  input_answers    jsonb       NOT NULL DEFAULT '{}',
  kronos_context   jsonb       NOT NULL DEFAULT '{}',
  generated_plan   jsonb       NOT NULL DEFAULT '{}',
  kronos_analysis  jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_generation_logs_user_created
  ON public.workout_generation_logs (user_id, created_at DESC);

-- ── 3. RLS ────────────────────────────────────────────────────
ALTER TABLE public.workout_anamnesis_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_generation_logs     ENABLE ROW LEVEL SECURITY;

-- workout_anamnesis_responses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workout_anamnesis_responses'
      AND policyname = 'user_own_anamnesis'
  ) THEN
    CREATE POLICY user_own_anamnesis
      ON public.workout_anamnesis_responses
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- workout_generation_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workout_generation_logs'
      AND policyname = 'user_own_logs'
  ) THEN
    CREATE POLICY user_own_logs
      ON public.workout_generation_logs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Validar ────────────────────────────────────────────────
-- Rodar após executar e confirmar que retorna 2 linhas:
--
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('workout_anamnesis_responses', 'workout_generation_logs');
