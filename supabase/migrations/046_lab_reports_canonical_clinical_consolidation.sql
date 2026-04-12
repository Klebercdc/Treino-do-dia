-- ============================================================================
-- Migration 046: canonical clinical status + append-only snapshots + review
-- model, preserving legacy status/parse_status contracts.
-- (renamed from 045_ to avoid duplicate prefix with 045_contextual_interpretation)
-- ============================================================================

alter table if exists public.lab_reports
  add column if not exists canonical_status text,
  add column if not exists review_status text,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewer_notes text,
  add column if not exists released_at timestamptz,
  add column if not exists released_by_rule text,
  add column if not exists machine_snapshot jsonb,
  add column if not exists reviewed_snapshot jsonb,
  add column if not exists released_snapshot jsonb,
  add column if not exists version integer not null default 0;

update public.lab_reports
   set canonical_status = case
     when status = 'analyzed' then 'released_to_patient'
     when status = 'needs_review' then 'needs_clinical_review'
     when status = 'extracted' then 'extracted_machine'
     when status = 'processing' then 'ocr_running'
     when status = 'uploaded' then 'uploaded'
     when status = 'failed' then 'failed'
     else coalesce(canonical_status, status, 'uploaded')
   end
 where canonical_status is null;

update public.lab_reports
   set review_status = case
     when status = 'analyzed' then 'released'
     when status = 'needs_review' then 'awaiting_review'
     when status = 'failed' then 'rejected'
     else coalesce(review_status, 'machine_only')
   end
 where review_status is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lab_reports_canonical_status_check') then
    alter table public.lab_reports
      add constraint lab_reports_canonical_status_check
      check (canonical_status in (
        'pending_upload',
        'uploaded',
        'queued',
        'ocr_running',
        'extracted_machine',
        'needs_clinical_review',
        'reviewed_locked',
        'released_to_patient',
        'failed'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lab_reports_review_status_check') then
    alter table public.lab_reports
      add constraint lab_reports_review_status_check
      check (review_status in (
        'machine_only',
        'awaiting_review',
        'reviewed',
        'rejected',
        'released'
      ));
  end if;
end $$;

create index if not exists idx_lab_reports_canonical_status_created
  on public.lab_reports(canonical_status, created_at desc);

create table if not exists public.lab_report_snapshot_versions (
  id uuid primary key default gen_random_uuid(),
  lab_report_id uuid not null references public.lab_reports(id) on delete cascade,
  version integer not null,
  snapshot_kind text not null check (snapshot_kind in ('machine', 'reviewed', 'released')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(lab_report_id, version, snapshot_kind)
);

create index if not exists idx_lab_report_snapshot_versions_report_created
  on public.lab_report_snapshot_versions(lab_report_id, created_at desc);

alter table public.lab_report_snapshot_versions enable row level security;

drop policy if exists "lab_report_snapshot_versions_select_own" on public.lab_report_snapshot_versions;
create policy "lab_report_snapshot_versions_select_own" on public.lab_report_snapshot_versions
for select to authenticated
using (
  exists (
    select 1
      from public.lab_reports r
     where r.id = lab_report_id
       and r.user_id = auth.uid()
  )
);

revoke insert, update, delete on public.lab_report_snapshot_versions from authenticated;

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

alter table if exists public.lab_report_biomarkers
  add column if not exists reference_text_raw text,
  add column if not exists normalized_reference jsonb,
  add column if not exists lab_flag text,
  add column if not exists context_flag text,
  add column if not exists interpretation_mode text,
  add column if not exists monitor_priority text,
  add column if not exists safety_relevance boolean,
  add column if not exists feedback_summary text,
  add column if not exists source_reference_kind text,
  add column if not exists extraction_confidence numeric,
  add column if not exists review_status text,
  add column if not exists reviewed_value_override jsonb,
  add column if not exists reviewed_reference_override jsonb,
  add column if not exists reviewer_note text,
  add column if not exists released_value jsonb,
  add column if not exists released_flag text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lab_report_biomarkers_review_status_check') then
    alter table public.lab_report_biomarkers
      add constraint lab_report_biomarkers_review_status_check
      check (review_status in (
        'machine_only',
        'awaiting_review',
        'reviewed',
        'rejected',
        'released'
      ));
  end if;
end $$;

create unique index if not exists idx_lab_report_biomarkers_report_marker
  on public.lab_report_biomarkers(lab_report_id, marker_key, marker_name, coalesce(unit, ''));

create index if not exists idx_lab_report_biomarkers_report
  on public.lab_report_biomarkers(lab_report_id);

alter table public.lab_report_biomarkers enable row level security;

drop policy if exists "lab_report_biomarkers_select_own" on public.lab_report_biomarkers;
create policy "lab_report_biomarkers_select_own" on public.lab_report_biomarkers
for select to authenticated
using (
  exists (
    select 1 from public.lab_reports r
     where r.id = lab_report_id
       and r.user_id = auth.uid()
  )
);

revoke insert, update, delete on public.lab_report_biomarkers from authenticated;

comment on table public.lab_report_snapshot_versions is 'Histórico append-only de snapshots clínicos por versão do exame.';
comment on column public.lab_reports.canonical_status is 'Status clínico interno canônico; status/parse_status seguem como projeção compatível.';
