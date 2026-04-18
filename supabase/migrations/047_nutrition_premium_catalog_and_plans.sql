-- KRONIA — Migration 047: catálogo premium canônico de nutrição
-- Mantém compatibilidade com as tabelas legadas de nutrição e adiciona
-- a base reutilizável por geração, substituição, diário, PDF e KRONOS.

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  canonical_name_pt text not null,
  display_name_pt text not null,
  group_key text not null,
  subgroup_key text not null,
  source text not null default 'KRONIA premium seed',
  source_code text,
  brand_name text,
  default_portion_g numeric(8,2) not null check (default_portion_g > 0),
  default_unit text not null,
  kcal_100g numeric(8,2) not null check (kcal_100g >= 0),
  protein_100g numeric(8,2) not null default 0 check (protein_100g >= 0),
  carbs_100g numeric(8,2) not null default 0 check (carbs_100g >= 0),
  fat_100g numeric(8,2) not null default 0 check (fat_100g >= 0),
  fiber_100g numeric(8,2) not null default 0 check (fiber_100g >= 0),
  sugar_100g numeric(8,2),
  sodium_mg_100g numeric(10,2),
  potassium_mg_100g numeric(10,2),
  cholesterol_mg_100g numeric(10,2),
  saturated_fat_100g numeric(8,2),
  glycemic_index_hint text,
  glycemic_load_hint text,
  score_practicality integer not null default 3 check (score_practicality between 1 and 5),
  score_cost integer not null default 3 check (score_cost between 1 and 5),
  is_common boolean not null default true,
  is_recipe_ingredient boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  unique(food_id, normalized_alias, locale)
);

create table if not exists public.food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  label_pt text not null,
  grams numeric(8,2) not null check (grams > 0),
  household_measure text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(food_id, label_pt)
);

create table if not exists public.food_tags (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_pt text not null
);

create table if not exists public.food_tag_map (
  food_id uuid not null references public.foods(id) on delete cascade,
  tag_id uuid not null references public.food_tags(id) on delete cascade,
  primary key(food_id, tag_id)
);

create table if not exists public.food_substitutions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  substitute_food_id uuid not null references public.foods(id) on delete cascade,
  reason text not null default 'same_group_macro_equivalent',
  priority integer not null default 50,
  created_at timestamptz not null default now(),
  unique(food_id, substitute_food_id),
  check(food_id <> substitute_food_id)
);

create table if not exists public.recipe_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_pt text not null,
  meal_slot text not null,
  prep_time_min integer not null default 20 check (prep_time_min > 0),
  difficulty text not null default 'facil',
  instructions_json jsonb not null default '[]'::jsonb,
  kcal numeric(8,2) not null default 0,
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fat_g numeric(8,2) not null default 0,
  fiber_g numeric(8,2) not null default 0,
  score_practicality integer not null default 4 check (score_practicality between 1 and 5),
  score_cost integer not null default 4 check (score_cost between 1 and 5),
  tags_json jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipe_catalog(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete restrict,
  grams numeric(8,2) not null check (grams > 0),
  optional boolean not null default false,
  substitution_group text,
  sort_order integer not null default 0,
  unique(recipe_id, food_id, sort_order)
);

create table if not exists public.user_food_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  preference_type text not null default 'neutral' check (preference_type in ('liked','neutral','disliked','blocked','unavailable')),
  usage_score numeric(8,2) not null default 0,
  is_favorite boolean not null default false,
  is_blocked boolean not null default false,
  is_unavailable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, food_id)
);

create table if not exists public.user_saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  meal_slot text not null,
  items_json jsonb not null default '[]'::jsonb,
  kcal numeric(8,2) not null default 0,
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fat_g numeric(8,2) not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_plans
  add column if not exists objective text,
  add column if not exists kcal_target numeric(8,2),
  add column if not exists protein_target_g numeric(8,2),
  add column if not exists carbs_target_g numeric(8,2),
  add column if not exists fat_target_g numeric(8,2),
  add column if not exists fiber_target_g numeric(8,2),
  add column if not exists meal_count integer,
  add column if not exists diet_style text,
  add column if not exists context_snapshot_json jsonb not null default '{}'::jsonb,
  add column if not exists plan_status text not null default 'draft';

create table if not exists public.nutrition_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  day_index integer not null check (day_index between 1 and 14),
  label text not null,
  unique(plan_id, day_index)
);

alter table public.nutrition_plan_meals
  add column if not exists day_id uuid references public.nutrition_plan_days(id) on delete cascade,
  add column if not exists meal_slot text,
  add column if not exists title text,
  add column if not exists kcal numeric(8,2),
  add column if not exists protein_g numeric(8,2),
  add column if not exists carbs_g numeric(8,2),
  add column if not exists fat_g numeric(8,2),
  add column if not exists fiber_g numeric(8,2),
  add column if not exists notes text;

