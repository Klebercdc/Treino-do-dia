-- Tabelas necessárias para o agente KRONOS
-- fadiga_scores: score de fadiga registrado manualmente ou pelo app após sessão
-- alertas_kronos: alertas clínicos gerados pelo agente (overtraining, plateau, etc.)

create table if not exists public.fadiga_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score numeric(4,1) not null check (score >= 0 and score <= 10),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fadiga_scores_user_created on public.fadiga_scores(user_id, created_at desc);

alter table public.fadiga_scores enable row level security;

drop policy if exists "fadiga_scores_select_own" on public.fadiga_scores;
create policy "fadiga_scores_select_own" on public.fadiga_scores
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "fadiga_scores_insert_own" on public.fadiga_scores;
create policy "fadiga_scores_insert_own" on public.fadiga_scores
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "fadiga_scores_delete_own" on public.fadiga_scores;
create policy "fadiga_scores_delete_own" on public.fadiga_scores
  for delete to authenticated using (auth.uid() = user_id);


create table if not exists public.alertas_kronos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('overtraining', 'plateau', 'deficit_proteico')),
  mensagem text not null,
  lido boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_alertas_kronos_user on public.alertas_kronos(user_id, created_at desc);

alter table public.alertas_kronos enable row level security;

drop policy if exists "alertas_kronos_select_own" on public.alertas_kronos;
create policy "alertas_kronos_select_own" on public.alertas_kronos
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "alertas_kronos_update_own" on public.alertas_kronos;
create policy "alertas_kronos_update_own" on public.alertas_kronos
  for update to authenticated using (auth.uid() = user_id);

-- Service role pode inserir alertas gerados pelo agente
drop policy if exists "alertas_kronos_insert_service" on public.alertas_kronos;
create policy "alertas_kronos_insert_service" on public.alertas_kronos
  for insert to service_role with check (true);
