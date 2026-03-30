-- Incremental hardening for admin diagnostics.

create or replace view public.diagnostic_execution_health as
select
  coalesce(pipeline_selected, 'unknown') as component,
  count(*) as total,
  sum(case when success = true then 1 else 0 end) as success_total,
  sum(case when success = false then 1 else 0 end) as failure_total,
  round(avg(nullif(duration_ms, 0)))::int as avg_duration_ms,
  round(avg(case when fallback_used then 1 else 0 end)::numeric, 4) as fallback_rate,
  max(created_at) as last_execution_at,
  round(
    case when count(*) = 0 then 1
         else sum(case when success = true then 1 else 0 end)::numeric / count(*)::numeric
    end
  , 4) as success_rate,
  case
    when count(*) = 0 then 'inactive'
    when (sum(case when success = false then 1 else 0 end)::numeric / greatest(count(*)::numeric, 1)) >= 0.4 then 'failing'
    when (sum(case when success = false then 1 else 0 end)::numeric / greatest(count(*)::numeric, 1)) >= 0.15 then 'degraded'
    when avg(case when fallback_used then 1 else 0 end)::numeric >= 0.35 then 'degraded'
    else 'healthy'
  end as status
from public.diagnostic_executions
where created_at >= now() - interval '24 hours'
group by 1;

create or replace view public.diagnostic_alert_candidates as
select
  pipeline_selected as component,
  count(*) as total,
  sum(case when success = false then 1 else 0 end) as failure_total,
  round(avg(duration_ms))::int as avg_duration_ms,
  round(avg(case when fallback_used then 1 else 0 end)::numeric, 4) as fallback_rate,
  max(created_at) as last_seen_at
from public.diagnostic_executions
where created_at >= now() - interval '6 hours'
group by 1
having count(*) >= 5;

grant select on public.diagnostic_alert_candidates to authenticated;
