#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_STATE_DIR="${KRONIA_STATE_DIR:-$HOME/.kronia}"
STATE_DIR="$ROOT_STATE_DIR/run"
PID_FILE="$STATE_DIR/telegram-bot.pid"
BOT_LAUNCHER="$SCRIPT_DIR/kronia_telegram_bot.sh"
LEGACY_NODE_ENTRY="$REPO_ROOT/telegram-enterprise/bot.js"

if [ ! -f "$PID_FILE" ]; then
  echo "telegram bot não está rodando"
  exit 0
fi

BOT_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -n "$BOT_PID" ] && kill -0 "$BOT_PID" 2>/dev/null; then
  kill "$BOT_PID"
  echo "telegram bot parado (PID $BOT_PID)"
else
  echo "telegram bot já não estava rodando"
fi

pkill -f "$BOT_LAUNCHER" >/dev/null 2>&1 || true
pkill -f "$LEGACY_NODE_ENTRY" >/dev/null 2>&1 || true

rm -f "$PID_FILE"
