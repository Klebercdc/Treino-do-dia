BEGIN;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS normalized_lookup_key TEXT,
  ADD COLUMN IF NOT EXISTS common_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS breathing_tip TEXT,
  ADD COLUMN IF NOT EXISTS range_of_motion TEXT,
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT,
  ADD COLUMN IF NOT EXISTS media_provider TEXT,
  ADD COLUMN IF NOT EXISTS youtube_fallback_url TEXT;

UPDATE public.exercises
SET normalized_lookup_key = lower(
  trim(both '-' from regexp_replace(
    coalesce(slug, name_en, name_pt, name, 'exercise'),
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  ))
)
WHERE normalized_lookup_key IS NULL OR btrim(normalized_lookup_key) = '';

CREATE INDEX IF NOT EXISTS idx_exercises_normalized_lookup_key
  ON public.exercises(normalized_lookup_key);

COMMIT;
