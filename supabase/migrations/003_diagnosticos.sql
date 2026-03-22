-- ══════════════════════════════════════════════════════
-- KRONIA — Migração 003: Tabela de Diagnósticos Diários
-- Execute este script no SQL Editor do Supabase.
--
-- Armazena os relatórios gerados pelo Pastor Diagnóstico
-- (api/pastor-diagnostico.js) que roda diariamente via Vercel Cron.
-- Acesso apenas via service_role (sem acesso público por RLS).
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS diagnosticos (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              TEXT        NOT NULL DEFAULT 'ok'
                        CHECK (status IN ('ok', 'aviso', 'erro')),
  erros               TEXT[]      NOT NULL DEFAULT '{}',
  avisos              TEXT[]      NOT NULL DEFAULT '{}',
  reparos_executados  TEXT[]      NOT NULL DEFAULT '{}',
  checagens           JSONB       NOT NULL DEFAULT '{}'
);

-- Índice para recuperar os últimos relatórios rapidamente
CREATE INDEX IF NOT EXISTS idx_diagnosticos_executado_em
  ON diagnosticos (executado_em DESC);

-- ── Row Level Security ──────────────────────────────────
ALTER TABLE diagnosticos ENABLE ROW LEVEL SECURITY;

-- Nenhum usuário final acessa — somente o service_role do backend
CREATE POLICY "diagnosticos: sem acesso público"
  ON diagnosticos FOR ALL USING (false);

-- ── Limpeza automática: mantém apenas os últimos 180 dias ──
-- Pode ser chamada manualmente ou via pg_cron se disponível.
CREATE OR REPLACE FUNCTION public.limpar_diagnosticos_antigos()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.diagnosticos
  WHERE executado_em < NOW() - INTERVAL '180 days';
END;
$$;
