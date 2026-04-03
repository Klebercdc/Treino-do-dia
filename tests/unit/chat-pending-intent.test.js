const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    dump() { return store; }
  };
}

function loadRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippets = [
    extract(code, /var KRONIA_PENDING_INTENT_KEY = 'kronia_pending_conversation_intent_v1';/, 'KRONIA_PENDING_INTENT_KEY'),
    extract(code, /var KRONIA_PENDING_INTENT_TTL_MS = 8 \* 60 \* 1000;/, 'KRONIA_PENDING_INTENT_TTL_MS'),
    extract(code, /var __kroniaPendingIntentConsumeScheduled = false;/, '__kroniaPendingIntentConsumeScheduled'),
    extract(code, /var KRONIA_CTA_ALLOWED_ACTIONS = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_ALLOWED_ACTIONS'),
    extract(code, /var KRONIA_CTA_ACTION_ALIASES = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_ACTION_ALIASES'),
    extract(code, /function sanitizeCtaObject\(value\) \{[\s\S]*?\n\}/, 'sanitizeCtaObject'),
    extract(code, /function normalizeKroniaAction\(action\) \{[\s\S]*?\n\}/, 'normalizeKroniaAction'),
    extract(code, /function resolveCanonicalKroniaAction\(action\) \{[\s\S]*?\n\}/, 'resolveCanonicalKroniaAction'),
    extract(code, /function normalizeConversationIntentType\(action\) \{[\s\S]*?\n\}/, 'normalizeConversationIntentType'),
    extract(code, /function sanitizeConversationIntentPayload\(intentType, payload\) \{[\s\S]*?\n\}/, 'sanitizeConversationIntentPayload'),
    extract(code, /function buildCanonicalConversationIntent\(data\) \{[\s\S]*?\n\}/, 'buildCanonicalConversationIntent'),
    extract(code, /function persistPendingConversationIntent\(intent\) \{[\s\S]*?\n\}/, 'persistPendingConversationIntent'),
    extract(code, /function readPendingConversationIntent\(\) \{[\s\S]*?\n\}/, 'readPendingConversationIntent'),
    extract(code, /function clearPendingConversationIntent\(\) \{[\s\S]*?\n\}/, 'clearPendingConversationIntent'),
    extract(code, /function hydrateTrainingFromConversationIntent\(payload\) \{[\s\S]*?\n\}/, 'hydrateTrainingFromConversationIntent'),
    extract(code, /function hydrateDietFromConversationIntent\(payload\) \{[\s\S]*?\n\}/, 'hydrateDietFromConversationIntent'),
    extract(code, /function consumePendingConversationIntentFromHome\(reason\) \{[\s\S]*?\n\}/, 'consumePendingConversationIntentFromHome'),
  ].join('\n\n');

  const calls = { nav: [], openConfig: [], openDietaSheet: [], events: [] };
  const localStorage = createLocalStorage();
  const document = {
    querySelector() { return null; },
    getElementById() { return null; },
  };

  const context = {
    JSON,
    Date,
    localStorage,
    document,
    selObj() {},
    selNivel() {},
    selDietaObj() {},
    navTo(tab) { calls.nav.push(tab); },
    openConfig(payload) { calls.openConfig.push(payload); },
    openDietaSheet(payload) { calls.openDietaSheet.push(payload); },
    trackKroniaCta(stage, status, metadata) { calls.events.push({ stage, status, metadata }); },
  };

  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'chat-pending-intent-snippets.js' });
  return { context, calls, localStorage };
}

test('persist pending intent stores sanitized canonical envelope', () => {
  const { context, localStorage } = loadRuntime();
  const ok = context.persistPendingConversationIntent({
    type: 'open_training',
    source: 'agent',
    payload: { objective: 'hipertrofia', days_per_week: 4, unsafe: { nested: true } },
  });

  assert.equal(ok, true);
  const raw = localStorage.getItem('kronia_pending_conversation_intent_v1');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.type, 'open_training');
  assert.equal(parsed.payload.objective, 'hipertrofia');
  assert.equal(parsed.payload.days_per_week, 4);
  assert.equal(parsed.payload.unsafe, undefined);
});

test('expired pending intent is discarded and not executed', () => {
  const { context, localStorage, calls } = loadRuntime();
  localStorage.setItem('kronia_pending_conversation_intent_v1', JSON.stringify({
    v: 1,
    type: 'open_diet',
    target: 'home_diet_card',
    source: 'agent',
    payload: { objective: 'emagrecimento' },
    createdAt: Date.now() - (9 * 60 * 1000),
  }));

  const consumed = context.consumePendingConversationIntentFromHome('unit_test');
  assert.equal(consumed, false);
  assert.equal(calls.openDietaSheet.length, 0);
  assert.equal(localStorage.getItem('kronia_pending_conversation_intent_v1'), null);
});

test('home consumes valid pending training intent and opens config with hydrated payload', () => {
  const { context, localStorage, calls } = loadRuntime();
  localStorage.setItem('kronia_pending_conversation_intent_v1', JSON.stringify({
    v: 1,
    type: 'open_training',
    target: 'home_training_card',
    source: 'agent',
    payload: { objective: 'forca', level: 'avancado', days_per_week: 5 },
    createdAt: Date.now(),
  }));

  const consumed = context.consumePendingConversationIntentFromHome('unit_test');
  assert.equal(consumed, true);
  assert.ok(calls.nav.includes('programa'));
  assert.equal(calls.openConfig.length, 1);
  assert.equal(calls.openConfig[0].fromChatIntent, true);
  assert.equal(calls.openConfig[0].source, 'chat');
  assert.equal(localStorage.getItem('kronia_pending_conversation_intent_v1'), null);
});
