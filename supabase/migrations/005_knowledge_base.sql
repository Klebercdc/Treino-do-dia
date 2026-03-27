create table if not exists public.nutrition_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text,
  source_reference text,
  category text,
  tags text[] default '{}'::text[],
  language text not null default 'pt-BR',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.nutrition_knowledge_sources(id) on delete cascade,
  title text not null,
  document_text text not null,
  checksum text not null unique,
  version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.nutrition_knowledge_documents(id) on delete cascade,
  source_id uuid not null references public.nutrition_knowledge_sources(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  category text,
  subcategory text,
  tags text[] default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);
