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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOT_ENTRY="$SCRIPT_DIR/telegram-enterprise/bot.js"
BOOT_LOG="${KRONIA_BOT_BOOT_LOG:-$HOME/kronia_bot.log}"

mkdir -p "$(dirname "$BOOT_LOG")"

if [ -z "${BOT_TOKEN:-}" ] || [ -z "${CHAT_ID:-}" ]; then
  {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] BOT_TOKEN/CHAT_ID ausentes; launcher abortado."
  } >> "$BOOT_LOG"
  exit 1
fi

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando kronia_telegram_bot launcher."
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Entry: $BOT_ENTRY"
} >> "$BOOT_LOG"

exec node "$BOT_ENTRY" "$@"
