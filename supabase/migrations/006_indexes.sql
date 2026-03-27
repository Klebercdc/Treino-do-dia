create index if not exists idx_nutrition_goals_user_id on public.nutrition_goals(user_id);
create index if not exists idx_nutrition_goals_active on public.nutrition_goals(active);
create index if not exists idx_nutrition_goals_user_active_created on public.nutrition_goals(user_id, active, created_at desc);

create index if not exists idx_meal_plans_user_id on public.meal_plans(user_id);
create index if not exists idx_meal_plans_active on public.meal_plans(active);
create index if not exists idx_meal_plans_status on public.meal_plans(status);
create index if not exists idx_meal_plans_user_active_dates on public.meal_plans(user_id, active, valid_from desc, valid_to desc);

create index if not exists idx_meal_plan_items_meal_plan_id on public.meal_plan_items(meal_plan_id);
create index if not exists idx_meal_plan_items_sort on public.meal_plan_items(meal_plan_id, sort_order);

create index if not exists idx_user_food_logs_user_id on public.user_food_logs(user_id);
create index if not exists idx_user_food_logs_created_at on public.user_food_logs(created_at desc);
create index if not exists idx_user_food_logs_user_consumed on public.user_food_logs(user_id, consumed_at desc);

create index if not exists idx_hydration_logs_user_id on public.hydration_logs(user_id);
create index if not exists idx_hydration_logs_user_consumed on public.hydration_logs(user_id, consumed_at desc);

create index if not exists idx_body_metrics_user_id on public.body_metrics(user_id);
create index if not exists idx_body_metrics_user_measured on public.body_metrics(user_id, measured_at desc);

create index if not exists idx_supplement_protocols_user_id on public.supplement_protocols(user_id);
create index if not exists idx_supplement_protocols_active on public.supplement_protocols(active);
create index if not exists idx_supplement_protocols_user_active on public.supplement_protocols(user_id, active);

create index if not exists idx_ai_conversations_user_id on public.ai_conversations(user_id);
create index if not exists idx_ai_conversations_created_at on public.ai_conversations(created_at desc);

create index if not exists idx_ai_messages_user_id on public.ai_messages(user_id);
create index if not exists idx_ai_messages_conversation_id on public.ai_messages(conversation_id);
create index if not exists idx_ai_messages_conversation_created on public.ai_messages(conversation_id, created_at desc);

create index if not exists idx_ai_context_logs_user_id on public.ai_context_logs(user_id);
create index if not exists idx_ai_context_logs_conversation_id on public.ai_context_logs(conversation_id);
create index if not exists idx_ai_context_logs_created_at on public.ai_context_logs(created_at desc);

create index if not exists idx_nutrition_knowledge_documents_source_id on public.nutrition_knowledge_documents(source_id);
create index if not exists idx_nutrition_knowledge_sources_status on public.nutrition_knowledge_sources(status);
create index if not exists idx_nutrition_knowledge_sources_category on public.nutrition_knowledge_sources(category);
create index if not exists idx_nutrition_knowledge_sources_tags on public.nutrition_knowledge_sources using gin(tags);

create index if not exists idx_nutrition_knowledge_chunks_document_id on public.nutrition_knowledge_chunks(document_id);
create index if not exists idx_nutrition_knowledge_chunks_source_id on public.nutrition_knowledge_chunks(source_id);
create index if not exists idx_nutrition_knowledge_chunks_category on public.nutrition_knowledge_chunks(category);
create index if not exists idx_nutrition_knowledge_chunks_tags on public.nutrition_knowledge_chunks using gin(tags);
create index if not exists idx_nutrition_knowledge_chunks_metadata on public.nutrition_knowledge_chunks using gin(metadata);
create index if not exists idx_nutrition_knowledge_chunks_embedding on public.nutrition_knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
