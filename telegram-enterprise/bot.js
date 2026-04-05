#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");
const { loadContext, saveContext, interpret } = require("./supervisor");

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const API_BASE = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
const API = `${API_BASE}/bot${TOKEN}`;
const OFFSET_FILE = path.join(os.homedir(), ".kronia_offset");
const LOG_DIR = path.join(os.homedir(), "kronia-jobs");
const BOT_LOG = path.join(os.homedir(), "kronia_bot.log");
const RUNNING_FILE = path.join(os.homedir(), ".kronia-supervisor", `running_${CHAT_ID}.json`);

function log(message) {
  fs.appendFileSync(BOT_LOG, `[${new Date().toISOString()}] ${message}\n`);
}

function requireEnv() {
  if (!TOKEN || !CHAT_ID) {
    log("BOT_TOKEN/CHAT_ID ausentes");
    process.exit(1);
  }
}

async function telegram(method, body) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram ${method} falhou: ${response.status} ${text}`);
  }
  return response.json();
}

async function send(message) {
  const text = String(message || "").trim();
  if (!text) return;
  const chunks = [];
  let rest = text;
  while (rest) {
    chunks.push(rest.slice(0, 3500));
    rest = rest.slice(3500);
  }
  for (const chunk of chunks) {
    await telegram("sendMessage", { chat_id: CHAT_ID, text: chunk, disable_web_page_preview: true });
  }
}

async function getUpdates(offset) {
  const params = new URLSearchParams({
    timeout: "30",
    offset: String(offset),
    allowed_updates: JSON.stringify(["message"]),
  });
  const response = await fetch(`${API}/getUpdates?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`getUpdates falhou: ${response.status}`);
  }
  return response.json();
}

function getOffset() {
  try {
    return parseInt(fs.readFileSync(OFFSET_FILE, "utf8"), 10) || 0;
  } catch {
    return 0;
  }
}

function setOffset(offset) {
  fs.writeFileSync(OFFSET_FILE, String(offset));
}

function runningState() {
  try {
    return JSON.parse(fs.readFileSync(RUNNING_FILE, "utf8"));
  } catch {
    return null;
  }
}

function setRunning(state) {
  fs.mkdirSync(path.dirname(RUNNING_FILE), { recursive: true });
  if (!state) {
    try { fs.unlinkSync(RUNNING_FILE); } catch {}
    return;
  }
  fs.writeFileSync(RUNNING_FILE, JSON.stringify(state, null, 2));
}

function latestJobLog(beforeSet) {
  const files = fs.existsSync(LOG_DIR)
    ? fs.readdirSync(LOG_DIR)
        .filter((name) => /^job-.*\.log$/.test(name))
        .map((name) => path.join(LOG_DIR, name))
    : [];
  const candidates = files.filter((file) => !beforeSet.has(file));
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0] || "";
}

function cleanLine(line) {
  return String(line || "").replace(/\u0000/g, "").trimEnd();
}

