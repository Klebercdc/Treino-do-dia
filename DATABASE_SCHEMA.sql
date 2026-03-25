-- Scripts para o SQL Editor do Supabase

-- Tabela de Exercícios (Dicionário base)
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  muscle_group TEXT
);

-- Tabela de Treinos (Sessão diária)
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  duration_minutes INTEGER DEFAULT 60
);

-- Tabela de Logs (Input de RPE e Cargas)
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  weight_kg DECIMAL,
  reps INTEGER,
  rpe INTEGER CHECK (rpe >= 0 AND rpe <= 10)
);

-- View de Inteligência: Cálculo do ACWR (J.A.R.V.I.S. Engine)
CREATE OR REPLACE VIEW v_fatigue_analysis AS
WITH load_calc AS (
  SELECT 
    w.user_id,
    w.date,
    SUM(l.rpe * w.duration_minutes) as daily_load
  FROM workout_logs l
  JOIN workouts w ON l.workout_id = w.id
  GROUP BY w.user_id, w.date
),
rolling_metrics AS (
  SELECT 
    user_id,
    AVG(daily_load) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '7 days') as acute,
    AVG(daily_load) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '28 days') as chronic
  FROM load_calc
  GROUP BY user_id
)
SELECT 
  user_id,
  (acute / NULLIF(chronic, 0)) as acwr_index,
  CASE 
    WHEN (acute / NULLIF(chronic, 0)) > 1.5 THEN 'RISCO CRÍTICO'
    WHEN (acute / NULLIF(chronic, 0)) BETWEEN 0.8 AND 1.3 THEN 'OPTIMAL'
    ELSE 'RECUPERAÇÃO'
  END as status
FROM rolling_metrics;
