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

test("classifyConversationIntent recognizes lab upload requests", () => {
  const code = fs.readFileSync("src/application/kronia-application.js", "utf8");
  const snippets = [
    extractFunctionBlock(code, "normalizeText"),
    extractFunctionBlock(code, "hasAny"),
    extractFunctionBlock(code, "classifyConversationIntent"),
  ].join("\n\n");

  const context = { String, RegExp };
  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: "chat-intent-labs-snippet.js" });

  const intent = context.classifyConversationIntent({
    message: "Preciso enviar o resultado do meu exame laboratorial",
  });
  assert.equal(intent, "lab_upload_request");
});
