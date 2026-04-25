const test = require('node:test');
const assert = require('node:assert/strict');

const nutrition = require('../../src/lib/nutrition/nutritionService');

const completeProfile = {
  sexo: 'M',
  idade: 34,
  peso: 84,
  altura: 179,
  objetivo: 'emagrecimento',
  restricoes: ['sem lactose'],
};

test('memória nutricional calcula score baixo, médio, alto e status do plano', () => {
  const low = nutrition.calculateNutritionPersonalizationScore({}, {});
  assert.equal(low.score, 0);
  assert.equal(low.plan_status, 'provisório');

  const medium = nutrition.calculateNutritionPersonalizationScore({
    sexo: 'M',
    idade: 34,
    peso: 84,
    altura: 179,
    objetivo: 'emagrecimento',
  }, {
    preferred_meal_count: 4,
    preferred_diet_style: 'simples',
  });
  assert.equal(medium.score >= 40, true);
  assert.equal(medium.score < 70, true);
  assert.equal(medium.plan_status, 'provisório');

  const high = nutrition.calculateNutritionPersonalizationScore(completeProfile, {
    preferred_meal_count: 4,
    preferred_diet_style: 'flexível',
    liked_foods: ['arroz'],
    disliked_foods: ['fígado'],
    workout_time: 'noite',
    adherence_days: 3,
  });
  assert.equal(high.score, 100);
  assert.equal(high.plan_status, 'personalizado');
});

test('memória aumenta score dos templates econômica, marmita, treino noite e alta saciedade', () => {
  const economical = nutrition.selectAdaptiveDietTemplate(completeProfile, { targetCalories: 1850 }, {
    preferred_diet_style: 'economica',
  });
  assert.match(economical.template.id, /economica_brasileira/);

  const mealPrep = nutrition.selectAdaptiveDietTemplate(completeProfile, { targetCalories: 1850 }, {
    preferred_diet_style: 'marmita',
  });
  assert.match(mealPrep.template.id, /marmita/);

  const night = nutrition.selectAdaptiveDietTemplate({ ...completeProfile, objetivo: 'hipertrofia' }, { targetCalories: 2450 }, {
    workout_time: 'noite',
  });
  assert.match(night.template.id, /treino_noturno/);

  const satiety = nutrition.selectAdaptiveDietTemplate(completeProfile, { targetCalories: 1850 }, {
    hunger_period: 'noite',
  });
  assert.match(satiety.template.id, /alta_saciedade/);
});

test('feedback diário atualiza memória e gera sugestões adaptativas', () => {
  let memory = nutrition.registerDailyNutritionFeedback('hungry', {});
  memory = nutrition.registerDailyNutritionFeedback('hungry', memory);
  let suggestions = nutrition.suggestDietAdaptations({}, memory, completeProfile);
  assert.ok(suggestions.some((item) => item.type === 'night_satiety'));

  memory = nutrition.registerDailyNutritionFeedback('skipped', {});
  memory = nutrition.registerDailyNutritionFeedback('skipped', memory);
  suggestions = nutrition.suggestDietAdaptations({}, memory, completeProfile);
  assert.ok(suggestions.some((item) => item.template_hint === 'baixa_adesao'));

  memory = nutrition.registerDailyNutritionFeedback('swapped', {});
  memory = nutrition.registerDailyNutritionFeedback('swapped', memory);
  suggestions = nutrition.suggestDietAdaptations({}, memory, completeProfile);
  assert.ok(suggestions.some((item) => item.template_hint === 'flexivel'));
});

test('check-in semanal aplica regras de 5%, fome, treino ruim e baixa adesão', () => {
  const plan = { targets: { kcal: 2000 } };

  const stalled = nutrition.runWeeklyNutritionCheckin({ adherence_days: 6, hunger_avg: 4, weight_delta_kg: 0 }, plan, completeProfile, {});
  assert.equal(stalled.targetCalories, 1900);
  assert.match(stalled.reason, /reduzir 5%/i);

  const hungry = nutrition.runWeeklyNutritionCheckin({ adherence_days: 6, hunger_avg: 8, weight_delta_kg: 0 }, plan, completeProfile, {});
  assert.equal(hungry.calorie_multiplier, 1);
  assert.match(hungry.reason, /Fome alta/i);

  const lowEnergy = nutrition.runWeeklyNutritionCheckin({ adherence_days: 6, hunger_avg: 4, training_energy: 3, weight_delta_kg: -0.5 }, plan, completeProfile, {});
  assert.equal(lowEnergy.carb_timing, 'pre_pos_treino');

  const lowAdherence = nutrition.runWeeklyNutritionCheckin({ adherence_days: 2, hunger_avg: 4, training_energy: 7 }, plan, completeProfile, {});
  assert.equal(lowAdherence.simplify, true);

  const bulk = nutrition.runWeeklyNutritionCheckin({ adherence_days: 6, hunger_avg: 4, weight_delta_kg: 0 }, plan, { ...completeProfile, objetivo: 'hipertrofia' }, {});
  assert.equal(bulk.targetCalories, 2100);
});
