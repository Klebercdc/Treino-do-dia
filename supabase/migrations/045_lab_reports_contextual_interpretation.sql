alter table if exists public.profiles
  add column if not exists uses_exogenous_hormones boolean,
  add column if not exists hormone_context_type text,
  add column if not exists declared_compounds jsonb not null default '[]'::jsonb,
  add column if not exists last_administration_at timestamptz,
  add column if not exists monitoring_mode text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_hormone_context_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_hormone_context_type_check
      check (hormone_context_type is null or hormone_context_type in ('natural', 'trt', 'assisted', 'unknown'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_monitoring_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_monitoring_mode_check
      check (monitoring_mode is null or monitoring_mode in ('natural', 'assisted'));
  end if;
end $$;

alter table if exists public.lab_report_biomarkers
  add column if not exists reference_text_raw text,
  add column if not exists normalized_reference jsonb,
  add column if not exists lab_flag text,
  add column if not exists context_flag text,
  add column if not exists interpretation_mode text,
  add column if not exists monitor_priority text,
  add column if not exists safety_relevance boolean,
  add column if not exists feedback_summary text,
  add column if not exists source_reference_kind text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_report_biomarkers_lab_flag_check'
  ) then
    alter table public.lab_report_biomarkers
      add constraint lab_report_biomarkers_lab_flag_check
      check (lab_flag is null or lab_flag in ('low', 'high', 'normal'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_report_biomarkers_interpretation_mode_check'
  ) then
    alter table public.lab_report_biomarkers
      add constraint lab_report_biomarkers_interpretation_mode_check
      check (interpretation_mode is null or interpretation_mode in ('natural', 'trt', 'assisted', 'unknown'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_report_biomarkers_monitor_priority_check'
  ) then
    alter table public.lab_report_biomarkers
      add constraint lab_report_biomarkers_monitor_priority_check
      check (monitor_priority is null or monitor_priority in ('low', 'medium', 'high'));
  end if;
end $$;

comment on column public.profiles.uses_exogenous_hormones is 'Declaração de uso hormonal exógeno para interpretação contextual esportiva dos exames.';
comment on column public.profiles.hormone_context_type is 'Contexto hormonal declarado: natural, trt, assisted ou unknown.';
comment on column public.profiles.declared_compounds is 'Compostos declarados pelo usuário para correlação segura de exames.';
comment on column public.profiles.last_administration_at is 'Última administração hormonal declarada, quando houver.';
comment on column public.profiles.monitoring_mode is 'Modo de monitoramento esportivo/laboratorial para personalização segura.';

comment on column public.lab_report_biomarkers.normalized_reference is 'Faixa laboratorial selecionada por sexo/idade/contexto a partir do texto bruto do laudo.';
comment on column public.lab_report_biomarkers.lab_flag is 'Classificação baseada exclusivamente na referência laboratorial selecionada.';
comment on column public.lab_report_biomarkers.context_flag is 'Classificação contextual esportiva complementar, sem sobrescrever o laudo.';
