alter table if exists public.exercises
  add column if not exists content_source text,
  add column if not exists last_enriched_at timestamptz,
  add column if not exists quality_flags jsonb default '[]'::jsonb;

create index if not exists idx_exercises_completeness_score
  on public.exercises (completeness_score);

create index if not exists idx_exercises_media_confidence_score
  on public.exercises (media_confidence_score);

create index if not exists idx_exercises_last_enriched_at
  on public.exercises (last_enriched_at);
