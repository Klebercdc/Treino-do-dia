-- KRONIA — Persistência canônica do intake de dieta.
-- Cria o modelo mínimo quando o banco ainda não tem a vertical de dieta
-- e adiciona snapshot estruturado para que a fonte da verdade seja o plano salvo.

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active',
  valid_from date,
  valid_to date,
  active boolean not null default true,
  plan_data jsonb,
  context_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  meal_name text,
  time_hint text,
  food_name text,
  quantity text,
  unit text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.meal_plans
  add column if not exists plan_data jsonb,
  add column if not exists context_snapshot jsonb;

create index if not exists idx_meal_plans_user_id
  on public.meal_plans(user_id);

create index if not exists idx_meal_plans_status
  on public.meal_plans(status);

create index if not exists idx_meal_plan_items_meal_plan_id
  on public.meal_plan_items(meal_plan_id);

create index if not exists idx_meal_plan_items_sort
  on public.meal_plan_items(meal_plan_id, sort_order);

create index if not exists idx_meal_plans_context_snapshot_gin
  on public.meal_plans using gin (context_snapshot);

alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

drop policy if exists meal_plans_select_own on public.meal_plans;
drop policy if exists meal_plans_insert_own on public.meal_plans;
drop policy if exists meal_plans_update_own on public.meal_plans;
drop policy if exists meal_plans_delete_own on public.meal_plans;

create policy meal_plans_select_own on public.meal_plans
  for select using (auth.uid() = user_id);

create policy meal_plans_insert_own on public.meal_plans
  for insert with check (auth.uid() = user_id);

create policy meal_plans_update_own on public.meal_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy meal_plans_delete_own on public.meal_plans
  for delete using (auth.uid() = user_id);

drop policy if exists meal_plan_items_select_own on public.meal_plan_items;
drop policy if exists meal_plan_items_insert_own on public.meal_plan_items;
drop policy if exists meal_plan_items_update_own on public.meal_plan_items;
drop policy if exists meal_plan_items_delete_own on public.meal_plan_items;

create policy meal_plan_items_select_own on public.meal_plan_items
  for select using (
    exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  );

create policy meal_plan_items_insert_own on public.meal_plan_items
  for insert with check (
    exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  );

create policy meal_plan_items_update_own on public.meal_plan_items
  for update using (
    exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  );

create policy meal_plan_items_delete_own on public.meal_plan_items
  for delete using (
    exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  );
