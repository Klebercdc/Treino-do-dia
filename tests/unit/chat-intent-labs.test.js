const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function extractFunctionBlock(code, name) {
  const needle = `function ${name}`;
  const start = code.indexOf(needle);
  if (start === -1) throw new Error(`Function ${name} not found`);
  let depth = 0;
  let i = start;
  for (; i < code.length; i += 1) {
    const char = code[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return code.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Unable to extract function ${name}`);
}

function loadIntentClassifier() {
  const code = fs.readFileSync("src/application/kronia-application.js", "utf8");
  const snippets = [
    extractFunctionBlock(code, "normalizeText"),
    extractFunctionBlock(code, "hasAny"),
    extractFunctionBlock(code, "hasLabMention"),
    extractFunctionBlock(code, "classifyConversationIntent"),
  ].join("\n\n");

  const context = { String, RegExp };
  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: "chat-intent-labs-snippet.js" });
  return context.classifyConversationIntent;
}

test("classifyConversationIntent recognizes lab upload requests", () => {
  const classifyConversationIntent = loadIntentClassifier();
  const intent = classifyConversationIntent({
    message: "Preciso enviar o resultado do meu exame laboratorial",
  });
  assert.equal(intent, "lab_upload_request");
});

test('classifyConversationIntent routes "Consegue ver meus exames?" to lab history', () => {
  const classifyConversationIntent = loadIntentClassifier();
  const intent = classifyConversationIntent({
    message: "Consegue ver meus exames?",
  });
  assert.equal(intent, "lab_history_query");
});

test('classifyConversationIntent keeps "Quero enviar um exame" as upload request', () => {
  const classifyConversationIntent = loadIntentClassifier();
  const intent = classifyConversationIntent({
    message: "Quero enviar um exame",
  });
  assert.equal(intent, "lab_upload_request");
});

test("resolveConversationFlow consumes kronia-labs-reports route for lab history", async () => {
  const code = fs.readFileSync("src/application/kronia-application.js", "utf8");
  const calls = [];
  const context = {
    console,
    Date,
    Error,
    Map,
    Number,
    Object,
    Promise,
    RegExp,
    String,
    Array,
    window: {},
    localStorage: { getItem: () => null },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          total: 1,
          reports: [{
            id: "report-1",
            fileName: "hemograma.pdf",
            status: "processed",
            createdAt: "2026-04-18T10:00:00.000Z",
            biomarkers: [{ name: "Ferritina" }, { name: "Vitamina D" }],
            clinicalFlags: ["ferritina baixa"],
            criticalFlags: [],
          }],
        }),
      };
    },
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "kronia-application.js" });

  const result = await context.window.KroniaApplication.application.processChatMessage({
    message: "Consegue ver meus exames?",
  });

  assert.equal(result.data.intent, "lab_history_query");
  assert.equal(result.data.cta, null);
  assert.match(result.data.message, /Encontrei 1 exame salvo/);
  assert.match(result.data.message, /hemograma\.pdf/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/system?__route=kronia-labs-reports&limit=5");
  assert.equal(calls[0].options.credentials, "include");
});
