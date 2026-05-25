-- =====================================================
-- ENTERPRISE AI HARDENING
-- Adaptive nutrition memory, behavior and adherence state.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_food_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_key TEXT NOT NULL,
  food_name TEXT NOT NULL,
  affinity_score NUMERIC(6,3) NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  swapped_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, food_key)
);

CREATE TABLE IF NOT EXISTS public.user_meal_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  meal_type TEXT,
  feedback_type TEXT NOT NULL,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_behavior_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_meal_count INTEGER,
  preferred_diet_style TEXT,
  has_food_scale BOOLEAN,
  budget_level TEXT,
  workout_time TEXT,
  hunger_period TEXT,
  disliked_foods TEXT[] NOT NULL DEFAULT '{}',
  liked_foods TEXT[] NOT NULL DEFAULT '{}',
  avoided_foods TEXT[] NOT NULL DEFAULT '{}',
  behavior_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_adherence_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  period_end DATE,
  adherence_days INTEGER NOT NULL DEFAULT 0,
  skipped_meals_count INTEGER NOT NULL DEFAULT 0,
  swapped_foods_count INTEGER NOT NULL DEFAULT 0,
  hunger_reports_count INTEGER NOT NULL DEFAULT 0,
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_user_food_memory_user_id ON public.user_food_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_meal_feedback_user_id ON public.user_meal_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_meal_feedback_created_at ON public.user_meal_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_profiles_user_id ON public.user_behavior_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_adherence_metrics_user_id ON public.user_adherence_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_adherence_metrics_period ON public.user_adherence_metrics(user_id, period_start DESC);

ALTER TABLE public.user_food_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_meal_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_behavior_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_adherence_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_food_memory_own_all" ON public.user_food_memory;
CREATE POLICY "user_food_memory_own_all" ON public.user_food_memory
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_meal_feedback_own_all" ON public.user_meal_feedback;
CREATE POLICY "user_meal_feedback_own_all" ON public.user_meal_feedback
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_behavior_profiles_own_all" ON public.user_behavior_profiles;
CREATE POLICY "user_behavior_profiles_own_all" ON public.user_behavior_profiles
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_adherence_metrics_own_all" ON public.user_adherence_metrics;
CREATE POLICY "user_adherence_metrics_own_all" ON public.user_adherence_metrics
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_food_memory_service_all" ON public.user_food_memory;
CREATE POLICY "user_food_memory_service_all" ON public.user_food_memory
FOR ALL TO service_role
USING (TRUE)
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "user_meal_feedback_service_all" ON public.user_meal_feedback;
CREATE POLICY "user_meal_feedback_service_all" ON public.user_meal_feedback
FOR ALL TO service_role
USING (TRUE)
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "user_behavior_profiles_service_all" ON public.user_behavior_profiles;
CREATE POLICY "user_behavior_profiles_service_all" ON public.user_behavior_profiles
FOR ALL TO service_role
USING (TRUE)
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "user_adherence_metrics_service_all" ON public.user_adherence_metrics;
CREATE POLICY "user_adherence_metrics_service_all" ON public.user_adherence_metrics
FOR ALL TO service_role
USING (TRUE)
WITH CHECK (TRUE);
