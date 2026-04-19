const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function loadCtaRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');

  const snippets = [
    extract(code, /var KRONIA_CTA_ALLOWED_ACTIONS = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_ALLOWED_ACTIONS'),
    extract(code, /var KRONIA_CTA_ACTION_ALIASES = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_ACTION_ALIASES'),
    extract(code, /var KRONIA_PENDING_INTENT_KEY = 'kronia_pending_conversation_intent_v1';/, 'KRONIA_PENDING_INTENT_KEY'),
    extract(code, /var KRONIA_PENDING_INTENT_TTL_MS = 8 \* 60 \* 1000;/, 'KRONIA_PENDING_INTENT_TTL_MS'),
    extract(code, /var __kroniaPendingIntentConsumeScheduled = false;/, '__kroniaPendingIntentConsumeScheduled'),
    extract(code, /var KRONIA_CTA_LOCK_MS = 1200;/, 'KRONIA_CTA_LOCK_MS'),
    extract(code, /var __kroniaCtaExecutionLocks = Object\.create\(null\);/, '__kroniaCtaExecutionLocks'),
    extract(code, /var __kroniaCtaDelegationInstalled = false;/, '__kroniaCtaDelegationInstalled'),
    extract(code, /function trackKroniaCta\(stage, status, metadata\) \{[\s\S]*?\n\}/, 'trackKroniaCta'),
    extract(code, /function parseCtaPayloadAttribute\(payloadRaw\) \{[\s\S]*?\n\}/, 'parseCtaPayloadAttribute'),
    extract(code, /function parseCtaMetaAttribute\(metaRaw\) \{[\s\S]*?\n\}/, 'parseCtaMetaAttribute'),
    extract(code, /function sanitizeCtaObject\(value\) \{[\s\S]*?\n\}/, 'sanitizeCtaObject'),
    extract(code, /function normalizeConversationIntentType\(action\) \{[\s\S]*?\n\}/, 'normalizeConversationIntentType'),
    extract(code, /function sanitizeConversationIntentPayload\(intentType, payload\) \{[\s\S]*?\n\}/, 'sanitizeConversationIntentPayload'),
    extract(code, /function buildCanonicalConversationIntent\(data\) \{[\s\S]*?\n\}/, 'buildCanonicalConversationIntent'),
    extract(code, /function persistPendingConversationIntent\(intent\) \{[\s\S]*?\n\}/, 'persistPendingConversationIntent'),
    extract(code, /function runKroniaActionFallback\(action, context\) \{[\s\S]*?\n\}/, 'runKroniaActionFallback'),
    extract(code, /function normalizeKroniaAction\(action\) \{[\s\S]*?\n\}/, 'normalizeKroniaAction'),
    extract(code, /function resolveCanonicalKroniaAction\(action\) \{[\s\S]*?\n\}/, 'resolveCanonicalKroniaAction'),
    extract(code, /function buildKroniaCtaLockKey\(action, payload, meta\) \{[\s\S]*?\n\}/, 'buildKroniaCtaLockKey'),
    extract(code, /function acquireKroniaCtaExecutionLock\(actionKey\) \{[\s\S]*?\n\}/, 'acquireKroniaCtaExecutionLock'),
    extract(code, /var KRONIA_CTA_EXECUTOR_MAP = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_EXECUTOR_MAP'),
    extract(code, /function executeKroniaCtaAction\(action, context\) \{[\s\S]*?\n\}/, 'executeKroniaCtaAction'),
    extract(code, /window\.handleKroniaCTA = function handleKroniaCTA\(action, payload, meta\) \{[\s\S]*?\n\};/, 'handleKroniaCTA'),
    extract(code, /window\.executeConversationCta = function executeConversationCta\(data\) \{[\s\S]*?\n\};/, 'executeConversationCta'),
    extract(code, /function installConversationCtaDelegation\(\) \{[\s\S]*?\n\}/, 'installConversationCtaDelegation'),
    'installConversationCtaDelegation();'
  ].join('\n\n');

  const calls = {
    navTo: [],
    openConfig: [],
    openDietaSheet: [],
    openDieta: 0,
    openAI: 0,
    trainingAction: [],
    dietAction: [],
    dietWorkspace: [],
    localStorage: new Map()
  };

  const document = {
    clickHandler: null,
    addEventListener(event, handler) {
      if (event === 'click') this.clickHandler = handler;
    }
  };

  const context = {
    window: {
      KroniaActions: {
        openTrainingBuilder(payload) { calls.trainingAction.push(payload); },
        openDietGenerator(payload) { calls.dietAction.push(payload); },
        openDietWorkspace(payload) { calls.dietWorkspace.push(payload); }
      }
    },
    document,
    navTo(tab) { calls.navTo.push(tab); },
    openConfig(payload) { calls.openConfig.push(payload); },
    openDietaSheet(payload) { calls.openDietaSheet.push(payload); },
    openDieta() { calls.openDieta += 1; },
    openAI() { calls.openAI += 1; },
    writeAuditTracePatch() {},
    schedulePendingConversationIntentConsumption() {},
    localStorage: {
      getItem(key) { return calls.localStorage.has(key) ? calls.localStorage.get(key) : null; },
      setItem(key, value) { calls.localStorage.set(key, String(value)); },
      removeItem(key) { calls.localStorage.delete(key); },
    },
    trackKroniaCta() {},
    JSON,
  };
  context.window.localStorage = context.localStorage;
  context.window.location = { href: '' };

  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'cta-snippets.js' });

  return { context, calls, document };
}

