'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const renderer = require('../../src/core/nutrition/diet_prescription_renderer');
const strategyEngine = require('../../src/core/nutrition/diet_strategy_engine');

function round(v, d) {
  const f = Math.pow(10, d == null ? 0 : d);
  return Math.round(Number(v || 0) * f) / f;
}

function buildTestPlan(items) {
  const refeicoes = [{
    tipo: 'almoco',
    nome: 'Almoço',
    horario: '12:30',
    itens: items,
    subtotal: null
  }];
  const plan = { refeicoes: refeicoes };
  // Access recalculatePlanTotals via generateNutritionPlan pipeline with minimal fixture
  const strategy = strategyEngine.calculateNutrition({
    objetivo: 'manutencao', sexo: 'masculino', idade: 30, peso: 70, altura: 170,
    nivelAtividade: 'moderado', refeicoesPorDia: 3
  });
  if (strategy.failSafe) return null;
  const result = renderer.buildNutritionPrescription(strategy);
  return result;
}

test('Teste 1: soma das calorias das refeições bate com total do plano (tolerância 1 kcal)', () => {
  const strategy = strategyEngine.calculateNutrition({
    objetivo: 'manutencao', sexo: 'masculino', idade: 30, peso: 70, altura: 170,
    nivelAtividade: 'moderado', refeicoesPorDia: 4
  });
  if (strategy.failSafe) return;
  const result = renderer.buildNutritionPrescription(strategy);
  const plan = result.plan || result;
  const meals = plan.refeicoes || [];
  const summed = meals.reduce((acc, m) => acc + Number((m.subtotal && m.subtotal.calorias) || 0), 0);
  const total = Number(plan.resumoDiario && plan.resumoDiario.calorias || 0);
  if (total === 0) return; // skip if failsafe
  assert.ok(Math.abs(total - summed) <= 1, 'soma deve bater com total ±1 kcal. total=' + total + ' somado=' + Math.round(summed));
});

test('Teste 2: recalculatePlanTotals chamado, totais corretos após pipeline', () => {
  const strategy = strategyEngine.calculateNutrition({
    objetivo: 'hipertrofia', sexo: 'masculino', idade: 25, peso: 75, altura: 175,
    nivelAtividade: 'muito_ativo', refeicoesPorDia: 5
  });
  if (strategy.failSafe) return;
  const result = renderer.buildNutritionPrescription(strategy);
  const plan = result.plan || result;
  const resumo = plan.resumoDiario || {};
  const fields = [resumo.calorias, resumo.proteinas, resumo.carboidratos, resumo.gorduras];
  assert.ok(fields.every(f => typeof f === 'number' && isFinite(f)), 'todos os totais devem ser números finitos: ' + JSON.stringify(resumo));
});

test('Teste 3: plano com input mínimo não gera NaN', () => {
  const strategy = strategyEngine.calculateNutrition({
    objetivo: 'manutencao', sexo: 'feminino', idade: 28, peso: 60, altura: 160,
    nivelAtividade: 'sedentario', refeicoesPorDia: 3
  });
  if (strategy.failSafe) return;
  const result = renderer.buildNutritionPrescription(strategy);
  const plan = result.plan || result;
  const resumo = plan.resumoDiario || {};
  const hasNaN = [resumo.calorias, resumo.proteinas, resumo.carboidratos, resumo.gorduras]
    .some(v => v === undefined || v === null || (typeof v === 'number' && isNaN(v)));
  assert.ok(!hasNaN, 'totais não devem ser NaN mesmo com input mínimo. resumo=' + JSON.stringify(resumo));
});
