alter table public.user_profiles enable row level security;
alter table public.assistant_logs enable row level security;
alter table public.generated_plans enable row level security;
alter table public.user_memory enable row level security;
alter table public.conversation_summaries enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "generated_plans_select_own" on public.generated_plans;
create policy "generated_plans_select_own"
on public.generated_plans
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "generated_plans_insert_own" on public.generated_plans;
create policy "generated_plans_insert_own"
on public.generated_plans
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "generated_plans_update_own" on public.generated_plans;
create policy "generated_plans_update_own"
on public.generated_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "generated_plans_delete_own" on public.generated_plans;
create policy "generated_plans_delete_own"
on public.generated_plans
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "assistant_logs_select_own" on public.assistant_logs;
create policy "assistant_logs_select_own"
on public.assistant_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "assistant_logs_insert_own" on public.assistant_logs;
create policy "assistant_logs_insert_own"
on public.assistant_logs
for insert
to authenticated
with check (auth.uid() = user_id or user_id is null);

drop policy if exists "assistant_logs_update_own" on public.assistant_logs;
create policy "assistant_logs_update_own"
on public.assistant_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "assistant_logs_delete_own" on public.assistant_logs;
create policy "assistant_logs_delete_own"
on public.assistant_logs
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_memory_select_own" on public.user_memory;
create policy "user_memory_select_own"
on public.user_memory
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_memory_insert_own" on public.user_memory;
create policy "user_memory_insert_own"
on public.user_memory
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_memory_update_own" on public.user_memory;
create policy "user_memory_update_own"
on public.user_memory
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_memory_delete_own" on public.user_memory;
create policy "user_memory_delete_own"
on public.user_memory
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "conversation_summaries_select_own" on public.conversation_summaries;
create policy "conversation_summaries_select_own"
on public.conversation_summaries
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "conversation_summaries_insert_own" on public.conversation_summaries;
create policy "conversation_summaries_insert_own"
on public.conversation_summaries
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "conversation_summaries_update_own" on public.conversation_summaries;
create policy "conversation_summaries_update_own"
on public.conversation_summaries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "conversation_summaries_delete_own" on public.conversation_summaries;
create policy "conversation_summaries_delete_own"
on public.conversation_summaries
for delete
to authenticated
using (auth.uid() = user_id);
