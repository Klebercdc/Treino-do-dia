BEGIN;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS completeness_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_confidence_score NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_exercises_completeness_score ON public.exercises (completeness_score);
CREATE INDEX IF NOT EXISTS idx_exercises_media_confidence_score ON public.exercises (media_confidence_score);

UPDATE public.exercises
SET
  completeness_score = COALESCE(completeness_score, 0),
  media_confidence_score = COALESCE(media_confidence_score, 0)
WHERE completeness_score IS NULL OR media_confidence_score IS NULL;

COMMIT;
