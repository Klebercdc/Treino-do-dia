'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const aiLayer = require('../../src/core/nutrition/ai_nutrition_strategy_layer');
const renderer = require('../../src/core/nutrition/diet_prescription_renderer');
const strategyEngine = require('../../src/core/nutrition/diet_strategy_engine');
const visualPrescription = require('../../src/lib/nutrition/visualPrescription');

// ─── AI Strategy Layer — unit tests (sem chamada real à API) ─────────────────

test('getMealSlots returns 5 slots for mealCount 5', () => {
  const slots = aiLayer.getMealSlots(5);
  assert.equal(slots.length, 5);
  assert.ok(slots.includes('cafe_da_manha'));
  assert.ok(slots.includes('almoco'));
  assert.ok(slots.includes('jantar'));
});

test('getMealSlots returns 3 slots for mealCount 3', () => {
  const slots = aiLayer.getMealSlots(3);
  assert.equal(slots.length, 3);
});

test('getMealSlots returns 6 slots for mealCount 6', () => {
  const slots = aiLayer.getMealSlots(6);
  assert.equal(slots.length, 6);
  assert.ok(slots.includes('ceia'));
});

test('buildSystemPrompt contains JSON instruction', () => {
  const prompt = aiLayer.buildSystemPrompt();
  assert.ok(typeof prompt === 'string' && prompt.length > 50);
  assert.ok(prompt.includes('JSON'));
  assert.ok(prompt.includes('proteinShare'));
});

test('parseAIResponse parses clean JSON', () => {
  const json = JSON.stringify({ strategyType: 'hipertrofia', mealIntentions: {}, macroDistribution: {} });
  const result = aiLayer.parseAIResponse(json);
  assert.equal(result.strategyType, 'hipertrofia');
});

test('parseAIResponse removes markdown fences', () => {
  const json = '```json\n{"strategyType":"emagrecimento","mealIntentions":{},"macroDistribution":{}}\n```';
  const result = aiLayer.parseAIResponse(json);
  assert.equal(result.strategyType, 'emagrecimento');
});

test('parseAIResponse ignores text before first brace', () => {
  const json = 'Aqui está a estratégia:\n{"strategyType":"performance","mealIntentions":{},"macroDistribution":{}}';
  const result = aiLayer.parseAIResponse(json);
  assert.equal(result.strategyType, 'performance');
});

// ─── validateMacroShares ─────────────────────────────────────────────────────

test('validateMacroShares passes for shares that sum to 1.0', () => {
  const dist = {
    cafe_da_manha: { proteinShare: 0.20, carbShare: 0.18, fatShare: 0.22 },
    lanche_manha:  { proteinShare: 0.10, carbShare: 0.10, fatShare: 0.10 },
    almoco:        { proteinShare: 0.27, carbShare: 0.27, fatShare: 0.24 },
    lanche_tarde:  { proteinShare: 0.15, carbShare: 0.17, fatShare: 0.10 },
    jantar:        { proteinShare: 0.28, carbShare: 0.28, fatShare: 0.34 },
  };
  const slots = aiLayer.getMealSlots(5);
  assert.ok(aiLayer.validateMacroShares(dist, slots));
});

test('validateMacroShares fails when proteinShare sum is far from 1.0', () => {
  const dist = {
    cafe_da_manha: { proteinShare: 0.10, carbShare: 0.18, fatShare: 0.22 },
    almoco:        { proteinShare: 0.10, carbShare: 0.45, fatShare: 0.40 },
    jantar:        { proteinShare: 0.10, carbShare: 0.37, fatShare: 0.38 },
  };
  const slots = aiLayer.getMealSlots(3);
  assert.ok(!aiLayer.validateMacroShares(dist, slots));
});

test('validateMacroShares fails on missing slot', () => {
  const dist = {
    cafe_da_manha: { proteinShare: 0.50, carbShare: 0.50, fatShare: 0.50 },
    almoco:        { proteinShare: 0.50, carbShare: 0.50, fatShare: 0.50 },
    // jantar missing
  };
  const slots = aiLayer.getMealSlots(3);
  assert.ok(!aiLayer.validateMacroShares(dist, slots));
});

