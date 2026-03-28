-- ============================================================
-- KRONIA — Migration 005: Funções SQL para nutrição e RAG
-- ============================================================

-- ── Logs recentes de refeição ─────────────────────────────────
create or replace function public.get_recent_food_logs(
  p_user_id uuid,
  p_limit   int default 20
)
returns setof public.user_food_logs
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.user_food_logs
  where user_id = p_user_id
  order by consumed_at desc
  limit p_limit;
$$;

-- ── Logs recentes de hidratação ───────────────────────────────
create or replace function public.get_recent_hydration_logs(
  p_user_id uuid,
  p_limit   int default 20
)
returns setof public.hydration_logs
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.hydration_logs
  where user_id = p_user_id
  order by consumed_at desc
  limit p_limit;
$$;

-- ── Métricas corporais mais recentes ─────────────────────────
create or replace function public.get_latest_body_metrics(
  p_user_id uuid,
  p_limit   int default 5
)
returns setof public.body_metrics
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.body_metrics
  where user_id = p_user_id
  order by measured_at desc
  limit p_limit;
$$;

-- ── Busca semântica na base de conhecimento nutricional ───────
-- Parâmetro search_query é usado como full-text enquanto embeddings
-- não estão populados. Quando o pipeline de embeddings estiver ativo,
-- substitua esta função pela versão vetorial abaixo (comentada).
--
-- VERSÃO TEXT SEARCH (fallback sem embeddings):
create or replace function public.search_nutrition_knowledge(
  search_query   text,
  match_count    int     default 8,
  category_filter text   default null
)
returns table (
  id          uuid,
  document_id uuid,
  source_id   uuid,
  content     text,
  category    text,
  subcategory text,
  tags        jsonb,
  metadata    jsonb,
  similarity  double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    c.source_id,
    c.content,
    c.category,
    c.subcategory,
    c.tags,
    c.metadata,
    ts_rank(
      to_tsvector('portuguese', c.content),
      plainto_tsquery('portuguese', search_query)
    )::double precision as similarity
  from public.nutrition_knowledge_chunks c
  where
    (category_filter is null or c.category = category_filter)
    and to_tsvector('portuguese', c.content) @@ plainto_tsquery('portuguese', search_query)
  order by similarity desc
  limit match_count;
end;
$$;

-- ── VERSÃO VETORIAL (ativar após popular embeddings) ──────────
-- Substitui a função acima quando os embeddings estiverem disponíveis.
-- Dimensão deve corresponder ao modelo adotado (ex: 1536 para text-embedding-3-small).
--
-- create or replace function public.search_nutrition_knowledge(
--   query_embedding vector(1536),
--   match_count     int    default 8,
--   category_filter text   default null
-- )
-- returns table (
--   id          uuid,
--   document_id uuid,
--   source_id   uuid,
--   content     text,
--   category    text,
--   subcategory text,
--   tags        jsonb,
--   metadata    jsonb,
--   similarity  double precision
-- )
-- language sql
-- stable
-- security definer
-- set search_path = public
-- as $$
--   select
--     c.id,
--     c.document_id,
--     c.source_id,
--     c.content,
--     c.category,
--     c.subcategory,
--     c.tags,
--     c.metadata,
--     1 - (c.embedding <=> query_embedding) as similarity
--   from public.nutrition_knowledge_chunks c
--   where
--     (category_filter is null or c.category = category_filter)
--     and c.embedding is not null
--   order by c.embedding <=> query_embedding
--   limit match_count;
-- $$;
