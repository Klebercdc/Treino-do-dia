#!/usr/bin/env bash
set -Eeuo pipefail

load_env_from_bashrc() {
  [ -f "$HOME/.bashrc" ] || return 0
  local line key value
  while IFS= read -r line; do
    case "$line" in
      export\ BOT_TOKEN=*|export\ CHAT_ID=*|export\ TELEGRAM_API_BASE=*)
        key="${line#export }"
        key="${key%%=*}"
        value="${line#*=}"
        value="${value%\"}"
        value="${value#\"}"
        export "$key=$value"
        ;;
    esac
  done < "$HOME/.bashrc"
}

load_env_from_bashrc

ROOT_STATE_DIR="${KRONIA_STATE_DIR:-$HOME/.kronia}"
STATE_DIR="$ROOT_STATE_DIR/run"
BOT_BIN="$HOME/Treino-do-dia/telegram-enterprise/bot.js"
PID_FILE="$STATE_DIR/telegram-bot.pid"
LOG_FILE="$HOME/kronia_bot.log"

mkdir -p "$STATE_DIR"

if [ -f "$PID_FILE" ]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "telegram bot já está rodando com PID $EXISTING_PID"
    exit 0
  fi
fi

setsid node "$BOT_BIN" >> "$LOG_FILE" 2>&1 < /dev/null &
BOT_PID=$!
printf '%s' "$BOT_PID" > "$PID_FILE"

echo "telegram bot iniciado com PID $BOT_PID"
echo "log: $LOG_FILE"
