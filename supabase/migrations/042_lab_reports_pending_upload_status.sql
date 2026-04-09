-- Permite etapa init-upload sem disparar OCR antes do upload concluir.
-- Status padrão passa a incluir pending_upload para o fluxo signed upload + register.

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'lab_reports'
      and constraint_name = 'lab_reports_status_check'
  ) then
    alter table public.lab_reports drop constraint lab_reports_status_check;
  end if;

  alter table public.lab_reports
    add constraint lab_reports_status_check
    check (status in ('pending_upload', 'uploaded', 'processing', 'extracted', 'needs_review', 'analyzed', 'failed'));
end $$;
