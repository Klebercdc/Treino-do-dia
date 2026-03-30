-- Ensure observability optional columns exist across legacy environments.
alter table if exists public.diagnostic_executions
  add column if not exists correlation_id uuid,
  add column if not exists diagnostic_quality_score numeric(5,2);

alter table if exists public.diagnostic_executions
  alter column correlation_id set default gen_random_uuid();

create index if not exists idx_diag_exec_correlation_id on public.diagnostic_executions(correlation_id);
create index if not exists idx_diag_exec_quality_score on public.diagnostic_executions(diagnostic_quality_score);
