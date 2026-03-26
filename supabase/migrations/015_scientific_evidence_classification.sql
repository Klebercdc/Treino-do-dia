-- KRONIA — Migração 015: classificação científica e ranking de evidências

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.scientific_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  abstract TEXT,
  source TEXT NOT NULL,
  pmid TEXT,
  doi TEXT,
  journal TEXT,
  publisher TEXT,
  published_at TIMESTAMPTZ,
  classification TEXT,
  evidence_score NUMERIC(5,4),
  confidence_label TEXT,
  classification_reason TEXT,
  raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scientific_articles_source_chk CHECK (source IN ('pubmed', 'crossref')),
  CONSTRAINT scientific_articles_evidence_score_chk CHECK (evidence_score IS NULL OR (evidence_score >= 0 AND evidence_score <= 1)),
  CONSTRAINT scientific_articles_confidence_label_chk CHECK (confidence_label IS NULL OR confidence_label IN ('low', 'medium', 'high'))
);

ALTER TABLE public.scientific_articles
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS abstract TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS pmid TEXT,
  ADD COLUMN IF NOT EXISTS doi TEXT,
  ADD COLUMN IF NOT EXISTS journal TEXT,
  ADD COLUMN IF NOT EXISTS publisher TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS classification TEXT,
  ADD COLUMN IF NOT EXISTS evidence_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS confidence_label TEXT,
  ADD COLUMN IF NOT EXISTS classification_reason TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload_json JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.scientific_articles
  ALTER COLUMN raw_payload_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now();

UPDATE public.scientific_articles
SET raw_payload_json = '{}'::jsonb
WHERE raw_payload_json IS NULL;

UPDATE public.scientific_articles
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.scientific_articles
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN raw_payload_json SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.scientific_articles
  DROP CONSTRAINT IF EXISTS scientific_articles_source_chk,
  ADD CONSTRAINT scientific_articles_source_chk CHECK (source IN ('pubmed', 'crossref')),
  DROP CONSTRAINT IF EXISTS scientific_articles_evidence_score_chk,
  ADD CONSTRAINT scientific_articles_evidence_score_chk CHECK (evidence_score IS NULL OR (evidence_score >= 0 AND evidence_score <= 1)),
  DROP CONSTRAINT IF EXISTS scientific_articles_confidence_label_chk,
  ADD CONSTRAINT scientific_articles_confidence_label_chk CHECK (confidence_label IS NULL OR confidence_label IN ('low', 'medium', 'high'));

CREATE TABLE IF NOT EXISTS public.scientific_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scientific_topics_status_chk CHECK (status IN ('active', 'inactive', 'archived'))
);

ALTER TABLE public.scientific_topics
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS keywords TEXT[],
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.scientific_topics
  ALTER COLUMN keywords SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN created_at SET DEFAULT now();

UPDATE public.scientific_topics
SET keywords = ARRAY[]::TEXT[]
WHERE keywords IS NULL;

UPDATE public.scientific_topics
SET status = 'active'
WHERE status IS NULL;

UPDATE public.scientific_topics
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.scientific_topics
  ALTER COLUMN topic SET NOT NULL,
  ALTER COLUMN keywords SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.scientific_topics
  DROP CONSTRAINT IF EXISTS scientific_topics_status_chk,
  ADD CONSTRAINT scientific_topics_status_chk CHECK (status IN ('active', 'inactive', 'archived'));

