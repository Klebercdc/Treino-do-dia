-- Endurece policies de storage de exames para exigir ownership + prefixo user_id.
-- Isso alinha o RLS ao contrato do frontend/backend: {auth.uid()}/{uuid}.{ext}

drop policy if exists "lab_reports_storage_select_own" on storage.objects;
drop policy if exists "lab_reports_storage_insert_own" on storage.objects;
drop policy if exists "lab_reports_storage_update_own" on storage.objects;
drop policy if exists "lab_reports_storage_delete_own" on storage.objects;

create policy "lab_reports_storage_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lab-reports'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,10}$'
  );

create policy "lab_reports_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lab-reports'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,10}$'
  );

create policy "lab_reports_storage_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'lab-reports'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,10}$'
  )
  with check (
    bucket_id = 'lab-reports'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,10}$'
  );

create policy "lab_reports_storage_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'lab-reports'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,10}$'
  );
