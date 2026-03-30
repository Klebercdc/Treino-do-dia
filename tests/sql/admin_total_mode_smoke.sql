-- Verificações estruturais do ADMIN TOTAL MODE
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('id', 'is_admin', 'created_at', 'updated_at')
order by column_name;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_admin', 'can_admin_read_all', 'can_admin_manage_notifications', 'can_admin_manage_plans')
order by proname;

select
  position('app_metadata' in pg_get_functiondef('public.is_admin()'::regprocedure)) = 0 as is_admin_without_claim_fallback,
  position('profiles' in pg_get_functiondef('public.is_admin()'::regprocedure)) > 0 as is_admin_uses_profiles;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (
    policyname like '%_own_or_admin%'
    or policyname like 'profiles_%_admin%'
  )
order by tablename, policyname;
