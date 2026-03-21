#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  TITAN PRO — Restaurar do Google Drive via rclone
#  Modo criativo: tenta Drive, cai para backup local se indisponível
#  Uso: bash restore-from-drive.sh [--snapshot YYYY-MM-DD_HH-MM-SS] [--local]
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# Garante que googleapis.com passe pelo proxy (NO_PROXY do ambiente bloqueia por padrão)
export NO_PROXY="" no_proxy=""

REMOTE="gdrive:TITAN-PRO-Backup"
DEST_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_BACKUP_DIR="${HOME}/.titan-pro-backups"
SNAPSHOT=""
LOCAL_ONLY=false

# ── Parse args ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --snapshot)   SNAPSHOT="$2"; shift 2 ;;
    --local)      LOCAL_ONLY=true; shift ;;
    *)            shift ;;
  esac
done

echo "═══════════════════════════════════════════"
echo "  TITAN PRO — Restaurar ← Google Drive"
echo "═══════════════════════════════════════════"

# ── Função: restaurar de backup local ────────────────────────
restore_local() {
  local archive="${LOCAL_BACKUP_DIR}/latest.tar.gz"

  if [[ -n "$SNAPSHOT" ]]; then
    archive="${LOCAL_BACKUP_DIR}/titan-pro-${SNAPSHOT}.tar.gz"
  fi

  echo ""
  echo "Backups locais disponíveis:"
  ls -lh "${LOCAL_BACKUP_DIR}"/titan-pro-*.tar.gz 2>/dev/null || echo "  (nenhum backup local encontrado)"
  echo ""

  if [[ ! -f "$archive" ]]; then
    echo "[ERRO] Backup local não encontrado: $archive"
    echo "  Execute primeiro: bash backup-to-drive.sh"
    exit 1
  fi

  echo "Restaurando de: $archive"
  echo "Destino: $DEST_DIR"
  echo ""

  read -rp "Confirmar restauração? Os arquivos locais serão sobrescritos. [s/N] " CONFIRM
  [[ "${CONFIRM,,}" != "s" ]] && echo "Cancelado." && exit 0

  tar -xzf "$archive" -C "$DEST_DIR" --exclude=".git"

  echo ""
  echo "[OK] Restauração local concluída em $(date)"
}

# ── Testa conectividade com o Drive ──────────────────────────
DRIVE_OK=false
if [[ "$LOCAL_ONLY" != "true" ]]; then
  echo -n "Verificando conectividade com Google Drive... "
  if rclone about gdrive: --timeout 10s &>/dev/null; then
    DRIVE_OK=true
    echo "OK"
  else
    echo "INDISPONÍVEL"
    echo ""
    echo "[AVISO] Google Drive inacessível neste ambiente."
    echo "[FALLBACK] Tentando backup local..."
    restore_local
    exit 0
  fi
fi

# ── Modo local explícito ──────────────────────────────────────
if [[ "$LOCAL_ONLY" == "true" ]]; then
  restore_local
  exit 0
fi

# ── Modo Drive ────────────────────────────────────────────────
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

read -rp "Confirmar restauração? Os arquivos locais serão sobrescritos. [s/N] " CONFIRM
[[ "${CONFIRM,,}" != "s" ]] && echo "Cancelado." && exit 0

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
