-- KRONIA ADMIN TOTAL MODE - HARDENING

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
  ), false)
  or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'owner');
$$;

comment on function public.is_admin() is 'Canonical admin gate: profiles.is_admin (primary) + app_metadata fallback (secondary).';

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

create or replace function public.get_access_scope_summary(
  p_target_entity text default null,
  p_target_user_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'request_user_id', auth.uid(),
    'is_admin', public.is_admin(),
    'target_entity', coalesce(p_target_entity, 'unknown'),
    'target_user_id', p_target_user_id,
    'resolved_scope', case
      when public.is_admin() and p_target_user_id is null then 'global'
      when public.is_admin() and p_target_user_id is not null then 'preview_user'
      else 'own'
    end,
    'at', now()
  );
$$;

comment on function public.get_access_scope_summary(text, uuid) is 'Admin observability helper for scope-resolution diagnostics.';

-- Harmoniza função legada de diagnósticos para caminho canônico de admin.
create or replace function public.kronia_is_diagnostic_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.diagnostic_admin_whitelist w
      where w.email = auth.jwt() ->> 'email'
    );
$$;

-- Tabelas adicionais com RLS explícito (se existirem).
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'affiliate_sales',
    'affiliate_commissions',
    'payment_webhooks',
    'diagnosticos'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I enable row level security;', tbl);
    end if;
  end loop;
end $$;
