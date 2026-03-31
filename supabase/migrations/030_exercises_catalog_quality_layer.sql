BEGIN;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS completeness_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_confidence_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_source TEXT,
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_exercises_completeness_score ON public.exercises (completeness_score);
CREATE INDEX IF NOT EXISTS idx_exercises_media_confidence_score ON public.exercises (media_confidence_score);
CREATE INDEX IF NOT EXISTS idx_exercises_last_enriched_at ON public.exercises (last_enriched_at);

UPDATE public.exercises
SET
  completeness_score = COALESCE(completeness_score, 0),
  media_confidence_score = COALESCE(media_confidence_score, 0),
  quality_flags = COALESCE(quality_flags, '[]'::jsonb)
WHERE completeness_score IS NULL
   OR media_confidence_score IS NULL
   OR quality_flags IS NULL;

COMMIT;
