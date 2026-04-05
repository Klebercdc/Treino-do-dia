#!/usr/bin/env bash
set -Euo pipefail

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

STATE_DIR="${KRONIA_STATE_DIR:-$HOME/.kronia}"
RUN_DIR="$STATE_DIR/run"
mkdir -p "$RUN_DIR"

BOT_TOKEN="${BOT_TOKEN:-}"
ALLOWED_CHAT_ID="${CHAT_ID:-}"
API_BASE="${TELEGRAM_API_BASE:-https://api.telegram.org}"
OFFSET_FILE="$RUN_DIR/telegram.offset"
BOT_LOG="$RUN_DIR/telegram-bot.log"
SUPERVISOR_BIN="$HOME/Treino-do-dia/kronia_supervisor.sh"
SEND_BIN="$HOME/Treino-do-dia/scripts/send_telegram.sh"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$BOT_LOG"
}

trap 'log "Erro no bot (linha $LINENO, comando: $BASH_COMMAND)"' ERR

if [ -z "$BOT_TOKEN" ] || [ -z "$ALLOWED_CHAT_ID" ]; then
  log "BOT_TOKEN/CHAT_ID ausentes"
  exit 1
fi

telegram_api_json() {
  python3 - "$BOT_TOKEN" "$API_BASE" "$1" "${2:-}" <<'PY'
import json, sys, urllib.parse, urllib.request
token, api_base, method, query = sys.argv[1:]
url = f"{api_base}/bot{token}/{method}"
if query:
    url = f"{url}?{query}"
with urllib.request.urlopen(url, timeout=30) as resp:
    print(resp.read().decode("utf-8"))
PY
}

validate_bot_token() {
  python3 - "$1" <<'PY'
import json, sys
try:
    payload = json.loads(sys.argv[1])
except Exception:
    print("INVALID_JSON")
    raise SystemExit(1)
if payload.get("ok") is True:
    print("OK")
    raise SystemExit(0)
print(payload.get("description") or payload.get("error_code") or "UNKNOWN_ERROR")
raise SystemExit(1)
PY
}

disable_webhook() {
  telegram_api_json "deleteWebhook" "drop_pending_updates=false"
}

log "Inicializando bot de polling"
GET_ME_RESPONSE="$(telegram_api_json "getMe" "" 2>>"$BOT_LOG" || true)"
if ! VALIDATION_RESULT="$(validate_bot_token "$GET_ME_RESPONSE" 2>>"$BOT_LOG")"; then
  log "BOT_TOKEN inválido ou não aceito pelo Telegram: ${VALIDATION_RESULT:-UNKNOWN_ERROR}"
  exit 1
fi
log "BOT_TOKEN validado com sucesso"

if [ "${KRONIA_TELEGRAM_FORCE_DELETE_WEBHOOK:-0}" = "1" ]; then
  DELETE_WEBHOOK_RESPONSE="$(disable_webhook 2>>"$BOT_LOG" || true)"
  log "deleteWebhook executado: ${DELETE_WEBHOOK_RESPONSE:-sem resposta}"
else
  log "deleteWebhook automático desativado no startup"
fi

touch "$OFFSET_FILE"
OFFSET="$(cat "$OFFSET_FILE" 2>/dev/null || true)"
OFFSET="${OFFSET:-0}"

poll_updates() {
  python3 - "$BOT_TOKEN" "$API_BASE" "$OFFSET" <<'PY'
import json, sys, urllib.parse, urllib.request
token, api_base, offset = sys.argv[1:]
params = urllib.parse.urlencode({
    "timeout": 50,
    "offset": offset,
    "allowed_updates": json.dumps(["message"]),
})
url = f"{api_base}/bot{token}/getUpdates?{params}"
with urllib.request.urlopen(url, timeout=70) as resp:
    print(resp.read().decode("utf-8"))
PY
}

send_local_message() {
  local chat_id="$1"
  local message="$2"
  if [ -x "$SEND_BIN" ]; then
    "$SEND_BIN" "$chat_id" "$message" >> "$BOT_LOG" 2>&1 || true
  fi
}

