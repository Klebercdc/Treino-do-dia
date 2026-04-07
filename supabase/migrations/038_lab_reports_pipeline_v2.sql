-- Evolução da vertical de exames para pipeline estruturado + OCR service.

alter table if exists public.lab_reports
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists status text not null default 'uploaded',
  add column if not exists extraction_mode text,
  add column if not exists source_type text,
  add column if not exists confidence_summary jsonb not null default '{}'::jsonb,
  add column if not exists normalized_payload jsonb,
  add column if not exists ai_insights jsonb,
  add column if not exists processing_error text,
  add column if not exists processed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lab_reports_status_check') then
    alter table public.lab_reports
      add constraint lab_reports_status_check
      check (status in ('uploaded', 'processing', 'extracted', 'needs_review', 'analyzed', 'failed'));
  end if;
end $$;

create table if not exists public.lab_report_extractions (
  id uuid primary key default gen_random_uuid(),
  lab_report_id uuid not null references public.lab_reports(id) on delete cascade,
  engine text not null,
  extraction_mode text not null,
  raw_text text,
  pages jsonb not null default '[]'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  confidence_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lab_report_biomarkers (
  id uuid primary key default gen_random_uuid(),
  lab_report_id uuid not null references public.lab_reports(id) on delete cascade,
  marker_key text not null,
  marker_name text not null,
  value_numeric numeric,
  value_text text,
  unit text,
  reference_min numeric,
  reference_max numeric,
  reference_text text,
  flag text,
  source_line text,
  confidence numeric,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_lab_report_biomarkers_report_marker
  on public.lab_report_biomarkers(lab_report_id, marker_key, marker_name, coalesce(unit, ''));

create index if not exists idx_lab_reports_user_status_created
  on public.lab_reports(user_id, status, created_at desc);
create index if not exists idx_lab_report_extractions_report_created
  on public.lab_report_extractions(lab_report_id, created_at desc);
create index if not exists idx_lab_report_biomarkers_report
  on public.lab_report_biomarkers(lab_report_id);

create or replace function public.touch_updated_at_lab_reports()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lab_reports_updated_at on public.lab_reports;
create trigger trg_lab_reports_updated_at
before update on public.lab_reports
for each row
execute function public.touch_updated_at_lab_reports();

alter table public.lab_report_extractions enable row level security;
alter table public.lab_report_biomarkers enable row level security;

-- leitura do próprio usuário
create policy "lab_report_extractions_select_own" on public.lab_report_extractions
for select to authenticated
using (
  exists (
    select 1 from public.lab_reports r
    where r.id = lab_report_id and r.user_id = auth.uid()
  )
);

create policy "lab_report_biomarkers_select_own" on public.lab_report_biomarkers
for select to authenticated
using (
  exists (
    select 1 from public.lab_reports r
    where r.id = lab_report_id and r.user_id = auth.uid()
  )
);

-- service role escreve com bypass de RLS
revoke insert, update, delete on public.lab_report_extractions from authenticated;
revoke insert, update, delete on public.lab_report_biomarkers from authenticated;

comment on table public.lab_reports is 'Registro principal de exames e estado do pipeline.';
comment on table public.lab_report_extractions is 'Tentativas/resultado bruto de extração OCR/PDF.';
comment on table public.lab_report_biomarkers is 'Biomarcadores normalizados extraídos de exame.';
