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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exercise_aliases'
  ) THEN
    ALTER TABLE public.exercise_aliases
      ADD COLUMN IF NOT EXISTS alias_key TEXT,
      ADD COLUMN IF NOT EXISTS canonical_lookup_key TEXT,
      ADD COLUMN IF NOT EXISTS locale TEXT;

    UPDATE public.exercise_aliases
    SET
      alias_key = COALESCE(NULLIF(alias_key, ''), lower(regexp_replace(coalesce(alias, ''), '[^a-zA-Z0-9]+', '_', 'g'))),
      canonical_lookup_key = COALESCE(NULLIF(canonical_lookup_key, ''), NULLIF((SELECT normalized_lookup_key FROM public.exercises e WHERE e.id = exercise_aliases.exercise_id), '')),
      locale = COALESCE(NULLIF(locale, ''), CASE WHEN language = 'pt' THEN 'pt_BR' WHEN language = 'en' THEN 'en_US' ELSE 'pt_BR' END)
    WHERE
      alias_key IS NULL OR alias_key = ''
      OR canonical_lookup_key IS NULL OR canonical_lookup_key = ''
      OR locale IS NULL OR locale = '';

    WITH alias_rank AS (
      SELECT id, alias_key, ROW_NUMBER() OVER (PARTITION BY alias_key ORDER BY created_at, id) AS rn
      FROM public.exercise_aliases
      WHERE alias_key IS NOT NULL AND alias_key <> ''
    )
    UPDATE public.exercise_aliases a
    SET alias_key = a.alias_key || '_' || (alias_rank.rn - 1)::text
    FROM alias_rank
    WHERE a.id = alias_rank.id AND alias_rank.rn > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_aliases_alias_key_unique ON public.exercise_aliases(alias_key);
  END IF;
END $$;

COMMIT;
