#!/usr/bin/env bash
set -Eeuo pipefail

if [ $# -lt 2 ]; then
  echo "Uso: send_telegram.sh <chat_id> <mensagem...>" >&2
  exit 1
fi

load_env_from_bashrc() {
  [ -f "$HOME/.bashrc" ] || return 0
  local line key value
  while IFS= read -r line; do
    case "$line" in
      export\ BOT_TOKEN=*|export\ CHAT_ID=*|export\ TELEGRAM_BOT_TOKEN=*|export\ TELEGRAM_CHAT_ID=*|export\ TELEGRAM_API_BASE=*)
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

BOT_TOKEN="${BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-}}"
CHAT_ID="${CHAT_ID:-${TELEGRAM_CHAT_ID:-}}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-${BOT_TOKEN:-}}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-${CHAT_ID:-}}"

CHAT_ID_INPUT="$1"
shift
MESSAGE="$*"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${CHAT_ID_INPUT:-}" ]; then
  exit 1
fi

API_BASE="${TELEGRAM_API_BASE:-https://api.telegram.org}"

python3 - "$CHAT_ID_INPUT" "$MESSAGE" "$TELEGRAM_BOT_TOKEN" "$API_BASE" <<'PY'
import json, sys, urllib.request

chat_id, message, token, api_base = sys.argv[1:]
text = (message or "").strip()
if not text:
    raise SystemExit(0)

chunks = []
limit = 3500
while text:
    chunks.append(text[:limit])
    text = text[limit:]

for chunk in chunks:
    payload = json.dumps({"chat_id": chat_id, "text": chunk}).encode("utf-8")
    req = urllib.request.Request(
        f"{api_base}/bot{token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()
PY
