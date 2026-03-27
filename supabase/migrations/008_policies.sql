drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

drop policy if exists "nutrition_goals_select_own" on public.nutrition_goals;
drop policy if exists "nutrition_goals_insert_own" on public.nutrition_goals;
drop policy if exists "nutrition_goals_update_own" on public.nutrition_goals;
drop policy if exists "nutrition_goals_delete_own" on public.nutrition_goals;
create policy "nutrition_goals_select_own" on public.nutrition_goals for select using (auth.uid() = user_id);
create policy "nutrition_goals_insert_own" on public.nutrition_goals for insert with check (auth.uid() = user_id);
create policy "nutrition_goals_update_own" on public.nutrition_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nutrition_goals_delete_own" on public.nutrition_goals for delete using (auth.uid() = user_id);

drop policy if exists "meal_plans_select_own" on public.meal_plans;
drop policy if exists "meal_plans_insert_own" on public.meal_plans;
drop policy if exists "meal_plans_update_own" on public.meal_plans;
drop policy if exists "meal_plans_delete_own" on public.meal_plans;
create policy "meal_plans_select_own" on public.meal_plans for select using (auth.uid() = user_id);
create policy "meal_plans_insert_own" on public.meal_plans for insert with check (auth.uid() = user_id);
create policy "meal_plans_update_own" on public.meal_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_plans_delete_own" on public.meal_plans for delete using (auth.uid() = user_id);

drop policy if exists "meal_plan_items_select_own" on public.meal_plan_items;
drop policy if exists "meal_plan_items_insert_own" on public.meal_plan_items;
drop policy if exists "meal_plan_items_update_own" on public.meal_plan_items;
drop policy if exists "meal_plan_items_delete_own" on public.meal_plan_items;
create policy "meal_plan_items_select_own" on public.meal_plan_items for select using (
  exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
);
create policy "meal_plan_items_insert_own" on public.meal_plan_items for insert with check (
  exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
);
create policy "meal_plan_items_update_own" on public.meal_plan_items for update using (
  exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
) with check (
  exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
);
create policy "meal_plan_items_delete_own" on public.meal_plan_items for delete using (
  exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
);

drop policy if exists "user_food_logs_select_own" on public.user_food_logs;
drop policy if exists "user_food_logs_insert_own" on public.user_food_logs;
drop policy if exists "user_food_logs_update_own" on public.user_food_logs;
drop policy if exists "user_food_logs_delete_own" on public.user_food_logs;
create policy "user_food_logs_select_own" on public.user_food_logs for select using (auth.uid() = user_id);
create policy "user_food_logs_insert_own" on public.user_food_logs for insert with check (auth.uid() = user_id);
create policy "user_food_logs_update_own" on public.user_food_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_food_logs_delete_own" on public.user_food_logs for delete using (auth.uid() = user_id);

drop policy if exists "hydration_logs_select_own" on public.hydration_logs;
drop policy if exists "hydration_logs_insert_own" on public.hydration_logs;
drop policy if exists "hydration_logs_update_own" on public.hydration_logs;
drop policy if exists "hydration_logs_delete_own" on public.hydration_logs;
create policy "hydration_logs_select_own" on public.hydration_logs for select using (auth.uid() = user_id);
create policy "hydration_logs_insert_own" on public.hydration_logs for insert with check (auth.uid() = user_id);
create policy "hydration_logs_update_own" on public.hydration_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "hydration_logs_delete_own" on public.hydration_logs for delete using (auth.uid() = user_id);

drop policy if exists "body_metrics_select_own" on public.body_metrics;
drop policy if exists "body_metrics_insert_own" on public.body_metrics;
drop policy if exists "body_metrics_update_own" on public.body_metrics;
drop policy if exists "body_metrics_delete_own" on public.body_metrics;
create policy "body_metrics_select_own" on public.body_metrics for select using (auth.uid() = user_id);
create policy "body_metrics_insert_own" on public.body_metrics for insert with check (auth.uid() = user_id);
create policy "body_metrics_update_own" on public.body_metrics for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "body_metrics_delete_own" on public.body_metrics for delete using (auth.uid() = user_id);

