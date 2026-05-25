create table if not exists public.user_food_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  liked_foods jsonb default '[]'::jsonb,
  rejected_foods jsonb default '[]'::jsonb,
  repeated_foods jsonb default '[]'::jsonb,
  substitutions jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.user_meal_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  meal_name text,
  feedback_type text,
  created_at timestamptz default now()
);

create table if not exists public.user_behavior_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  behavior_profile jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.user_adherence_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  adherence_score numeric,
  diversity_score numeric,
  confidence_score numeric,
  created_at timestamptz default now()
);

alter table public.user_food_memory enable row level security;
alter table public.user_meal_feedback enable row level security;
alter table public.user_behavior_profiles enable row level security;
alter table public.user_adherence_metrics enable row level security;

create policy if not exists "user owns food memory"
on public.user_food_memory
for all
using (auth.uid() = user_id);

create policy if not exists "user owns meal feedback"
on public.user_meal_feedback
for all
using (auth.uid() = user_id);

create policy if not exists "user owns behavior profile"
on public.user_behavior_profiles
for all
using (auth.uid() = user_id);

create policy if not exists "user owns adherence metrics"
on public.user_adherence_metrics
for all
using (auth.uid() = user_id);
