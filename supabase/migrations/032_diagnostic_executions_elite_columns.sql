-- Add missing elite observability columns to diagnostic_executions and diagnostic_steps.
-- These columns were defined in sql/023_admin_diagnostics_elite.sql but never applied
-- via the migrations pipeline.

alter table if exists public.diagnostic_executions
  add column if not exists conversation_trace_id text,
  add column if not exists parent_execution_id uuid,
  add column if not exists severity text not null default 'info',
  add column if not exists pipeline_version text,
  add column if not exists prompt_version text,
  add column if not exists rules_version text,
  add column if not exists graph_mapping_version text,
  add column if not exists diagnostic_schema_version text,
  add column if not exists diagnostic_quality_band text,
  add column if not exists expired_at timestamptz;

alter table if exists public.diagnostic_steps
  add column if not exists severity text not null default 'info';

create index if not exists idx_diag_exec_conversation_trace_id on public.diagnostic_executions(conversation_trace_id);
create index if not exists idx_diag_exec_parent_execution_id on public.diagnostic_executions(parent_execution_id);
create index if not exists idx_diag_exec_severity on public.diagnostic_executions(severity);
create index if not exists idx_diag_exec_quality_band on public.diagnostic_executions(diagnostic_quality_band);
create index if not exists idx_diag_exec_expired_at on public.diagnostic_executions(expired_at);
