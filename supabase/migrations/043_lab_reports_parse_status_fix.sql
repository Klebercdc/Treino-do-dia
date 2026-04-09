-- ============================================================================
-- Migration 043: Fix parse_status constraint drift + dispatch trigger for
-- pending_upload → uploaded flow.
--
-- Root cause: migration 036 created parse_status with inline check constraint
--   check (parse_status in ('pending', 'parsed', 'failed'))
-- Migration 042 fixed status_check but NOT parse_status_check.
-- Handler now uses 'pending_upload' / 'uploaded' → constraint violation → HTTP 500.
--
-- Also fixes:
--   • acquire_lab_report_edge_lock: still set parse_status='pending' (now invalid)
--   • dispatch trigger: only fires on INSERT status='uploaded'; misses UPDATE
--     pending_upload→uploaded that the new register flow performs.
-- ============================================================================

-- ── 1. Data migration: remap legacy parse_status values ───────────────────────
-- Must run BEFORE dropping the old constraint.

update public.lab_reports
  set parse_status = case
    when parse_status = 'pending' then 'pending_upload'
    when parse_status = 'parsed'  then 'uploaded'
    else parse_status
  end
where parse_status in ('pending', 'parsed');

-- ── 2. Drop old parse_status constraint (may be named or auto-generated) ──────

do $$
declare
  v_conname text;
begin
  select conname into v_conname
    from pg_constraint
   where conrelid = 'public.lab_reports'::regclass
     and contype  = 'c'
     and pg_get_constraintdef(oid) like '%parse_status%'
   limit 1;

  if v_conname is not null then
    execute 'alter table public.lab_reports drop constraint ' || quote_ident(v_conname);
  end if;
end $$;

-- ── 3. Add new named constraint with production-compatible values ─────────────

alter table public.lab_reports
  add constraint lab_reports_parse_status_check
  check (parse_status in (
    'pending_upload', 'uploaded', 'queued', 'processing', 'processed', 'failed'
  ));

-- ── 4. Update column default ──────────────────────────────────────────────────

alter table public.lab_reports
  alter column parse_status set default 'pending_upload';

-- ── 5. Fix acquire_lab_report_edge_lock ───────────────────────────────────────
-- Was: parse_status = 'pending'  (invalid with new constraint)
-- Now: parse_status = 'processing' (semantically correct for lock acquisition)

create or replace function public.acquire_lab_report_edge_lock(
  p_lab_report_id      uuid,
  p_expected_updated_at timestamptz default null,
  p_source             text default 'supabase_edge'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  update public.lab_reports
     set status                 = 'processing',
         parse_status           = 'processing',   -- was 'pending' — invalid with new constraint
         processing_error       = null,
         processing_started_at  = coalesce(processing_started_at, now()),
         processing_attempts    = coalesce(processing_attempts, 0) + 1,
         processing_owner       = 'supabase_edge',
         last_dispatch_source   = left(coalesce(p_source, 'supabase_edge'), 80),
         last_dispatch_at       = now(),
         last_orchestrator_note = 'lock_acquired'
   where id = p_lab_report_id
     and (
           status in ('uploaded', 'failed', 'needs_review')
           or (
                status = 'processing'
                and (
                      p_expected_updated_at is not null
                      or updated_at <= now() - interval '20 minutes'
                    )
              )
         )
     and (
           p_expected_updated_at is null
           or updated_at = p_expected_updated_at
         );

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.acquire_lab_report_edge_lock(uuid, timestamptz, text) from public;
grant execute on function public.acquire_lab_report_edge_lock(uuid, timestamptz, text) to service_role;

-- ── 6. Fix handle_lab_report_dispatch_trigger ─────────────────────────────────
-- Adds handling for UPDATE pending_upload → uploaded (the new register flow).
-- Keeps legacy INSERT status=uploaded path for backward compatibility.

create or replace function public.handle_lab_report_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Legacy path: INSERT with status='uploaded' (kept for backward compat)
  if tg_op = 'INSERT' and new.status = 'uploaded' then
    perform public.dispatch_lab_report_to_edge(new.id, 'db_insert_uploaded', new.updated_at);
    return new;
  end if;

  -- New path: register() sets status='uploaded' on a row that was 'pending_upload'
  if tg_op = 'UPDATE'
     and new.status = 'uploaded'
     and old.status = 'pending_upload' then
    perform public.dispatch_lab_report_to_edge(new.id, 'db_update_uploaded', new.updated_at);
    return new;
  end if;

  -- Processing dispatch (for manual re-queue or edge re-entry)
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

-- ── 7. Add trigger for UPDATE pending_upload → uploaded ───────────────────────

drop trigger if exists trg_lab_reports_dispatch_uploaded on public.lab_reports;
create trigger trg_lab_reports_dispatch_uploaded
  after update of status on public.lab_reports
  for each row
  when (new.status = 'uploaded' and old.status = 'pending_upload')
  execute function public.handle_lab_report_dispatch_trigger();

comment on constraint lab_reports_parse_status_check on public.lab_reports
  is 'Values aligned with handler: pending_upload|uploaded|queued|processing|processed|failed (migration 043).';
