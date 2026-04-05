#!/usr/bin/env bash
set -Eeuo pipefail

if [ $# -lt 2 ]; then
  echo "Uso: kronia_supervisor.sh <chat_id> <mensagem...>"
  exit 1
fi

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

CHAT_ID_INPUT="$1"
shift
RAW_MESSAGE="$*"

STATE_DIR="${KRONIA_STATE_DIR:-$HOME/.kronia}"
CONTEXT_DIR="$STATE_DIR/context"
LOCK_DIR="$STATE_DIR/locks"
RUN_DIR="$STATE_DIR/run"
JOB_LOG_DIR="$HOME/kronia-jobs"
mkdir -p "$CONTEXT_DIR" "$LOCK_DIR" "$RUN_DIR" "$JOB_LOG_DIR"

ALLOWED_CHAT_ID="${CHAT_ID:-}"
SUPERVISOR_LOG="$RUN_DIR/supervisor.log"
EXECUTOR_BIN="kronia_codex_job.sh"
SILENT_ACK="${KRONIA_SUPERVISOR_SILENT_ACK:-0}"
JOB_TIMEOUT_SECONDS="${KRONIA_JOB_TIMEOUT_SECONDS:-900}"
export PATH="$HOME:$PATH"

context_file() {
  printf '%s/context_%s.json' "$CONTEXT_DIR" "$1"
}

lock_file() {
  printf '%s/chat_%s.lock' "$LOCK_DIR" "$1"
}

send_message() {
  local chat_id="$1"
  local message="$2"
  if [ -x "$HOME/Treino-do-dia/scripts/send_telegram.sh" ]; then
    "$HOME/Treino-do-dia/scripts/send_telegram.sh" "$chat_id" "$message" >> "$SUPERVISOR_LOG" 2>&1 || true
  fi
}

is_stale_running_context() {
  local file="$1"
  local current="$2"
  python3 - "$file" "$current" <<'PY'
import datetime, json, sys
path, current = sys.argv[1:]
try:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
except Exception:
    print("0")
    raise SystemExit(0)
if data.get("status") != "running":
    print("0")
    raise SystemExit(0)
ts = data.get("timestamp")
if not ts:
    print("1")
    raise SystemExit(0)
try:
    base = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    now = datetime.datetime.fromisoformat(current.replace("Z", "+00:00"))
    print("1" if (now - base).total_seconds() > 600 else "0")
except Exception:
    print("1")
PY
}

trim_message() {
  python3 - "$1" <<'PY'
import sys
print((sys.argv[1] or "").strip())
PY
}

load_context_field() {
  local file="$1"
  local field="$2"
  python3 - "$file" "$field" <<'PY'
import json, sys
path, field = sys.argv[1], sys.argv[2]
try:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    value = data.get(field)
    if isinstance(value, (dict, list)):
        print(json.dumps(value, ensure_ascii=False))
    elif value is None:
        print("")
    else:
        print(str(value))
except Exception:
    print("")
PY
}

save_context() {
  local file="$1"
  local last_task="$2"
  local action_type="$3"
  local timestamp="$4"
  local job_id="$5"
  local status="$6"
  local log_path="$7"
  local report_path="$8"
  local summary_path="$9"
  local report_text="${10}"
  python3 - "$file" "$last_task" "$action_type" "$timestamp" "$job_id" "$status" "$log_path" "$report_path" "$summary_path" "$report_text" <<'PY'
import json, os, sys
path, last_task, action_type, timestamp, job_id, status, log_path, report_path, summary_path, report_text = sys.argv[1:]
payload = {
    "last_task": last_task,
    "action_type": action_type,
    "timestamp": timestamp,
    "last_job_id": job_id,
    "status": status,
    "log_path": log_path,
    "report_path": report_path,
    "summary_path": summary_path,
    "last_report": report_text,
}
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, ensure_ascii=False, indent=2)
PY
}

