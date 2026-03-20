#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  TITAN PRO — Backup para Google Drive via rclone
#  Modo criativo: tenta Drive, cai para backup local se indisponível
#  Uso: bash backup-to-drive.sh [--dry-run] [--version] [--local-only]
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# Garante que googleapis.com passe pelo proxy (NO_PROXY do ambiente bloqueia por padrão)
export NO_PROXY="" no_proxy=""

REMOTE="gdrive:TITAN-PRO-Backup"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_BACKUP_DIR="${HOME}/.titan-pro-backups"
DRY_RUN=false
WITH_VERSION=false
LOCAL_ONLY=false
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# ── Parse args ────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --dry-run)    DRY_RUN=true ;;
    --version)    WITH_VERSION=true ;;
    --local-only) LOCAL_ONLY=true ;;
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

# ── Função: backup local como fallback ───────────────────────
backup_local() {
  mkdir -p "$LOCAL_BACKUP_DIR"
  local archive="${LOCAL_BACKUP_DIR}/titan-pro-${TIMESTAMP}.tar.gz"
  local latest_link="${LOCAL_BACKUP_DIR}/latest.tar.gz"

  echo "[LOCAL] Criando backup local: $archive"

  tar -czf "$archive" \
    --exclude="./.git" \
    --exclude="./node_modules" \
    --exclude="./.env*" \
    --exclude="./*.log" \
    -C "$SRC_DIR" .

  ln -sf "$archive" "$latest_link"

  # Mantém apenas os últimos 5 backups locais
  ls -t "${LOCAL_BACKUP_DIR}"/titan-pro-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f

  echo "[LOCAL] Backup salvo em: $archive"
  echo "[LOCAL] Link latest: $latest_link"
  echo ""
  echo "Backups locais disponíveis:"
  ls -lh "${LOCAL_BACKUP_DIR}"/titan-pro-*.tar.gz 2>/dev/null || echo "  (nenhum)"
}

# ── Verifica remote ───────────────────────────────────────────
if ! rclone listremotes | grep -q "^gdrive:"; then
  echo "[AVISO] Remote 'gdrive' não configurado. Execute primeiro:"
  echo "  bash rclone-setup.sh"
  echo ""
  echo "[FALLBACK] Usando backup local..."
  backup_local
  exit 0
fi

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
    echo "[AVISO] Possível causa: rede restringe acesso a googleapis.com."
    echo ""
  fi
fi

# ── Modo Drive (quando disponível) ───────────────────────────
if [[ "$DRIVE_OK" == "true" && "$LOCAL_ONLY" != "true" ]]; then
  RCLONE_FLAGS=(
    "${EXCLUDES[@]}"
    "--progress"
    "--stats=5s"
    "--transfers=8"
    "--checkers=16"
    "--fast-list"
  )

  $DRY_RUN && RCLONE_FLAGS+=("--dry-run")

  if $WITH_VERSION; then
    echo "Criando snapshot versionado em: $REMOTE/snapshots/$TIMESTAMP"
    rclone copy \
      "${RCLONE_FLAGS[@]}" \
      --backup-dir "$REMOTE/snapshots/$TIMESTAMP" \
      "$SRC_DIR" \
      "$REMOTE/latest"
  else
    rclone sync \
      "${RCLONE_FLAGS[@]}" \
      "$SRC_DIR" \
      "$REMOTE/latest"
  fi

  echo ""
  echo "[OK] Backup no Drive concluído em $(date)"
  echo ""
  echo "Para ver os arquivos no Drive:"
  echo "  rclone ls gdrive:TITAN-PRO-Backup/latest"

# ── Modo fallback local ───────────────────────────────────────
else
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] Simulando backup local para: $LOCAL_BACKUP_DIR"
    echo "[DRY-RUN] Arquivo seria: ${LOCAL_BACKUP_DIR}/titan-pro-${TIMESTAMP}.tar.gz"
    exit 0
  fi
  backup_local
  echo ""
  echo "[INFO] Quando o Drive estiver acessível, execute novamente sem --local-only"
  echo "       para sincronizar os backups locais para a nuvem."
fi
