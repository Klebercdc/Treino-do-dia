-- Supabase-native orchestration for lab reports.
-- Primary flow: database trigger (SQL-native webhook) -> Edge Function -> OCR -> biomarkers -> Groq.
-- Secondary/manual flow: existing Vercel routes remain available, but the source of truth and retry logic move to Supabase.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists vault with schema vault;

alter table if exists public.lab_reports
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists processing_owner text,
  add column if not exists last_dispatch_source text,
  add column if not exists last_dispatch_at timestamptz,
  add column if not exists last_dispatch_request_id bigint,
  add column if not exists last_orchestrator_note text;

create index if not exists idx_lab_reports_status_updated_at
  on public.lab_reports(status, updated_at asc);
create index if not exists idx_lab_reports_owner_status_updated_at
  on public.lab_reports(processing_owner, status, updated_at desc);

create table if not exists public.lab_report_pipeline_events (
  id uuid primary key default gen_random_uuid(),
  lab_report_id uuid not null references public.lab_reports(id) on delete cascade,
  event_type text not null,
  level text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lab_report_pipeline_events_report_created
  on public.lab_report_pipeline_events(lab_report_id, created_at desc);

alter table public.lab_report_pipeline_events enable row level security;

drop policy if exists "lab_report_pipeline_events_select_own" on public.lab_report_pipeline_events;
create policy "lab_report_pipeline_events_select_own" on public.lab_report_pipeline_events
for select to authenticated
using (
  exists (
    select 1
    from public.lab_reports r
    where r.id = lab_report_id
      and r.user_id = auth.uid()
  )
);

revoke insert, update, delete on public.lab_report_pipeline_events from authenticated;

create or replace function public.log_lab_report_pipeline_event(
  p_lab_report_id uuid,
  p_event_type text,
  p_level text default 'info',
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lab_report_pipeline_events (lab_report_id, event_type, level, details)
  values (p_lab_report_id, p_event_type, coalesce(nullif(p_level, ''), 'info'), coalesce(p_details, '{}'::jsonb));
exception
  when others then
    null;
end;
$$;

revoke all on function public.log_lab_report_pipeline_event(uuid, text, text, jsonb) from public;
grant execute on function public.log_lab_report_pipeline_event(uuid, text, text, jsonb) to service_role;

create or replace function public.acquire_lab_report_edge_lock(
  p_lab_report_id uuid,
  p_expected_updated_at timestamptz default null,
  p_source text default 'supabase_edge'
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
     set status = 'processing',
         parse_status = 'pending',
         processing_error = null,
         processing_started_at = coalesce(processing_started_at, now()),
         processing_attempts = coalesce(processing_attempts, 0) + 1,
         processing_owner = 'supabase_edge',
         last_dispatch_source = left(coalesce(p_source, 'supabase_edge'), 80),
         last_dispatch_at = now(),
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

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  return v_rows = 1;
end;
$$;

revoke all on function public.acquire_lab_report_edge_lock(uuid, timestamptz, text) from public;
grant execute on function public.acquire_lab_report_edge_lock(uuid, timestamptz, text) to service_role;

create or replace function public.dispatch_lab_report_to_edge(
  p_lab_report_id uuid,
  p_source text default 'db_webhook',
  p_expected_updated_at timestamptz default null
)
returns bigint
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_project_url text;
  v_publishable_key text;
  v_request_id bigint;
  v_payload jsonb;
begin
  select decrypted_secret
    into v_project_url
    from vault.decrypted_secrets
   where name = 'project_url'
   limit 1;

  select decrypted_secret
    into v_publishable_key
    from vault.decrypted_secrets
   where name in ('publishable_key', 'anon_key')
   order by case when name = 'publishable_key' then 0 else 1 end
   limit 1;

  if coalesce(v_project_url, '') = '' or coalesce(v_publishable_key, '') = '' then
    perform public.log_lab_report_pipeline_event(
      p_lab_report_id,
      'dispatch_skipped_missing_vault_secret',
      'warn',
      jsonb_build_object('source', p_source)
    );
    return null;
  end if;

  v_payload := jsonb_build_object(
    'labReportId', p_lab_report_id,
    'dispatchSource', coalesce(p_source, 'db_webhook')
  );

  if p_expected_updated_at is not null then
    v_payload := v_payload || jsonb_build_object('expectedUpdatedAt', p_expected_updated_at);
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/lab-report-orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_publishable_key
    ),
    body := v_payload
  ) into v_request_id;

  update public.lab_reports
     set last_dispatch_source = left(coalesce(p_source, 'db_webhook'), 80),
         last_dispatch_at = now(),
         last_dispatch_request_id = v_request_id,
         last_orchestrator_note = 'dispatch_enqueued'
   where id = p_lab_report_id;

  perform public.log_lab_report_pipeline_event(
    p_lab_report_id,
    'dispatch_enqueued',
    'info',
    jsonb_build_object('source', p_source, 'request_id', v_request_id)
  );

  return v_request_id;
exception
  when others then
    perform public.log_lab_report_pipeline_event(
      p_lab_report_id,
      'dispatch_failed',
      'error',
      jsonb_build_object('source', p_source, 'error', SQLERRM)
    );
    return null;
end;
$$;

revoke all on function public.dispatch_lab_report_to_edge(uuid, text, timestamptz) from public;
grant execute on function public.dispatch_lab_report_to_edge(uuid, text, timestamptz) to service_role;

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

drop trigger if exists trg_lab_reports_dispatch_insert on public.lab_reports;
create trigger trg_lab_reports_dispatch_insert
after insert on public.lab_reports
for each row
when (new.status = 'uploaded')
execute function public.handle_lab_report_dispatch_trigger();

drop trigger if exists trg_lab_reports_dispatch_processing on public.lab_reports;
create trigger trg_lab_reports_dispatch_processing
after update of status, processing_owner on public.lab_reports
for each row
when (new.status = 'processing' and coalesce(new.processing_owner, '') <> 'supabase_edge')
execute function public.handle_lab_report_dispatch_trigger();

select cron.unschedule('labs-edge-watchdog')
where exists (
  select 1
  from cron.job
  where jobname = 'labs-edge-watchdog'
);

select cron.schedule(
  'labs-edge-watchdog',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select rtrim(decrypted_secret, '/') from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/lab-report-orchestrator/watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name in ('publishable_key', 'anon_key') order by case when name = 'publishable_key' then 0 else 1 end limit 1)
    ),
    body := '{"action":"watchdog","limit":10,"dispatchSource":"pg_cron_watchdog"}'::jsonb
  );
  $$
);

comment on function public.acquire_lab_report_edge_lock(uuid, timestamptz, text) is 'CAS/lock server-side para Edge Function de exames.';
comment on function public.dispatch_lab_report_to_edge(uuid, text, timestamptz) is 'Despacha exame para Edge Function a partir do banco usando pg_net.';
comment on table public.lab_report_pipeline_events is 'Observabilidade do pipeline de exames orquestrado pelo Supabase.';
