create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists patologia text;

comment on column public.profiles.patologia is
  'Patologia ou condição clínica principal declarada pelo usuário; restrição obrigatória para KRONOS.';

create table if not exists public.clinical_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  domain text not null,
  topic text,
  summary text not null,
  recommendation_level text,
  source_type text,
  year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_evidence_sources_domain_chk
    check (domain in ('treino', 'dieta', 'exames', 'misto', 'base_cientifica')),
  constraint clinical_evidence_sources_year_chk
    check (year is null or (year >= 1900 and year <= 2100))
);

create index if not exists ix_clinical_evidence_sources_domain_topic
  on public.clinical_evidence_sources (domain, topic);

create index if not exists ix_clinical_evidence_sources_year
  on public.clinical_evidence_sources (year desc nulls last);

alter table public.clinical_evidence_sources enable row level security;

drop policy if exists "clinical evidence readable by authenticated users" on public.clinical_evidence_sources;
create policy "clinical evidence readable by authenticated users"
  on public.clinical_evidence_sources
  for select
  to authenticated
  using (true);

drop policy if exists "clinical evidence service role full access" on public.clinical_evidence_sources;
create policy "clinical evidence service role full access"
  on public.clinical_evidence_sources
  for all
  to service_role
  using (true)
  with check (true);
