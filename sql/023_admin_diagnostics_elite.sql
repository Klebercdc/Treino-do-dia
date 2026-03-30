-- Elite refinements: correlation, versioning, severity, quality and retention governance.

alter table public.diagnostic_executions
  add column if not exists correlation_id uuid,
  add column if not exists conversation_trace_id text,
  add column if not exists parent_execution_id uuid,
  add column if not exists severity text not null default 'info',
  add column if not exists pipeline_version text,
  add column if not exists prompt_version text,
  add column if not exists rules_version text,
  add column if not exists graph_mapping_version text,
  add column if not exists diagnostic_schema_version text,
  add column if not exists diagnostic_quality_score numeric(5,2),
  add column if not exists diagnostic_quality_band text,
  add column if not exists expired_at timestamptz;

alter table public.diagnostic_steps
  add column if not exists severity text not null default 'info';

create index if not exists idx_diag_exec_correlation_id on public.diagnostic_executions(correlation_id);
create index if not exists idx_diag_exec_conversation_trace_id on public.diagnostic_executions(conversation_trace_id);
create index if not exists idx_diag_exec_parent_execution_id on public.diagnostic_executions(parent_execution_id);
create index if not exists idx_diag_exec_severity on public.diagnostic_executions(severity);
create index if not exists idx_diag_exec_quality_score on public.diagnostic_executions(diagnostic_quality_score);
create index if not exists idx_diag_exec_expired_at on public.diagnostic_executions(expired_at);

create table if not exists public.diagnostic_governance (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.diagnostic_governance (key, value)
values ('retention', jsonb_build_object('retention_days', 30, 'auto_cleanup_enabled', true))
on conflict (key) do nothing;

create or replace function public.get_diagnostic_retention_days()
returns integer
language sql
stable
as $$
  select coalesce((value ->> 'retention_days')::int, 30)
  from public.diagnostic_governance
  where key = 'retention'
  limit 1;
$$;

create or replace function public.mark_expired_diagnostic_executions()
returns integer
language plpgsql
security definer
as $$
declare
  v_days integer := public.get_diagnostic_retention_days();
  v_count integer := 0;
begin
  update public.diagnostic_executions
     set expired_at = now()
   where expired_at is null
     and created_at < now() - make_interval(days => greatest(v_days, 1));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  return v_count;
end;
$$;

create or replace function public.cleanup_expired_diagnostics(batch_size integer default 10000)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
begin
  with doomed as (
    select execution_id
    from public.diagnostic_executions
    where expired_at is not null
    order by expired_at asc
    limit greatest(batch_size, 1)
  )
  delete from public.diagnostic_executions de
  using doomed
  where de.execution_id = doomed.execution_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  return v_count;
end;
$$;

grant execute on function public.mark_expired_diagnostic_executions() to authenticated;
grant execute on function public.cleanup_expired_diagnostics(integer) to authenticated;

create or replace view public.diagnostic_conversation_journey as
select
  conversation_trace_id,
  count(*) as execution_total,
  sum(case when success = false then 1 else 0 end) as failure_total,
  sum(case when fallback_used then 1 else 0 end) as fallback_total,
  round(avg(duration_ms))::int as avg_duration_ms,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.diagnostic_executions
where conversation_trace_id is not null
group by conversation_trace_id;

grant select on public.diagnostic_conversation_journey to authenticated;
