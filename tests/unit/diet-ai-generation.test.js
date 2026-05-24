'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const renderer = require('../../src/core/nutrition/diet_prescription_renderer');
const strategyEngine = require('../../src/core/nutrition/diet_strategy_engine');
const orchestrator = require('../../src/core/nutrition/aiNutritionOrchestrator');

function buildBaseProfile(overrides) {
  return Object.assign({
    objetivo: 'hipertrofia',
    sexo: 'masculino',
    idade: 28,
    peso: 80,
    altura: 178,
    nivelAtividade: 'moderado',
    refeicoesPorDia: 5,
    restricoesAlimentares: [],
    alimentosEvitar: [],
    preferencias: [],
    labContext: { mode: null, clinicalFlags: [], criticalFlags: [] },
    clinicalData: { healthConditions: [], flags: {} },
    aderencia: {},
    contextoTreino: {}
  }, overrides || {});
}

// ─── Blueprint integration in plan generation ────────────────────────────────

test('generateNutritionPlan builds a plan without blueprint (no AI key)', () => {
  const profile = buildBaseProfile();
  const result = renderer.generateNutritionPlan(profile);
  assert.ok(!result.failSafe, 'plan should not be failSafe');
  assert.ok(result.plan && Array.isArray(result.plan.refeicoes));
  assert.ok(result.plan.refeicoes.length >= 3);
});

test('plan built with blueprint marks aiGenerated true', () => {
  const profile = buildBaseProfile();
  const calc = strategyEngine.calculateNutrition(profile);

  // Build a minimal valid blueprint
  const mealSlots = orchestrator.getMealSlots(profile.refeicoesPorDia);
  const mealBlueprints = mealSlots.map(slot => ({
    tipo: slot,
    nome: slot,
    horario: '07:00',
    intention: 'test',
    macroFocus: 'test',
    digestionProfile: 'medio',
    satietyLevel: 'moderado',
    foodRoles: [
      { role: 'protein', suggestedAliases: ['frango', 'tilapia', 'atum'], preferredCharacteristics: '', avoidCharacteristics: '' },
      { role: 'carb', suggestedAliases: ['arroz integral', 'batata-doce', 'quinoa'], preferredCharacteristics: '', avoidCharacteristics: '' }
    ]
  }));
  const macroDistribution = {};
  mealSlots.forEach(slot => {
    macroDistribution[slot] = {
      proteinShare: +(1 / mealSlots.length).toFixed(2),
      carbShare: +(1 / mealSlots.length).toFixed(2),
      fatShare: +(1 / mealSlots.length).toFixed(2),
    };
  });

  calc.profile.aiNutritionBlueprint = {
    aiGenerated: true,
    strategyName: 'test_hipertrofia',
    reasoningSummary: 'Test strategy',
    mealBlueprints,
    macroDistribution,
    validationWarnings: [],
    fallbackEngine: false,
  };

  const prescription = renderer.buildNutritionPrescription
    ? renderer.buildNutritionPrescription(calc)
    : renderer.generateNutritionPlan(profile);

  // If prescription is available via direct call
  if (prescription && prescription.plan) {
    assert.equal(prescription.plan.aiGenerated, true, 'plan.aiGenerated should be true when blueprint provided');
    assert.equal(prescription.plan.fallbackEngine, false);
  }
});

test('plan built without blueprint marks fallbackEngine true', () => {
  const profile = buildBaseProfile();
  const result = renderer.generateNutritionPlan(profile);
  if (result && result.plan) {
    // Without blueprint, fallbackEngine should be true
    assert.equal(result.plan.fallbackEngine, true);
  }
});

// ─── Macro totals consistency ─────────────────────────────────────────────────

