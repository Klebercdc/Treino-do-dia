-- Migration segura: adicionar colunas novas sem apagar existentes
-- Etapa: Diet Profile Expanded — wizard 6 etapas

-- Tabela: profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bcm_data                JSONB        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pcm_manual              JSONB        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS body_composition_result JSONB        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS diet_flow_step          INTEGER      DEFAULT 1,
  ADD COLUMN IF NOT EXISTS diet_flow_completed_at  TIMESTAMPTZ  DEFAULT NULL;

-- Tabela: nutrition_goals (contexto expandido do wizard)
ALTER TABLE nutrition_goals
  ADD COLUMN IF NOT EXISTS training_context      JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS metabolism_behavior   JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS health_exam_context   JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS food_context          JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS goal_context          JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS get_calculation_mode  TEXT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS behavior_adjustments  JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS diet_alerts           JSONB  DEFAULT NULL;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_nutrition_goals_user_active
  ON nutrition_goals (user_id, active, updated_at DESC);
