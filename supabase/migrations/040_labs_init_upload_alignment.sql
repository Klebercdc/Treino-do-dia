alter table if exists public.lab_reports
  drop constraint if exists lab_reports_status_check;

alter table if exists public.lab_reports
  add constraint lab_reports_status_check
  check (status in ('initiated', 'uploaded', 'processing', 'extracted', 'needs_review', 'analyzed', 'failed'));

alter table if exists public.lab_reports
  drop constraint if exists lab_reports_parse_status_check;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.lab_reports'::regclass
      and pg_get_constraintdef(oid) ilike '%parse_status%'
  ) then
    execute (
      select format('alter table public.lab_reports drop constraint %I', conname)
      from pg_constraint
      where conrelid = 'public.lab_reports'::regclass
        and pg_get_constraintdef(oid) ilike '%parse_status%'
      limit 1
    );
  end if;
end $$;

alter table if exists public.lab_reports
  add constraint lab_reports_parse_status_check
  check (parse_status in ('pending', 'uploaded', 'parsed', 'failed'));

create or replace function public.handle_lab_report_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'uploaded' then
    perform public.dispatch_lab_report_to_edge(new.id, 'db_insert_uploaded', new.updated_at);
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status = 'uploaded'
     and old.status is distinct from new.status then
    perform public.dispatch_lab_report_to_edge(new.id, 'db_update_uploaded', new.updated_at);
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status = 'processing'
     and coalesce(new.processing_owner, '') <> 'supabase_edge'
     and (
       old.status is distinct from new.status
       or coalesce(old.processing_owner, '') is distinct from coalesce(new.processing_owner, '')
     ) then
    perform public.dispatch_lab_report_to_edge(new.id, 'db_update_processing', new.updated_at);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_lab_reports_dispatch_processing on public.lab_reports;

create trigger trg_lab_reports_dispatch_processing
after update of status, processing_owner on public.lab_reports
for each row
when (
  new.status = 'uploaded'
  or (new.status = 'processing' and coalesce(new.processing_owner, '') <> 'supabase_edge')
)
execute function public.handle_lab_report_dispatch_trigger();
