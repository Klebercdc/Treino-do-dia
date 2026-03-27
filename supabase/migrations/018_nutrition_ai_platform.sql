-- KRONIA — Migração 018: plataforma de nutrição inteligente com RAG

CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =========================================================
-- A) IDENTIDADE E PERFIL
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  birth_date DATE,
  sex TEXT,
  height_cm NUMERIC(6,2),
  current_weight_kg NUMERIC(6,2),
  goal_weight_kg NUMERIC(6,2),
  activity_level TEXT,
  objective TEXT,
  dietary_pattern TEXT,
  allergies TEXT[] NOT NULL DEFAULT '{}',
  intolerances TEXT[] NOT NULL DEFAULT '{}',
  disliked_foods TEXT[] NOT NULL DEFAULT '{}',
  liked_foods TEXT[] NOT NULL DEFAULT '{}',
  clinical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- B) CONTEXTO NUTRICIONAL DO USUÁRIO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.nutrition_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calories_target NUMERIC(8,2),
  protein_g NUMERIC(8,2),
  carbs_g NUMERIC(8,2),
  fat_g NUMERIC(8,2),
  fiber_g NUMERIC(8,2),
  water_ml NUMERIC(10,2),
  meal_strategy TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL,
  time_hint TEXT,
  food_name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  calories NUMERIC(8,2),
  protein_g NUMERIC(8,2),
  carbs_g NUMERIC(8,2),
  fat_g NUMERIC(8,2),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meal_type TEXT,
  food_name TEXT NOT NULL,
  quantity TEXT,
  estimated_calories NUMERIC(8,2),
  estimated_protein_g NUMERIC(8,2),
  estimated_carbs_g NUMERIC(8,2),
  estimated_fat_g NUMERIC(8,2),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hydration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  water_ml NUMERIC(10,2) NOT NULL CHECK (water_ml > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight_kg NUMERIC(6,2),
  body_fat_percent NUMERIC(5,2),
  waist_cm NUMERIC(6,2),
  hip_cm NUMERIC(6,2),
  chest_cm NUMERIC(6,2),
  arm_cm NUMERIC(6,2),
  thigh_cm NUMERIC(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplement_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_name TEXT NOT NULL,
  dosage TEXT,
  timing TEXT,
  purpose TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- C) MEMÓRIA E INTERAÇÃO IA
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system','user','assistant')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_context_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  retrieved_profile JSONB,
  retrieved_goals JSONB,
  retrieved_plan JSONB,
  retrieved_semantic_chunks JSONB,
  final_context JSONB,
  model_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- D) REPERTÓRIO NUTRICIONAL GLOBAL
-- =========================================================
CREATE TABLE IF NOT EXISTS public.nutrition_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_reference TEXT,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.nutrition_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.nutrition_knowledge_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_text TEXT NOT NULL,
  checksum TEXT NOT NULL,
  version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, checksum)
);

