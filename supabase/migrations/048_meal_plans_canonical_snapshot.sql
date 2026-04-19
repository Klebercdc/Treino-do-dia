-- KRONIA — Persistência canônica do intake de dieta.
-- Mantém o modelo relacional existente e adiciona snapshot estruturado
-- para que a fonte da verdade da dieta seja o plano salvo.

alter table if exists public.meal_plans
  add column if not exists plan_data jsonb,
  add column if not exists context_snapshot jsonb;

create index if not exists idx_meal_plans_context_snapshot_gin
  on public.meal_plans using gin (context_snapshot);
