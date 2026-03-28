create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  nome text null,
  objetivo text null,
  nivel text null,
  idade int null,
  sexo text null,
  peso_kg numeric null,
  altura_cm numeric null,
  rotina text null,
  preferencias jsonb not null default '[]'::jsonb,
  restricoes jsonb not null default '[]'::jsonb,
  lesoes jsonb not null default '[]'::jsonb,
  observacoes text null,
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'library',
  topic text null,
  content text not null,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index int not null,
  title text null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  -- Dimensão 1536 (text-embedding-3-small / nomic-embed-text-v1.5).
  -- Nullable: chunks podem ser inseridos antes do pipeline de embeddings.
  embedding vector(1536) null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create index if not exists knowledge_chunks_document_id_idx on public.knowledge_chunks(document_id);
-- Índice vetorial: só criar após popular embeddings.
-- execute manualmente após inserir dados:
--   create index knowledge_chunks_embedding_idx
--     on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops)
--     with (lists = 100);

create table if not exists public.assistant_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  user_message text not null,
  response_message text not null,
  intent text not null,
  action text not null,
  raw_response jsonb not null,
  retrieved_context jsonb null,
  memory_items jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_logs_user_id_idx on public.assistant_logs(user_id);
create index if not exists assistant_logs_created_at_idx on public.assistant_logs(created_at desc);

create table if not exists public.generated_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('treino','dieta','suplementacao','mobilidade')),
  chat_message text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists generated_plans_user_id_idx on public.generated_plans(user_id);
create index if not exists generated_plans_kind_idx on public.generated_plans(kind);

create table if not exists public.user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  memory_type text not null,
  content text not null,
  importance numeric not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_memory_user_id_idx on public.user_memory(user_id);
create index if not exists user_memory_importance_idx on public.user_memory(importance desc);

create table if not exists public.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  summary text not null,
  window_start timestamptz null,
  window_end timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_summaries_user_id_idx on public.conversation_summaries(user_id);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    kc.id,
    kc.title,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where kc.embedding is not null
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
