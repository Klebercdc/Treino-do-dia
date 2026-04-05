const test = require('node:test');
const assert = require('node:assert/strict');

const nutritionService = require('../../src/lib/nutrition/nutritionService');
const dietService = require('../../src/services/diet/dietService');

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
