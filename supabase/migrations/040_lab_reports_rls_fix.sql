-- Corrige políticas RLS de lab_reports e storage.objects (bucket: lab-reports).
--
-- Problema: a policy de INSERT em storage.objects usava
--   (storage.foldername(name))[1] = auth.uid()::text
-- O Supabase Storage popula `owner` no próprio INSERT que ele executa,
-- portanto a checagem confiável é `owner = auth.uid()`, não a decomposição do caminho.
--
-- Também adicionada policy DELETE ausente em public.lab_reports.

-- ── public.lab_reports ─────────────────────────────────────────────────────

alter table public.lab_reports enable row level security;

drop policy if exists "lab_reports_select_own" on public.lab_reports;
drop policy if exists "lab_reports_insert_own" on public.lab_reports;
drop policy if exists "lab_reports_update_own" on public.lab_reports;
drop policy if exists "lab_reports_delete_own" on public.lab_reports;

create policy "lab_reports_select_own"
  on public.lab_reports for select to authenticated
  using (user_id = auth.uid());

create policy "lab_reports_insert_own"
  on public.lab_reports for insert to authenticated
  with check (user_id = auth.uid());

create policy "lab_reports_update_own"
  on public.lab_reports for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lab_reports_delete_own"
  on public.lab_reports for delete to authenticated
  using (user_id = auth.uid());

-- ── storage.objects (bucket: lab-reports) ──────────────────────────────────
-- Remove políticas antigas (path-based) e recria com owner-based.

drop policy if exists "lab_reports_storage_select_own" on storage.objects;
drop policy if exists "lab_reports_storage_insert_own" on storage.objects;
drop policy if exists "lab_reports_storage_update_own" on storage.objects;
drop policy if exists "lab_reports_storage_delete_own" on storage.objects;

create policy "lab_reports_storage_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lab-reports'
    and owner = auth.uid()
  );

create policy "lab_reports_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lab-reports'
    and owner = auth.uid()
  );

create policy "lab_reports_storage_update_own"
  on storage.objects for update to authenticated
  using  (bucket_id = 'lab-reports' and owner = auth.uid())
  with check (bucket_id = 'lab-reports' and owner = auth.uid());

create policy "lab_reports_storage_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'lab-reports'
    and owner = auth.uid()
  );