function makeTarget(action, payload = {}, label = 'CTA') {
  const attrs = {
    'data-action': action,
    'data-cta-label': label,
    'data-cta-payload': JSON.stringify(payload),
    'data-cta-meta': JSON.stringify({ source: 'test-meta' }),
  };
  return {
    getAttribute(name) { return attrs[name] || ''; },
    closest(selector) {
      if (selector === '.kronia-cta[data-action]') return this;
      return null;
    }
  };
}

test('delegation executes treino CTA action correctly', () => {
  const { document, calls } = loadCtaRuntime();
  const event = { target: makeTarget('open_training', { source: 'test' }), preventDefaultCalled: false, preventDefault() { this.preventDefaultCalled = true; } };
  document.clickHandler(event);
  assert.equal(calls.trainingAction.length, 1);
  assert.equal(calls.dietAction.length, 0);
  assert.equal(calls.trainingAction[0].source, 'test');
  assert.equal(event.preventDefaultCalled, true);
  assert.equal(calls.trainingAction[0].ctaMeta.source, 'test-meta');
});

test('delegation executes dieta CTA action correctly', () => {
  const { document, calls } = loadCtaRuntime();
  document.clickHandler({ target: makeTarget('open_diet', { source: 'test' }) });
  assert.equal(calls.dietWorkspace.length, 1);
  assert.equal(calls.dietAction.length, 0);
  assert.equal(calls.trainingAction.length, 0);
});

test('legacy diet generator alias still opens generator flow', () => {
  const { document, calls } = loadCtaRuntime();
  document.clickHandler({ target: makeTarget('open_diet_generator', { source: 'legacy-diet' }) });
  assert.equal(calls.dietAction.length, 1);
  assert.equal(calls.dietWorkspace.length, 0);
});

test('delegation keeps working after re-render and multiple clicks', () => {
  const { context, document, calls } = loadCtaRuntime();
  document.clickHandler({ target: makeTarget('open_training', { source: 'first' }) });
  assert.equal(calls.trainingAction.length, 1);
  document.clickHandler({ target: makeTarget('open_training', { source: 'second' }) });
  assert.equal(calls.trainingAction.length, 1, 'second click immediate must be deduplicated');
  context.__kroniaCtaExecutionLocks['open_training|CTA|'] = 0;
  document.clickHandler({ target: makeTarget('open_training', { source: 'third' }) });
  assert.equal(calls.trainingAction.length, 2, 'click after lock expiry must execute again');
});

test('legacy action aliases map to canonical actions', () => {
  const { document, calls } = loadCtaRuntime();
  document.clickHandler({ target: makeTarget('open_training_builder', { source: 'legacy-training' }) });
  document.clickHandler({ target: makeTarget('open_diet_generator', { source: 'legacy-diet' }) });
  assert.equal(calls.trainingAction.length, 1);
  assert.equal(calls.dietAction.length, 1);
  assert.equal(calls.dietWorkspace.length, 0);
});