build_local_reply() {
  python3 - "$1" "$STATE_DIR" "$ALLOWED_CHAT_ID" <<'PY'
import datetime, json, os, sys
text = (sys.argv[1] or "").strip().lower()
state_dir, allowed_chat_id = sys.argv[2:]
context_path = os.path.join(state_dir, "context", f"context_{allowed_chat_id}.json")
bot_log_path = os.path.join(state_dir, "run", "telegram-bot.log")

def load_context():
    try:
        with open(context_path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}

def recent_failures():
    failures = []
    try:
        with open(bot_log_path, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh.readlines()[-40:]:
                low = line.lower()
                if "inválido" in low or "ausentes" in low or "error" in low or "falha" in low:
                    failures.append(line.strip())
    except Exception:
        return []
    return failures[-3:]

ctx = load_context()
status = ctx.get("status") or "sem histórico"
last_task = ctx.get("last_task") or "nenhuma tarefa recente"
last_job_id = ctx.get("last_job_id") or "nenhum"
last_timestamp = ctx.get("timestamp") or "sem timestamp"
failures = recent_failures()

if text in {"/start", "/ajuda", "ajuda"}:
    print(
        "KRONIA Supervisor online.\n\n"
        "Pode escrever em texto livre, sem comandos obrigatórios.\n"
        "Exemplos:\n"
        "- estado atual\n"
        "- audite o repositório\n"
        "- continue\n"
        "- melhore isso\n"
        "- verifique o CTA da dieta"
    )
elif text in {"oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "como está", "como esta", "tudo bem"}:
    print(
        "Estou online.\n\n"
        f"Estado atual: {status}.\n"
        f"Última tarefa: {last_task}.\n"
        f"Último job: {last_job_id}.\n"
        "Se quiser, me peça uma ação direta como 'relatório do app' ou 'arrume tal lugar'."
    )
elif "relatorio do app" in text or "relatório do app" in text or "como está o app" in text or "como esta o app" in text:
    base = [
        "Relatório rápido do app:",
        f"- Estado do supervisor: {status}",
        f"- Última tarefa: {last_task}",
        f"- Último job: {last_job_id}",
        f"- Última atualização: {last_timestamp}",
    ]
    if failures:
        base.append("- Alertas recentes:")
        base.extend([f"  {item}" for item in failures])
    else:
        base.append("- Alertas recentes: nenhuma falha crítica visível no log curto.")
    print("\n".join(base))
elif "alguma falha hoje" in text or "teve falha hoje" in text or "houve falha hoje" in text:
    if failures:
        print("Falhas recentes detectadas:\n" + "\n".join(f"- {item}" for item in failures))
    else:
        print("Não encontrei falha crítica recente no recorte curto do log do bot.")
elif "porque demora" in text or "por que demora" in text or "demora muito" in text:
    print(
        "Demora porque o fluxo atual executa tarefa real: Telegram -> supervisor -> executor -> Codex -> logs -> relatório.\n\n"
        "Para tarefas técnicas isso é esperado. Para mensagens simples eu já respondo localmente; para execução pesada eu envio confirmação imediata e sigo em background."
    )
elif text in {"está funcionando?", "esta funcionando?", "ta funcionando?", "tá funcionando?"}:
    print("Sim. O bot está ativo em polling. Para confirmar o fluxo completo, envie 'estado atual' ou uma tarefa técnica curta.")
elif text.startswith("/"):
    print("Comando Telegram ignorado. Use texto livre, por exemplo: 'estado atual' ou 'verifique o CTA da dieta'.")
else:
    print("")
PY
}

build_execution_ack() {
  python3 - "$1" <<'PY'
import sys
text = (sys.argv[1] or "").strip()
print(
    "Entendi. Vou verificar isso agora no projeto e te respondo com o resultado assim que concluir.\n\n"
    f"Pedido: {text[:500]}"
)
PY
}

process_dispatch_file() {
  if [ ! -f "$RUN_DIR/telegram.dispatch" ]; then
    return 0
  fi

  while IFS=$'\t' read -r kind field1 field2; do
    [ -n "${kind:-}" ] || continue
    if [ "$kind" = "OFFSET" ]; then
      OFFSET="$field1"
      printf '%s' "$OFFSET" > "$OFFSET_FILE"
      log "Offset atualizado para $OFFSET"
    elif [ "$kind" = "TASK" ]; then
      log "Mensagem consumida do chat $field1: $field2"
      DIRECT_REPLY="$(build_local_reply "$field2" || true)"
      if [ -n "$DIRECT_REPLY" ]; then
        send_local_message "$field1" "$DIRECT_REPLY"
        log "Resposta local enviada para o chat $field1"
      else
        send_local_message "$field1" "$(build_execution_ack "$field2")"
        log "Ack de execução enviado para o chat $field1"
        nohup env KRONIA_SUPERVISOR_SILENT_ACK=1 "$SUPERVISOR_BIN" "$field1" "$field2" >> "$BOT_LOG" 2>&1 &
        log "Supervisor disparado em background para o chat $field1"
      fi
    fi
  done < "$RUN_DIR/telegram.dispatch"

  rm -f "$RUN_DIR/telegram.dispatch"
}

while true; do
  RESPONSE="$(poll_updates 2>>"$BOT_LOG" || true)"
  if [ -z "$RESPONSE" ]; then
    sleep 3
    continue
  fi

  python3 - "$RESPONSE" "$ALLOWED_CHAT_ID" <<'PY' > "$RUN_DIR/telegram.dispatch" || true
import json, sys
payload, allowed_chat_id = sys.argv[1:]
try:
    data = json.loads(payload)
except Exception:
    raise SystemExit(0)
for update in data.get("result") or []:
    update_id = update.get("update_id")
    message = update.get("message") or {}
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id", ""))
    text = (message.get("text") or "").strip()
    if not update_id:
        continue
    print(f"OFFSET\t{int(update_id) + 1}")
    if chat_id != allowed_chat_id:
      continue
    if not text:
      continue
    clean = text.replace("\t", " ").replace("\n", " ").strip()
    if not clean:
      continue
    print(f"TASK\t{chat_id}\t{clean}")
PY

  process_dispatch_file || log "Falha ao processar telegram.dispatch"

  sleep 1
done
