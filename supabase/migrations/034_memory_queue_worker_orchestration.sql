-- KRONIA 034 - Fila assíncrona real para memória evolutiva (jobs idempotentes + worker-safe)

-- 1) Expande modelagem de jobs para histórico e lock robusto
ALTER TABLE public.user_memory_recompute_jobs
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_token TEXT,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_memory_recompute_jobs'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'user_memory_recompute_jobs_pkey'
  ) THEN
    ALTER TABLE public.user_memory_recompute_jobs DROP CONSTRAINT user_memory_recompute_jobs_pkey;
  END IF;
END $$;

UPDATE public.user_memory_recompute_jobs
SET id = COALESCE(id, gen_random_uuid())
WHERE id IS NULL;

ALTER TABLE public.user_memory_recompute_jobs
  ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_memory_recompute_jobs'
      AND constraint_name = 'user_memory_recompute_jobs_pkey'
  ) THEN
    ALTER TABLE public.user_memory_recompute_jobs
      ADD CONSTRAINT user_memory_recompute_jobs_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE public.user_memory_recompute_jobs
  ALTER COLUMN status SET DEFAULT 'queued';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_memory_recompute_jobs_status_check'
  ) THEN
    ALTER TABLE public.user_memory_recompute_jobs DROP CONSTRAINT user_memory_recompute_jobs_status_check;
  END IF;
END $$;

ALTER TABLE public.user_memory_recompute_jobs
  ADD CONSTRAINT user_memory_recompute_jobs_status_check
  CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'retryable'));

CREATE INDEX IF NOT EXISTS idx_memory_recompute_jobs_claim
  ON public.user_memory_recompute_jobs (status, due_at ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_memory_recompute_jobs_user_created
  ON public.user_memory_recompute_jobs (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_recompute_jobs_pending_per_user
  ON public.user_memory_recompute_jobs (user_id)
  WHERE status IN ('queued', 'processing', 'retryable');

-- 2) RPC: enqueue idempotente (dedupe por usuário + pending)
CREATE OR REPLACE FUNCTION public.enqueue_memory_recompute_job(
  p_user_id UUID,
  p_blocks TEXT[] DEFAULT ARRAY['coaching_summary']::TEXT[],
  p_due_at TIMESTAMPTZ DEFAULT NOW(),
  p_request_id TEXT DEFAULT NULL,
  p_component TEXT DEFAULT 'memory_api',
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
  v_blocks TEXT[];
BEGIN
  v_blocks := CASE
    WHEN p_blocks IS NULL OR array_length(p_blocks, 1) IS NULL THEN ARRAY['coaching_summary']::TEXT[]
    ELSE p_blocks
  END;

  SELECT id INTO v_job_id
  FROM public.user_memory_recompute_jobs
  WHERE user_id = p_user_id
    AND status IN ('queued', 'processing', 'retryable')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_job_id IS NOT NULL THEN
    UPDATE public.user_memory_recompute_jobs
    SET
      blocks = (
        SELECT ARRAY(
          SELECT DISTINCT x
          FROM unnest(COALESCE(user_memory_recompute_jobs.blocks, ARRAY[]::TEXT[]) || v_blocks) AS t(x)
        )
      ),
      due_at = LEAST(COALESCE(due_at, NOW()), COALESCE(p_due_at, NOW())),
      latest_request_id = COALESCE(p_request_id, latest_request_id),
      latest_component = COALESCE(p_component, latest_component),
      updated_at = NOW(),
      max_attempts = GREATEST(COALESCE(max_attempts, 1), COALESCE(p_max_attempts, 1))
    WHERE id = v_job_id;

    RETURN v_job_id;
  END IF;

  INSERT INTO public.user_memory_recompute_jobs (
    id,
    user_id,
    status,
    due_at,
    blocks,
    attempts,
    max_attempts,
    latest_request_id,
    latest_component,
    updated_at,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    p_user_id,
    'queued',
    COALESCE(p_due_at, NOW()),
    v_blocks,
    0,
    COALESCE(p_max_attempts, 5),
    p_request_id,
    COALESCE(p_component, 'memory_api'),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- 3) RPC: claim atômico para worker em lote (safe multi-process)
CREATE OR REPLACE FUNCTION public.claim_memory_recompute_jobs(
  p_limit INTEGER DEFAULT 10,
  p_lock_token TEXT DEFAULT NULL,
  p_lock_timeout_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.user_memory_recompute_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 1), 1);
  v_lock_timeout INTEGER := GREATEST(COALESCE(p_lock_timeout_seconds, 300), 30);
  v_token TEXT := COALESCE(NULLIF(TRIM(p_lock_token), ''), gen_random_uuid()::TEXT);
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.user_memory_recompute_jobs
    WHERE status IN ('queued', 'retryable')
      AND due_at <= NOW()
      AND (
        locked_at IS NULL
        OR locked_at < (NOW() - make_interval(secs => v_lock_timeout))
      )
    ORDER BY due_at ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.user_memory_recompute_jobs j
  SET
    status = 'processing',
    locked_at = NOW(),
    lock_token = v_token,
    attempts = COALESCE(j.attempts, 0) + 1,
    updated_at = NOW()
  FROM candidates c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

-- 4) RPC: completar job
CREATE OR REPLACE FUNCTION public.complete_memory_recompute_job(
  p_job_id UUID,
  p_lock_token TEXT,
  p_request_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  UPDATE public.user_memory_recompute_jobs
  SET
    status = 'completed',
    locked_at = NULL,
    lock_token = NULL,
    completed_at = NOW(),
    last_completed_at = NOW(),
    last_error = NULL,
    latest_request_id = COALESCE(p_request_id, latest_request_id),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'processing'
    AND lock_token = p_lock_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 5) RPC: falhar/reagendar job
CREATE OR REPLACE FUNCTION public.fail_memory_recompute_job(
  p_job_id UUID,
  p_lock_token TEXT,
  p_error TEXT,
  p_retry_delay_seconds INTEGER DEFAULT 60,
  p_request_id TEXT DEFAULT NULL
)
RETURNS TABLE(job_id UUID, status TEXT, attempts INTEGER, max_attempts INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retry_delay INTEGER := GREATEST(COALESCE(p_retry_delay_seconds, 60), 5);
BEGIN
  RETURN QUERY
  UPDATE public.user_memory_recompute_jobs
  SET
    status = CASE
      WHEN COALESCE(attempts, 0) >= COALESCE(max_attempts, 1) THEN 'failed'
      ELSE 'retryable'
    END,
    due_at = CASE
      WHEN COALESCE(attempts, 0) >= COALESCE(max_attempts, 1) THEN due_at
      ELSE NOW() + make_interval(secs => v_retry_delay)
    END,
    completed_at = CASE
      WHEN COALESCE(attempts, 0) >= COALESCE(max_attempts, 1) THEN NOW()
      ELSE NULL
    END,
    locked_at = NULL,
    lock_token = NULL,
    last_error = LEFT(COALESCE(p_error, 'unknown'), 2000),
    latest_request_id = COALESCE(p_request_id, latest_request_id),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'processing'
    AND lock_token = p_lock_token
  RETURNING id, status, attempts, max_attempts;
END;
$$;
