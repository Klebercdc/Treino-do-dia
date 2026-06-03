-- Respostas de anamnese de treino
CREATE TABLE IF NOT EXISTS workout_anamnesis_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id),
  mode             text NOT NULL CHECK (mode IN ('full_workout','specific_workout','protocol_adjustment')),
  answers          jsonb NOT NULL DEFAULT '{}',
  context_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Logs de geração de treino pelo KRONOS
CREATE TABLE IF NOT EXISTS workout_generation_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id),
  mode             text NOT NULL,
  input_answers    jsonb NOT NULL DEFAULT '{}',
  kronos_context   jsonb NOT NULL DEFAULT '{}',
  generated_plan   jsonb NOT NULL DEFAULT '{}',
  kronos_analysis  jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE workout_anamnesis_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_generation_logs     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_anamnesis_responses' AND policyname='user_own_anamnesis') THEN
    CREATE POLICY user_own_anamnesis ON workout_anamnesis_responses FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_generation_logs' AND policyname='user_own_logs') THEN
    CREATE POLICY user_own_logs ON workout_generation_logs FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
