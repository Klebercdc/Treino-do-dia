#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_STATE_DIR="${KRONIA_STATE_DIR:-$HOME/.kronia}"
RUN_DIR="$ROOT_STATE_DIR/run"
BOOT_LOG="${KRONIA_BOT_BOOT_LOG:-$HOME/kronia_bot.log}"
BOT_LAUNCHER="$HOME/Treino-do-dia/kronia_telegram_bot.sh"
STOP_SCRIPT="$HOME/Treino-do-dia/scripts/stop-kronia-telegram-bot.sh"

echo "1) Parando bot atual..."
"$STOP_SCRIPT" >/dev/null 2>&1 || true
pkill -f "$BOT_LAUNCHER" >/dev/null 2>&1 || true
pkill -f "$HOME/Treino-do-dia/scripts/kronia_telegram_bot.sh" >/dev/null 2>&1 || true

echo "2) Limpando estado local..."
rm -f "$RUN_DIR/telegram.offset" \
      "$RUN_DIR/telegram.dispatch" \
      "$RUN_DIR/telegram-bot.pid" \
      "$RUN_DIR/telegram-bot.log"
rm -f "$HOME/.kronia_offset"
rm -f "$HOME/.kronia-supervisor"/running_*.json 2>/dev/null || true
rm -f "$BOOT_LOG"

echo "3) Removendo variáveis do ~/.bashrc..."
if [ -f "$HOME/.bashrc" ]; then
  grep -v '^export BOT_TOKEN=' "$HOME/.bashrc" | \
    grep -v '^export CHAT_ID=' | \
    grep -v '^export TELEGRAM_API_BASE=' > "$HOME/.bashrc.tmp"
  mv "$HOME/.bashrc.tmp" "$HOME/.bashrc"
fi

echo "4) Estado atual removido."
echo "Agora crie um bot novo no BotFather e depois rode:"
echo "  /root/Treino-do-dia/scripts/reset-kronia-telegram.sh"
