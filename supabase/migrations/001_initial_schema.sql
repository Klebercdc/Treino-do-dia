-- ══════════════════════════════════════════════════════
-- TITAN PRO — Esquema inicial do banco de dados
-- Execute este script no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════

-- ─── Perfis de usuário (config e medidas) ───────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  config      JSONB    NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Histórico de treinos ────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_data JSONB   NOT NULL,
  trained_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Templates de treino (CSV) ──────────────────────────
CREATE TABLE IF NOT EXISTS workout_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  templates  JSONB   NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Índices ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workout_history_user_id    ON workout_history (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_history_trained_at ON workout_history (user_id, trained_at DESC);

-- ════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Garante que cada usuário acessa APENAS os próprios dados
-- ════════════════════════════════════════════════════════

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

-- Policies: profiles
CREATE POLICY "profiles: leitura própria"  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: inserção própria" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: atualização própria" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Policies: workout_history
CREATE POLICY "history: leitura própria"   ON workout_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "history: inserção própria"  ON workout_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "history: exclusão própria"  ON workout_history FOR DELETE USING (auth.uid() = user_id);

-- Policies: workout_templates
CREATE POLICY "templates: leitura própria"   ON workout_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "templates: inserção própria"  ON workout_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates: atualização própria" ON workout_templates FOR UPDATE USING (auth.uid() = user_id);
