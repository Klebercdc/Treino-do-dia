-- KRONIA ADMIN TOTAL MODE
-- Canonical admin path: public.profiles.is_admin
-- Optional complementary path: JWT app_metadata claim role/admin.

alter table if exists public.profiles
  add column if not exists is_admin boolean not null default false;

alter table if exists public.profiles
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- Garantia de vínculo explícito com auth.users(id) + PK em id (idempotente).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) then
    begin
      alter table public.profiles
        add constraint profiles_id_fkey
        foreign key (id) references auth.users(id) on delete cascade;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

create index if not exists idx_profiles_is_admin on public.profiles (is_admin) where is_admin = true;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'owner')
  );
$$;

comment on function public.is_admin() is 'Admin authorization resolver: profiles.is_admin canonical + optional JWT claim fallback.';

create or replace function public.can_admin_read_all()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin();
$$;

comment on function public.can_admin_read_all() is 'Reusable helper for RLS SELECT policies with admin bypass.';

create or replace function public.can_admin_manage_notifications()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin();
$$;

create or replace function public.can_admin_manage_plans()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin();
$$;

-- Refresh profiles policies
alter table if exists public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;

create policy profiles_select_own_or_admin on public.profiles
for select using (auth.uid() = id or public.can_admin_read_all());

create policy profiles_insert_self_or_admin on public.profiles
for insert with check (auth.uid() = id or public.is_admin());

create policy profiles_update_self_or_admin on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy profiles_delete_admin_only on public.profiles
for delete using (public.is_admin());

-- Tabelas por ownership (user_id)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'workout_history', 'workout_templates', 'user_plans', 'ai_usage_logs', 'deletion_requests',
    'feature_usage_logs', 'nutrition_goals', 'meal_plans', 'user_food_logs', 'hydration_logs',
    'body_metrics', 'supplement_protocols', 'ai_conversations', 'ai_context_logs', 'diagnostic_executions',
    'diagnostic_steps', 'push_subscriptions', 'personal_records'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I enable row level security;', tbl);

      execute format('drop policy if exists %I on public.%I;', tbl || '_select_own', tbl);
      execute format('drop policy if exists %I on public.%I;', tbl || '_insert_own', tbl);
      execute format('drop policy if exists %I on public.%I;', tbl || '_update_own', tbl);
      execute format('drop policy if exists %I on public.%I;', tbl || '_delete_own', tbl);

      execute format('drop policy if exists %I on public.%I;', tbl || '_select_own_or_admin', tbl);
      execute format('drop policy if exists %I on public.%I;', tbl || '_insert_own_or_admin', tbl);
      execute format('drop policy if exists %I on public.%I;', tbl || '_update_own_or_admin', tbl);
      execute format('drop policy if exists %I on public.%I;', tbl || '_delete_own_or_admin', tbl);

      execute format('create policy %I on public.%I for select using (auth.uid() = user_id or public.can_admin_read_all());', tbl || '_select_own_or_admin', tbl);
      execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id or public.is_admin());', tbl || '_insert_own_or_admin', tbl);
      execute format('create policy %I on public.%I for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());', tbl || '_update_own_or_admin', tbl);
      execute format('create policy %I on public.%I for delete using (auth.uid() = user_id or public.is_admin());', tbl || '_delete_own_or_admin', tbl);
    end if;
  end loop;
end $$;

-- Tabelas com ownership indireto
alter table if exists public.meal_plan_items enable row level security;
drop policy if exists meal_plan_items_select_own on public.meal_plan_items;
drop policy if exists meal_plan_items_insert_own on public.meal_plan_items;
drop policy if exists meal_plan_items_update_own on public.meal_plan_items;
drop policy if exists meal_plan_items_delete_own on public.meal_plan_items;

create policy meal_plan_items_select_own_or_admin on public.meal_plan_items
for select using (
  public.can_admin_read_all()
  or exists (
    select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid()
  )
);

create policy meal_plan_items_insert_own_or_admin on public.meal_plan_items
for insert with check (
  public.is_admin()
  or exists (
    select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid()
  )
);

create policy meal_plan_items_update_own_or_admin on public.meal_plan_items
for update using (
  public.is_admin()
  or exists (
    select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid()
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid()
  )
);

create policy meal_plan_items_delete_own_or_admin on public.meal_plan_items
for delete using (
  public.is_admin()
  or exists (
    select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid()
  )
);

alter table if exists public.ai_messages enable row level security;
drop policy if exists ai_messages_select_own on public.ai_messages;
drop policy if exists ai_messages_insert_own on public.ai_messages;
drop policy if exists ai_messages_update_own on public.ai_messages;
drop policy if exists ai_messages_delete_own on public.ai_messages;

create policy ai_messages_select_own_or_admin on public.ai_messages
for select using (
  public.can_admin_read_all()
  or (
    auth.uid() = user_id and exists (select 1 from public.ai_conversations ac where ac.id = conversation_id and ac.user_id = auth.uid())
  )
);

create policy ai_messages_insert_own_or_admin on public.ai_messages
for insert with check (
  public.is_admin()
  or (
    auth.uid() = user_id and exists (select 1 from public.ai_conversations ac where ac.id = conversation_id and ac.user_id = auth.uid())
  )
);

create policy ai_messages_update_own_or_admin on public.ai_messages
for update using (
  public.is_admin()
  or (
    auth.uid() = user_id and exists (select 1 from public.ai_conversations ac where ac.id = conversation_id and ac.user_id = auth.uid())
  )
) with check (
  public.is_admin()
  or (
    auth.uid() = user_id and exists (select 1 from public.ai_conversations ac where ac.id = conversation_id and ac.user_id = auth.uid())
  )
);

create policy ai_messages_delete_own_or_admin on public.ai_messages
for delete using (
  public.is_admin()
  or (
    auth.uid() = user_id and exists (select 1 from public.ai_conversations ac where ac.id = conversation_id and ac.user_id = auth.uid())
  )
);
