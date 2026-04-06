create table if not exists public.lab_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_url text not null,
  file_name text null,
  file_type text null,
  parsed jsonb,
  confidence numeric default 0,
  is_valid boolean default false,
  parse_status text not null default 'pending' check (parse_status in ('pending', 'parsed', 'failed')),
  validation_errors jsonb not null default '[]'::jsonb,
  clinical_flags jsonb not null default '[]'::jsonb,
  critical_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lab_reports_user on public.lab_reports(user_id);
create index if not exists idx_lab_reports_user_created_at on public.lab_reports(user_id, created_at desc);

alter table public.lab_reports enable row level security;

drop policy if exists "lab_reports_select_own" on public.lab_reports;
create policy "lab_reports_select_own" on public.lab_reports
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "lab_reports_insert_own" on public.lab_reports;
create policy "lab_reports_insert_own" on public.lab_reports
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "lab_reports_update_own" on public.lab_reports;
create policy "lab_reports_update_own" on public.lab_reports
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lab-reports',
  'lab-reports',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lab_reports_storage_select_own" on storage.objects;
create policy "lab_reports_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lab-reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "lab_reports_storage_insert_own" on storage.objects;
create policy "lab_reports_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lab-reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "lab_reports_storage_update_own" on storage.objects;
create policy "lab_reports_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'lab-reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'lab-reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
