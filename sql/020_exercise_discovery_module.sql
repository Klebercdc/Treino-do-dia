-- KRONIA - Exercise Discovery Module (Supabase)
-- Ready to run in Supabase SQL Editor

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.exercise_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt',
  alias_type TEXT NOT NULL DEFAULT 'synonym',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exercise_aliases_language_check CHECK (language IN ('pt', 'en')),
  CONSTRAINT exercise_aliases_alias_type_check CHECK (alias_type IN ('name', 'synonym', 'typo', 'machine'))
);

CREATE TABLE IF NOT EXISTS public.exercise_media_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_media_id TEXT,
  media_type TEXT NOT NULL DEFAULT 'video',
  video_url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  search_query TEXT,
  verified_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exercise_media_cache_provider_check CHECK (provider IN ('pexels', 'internal', 'exercisedb')),
  CONSTRAINT exercise_media_cache_media_type_check CHECK (media_type IN ('video', 'gif', 'image')),
  CONSTRAINT exercise_media_cache_score_check CHECK (verified_score >= 0 AND verified_score <= 1)
);

CREATE TABLE IF NOT EXISTS public.exercise_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query_original TEXT NOT NULL,
  normalized_query TEXT,
  detected_intent TEXT,
  matched_exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  media_provider TEXT,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS name_pt TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS body_part TEXT,
  ADD COLUMN IF NOT EXISTS target_muscle TEXT,
  ADD COLUMN IF NOT EXISTS secondary_muscles JSONB,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS instructions JSONB,
  ADD COLUMN IF NOT EXISTS gif_url TEXT,
  ADD COLUMN IF NOT EXISTS search_terms JSONB,
  ADD COLUMN IF NOT EXISTS difficulty TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'exercises'
      AND column_name = 'instructions'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.exercises
      ALTER COLUMN instructions TYPE JSONB
      USING to_jsonb(instructions);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'exercises'
      AND column_name = 'secondary_muscles'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.exercises
      ALTER COLUMN secondary_muscles TYPE JSONB
      USING to_jsonb(secondary_muscles);
  END IF;
END $$;

UPDATE public.exercises
SET
  name_en = COALESCE(name_en, name, 'Exercise'),
  name_pt = COALESCE(name_pt, name_en, name, 'Exercício'),
  target_muscle = COALESCE(target_muscle, muscle_group),
  instructions = COALESCE(instructions, '[]'::jsonb),
  secondary_muscles = COALESCE(secondary_muscles, '[]'::jsonb),
  search_terms = COALESCE(search_terms, '[]'::jsonb),
  updated_at = NOW();

ALTER TABLE public.exercises
  ALTER COLUMN instructions SET DEFAULT '[]'::jsonb,
  ALTER COLUMN secondary_muscles SET DEFAULT '[]'::jsonb,
  ALTER COLUMN search_terms SET DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.set_exercise_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := lower(
      trim(both '-' from regexp_replace(
        COALESCE(NEW.name_en, NEW.name, NEW.name_pt, 'exercise'),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      ))
    );
  END IF;

  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := 'exercise-' || gen_random_uuid()::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exercises_set_slug ON public.exercises;
CREATE TRIGGER trg_exercises_set_slug
BEFORE INSERT OR UPDATE ON public.exercises
FOR EACH ROW
EXECUTE PROCEDURE public.set_exercise_slug();

UPDATE public.exercises
SET slug = lower(
  trim(both '-' from regexp_replace(
    COALESCE(name_en, name, name_pt, 'exercise'),
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  ))
)
WHERE slug IS NULL OR btrim(slug) = '';

UPDATE public.exercises
SET slug = 'exercise-' || id::text
WHERE slug IS NULL OR btrim(slug) = '';

ALTER TABLE public.exercises
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN name_pt SET NOT NULL,
  ALTER COLUMN name_en SET NOT NULL,
  ALTER COLUMN secondary_muscles SET NOT NULL,
  ALTER COLUMN instructions SET NOT NULL,
  ALTER COLUMN search_terms SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exercises_slug_key'
      AND conrelid = 'public.exercises'::regclass
  ) THEN
    ALTER TABLE public.exercises
      ADD CONSTRAINT exercises_slug_key UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exercises_source_id ON public.exercises(source_id);
CREATE INDEX IF NOT EXISTS idx_exercises_name_pt ON public.exercises USING GIN (to_tsvector('simple', coalesce(name_pt, '')));
CREATE INDEX IF NOT EXISTS idx_exercises_name_en ON public.exercises USING GIN (to_tsvector('simple', coalesce(name_en, '')));
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON public.exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_target_muscle ON public.exercises(target_muscle);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_aliases_unique ON public.exercise_aliases(exercise_id, alias, language);
CREATE INDEX IF NOT EXISTS idx_exercise_aliases_alias ON public.exercise_aliases(alias);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_media_cache_provider_media_id
  ON public.exercise_media_cache(provider, provider_media_id)
  WHERE provider_media_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercise_media_cache_exercise_id ON public.exercise_media_cache(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_media_cache_provider_media_id_only ON public.exercise_media_cache(provider_media_id);

CREATE INDEX IF NOT EXISTS idx_exercise_search_logs_exercise_id ON public.exercise_search_logs(matched_exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_search_logs_user_created ON public.exercise_search_logs(user_id, created_at DESC);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_media_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_search_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "exercises_select_authenticated"
  ON public.exercises
  FOR SELECT
  TO authenticated
  USING (is_active = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "exercises_write_service_role"
  ON public.exercises
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "exercise_aliases_select_authenticated"
  ON public.exercise_aliases
  FOR SELECT
  TO authenticated
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "exercise_aliases_write_service_role"
  ON public.exercise_aliases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "exercise_media_cache_select_authenticated"
  ON public.exercise_media_cache
  FOR SELECT
  TO authenticated
  USING (approved = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "exercise_media_cache_write_service_role"
  ON public.exercise_media_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "exercise_search_logs_select_own"
  ON public.exercise_search_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "exercise_search_logs_write_service_role"
  ON public.exercise_search_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exercises_updated_at ON public.exercises;
CREATE TRIGGER trg_exercises_updated_at
BEFORE UPDATE ON public.exercises
FOR EACH ROW
EXECUTE PROCEDURE public.set_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_exercise_aliases_updated_at ON public.exercise_aliases;
CREATE TRIGGER trg_exercise_aliases_updated_at
BEFORE UPDATE ON public.exercise_aliases
FOR EACH ROW
EXECUTE PROCEDURE public.set_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_exercise_media_cache_updated_at ON public.exercise_media_cache;
CREATE TRIGGER trg_exercise_media_cache_updated_at
BEFORE UPDATE ON public.exercise_media_cache
FOR EACH ROW
EXECUTE PROCEDURE public.set_timestamp_updated_at();

DROP FUNCTION IF EXISTS public.search_exercises(TEXT);

CREATE FUNCTION public.search_exercises(query TEXT)
RETURNS TABLE (
  exercise_id UUID,
  slug TEXT,
  name TEXT
)
LANGUAGE sql
AS $$
  SELECT DISTINCT ON (e.id)
    e.id,
    e.slug,
    e.name
  FROM public.exercises e
  LEFT JOIN public.exercise_aliases ea
    ON ea.exercise_id = e.id
  WHERE
    ea.alias ILIKE '%' || query || '%'
    OR e.name ILIKE '%' || query || '%'
    OR e.name_pt ILIKE '%' || query || '%'
    OR e.name_en ILIKE '%' || query || '%'
  ORDER BY e.id;
$$;

COMMIT;
