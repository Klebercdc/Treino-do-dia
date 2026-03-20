#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  TITAN PRO — rclone Google Drive Setup
#  Configura rclone para acessar o Google Drive sem navegador
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

REMOTE_NAME="gdrive"
FOLDER_NAME="TITAN-PRO-Backup"

echo "════════════════════════════════════════"
echo "  TITAN PRO — Configuração Google Drive "
echo "════════════════════════════════════════"
echo ""

# ── Verifica se rclone está instalado ──────────────────────────
if ! command -v rclone &>/dev/null; then
  echo "[ERRO] rclone não encontrado. Instale com: sudo apt install rclone"
  exit 1
fi

# ── Verifica se o remote já existe ────────────────────────────
if rclone listremotes | grep -q "^${REMOTE_NAME}:"; then
  echo "[OK] Remote '${REMOTE_NAME}' já configurado."
  rclone about "${REMOTE_NAME}:" 2>/dev/null || true
  exit 0
fi

RCLONE_CONFIG_DIR="${HOME}/.config/rclone"
mkdir -p "$RCLONE_CONFIG_DIR"

# ── Modo Service Account ───────────────────────────────────────
if [[ "${1:-}" == "--service-account" ]]; then
  if [[ -z "${GDRIVE_SA_JSON:-}" ]]; then
    echo "[ERRO] Variável GDRIVE_SA_JSON não definida."
    echo "  export GDRIVE_SA_JSON=/path/to/service-account.json"
    exit 1
  fi
  if [[ ! -f "$GDRIVE_SA_JSON" ]]; then
    echo "[ERRO] Arquivo não encontrado: $GDRIVE_SA_JSON"
    exit 1
  fi

  # Copia o JSON para local permanente
  SA_DEST="${RCLONE_CONFIG_DIR}/service-account.json"
  cp "$GDRIVE_SA_JSON" "$SA_DEST"
  chmod 600 "$SA_DEST"

  echo "Método: Service Account"
  echo "  Arquivo: $SA_DEST"
  echo ""

  cat >> "${RCLONE_CONFIG_DIR}/rclone.conf" <<EOF

[${REMOTE_NAME}]
type = drive
scope = drive
service_account_file = ${SA_DEST}
EOF

  echo ""
  echo "[OK] Remote '${REMOTE_NAME}' criado com Service Account!"

# ── Modo Token OAuth ───────────────────────────────────────────
else
  echo "Método: autenticação headless via token"
  echo ""
  echo "PASSO 1 — Em outra máquina com navegador, execute:"
  echo "  rclone authorize \"drive\""
  echo ""
  echo "PASSO 2 — Cole o token JSON aqui abaixo e pressione ENTER duas vezes:"
  echo ""

  TOKEN=""
  while IFS= read -r line; do
    [[ -z "$line" ]] && break
    TOKEN+="$line"
  done

  if [[ -z "$TOKEN" ]]; then
    echo "[ERRO] Nenhum token fornecido."
    echo ""
    echo "Alternativa — use uma Service Account (JSON):"
    echo "  export GDRIVE_SA_JSON=/path/to/service-account.json"
    echo "  bash rclone-setup.sh --service-account"
    exit 1
  fi

  cat >> "${RCLONE_CONFIG_DIR}/rclone.conf" <<EOF

[${REMOTE_NAME}]
type = drive
scope = drive
token = ${TOKEN}
EOF

  echo ""
  echo "[OK] Remote '${REMOTE_NAME}' criado!"
fi

echo ""
echo "[OK] Remote '${REMOTE_NAME}' criado!"
echo ""

# ── Cria pasta do projeto no Drive ────────────────────────────
echo "Criando pasta '${FOLDER_NAME}' no Google Drive..."
rclone mkdir "${REMOTE_NAME}:${FOLDER_NAME}" 2>/dev/null && \
  echo "[OK] Pasta '${FOLDER_NAME}' pronta no Drive." || \
  echo "[AVISO] Não foi possível criar a pasta agora (verifique o token)."

echo ""
echo "Setup concluído! Próximos passos:"
echo "  bash backup-to-drive.sh    → fazer backup agora"
echo "  bash restore-from-drive.sh → restaurar do Drive"
