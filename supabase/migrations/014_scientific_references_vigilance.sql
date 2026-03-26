-- KRONIA — Migração 014: base científica com vigilância controlada

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.scientific_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  pmid TEXT,
  doi TEXT,
  title TEXT NOT NULL,
  abstract TEXT,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  journal TEXT,
  publisher TEXT,
  published_at TIMESTAMPTZ,
  raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scientific_articles_source_chk CHECK (source IN ('pubmed', 'crossref'))
);

CREATE TABLE IF NOT EXISTS public.scientific_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);

CREATE TABLE IF NOT EXISTS public.scientific_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL,
  article_id UUID NOT NULL,
  relevance_score NUMERIC NOT NULL,
  summary TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scientific_evidence_topic_fk FOREIGN KEY (topic_id) REFERENCES public.scientific_topics(id) ON DELETE CASCADE,
  CONSTRAINT scientific_evidence_article_fk FOREIGN KEY (article_id) REFERENCES public.scientific_articles(id) ON DELETE CASCADE,
  CONSTRAINT scientific_evidence_unique_topic_article UNIQUE (topic_id, article_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_scientific_articles_pmid
  ON public.scientific_articles (pmid)
  WHERE pmid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_scientific_articles_doi
  ON public.scientific_articles (doi)
  WHERE doi IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_scientific_articles_source_published_at
  ON public.scientific_articles (source, published_at DESC);

CREATE INDEX IF NOT EXISTS ix_scientific_topics_topic
  ON public.scientific_topics (topic);

CREATE INDEX IF NOT EXISTS ix_scientific_topics_keywords
  ON public.scientific_topics USING GIN (keywords);

CREATE INDEX IF NOT EXISTS ix_scientific_evidence_topic_created_at
  ON public.scientific_evidence (topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_scientific_evidence_needs_review
  ON public.scientific_evidence (needs_review, created_at DESC);
