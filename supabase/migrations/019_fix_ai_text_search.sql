-- =========================================================
-- Migration 019: Fix AI integration
-- - Remove dependency on vector embeddings (OpenAI removed)
-- - Add text-based knowledge search using PostgreSQL full-text
-- - Ensure get_recent_food_logs and get_recent_hydration_logs exist
-- - Add missing columns to ai_context_logs
-- =========================================================

-- Add missing columns to ai_context_logs
ALTER TABLE public.ai_context_logs
  ADD COLUMN IF NOT EXISTS intent TEXT,
  ADD COLUMN IF NOT EXISTS response_text TEXT,
  ADD COLUMN IF NOT EXISTS retrieved_recent_logs JSONB;

-- Ensure get_recent_food_logs exists (column is consumed_at)
CREATE OR REPLACE FUNCTION public.get_recent_food_logs(p_user_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.user_food_logs
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.user_food_logs
  WHERE user_id = p_user_id
  ORDER BY consumed_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

-- Ensure get_recent_hydration_logs exists (column is consumed_at)
CREATE OR REPLACE FUNCTION public.get_recent_hydration_logs(p_user_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.hydration_logs
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.hydration_logs
  WHERE user_id = p_user_id
  ORDER BY consumed_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

-- Full-text knowledge search — does NOT require embeddings or OpenAI
CREATE OR REPLACE FUNCTION public.search_nutrition_knowledge(
  search_query  TEXT,
  match_count   INTEGER DEFAULT 8,
  category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  document_id   UUID,
  source_id     UUID,
  chunk_index   INTEGER,
  content       TEXT,
  category      TEXT,
  subcategory   TEXT,
  tags          TEXT[],
  metadata      JSONB,
  similarity    DOUBLE PRECISION
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
    ts_rank(
      to_tsvector('portuguese', c.content),
      plainto_tsquery('portuguese', search_query)
    )::DOUBLE PRECISION AS similarity
  FROM public.nutrition_knowledge_chunks c
  JOIN public.nutrition_knowledge_sources s ON s.id = c.source_id
  WHERE s.status = 'active'
    AND (category_filter IS NULL OR c.category = category_filter OR s.category = category_filter)
    AND to_tsvector('portuguese', c.content) @@ plainto_tsquery('portuguese', search_query)
  ORDER BY similarity DESC
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_recent_food_logs(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_recent_hydration_logs(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_nutrition_knowledge(TEXT, INTEGER, TEXT) TO authenticated, service_role;