classify_intent() {
  python3 - "$1" <<'PY'
import re, sys
text = (sys.argv[1] or "").strip().lower()
if not text:
    print("invalid")
elif re.search(r"\b(estado atual|status atual|último status|ultimo status|job atual|o que você fez|o que voce fez|resumo|último resumo|ultimo resumo)\b", text):
    print("state_query")
elif re.search(r"\b(audite|auditoria|varra|revise|inspecione|faça uma auditoria|faca uma auditoria)\b", text):
    print("audit")
elif re.search(r"\b(continue|continuar|continua|prossiga|prosseguir|segue)\b", text):
    print("continue")
elif re.search(r"\b(refaça|refaca|melhore|aprofunde|corrija|ajuste|endureça|endureca|otimize)\b", text):
    print("refine")
else:
    print("new_task")
PY
}

build_task_prompt() {
  local message="$1"
  local action="$2"
  local last_task="$3"
  local last_report="$4"
  python3 - "$message" "$action" "$last_task" "$last_report" <<'PY'
import sys
message, action, last_task, last_report = sys.argv[1:]
parts = [
    "Você está operando o repositório real do KRONIA/Treino-do-dia em modo produção.",
    "Objetivo: executar a solicitação do usuário com padrão staff/principal, corrigindo causa raiz e validando o resultado.",
    "Regras:",
    "- Não peça confirmação; faça as mudanças necessárias.",
    "- Preserve segurança, contratos e observabilidade.",
    "- Se encontrar falhas adicionais diretamente relacionadas, corrija também.",
    "- Responda no final com estas seções exatas:",
    "Tarefa entendida:",
    "Ação executada:",
    "Correções aplicadas:",
    "Arquivos/áreas afetadas:",
    "Validação:",
    "Estado atual:",
    "Riscos:",
    "Próximo passo:",
]
if last_task:
    parts.extend([
        "",
        "Contexto anterior do chat:",
        f"- Última tarefa: {last_task}",
    ])
if last_report:
    parts.extend([
        "- Último relatório técnico resumido:",
        last_report[:4000],
    ])
parts.extend([
    "",
    f"Tipo de ação do supervisor: {action}",
])
if action == "continue":
    parts.append("Continue a última tarefa e leve adiante o que já foi feito, sem recomeçar do zero.")
elif action == "refine":
    parts.append("Refaça e melhore a última entrega com padrão elite, removendo fragilidade e pontas soltas.")
elif action == "audit":
    parts.append("Faça uma auditoria técnica profunda e corrija pelo menos os problemas críticos e altos encontrados.")
else:
    parts.append("Trate a solicitação abaixo como uma tarefa nova e completa.")
parts.extend([
    "",
    "Solicitação atual do usuário:",
    message,
])
print("\n".join(parts))
PY
}

build_state_report() {
  local action="$1"
  local last_task="$2"
  local timestamp="$3"
  local job_id="$4"
  local status="$5"
  local report="$6"
  python3 - "$action" "$last_task" "$timestamp" "$job_id" "$status" "$report" <<'PY'
import sys
action, last_task, timestamp, job_id, status, report = sys.argv[1:]
lines = [
    f"Tarefa entendida: {last_task or 'Nenhuma tarefa anterior registrada.'}",
    f"Ação executada: consulta de estado ({action or 'state_query'}).",
    "Correções aplicadas: nenhuma nova execução foi disparada.",
    "Arquivos/áreas afetadas: nenhuma alteração nova.",
    f"Validação: último job registrado = {job_id or 'nenhum'}; status = {status or 'desconhecido'}.",
    f"Estado atual: {timestamp or 'sem timestamp disponível'}.",
    "Riscos: o estado refletido depende do último relatório salvo localmente.",
    "Próximo passo: envie uma nova tarefa, ou use 'continue'/'melhore isso' para retomar o fluxo.",
]
if report:
    lines.append("")
    lines.append("Resumo anterior:")
    lines.append(report[:2500])
print("\n".join(lines))
PY
}

