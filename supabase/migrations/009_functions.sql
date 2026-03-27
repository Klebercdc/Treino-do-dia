create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_active_meal_plan(p_user_id uuid)
returns table (
  id uuid,
  user_id uuid,
  title text,
  description text,
  status text,
  valid_from date,
  valid_to date,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
as $$
  select mp.*
  from public.meal_plans mp
  where mp.user_id = p_user_id and mp.active = true
  order by mp.updated_at desc
  limit 1;
$$;

create or replace function public.get_latest_body_metrics(p_user_id uuid)
returns table (
  id uuid,
  user_id uuid,
  measured_at timestamptz,
  weight_kg numeric,
  body_fat_percent numeric,
  waist_cm numeric,
  hip_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  notes text,
  created_at timestamptz
)
language sql
security invoker
as $$
  select bm.*
  from public.body_metrics bm
  where bm.user_id = p_user_id
  order by bm.measured_at desc
  limit 1;
$$;

create or replace function public.get_recent_food_logs(p_user_id uuid, p_limit int default 20)
returns setof public.user_food_logs
language sql
security invoker
as $$
  select *
  from public.user_food_logs ufl
  where ufl.user_id = p_user_id
  order by ufl.consumed_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.get_recent_hydration_logs(p_user_id uuid, p_limit int default 20)
returns setof public.hydration_logs
language sql
security invoker
as $$
  select *
  from public.hydration_logs hl
  where hl.user_id = p_user_id
  order by hl.consumed_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.match_nutrition_knowledge(
  query_embedding vector(1536),
  match_count int,
  category_filter text default null,
  tags_filter text[] default null
)
returns table (
  id uuid,
  source_id uuid,
  document_id uuid,
  content text,
  category text,
  subcategory text,
  tags text[],
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    nkc.id,
    nkc.source_id,
    nkc.document_id,
    nkc.content,
    nkc.category,
    nkc.subcategory,
    nkc.tags,
    nkc.metadata,
    1 - (nkc.embedding <=> query_embedding) as similarity
  from public.nutrition_knowledge_chunks nkc
  join public.nutrition_knowledge_sources nks on nks.id = nkc.source_id
  where auth.role() in ('authenticated', 'service_role')
    and nks.status = 'active'
    and nkc.embedding is not null
    and (category_filter is null or nkc.category = category_filter)
    and (tags_filter is null or nkc.tags && tags_filter)
  order by nkc.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 30));
$$;

create or replace function public.ensure_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_nutrition_goals_set_updated_at on public.nutrition_goals;
create trigger trg_nutrition_goals_set_updated_at before update on public.nutrition_goals
for each row execute function public.set_updated_at();

drop trigger if exists trg_meal_plans_set_updated_at on public.meal_plans;
create trigger trg_meal_plans_set_updated_at before update on public.meal_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_meal_plan_items_set_updated_at on public.meal_plan_items;
create trigger trg_meal_plan_items_set_updated_at before update on public.meal_plan_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_food_logs_set_updated_at on public.user_food_logs;
create trigger trg_user_food_logs_set_updated_at before update on public.user_food_logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_supplement_protocols_set_updated_at on public.supplement_protocols;
create trigger trg_supplement_protocols_set_updated_at before update on public.supplement_protocols
for each row execute function public.set_updated_at();

drop trigger if exists trg_ai_conversations_set_updated_at on public.ai_conversations;
create trigger trg_ai_conversations_set_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();

drop trigger if exists trg_knowledge_sources_set_updated_at on public.nutrition_knowledge_sources;
create trigger trg_knowledge_sources_set_updated_at before update on public.nutrition_knowledge_sources
for each row execute function public.set_updated_at();

drop trigger if exists trg_knowledge_documents_set_updated_at on public.nutrition_knowledge_documents;
create trigger trg_knowledge_documents_set_updated_at before update on public.nutrition_knowledge_documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_knowledge_chunks_set_updated_at on public.nutrition_knowledge_chunks;
create trigger trg_knowledge_chunks_set_updated_at before update on public.nutrition_knowledge_chunks
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.ensure_profile_for_new_user();


revoke all on function public.match_nutrition_knowledge(vector(1536), int, text, text[]) from public;
grant execute on function public.match_nutrition_knowledge(vector(1536), int, text, text[]) to authenticated;
grant execute on function public.match_nutrition_knowledge(vector(1536), int, text, text[]) to service_role;