drop policy if exists "supplement_protocols_select_own" on public.supplement_protocols;
drop policy if exists "supplement_protocols_insert_own" on public.supplement_protocols;
drop policy if exists "supplement_protocols_update_own" on public.supplement_protocols;
drop policy if exists "supplement_protocols_delete_own" on public.supplement_protocols;
create policy "supplement_protocols_select_own" on public.supplement_protocols for select using (auth.uid() = user_id);
create policy "supplement_protocols_insert_own" on public.supplement_protocols for insert with check (auth.uid() = user_id);
create policy "supplement_protocols_update_own" on public.supplement_protocols for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "supplement_protocols_delete_own" on public.supplement_protocols for delete using (auth.uid() = user_id);

drop policy if exists "ai_conversations_select_own" on public.ai_conversations;
drop policy if exists "ai_conversations_insert_own" on public.ai_conversations;
drop policy if exists "ai_conversations_update_own" on public.ai_conversations;
drop policy if exists "ai_conversations_delete_own" on public.ai_conversations;
create policy "ai_conversations_select_own" on public.ai_conversations for select using (auth.uid() = user_id);
create policy "ai_conversations_insert_own" on public.ai_conversations for insert with check (auth.uid() = user_id);
create policy "ai_conversations_update_own" on public.ai_conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_conversations_delete_own" on public.ai_conversations for delete using (auth.uid() = user_id);

drop policy if exists "ai_messages_select_own" on public.ai_messages;
drop policy if exists "ai_messages_insert_own" on public.ai_messages;
drop policy if exists "ai_messages_update_own" on public.ai_messages;
drop policy if exists "ai_messages_delete_own" on public.ai_messages;
create policy "ai_messages_select_own" on public.ai_messages for select using (
  auth.uid() = user_id
  and exists (
    select 1 from public.ai_conversations ac
    where ac.id = conversation_id and ac.user_id = auth.uid()
  )
);
create policy "ai_messages_insert_own" on public.ai_messages for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.ai_conversations ac
    where ac.id = conversation_id and ac.user_id = auth.uid()
  )
);
create policy "ai_messages_update_own" on public.ai_messages for update using (
  auth.uid() = user_id
  and exists (
    select 1 from public.ai_conversations ac
    where ac.id = conversation_id and ac.user_id = auth.uid()
  )
) with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.ai_conversations ac
    where ac.id = conversation_id and ac.user_id = auth.uid()
  )
);
create policy "ai_messages_delete_own" on public.ai_messages for delete using (
  auth.uid() = user_id
  and exists (
    select 1 from public.ai_conversations ac
    where ac.id = conversation_id and ac.user_id = auth.uid()
  )
);

drop policy if exists "ai_context_logs_select_own" on public.ai_context_logs;
drop policy if exists "ai_context_logs_insert_own" on public.ai_context_logs;
drop policy if exists "ai_context_logs_update_own" on public.ai_context_logs;
drop policy if exists "ai_context_logs_delete_own" on public.ai_context_logs;
create policy "ai_context_logs_select_own" on public.ai_context_logs for select using (auth.uid() = user_id);
create policy "ai_context_logs_insert_own" on public.ai_context_logs for insert with check (auth.uid() = user_id);
create policy "ai_context_logs_update_own" on public.ai_context_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_context_logs_delete_own" on public.ai_context_logs for delete using (auth.uid() = user_id);

drop policy if exists "knowledge_sources_read_authenticated" on public.nutrition_knowledge_sources;
drop policy if exists "knowledge_documents_read_authenticated" on public.nutrition_knowledge_documents;
drop policy if exists "knowledge_chunks_read_authenticated" on public.nutrition_knowledge_chunks;
create policy "knowledge_sources_read_authenticated" on public.nutrition_knowledge_sources
for select using (auth.role() = 'authenticated');
create policy "knowledge_documents_read_authenticated" on public.nutrition_knowledge_documents
for select using (auth.role() = 'authenticated');
create policy "knowledge_chunks_read_authenticated" on public.nutrition_knowledge_chunks
for select using (auth.role() = 'authenticated');

drop policy if exists "knowledge_sources_write_service_role" on public.nutrition_knowledge_sources;
drop policy if exists "knowledge_documents_write_service_role" on public.nutrition_knowledge_documents;
drop policy if exists "knowledge_chunks_write_service_role" on public.nutrition_knowledge_chunks;
create policy "knowledge_sources_write_service_role" on public.nutrition_knowledge_sources
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "knowledge_documents_write_service_role" on public.nutrition_knowledge_documents
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "knowledge_chunks_write_service_role" on public.nutrition_knowledge_chunks
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
