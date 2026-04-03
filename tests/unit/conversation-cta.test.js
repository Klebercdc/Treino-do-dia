const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadApplication() {
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
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'kronia-application.js' });
  return context.window.KroniaApplication.application;
}

test('CTA workout resolves to open_training_builder', async () => {
  const app = loadApplication();
  const result = await app.resolveConversationFlow({ message: 'quero montar um treino hoje' });
  assert.equal(result.type, 'answer_with_cta');
  assert.equal(result.cta.action, 'open_training_builder');
  assert.equal(result.cta.label, 'Abrir treino');
});

test('CTA diet resolves to open_diet_generator', async () => {
  const app = loadApplication();
  const result = await app.resolveConversationFlow({ message: 'preciso de uma dieta para secar' });
  assert.equal(result.type, 'answer_with_cta');
  assert.equal(result.cta.action, 'open_diet_generator');
  assert.equal(result.cta.label, 'Abrir dieta');
});
