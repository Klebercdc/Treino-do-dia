-- Diet item macro provenance
-- Adds explicit columns so generated meals can record whether macros came from
-- food_catalog/TACO or from a fallback estimate.

alter table if exists public.meal_plan_items
  add column if not exists food_catalog_id uuid null,
  add column if not exists taco_id text null,
  add column if not exists macro_source text null default 'llm_estimate',
  add column if not exists macro_audit jsonb null;

create index if not exists idx_meal_plan_items_food_catalog_id
  on public.meal_plan_items(food_catalog_id);

create index if not exists idx_meal_plan_items_macro_source
  on public.meal_plan_items(macro_source);
