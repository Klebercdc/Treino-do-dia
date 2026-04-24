import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getConfig } from "../../scripts/send-telegram-report.mjs";

test("getConfig aceita BOT_TOKEN e CHAT_ID legados do ambiente", async () => {
  const config = await getConfig({
    HOME: "/tmp/does-not-matter",
    BOT_TOKEN: "legacy-token",
    CHAT_ID: "legacy-chat",
    TELEGRAM_API_BASE: "https://example.test",
  });

  assert.equal(config.token, "legacy-token");
  assert.equal(config.chatId, "legacy-chat");
  assert.equal(config.apiBase, "https://example.test");
});

test("getConfig cai para exports do bashrc quando TELEGRAM_* nao estao no ambiente", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "telegram-config-"));
  await fs.writeFile(
    path.join(tempHome, ".bashrc"),
    [
      'export BOT_TOKEN="bashrc-token"',
      'export CHAT_ID="bashrc-chat"',
      'export TELEGRAM_API_BASE="https://bashrc.example.test"',
      "",
    ].join("\n"),
    "utf8"
  );

  const config = await getConfig({ HOME: tempHome });

  assert.equal(config.token, "bashrc-token");
  assert.equal(config.chatId, "bashrc-chat");
  assert.equal(config.apiBase, "https://bashrc.example.test");
});

test("getConfig prioriza TELEGRAM_* sobre variaveis legadas", async () => {
  const config = await getConfig({
    HOME: "/tmp/does-not-matter",
    TELEGRAM_BOT_TOKEN: "canonical-token",
    BOT_TOKEN: "legacy-token",
    TELEGRAM_CHAT_ID: "canonical-chat",
    CHAT_ID: "legacy-chat",
  });

  assert.equal(config.token, "canonical-token");
  assert.equal(config.chatId, "canonical-chat");
});
