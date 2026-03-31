const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyIntent } = require('../../src/core/intent/intentClassifier');
const { decideAction } = require('../../src/core/decision/decisionEngine');
const { planGate } = require('../../src/core/plans/planGate');
const { runKroniaPipeline } = require('../../src/core/pipeline/runKroniaPipeline');

test('intent classifier returns fixed contract', () => {
  const out = classifyIntent('Quero montar treino de hipertrofia');
  assert.equal(out.intent, 'WORKOUT_CREATE');
  assert.equal(out.domain, 'workout');
  assert.equal(typeof out.confidence, 'number');
  assert.equal(typeof out.needs_clarification, 'boolean');
});

test('decision engine asks single clarification for low confidence', () => {
  const decision = decideAction({ intent: 'OTHER', confidence: 0.4, needs_clarification: true, domain: 'general' });
  assert.equal(decision.action, 'ASK_SINGLE_CLARIFICATION');
});

test('plan gate blocks premium action for free plan', () => {
  const gate = planGate({ plan: 'free', action: 'GENERATE_DIET' });
  assert.equal(gate.allowed, false);
});

test('pipeline returns unified response contract', async () => {
  const result = await runKroniaPipeline({
    userMessage: 'quero treino abc',
    userPlan: 'PRO',
    payload: { goal: 'hipertrofia' },
  });

  assert.equal(result.response.success, true);
  assert.ok(result.response.intent);
  assert.ok(result.response.action);
  assert.ok(result.response.domain);
  assert.equal(result.response.error, null);
});
