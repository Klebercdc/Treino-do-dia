-- ══════════════════════════════════════════════════════════════
-- KRONIA TRANSFORMS — Migração 004
-- Motor de Recomendação: tabelas relacionais, ACWR View e RLS.
--
-- Nós do grafo implementados aqui:
--   EXC  → exercises
--   TRN  → workouts
--   FAD  → workout_logs (input de RPE)
--   FAD  → view acwr_diario (cálculo automático)
--   PUSH → push_subscriptions (engajamento)
-- ══════════════════════════════════════════════════════════════

-- ── 1. DICIONÁRIO DE EXERCÍCIOS (Nó EXC) ─────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  muscle_group TEXT,
  source       TEXT DEFAULT 'manual',   -- 'free-exercise-db' | 'manual'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises (LOWER(name));

-- ── 2. SESSÕES DE TREINO (Nó TRN) ────────────────────────────
CREATE TABLE IF NOT EXISTS workouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts (user_id, date DESC);

-- ── 3. LOGS DE EXERCÍCIO POR SESSÃO (conecta TRN + EXC → FAD) ─
--    RPE obrigatório (escala 0–10, inteiro)
CREATE TABLE IF NOT EXISTS workout_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  UUID NOT NULL REFERENCES workouts(id)  ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight_kg   NUMERIC(6,2) CHECK (weight_kg >= 0 AND weight_kg <= 500),
  reps        INTEGER      CHECK (reps > 0 AND reps <= 200),
  rpe         NUMERIC(3,1) NOT NULL CHECK (rpe >= 0 AND rpe <= 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_workout   ON workout_logs (workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise  ON workout_logs (exercise_id);

-- ── 4. PERSONAL RECORDS (Nó PR) ──────────────────────────────
CREATE TABLE IF NOT EXISTS personal_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id)  ON DELETE CASCADE,
  weight_kg   NUMERIC(6,2) NOT NULL CHECK (weight_kg > 0),
  reps        INTEGER      NOT NULL DEFAULT 1 CHECK (reps > 0),
  one_rm_kg   NUMERIC(7,2),   -- 1RM estimado pela fórmula de Brzycki
  recorded_at DATE         NOT NULL DEFAULT CURRENT_DATE,
  source      TEXT DEFAULT 'manual', -- 'onboarding' | 'manual' | 'auto'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_user_exercise ON personal_records (user_id, exercise_id, recorded_at DESC);

-- ── 5. PUSH SUBSCRIPTIONS (Engajamento) ───────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, (subscription_json->>'endpoint'))
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id);

-- ══════════════════════════════════════════════════════════════
-- VIEW: ACWR DIÁRIO (Nó FAD)
-- Baseado em Gabbett (2016) — Acute:Chronic Workload Ratio
--
-- sRPE (Session RPE) = duration_minutes × média_rpe_do_treino
-- Carga Aguda   = soma sRPE dos últimos 7 dias
-- Carga Crônica = média semanal do sRPE dos últimos 28 dias
--                 = (soma 28 dias) / 4   [4 semanas]
-- ACWR = Aguda / Crônica
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW acwr_diario AS
WITH srpe_por_sessao AS (
  -- sRPE de cada sessão = duracao × media_rpe
  SELECT
    w.user_id,
    w.date,
    w.id AS workout_id,
    w.duration_minutes,
    AVG(wl.rpe)                                    AS media_rpe,
    w.duration_minutes * AVG(wl.rpe)               AS srpe
  FROM workouts w
  JOIN workout_logs wl ON wl.workout_id = w.id
  WHERE w.duration_minutes IS NOT NULL
  GROUP BY w.id
),
carga_aguda AS (
  -- Soma do sRPE dos últimos 7 dias por usuário
  SELECT
    user_id,
    CURRENT_DATE AS data_ref,
    SUM(srpe)    AS carga_aguda_7d
  FROM srpe_por_sessao
  WHERE date >= CURRENT_DATE - INTERVAL '6 days'   -- inclui hoje
  GROUP BY user_id
),
carga_cronica AS (
  -- Média semanal do sRPE dos últimos 28 dias por usuário
  -- = soma_28d / 4 (4 semanas)
  SELECT
    user_id,
    SUM(srpe) / 4.0 AS carga_cronica_28d
  FROM srpe_por_sessao
  WHERE date >= CURRENT_DATE - INTERVAL '27 days'
  GROUP BY user_id
),
ultima_sessao AS (
  SELECT user_id, MAX(date) AS ultimo_treino
  FROM srpe_por_sessao
  GROUP BY user_id
)
SELECT
  a.user_id,
  a.data_ref,
  ROUND(a.carga_aguda_7d::numeric,  2) AS carga_aguda_7d,
  ROUND(c.carga_cronica_28d::numeric, 2) AS carga_cronica_28d,
  CASE
    WHEN c.carga_cronica_28d > 0
    THEN ROUND((a.carga_aguda_7d / c.carga_cronica_28d)::numeric, 3)
    ELSE NULL
  END AS acwr,
  CASE
    WHEN c.carga_cronica_28d = 0 OR c.carga_cronica_28d IS NULL THEN 'sem_historico'
    WHEN (a.carga_aguda_7d / c.carga_cronica_28d) < 0.8  THEN 'destreino'
    WHEN (a.carga_aguda_7d / c.carga_cronica_28d) <= 1.3 THEN 'otimo'
    WHEN (a.carga_aguda_7d / c.carga_cronica_28d) <= 1.5 THEN 'atencao'
    ELSE 'perigo'
  END AS zona_risco,
  u.ultimo_treino
