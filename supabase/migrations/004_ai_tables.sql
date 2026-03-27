create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_messages_role_check check (role in ('system', 'user', 'assistant', 'tool'))
);

create table if not exists public.ai_context_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  query_text text not null,
  intent text,
  retrieved_profile jsonb,
  retrieved_goals jsonb,
  retrieved_plan jsonb,
  retrieved_recent_logs jsonb,
  retrieved_semantic_chunks jsonb,
  final_context jsonb,
  model_name text,
  response_text text,
  created_at timestamptz not null default now()
);