build_delivery_message() {
  local action="$1"
  local message="$2"
  local report="$3"
  python3 - "$action" "$message" "$report" <<'PY'
import re, sys
action, message, report = sys.argv[1:]
text = (message or "").strip().lower()
if action in {"audit", "continue", "refine"}:
    print(report)
    raise SystemExit(0)

def section(name):
    m = re.search(rf"{re.escape(name)}\s*(.*?)(?=\n(?:Tarefa entendida:|Ação executada:|Correções aplicadas:|Arquivos/áreas afetadas:|Validação:|Estado atual:|Riscos:|Próximo passo:)|\Z)", report, re.S)
    return m.group(1).strip() if m else ""

task = section("Tarefa entendida:") or message
done = section("Ação executada:")
fixes = section("Correções aplicadas:")
validation = section("Validação:")
state = section("Estado atual:")
risks = section("Riscos:")
next_step = section("Próximo passo:")

lines = [
    f"Entendi e concluí a análise de: {task}.",
]
if done:
    lines.append(f"Ação: {done}")
if fixes:
    lines.append(f"Resultado: {fixes}")
if validation:
    lines.append(f"Validação: {validation}")
if state:
    lines.append(f"Estado atual: {state}")
if risks:
    lines.append(f"Riscos: {risks}")
if next_step:
    lines.append(f"Próximo passo: {next_step}")
print("\n\n".join(lines))
PY
}

extract_report_from_log() {
  local log_path="$1"
  local report_path="$2"
  python3 - "$log_path" "$report_path" <<'PY'
import os, re, sys
log_path, report_path = sys.argv[1:]
text = ""
try:
    with open(log_path, "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
except Exception:
    text = ""
sections = [
    "Tarefa entendida:",
    "Ação executada:",
    "Correções aplicadas:",
    "Arquivos/áreas afetadas:",
    "Validação:",
    "Estado atual:",
    "Riscos:",
    "Próximo passo:",
]
found = []
for header in sections:
    pattern = re.compile(rf"(^|\n){re.escape(header)}[\s\S]*?(?=\n(?:{'|'.join(re.escape(s) for s in sections if s != header)})|\Z)", re.MULTILINE)
    match = pattern.search(text)
    if match:
      snippet = match.group(0).strip()
      if not snippet.startswith(header):
          snippet = snippet.split("\n", 1)[-1].strip()
          snippet = f"{header} {snippet}".strip()
      found.append(snippet)
if not found:
    tail = "\n".join(text.strip().splitlines()[-80:]).strip()
    found = [
        "Tarefa entendida: executor rodado sem relatório estruturado completo.",
        "Ação executada: execução do Codex concluída; usando fallback de resumo.",
        "Correções aplicadas: ver log consolidado.",
        "Arquivos/áreas afetadas: ver log consolidado.",
        "Validação: ver log consolidado.",
        "Estado atual: execução finalizada.",
        "Riscos: relatório estruturado não encontrado; resumo derivado do tail do log.",
        "Próximo passo: revisar o job e refinar se necessário.",
    ]
    if tail:
        found.append("")
        found.append("Resumo derivado:")
        found.append(tail[:2500])
report = "\n".join(found).strip()
os.makedirs(os.path.dirname(report_path), exist_ok=True)
with open(report_path, "w", encoding="utf-8") as fh:
    fh.write(report + "\n")
print(report)
PY
}

wait_for_new_job_log() {
  local before_file="$1"
  python3 - "$before_file" "$JOB_LOG_DIR" <<'PY'
import os, sys, time
before_path, log_dir = sys.argv[1:]
known = set()
try:
    with open(before_path, "r", encoding="utf-8") as fh:
        known = {line.strip() for line in fh if line.strip()}
except Exception:
    known = set()
deadline = time.time() + 20
while time.time() < deadline:
    try:
        candidates = []
        for name in os.listdir(log_dir):
            if not name.startswith("job-") or not name.endswith(".log"):
                continue
            path = os.path.join(log_dir, name)
            if path in known:
                continue
            try:
                stat = os.stat(path)
            except FileNotFoundError:
                continue
            candidates.append((stat.st_mtime, path))
        if candidates:
            candidates.sort()
            print(candidates[-1][1])
            sys.exit(0)
    except Exception:
        pass
    time.sleep(1)
print("")
PY
}

wait_for_job_completion() {
  local log_path="$1"
  local child_pid="${2:-}"
  python3 - "$log_path" "$child_pid" <<'PY'
import os, signal, sys, time
path, child_pid = sys.argv[1], sys.argv[2]
deadline = time.time() + 7200
marker = "=== KRONIA CODEX JOB END ==="
stdin_wait_marker = "Reading additional input from stdin..."
stdin_wait_since = None
last_size = -1
while time.time() < deadline:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        size = len(text)
        if marker in text:
            print("done")
            sys.exit(0)
        if stdin_wait_marker in text:
            if size != last_size:
                stdin_wait_since = time.time()
                last_size = size
            elif stdin_wait_since and (time.time() - stdin_wait_since) > 20:
                print("stdin_wait")
                sys.exit(0)
        else:
            last_size = size
            stdin_wait_since = None
    except Exception:
        pass

    if child_pid:
        try:
            os.kill(int(child_pid), 0)
        except OSError:
            print("exited_no_marker")
            sys.exit(0)
        except Exception:
            pass
    time.sleep(5)
print("timeout")
PY
}

if [ -z "$ALLOWED_CHAT_ID" ] || [ "$CHAT_ID_INPUT" != "$ALLOWED_CHAT_ID" ]; then
  echo "ignorado: chat não autorizado" >> "$SUPERVISOR_LOG"
  exit 0
fi

MESSAGE="$(trim_message "$RAW_MESSAGE")"
if [ -z "$MESSAGE" ]; then
  exit 0
fi

CONTEXT_FILE="$(context_file "$CHAT_ID_INPUT")"
LOCK_FILE="$(lock_file "$CHAT_ID_INPUT")"
ACTION_TYPE="$(classify_intent "$MESSAGE")"
LAST_TASK="$(load_context_field "$CONTEXT_FILE" "last_task")"
LAST_REPORT="$(load_context_field "$CONTEXT_FILE" "last_report")"
LAST_JOB_ID="$(load_context_field "$CONTEXT_FILE" "last_job_id")"
LAST_STATUS="$(load_context_field "$CONTEXT_FILE" "status")"
LAST_TIMESTAMP="$(load_context_field "$CONTEXT_FILE" "timestamp")"

TIMESTAMP="$(date -Iseconds)"

case "$ACTION_TYPE" in
  invalid)
    exit 0
    ;;
  state_query)
    send_message "$CHAT_ID_INPUT" "$(build_state_report "$ACTION_TYPE" "$LAST_TASK" "$LAST_TIMESTAMP" "$LAST_JOB_ID" "$LAST_STATUS" "$LAST_REPORT")"
    exit 0
    ;;
  esac

