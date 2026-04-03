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
    extract(code, /function runKroniaActionFallback\(action, context\) \{[\s\S]*?\n\}/, 'runKroniaActionFallback'),
    extract(code, /function normalizeKroniaAction\(action\) \{[\s\S]*?\n\}/, 'normalizeKroniaAction'),
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
    trainingAction: [],
    dietAction: []
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
        openDietGenerator(payload) { calls.dietAction.push(payload); }
      }
    },
    document,
    navTo(tab) { calls.navTo.push(tab); },
    openConfig(payload) { calls.openConfig.push(payload); },
    openDietaSheet(payload) { calls.openDietaSheet.push(payload); },
    openDieta() { calls.openDieta += 1; },
    writeAuditTracePatch() {},
    JSON,
  };

  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'cta-snippets.js' });

  return { context, calls, document };
}

function makeTarget(action, payload = {}, label = 'CTA') {
  const attrs = {
    'data-action': action,
    'data-cta-label': label,
    'data-cta-payload': JSON.stringify(payload),
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
  document.clickHandler({ target: makeTarget('open_training', { source: 'test' }) });
  assert.equal(calls.trainingAction.length, 1);
  assert.equal(calls.dietAction.length, 0);
  assert.equal(calls.trainingAction[0].source, 'test');
});

test('delegation executes dieta CTA action correctly', () => {
  const { document, calls } = loadCtaRuntime();
  document.clickHandler({ target: makeTarget('open_diet', { source: 'test' }) });
  assert.equal(calls.dietAction.length, 1);
  assert.equal(calls.trainingAction.length, 0);
});

test('delegation keeps working after re-render and multiple clicks', () => {
  const { document, calls } = loadCtaRuntime();
  document.clickHandler({ target: makeTarget('open_training', { source: 'first' }) });
  document.clickHandler({ target: makeTarget('open_training', { source: 'second' }) });
  document.clickHandler({ target: makeTarget('open_training', { source: 'third' }) });
  assert.equal(calls.trainingAction.length, 3);
  assert.deepEqual(calls.trainingAction.map((x) => x.source), ['first', 'second', 'third']);
});

test('legacy action aliases map to canonical actions', () => {
  const { document, calls } = loadCtaRuntime();
  document.clickHandler({ target: makeTarget('open_training_builder', { source: 'legacy-training' }) });
  document.clickHandler({ target: makeTarget('open_diet_generator', { source: 'legacy-diet' }) });
  assert.equal(calls.trainingAction.length, 1);
  assert.equal(calls.dietAction.length, 1);
});

test('fallback works when KroniaActions is not ready', () => {
  const { context, calls } = loadCtaRuntime();
  context.window.KroniaActions = {};

  const trainingOk = context.window.handleKroniaCTA('open_training', { source: 'fallback-training' }, { label: 'Treino' });
  const dietOk = context.window.handleKroniaCTA('open_diet', { source: 'fallback-diet' }, { label: 'Dieta' });

  assert.equal(trainingOk, true);
  assert.equal(dietOk, true);
  assert.ok(calls.navTo.includes('programa'));
  assert.equal(calls.openConfig.length, 1);
  assert.equal(calls.openDietaSheet.length, 1);
});
