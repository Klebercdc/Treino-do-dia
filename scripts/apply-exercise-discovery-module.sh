#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_FILE="$ROOT/sql/020_exercise_discovery_module.sql"

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${VITE_SUPABASE_DB_URL:-}}}"

if [[ -z "$DB_URL" ]]; then
  echo "ERRO: defina SUPABASE_DB_URL no ambiente ou no .env.local"
  exit 1
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "ERRO: arquivo SQL não encontrado: $SQL_FILE"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado."
  exit 1
fi

psql -v ON_ERROR_STOP=1 "$DB_URL" -f "$SQL_FILE"

echo "Pronto. Verificando tabelas..."
for table_name in exercise_aliases exercise_media_cache exercise_search_logs; do
  result="$(
    psql "$DB_URL" -tAq \
      -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table_name';" \
      2>/dev/null || true
  )"

  if [[ "$result" == "1" ]]; then
    echo "  OK     $table_name"
  else
    echo "  FALTA  $table_name"
  fi
done
