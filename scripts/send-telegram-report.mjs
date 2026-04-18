#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const MAX_MESSAGE_LENGTH = 3900;
const DOCUMENT_THRESHOLD_CHUNKS = 10;
const DEFAULT_API_BASE = "https://api.telegram.org";

function parseArgs(argv) {
  const args = {
    reportFile: "",
    summaryFile: "",
    title: "KRONIA - Relatorio de Auditoria",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] || "";
    if (arg === "--report-file") {
      args.reportFile = next;
      index += 1;
    } else if (arg === "--summary-file") {
      args.summaryFile = next;
      index += 1;
    } else if (arg === "--title") {
      args.title = next;
      index += 1;
    }
  }

  return args;
}

function chunkText(text, limit = MAX_MESSAGE_LENGTH) {
  const source = String(text || "").trim();
  if (!source) return [];

  const chunks = [];
  let current = "";
  for (const line of source.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);

    let rest = line;
    while (rest.length > limit) {
      chunks.push(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    current = rest;
  }
  if (current) chunks.push(current);
  return chunks;
}

function getConfig(env = process.env) {
  return {
    token: env.TELEGRAM_BOT_TOKEN || "",
    chatId: env.TELEGRAM_CHAT_ID || "",
    apiBase: env.TELEGRAM_API_BASE || DEFAULT_API_BASE,
  };
}

function redactedConfigStatus(config) {
  return {
    TELEGRAM_BOT_TOKEN: Boolean(config.token),
    TELEGRAM_CHAT_ID: Boolean(config.chatId),
  };
}

async function callTelegram(config, method, body) {
  const response = await fetch(`${config.apiBase}/bot${config.token}/${method}`, {
    method: "POST",
    body,
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
  });
  const raw = await response.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  return {
    httpStatus: response.status,
    ok: response.ok && json?.ok === true,
    description: json?.description || "",
  };
}

async function sendMessage(config, text) {
  return callTelegram(
    config,
    "sendMessage",
    JSON.stringify({
      chat_id: config.chatId,
      text,
      disable_web_page_preview: true,
    })
  );
}

async function sendDocument(config, reportText, filename, caption) {
  const data = new FormData();
  data.append("chat_id", config.chatId);
  data.append("caption", caption.slice(0, 1024));
  data.append("document", new Blob([reportText], { type: "text/plain;charset=utf-8" }), filename);
  return callTelegram(config, "sendDocument", data);
}

export async function sendTelegramReport({
  title,
  summary,
  report,
  filename = "kronia-auditoria.txt",
  env = process.env,
} = {}) {
  const config = getConfig(env);
  const configured = redactedConfigStatus(config);
  const baseResult = {
    status: "NÃO CONFIGURADO",
    configured,
    attempted: false,
    summarySent: false,
    chunksAttempted: 0,
    chunksSent: 0,
    documentAttempted: false,
    documentSent: false,
    httpStatuses: [],
    telegramOk: false,
    chunkingUsed: false,
    errors: [],
  };

  if (!configured.TELEGRAM_BOT_TOKEN || !configured.TELEGRAM_CHAT_ID) {
    baseResult.errors.push("Variaveis TELEGRAM_BOT_TOKEN e/ou TELEGRAM_CHAT_ID ausentes.");
    return baseResult;
  }

  const result = { ...baseResult, status: "FALHOU NO ENVIO", attempted: true, errors: [] };
  const safeTitle = String(title || "KRONIA - Relatorio de Auditoria").trim();
  const safeSummary = String(summary || "").trim();
  const safeReport = String(report || "").trim();

  try {
    const summaryResult = await sendMessage(config, `${safeTitle}\n\n${safeSummary}`.trim());
    result.httpStatuses.push({ method: "sendMessage:summary", status: summaryResult.httpStatus });
    result.summarySent = summaryResult.ok;
    if (!summaryResult.ok) result.errors.push(summaryResult.description || "Resumo nao enviado.");

    const chunks = chunkText(safeReport || safeSummary);
    result.chunksAttempted = chunks.length;
    result.chunkingUsed = chunks.length > 1;

    if (chunks.length > DOCUMENT_THRESHOLD_CHUNKS) {
      result.documentAttempted = true;
      const documentResult = await sendDocument(config, safeReport, filename, safeTitle);
      result.httpStatuses.push({ method: "sendDocument", status: documentResult.httpStatus });
      result.documentSent = documentResult.ok;
      if (!documentResult.ok) result.errors.push(documentResult.description || "Documento nao enviado.");
    } else {
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const prefix = chunks.length > 1 ? `[${index + 1}/${chunks.length}]\n` : "";
        const chunkResult = await sendMessage(config, `${prefix}${chunk}`);
        result.httpStatuses.push({ method: `sendMessage:report:${index + 1}`, status: chunkResult.httpStatus });
        if (chunkResult.ok) {
          result.chunksSent += 1;
        } else {
          result.errors.push(chunkResult.description || `Parte ${index + 1} nao enviada.`);
        }
      }
    }

    result.telegramOk = result.summarySent && (
      result.documentAttempted ? result.documentSent : result.chunksSent === result.chunksAttempted
    );
    if (result.telegramOk) {
      result.status = "ENVIADO COM SUCESSO";
    } else if (result.summarySent || result.chunksSent > 0 || result.documentSent) {
      result.status = "ENVIADO PARCIALMENTE";
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

async function readOptionalFile(file) {
  if (!file) return "";
  return fs.readFile(path.resolve(file), "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [summary, report] = await Promise.all([
    readOptionalFile(args.summaryFile),
    readOptionalFile(args.reportFile),
  ]);

  const result = await sendTelegramReport({
    title: args.title,
    summary,
    report,
    filename: "kronia-auditoria-forense.txt",
  });
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({
      status: "FALHOU NO ENVIO",
      attempted: false,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  });
}
