-- ============================================================
-- KRONIA — Migration 004: RLS para todas as tabelas sensíveis
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ── nutrition_goals ───────────────────────────────────────────
alter table public.nutrition_goals enable row level security;

drop policy if exists "nutrition_goals_select_own" on public.nutrition_goals;
create policy "nutrition_goals_select_own" on public.nutrition_goals
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "nutrition_goals_insert_own" on public.nutrition_goals;
create policy "nutrition_goals_insert_own" on public.nutrition_goals
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "nutrition_goals_update_own" on public.nutrition_goals;
create policy "nutrition_goals_update_own" on public.nutrition_goals
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "nutrition_goals_delete_own" on public.nutrition_goals;
create policy "nutrition_goals_delete_own" on public.nutrition_goals
  for delete to authenticated using (auth.uid() = user_id);

-- ── meal_plans ────────────────────────────────────────────────
alter table public.meal_plans enable row level security;

drop policy if exists "meal_plans_select_own" on public.meal_plans;
create policy "meal_plans_select_own" on public.meal_plans
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "meal_plans_insert_own" on public.meal_plans;
create policy "meal_plans_insert_own" on public.meal_plans
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "meal_plans_update_own" on public.meal_plans;
create policy "meal_plans_update_own" on public.meal_plans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_plans_delete_own" on public.meal_plans;
create policy "meal_plans_delete_own" on public.meal_plans
  for delete to authenticated using (auth.uid() = user_id);

-- ── meal_plan_items ───────────────────────────────────────────
-- Acesso via JOIN com meal_plans — verificação de ownership por subquery
alter table public.meal_plan_items enable row level security;

drop policy if exists "meal_plan_items_select_own" on public.meal_plan_items;
create policy "meal_plan_items_select_own" on public.meal_plan_items
  for select to authenticated using (
    exists (
      select 1 from public.meal_plans mp
      where mp.id = meal_plan_id and mp.user_id = auth.uid()
    )
  );

drop policy if exists "meal_plan_items_insert_own" on public.meal_plan_items;
create policy "meal_plan_items_insert_own" on public.meal_plan_items
  for insert to authenticated with check (
    exists (
      select 1 from public.meal_plans mp
      where mp.id = meal_plan_id and mp.user_id = auth.uid()
    )
  );

drop policy if exists "meal_plan_items_update_own" on public.meal_plan_items;
create policy "meal_plan_items_update_own" on public.meal_plan_items
  for update to authenticated
  using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid()))
  with check (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid()));

drop policy if exists "meal_plan_items_delete_own" on public.meal_plan_items;
create policy "meal_plan_items_delete_own" on public.meal_plan_items
  for delete to authenticated using (
    exists (
      select 1 from public.meal_plans mp
      where mp.id = meal_plan_id and mp.user_id = auth.uid()
    )
  );

-- ── user_food_logs ────────────────────────────────────────────
alter table public.user_food_logs enable row level security;

drop policy if exists "user_food_logs_select_own" on public.user_food_logs;
create policy "user_food_logs_select_own" on public.user_food_logs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_food_logs_insert_own" on public.user_food_logs;
create policy "user_food_logs_insert_own" on public.user_food_logs
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "user_food_logs_delete_own" on public.user_food_logs;
create policy "user_food_logs_delete_own" on public.user_food_logs
  for delete to authenticated using (auth.uid() = user_id);

-- ── hydration_logs ────────────────────────────────────────────
alter table public.hydration_logs enable row level security;

drop policy if exists "hydration_logs_select_own" on public.hydration_logs;
create policy "hydration_logs_select_own" on public.hydration_logs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "hydration_logs_insert_own" on public.hydration_logs;
create policy "hydration_logs_insert_own" on public.hydration_logs
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "hydration_logs_delete_own" on public.hydration_logs;
create policy "hydration_logs_delete_own" on public.hydration_logs
  for delete to authenticated using (auth.uid() = user_id);

-- ── body_metrics ──────────────────────────────────────────────
alter table public.body_metrics enable row level security;

drop policy if exists "body_metrics_select_own" on public.body_metrics;
create policy "body_metrics_select_own" on public.body_metrics
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "body_metrics_insert_own" on public.body_metrics;
create policy "body_metrics_insert_own" on public.body_metrics
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "body_metrics_delete_own" on public.body_metrics;
create policy "body_metrics_delete_own" on public.body_metrics
  for delete to authenticated using (auth.uid() = user_id);

