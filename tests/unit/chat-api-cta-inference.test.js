const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function loadInferenceRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippets = [
    extract(code, /var KRONIA_CTA_ALLOWED_ACTIONS = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_ALLOWED_ACTIONS'),
    extract(code, /var KRONIA_CTA_ACTION_ALIASES = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_ACTION_ALIASES'),
    extract(code, /function sanitizeCtaObject\(value\) \{[\s\S]*?\n\}/, 'sanitizeCtaObject'),
    extract(code, /function normalizeKroniaAction\(action\) \{[\s\S]*?\n\}/, 'normalizeKroniaAction'),
    extract(code, /function resolveCanonicalKroniaAction\(action\) \{[\s\S]*?\n\}/, 'resolveCanonicalKroniaAction'),
    extract(code, /function normalizeConversationIntentType\(action\) \{[\s\S]*?\n\}/, 'normalizeConversationIntentType'),
    extract(code, /function sanitizeConversationIntentPayload\(intentType, payload\) \{[\s\S]*?\n\}/, 'sanitizeConversationIntentPayload'),
    extract(code, /function buildCanonicalConversationIntent\(data\) \{[\s\S]*?\n\}/, 'buildCanonicalConversationIntent'),
    extract(code, /function inferConversationCtaFromApiResponse\(payload\) \{[\s\S]*?\n\}/, 'inferConversationCtaFromApiResponse'),
  ].join('\n\n');

  const context = { JSON, trackKroniaCta() {} };
  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'chat-api-cta-inference.js' });
  return context;
}

test('inferConversationCtaFromApiResponse maps explicit treino action to canonical CTA', () => {
  const runtime = loadInferenceRuntime();
  const cta = runtime.inferConversationCtaFromApiResponse({
    shouldCreateButton: true,
    action: 'abrir_tela_treino_com_payload',
    buttonType: 'treino',
    workoutPayload: { source: 'ai', block: { ok: true } },
  });

  assert.ok(cta);
  assert.equal(cta.type, 'open_training');
  assert.equal(cta.label, 'Abrir treino');
  assert.equal(typeof cta.payload, 'object');
});

test('inferConversationCtaFromApiResponse infers dieta CTA from textual fallback safely', () => {
  const runtime = loadInferenceRuntime();
  const cta = runtime.inferConversationCtaFromApiResponse({
    shouldCreateButton: false,
    message: 'Perfeito, posso abrir a dieta oficial para você agora.',
    dietPayload: { objective: 'cut' },
  });

  assert.ok(cta);
  assert.equal(cta.type, 'open_diet');
  assert.equal(cta.meta.inferred_from, 'textual_fallback');
});

test('inferConversationCtaFromApiResponse ignores non-actionable chat replies', () => {
  const runtime = loadInferenceRuntime();
  const cta = runtime.inferConversationCtaFromApiResponse({
    shouldCreateButton: false,
    action: 'responder_chat',
    buttonType: null,
    message: 'Boa pergunta. Continue assim com constância e sono adequado.',
  });

  assert.equal(cta, null);
});