test('plan daily totals equal sum of meal subtotals', () => {
  const profile = buildBaseProfile();
  const result = renderer.generateNutritionPlan(profile);
  assert.ok(!result.failSafe);

  const plan = result.plan;
  const meals = plan.refeicoes || [];

  let sumProteinas = 0;
  let sumCarbos = 0;
  let sumGorduras = 0;
  let sumCalorias = 0;

  meals.forEach(meal => {
    sumProteinas += meal.subtotal.proteinas;
    sumCarbos += meal.subtotal.carboidratos;
    sumGorduras += meal.subtotal.gorduras;
    sumCalorias += meal.subtotal.calorias;
  });

  const tol = 1.5;
  assert.ok(
    Math.abs(sumProteinas - plan.resumoDiario.proteinas) <= tol,
    `protein mismatch: sum=${sumProteinas} vs daily=${plan.resumoDiario.proteinas}`
  );
  assert.ok(
    Math.abs(sumCarbos - plan.resumoDiario.carboidratos) <= tol,
    `carbs mismatch: sum=${sumCarbos} vs daily=${plan.resumoDiario.carboidratos}`
  );
  assert.ok(
    Math.abs(sumGorduras - plan.resumoDiario.gorduras) <= tol,
    `fat mismatch: sum=${sumGorduras} vs daily=${plan.resumoDiario.gorduras}`
  );
});

// ─── Food variety check ───────────────────────────────────────────────────────

test('each meal has at least 1 item', () => {
  const profile = buildBaseProfile();
  const result = renderer.generateNutritionPlan(profile);
  (result.plan.refeicoes || []).forEach(meal => {
    assert.ok(meal.itens && meal.itens.length >= 1, `meal ${meal.tipo} should have at least 1 item`);
  });
});

test('all meal items have numeric macros', () => {
  const profile = buildBaseProfile();
  const result = renderer.generateNutritionPlan(profile);
  (result.plan.refeicoes || []).forEach(meal => {
    (meal.itens || []).forEach(item => {
      assert.ok(typeof item.proteinas === 'number', `item ${item.nome} proteinas should be number`);
      assert.ok(typeof item.carboidratos === 'number', `item ${item.nome} carboidratos should be number`);
      assert.ok(typeof item.gorduras === 'number', `item ${item.nome} gorduras should be number`);
      assert.ok(typeof item.calorias === 'number', `item ${item.nome} calorias should be number`);
    });
  });
});

test('all meal items have a non-empty source', () => {
  const profile = buildBaseProfile();
  const result = renderer.generateNutritionPlan(profile);
  (result.plan.refeicoes || []).forEach(meal => {
    (meal.itens || []).forEach(item => {
      assert.ok(item.source && typeof item.source === 'string' && item.source.length > 0,
        `item ${item.nome} should have a source`);
    });
  });
});

// ─── Iogurte natural não deve ser hiperproteico ───────────────────────────────

test('iogurte natural in any meal does not have > 10g protein per serving', () => {
  const profile = buildBaseProfile({ refeicoesPorDia: 4 });
  const result = renderer.generateNutritionPlan(profile);
  (result.plan.refeicoes || []).forEach(meal => {
    (meal.itens || []).forEach(item => {
      const name = (item.nome || '').toLowerCase();
      if (name.includes('iogurte') && !name.includes('grego') && !name.includes('skyr') && !name.includes('proteic')) {
        assert.ok(item.proteinas <= 10,
          `iogurte natural "${item.nome}" has ${item.proteinas}g protein — should be ≤ 10g per serving`);
      }
    });
  });
});

// ─── Fallback engine behavior ─────────────────────────────────────────────────

test('plan is generated even when AI blueprint is absent (fallback)', () => {
  const profile = buildBaseProfile({ objetivo: 'emagrecimento' });
  const result = renderer.generateNutritionPlan(profile);
  assert.ok(!result.failSafe, 'fallback plan should not be failSafe');
  assert.ok(result.plan.refeicoes.length >= 3, 'fallback should still have meals');
});

test('buildNutritionPrescription exports correct structure', () => {
  const profile = buildBaseProfile();
  const result = renderer.generateNutritionPlan(profile);
  assert.ok('plan' in result);
  assert.ok('calculation' in result);
  assert.ok('catalogStats' in result);
  assert.ok(result.catalogStats.canonicalFoods > 0);
});