-- Coluna embedding reservada para uso futuro (atualmente sempre NULL).
-- Busca de conhecimento usa full-text search (search_nutrition_knowledge).
CREATE TABLE IF NOT EXISTS public.nutrition_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.nutrition_knowledge_documents(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.nutrition_knowledge_sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- =========================================================
-- ÍNDICES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_nutrition_goals_user_id ON public.nutrition_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON public.meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_meal_plan_id ON public.meal_plan_items(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_user_food_logs_user_id ON public.user_food_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_food_logs_consumed_at ON public.user_food_logs(user_id, consumed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_id ON public.hydration_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_hydration_logs_consumed_at ON public.hydration_logs(user_id, consumed_at DESC);
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_id ON public.body_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_body_metrics_measured_at ON public.body_metrics(user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplement_protocols_user_id ON public.supplement_protocols(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON public.ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_logs_user_id ON public.ai_context_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_logs_conversation_id ON public.ai_context_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_nks_status ON public.nutrition_knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_nks_source_type ON public.nutrition_knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_nks_category ON public.nutrition_knowledge_sources(category);
CREATE INDEX IF NOT EXISTS idx_nkd_source_id ON public.nutrition_knowledge_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_nkc_source_id ON public.nutrition_knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_nkc_document_id ON public.nutrition_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_nkc_category ON public.nutrition_knowledge_chunks(category);
CREATE INDEX IF NOT EXISTS idx_nkc_subcategory ON public.nutrition_knowledge_chunks(subcategory);
CREATE INDEX IF NOT EXISTS idx_nkc_tags_gin ON public.nutrition_knowledge_chunks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_nkc_metadata_gin ON public.nutrition_knowledge_chunks USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_nkc_embedding_ivfflat
  ON public.nutrition_knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =========================================================
-- TRIGGERS updated_at
-- =========================================================
DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_nutrition_goals_updated_at ON public.nutrition_goals;
CREATE TRIGGER tr_nutrition_goals_updated_at BEFORE UPDATE ON public.nutrition_goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_meal_plans_updated_at ON public.meal_plans;
CREATE TRIGGER tr_meal_plans_updated_at BEFORE UPDATE ON public.meal_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_meal_plan_items_updated_at ON public.meal_plan_items;
CREATE TRIGGER tr_meal_plan_items_updated_at BEFORE UPDATE ON public.meal_plan_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_user_food_logs_updated_at ON public.user_food_logs;
CREATE TRIGGER tr_user_food_logs_updated_at BEFORE UPDATE ON public.user_food_logs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_supplement_protocols_updated_at ON public.supplement_protocols;
CREATE TRIGGER tr_supplement_protocols_updated_at BEFORE UPDATE ON public.supplement_protocols
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER tr_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_nks_updated_at ON public.nutrition_knowledge_sources;
CREATE TRIGGER tr_nks_updated_at BEFORE UPDATE ON public.nutrition_knowledge_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_nkd_updated_at ON public.nutrition_knowledge_documents;
CREATE TRIGGER tr_nkd_updated_at BEFORE UPDATE ON public.nutrition_knowledge_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_nkc_updated_at ON public.nutrition_knowledge_chunks;
CREATE TRIGGER tr_nkc_updated_at BEFORE UPDATE ON public.nutrition_knowledge_chunks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- FUNÇÕES UTILITÁRIAS SQL
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_active_meal_plan(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT mp.id, mp.user_id, mp.title, mp.description, mp.status, mp.valid_from, mp.valid_to, mp.created_at, mp.updated_at
  FROM public.meal_plans mp
  WHERE mp.user_id = p_user_id
    AND mp.status = 'active'
    AND (mp.valid_from IS NULL OR mp.valid_from <= CURRENT_DATE)
    AND (mp.valid_to IS NULL OR mp.valid_to >= CURRENT_DATE)
  ORDER BY mp.updated_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_latest_body_metrics(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS SETOF public.body_metrics
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.body_metrics bm
  WHERE bm.user_id = p_user_id
  ORDER BY bm.measured_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 30));
$$;

CREATE OR REPLACE FUNCTION public.match_nutrition_knowledge(
  query_embedding VECTOR(1536),
  match_count INTEGER DEFAULT 8,
  category_filter TEXT DEFAULT NULL,
  tags_filter TEXT[] DEFAULT NULL,
  source_type_filter TEXT DEFAULT NULL,
  objective_filter TEXT DEFAULT NULL,
  dietary_pattern_filter TEXT DEFAULT NULL,
  allergies_filter TEXT[] DEFAULT NULL,
  intolerances_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  source_id UUID,
  chunk_index INTEGER,
  content TEXT,
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    c.source_id,
    c.chunk_index,
    c.content,
    c.category,
    c.subcategory,
    c.tags,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.nutrition_knowledge_chunks c
  JOIN public.nutrition_knowledge_sources s ON s.id = c.source_id
  WHERE s.status = 'active'
    AND (category_filter IS NULL OR c.category = category_filter OR s.category = category_filter)
    AND (source_type_filter IS NULL OR s.source_type = source_type_filter)
    AND (tags_filter IS NULL OR c.tags && tags_filter OR s.tags && tags_filter)
    AND (
      objective_filter IS NULL
      OR COALESCE(c.metadata->'objectives', '[]'::jsonb) = '[]'::jsonb
      OR COALESCE(c.metadata->'objectives', '[]'::jsonb) ? objective_filter
    )
    AND (
      dietary_pattern_filter IS NULL
      OR COALESCE(c.metadata->'dietary_patterns', '[]'::jsonb) = '[]'::jsonb
      OR COALESCE(c.metadata->'dietary_patterns', '[]'::jsonb) ? dietary_pattern_filter
    )
    AND (
      allergies_filter IS NULL
      OR NOT (COALESCE(ARRAY(SELECT jsonb_array_elements_text(c.metadata->'avoid_allergies')), ARRAY[]::TEXT[]) && allergies_filter)
    )
    AND (
      intolerances_filter IS NULL
      OR NOT (COALESCE(ARRAY(SELECT jsonb_array_elements_text(c.metadata->'avoid_intolerances')), ARRAY[]::TEXT[]) && intolerances_filter)
    )
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_context_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Personal data policies
DROP POLICY IF EXISTS "profiles_own_all" ON public.profiles;
CREATE POLICY "profiles_own_all" ON public.profiles
FOR ALL TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "nutrition_goals_own_all" ON public.nutrition_goals;
CREATE POLICY "nutrition_goals_own_all" ON public.nutrition_goals
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meal_plans_own_all" ON public.meal_plans;
CREATE POLICY "meal_plans_own_all" ON public.meal_plans
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meal_plan_items_own_all" ON public.meal_plan_items;
CREATE POLICY "meal_plan_items_own_all" ON public.meal_plan_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meal_plans mp
    WHERE mp.id = meal_plan_id
      AND mp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meal_plans mp
    WHERE mp.id = meal_plan_id
      AND mp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "user_food_logs_own_all" ON public.user_food_logs;
CREATE POLICY "user_food_logs_own_all" ON public.user_food_logs
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "hydration_logs_own_all" ON public.hydration_logs;
CREATE POLICY "hydration_logs_own_all" ON public.hydration_logs
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "body_metrics_own_all" ON public.body_metrics;
CREATE POLICY "body_metrics_own_all" ON public.body_metrics
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "supplement_protocols_own_all" ON public.supplement_protocols;
CREATE POLICY "supplement_protocols_own_all" ON public.supplement_protocols
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_own_all" ON public.ai_conversations;
CREATE POLICY "ai_conversations_own_all" ON public.ai_conversations
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_own_all" ON public.ai_messages;
CREATE POLICY "ai_messages_own_all" ON public.ai_messages
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = conversation_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "ai_context_logs_own_all" ON public.ai_context_logs;
CREATE POLICY "ai_context_logs_own_all" ON public.ai_context_logs
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_audit_logs_own_read" ON public.ai_audit_logs;
CREATE POLICY "ai_audit_logs_own_read" ON public.ai_audit_logs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_audit_logs_service_write" ON public.ai_audit_logs;
CREATE POLICY "ai_audit_logs_service_write" ON public.ai_audit_logs
FOR ALL TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- Shared global knowledge base
DROP POLICY IF EXISTS "knowledge_sources_authenticated_read" ON public.nutrition_knowledge_sources;
CREATE POLICY "knowledge_sources_authenticated_read" ON public.nutrition_knowledge_sources
FOR SELECT TO authenticated
USING (status = 'active');

DROP POLICY IF EXISTS "knowledge_documents_authenticated_read" ON public.nutrition_knowledge_documents;
CREATE POLICY "knowledge_documents_authenticated_read" ON public.nutrition_knowledge_documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_knowledge_sources s
    WHERE s.id = source_id
      AND s.status = 'active'
  )
);

DROP POLICY IF EXISTS "knowledge_chunks_authenticated_read" ON public.nutrition_knowledge_chunks;
CREATE POLICY "knowledge_chunks_authenticated_read" ON public.nutrition_knowledge_chunks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_knowledge_sources s
    WHERE s.id = source_id
      AND s.status = 'active'
  )
);

DROP POLICY IF EXISTS "knowledge_sources_service_all" ON public.nutrition_knowledge_sources;
CREATE POLICY "knowledge_sources_service_all" ON public.nutrition_knowledge_sources
FOR ALL TO service_role
USING (TRUE)
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "knowledge_documents_service_all" ON public.nutrition_knowledge_documents;
CREATE POLICY "knowledge_documents_service_all" ON public.nutrition_knowledge_documents
FOR ALL TO service_role
USING (TRUE)
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "knowledge_chunks_service_all" ON public.nutrition_knowledge_chunks;
CREATE POLICY "knowledge_chunks_service_all" ON public.nutrition_knowledge_chunks
FOR ALL TO service_role
USING (TRUE)
WITH CHECK (TRUE);

GRANT EXECUTE ON FUNCTION public.match_nutrition_knowledge(VECTOR, INTEGER, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT[], TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_meal_plan(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_latest_body_metrics(UUID, INTEGER) TO authenticated, service_role;
