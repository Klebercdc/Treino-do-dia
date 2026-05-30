CREATE OR REPLACE VIEW public.diagnostic_execution_health
  WITH (security_invoker = on) AS
  SELECT COALESCE(pipeline_selected, 'unknown') AS component,
    count(*) AS total,
    sum(CASE WHEN success THEN 1 ELSE 0 END) AS success_total,
    sum(CASE WHEN success = false THEN 1 ELSE 0 END) AS failure_total,
    round(avg(NULLIF(duration_ms, 0)))::integer AS avg_duration_ms,
    max(created_at) AS last_execution_at,
    round(CASE WHEN count(*) = 0 THEN 1 ELSE sum(CASE WHEN success THEN 1 ELSE 0 END)::numeric / count(*)::numeric END, 4) AS success_rate,
    CASE
      WHEN count(*) = 0 THEN 'inactive'
      WHEN (sum(CASE WHEN success = false THEN 1 ELSE 0 END)::numeric / count(*)::numeric) >= 0.4 THEN 'failing'
      WHEN (sum(CASE WHEN success = false THEN 1 ELSE 0 END)::numeric / count(*)::numeric) >= 0.15 THEN 'degraded'
      ELSE 'healthy'
    END AS status
  FROM diagnostic_executions
  WHERE created_at >= (now() - interval '24 hours')
  GROUP BY COALESCE(pipeline_selected, 'unknown');

DROP POLICY IF EXISTS diagnostic_exec_insert ON public.diagnostic_executions;
CREATE POLICY diagnostic_exec_insert ON public.diagnostic_executions
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS diagnostic_steps_insert ON public.diagnostic_steps;
CREATE POLICY diagnostic_steps_insert ON public.diagnostic_steps
  FOR INSERT TO service_role WITH CHECK (true);
