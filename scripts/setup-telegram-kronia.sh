#!/usr/bin/env bash
set -Eeuo pipefail

touch "$HOME/.bashrc"

echo "Cole o BOT_TOKEN do Telegram. A digitação ficará oculta."
read -rsp "BOT_TOKEN: " BOT_TOKEN_INPUT
echo

grep -v '^export BOT_TOKEN=' "$HOME/.bashrc" | grep -v '^export CHAT_ID=' | grep -v '^export TELEGRAM_API_BASE=' > "$HOME/.bashrc.tmp"
mv "$HOME/.bashrc.tmp" "$HOME/.bashrc"

cat >> "$HOME/.bashrc" <<EOF

# Telegram / KRONIA
export BOT_TOKEN="$BOT_TOKEN_INPUT"
# export CHAT_ID=""
export TELEGRAM_API_BASE="https://api.telegram.org"
EOF

unset BOT_TOKEN_INPUT
source "$HOME/.bashrc"

echo "1) Validando BOT_TOKEN..."
curl -s "${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/getMe"
echo
echo

echo "2) Removendo webhook..."
curl -s "${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/deleteWebhook"
echo
echo

echo "3) Agora vá no Telegram e mande uma mensagem para o bot, por exemplo: oi"
echo "   Depois volte aqui e pressione Enter para continuar."
read -r

UPDATES="$(curl -s "${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/getUpdates")"
echo "$UPDATES"
echo
echo

echo "4) Procurando o campo chat.id..."

CHAT_ID_EXTRACTED="$(
  printf '%s' "$UPDATES" | python3 - <<'PY'
import json, sys
try:
    data = json.load(sys.stdin)
    result = data.get("result") or []
    chat_id = ""
    for item in reversed(result):
        msg = item.get("message") or item.get("edited_message") or item.get("channel_post") or {}
        chat = msg.get("chat") or {}
        if "id" in chat:
            chat_id = str(chat["id"])
            break
    print(chat_id)
except Exception:
    print("")
PY
)"

if [ -n "$CHAT_ID_EXTRACTED" ]; then
  echo
  echo "CHAT_ID encontrado automaticamente: $CHAT_ID_EXTRACTED"

  if grep -q '^export CHAT_ID=' "$HOME/.bashrc"; then
    sed -i "s/^export CHAT_ID=.*/export CHAT_ID=\"$CHAT_ID_EXTRACTED\"/" "$HOME/.bashrc"
  else
    printf '\nexport CHAT_ID="%s"\n' "$CHAT_ID_EXTRACTED" >> "$HOME/.bashrc"
  fi

  source "$HOME/.bashrc"

  echo
  echo "5) Testando envio seguro..."
  curl -s -X POST "${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${CHAT_ID}" \
    --data-urlencode "text=Teste seguro do KRONIA"
  echo
  echo
  echo "OK: BOT_TOKEN validado e CHAT_ID salvo no ~/.bashrc"
else
  echo
  echo "ERRO: não consegui extrair o CHAT_ID automaticamente."
  echo "Copie manualmente o valor de chat.id mostrado acima e rode:"
  echo
  echo "echo 'export CHAT_ID=\"SEU_CHAT_ID\"' >> ~/.bashrc"
  echo "source ~/.bashrc"
  echo
  echo "Depois teste com:"
  echo "curl -s -X POST \"https://api.telegram.org/bot\$BOT_TOKEN/sendMessage\" --data-urlencode \"chat_id=\$CHAT_ID\" --data-urlencode \"text=Teste seguro do KRONIA\""
fi