function extractStructuredSections(logText) {
  const sections = [
    "Tarefa entendida:",
    "Ação executada:",
    "Correções aplicadas:",
    "Arquivos/áreas afetadas:",
    "Validação:",
    "Estado atual:",
    "Riscos:",
    "Próximo passo:",
  ];
  const positions = sections
    .map((header) => ({ header, index: logText.lastIndexOf(header) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (!positions.length) return "";

  const start = positions[0].index;
  const endMarker = "tokens used";
  const endIndex = logText.indexOf(endMarker, start);
  const block = logText.slice(start, endIndex > start ? endIndex : undefined).trim();
  return block;
}

function extractAssistantSummary(logText) {
  const markers = ["\ncodex\n", "\ncodex ", "\nassistant\n", "\nassistant "];
  let start = -1;
  for (const marker of markers) {
    const idx = logText.lastIndexOf(marker);
    if (idx > start) start = idx + marker.length;
  }

  let candidate = start >= 0 ? logText.slice(start) : logText;
  candidate = candidate.split(/\btokens used\b/i)[0];

  const noisyPrefixes = [
    "===",
    "Repo:",
    "Task:",
    "Reading additional input from stdin",
    "OpenAI Codex",
    "workdir:",
    "model:",
    "provider:",
    "approval:",
    "sandbox:",
    "reasoning effort:",
    "reasoning summaries:",
    "session id:",
    "--------",
    "warning:",
    "user",
  ];

  const lines = candidate
    .split("\n")
    .map(cleanLine)
    .filter((line) => line)
    .filter((line) => !noisyPrefixes.some((prefix) => line.startsWith(prefix)))
    .filter((line) => !/^```/.test(line))
    .filter((line) => !/^window\./.test(line))
    .filter((line) => !/^return /.test(line))
    .filter((line) => !/^\)\(\);?$/.test(line));

  const text = lines.join("\n").trim();
  return text.slice(0, 2200);
}

function sectionFromText(text, header) {
  const headers = [
    "Tarefa entendida:",
    "Ação executada:",
    "Correções aplicadas:",
    "Arquivos/áreas afetadas:",
    "Validação:",
    "Estado atual:",
    "Riscos:",
    "Próximo passo:",
  ];
  const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `${escaped(header)}\\s*([\\s\\S]*?)(?=\\n(?:${headers.filter((item) => item !== header).map(escaped).join("|")})|$)`,
    "m"
  );
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function toFriendlyReport(text) {
  const task = sectionFromText(text, "Tarefa entendida:");
  const action = sectionFromText(text, "Ação executada:");
  const fixes = sectionFromText(text, "Correções aplicadas:");
  const files = sectionFromText(text, "Arquivos/áreas afetadas:");
  const validation = sectionFromText(text, "Validação:");
  const state = sectionFromText(text, "Estado atual:");
  const risks = sectionFromText(text, "Riscos:");
  const next = sectionFromText(text, "Próximo passo:");

  const lines = [];
  if (task) lines.push(`Pedido: ${task}`);
  if (action) lines.push(`O que eu fiz: ${action}`);
  if (fixes) lines.push(`Resultado: ${fixes}`);
  if (files) lines.push(`Onde mexe: ${files}`);
  if (validation) lines.push(`Como validei: ${validation}`);
  if (state) lines.push(`Situação agora: ${state}`);
  if (risks) lines.push(`Atenção: ${risks}`);
  if (next) lines.push(`Próximo passo: ${next}`);

  return lines.join("\n\n").trim();
}

function extractRelevant(logText) {
  const structured = extractStructuredSections(logText);
  if (structured) return toFriendlyReport(structured);

  const summary = extractAssistantSummary(logText);
  return [
    "Pedido: execução técnica concluída sem relatório estruturado.",
    "O que eu fiz: li o resultado final do job e removi o excesso de log técnico.",
    "Resultado: montei um resumo mais limpo com o que parecia ser a resposta final útil.",
    "Como validei: extraí só o trecho final não técnico do log.",
    "Situação agora: job finalizado.",
    "Atenção: o relatório original veio desorganizado; este resumo foi montado automaticamente.",
    "Próximo passo: se quiser, eu refaço a mesma tarefa com resposta mais objetiva e sem linguagem técnica.",
    "",
    "Resumo derivado:",
    summary || "Não encontrei um trecho final limpo o suficiente no log para resumir com segurança.",
  ].join("\n");
}

async function runTask(task, chatId) {
  const before = new Set(
    fs.existsSync(LOG_DIR)
      ? fs.readdirSync(LOG_DIR).filter((name) => /^job-.*\.log$/.test(name)).map((name) => path.join(LOG_DIR, name))
      : []
  );

  await send(`Entendi. Vou verificar isso agora no projeto e te respondo com o resultado assim que concluir.\n\nPedido: ${task}`);

  setRunning({ task, startedAt: new Date().toISOString() });
  log(`Executando tarefa: ${task}`);

  exec(`/root/kronia_codex_job.sh ${JSON.stringify(task)} </dev/null`, { shell: "/bin/bash", timeout: 15 * 60 * 1000 }, async (error) => {
    let result = "";
    try {
      const jobLog = latestJobLog(before);
      if (jobLog && fs.existsSync(jobLog)) {
        result = extractRelevant(fs.readFileSync(jobLog, "utf8"));
      } else if (error) {
        result = [
          `Tarefa entendida: ${task}`,
          "Ação executada: tentativa de execução técnica.",
          "Correções aplicadas: nenhuma mudança confirmada.",
          "Arquivos/áreas afetadas: não determinado.",
          `Validação: o executor retornou erro (${error.killed ? "timeout" : "falha"}).`,
          "Estado atual: execução encerrada com falha.",
          "Riscos: o job pode não ter criado log visível.",
          "Próximo passo: revisar o launcher e reexecutar.",
        ].join("\n");
      } else {
        result = "Execução concluída, mas não encontrei um resumo estruturado do job.";
      }

      const ctx = loadContext(chatId);
      ctx.lastTask = task;
      ctx.lastResult = result;
      ctx.updatedAt = new Date().toISOString();
      saveContext(chatId, ctx);

      await send(result);
      log(`Resultado enviado para o chat ${chatId}`);
    } catch (sendError) {
      log(`Falha ao enviar resultado: ${sendError.stack || sendError.message}`);
    } finally {
      setRunning(null);
    }
  });
}

async function bootstrap() {
  requireEnv();
  await fetch(`${API}/deleteWebhook`).catch(() => null);
  log("Bot inicializado");
}

async function loop() {
  let offset = getOffset();
  while (true) {
    try {
      const data = await getUpdates(offset);
      for (const upd of data.result || []) {
        offset = upd.update_id + 1;
        setOffset(offset);

        const msg = upd.message;
        if (!msg || String(msg.chat?.id) !== String(CHAT_ID)) continue;

        const text = String(msg.text || "").trim();
        if (!text) continue;

        log(`Mensagem recebida: ${text}`);
        const ctx = loadContext(CHAT_ID);
        const intent = interpret(text, ctx);

        if (intent.type === "ignore") continue;
        if (intent.type === "help") {
          await send("KRONIA Supervisor online.\n\nUse texto livre, por exemplo:\n- estado atual\n- o que você fez?\n- continue\n- melhore isso\n- arrume o CTA da dieta");
          continue;
        }
        if (intent.type === "chat") {
          await send(intent.reply);
          continue;
        }
        if (intent.type === "status") {
          const run = runningState();
          const current = run
            ? `Estou executando agora: ${run.task}\nInício: ${run.startedAt}`
            : "Não há tarefa em execução neste momento.";
          await send(`${current}\n\nÚltima tarefa: ${ctx.lastTask || "nenhuma"}`);
          continue;
        }
        if (intent.type === "last") {
          await send(ctx.lastResult || `Última tarefa: ${ctx.lastTask || "nenhuma"}`);
          continue;
        }

        if (runningState()) {
          await send("Já estou executando uma tarefa. Aguarde a conclusão antes de iniciar outra.");
          continue;
        }

        await runTask(intent.task, CHAT_ID);
      }
    } catch (error) {
      log(`Loop error: ${error.stack || error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

bootstrap()
  .then(loop)
  .catch((error) => {
    log(`Bootstrap error: ${error.stack || error.message}`);
    process.exit(1);
  });
