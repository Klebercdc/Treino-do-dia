create extension if not exists pgcrypto;

create table if not exists public.kronia_intelligence_issues (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null unique,
  title text not null,
  description text not null,
  domain text not null,
  impact text not null,
  frequency integer not null default 0,
  priority text not null default 'P2',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.kronia_intelligence_tasks (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique,
  title text not null,
  summary text not null,
  domain text not null,
  priority text not null default 'P2',
  source_issue_id text not null,
  suggested_implementation_plan jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.kronia_intelligence_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommendation_id text not null unique,
  title text not null,
  text text not null,
  area text not null,
  priority text not null default 'P2',
  created_at timestamptz not null default now()
);