// ─── normalizeMacroShares ────────────────────────────────────────────────────

test('normalizeMacroShares makes proteinShare sum exactly to 1.0 (within rounding)', () => {
  const dist = {
    cafe_da_manha: { proteinShare: 0.30, carbShare: 0.30, fatShare: 0.30 },
    almoco:        { proteinShare: 0.40, carbShare: 0.40, fatShare: 0.40 },
    jantar:        { proteinShare: 0.50, carbShare: 0.50, fatShare: 0.50 },
  };
  const normalized = aiLayer.normalizeMacroShares(dist);
  const slots = Object.keys(normalized);
  const proteinSum = slots.reduce((s, k) => s + normalized[k].proteinShare, 0);
  const carbSum = slots.reduce((s, k) => s + normalized[k].carbShare, 0);
  const fatSum = slots.reduce((s, k) => s + normalized[k].fatShare, 0);
  assert.ok(Math.abs(proteinSum - 1.0) < 0.10, 'proteinShare sum should be close to 1.0, got ' + proteinSum);
  assert.ok(Math.abs(carbSum - 1.0) < 0.10, 'carbShare sum should be close to 1.0, got ' + carbSum);
  assert.ok(Math.abs(fatSum - 1.0) < 0.10, 'fatShare sum should be close to 1.0, got ' + fatSum);
});

// ─── validateStrategy ────────────────────────────────────────────────────────

test('validateStrategy passes with all required fields and matching slots', () => {
  const slots = aiLayer.getMealSlots(3);
  const strategy = {
    strategyType: 'hipertrofia_alta_proteina',
    mealIntentions: {
      cafe_da_manha: { weight: 'moderado', proteinFocus: 'moderado', carbFocus: 'complexo', avoidFat: false, preworkout: false, postworkout: false, description: 'Café reforçado' },
      almoco:        { weight: 'pesado',   proteinFocus: 'alto',     carbFocus: 'complexo', avoidFat: false, preworkout: false, postworkout: false, description: 'Refeição principal' },
      jantar:        { weight: 'moderado', proteinFocus: 'alto',     carbFocus: 'moderado', avoidFat: false, preworkout: false, postworkout: true,  description: 'Recuperação' },
    },
    macroDistribution: {
      cafe_da_manha: { proteinShare: 0.28, carbShare: 0.24, fatShare: 0.28 },
      almoco:        { proteinShare: 0.37, carbShare: 0.36, fatShare: 0.36 },
      jantar:        { proteinShare: 0.35, carbShare: 0.40, fatShare: 0.36 },
    },
  };
  assert.ok(aiLayer.validateStrategy(strategy, slots));
});

test('validateStrategy fails when mealIntentions is missing a slot', () => {
  const slots = aiLayer.getMealSlots(3);
  const strategy = {
    strategyType: 'algo',
    mealIntentions: {
      cafe_da_manha: { weight: 'leve', proteinFocus: 'baixo', carbFocus: 'simples', avoidFat: false, preworkout: false, postworkout: false, description: '' },
      almoco: { weight: 'pesado', proteinFocus: 'alto', carbFocus: 'complexo', avoidFat: false, preworkout: false, postworkout: false, description: '' },
      // jantar missing
    },
    macroDistribution: {},
  };
  assert.ok(!aiLayer.validateStrategy(strategy, slots));
});

test('validateStrategy fails with no strategyType', () => {
  const strategy = { mealIntentions: {}, macroDistribution: {} };
  assert.ok(!aiLayer.validateStrategy(strategy, []));
});

// ─── buildAIStrategy — fallback when ANTHROPIC_API_KEY not set ───────────────