FROM carga_aguda a
JOIN carga_cronica c ON c.user_id = a.user_id
JOIN ultima_sessao u ON u.user_id = a.user_id;

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

ALTER TABLE exercises          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- exercises: leitura pública, escrita apenas service_role
CREATE POLICY "exercises: leitura pública"
  ON exercises FOR SELECT USING (true);
CREATE POLICY "exercises: escrita service_role"
  ON exercises FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- workouts: usuário gerencia os próprios
CREATE POLICY "workouts: leitura própria"
  ON workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "workouts: inserção própria"
  ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workouts: atualização própria"
  ON workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "workouts: exclusão própria"
  ON workouts FOR DELETE USING (auth.uid() = user_id);

-- workout_logs: acesso via join ao workout do próprio usuário
CREATE POLICY "workout_logs: leitura própria"
  ON workout_logs FOR SELECT
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));
CREATE POLICY "workout_logs: inserção própria"
  ON workout_logs FOR INSERT
  WITH CHECK (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));
CREATE POLICY "workout_logs: exclusão própria"
  ON workout_logs FOR DELETE
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

-- personal_records: usuário gerencia os próprios PRs
CREATE POLICY "pr: leitura própria"
  ON personal_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pr: inserção própria"
  ON personal_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pr: atualização própria"
  ON personal_records FOR UPDATE USING (auth.uid() = user_id);

-- push_subscriptions: usuário gerencia as próprias assinaturas
CREATE POLICY "push: leitura própria"
  ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push: inserção própria"
  ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push: exclusão própria"
  ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
-- FUNÇÃO AUXILIAR: Brzycki 1RM
-- weight / (1.0278 - 0.0278 × reps)
-- Aplicada no onboarding para calcular 1RM estimado
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calcular_1rm_brzycki(weight_kg NUMERIC, reps INTEGER)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN reps <= 0 OR reps > 10 THEN NULL
    ELSE ROUND((weight_kg / (1.0278 - (0.0278 * reps)))::numeric, 2)
  END;
$$;

-- ══════════════════════════════════════════════════════════════
-- QUERY DE MONITORAMENTO: Usuários sem treino nos últimos 7 dias
-- Útil para relatório semanal e Edge Function de reengajamento
-- ══════════════════════════════════════════════════════════════
-- Exemplo de uso:
--   SELECT * FROM usuarios_sem_treino_recente;
CREATE OR REPLACE VIEW usuarios_sem_treino_recente AS
SELECT
  u.id AS user_id,
  COUNT(w.id)     AS treinos_na_semana,
  MAX(w.date)     AS ultimo_treino
FROM auth.users u
LEFT JOIN workouts w
  ON w.user_id = u.id
  AND w.date >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '7 days'
GROUP BY u.id
ORDER BY treinos_na_semana ASC;
