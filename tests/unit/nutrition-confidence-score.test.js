'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cs = require('../../src/core/nutrition/nutritionConfidenceScore');

function makePlan(items, resumo) {
  return {
    refeicoes: [{ itens: items, subtotal: { calorias: resumo.calorias } }],
    resumoDiario: resumo
  };
}

test('Teste 1: plano com item flagged → score < 70', () => {
  const plan = makePlan([
    { nome: 'Iogurte Natural', gramas: 170, proteinas: 34, carboidratos: 8, gorduras: 6, calorias: 220, porcao: '170g', source: 'teste', semanticStatus: 'flagged' }
  ], { calorias: 220, proteinas: 34, carboidratos: 8, gorduras: 6 });
  const result = cs.scorePlanConfidence(plan);
  assert.ok(result.score < 70, 'score deve ser < 70, foi: ' + result.score);
  assert.strictEqual(result.level, 'low');
});

test('Teste 2: plano limpo (source + macros coerentes) → score >= 85', () => {
  const plan = makePlan([
    { nome: 'Frango grelhado', gramas: 120, proteinas: 37, carboidratos: 0, gorduras: 4, calorias: 198, porcao: '120g', source: 'TACO 191', semanticStatus: 'valid' },
    { nome: 'Arroz cozido', gramas: 120, proteinas: 3, carboidratos: 34, gorduras: 0.3, calorias: 156, porcao: '120g', source: 'TACO 15', semanticStatus: 'valid' }
  ], { calorias: 354, proteinas: 40, carboidratos: 34, gorduras: 4.3 });
  const result = cs.scorePlanConfidence(plan);
  assert.ok(result.score >= 85, 'score deve ser >= 85, foi: ' + result.score);
  assert.strictEqual(result.level, 'high');
});

test('Teste 3: plano com 1 item repaired sem gramagem explícita (estimativa) → score entre 70-84', () => {
  // Item sem gramagem no label (-15) + source estimativa (-10) = -25 → score 75
  const plan = makePlan([
    { nome: 'Iogurte grego', gramas: 170, proteinas: 17, carboidratos: 6, gorduras: 4, calorias: 130, porcao: '1 pote', source: 'estimativa_validada', semanticStatus: 'repaired' }
  ], { calorias: 130, proteinas: 17, carboidratos: 6, gorduras: 4 });
  const result = cs.scorePlanConfidence(plan);
  assert.ok(result.score >= 70 && result.score <= 84, 'score deve estar entre 70-84, foi: ' + result.score + ' (level: ' + result.level + ')');
  assert.strictEqual(result.level, 'medium');
});

test('Teste 4: plano com NaN em proteína → score < 70', () => {
  const plan = makePlan([
    { nome: 'Frango grelhado', gramas: 120, proteinas: NaN, carboidratos: 0, gorduras: 4, calorias: 198, porcao: '120g', source: 'TACO 191', semanticStatus: 'valid' }
  ], { calorias: 198, proteinas: NaN, carboidratos: 0, gorduras: 4 });
  const result = cs.scorePlanConfidence(plan);
  assert.ok(result.score < 70, 'score deve ser < 70 com NaN, foi: ' + result.score);
});

test('Teste 5: scoreFoodConfidence com source ausente → desconta 20 pontos', () => {
  const base = { nome: 'X', gramas: 100, proteinas: 10, carboidratos: 20, gorduras: 5, calorias: 165, porcao: '100g', source: 'TACO', semanticStatus: 'valid' };
  const noSource = { nome: 'X', gramas: 100, proteinas: 10, carboidratos: 20, gorduras: 5, calorias: 165, porcao: '100g', semanticStatus: 'valid' };
  const scoreBase = cs.scoreFoodConfidence(base);
  const scoreNoSource = cs.scoreFoodConfidence(noSource);
  assert.strictEqual(scoreBase - scoreNoSource, 20, 'diferença deve ser exatamente 20, foi: ' + (scoreBase - scoreNoSource));
});
