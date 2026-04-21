'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const nutritionService = require('../../src/lib/nutrition/nutritionService');

test('meal builder: snack meal has at most 3 items', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 176,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    padraoAlimentar: 'onívoro',
    contextoTreino: { frequencia: '5x por semana' },
  });

  assert.equal(result.failSafe, false);
  const snacks = result.plan.refeicoes.filter((meal) => /lanche|ceia/.test(meal.tipo));
  assert.ok(snacks.length > 0, 'expected at least one snack meal');
  for (const snack of snacks) {
    assert.ok(
      snack.itens.length <= 3,
      `snack "${snack.nome}" has ${snack.itens.length} items — expected ≤3`
    );
  }
});

test('meal builder: main meal has at most 5 items', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 30,
    peso: 90,
    altura: 180,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    padraoAlimentar: 'onívoro',
    contextoTreino: { frequencia: '5x por semana' },
  });

  assert.equal(result.failSafe, false);
  const mainMeals = result.plan.refeicoes.filter((meal) => /almoco|jantar/.test(meal.tipo));
  assert.ok(mainMeals.length > 0, 'expected at least one main meal');
  for (const meal of mainMeals) {
    assert.ok(
      meal.itens.length <= 5,
      `main meal "${meal.nome}" has ${meal.itens.length} items — expected ≤5`
    );
  }
});

test('meal builder: does not insert a patch protein item to close a macro gap', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 28,
    peso: 60,
    altura: 165,
    objetivo: 'manutencao',
    refeicoesPorDia: 4,
    padraoAlimentar: 'onívoro',
  });

  assert.equal(result.failSafe, false);
  for (const meal of result.plan.refeicoes) {
    const cap = /cafe/.test(meal.tipo) ? 4 : /lanche|ceia/.test(meal.tipo) ? 3 : 5;
    assert.ok(
      meal.itens.length <= cap,
      `meal "${meal.nome}" has ${meal.itens.length} items — cap is ${cap}`
    );

    // A snack must not hold two separate protein items (original + patch whey)
    if (/lanche/.test(meal.tipo)) {
      const proteinItems = meal.itens.filter((item) =>
        /whey|frango|patinho|til[aá]pia|tofu|iogurte|ovo/i.test(item.nome)
      );
      assert.ok(
        proteinItems.length <= 1,
        `snack "${meal.nome}" has ${proteinItems.length} protein items — expected ≤1 (no patch food)`
      );
    }
  }
});
