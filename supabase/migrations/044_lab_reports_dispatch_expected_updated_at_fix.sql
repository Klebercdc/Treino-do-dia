-- ============================================================================
-- Migration 044: fix dispatch_lab_report_to_edge CAS invalidation
--
-- Root cause:
--   dispatch_lab_report_to_edge updated lab_reports.last_dispatch_* before the
--   Edge Function acquired the lock. The BEFORE UPDATE trigger
--   touch_updated_at_lab_reports changed updated_at, so the expectedUpdatedAt
--   sent in the payload no longer matched the row by the time the Edge
--   Function called acquire_lab_report_edge_lock. Result: dispatch_enqueued
--   followed by lock_not_acquired, leaving reports stuck in uploaded/processing.
--
-- Fix:
--   keep dispatch side-effect-free on public.lab_reports. Observability remains
--   in public.lab_report_pipeline_events and the lock acquisition itself still
--   writes last_dispatch_source/last_dispatch_at when processing really starts.
-- ============================================================================

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

comment on function public.dispatch_lab_report_to_edge(uuid, text, timestamptz)
  is 'Despacha exame para Edge Function sem tocar updated_at, preservando CAS com expectedUpdatedAt.';
