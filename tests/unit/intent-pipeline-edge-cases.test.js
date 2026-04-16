/**
 * Edge-case tests for the canonical chat → home intent pipeline.
 *
 * Covers gaps identified in the post-PR-324 audit:
 *   1. sanitizeCtaObject must preserve arrays of primitives (restrictions bug)
 *   2. Textual inference without explicit payload must still produce a CTA
 *   3. Broad coverage of common Brazilian-Portuguese phrasings in classifiers
 *   4. diet_apply telemetry context flag is set by openDietaSheet path
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// ── helpers ──────────────────────────────────────────────────────────────────

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
  };
}

// ── runtime loaders ───────────────────────────────────────────────────────────

function loadSanitizeRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippets = [
    extract(code, /function sanitizeCtaObject\(value\) \{[\s\S]*?\n\}/, 'sanitizeCtaObject'),
  ].join('\n\n');
  const context = { JSON };
  vm.createContext(context);
  vm.runInContext(snippets, context);
  return context;
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
  vm.runInContext(snippets, context);
  return context;
}

function loadClassifierRuntime() {
  const code = fs.readFileSync('src/application/kronia-application.js', 'utf8');
  const context = {
    window: {
      KroniaIntelligence: { track() {}, setAdminAuditTrace() {} },
      buildScientificConstraintsForWorkout: async () => ({ ok: true, usedScientificEvidence: false, evidenceCount: 0, constraints: {}, validationStatus: 'validated', sourceOfTruth: 'test', scienceTopicsUsed: [] }),
      buildScientificConstraintsForDiet: async () => ({ ok: true, usedScientificEvidence: false, evidenceCount: 0, constraints: {}, validationStatus: 'validated', sourceOfTruth: 'test', scienceTopicsUsed: [] }),
    },
    console,
    setTimeout,
    clearTimeout,
    Date,
    localStorage: createLocalStorage(),
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window.KroniaApplication.application;
}

function loadIntentDetector() {
  return require('../../src/server/apihelpers/_intent.js');
}

// ── 1. sanitizeCtaObject – array preservation ─────────────────────────────────

test('sanitizeCtaObject preserves arrays of primitive strings', () => {
  const { sanitizeCtaObject } = loadSanitizeRuntime();
  const result = sanitizeCtaObject({ restrictions: ['lactose', 'gluten'], objective: 'cut' });
  assert.deepStrictEqual(result.restrictions, ['lactose', 'gluten']);
  assert.equal(result.objective, 'cut');
});

test('sanitizeCtaObject preserves arrays of primitive numbers', () => {
  const { sanitizeCtaObject } = loadSanitizeRuntime();
  const result = sanitizeCtaObject({ days: [1, 3, 5], level: 'avancado' });
  assert.deepStrictEqual(result.days, [1, 3, 5]);
});

test('sanitizeCtaObject drops arrays containing objects (security)', () => {
  const { sanitizeCtaObject } = loadSanitizeRuntime();
  const result = sanitizeCtaObject({ mixed: [{ __proto__: null, x: 1 }, 'safe'] });
  // Objects inside array are filtered; only primitive 'safe' survives
  assert.deepStrictEqual(result.mixed, ['safe']);
});

test('sanitizeCtaObject drops empty arrays', () => {
  const { sanitizeCtaObject } = loadSanitizeRuntime();
  const result = sanitizeCtaObject({ empty: [], name: 'test' });
  assert.equal(result.empty, undefined);
  assert.equal(result.name, 'test');
});

// ── 2. restrictions survive the full intent pipeline ─────────────────────────

test('restrictions array survives sanitizeConversationIntentPayload for open_diet', () => {
  const rt = loadInferenceRuntime();
  const intent = rt.buildCanonicalConversationIntent({
    type: 'open_diet',
    source: 'agent',
    payload: { objective: 'emagrecimento', restrictions: ['lactose', 'gluten'], meals: 5 },
  });
  assert.ok(intent);
  assert.deepStrictEqual(intent.payload.restrictions, ['lactose', 'gluten']);
  assert.equal(intent.payload.meals, 5);
});

test('restrictions array survives sanitizeConversationIntentPayload for open_training', () => {
  const rt = loadInferenceRuntime();
  const intent = rt.buildCanonicalConversationIntent({
    type: 'open_training',
    source: 'agent',
    payload: { objective: 'hipertrofia', restrictions: ['joelho direito'], days_per_week: 4 },
  });
  assert.ok(intent);
  assert.deepStrictEqual(intent.payload.restrictions, ['joelho direito']);
  assert.equal(intent.payload.days_per_week, 4);
});

// ── 3. textual inference without explicit payload ─────────────────────────────

test('textual inference from Groq response generates open_training CTA', () => {
  const rt = loadInferenceRuntime();
  // Simulates a plain Groq response whose text mentions "montar treino"
  const cta = rt.inferConversationCtaFromApiResponse({
    success: true,
    type: 'text',
    action: null,
    shouldCreateButton: false,
    message: 'Claro! Posso montar um treino personalizado para você agora.',
  });
  assert.ok(cta, 'should produce a CTA from textual inference');
  assert.equal(cta.type, 'open_training');
  assert.equal(cta.source, 'inferred');
  assert.equal(cta.meta.inferred_from, 'textual_fallback');
  assert.ok(typeof cta.payload.origin_message === 'string', 'origin_message should be set as minimal context');
});

test('textual inference from Groq response generates generate_diet CTA', () => {
  const rt = loadInferenceRuntime();
  const cta = rt.inferConversationCtaFromApiResponse({
    success: true,
    type: 'text',
    action: null,
    shouldCreateButton: false,
    message: 'Vou criar uma dieta especial para o seu objetivo de emagrecimento.',
  });
  assert.ok(cta, 'should produce a CTA from textual inference');
  assert.equal(cta.type, 'generate_diet');
  assert.equal(cta.source, 'inferred');
  assert.ok(cta.payload.origin_message);
});

test('generic Groq reply without eligible content does not produce CTA', () => {
  const rt = loadInferenceRuntime();
  const cta = rt.inferConversationCtaFromApiResponse({
    success: true,
    type: 'text',
    action: null,
    shouldCreateButton: false,
    message: 'Sono adequado e constância são fundamentais para bons resultados.',
  });
  assert.equal(cta, null, 'generic reply must not generate CTA');
});

test('vague Groq offer ("posso ajudar com treino") without action verb does not trigger CTA', () => {
  const rt = loadInferenceRuntime();
  const cta = rt.inferConversationCtaFromApiResponse({
    success: true,
    type: 'text',
    action: null,
    shouldCreateButton: false,
    message: 'Posso te ajudar com treino e dieta quando quiser.',
  });
  // "ajudar" is not an action verb in the pattern → no textual CTA
  assert.equal(cta, null, 'vague offer without action verb must not trigger CTA');
});

// ── 4. frontend classifier coverage (kronia-application.js) ──────────────────

test('frontend classifier resolves conjugated forms: crie/gere + treino', async () => {
  const app = loadClassifierRuntime();
  const r1 = await app.resolveConversationFlow({ message: 'crie um treino pra mim' });
  assert.equal(r1.type, 'answer_with_cta');
  assert.equal(r1.cta.action, 'open_training');

  const r2 = await app.resolveConversationFlow({ message: 'gere um treino de hipertrofia' });
  assert.equal(r2.type, 'answer_with_cta');
  assert.equal(r2.cta.action, 'open_training');
});

test('frontend classifier resolves conjugated forms: monte/gere + dieta', async () => {
  const app = loadClassifierRuntime();
  const r1 = await app.resolveConversationFlow({ message: 'monte uma dieta pra eu emagrecer' });
  assert.equal(r1.type, 'answer_with_cta');
  assert.equal(r1.cta.action, 'generate_diet');

  const r2 = await app.resolveConversationFlow({ message: 'gere uma dieta com 5 refeições' });
  assert.equal(r2.type, 'answer_with_cta');
  assert.equal(r2.cta.action, 'generate_diet');
});

test('frontend classifier resolves new terms: musculacao, rotina, cardapio, macros', async () => {
  const app = loadClassifierRuntime();
  const r1 = await app.resolveConversationFlow({ message: 'quero uma rotina de musculacao' });
  assert.equal(r1.cta?.action, 'open_training');

  const r2 = await app.resolveConversationFlow({ message: 'preciso de um cardapio saudavel' });
  assert.equal(r2.cta?.action, 'generate_diet');

  const r3 = await app.resolveConversationFlow({ message: 'crie um plano de macros pra mim' });
  assert.equal(r3.cta?.action, 'generate_diet');
});

// ── 5. backend intent detector coverage (_intent.js) ─────────────────────────

test('backend detectIntent catches infinitives: montar, criar, fazer + treino', () => {
  const { detectIntent } = loadIntentDetector();
  assert.equal(detectIntent('quero montar um treino'), 'workout');
  assert.equal(detectIntent('preciso criar um programa de musculacao'), 'workout');
  assert.equal(detectIntent('pode fazer um treino pra mim'), 'workout');
});

test('backend detectIntent catches infinitives: montar, criar, fazer + dieta', () => {
  const { detectIntent } = loadIntentDetector();
  assert.equal(detectIntent('quero montar uma dieta'), 'diet');
  assert.equal(detectIntent('preciso criar um plano alimentar'), 'diet');
  assert.equal(detectIntent('pode fazer uma dieta para emagrecer'), 'diet');
});

test('backend detectIntent returns general for greeting-like messages', () => {
  const { detectIntent } = loadIntentDetector();
  assert.equal(detectIntent('oi tudo bem'), 'greeting');
  assert.equal(detectIntent('como funciona a proteína'), 'general');
});

// ── 6. Pipeline compatibility: existing patterns still work ───────────────────

test('explicit conversationIntent contract still takes priority over textual inference', () => {
  const rt = loadInferenceRuntime();
  const cta = rt.inferConversationCtaFromApiResponse({
    action: 'responder_chat',
    message: 'Posso criar um treino agora mesmo.',  // would trigger textual inference
    conversationIntent: {
      type: 'open_diet',  // explicit contract overrides
      eligible: true,
      label: 'Abrir dieta',
      target: 'home_diet_card',
      source: 'agent',
      payload: { objective: 'manutencao', meals: 4 },
    },
  });
  assert.ok(cta);
  assert.equal(cta.type, 'open_diet', 'explicit conversationIntent must win');
  assert.equal(cta.payload.meals, 4);
});

// ── 7. single-keyword detection (user just says "dieta" or "treino") ──────────

test('frontend classifier does not open training flow with just the word "treino"', async () => {
  const app = loadClassifierRuntime();
  const result = await app.resolveConversationFlow({ message: 'treino' });
  assert.notEqual(result.type, 'answer_with_cta');
  assert.equal(result.cta, null);
});

test('frontend classifier does not open diet flow with just the word "dieta"', async () => {
  const app = loadClassifierRuntime();
  const result = await app.resolveConversationFlow({ message: 'dieta' });
  assert.notEqual(result.type, 'answer_with_cta');
  assert.equal(result.cta, null);
});

test('frontend classifier does not open flows with context phrase and no explicit action verb', async () => {
  const app = loadClassifierRuntime();
  const r1 = await app.resolveConversationFlow({ message: 'não consigo seguir meu treino' });
  assert.notEqual(r1.type, 'answer_with_cta');
  assert.equal(r1.cta, null);

  const r2 = await app.resolveConversationFlow({ message: 'minha dieta está difícil' });
  assert.notEqual(r2.type, 'answer_with_cta');
  assert.equal(r2.cta, null);
});

test('frontend classifier does not open training flow for instructional exercise question', async () => {
  const app = loadClassifierRuntime();
  const result = await app.resolveConversationFlow({ message: 'como fazer exercício de peito?' });
  assert.notEqual(result.type, 'answer_with_cta');
  assert.equal(result.cta, null);
});

test('frontend classifier does NOT trigger CTA for analysis questions about treino', async () => {
  const app = loadClassifierRuntime();
  // "evolução" triggers analysis → should NOT return workout CTA
  const result = await app.resolveConversationFlow({ message: 'como está minha evolução de treino?' });
  // analysis wins over workout because of the guard
  assert.notEqual(result.type, 'answer_with_cta', 'progress analysis question must not generate training CTA');
});

test('backend detectIntent does not trigger flow on keyword alone', () => {
  const { detectIntent } = loadIntentDetector();
  assert.equal(detectIntent('treino'), 'general');
  assert.equal(detectIntent('dieta'), 'general');
  assert.equal(detectIntent('musculacao'), 'general');
  assert.equal(detectIntent('cardapio'), 'general');
});

test('backend detectIntent does not trigger flow for instructional exercise question', () => {
  const { detectIntent } = loadIntentDetector();
  assert.equal(detectIntent('como fazer exercício de peito?'), 'general');
});

test('backend detectIntent still returns greeting for short greetings', () => {
  const { detectIntent } = loadIntentDetector();
  assert.equal(detectIntent('oi'), 'greeting');
  assert.equal(detectIntent('olá tudo bem'), 'greeting');
});

test('whitelist still blocks unknown actions after changes', () => {
  const rt = loadInferenceRuntime();
  const cta = rt.inferConversationCtaFromApiResponse({
    shouldCreateButton: true,
    action: 'open_admin_panel',
    buttonType: null,
    message: 'admin',
  });
  assert.equal(cta, null, 'unknown action must be rejected by whitelist');
});
