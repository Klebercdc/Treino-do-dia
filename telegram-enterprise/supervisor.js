#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const BASE = path.join(process.env.HOME || ".", ".kronia-supervisor");
fs.mkdirSync(BASE, { recursive: true });

function contextPath(chatId) {
  return path.join(BASE, `context_${chatId}.json`);
}

function loadContext(chatId) {
  try {
    return JSON.parse(fs.readFileSync(contextPath(chatId), "utf8"));
  } catch {
    return {};
  }
}

function saveContext(chatId, context) {
  fs.writeFileSync(contextPath(chatId), JSON.stringify(context, null, 2));
}

function interpret(message, context) {
  const text = String(message || "").trim();
  const msg = text.toLowerCase();
  const lastTask = context.lastTask || "";

  if (!text) return { type: "ignore" };
  if (msg === "/start" || msg === "/ajuda" || msg === "ajuda") {
    return { type: "help" };
  }
  if (/(^|\b)(bom dia|boa tarde|boa noite|oi|olá|ola)(\b|$)/.test(msg)) {
    return { type: "chat", reply: "Estou online. Pode falar comigo em texto livre, por exemplo: 'estado atual', 'o que você fez?' ou 'arrume o CTA da dieta'." };
  }
  if (msg.includes("estado atual") || msg.includes("status atual") || msg === "estado") {
    return { type: "status" };
  }
  if (msg.includes("o que você fez") || msg.includes("última tarefa") || msg.includes("ultima tarefa")) {
    return { type: "last" };
  }
  if (msg.includes("continue")) {
    return { type: "continue", task: lastTask || "continue a última tarefa relevante do chat" };
  }
  if (msg.includes("refaça") || msg.includes("refaca") || msg.includes("melhore")) {
    return { type: "refine", task: lastTask ? `Refaça melhor e endureça a entrega anterior: ${lastTask}` : text };
  }
  return { type: "new", task: text };
}

module.exports = {
  BASE,
  loadContext,
  saveContext,
  interpret,
};
