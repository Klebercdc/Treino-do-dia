#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  TITAN PRO — Backup para Google Drive via rclone
#  Uso: bash backup-to-drive.sh [--dry-run] [--version]
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# Garante que googleapis.com passe pelo proxy (NO_PROXY do ambiente bloqueia por padrão)
export NO_PROXY="" no_proxy=""

REMOTE="gdrive:TITAN-PRO-Backup"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false
WITH_VERSION=false
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# ── Parse args ────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --dry-run)   DRY_RUN=true ;;
    --version)   WITH_VERSION=true ;;
  esac
done

# ── Arquivos/pastas a excluir do backup ───────────────────────
EXCLUDES=(
  "--exclude=node_modules/**"
  "--exclude=.git/**"
  "--exclude=.env*"
  "--exclude=*.log"
)

echo "═══════════════════════════════════════════"
echo "  TITAN PRO — Backup → Google Drive"
echo "  Origem : $SRC_DIR"
echo "  Destino: $REMOTE/latest"
$DRY_RUN && echo "  MODO   : DRY-RUN (nenhum arquivo será enviado)"
echo "═══════════════════════════════════════════"
echo ""

# ── Verifica remote ───────────────────────────────────────────
if ! rclone listremotes | grep -q "^gdrive:"; then
  echo "[ERRO] Remote 'gdrive' não configurado. Execute primeiro:"
  echo "  bash rclone-setup.sh"
  exit 1
fi

RCLONE_FLAGS=(
  "${EXCLUDES[@]}"
  "--progress"
  "--stats=5s"
  "--transfers=8"
  "--checkers=16"
  "--fast-list"
)

$DRY_RUN && RCLONE_FLAGS+=("--dry-run")

# ── Snapshot versionado (opcional) ────────────────────────────
if $WITH_VERSION; then
  echo "Criando snapshot versionado em: $REMOTE/snapshots/$TIMESTAMP"
  rclone copy \
    "${RCLONE_FLAGS[@]}" \
    --backup-dir "$REMOTE/snapshots/$TIMESTAMP" \
    "$SRC_DIR" \
    "$REMOTE/latest"
else
  # ── Sync direto (mais rápido) ─────────────────────────────
  rclone sync \
    "${RCLONE_FLAGS[@]}" \
    "$SRC_DIR" \
    "$REMOTE/latest"
fi

echo ""
echo "[OK] Backup concluído em $(date)"
echo ""
echo "Para ver os arquivos no Drive:"
echo "  rclone ls gdrive:TITAN-PRO-Backup/latest"
