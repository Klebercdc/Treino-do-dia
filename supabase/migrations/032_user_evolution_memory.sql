-- KRONIA 032 - Memória evolutiva longitudinal do usuário

CREATE TABLE IF NOT EXISTS public.user_memory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'api',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  component TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_key)
);

CREATE INDEX IF NOT EXISTS idx_user_memory_events_user_occurred ON public.user_memory_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_events_type ON public.user_memory_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_events_payload_gin ON public.user_memory_events USING GIN (payload);

CREATE TABLE IF NOT EXISTS public.user_memory_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  derived_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  coaching_summary TEXT,
  last_event_at TIMESTAMPTZ,
  last_event_id UUID REFERENCES public.user_memory_events(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_state_updated_at ON public.user_memory_state (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_state_derived_state_gin ON public.user_memory_state USING GIN (derived_state);

CREATE TABLE IF NOT EXISTS public.user_memory_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id TEXT,
  component TEXT,
  event_type TEXT NOT NULL,
  blocks_recalculated TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  previous_state JSONB,
  next_state JSONB,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_audit_user_created ON public.user_memory_audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_audit_request ON public.user_memory_audit_logs (request_id);

ALTER TABLE public.user_memory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_memory_events_select_own" ON public.user_memory_events;
CREATE POLICY "user_memory_events_select_own" ON public.user_memory_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory_events_insert_own" ON public.user_memory_events;
CREATE POLICY "user_memory_events_insert_own" ON public.user_memory_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory_events_service_all" ON public.user_memory_events;
CREATE POLICY "user_memory_events_service_all" ON public.user_memory_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "user_memory_state_select_own" ON public.user_memory_state;
CREATE POLICY "user_memory_state_select_own" ON public.user_memory_state
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory_state_insert_own" ON public.user_memory_state;
CREATE POLICY "user_memory_state_insert_own" ON public.user_memory_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory_state_update_own" ON public.user_memory_state;
CREATE POLICY "user_memory_state_update_own" ON public.user_memory_state
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory_state_service_all" ON public.user_memory_state;
CREATE POLICY "user_memory_state_service_all" ON public.user_memory_state
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "user_memory_audit_select_own" ON public.user_memory_audit_logs;
CREATE POLICY "user_memory_audit_select_own" ON public.user_memory_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory_audit_service_all" ON public.user_memory_audit_logs;
CREATE POLICY "user_memory_audit_service_all" ON public.user_memory_audit_logs
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
