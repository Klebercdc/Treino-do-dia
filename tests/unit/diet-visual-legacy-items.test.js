'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const visualPrescription = require('../../src/lib/nutrition/visualPrescription');

test('buildVisualPrescription monta items quando refeicao usa alimentos legados', () => {
  const visual = visualPrescription.buildVisualPrescription({
    plan: {
      refeicoes: [{
        nome: 'Almoço',
        horario: '12:30',
        alimentos: [
          { nome: 'Frango grelhado', qtde: '150 g', kcal: 248, prot: 46, carb: 0, gord: 6 },
          { nome: 'Arroz cozido', qtde: '120 g', kcal: 156, prot: 3, carb: 34, gord: 0.4 }
        ]
      }]
    },
    calculation: {
      targetCalories: 2200,
      macros: { protein: 160, carbs: 220, fat: 60 }
    }
  });

  assert.equal(visual.meals.length, 1);
  assert.deepEqual(visual.meals[0].items, [
    'Frango grelhado - 150 g',
    'Arroz cozido - 120 g'
  ]);
});
