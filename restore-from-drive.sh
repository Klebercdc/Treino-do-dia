#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  TITAN PRO — Restaurar do Google Drive via rclone
#  Uso: bash restore-from-drive.sh [--snapshot YYYY-MM-DD_HH-MM-SS]
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# Garante que googleapis.com passe pelo proxy (NO_PROXY do ambiente bloqueia por padrão)
export NO_PROXY="" no_proxy=""

REMOTE="gdrive:TITAN-PRO-Backup"
DEST_DIR="$(cd "$(dirname "$0")" && pwd)"
SNAPSHOT=""

# ── Parse args ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --snapshot) SNAPSHOT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "═══════════════════════════════════════════"
echo "  TITAN PRO — Restaurar ← Google Drive"
echo "═══════════════════════════════════════════"

# ── Lista snapshots disponíveis ───────────────────────────────
if [[ -z "$SNAPSHOT" ]]; then
  echo ""
  echo "Snapshots disponíveis no Drive:"
  rclone lsd "$REMOTE/snapshots/" 2>/dev/null | awk '{print "  " $NF}' || echo "  (nenhum snapshot encontrado)"
  echo ""
  echo "Restaurando da versão mais recente (latest)..."
  SRC="$REMOTE/latest"
else
  echo "Restaurando snapshot: $SNAPSHOT"
  SRC="$REMOTE/snapshots/$SNAPSHOT"
fi

echo "Destino: $DEST_DIR"
echo ""

# ── Confirma ──────────────────────────────────────────────────
read -rp "Confirmar restauração? Os arquivos locais serão sobrescritos. [s/N] " CONFIRM
[[ "${CONFIRM,,}" != "s" ]] && echo "Cancelado." && exit 0

# ── Restaura ──────────────────────────────────────────────────
rclone sync \
  --progress \
  --stats=5s \
  --transfers=8 \
  --fast-list \
  --exclude=".git/**" \
  "$SRC" \
  "$DEST_DIR"

echo ""
echo "[OK] Restauração concluída em $(date)"
