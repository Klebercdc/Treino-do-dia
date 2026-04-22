-- Security hardening: every public table created by prior migrations must have
-- explicit RLS. This closes Supabase security advisor findings for public tables
-- that were readable through the anon key.

-- Scientific reference data is application reference material, not public anon
-- data. Backend jobs use service_role; signed-in users may read it through app
-- flows. Anonymous clients must not read, insert, update or delete it.
do $$
begin
  if to_regclass('public.scientific_articles') is not null then
    alter table public.scientific_articles enable row level security;

    drop policy if exists "science_articles: read authenticated" on public.scientific_articles;
    drop policy if exists "science_articles: write service" on public.scientific_articles;
    drop policy if exists scientific_articles_authenticated_read on public.scientific_articles;
    drop policy if exists scientific_articles_admin_write on public.scientific_articles;

    create policy scientific_articles_authenticated_read
      on public.scientific_articles
      for select
      to authenticated
      using (true);

    create policy scientific_articles_admin_write
      on public.scientific_articles
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if to_regclass('public.scientific_topics') is not null then
    alter table public.scientific_topics enable row level security;

    drop policy if exists scientific_topics_authenticated_read on public.scientific_topics;
    drop policy if exists scientific_topics_admin_write on public.scientific_topics;

    create policy scientific_topics_authenticated_read
      on public.scientific_topics
      for select
      to authenticated
      using (true);

    create policy scientific_topics_admin_write
      on public.scientific_topics
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if to_regclass('public.scientific_evidence') is not null then
    alter table public.scientific_evidence enable row level security;

    drop policy if exists scientific_evidence_authenticated_read on public.scientific_evidence;
    drop policy if exists scientific_evidence_admin_write on public.scientific_evidence;

    create policy scientific_evidence_authenticated_read
      on public.scientific_evidence
      for select
      to authenticated
      using (true);

    create policy scientific_evidence_admin_write
      on public.scientific_evidence
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Legacy AI knowledge tables from sql/001_kronia_ai_schema.sql. They are not
-- present in every environment, so this block is defensive and idempotent.
do $$
begin
  if to_regclass('public.knowledge_documents') is not null then
    alter table public.knowledge_documents enable row level security;

    drop policy if exists knowledge_documents_authenticated_read on public.knowledge_documents;
    drop policy if exists knowledge_documents_admin_write on public.knowledge_documents;

    create policy knowledge_documents_authenticated_read
      on public.knowledge_documents
      for select
      to authenticated
      using (true);

    create policy knowledge_documents_admin_write
      on public.knowledge_documents
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if to_regclass('public.knowledge_chunks') is not null then
    alter table public.knowledge_chunks enable row level security;

    drop policy if exists knowledge_chunks_authenticated_read on public.knowledge_chunks;
    drop policy if exists knowledge_chunks_admin_write on public.knowledge_chunks;

    create policy knowledge_chunks_authenticated_read
      on public.knowledge_chunks
      for select
      to authenticated
      using (true);

    create policy knowledge_chunks_admin_write
      on public.knowledge_chunks
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Runtime and diagnostic governance settings are backend/admin-only.
do $$
begin
  if to_regclass('public.app_runtime_settings') is not null then
    alter table public.app_runtime_settings enable row level security;

    drop policy if exists app_runtime_settings_admin_read on public.app_runtime_settings;
    drop policy if exists app_runtime_settings_admin_write on public.app_runtime_settings;

    create policy app_runtime_settings_admin_read
      on public.app_runtime_settings
      for select
      to authenticated
      using (public.is_admin());

    create policy app_runtime_settings_admin_write
      on public.app_runtime_settings
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if to_regclass('public.diagnostic_governance') is not null then
    alter table public.diagnostic_governance enable row level security;

    drop policy if exists diagnostic_governance_admin_read on public.diagnostic_governance;
    drop policy if exists diagnostic_governance_admin_write on public.diagnostic_governance;

    create policy diagnostic_governance_admin_read
      on public.diagnostic_governance
      for select
      to authenticated
      using (public.is_admin());

    create policy diagnostic_governance_admin_write
      on public.diagnostic_governance
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Kronia intelligence operational tables are admin/backend surfaces.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'kronia_intelligence_insights',
    'kronia_intelligence_issues',
    'kronia_intelligence_tasks',
    'kronia_intelligence_recommendations'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I enable row level security;', tbl);

      execute format('drop policy if exists %I on public.%I;', tbl || '_admin_read', tbl);
      execute format('drop policy if exists %I on public.%I;', tbl || '_admin_write', tbl);

      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_admin());',
        tbl || '_admin_read',
        tbl
      );
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());',
        tbl || '_admin_write',
        tbl
      );
    end if;
  end loop;
end $$;
