create extension if not exists pgcrypto;

create table if not exists public.kronia_intelligence_insights (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  description text not null,
  impact text not null,
  domain text not null,
  suggested_action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kronia_intelligence_insights_created_at
  on public.kronia_intelligence_insights(created_at desc);

create index if not exists idx_kronia_intelligence_insights_domain
  on public.kronia_intelligence_insights(domain);
