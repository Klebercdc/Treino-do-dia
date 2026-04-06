alter table if exists public.exercises
  add column if not exists source text,
  add column if not exists normalized_lookup_key text,
  add column if not exists media_thumbnail_url text,
  add column if not exists media_confidence_score numeric default 0,
  add column if not exists content_source text,
  add column if not exists last_enriched_at timestamptz,
  add column if not exists quality_flags jsonb default '[]'::jsonb,
  add column if not exists common_errors jsonb default '[]'::jsonb,
  add column if not exists breathing_tip text,
  add column if not exists range_of_motion text,
  add column if not exists image_url text;

update public.exercises
set
  source = coalesce(nullif(source, ''), 'ExerciseDB'),
  normalized_lookup_key = coalesce(
    nullif(normalized_lookup_key, ''),
    regexp_replace(
      lower(trim(regexp_replace(coalesce(name_en, name_pt, name, slug, 'exercise'), '[^[:alnum:][:space:]]+', ' ', 'g'))),
      '\s+',
      '_',
      'g'
    )
  ),
  media_thumbnail_url = coalesce(nullif(media_thumbnail_url, ''), nullif(thumbnail_url, ''), nullif(gif_url, '')),
  media_confidence_score = coalesce(media_confidence_score, case when media_type = 'video' and media_url is not null then 0.8 when gif_url is not null then 0.45 else 0.15 end),
  content_source = coalesce(nullif(content_source, ''), 'catalog'),
  quality_flags = coalesce(quality_flags, '[]'::jsonb),
  common_errors = coalesce(common_errors, '[]'::jsonb)
where true;

create index if not exists idx_exercises_normalized_lookup_key_live on public.exercises(normalized_lookup_key);