create table if not exists public.nutrition_plan_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.nutrition_plan_meals(id) on delete cascade,
  source_type text not null check (source_type in ('food','recipe','custom')),
  source_id uuid,
  display_name text not null,
  grams numeric(8,2),
  household_measure text,
  kcal numeric(8,2) not null default 0,
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fat_g numeric(8,2) not null default 0,
  fiber_g numeric(8,2) not null default 0,
  substitution_group text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.food_diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  meal_slot text not null,
  source_type text not null default 'food' check (source_type in ('food','recipe','custom')),
  source_id uuid,
  display_name text not null,
  grams numeric(8,2),
  kcal numeric(8,2) not null default 0,
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fat_g numeric(8,2) not null default 0,
  fiber_g numeric(8,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists foods_group_active_idx on public.foods(group_key, subgroup_key, is_active);
create index if not exists food_aliases_normalized_idx on public.food_aliases(normalized_alias);
create index if not exists recipe_catalog_slot_active_idx on public.recipe_catalog(meal_slot, is_active);
create index if not exists food_diary_entries_user_date_idx on public.food_diary_entries(user_id, entry_date desc);
create index if not exists user_saved_meals_user_slot_idx on public.user_saved_meals(user_id, meal_slot, last_used_at desc);

alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
alter table public.food_portions enable row level security;
alter table public.food_tags enable row level security;
alter table public.food_tag_map enable row level security;
alter table public.food_substitutions enable row level security;
alter table public.recipe_catalog enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.user_food_preferences enable row level security;
alter table public.user_saved_meals enable row level security;
alter table public.nutrition_plan_days enable row level security;
alter table public.nutrition_plan_meal_items enable row level security;
alter table public.food_diary_entries enable row level security;

drop policy if exists "foods: authenticated read" on public.foods;
create policy "foods: authenticated read" on public.foods for select using (auth.role() = 'authenticated');
drop policy if exists "food_aliases: authenticated read" on public.food_aliases;
create policy "food_aliases: authenticated read" on public.food_aliases for select using (auth.role() = 'authenticated');
drop policy if exists "food_portions: authenticated read" on public.food_portions;
create policy "food_portions: authenticated read" on public.food_portions for select using (auth.role() = 'authenticated');
drop policy if exists "food_tags: authenticated read" on public.food_tags;
create policy "food_tags: authenticated read" on public.food_tags for select using (auth.role() = 'authenticated');
drop policy if exists "food_tag_map: authenticated read" on public.food_tag_map;
create policy "food_tag_map: authenticated read" on public.food_tag_map for select using (auth.role() = 'authenticated');
drop policy if exists "food_substitutions: authenticated read" on public.food_substitutions;
create policy "food_substitutions: authenticated read" on public.food_substitutions for select using (auth.role() = 'authenticated');
drop policy if exists "recipe_catalog: authenticated read" on public.recipe_catalog;
create policy "recipe_catalog: authenticated read" on public.recipe_catalog for select using (auth.role() = 'authenticated');
drop policy if exists "recipe_ingredients: authenticated read" on public.recipe_ingredients;
create policy "recipe_ingredients: authenticated read" on public.recipe_ingredients for select using (auth.role() = 'authenticated');

drop policy if exists "user_food_preferences: own all" on public.user_food_preferences;
create policy "user_food_preferences: own all" on public.user_food_preferences
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_saved_meals: own all" on public.user_saved_meals;
create policy "user_saved_meals: own all" on public.user_saved_meals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "food_diary_entries: own all" on public.food_diary_entries;
create policy "food_diary_entries: own all" on public.food_diary_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "nutrition_plan_days: own read" on public.nutrition_plan_days;
create policy "nutrition_plan_days: own read" on public.nutrition_plan_days
for select using (
  exists (
    select 1 from public.nutrition_plans p
    where p.id = plan_id and p.user_id = auth.uid()
  )
);

drop policy if exists "nutrition_plan_meal_items: own read" on public.nutrition_plan_meal_items;
create policy "nutrition_plan_meal_items: own read" on public.nutrition_plan_meal_items
for select using (
  exists (
    select 1
    from public.nutrition_plan_meals m
    join public.nutrition_plans p on p.id = m.nutrition_plan_id
    where m.id = meal_id and p.user_id = auth.uid()
  )
);

insert into public.food_tags(code, label_pt)
values
  ('high_protein', 'Alta proteína'),
  ('low_carb', 'Baixo carboidrato'),
  ('vegano', 'Vegano'),
  ('vegetariano', 'Vegetariano'),
  ('sem_gluten', 'Sem glúten'),
  ('sem_lactose', 'Sem lactose'),
  ('baixo_sodio', 'Baixo sódio'),
  ('baixo_potassio', 'Baixo potássio'),
  ('baixo_ig', 'Baixo índice glicêmico'),
  ('pre_treino', 'Pré-treino'),
  ('pos_treino', 'Pós-treino'),
  ('facil_preparo', 'Fácil preparo'),
  ('alta_saciedade', 'Alta saciedade'),
  ('alta_densidade_calorica', 'Alta densidade calórica'),
  ('baixa_densidade_calorica', 'Baixa densidade calórica')
on conflict(code) do update set label_pt = excluded.label_pt;

insert into public.foods (
  slug, canonical_name_pt, display_name_pt, group_key, subgroup_key, source, source_code,
  default_portion_g, default_unit, kcal_100g, protein_100g, carbs_100g, fat_100g,
  fiber_100g, score_practicality, score_cost, is_common, is_recipe_ingredient, is_active
)
select code, nome, nome, grupo, grupo, coalesce(fonte, 'KRONIA seed legado'), code,
       porcao_gramas, porcao_descricao, round(calorias / nullif(porcao_gramas, 0) * 100, 2),
       round(proteinas / nullif(porcao_gramas, 0) * 100, 2),
       round(carboidratos / nullif(porcao_gramas, 0) * 100, 2),
       round(gorduras / nullif(porcao_gramas, 0) * 100, 2),
       round(fibras / nullif(porcao_gramas, 0) * 100, 2),
       4, 4, true, true, ativo
from public.food_catalog
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'food_catalog'
)
on conflict(slug) do nothing;