test('buildAIStrategy returns null when ANTHROPIC_API_KEY is missing', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const result = await aiLayer.buildAIStrategy({
      profile: { objetivo: 'hipertrofia', sexo: 'masculino', idade: 28, peso: 80, altura: 175, refeicoesPorDia: 5, nivelAtividade: 'ativo' }
    });
    assert.equal(result, null, 'Should return null when API key is missing');
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

// ─── Engine fallback — plan generation without AI strategy ───────────────────

test('engine fallback: plan is generated correctly without aiNutritionStrategy', () => {
  const profileInput = {
    objetivo: 'hipertrofia',
    sexo: 'masculino',
    idade: 28,
    peso: 80,
    altura: 175,
    nivelAtividade: 'ativo',
    refeicoesPorDia: 5,
  };
  const result = renderer.generateNutritionPlan(profileInput);
  assert.equal(result.failSafe, false, 'Plan should not be failSafe for valid profile');
  assert.ok(result.plan, 'Plan should exist');
  assert.ok(Array.isArray(result.plan.refeicoes), 'Plan should have meals');
  assert.ok(result.plan.refeicoes.length >= 3, 'Plan should have at least 3 meals');
});

// ─── Catalog validation: all foods must come from FOOD_LIBRARY ───────────────

test('plan only contains foods from the catalog (no invented foods)', () => {
  const profileInput = {
    objetivo: 'hipertrofia',
    sexo: 'masculino',
    idade: 28,
    peso: 80,
    altura: 175,
    nivelAtividade: 'ativo',
    refeicoesPorDia: 5,
  };
  const result = renderer.generateNutritionPlan(profileInput);
  assert.equal(result.failSafe, false);

  const allCatalogNames = new Set();
  Object.values(renderer.FOOD_LIBRARY || {}).forEach(function(group) {
    (group || []).forEach(function(food) {
      if (food && food.name) allCatalogNames.add(food.name.toLowerCase().trim());
    });
  });

  (result.plan.refeicoes || []).forEach(function(meal) {
    (meal.itens || []).forEach(function(item) {
      const name = String(item.nome || '').toLowerCase().trim();
      assert.ok(
        allCatalogNames.has(name),
        'Food "' + item.nome + '" must be in the catalog'
      );
    });
  });
});

// ─── Daily totals must match sum of meals ────────────────────────────────────

test('daily totals match sum of individual meals', () => {
  const profileInput = {
    objetivo: 'emagrecimento',
    sexo: 'feminino',
    idade: 32,
    peso: 65,
    altura: 165,
    nivelAtividade: 'moderado',
    refeicoesPorDia: 4,
  };
  const result = renderer.generateNutritionPlan(profileInput);
  assert.equal(result.failSafe, false);

  const plan = result.plan;
  let sumCal = 0;
  let sumProt = 0;
  let sumCarb = 0;
  let sumFat = 0;

  (plan.refeicoes || []).forEach(function(meal) {
    sumCal += Number(meal.subtotal.calorias || 0);
    sumProt += Number(meal.subtotal.proteinas || 0);
    sumCarb += Number(meal.subtotal.carboidratos || 0);
    sumFat += Number(meal.subtotal.gorduras || 0);
  });

  const resumo = plan.resumoDiario;
  assert.ok(Math.abs(resumo.calorias - sumCal) < 5, `Daily calories ${resumo.calorias} should match meal sum ${sumCal}`);
  assert.ok(Math.abs(resumo.proteinas - sumProt) < 2, `Daily protein ${resumo.proteinas} should match meal sum ${sumProt}`);
  assert.ok(Math.abs(resumo.carboidratos - sumCarb) < 2, `Daily carbs ${resumo.carboidratos} should match meal sum ${sumCarb}`);
  assert.ok(Math.abs(resumo.gorduras - sumFat) < 2, `Daily fat ${resumo.gorduras} should match meal sum ${sumFat}`);
});

// ─── Maçã não vira proteína ──────────────────────────────────────────────────

test('apple (maçã) does not become a protein source in the plan', () => {
  const maca = Object.values(renderer.FOOD_LIBRARY || {})
    .flat()
    .find(food => food && /ma[cç][aã]/i.test(food.name));

  if (!maca) return; // if not in library, skip

  // The food's own macros must reflect it is a carb, not a protein
  assert.ok(maca.carbs > maca.protein, `Apple carbs (${maca.carbs}) should exceed protein (${maca.protein})`);
  assert.ok(maca.protein < 2, `Apple protein (${maca.protein}) should be under 2g per portion`);
});

// ─── Ovo não vira carboidrato ─────────────────────────────────────────────────

test('egg (ovo) does not become a carb source in the plan', () => {
  const ovo = Object.values(renderer.FOOD_LIBRARY || {})
    .flat()
    .find(food => food && /ovo|egg/i.test(food.name));

  if (!ovo) return;

  assert.ok(ovo.protein > ovo.carbs, `Egg protein (${ovo.protein}) should exceed carbs (${ovo.carbs})`);
  assert.ok(ovo.carbs < 5, `Egg carbs (${ovo.carbs}) should be under 5g per portion`);
});

// ─── Iogurte natural comum não vira hiperproteico ────────────────────────────

test('plain yogurt (iogurte natural) does not become a hyper-protein source', () => {
  const iogurte = Object.values(renderer.FOOD_LIBRARY || {})
    .flat()
    .find(food => food && food.name && /iogurte natural$/i.test(food.name) && !/grego|skyr|proteico/i.test(food.name));

  if (!iogurte) return;

  assert.ok(iogurte.protein < 15, `Plain yogurt protein per portion (${iogurte.protein}g) should be < 15g — it is not a hyper-protein source`);
});

// ─── AI strategy integration: macros adjusted correctly ──────────────────────

test('plan with AI strategy uses the AI macroDistribution (when valid)', () => {
  const aiStrategy = {
    strategyType: 'hipertrofia_alta_proteina',
    _aiGenerated: true,
    _mealSlots: ['cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar'],
    macroDistribution: {
      cafe_da_manha: { proteinShare: 0.20, carbShare: 0.18, fatShare: 0.22 },
      lanche_manha:  { proteinShare: 0.10, carbShare: 0.10, fatShare: 0.10 },
      almoco:        { proteinShare: 0.27, carbShare: 0.27, fatShare: 0.24 },
      lanche_tarde:  { proteinShare: 0.15, carbShare: 0.17, fatShare: 0.10 },
      jantar:        { proteinShare: 0.28, carbShare: 0.28, fatShare: 0.34 },
    },
    mealIntentions: {
      cafe_da_manha: { weight: 'moderado', proteinFocus: 'moderado', carbFocus: 'complexo', avoidFat: false, preworkout: false, postworkout: false, description: 'Café reforçado' },
      lanche_manha:  { weight: 'leve',     proteinFocus: 'baixo',    carbFocus: 'simples',  avoidFat: false, preworkout: true,  postworkout: false, description: 'Pré-treino leve' },
      almoco:        { weight: 'pesado',   proteinFocus: 'alto',     carbFocus: 'complexo', avoidFat: false, preworkout: false, postworkout: false, description: 'Refeição principal' },
      lanche_tarde:  { weight: 'leve',     proteinFocus: 'moderado', carbFocus: 'pre_treino', avoidFat: true, preworkout: true, postworkout: false, description: 'Pré-treino com carbo rápido' },
      jantar:        { weight: 'moderado', proteinFocus: 'alto',     carbFocus: 'moderado', avoidFat: false, preworkout: false, postworkout: true,  description: 'Recuperação pós-treino' },
    },
    foodSelectionGuidelines: ['Priorizar proteínas magras'],
    clinicalConstraints: [],
    adherenceRules: [],
    forbiddenFoods: [],
    preferredFoods: [],
    explanation: 'Estratégia de hipertrofia com proteína elevada.',
  };

  const profileInput = {
    objetivo: 'hipertrofia',
    sexo: 'masculino',
    idade: 28,
    peso: 80,
    altura: 175,
    nivelAtividade: 'ativo',
    refeicoesPorDia: 5,
    aiNutritionStrategy: aiStrategy,
  };

  const result = renderer.generateNutritionPlan(profileInput);
  assert.equal(result.failSafe, false);
  assert.ok(result.plan.refeicoes.length === 5, 'Should have 5 meals');

  // Check that almoço (index 2) has higher protein than café da manhã (index 0)
  const cafe = result.plan.refeicoes.find(r => r.tipo === 'cafe_da_manha');
  const almoco = result.plan.refeicoes.find(r => r.tipo === 'almoco');
  assert.ok(cafe && almoco, 'Should have café and almoço');
  assert.ok(
    almoco.subtotal.proteinas >= cafe.subtotal.proteinas,
    `Almoço protein (${almoco.subtotal.proteinas}) should be >= café protein (${cafe.subtotal.proteinas}) in hipertrofia plan`
  );
});

// ─── PDF / visual prescription ───────────────────────────────────────────────

test('visual prescription without AI strategy does not contain "estimativa proporcional"', () => {
  const profileInput = {
    objetivo: 'manutencao',
    sexo: 'masculino',
    idade: 30,
    peso: 75,
    altura: 175,
    nivelAtividade: 'moderado',
    refeicoesPorDia: 4,
  };
  const result = renderer.generateNutritionPlan(profileInput);
  const visual = result.plan && result.plan.visualPrescription;
  assert.ok(visual, 'Visual prescription should exist');
  const json = JSON.stringify(visual);
  assert.ok(
    !json.includes('estimativa proporcional'),
    'Visual prescription should not contain "estimativa proporcional"'
  );
});

test('visual prescription with AI strategy shows AI subtitle', () => {
  const plan = {
    refeicoes: [
      { nome: 'Café da manhã', horario: '07:00', subtotal: { calorias: 500, proteinas: 30, carboidratos: 50, gorduras: 15 }, itens: [] },
      { nome: 'Almoço', horario: '12:30', subtotal: { calorias: 700, proteinas: 45, carboidratos: 80, gorduras: 20 }, itens: [] },
    ],
    resumoDiario: { calorias: 1200, proteinas: 75, carboidratos: 130, gorduras: 35 },
    objetivo: 'hipertrofia',
  };
  const aiStrategy = {
    _aiGenerated: true,
    strategyType: 'hipertrofia_alta_proteina',
  };

  const visual = visualPrescription.buildVisualPrescription({ plan, calculation: {}, aiStrategy });
  assert.equal(
    visual.dashboard.subtitle,
    'Estratégia gerada por IA e validada por cálculo nutricional.',
    'Subtitle should reflect AI generation'
  );
  assert.ok(visual.aiGenerated === true, 'aiGenerated flag should be true');
  assert.ok(!visual.observation.includes('estimativa proporcional'), 'Observation should not contain deprecated phrase');
});

test('visual prescription without AI strategy shows engine subtitle', () => {
  const plan = {
    refeicoes: [
      { nome: 'Café da manhã', horario: '07:00', subtotal: { calorias: 500, proteinas: 30, carboidratos: 50, gorduras: 15 }, itens: [] },
    ],
    resumoDiario: { calorias: 500, proteinas: 30, carboidratos: 50, gorduras: 15 },
    objetivo: 'manutencao',
  };

  const visual = visualPrescription.buildVisualPrescription({ plan, calculation: {} });
  assert.ok(!visual.dashboard.subtitle.includes('IA'), 'Non-AI subtitle should not mention IA');
  assert.ok(visual.aiGenerated === false || visual.aiGenerated === undefined, 'aiGenerated should be false or absent');
});

test('visual prescription meal kcal_real field is numeric', () => {
  const plan = {
    refeicoes: [
      { nome: 'Café da manhã', horario: '07:00', subtotal: { calorias: 520, proteinas: 30, carboidratos: 50, gorduras: 15 }, itens: [] },
    ],
    resumoDiario: { calorias: 520, proteinas: 30, carboidratos: 50, gorduras: 15 },
    objetivo: 'manutencao',
  };
  const visual = visualPrescription.buildVisualPrescription({ plan, calculation: {} });
  assert.ok(typeof visual.meals[0].kcal_real === 'number', 'kcal_real should be a number');
  assert.equal(visual.meals[0].kcal_real, 520);
});
