-- ============================================================
-- KRONIA — Migration 003: Nutrition & AI Schema
-- Tabelas usadas pelas Edge Functions e pela camada src/lib
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ── Perfil nutricional do usuário ────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text null,
  birth_date      date null,
  sex             text null check (sex in ('male','female','prefer_not_to_say')),
  height_cm       numeric null check (height_cm > 0),
  current_weight_kg numeric null check (current_weight_kg > 0),
  goal_weight_kg  numeric null check (goal_weight_kg > 0),
  activity_level  text null,
  objective       text null,
  dietary_pattern text null,
  allergies       jsonb not null default '[]'::jsonb,
  intolerances    jsonb not null default '[]'::jsonb,
  disliked_foods  jsonb not null default '[]'::jsonb,
  liked_foods     jsonb not null default '[]'::jsonb,
  clinical_notes  text null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Metas nutricionais ────────────────────────────────────────
create table if not exists public.nutrition_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  active          boolean not null default true,
  calories_target numeric null check (calories_target > 0),
  protein_g       numeric null check (protein_g >= 0),
  carbs_g         numeric null check (carbs_g >= 0),
  fat_g           numeric null check (fat_g >= 0),
  fiber_g         numeric null check (fiber_g >= 0),
  water_ml        numeric null check (water_ml >= 0),
  meal_strategy   text null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists nutrition_goals_user_active_idx
  on public.nutrition_goals(user_id, active);

-- ── Planos alimentares ────────────────────────────────────────
create table if not exists public.meal_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text null,
  status      text null default 'active',
  valid_from  date null,
  valid_to    date null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists meal_plans_user_active_idx
  on public.meal_plans(user_id, active);

-- ── Itens do plano alimentar ──────────────────────────────────
create table if not exists public.meal_plan_items (
  id           uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  meal_name    text null,
  time_hint    text null,
  food_name    text null,
  quantity     text null,
  unit         text null,
  calories     numeric null check (calories >= 0),
  protein_g    numeric null check (protein_g >= 0),
  carbs_g      numeric null check (carbs_g >= 0),
  fat_g        numeric null check (fat_g >= 0),
  notes        text null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists meal_plan_items_plan_idx
  on public.meal_plan_items(meal_plan_id, sort_order);

-- ── Registro alimentar ────────────────────────────────────────
create table if not exists public.user_food_logs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  consumed_at           timestamptz not null default now(),
  meal_type             text null,
  food_name             text null,
  quantity              text null,
  estimated_calories    numeric null check (estimated_calories >= 0),
  estimated_protein_g   numeric null check (estimated_protein_g >= 0),
  estimated_carbs_g     numeric null check (estimated_carbs_g >= 0),
  estimated_fat_g       numeric null check (estimated_fat_g >= 0),
  source                text null,
  notes                 text null,
  created_at            timestamptz not null default now()
);

create index if not exists user_food_logs_user_date_idx
  on public.user_food_logs(user_id, consumed_at desc);

-- ── Registro de hidratação ────────────────────────────────────
create table if not exists public.hydration_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  consumed_at  timestamptz not null default now(),
  water_ml     numeric not null check (water_ml > 0),
  created_at   timestamptz not null default now()
);

create index if not exists hydration_logs_user_date_idx
  on public.hydration_logs(user_id, consumed_at desc);

-- ── Métricas corporais ────────────────────────────────────────
create table if not exists public.body_metrics (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  measured_at      timestamptz not null default now(),
  weight_kg        numeric null check (weight_kg > 0),
  body_fat_percent numeric null check (body_fat_percent >= 0 and body_fat_percent <= 100),
  waist_cm         numeric null check (waist_cm > 0),
  hip_cm           numeric null check (hip_cm > 0),
  chest_cm         numeric null check (chest_cm > 0),
  arm_cm           numeric null check (arm_cm > 0),
  thigh_cm         numeric null check (thigh_cm > 0),
  notes            text null,
  created_at       timestamptz not null default now()
);

create index if not exists body_metrics_user_date_idx
  on public.body_metrics(user_id, measured_at desc);

-- ── Protocolos de suplementação ───────────────────────────────
create table if not exists public.supplement_protocols (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  supplement_name   text not null,
  dosage            text null,
  timing            text null,
  purpose           text null,
  notes             text null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists supplement_protocols_user_active_idx
  on public.supplement_protocols(user_id, active);

-- ── Conversas de IA ───────────────────────────────────────────
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx
  on public.ai_conversations(user_id, updated_at desc);

-- ── Mensagens de IA ───────────────────────────────────────────
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('system','user','assistant','tool')),
  content         text not null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages(conversation_id, created_at desc);
create index if not exists ai_messages_user_idx
  on public.ai_messages(user_id);

