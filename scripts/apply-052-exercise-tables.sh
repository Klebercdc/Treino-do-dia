#!/usr/bin/env bash
# Aplica a migração 052 no Supabase:
# cria exercise_aliases, exercise_media_cache e exercise_search_logs.
#
# Uso:
#   bash scripts/apply-052-exercise-tables.sh
#
# Variáveis lidas (em ordem de prioridade, de .env.local ou do ambiente):
#   SUPABASE_DB_URL       — connection string direta (postgres://...)
#   DATABASE_URL          — alternativa
#   VITE_SUPABASE_DB_URL  — alternativa

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/052_exercise_discovery_module.sql"
TABLES=("exercise_aliases" "exercise_media_cache" "exercise_search_logs")

# ── Carrega .env.local ────────────────────────────────────────────────────────
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^\s*#' "$ROOT/.env.local" | grep '=')
  set +a
fi

# ── Resolve DB URL ────────────────────────────────────────────────────────────
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${VITE_SUPABASE_DB_URL:-}}}"

if [[ -z "$DB_URL" ]]; then
  echo ""
  echo "ERRO: nenhuma connection string encontrada."
  echo "Defina SUPABASE_DB_URL no .env.local ou no ambiente:"
  echo "  export SUPABASE_DB_URL='postgres://postgres:[senha]@[host]:5432/postgres'"
  echo ""
  exit 1
fi

# ── Verifica psql ─────────────────────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
  echo ""
  echo "ERRO: psql não encontrado."
  echo "Instale o cliente PostgreSQL:"
  echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
  echo "  macOS:         brew install libpq && brew link --force libpq"
  echo ""
  exit 1
fi

# ── Verifica arquivo de migração ──────────────────────────────────────────────
if [[ ! -f "$MIGRATION" ]]; then
  echo "ERRO: arquivo não encontrado: $MIGRATION"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Migração 052 — tabelas de exercícios"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Verifica tabelas existentes ───────────────────────────────────────────────
echo "Verificando tabelas existentes..."
MISSING=()
for table in "${TABLES[@]}"; do
  exists=$(psql "$DB_URL" -tAq \
    -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table';" \
    2>/dev/null || echo "")
  if [[ "$exists" == "1" ]]; then
    echo "  ✅  $table — já existe"
  else
    echo "  ❌  $table — ausente"
    MISSING+=("$table")
  fi
done

if [[ ${#MISSING[@]} -eq 0 ]]; then
  echo ""
  echo "Todas as tabelas já existem. Nada a fazer."
  exit 0
fi

echo ""
echo "Aplicando migração..."
psql "$DB_URL" -f "$MIGRATION"

echo ""
echo "Verificando resultado..."
ALL_OK=true
for table in "${TABLES[@]}"; do
  exists=$(psql "$DB_URL" -tAq \
    -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table';" \
    2>/dev/null || echo "")
  if [[ "$exists" == "1" ]]; then
    echo "  ✅  $table"
  else
    echo "  ❌  $table — criação falhou"
    ALL_OK=false
  fi
done

echo ""
if [[ "$ALL_OK" == true ]]; then
  echo "Tabelas criadas. O botão VER exercício está operacional."
else
  echo "ERRO: algumas tabelas não foram criadas. Verifique os logs acima."
  exit 1
fi
