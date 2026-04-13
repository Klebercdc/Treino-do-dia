'use strict';

/**
 * Unit tests for _kronosContextHub.js
 *
 * Tests are designed to work without a live Supabase connection by
 * mocking the `_plans` dependency (supabaseRequest).
 *
 * Coverage matrix (per spec):
 *  1.  User with valid labs => inventory.hasLabReports = true
 *  2.  User with memory state => coachingSummary available
 *  3.  Labs intent => selectContextForIntent picks labs, NOT training
 *  4.  Workout intent => selectContextForIntent picks training/recovery/memory
 *  5.  Diet intent => selectContextForIntent picks profile/nutrition
 *  6.  Without labs => system still builds context (profile + training)
 *  7.  Without nutrition plan => system still builds context (training + memory)
 *  8.  Progress review => mixed context (training + nutrition + labs + memory)
 *  9.  deriveKronosIntent maps topics correctly
 * 10.  formatContextForPrompt includes [KRONOS TEM ACESSO A] line
 * 11.  formatContextForPrompt includes [KRONOS NÃO TEM] when data missing
 * 12.  Lab critical flags appear in formatted prompt
 * 13.  Science context does NOT appear when hub.science is null
 * 14.  Diet topic override does not capture labs classification
 * 15.  Lab decision engine action is call_llm_full/short (not open_workout_flow)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// Module mock helpers
// ─────────────────────────────────────────────────────────────

function buildMockPlans(rows) {
  return {
    supabaseRequest: function (method, path, body, callback) {
      // Resolve with rows based on path pattern
      var result = (typeof rows === 'function') ? rows(method, path, body) : rows;
      setImmediate(function () { callback(null, result || []); });
    }
  };
}

function loadHubWithMocks(plansMock, memoryMock) {
  // Temporarily intercept require for _plans and _userMemory
  var originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    var resolved;
    try { resolved = Module._resolveFilename(request, parent); } catch (e) { resolved = request; }
    if (resolved.endsWith('_plans.js') || request === './_plans') return plansMock;
    if (resolved.endsWith('_userMemory.js') || request === './_userMemory') return memoryMock;
    return originalLoad.apply(this, arguments);
  };

  // Clear cached version to force reload with mocks
  var hubPath = path.resolve(__dirname, '../../src/server/apihelpers/_kronosContextHub.js');
  delete require.cache[hubPath];
  var hub;
  try {
    hub = require(hubPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[hubPath]; // don't pollute other tests
  }
  return hub;
}

// ─────────────────────────────────────────────────────────────
// Load module without DB — tests that don't need Supabase
// ─────────────────────────────────────────────────────────────

// For pure-logic tests (no DB calls) we can load the real module
// after providing a no-op plans mock once.
var NO_OP_PLANS = buildMockPlans([]);
var NO_OP_MEMORY = {
  getUserMemorySnapshot: async function () { return null; },
  getCoachingSummary: async function () { return null; }
};

function freshHub(planRows, memorySummary) {
  var plansMock = buildMockPlans(planRows || []);
  var memMock = Object.assign({}, NO_OP_MEMORY, {
    getCoachingSummary: async function () { return memorySummary || null; }
  });
  return loadHubWithMocks(plansMock, memMock);
}

// ─────────────────────────────────────────────────────────────
// 9. deriveKronosIntent — no mocks needed, pure function
// ─────────────────────────────────────────────────────────────

test('deriveKronosIntent: labs topic => LAB_ANALYSIS', function () {
  var hub = freshHub();
  var intent = hub.deriveKronosIntent('labs', 'question');
  assert.equal(intent, hub.KRONOS_INTENT.LAB_ANALYSIS);
});

test('deriveKronosIntent: exams topic => LAB_ANALYSIS', function () {
  var hub = freshHub();
  var intent = hub.deriveKronosIntent('exams', 'question');
  assert.equal(intent, hub.KRONOS_INTENT.LAB_ANALYSIS);
});

test('deriveKronosIntent: workout + request => WORKOUT_PLANNING', function () {
  var hub = freshHub();
  assert.equal(hub.deriveKronosIntent('workout', 'request'), hub.KRONOS_INTENT.WORKOUT_PLANNING);
});

test('deriveKronosIntent: workout + question => WORKOUT_FEEDBACK', function () {
  var hub = freshHub();
  assert.equal(hub.deriveKronosIntent('workout', 'question'), hub.KRONOS_INTENT.WORKOUT_FEEDBACK);
});

test('deriveKronosIntent: diet + request => NUTRITION_PLANNING', function () {
  var hub = freshHub();
  assert.equal(hub.deriveKronosIntent('diet', 'request'), hub.KRONOS_INTENT.NUTRITION_PLANNING);
});

test('deriveKronosIntent: progress => PROGRESS_REVIEW', function () {
  var hub = freshHub();
  assert.equal(hub.deriveKronosIntent('progress', 'question'), hub.KRONOS_INTENT.PROGRESS_REVIEW);
});

test('deriveKronosIntent: recovery => RECOVERY_ANALYSIS', function () {
  var hub = freshHub();
  assert.equal(hub.deriveKronosIntent('recovery', 'question'), hub.KRONOS_INTENT.RECOVERY_ANALYSIS);
});

// ─────────────────────────────────────────────────────────────
// 3. Labs intent => context selector picks labs, not training CTA
// ─────────────────────────────────────────────────────────────

test('selectContextForIntent: LAB_ANALYSIS picks labs, no training block', function () {
  var hub = freshHub();
  var fakeHub = {
    inventory: { hasLabReports: true, hasTrainingHistory: true, hasNutritionPlan: false, hasProfile: true, hasMemoryState: false },
    profile: { name: 'Test', age: 30, sex: 'masculino', weightKg: 80, heightCm: 175, goal: 'hipertrofia', athleteLevel: 'intermediario', restrictions: [] },
    training: { lastWorkoutAt: '2025-01-01', weeklyFrequency: 3, performanceTrend: 'improving', adherenceStatus: 'high', recoveryStatus: 'adequate', fatigueStatus: 'managed', trainingTolerance: 'adequate', objectiveAlignment: 'aligned', topExercises: [] },
    nutrition: null,
    labs: { lastReportAt: '2025-01-10', summaryText: 'Hemograma normal.', clinicalFlags: ['ferritina baixa'], criticalFlags: [], readinessSignal: 'ok', hormonalSignal: null, metabolicSignal: null, keyMarkers: [] },
    progress: null,
    memory: { coachingSummary: 'Bom progresso.', updatedAt: null },
    science: null,
    missingData: []
  };

  var selected = hub.selectContextForIntent(fakeHub, hub.KRONOS_INTENT.LAB_ANALYSIS);
  assert.ok(selected.labs, 'labs should be selected');
  assert.ok(selected.profile, 'profile may be included for clinical context');
  assert.equal(selected.training, undefined, 'training should NOT be selected for lab_analysis');
  assert.equal(selected.memory, undefined, 'memory should NOT be selected for lab_analysis');
});

// ─────────────────────────────────────────────────────────────
// 4. Workout intent => training is included
// ─────────────────────────────────────────────────────────────

test('selectContextForIntent: WORKOUT_PLANNING picks training + memory + profile', function () {
  var hub = freshHub();
  var fakeHub = {
    inventory: { hasLabReports: false, hasTrainingHistory: true, hasNutritionPlan: false, hasProfile: true, hasMemoryState: true },
    profile: { name: 'Test', goal: 'hipertrofia', weightKg: 80, restrictions: [] },
    training: { lastWorkoutAt: '2025-01-01', weeklyFrequency: 4, performanceTrend: 'improving', adherenceStatus: 'high', recoveryStatus: 'adequate', fatigueStatus: 'managed', trainingTolerance: 'adequate', objectiveAlignment: 'aligned', topExercises: [] },
    nutrition: null,
    labs: null,
    progress: { verdict: 'melhorou', explanation: 'Progresso consistente.', confidence: 0.8 },
    memory: { coachingSummary: 'Performance em alta.', updatedAt: '2025-01-01' },
    science: null,
    missingData: ['plano nutricional', 'exames laboratoriais']
  };

  var selected = hub.selectContextForIntent(fakeHub, hub.KRONOS_INTENT.WORKOUT_PLANNING);
  assert.ok(selected.training, 'training should be selected');
  assert.ok(selected.profile, 'profile should be selected');
  assert.ok(selected.memory, 'memory should be selected');
  assert.equal(selected.labs, undefined, 'labs should NOT be auto-injected when null');
});

// ─────────────────────────────────────────────────────────────
// 5. Diet intent => profile + nutrition selected
// ─────────────────────────────────────────────────────────────

test('selectContextForIntent: NUTRITION_PLANNING picks profile + nutrition', function () {
  var hub = freshHub();
  var fakeHub = {
    inventory: { hasLabReports: false, hasTrainingHistory: false, hasNutritionPlan: true, hasProfile: true, hasMemoryState: false },
    profile: { name: 'Test', goal: 'emagrecimento', weightKg: 90, sex: 'feminino', restrictions: ['lactose'] },
    training: null,
    nutrition: { targetCalories: 1800, proteinG: 140, carbsG: 180, fatG: 60, nutritionStatus: 'consistent', dietaryRestrictions: ['lactose'], clinicalFlags: [], criticalFlags: [] },
    labs: null,
    progress: null,
    memory: null,
    science: null,
    missingData: ['histórico de treino', 'exames laboratoriais']
  };

  var selected = hub.selectContextForIntent(fakeHub, hub.KRONOS_INTENT.NUTRITION_PLANNING);
  assert.ok(selected.profile, 'profile should be selected');
  assert.ok(selected.nutrition, 'nutrition should be selected');
  assert.equal(selected.training, undefined, 'training should NOT be selected for diet without relevance');
});

// ─────────────────────────────────────────────────────────────
// 8. Progress review => mixed context
// ─────────────────────────────────────────────────────────────

test('selectContextForIntent: PROGRESS_REVIEW picks all available domains', function () {
  var hub = freshHub();
  var fakeHub = {
    inventory: { hasLabReports: true, hasTrainingHistory: true, hasNutritionPlan: true, hasProfile: true, hasMemoryState: true },
    profile: { name: 'Test', goal: 'recomposicao', weightKg: 75, restrictions: [] },
    training: { lastWorkoutAt: '2025-01-08', weeklyFrequency: 4, performanceTrend: 'stable', adherenceStatus: 'moderate', recoveryStatus: 'adequate', fatigueStatus: 'managed', trainingTolerance: 'adequate', objectiveAlignment: 'partial', topExercises: [] },
    nutrition: { targetCalories: 2200, proteinG: 170, carbsG: 220, fatG: 70, nutritionStatus: 'irregular', dietaryRestrictions: [], clinicalFlags: [], criticalFlags: [] },
    labs: { lastReportAt: '2025-01-05', summaryText: 'Testosterona baixa.', clinicalFlags: ['testosterona baixa'], criticalFlags: [], readinessSignal: 'caution', hormonalSignal: 'piorou', metabolicSignal: 'estável', keyMarkers: [{ key: 'testosterone', name: 'Testosterona', value: 280, unit: 'ng/dL', flag: 'low' }] },
    progress: { verdict: 'estabilizou', explanation: 'Sem progresso claro.', confidence: 0.6 },
    memory: { coachingSummary: 'Estagnação recente detectada.', updatedAt: '2025-01-08' },
    science: null,
    missingData: []
  };

  var selected = hub.selectContextForIntent(fakeHub, hub.KRONOS_INTENT.PROGRESS_REVIEW);
  assert.ok(selected.profile, 'profile');
  assert.ok(selected.training, 'training');
  assert.ok(selected.nutrition, 'nutrition');
  assert.ok(selected.labs, 'labs');
  assert.ok(selected.memory, 'memory');
  assert.ok(selected.progress, 'progress');
});

// ─────────────────────────────────────────────────────────────
// 10. formatContextForPrompt — inventory awareness line
// ─────────────────────────────────────────────────────────────

test('formatContextForPrompt: includes [KRONOS TEM ACESSO A] line', function () {
  var hub = freshHub();
  var selected = {
    inventory: { hasProfile: true, hasTrainingHistory: true, hasNutritionPlan: false, hasLabReports: false, hasMemoryState: true },
    profile: { name: null, age: 28, sex: 'masculino', weightKg: 82, heightCm: 178, goal: 'hipertrofia', athleteLevel: 'intermediario', activityLevel: 'moderado', restrictions: [] },
    missingData: ['plano nutricional', 'exames laboratoriais']
  };
  var out = hub.formatContextForPrompt(selected);
  assert.ok(out.includes('[KRONOS TEM ACESSO A]'), 'should state what data is available');
  assert.ok(out.includes('perfil'), 'should mention profile');
  assert.ok(out.includes('histórico de treino'), 'should mention training history');
});

// ─────────────────────────────────────────────────────────────
// 11. formatContextForPrompt — missing data line
// ─────────────────────────────────────────────────────────────

test('formatContextForPrompt: includes [KRONOS NÃO TEM] when data missing', function () {
  var hub = freshHub();
  var selected = {
    inventory: { hasProfile: true, hasTrainingHistory: false, hasNutritionPlan: false, hasLabReports: false, hasMemoryState: false },
    profile: { name: null, age: null, sex: null, weightKg: null, heightCm: null, goal: 'hipertrofia', athleteLevel: null, activityLevel: null, restrictions: [] },
    missingData: ['histórico de treino', 'plano nutricional', 'exames laboratoriais']
  };
  var out = hub.formatContextForPrompt(selected);
  assert.ok(out.includes('[KRONOS NÃO TEM]'), 'should declare missing data');
  assert.ok(out.includes('não inventar dados ausentes'), 'should include anti-hallucination rule');
});

// ─────────────────────────────────────────────────────────────
// 12. Critical lab flags appear in prompt
// ─────────────────────────────────────────────────────────────

test('formatContextForPrompt: critical lab flags render in [EXAMES ALERTA CRÍTICO]', function () {
  var hub = freshHub();
  var selected = {
    inventory: { hasProfile: false, hasTrainingHistory: false, hasNutritionPlan: false, hasLabReports: true, hasMemoryState: false },
    labs: { lastReportAt: '2025-01-10', summaryText: null, clinicalFlags: [], criticalFlags: ['anemia grave', 'PSA elevado'], readinessSignal: 'critical', hormonalSignal: null, metabolicSignal: null, keyMarkers: [] },
    missingData: []
  };
  var out = hub.formatContextForPrompt(selected);
  assert.ok(out.includes('[EXAMES ALERTA CRÍTICO]'), 'critical flags should render');
  assert.ok(out.includes('anemia grave'), 'flag text should appear');
});

// ─────────────────────────────────────────────────────────────
// 13. Science context does NOT appear when hub.science is null
// ─────────────────────────────────────────────────────────────

test('formatContextForPrompt: no science block injected when science is null', function () {
  var hub = freshHub();
  var selected = {
    inventory: { hasProfile: true, hasTrainingHistory: false, hasNutritionPlan: false, hasLabReports: false, hasMemoryState: false },
    profile: { name: 'Ana', age: 25, sex: 'feminino', weightKg: 60, heightCm: 165, goal: 'emagrecimento', athleteLevel: 'iniciante', activityLevel: 'leve', restrictions: [] },
    science: null,
    missingData: []
  };
  var out = hub.formatContextForPrompt(selected);
  assert.ok(!out.includes('[CIÊNCIA]'), 'science block should not appear');
  assert.ok(!out.includes('Base científica'), 'science reference should not appear');
});

// ─────────────────────────────────────────────────────────────
// Classifier: labs topic scoring
// ─────────────────────────────────────────────────────────────

test('classifier: lab keywords score labs topic above workout/diet', function () {
  var classifier = require('../../src/server/apihelpers/_conversationClassifier.js');
  var input = classifier.normalizeConversationInput('como estao meus exames de sangue e hemograma?');
  var result = classifier.classifyIntent(input, null);
  assert.equal(result.topic, 'labs', 'topic should be labs for lab keywords');
});

test('classifier: hemograma alone triggers labs topic', function () {
  var classifier = require('../../src/server/apihelpers/_conversationClassifier.js');
  var input = classifier.normalizeConversationInput('analisa meu hemograma');
  var result = classifier.classifyIntent(input, null);
  assert.equal(result.topic, 'labs', 'hemograma should map to labs topic');
});

// ─────────────────────────────────────────────────────────────
// 14 & 15. Decision engine: labs => LLM action, not flow
// ─────────────────────────────────────────────────────────────

test('decisionEngine: labs topic => call_llm action (not open_workout_flow)', function () {
  var engine = require('../../src/server/apihelpers/_decisionEngine.js');
  var fakeClassification = {
    triage: 'direct_question',
    kind: 'question',
    topic: 'labs',
    confidence: 0.82,
    flags: { isOnlyPunctuation: false, isEmpty: false },
    sanitizedText: 'como estao meus exames de testosterona e ferritina',
    semanticSignals: { asksForPlan: false, asksForAdjustment: false, asksForExplanation: true, topicShiftCue: false, vagueReference: false, progressSignal: false },
    continuation: { hit: false, inheritedTopic: null, inheritedNeed: null }
  };
  var decision = engine.decideAction(fakeClassification, {});
  assert.ok(
    decision.action === 'call_llm_full' || decision.action === 'call_llm_short',
    'labs topic should use call_llm_* action, got: ' + decision.action
  );
  assert.notEqual(decision.action, 'open_workout_flow', 'labs should NEVER open workout flow');
  assert.notEqual(decision.action, 'open_diet_flow', 'labs should NEVER open diet flow');
});

test('decisionEngine: workout topic still opens workout flow', function () {
  var engine = require('../../src/server/apihelpers/_decisionEngine.js');
  var fakeClassification = {
    triage: 'direct_request',
    kind: 'request',
    topic: 'workout',
    confidence: 0.85,
    flags: { isOnlyPunctuation: false, isEmpty: false },
    sanitizedText: 'monta um treino de hipertrofia 4x por semana',
    semanticSignals: { asksForPlan: true, asksForAdjustment: false, asksForExplanation: false, topicShiftCue: false, vagueReference: false, progressSignal: false },
    continuation: { hit: false, inheritedTopic: null, inheritedNeed: null }
  };
  var decision = engine.decideAction(fakeClassification, {});
  assert.equal(decision.action, 'open_workout_flow', 'workout request should still open workout flow');
});
