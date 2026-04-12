#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_STATE_DIR="${KRONIA_STATE_DIR:-$HOME/.kronia}"
RUN_DIR="$ROOT_STATE_DIR/run"
BOOT_LOG="${KRONIA_BOT_BOOT_LOG:-$HOME/kronia_bot.log}"
BOT_LAUNCHER="$HOME/Treino-do-dia/kronia_telegram_bot.sh"
START_SCRIPT="$HOME/Treino-do-dia/scripts/start-kronia-telegram-bot.sh"
STOP_SCRIPT="$HOME/Treino-do-dia/scripts/stop-kronia-telegram-bot.sh"

mkdir -p "$RUN_DIR"

read -rsp "Cole o BOT_TOKEN: " BOT_TOKEN_INPUT
echo
read -rp "Cole o CHAT_ID autorizado: " CHAT_ID_INPUT

if [ -z "$BOT_TOKEN_INPUT" ] || [ -z "$CHAT_ID_INPUT" ]; then
  echo "BOT_TOKEN e CHAT_ID são obrigatórios."
  exit 1
fi

touch "$HOME/.bashrc"
grep -v '^export BOT_TOKEN=' "$HOME/.bashrc" | \
  grep -v '^export CHAT_ID=' | \
  grep -v '^export TELEGRAM_API_BASE=' > "$HOME/.bashrc.tmp"
mv "$HOME/.bashrc.tmp" "$HOME/.bashrc"
{
  printf '\n# Telegram / KRONIA\n'
  printf 'export BOT_TOKEN=%q\n' "$BOT_TOKEN_INPUT"
  printf 'export CHAT_ID=%q\n' "$CHAT_ID_INPUT"
  printf 'export TELEGRAM_API_BASE=%q\n' "https://api.telegram.org"
} >> "$HOME/.bashrc"

unset BOT_TOKEN_INPUT CHAT_ID_INPUT

set +u
# shellcheck disable=SC1090
source "$HOME/.bashrc"
set -u

echo "1) Parando processos antigos..."
"$STOP_SCRIPT" >/dev/null 2>&1 || true
pkill -f "$BOT_LAUNCHER" >/dev/null 2>&1 || true
pkill -f "$HOME/Treino-do-dia/scripts/kronia_telegram_bot.sh" >/dev/null 2>&1 || true

echo "2) Limpando estado antigo..."
rm -f "$RUN_DIR/telegram.offset" "$RUN_DIR/telegram.dispatch" "$RUN_DIR/telegram-bot.pid"
rm -f "$HOME/.kronia_offset"
rm -f "$HOME/.kronia-supervisor"/running_*.json 2>/dev/null || true
rm -f "$BOOT_LOG"

echo "3) Validando BOT_TOKEN com getMe..."
GET_ME_RESPONSE="$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getMe")"
printf '%s\n' "$GET_ME_RESPONSE"
if ! printf '%s' "$GET_ME_RESPONSE" | grep -q '"ok":true'; then
  echo "BOT_TOKEN inválido ou não aceito pelo Telegram."
  exit 1
fi

echo "4) Removendo webhook antigo..."
DELETE_WEBHOOK_RESPONSE="$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook?drop_pending_updates=false")"
printf '%s\n' "$DELETE_WEBHOOK_RESPONSE"

echo "5) Garantindo permissões..."
chmod +x "$BOT_LAUNCHER" \
  "$HOME/Treino-do-dia/scripts/kronia_telegram_bot.sh" \
  "$HOME/Treino-do-dia/scripts/send_telegram.sh" \
  "$START_SCRIPT" \
  "$STOP_SCRIPT"

echo "6) Subindo bot novo..."
"$START_SCRIPT"

sleep 3

echo "7) Status inicial do processo..."
ps aux | grep -E 'kronia_telegram_bot\.sh|scripts/kronia_telegram_bot\.sh' | grep -v grep || true

echo "8) Últimas linhas do log..."
tail -n 40 "$BOOT_LOG" 2>/dev/null || true

echo
echo "Reset concluído."
echo "Agora envie uma mensagem livre no Telegram para validar o fluxo novo."