if [ "$(is_stale_running_context "$CONTEXT_FILE" "$TIMESTAMP")" = "1" ]; then
  save_context "$CONTEXT_FILE" "$LAST_TASK" "$ACTION_TYPE" "$TIMESTAMP" "$LAST_JOB_ID" "stale" "" "" "" "$LAST_REPORT"
fi

if [ -f "$LOCK_FILE" ]; then
  LOCK_PID="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    send_message "$CHAT_ID_INPUT" "Tarefa entendida: execução em andamento.\nAção executada: bloqueio de concorrência.\nCorreções aplicadas: nenhuma nova execução foi iniciada.\nArquivos/áreas afetadas: nenhuma alteração nova.\nValidação: já existe um job ativo para este chat.\nEstado atual: aguardando conclusão do job anterior.\nRiscos: iniciar outro fluxo agora causaria concorrência e contexto inconsistente.\nPróximo passo: aguarde o relatório da execução atual."
    exit 0
  fi
fi

echo "$$" > "$LOCK_FILE"
cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

JOB_ID="supervisor-$(date +%Y%m%d-%H%M%S)-$$"
REPORT_PATH="$RUN_DIR/${JOB_ID}.report.txt"
SUMMARY_PATH="$RUN_DIR/${JOB_ID}.summary.txt"
BEFORE_FILE="$RUN_DIR/${JOB_ID}.before"

find "$HOME/kronia-jobs" -maxdepth 1 -type f -name 'job-*.log' -print | sort > "$BEFORE_FILE" 2>/dev/null || true

FINAL_TASK="$(build_task_prompt "$MESSAGE" "$ACTION_TYPE" "$LAST_TASK" "$LAST_REPORT")"
save_context "$CONTEXT_FILE" "$MESSAGE" "$ACTION_TYPE" "$TIMESTAMP" "$JOB_ID" "running" "" "$REPORT_PATH" "$SUMMARY_PATH" ""

