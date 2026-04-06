const test = require('node:test');
const assert = require('node:assert/strict');

const nutritionService = require('../../src/lib/nutrition/nutritionService');
const dietService = require('../../src/services/diet/dietService');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

test('nutritionService accepts abbreviated sex values for diet generation', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 29,
    peso: 62,
    altura: 168,
    objetivo: 'hipertrofia',
    rotina: 'academia 4x por semana',
    refeicoesPorDia: 4,
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.profile.sexo, 'feminino');
  assert.ok(result.plan.refeicoes.length >= 3);
});

test('dietService normalizes mixed payload shapes and generates diet plan', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    objective: 'emagrecimento',
    profile: {
      sexo: 'M',
      idade: 35,
      pesoKg: 84,
      alturaCm: 178,
      rotina: 'academia 5x por semana',
      restricoes: ['lactose'],
      dietaryPattern: 'vegano',
    },
    meals: 5,
    preferences: ['frango', 'ovo'],
    dislikes: ['iogurte'],
    trainingContext: { frequencia: '5x por semana', duracao: '60 min', tipo: 'musculacao' },
    healthContext: { sono: '7h', estresse: 'moderado' },
  });

  assert.equal(result.domain, 'diet');
  assert.equal(result.action, 'GENERATE_DIET');
  assert.equal(result.success, true);
  assert.equal(result.payload.profile.sexo, 'M');
  assert.equal(result.payload.profile.objetivo, 'emagrecimento');
  assert.equal(result.payload.profile.padraoAlimentar, 'vegano');
  assert.deepEqual(result.payload.profile.alimentosEvitar, ['iogurte']);
  assert.equal(result.payload.profile.contextoTreino.frequencia, '5x por semana');
  assert.equal(result.payload.plan.failSafe, false);
  assert.equal(result.payload.plan.profile.objetivo, 'emagrecimento');
  assert.equal(result.payload.plan.refeicoes.length, 5);
});

test('nutritionService personaliza plano com padrao alimentar e alimentos evitados', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 29,
    peso: 62,
    altura: 168,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 4,
    padraoAlimentar: 'vegano',
    alimentosEvitar: ['brocolis'],
  });

  assert.equal(result.failSafe, false);
  const foods = result.plan.refeicoes.flatMap((meal) => meal.itens.map((item) => item.nome.toLowerCase()));
  assert.ok(foods.includes('tofu firme'));
  assert.ok(!foods.includes('frango grelhado'));
  assert.ok(!foods.includes('brocolis cozido'));
});

test('nutritionService returns daily totals aligned with meal subtotals and realistic breakfast', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 31,
    peso: 82,
    altura: 178,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    contextoTreino: { frequencia: '5x por semana', tipo: 'musculacao' },
  });

  assert.equal(result.failSafe, false);
  const breakfast = result.plan.refeicoes[0];
  assert.match(breakfast.nome, /caf/i);
  const breakfastFoods = breakfast.itens.map((item) => item.nome.toLowerCase());
  assert.ok(
    breakfastFoods.some((name) => /ovo|aveia|banana|p[aã]o|whey|iogurte|tofu/.test(name)),
  );

  const totals = result.plan.refeicoes.reduce((acc, meal) => {
    acc.calorias += Number(meal.subtotal.calorias || 0);
    acc.proteina += Number(meal.subtotal.proteinas || 0);
    acc.carbo += Number(meal.subtotal.carboidratos || 0);
    acc.gordura += Number(meal.subtotal.gorduras || 0);
    return acc;
  }, { calorias: 0, proteina: 0, carbo: 0, gordura: 0 });

  assert.equal(Math.round(totals.calorias), Math.round(result.calculation.targetCalories));
  assert.equal(Math.round(totals.proteina * 10) / 10, result.calculation.macros.protein);
  assert.equal(Math.round(totals.carbo * 10) / 10, result.calculation.macros.carbs);
  assert.equal(Math.round(totals.gordura * 10) / 10, result.calculation.macros.fat);
});

test('nutritionService keeps almoço brasileiro para onívoro e proteína vegetal para vegano', () => {
  const omnivore = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 176,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    padraoAlimentar: 'onívoro',
  });
  assert.equal(omnivore.failSafe, false);
  const lunch = omnivore.plan.refeicoes.find((meal) => normalizeText(meal.nome).includes('almoco'));
  const lunchFoods = lunch.itens.map((item) => item.nome.toLowerCase());
  assert.ok(lunchFoods.some((name) => /frango|patinho|til[aá]pia/.test(name)));
  assert.ok(lunchFoods.some((name) => /arroz/.test(name)));
  assert.ok(lunchFoods.some((name) => /feij[aã]o/.test(name)));
  assert.ok(!lunchFoods.some((name) => /tofu/.test(name)));

  const vegan = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 28,
    peso: 62,
    altura: 167,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    padraoAlimentar: 'vegano',
  });
  assert.equal(vegan.failSafe, false);
  const veganLunch = vegan.plan.refeicoes.find((meal) => normalizeText(meal.nome).includes('almoco'));
  const veganLunchFoods = veganLunch.itens.map((item) => item.nome.toLowerCase());
  assert.ok(veganLunchFoods.some((name) => /tofu/.test(name)));
  assert.ok(veganLunchFoods.some((name) => /arroz/.test(name)));
  assert.ok(veganLunchFoods.some((name) => /feij[aã]o/.test(name)));
});

test('dietService returns safe failsafe response when critical profile data is missing', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    objetivo: 'hipertrofia',
    peso: 80,
  });

  assert.equal(result.domain, 'diet');
  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'DIET_INPUT_INVALID');
  assert.equal(result.payload.plan.failSafe, true);
  assert.ok(Array.isArray(result.payload.plan.refeicoes));
  assert.ok(result.payload.plan.refeicoes.length >= 3);
  assert.deepEqual(result.payload.validation.missingFields, ['sexo', 'idade', 'altura']);
  assert.equal(result.payload.validation.generatedFromFallback, true);
  assert.match(result.message, /fallback seguro|complete os dados ausentes/i);
});