-- ── supplement_protocols ──────────────────────────────────────
alter table public.supplement_protocols enable row level security;

drop policy if exists "supplement_protocols_select_own" on public.supplement_protocols;
create policy "supplement_protocols_select_own" on public.supplement_protocols
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "supplement_protocols_insert_own" on public.supplement_protocols;
create policy "supplement_protocols_insert_own" on public.supplement_protocols
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "supplement_protocols_update_own" on public.supplement_protocols;
create policy "supplement_protocols_update_own" on public.supplement_protocols
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "supplement_protocols_delete_own" on public.supplement_protocols;
create policy "supplement_protocols_delete_own" on public.supplement_protocols
  for delete to authenticated using (auth.uid() = user_id);

-- ── ai_conversations ──────────────────────────────────────────
alter table public.ai_conversations enable row level security;

drop policy if exists "ai_conversations_select_own" on public.ai_conversations;
create policy "ai_conversations_select_own" on public.ai_conversations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ai_conversations_insert_own" on public.ai_conversations;
create policy "ai_conversations_insert_own" on public.ai_conversations
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "ai_conversations_update_own" on public.ai_conversations;
create policy "ai_conversations_update_own" on public.ai_conversations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_conversations_delete_own" on public.ai_conversations;
create policy "ai_conversations_delete_own" on public.ai_conversations
  for delete to authenticated using (auth.uid() = user_id);

-- ── ai_messages ───────────────────────────────────────────────
alter table public.ai_messages enable row level security;

drop policy if exists "ai_messages_select_own" on public.ai_messages;
create policy "ai_messages_select_own" on public.ai_messages
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ai_messages_insert_own" on public.ai_messages;
create policy "ai_messages_insert_own" on public.ai_messages
  for insert to authenticated with check (auth.uid() = user_id);

-- ── ai_context_logs ───────────────────────────────────────────
alter table public.ai_context_logs enable row level security;

drop policy if exists "ai_context_logs_select_own" on public.ai_context_logs;
create policy "ai_context_logs_select_own" on public.ai_context_logs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ai_context_logs_insert_service" on public.ai_context_logs;
create policy "ai_context_logs_insert_service" on public.ai_context_logs
  for insert to service_role with check (true);

-- ── workouts ──────────────────────────────────────────────────
alter table public.workouts enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
create policy "workouts_select_own" on public.workouts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own" on public.workouts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workouts_update_own" on public.workouts;
create policy "workouts_update_own" on public.workouts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_delete_own" on public.workouts
  for delete to authenticated using (auth.uid() = user_id);

-- ── workout_logs ──────────────────────────────────────────────
alter table public.workout_logs enable row level security;

drop policy if exists "workout_logs_select_own" on public.workout_logs;
create policy "workout_logs_select_own" on public.workout_logs
  for select to authenticated using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "workout_logs_insert_own" on public.workout_logs;
create policy "workout_logs_insert_own" on public.workout_logs
  for insert to authenticated with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "workout_logs_delete_own" on public.workout_logs;
create policy "workout_logs_delete_own" on public.workout_logs
  for delete to authenticated using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

-- ── push_subscriptions ────────────────────────────────────────
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

-- ── nutrition_knowledge_sources — leitura pública, escrita restrita ──
alter table public.nutrition_knowledge_sources enable row level security;

drop policy if exists "nutrition_knowledge_sources_select_all" on public.nutrition_knowledge_sources;
create policy "nutrition_knowledge_sources_select_all" on public.nutrition_knowledge_sources
  for select to authenticated using (true);

-- ── nutrition_knowledge_documents — leitura pública, escrita restrita ──
alter table public.nutrition_knowledge_documents enable row level security;

drop policy if exists "nutrition_knowledge_documents_select_all" on public.nutrition_knowledge_documents;
create policy "nutrition_knowledge_documents_select_all" on public.nutrition_knowledge_documents
  for select to authenticated using (true);

-- ── nutrition_knowledge_chunks — leitura pública, escrita restrita ──
alter table public.nutrition_knowledge_chunks enable row level security;

drop policy if exists "nutrition_knowledge_chunks_select_all" on public.nutrition_knowledge_chunks;
create policy "nutrition_knowledge_chunks_select_all" on public.nutrition_knowledge_chunks
  for select to authenticated using (true);