if [ "$SILENT_ACK" != "1" ]; then
  send_message "$CHAT_ID_INPUT" "Tarefa entendida: $MESSAGE\nAção executada: supervisão iniciou o job $JOB_ID.\nCorreções aplicadas: prompt técnico enriquecido e contexto anterior acoplado.\nArquivos/áreas afetadas: ainda em processamento.\nValidação: executor será chamado em background sem bloquear o bot.\nEstado atual: running.\nRiscos: nenhum crítico no disparo inicial.\nPróximo passo: aguarde o relatório técnico final."
fi

nohup bash -lc 'exec </dev/null; timeout --signal=TERM "$0" kronia_codex_job.sh "$1"' "$JOB_TIMEOUT_SECONDS" "$FINAL_TASK" >> "$SUPERVISOR_LOG" 2>&1 &
JOB_PROCESS_PID="$!"

JOB_LOG="$(wait_for_new_job_log "$BEFORE_FILE")"
if [ -z "$JOB_LOG" ]; then
  REPORT="Tarefa entendida: $MESSAGE
Ação executada: tentativa de disparo do executor.
Correções aplicadas: nenhuma, porque não consegui localizar o log do job.
Arquivos/áreas afetadas: não determinado.
Validação: falha ao identificar novo arquivo em ~/kronia-jobs.
Estado atual: erro de supervisão.
Riscos: o executor pode ter falhado antes de inicializar o log ou o ambiente pode ter múltiplos jobs externos.
Próximo passo: verificar /root/kronia_codex_job.sh, permissões e PATH do processo."
  printf '%s\n' "$REPORT" > "$REPORT_PATH"
  save_context "$CONTEXT_FILE" "$MESSAGE" "$ACTION_TYPE" "$TIMESTAMP" "$JOB_ID" "failed" "" "$REPORT_PATH" "$SUMMARY_PATH" "$REPORT"
  send_message "$CHAT_ID_INPUT" "$REPORT"
  exit 1
fi

WAIT_STATUS="$(wait_for_job_completion "$JOB_LOG" "$JOB_PROCESS_PID")"
REPORT="$(extract_report_from_log "$JOB_LOG" "$REPORT_PATH")"
printf '%s\n' "$REPORT" > "$SUMMARY_PATH"

FINAL_STATUS="done"
if [ "$WAIT_STATUS" = "timeout" ]; then
  FINAL_STATUS="timeout"
  REPORT="$REPORT"$'\n'"Riscos: o job excedeu o tempo de espera do supervisor e pode ainda estar executando."
  printf '%s\n' "$REPORT" > "$REPORT_PATH"
  printf '%s\n' "$REPORT" > "$SUMMARY_PATH"
elif [ "$WAIT_STATUS" = "stdin_wait" ]; then
  FINAL_STATUS="failed"
  REPORT="Tarefa entendida: $MESSAGE
Ação executada: tentativa de execução técnica via Codex.
Correções aplicadas: nenhuma mudança no repositório, porque o executor travou aguardando entrada padrão (stdin).
Arquivos/áreas afetadas: nenhuma alteração aplicada.
Validação: o job gerou log em $JOB_LOG, mas ficou preso em 'Reading additional input from stdin...'.
Estado atual: falha operacional do executor; tarefa não concluída automaticamente.
Riscos: novas tarefas técnicas podem sofrer o mesmo bloqueio até o executor ser endurecido para modo totalmente não interativo.
Próximo passo: corrigir o launcher do executor para nunca aguardar stdin e reexecutar a tarefa."
  printf '%s\n' "$REPORT" > "$REPORT_PATH"
  printf '%s\n' "$REPORT" > "$SUMMARY_PATH"
elif [ "$WAIT_STATUS" = "exited_no_marker" ]; then
  FINAL_STATUS="failed"
  REPORT="$REPORT"$'\n'"Riscos: o processo do executor terminou sem gravar o marcador final do job; o relatório pode estar incompleto."
  printf '%s\n' "$REPORT" > "$REPORT_PATH"
  printf '%s\n' "$REPORT" > "$SUMMARY_PATH"
fi

save_context "$CONTEXT_FILE" "$MESSAGE" "$ACTION_TYPE" "$(date -Iseconds)" "$JOB_ID" "$FINAL_STATUS" "$JOB_LOG" "$REPORT_PATH" "$SUMMARY_PATH" "$REPORT"
send_message "$CHAT_ID_INPUT" "$(build_delivery_message "$ACTION_TYPE" "$MESSAGE" "$REPORT")"
