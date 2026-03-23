-- ══════════════════════════════════════════════════════════════
-- KRONIA — Migração 005: Campos ricos na tabela exercises
--
-- Adiciona todos os campos disponíveis no free-exercise-db:
--   instructions   → passo a passo da execução
--   image_url      → foto/GIF de demonstração (GitHub raw)
--   level          → beginner | intermediate | expert
--   equipment      → barra, haltere, máquina, etc.
--   force_type     → push | pull | static
--   mechanic       → compound | isolation
--   secondary_muscles → músculos secundários trabalhados
-- ══════════════════════════════════════════════════════════════

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS instructions      TEXT[],
  ADD COLUMN IF NOT EXISTS image_url         TEXT,
  ADD COLUMN IF NOT EXISTS level             TEXT
    CHECK (level IN ('beginner','intermediate','expert')),
  ADD COLUMN IF NOT EXISTS equipment         TEXT,
  ADD COLUMN IF NOT EXISTS force_type        TEXT
    CHECK (force_type IN ('push','pull','static')),
  ADD COLUMN IF NOT EXISTS mechanic          TEXT
    CHECK (mechanic IN ('compound','isolation')),
  ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[];

-- Índices úteis para filtros no app
CREATE INDEX IF NOT EXISTS idx_exercises_level     ON exercises (level);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises (equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_mechanic  ON exercises (mechanic);
