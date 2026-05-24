'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const gate = require('../../src/core/nutrition/nutritionProductionGate');

function makeItem(overrides) {
  return Object.assign({
    nome: 'Frango grelhado',
    gramas: 120,
    proteinas: 37,
    carboidratos: 0,
    gorduras: 4,
    calorias: 198,
    porcao: '120g',
    source: 'TACO 191',
    semanticStatus: 'valid'
  }, overrides);
}

function makePlan(items, overrides) {
  const subtotalCal = items.reduce((s, i) => s + (isNaN(i.calorias) ? 0 : i.calorias), 0);
  const base = {
    refeicoes: [{ itens: items, subtotal: { calorias: subtotalCal } }],
    resumoDiario: { calorias: subtotalCal, proteinas: 37, carboidratos: 0, gorduras: 4 },
    nutritionConfidence: { score: 90 },
    premiumValidation: { semanticValidation: true }
  };
  return Object.assign(base, overrides || {});
}

test('Teste 1: plano com NaN em calorias → ready=false, blocker listado', () => {
  const plan = makePlan([makeItem({ calorias: NaN })], {
    resumoDiario: { calorias: NaN, proteinas: 37, carboidratos: 0, gorduras: 4 }
  });
  const result = gate.validateNutritionProductionReadiness(plan);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.some(b => /calorias/.test(b) || /NaN/.test(b)), 'deve ter blocker de calorias NaN: ' + JSON.stringify(result.blockers));
});

test('Teste 2: plano com item sem source → ready=false', () => {
  const plan = makePlan([makeItem({ source: undefined })]);
  const result = gate.validateNutritionProductionReadiness(plan);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.some(b => /source/.test(b)), 'deve ter blocker de source ausente');
});

test('Teste 3: plano com item flagged → ready=false', () => {
  const plan = makePlan([makeItem({ semanticStatus: 'flagged' })]);
  const result = gate.validateNutritionProductionReadiness(plan);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.some(b => /flagged/.test(b)), 'deve ter blocker de flagged');
});

test('Teste 4: plano com totais inconsistentes → ready=false', () => {
  const plan = makePlan([makeItem({ calorias: 198 })], {
    refeicoes: [{ itens: [makeItem({ calorias: 198 })], subtotal: { calorias: 300 } }],
    resumoDiario: { calorias: 198, proteinas: 37, carboidratos: 0, gorduras: 4 }
  });
  const result = gate.validateNutritionProductionReadiness(plan);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.some(b => /inconsistente/i.test(b)), 'deve ter blocker de totais inconsistentes: ' + JSON.stringify(result.blockers));
});

test('Teste 5: plano com string "estimativa proporcional" em campo → ready=false', () => {
  const plan = makePlan([makeItem({ source: 'estimativa proporcional' })]);
  const result = gate.validateNutritionProductionReadiness(plan);
  assert.strictEqual(result.ready, false);
  assert.ok(result.blockers.some(b => /estimativa proporcional/i.test(b)), 'deve ter blocker de estimativa proporcional');
});

test('Teste 6: plano limpo, score>=85, sem flagged → ready=true', () => {
  const plan = makePlan([makeItem()], { nutritionConfidence: { score: 90 } });
  const result = gate.validateNutritionProductionReadiness(plan);
  assert.strictEqual(result.ready, true);
  assert.strictEqual(result.blockers.length, 0);
});

test('Teste 7: plano com item repaired, score>=85 → ready=true, warning presente', () => {
  const plan = makePlan([makeItem({ semanticStatus: 'repaired', source: 'TACO' })], {
    nutritionConfidence: { score: 88 }
  });
  const result = gate.validateNutritionProductionReadiness(plan);
  assert.strictEqual(result.ready, true);
  assert.ok(result.warnings.length > 0, 'deve ter warnings para item repaired');
  assert.ok(result.warnings.some(w => /ajustado/i.test(w)), 'warning deve mencionar ajuste');
});