CREATE TABLE IF NOT EXISTS public.scientific_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL,
  article_id UUID NOT NULL,
  relevance_score NUMERIC(5,4) NOT NULL,
  summary TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  recency_score NUMERIC(5,4),
  ai_rank_score NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scientific_evidence_topic_fk FOREIGN KEY (topic_id) REFERENCES public.scientific_topics(id) ON DELETE CASCADE,
  CONSTRAINT scientific_evidence_article_fk FOREIGN KEY (article_id) REFERENCES public.scientific_articles(id) ON DELETE CASCADE,
  CONSTRAINT scientific_evidence_unique_topic_article UNIQUE (topic_id, article_id),
  CONSTRAINT scientific_evidence_relevance_score_chk CHECK (relevance_score >= 0 AND relevance_score <= 1),
  CONSTRAINT scientific_evidence_recency_score_chk CHECK (recency_score IS NULL OR (recency_score >= 0 AND recency_score <= 1)),
  CONSTRAINT scientific_evidence_ai_rank_score_chk CHECK (ai_rank_score IS NULL OR (ai_rank_score >= 0 AND ai_rank_score <= 1))
);

ALTER TABLE public.scientific_evidence
  ADD COLUMN IF NOT EXISTS topic_id UUID,
  ADD COLUMN IF NOT EXISTS article_id UUID,
  ADD COLUMN IF NOT EXISTS relevance_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN,
  ADD COLUMN IF NOT EXISTS recency_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS ai_rank_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.scientific_evidence
  ALTER COLUMN needs_review SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now();

UPDATE public.scientific_evidence
SET needs_review = false
WHERE needs_review IS NULL;

UPDATE public.scientific_evidence
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.scientific_evidence
  ALTER COLUMN topic_id SET NOT NULL,
  ALTER COLUMN article_id SET NOT NULL,
  ALTER COLUMN relevance_score SET NOT NULL,
  ALTER COLUMN needs_review SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.scientific_evidence
  DROP CONSTRAINT IF EXISTS scientific_evidence_topic_fk,
  ADD CONSTRAINT scientific_evidence_topic_fk FOREIGN KEY (topic_id) REFERENCES public.scientific_topics(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS scientific_evidence_article_fk,
  ADD CONSTRAINT scientific_evidence_article_fk FOREIGN KEY (article_id) REFERENCES public.scientific_articles(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS scientific_evidence_unique_topic_article,
  ADD CONSTRAINT scientific_evidence_unique_topic_article UNIQUE (topic_id, article_id),
  DROP CONSTRAINT IF EXISTS scientific_evidence_relevance_score_chk,
  ADD CONSTRAINT scientific_evidence_relevance_score_chk CHECK (relevance_score >= 0 AND relevance_score <= 1),
  DROP CONSTRAINT IF EXISTS scientific_evidence_recency_score_chk,
  ADD CONSTRAINT scientific_evidence_recency_score_chk CHECK (recency_score IS NULL OR (recency_score >= 0 AND recency_score <= 1)),
  DROP CONSTRAINT IF EXISTS scientific_evidence_ai_rank_score_chk,
  ADD CONSTRAINT scientific_evidence_ai_rank_score_chk CHECK (ai_rank_score IS NULL OR (ai_rank_score >= 0 AND ai_rank_score <= 1));

CREATE UNIQUE INDEX IF NOT EXISTS ux_scientific_articles_pmid
  ON public.scientific_articles (pmid)
  WHERE pmid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_scientific_articles_doi
  ON public.scientific_articles (doi)
  WHERE doi IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_scientific_articles_source_published_at
  ON public.scientific_articles (source, published_at DESC);

CREATE INDEX IF NOT EXISTS ix_scientific_articles_classification
  ON public.scientific_articles (classification);

CREATE INDEX IF NOT EXISTS ix_scientific_topics_topic
  ON public.scientific_topics (topic);

CREATE INDEX IF NOT EXISTS ix_scientific_topics_status
  ON public.scientific_topics (status);

CREATE INDEX IF NOT EXISTS ix_scientific_topics_keywords
  ON public.scientific_topics USING GIN (keywords);

CREATE INDEX IF NOT EXISTS ix_scientific_evidence_topic_created_at
  ON public.scientific_evidence (topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_scientific_evidence_article_created_at
  ON public.scientific_evidence (article_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_scientific_evidence_needs_review
  ON public.scientific_evidence (needs_review, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_scientific_evidence_ai_rank
  ON public.scientific_evidence (ai_rank_score DESC NULLS LAST);