test('listener install is idempotent', () => {
  const { context, document } = loadCtaRuntime();
  const initialHandler = document.clickHandler;
  context.installConversationCtaDelegation();
  assert.equal(document.clickHandler, initialHandler);
});

test('invalid action is rejected by whitelist', () => {
  const { context, calls } = loadCtaRuntime();
  const ok = context.window.handleKroniaCTA('open_admin_console', { source: 'test' }, { label: 'X' });
  assert.equal(ok, false);
  assert.equal(calls.trainingAction.length, 0);
  assert.equal(calls.dietAction.length, 0);
  assert.equal(calls.dietWorkspace.length, 0);
});

test('malformed payload does not break execution', () => {
  const { document, calls } = loadCtaRuntime();
  const target = makeTarget('open_training', { source: 'ok' });
  target.getAttribute = function(name) {
    if (name === 'data-cta-payload') return '{invalid-json';
    if (name === 'data-action') return 'open_training';
    if (name === 'data-cta-label') return 'Treino';
    return '';
  };
  document.clickHandler({ target });
  assert.equal(calls.trainingAction.length, 1);
});

test('malformed meta does not break execution', () => {
  const { document, calls } = loadCtaRuntime();
  const target = makeTarget('open_training', { source: 'ok' });
  target.getAttribute = function(name) {
    if (name === 'data-cta-meta') return '{invalid-meta';
    if (name === 'data-cta-payload') return JSON.stringify({ source: 'safe' });
    if (name === 'data-action') return 'open_training';
    if (name === 'data-cta-label') return 'Treino';
    return '';
  };
  document.clickHandler({ target });
  assert.equal(calls.trainingAction.length, 1);
  assert.equal(calls.trainingAction[0].ctaLabel, 'Treino');
});

test('fallback works when KroniaActions is not ready', () => {
  const { context, calls } = loadCtaRuntime();
  context.window.KroniaActions = {};

  const trainingOk = context.window.handleKroniaCTA('open_training', { source: 'fallback-training' }, { label: 'Treino' });
  const dietOk = context.window.handleKroniaCTA('open_diet', { source: 'fallback-diet' }, { label: 'Dieta' });

  assert.equal(trainingOk, true);
  assert.equal(dietOk, true);
  assert.ok(calls.navTo.includes('inicio'));
  assert.ok(calls.navTo.includes('dieta'));
});

test('open_kronos falls back to chat entrypoint when no mapped executor exists', () => {
  const { context, calls } = loadCtaRuntime();
  context.window.KroniaActions = {};

  const ok = context.window.handleKroniaCTA('open_kronos', { source: 'fallback-chat' }, { label: 'Abrir chat' });

  assert.equal(ok, true);
  assert.ok(calls.navTo.includes('inicio'));
  assert.equal(calls.openAI, 1);
});

test('executeConversationCta preserves provided meta payload', () => {
  const { context, calls } = loadCtaRuntime();
  const ok = context.window.executeConversationCta({
    action: 'open_training',
    payload: { source: 'direct' },
    meta: { label: 'Direct CTA', source: 'custom' }
  });
  assert.equal(ok, true);
  assert.equal(calls.trainingAction.length, 1);
  assert.equal(calls.trainingAction[0].ctaMeta.source, 'custom');
  assert.equal(calls.trainingAction[0].ctaLabel, 'Direct CTA');
});

test('cta click persists pending intent envelope', () => {
  const { context, calls } = loadCtaRuntime();
  const ok = context.window.handleKroniaCTA(
    'open_training',
    { objective: 'hipertrofia', days_per_week: 4 },
    { label: 'Abrir treino', intentSource: 'agent' }
  );
  assert.equal(ok, true);
  const raw = calls.localStorage.get('kronia_pending_conversation_intent_v1');
  assert.ok(raw);
  const pending = JSON.parse(raw);
  assert.equal(pending.type, 'open_training');
  assert.equal(pending.source, 'agent');
  assert.equal(pending.payload.days_per_week, 4);
});