-- ── Logs de contexto de IA ────────────────────────────────────
create table if not exists public.ai_context_logs (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  conversation_id         uuid null references public.ai_conversations(id) on delete set null,
  query_text              text not null,
  intent                  text null,
  retrieved_profile       jsonb null,
  retrieved_goals         jsonb null,
  retrieved_plan          jsonb null,
  retrieved_recent_logs   jsonb null,
  retrieved_semantic_chunks jsonb null,
  final_context           jsonb null,
  model_name              text null,
  response_text           text null,
  created_at              timestamptz not null default now()
);

create index if not exists ai_context_logs_user_idx
  on public.ai_context_logs(user_id, created_at desc);

-- ── Treinos ───────────────────────────────────────────────────
create table if not exists public.workouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null default current_date,
  duration_minutes int null check (duration_minutes > 0),
  notes            text null,
  created_at       timestamptz not null default now()
);

create index if not exists workouts_user_date_idx
  on public.workouts(user_id, date desc);

-- ── Exercícios (dicionário) ───────────────────────────────────
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  muscle_group text null,
  created_at   timestamptz not null default now()
);

-- ── Logs de treino ────────────────────────────────────────────
create table if not exists public.workout_logs (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  weight_kg   numeric null check (weight_kg >= 0),
  reps        int null check (reps > 0),
  rpe         int null check (rpe >= 0 and rpe <= 10),
  created_at  timestamptz not null default now()
);

create index if not exists workout_logs_workout_idx
  on public.workout_logs(workout_id);

-- ── Push subscriptions ────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  subscription_json jsonb not null,
  created_at        timestamptz not null default now(),
  unique (user_id, (subscription_json->>'endpoint'))
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

-- ── Fontes de conhecimento nutricional ───────────────────────
create table if not exists public.nutrition_knowledge_sources (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  source_type      text not null default 'manual',
  source_reference text not null unique,
  category         text not null,
  tags             jsonb not null default '[]'::jsonb,
  status           text not null default 'active' check (status in ('active','archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Documentos de conhecimento nutricional ───────────────────
create table if not exists public.nutrition_knowledge_documents (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references public.nutrition_knowledge_sources(id) on delete cascade,
  title         text not null,
  document_text text not null,
  checksum      text not null unique,
  version       text not null default '1.0.0',
  created_at    timestamptz not null default now()
);

create index if not exists nutrition_knowledge_documents_source_idx
  on public.nutrition_knowledge_documents(source_id);

-- ── Chunks vetorizados de conhecimento nutricional ────────────
-- Dimensão 1536 compatível com text-embedding-3-small (OpenAI)
-- e nomic-embed-text-v1.5 (Nomic, via Groq ou local)
-- Ajuste a dimensão conforme o modelo de embeddings adotado.
create table if not exists public.nutrition_knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.nutrition_knowledge_documents(id) on delete cascade,
  source_id   uuid not null references public.nutrition_knowledge_sources(id) on delete cascade,
  chunk_index int not null,
  content     text not null,
  category    text null,
  subcategory text null,
  tags        jsonb not null default '[]'::jsonb,
  metadata    jsonb not null default '{}'::jsonb,
  embedding   vector(1536) null,
  created_at  timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists nutrition_knowledge_chunks_document_idx
  on public.nutrition_knowledge_chunks(document_id);
create index if not exists nutrition_knowledge_chunks_category_idx
  on public.nutrition_knowledge_chunks(category);

-- Índice vetorial — criado após ter embeddings populados
-- create index if not exists nutrition_knowledge_chunks_embedding_idx
--   on public.nutrition_knowledge_chunks
--   using ivfflat (embedding vector_cosine_ops)
--   with (lists = 100);

-- ── View de análise de fadiga (ACWR) ─────────────────────────
create or replace view public.v_fatigue_analysis as
with load_calc as (
  select
    w.user_id,
    w.date,
    sum(l.rpe * w.duration_minutes) as daily_load
  from public.workout_logs l
  join public.workouts w on l.workout_id = w.id
  group by w.user_id, w.date
),
rolling_metrics as (
  select
    user_id,
    avg(daily_load) filter (where date >= current_date - interval '7 days')  as acute,
    avg(daily_load) filter (where date >= current_date - interval '28 days') as chronic
  from load_calc
  group by user_id
)
select
  user_id,
  round((acute / nullif(chronic, 0))::numeric, 3) as acwr_index,
  case
    when (acute / nullif(chronic, 0)) > 1.5            then 'RISCO_CRITICO'
    when (acute / nullif(chronic, 0)) between 0.8 and 1.3 then 'OPTIMAL'
    else 'RECUPERACAO'
  end as status
from rolling_metrics;
