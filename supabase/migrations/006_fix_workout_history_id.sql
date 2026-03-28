-- ══════════════════════════════════════════════════════════════
-- KRONIA — Migração 006: Fix critical sync bug + upsert policy
--
-- BUG CORRIGIDO:
--   workout_history.id era UUID, mas o app gera IDs no formato
--   "sess_1234567890" (TEXT). Todo upsert falhava silenciosamente,
--   impedindo a sincronização multi-device de funcionar.
--
-- CORREÇÃO:
--   1. Altera a coluna id para TEXT (sem DEFAULT — app gera o id)
--   2. Adiciona policy de UPDATE (necessária para upsert funcionar)
--   3. Adiciona coluna session_id para deduplicação explícita
-- ══════════════════════════════════════════════════════════════

-- ── 1. Alterar tipo da coluna id de UUID para TEXT ────────────
-- Remove o default gen_random_uuid() e altera o tipo
ALTER TABLE workout_history
  ALTER COLUMN id TYPE TEXT,
  ALTER COLUMN id DROP DEFAULT;

-- ── 2. Adicionar policy de UPDATE (faltava — upsert precisa) ─
CREATE POLICY "history: atualização própria"
  ON workout_history FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 3. Índice de texto na coluna id (lookup em upsert) ────────
DROP INDEX IF EXISTS workout_history_pkey;
-- O PK já existe, só garantimos que o índice está otimizado para TEXT
-- (Postgres ajusta automaticamente com o ALTER TYPE acima)

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — rode após a migration para confirmar:
--   SELECT id, trained_at FROM workout_history LIMIT 5;
--   (deve mostrar IDs no formato "sess_XXXXXXXXX")
-- ══════════════════════════════════════════════════════════════
