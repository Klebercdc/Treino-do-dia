create extension if not exists pgcrypto;

create table if not exists public.ai_diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  module text not null,
  action text not null,
  event text not null,
  severity text not null default 'LOW',
  problem_code text null,
  problem_label text null,
  analysis jsonb not null default '{}'::jsonb,
  recommendation jsonb not null default '{}'::jsonb,
  task jsonb not null default '{}'::jsonb,
  correlation_id text null,
  source text not null default 'client',
  app_version text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_diagnostics_created_at on public.ai_diagnostics(created_at desc);
create index if not exists idx_ai_diagnostics_module on public.ai_diagnostics(module);
create index if not exists idx_ai_diagnostics_problem_code on public.ai_diagnostics(problem_code);
create index if not exists idx_ai_diagnostics_correlation on public.ai_diagnostics(correlation_id);

alter table public.ai_diagnostics enable row level security;

drop policy if exists ai_diagnostics_admin_read on public.ai_diagnostics;
create policy ai_diagnostics_admin_read on public.ai_diagnostics
for select to authenticated
using (public.kronia_is_diagnostic_admin());

drop policy if exists ai_diagnostics_admin_insert on public.ai_diagnostics;
create policy ai_diagnostics_admin_insert on public.ai_diagnostics
for insert to authenticated
with check (public.kronia_is_diagnostic_admin());
