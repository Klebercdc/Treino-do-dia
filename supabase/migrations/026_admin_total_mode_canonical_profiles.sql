-- ADMIN TOTAL MODE: canonical admin resolution + policy hardening

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((
    select p.is_admin
    from public.profiles p
    where p.id = auth.uid()
    limit 1
  ), false);
$$;

comment on function public.is_admin() is 'Canonical admin gate: resolved exclusively from public.profiles.is_admin.';

create or replace function public.can_admin_read_all()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin();
$$;

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

comment on function public.can_admin_manage_notifications() is 'Admin-only management gate for notifications, resolved by profiles.is_admin.';
comment on function public.can_admin_manage_plans() is 'Admin-only management gate for plans, resolved by profiles.is_admin.';

create or replace function public.kronia_is_diagnostic_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin();
$$;

comment on function public.kronia_is_diagnostic_admin() is 'Diagnostic admin gate aligned with canonical profiles.is_admin.';

-- Ensure admin/global read is consistently available for relevant entities if they exist.
do $$
declare
  tbl text;
  ownership_column text;
begin
  foreach tbl in array array[
    'subscriptions',
    'trial_status',
    'notifications',
    'billing_events',
    'feature_usage',
    'feature_usage_logs',
    'diagnostics',
    'ai_messages',
    'meal_plan_items',
    'chat_threads',
    'chat_messages',
    'workout_entries',
    'recommendation_cache',
    'logs',
    'admin_logs',
    'user_access'
  ]
  loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security;', tbl);

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'user_id'
    ) then
      ownership_column := 'user_id';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'profile_id'
    ) then
      ownership_column := 'profile_id';
    else
      ownership_column := null;
    end if;

    if ownership_column is not null then
      execute format('drop policy if exists %I on public.%I;', tbl || '_select_own_or_admin', tbl);
      execute format('create policy %I on public.%I for select using ((auth.uid() = %I) or public.can_admin_read_all());', tbl || '_select_own_or_admin', tbl, ownership_column);
    elsif tbl = 'admin_logs' then
      execute format('drop policy if exists %I on public.%I;', tbl || '_admin_read', tbl);
      execute format('create policy %I on public.%I for select using (public.is_admin());', tbl || '_admin_read', tbl);
    end if;
  end loop;
end $$;
