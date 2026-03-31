BEGIN;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_pt TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS normalized_lookup_key TEXT,
  ADD COLUMN IF NOT EXISTS body_part TEXT,
  ADD COLUMN IF NOT EXISTS target_muscle TEXT,
  ADD COLUMN IF NOT EXISTS secondary_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment TEXT,
  ADD COLUMN IF NOT EXISTS instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS common_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS breathing_tip TEXT,
  ADD COLUMN IF NOT EXISTS range_of_motion TEXT,
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT,
  ADD COLUMN IF NOT EXISTS media_provider TEXT,
  ADD COLUMN IF NOT EXISTS youtube_fallback_url TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.exercises
SET
  name_en = COALESCE(NULLIF(name_en, ''), NULLIF(name, ''), NULLIF(name_pt, ''), 'Exercise'),
  name_pt = COALESCE(NULLIF(name_pt, ''), NULLIF(name_en, ''), NULLIF(name, ''), 'Exercício'),
  name = COALESCE(NULLIF(name, ''), NULLIF(name_en, ''), NULLIF(name_pt, ''), 'Exercise'),
  slug = COALESCE(NULLIF(slug, ''), lower(trim(both '-' from regexp_replace(COALESCE(name_en, name, name_pt, 'exercise'), '[^a-zA-Z0-9]+', '-', 'g')))),
  normalized_lookup_key = COALESCE(NULLIF(normalized_lookup_key, ''), regexp_replace(lower(trim(regexp_replace(COALESCE(name_en, name_pt, name, slug, 'exercise'), '[^[:alnum:][:space:]]+', ' ', 'g'))), '\\s+', '_', 'g')),
  source = COALESCE(NULLIF(source, ''), 'exercisedb'),
  updated_at = NOW()
WHERE
  name_en IS NULL OR name_en = ''
  OR name_pt IS NULL OR name_pt = ''
  OR name IS NULL OR name = ''
  OR slug IS NULL OR slug = ''
  OR normalized_lookup_key IS NULL OR normalized_lookup_key = ''
  OR source IS NULL OR source = '';

CREATE INDEX IF NOT EXISTS idx_exercises_normalized_lookup_key ON public.exercises(normalized_lookup_key);
CREATE INDEX IF NOT EXISTS idx_exercises_slug ON public.exercises(slug);

COMMIT;
