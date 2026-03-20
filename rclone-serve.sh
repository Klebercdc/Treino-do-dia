#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  TITAN PRO — Servidor local via rclone serve http
#  Ideia fora da caixa: rclone como servidor HTTP zero-dependência
#  Uso: bash rclone-serve.sh [porta]
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

PORT="${1:-8080}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "════════════════════════════════════════════"
echo "  TITAN PRO — Dev Server (rclone serve http)"
echo "  http://localhost:${PORT}"
echo "  Pressione Ctrl+C para parar"
echo "════════════════════════════════════════════"
echo ""

# rclone serve http expõe qualquer diretório como servidor HTTP
# sem precisar de Node.js, Python ou nginx!
rclone serve http \
  --addr "localhost:${PORT}" \
  --read-only \
  --no-modtime \
  --dir-cache-time 0 \
  "$DIR"
