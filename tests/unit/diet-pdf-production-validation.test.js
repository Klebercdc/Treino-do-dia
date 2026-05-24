'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vp = require('../../src/lib/nutrition/visualPrescription');

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

function makePlan(overrides) {
  return Object.assign({
    refeicoes: [{ nome: 'Almoço', horario: '12:30', itens: [makeItem()], subtotal: { calorias: 198 } }],
    resumoDiario: { calorias: 198, proteinas: 37, carboidratos: 0, gorduras: 4 },
    productionReadiness: { ready: true },
    nutritionConfidence: { score: 95, level: 'high' },
    premiumValidation: { semanticValidation: true }
  }, overrides);
}

test('Teste 1: PDF não contém "estimativa proporcional"', () => {
  const plan = makePlan();
  const result = vp.buildVisualPrescription({ plan });
  const text = JSON.stringify(result);
  assert.ok(!/estimativa\s+proporcional/i.test(text), 'PDF não deve conter "estimativa proporcional"');
});

test('Teste 2: PDF contém rodapé de produção', () => {
  const plan = makePlan();
  const result = vp.buildVisualPrescription({ plan });
  assert.ok(result.productionFooter, 'productionFooter deve estar presente');
  assert.ok(result.productionFooter.includes('KroniA'), 'rodapé deve mencionar KroniA');
});

test('Teste 3: PDF contém bloco técnico com validação semântica', () => {
  const plan = makePlan();
  const result = vp.buildVisualPrescription({ plan });
  assert.ok(result.technicalBlock, 'technicalBlock deve estar presente');
  assert.ok(/validação semântica/i.test(result.technicalBlock), 'bloco técnico deve mencionar validação semântica');
});

test('Teste 4: PDF contém nível de confiança', () => {
  const plan = makePlan({ nutritionConfidence: { score: 92, level: 'high' } });
  const result = vp.buildVisualPrescription({ plan });
  assert.ok(result.technicalBlock, 'technicalBlock deve estar presente');
  assert.ok(/confiança/i.test(result.technicalBlock), 'bloco técnico deve mencionar confiança');
  assert.ok(/92/.test(result.technicalBlock), 'bloco técnico deve conter o score numérico');
});

test('Teste 5: PDF com productionReady=false contém aviso explícito no cabeçalho', () => {
  const plan = makePlan({
    productionReadiness: { ready: false },
    nutritionConfidence: { score: 55, level: 'low' },
    premiumValidation: { semanticValidation: false }
  });
  const result = vp.buildVisualPrescription({ plan });
  assert.ok(/revisão/i.test(result.dashboard.subtitle), 'subtitle deve mencionar revisão quando não-ready');
  assert.strictEqual(result.productionReady, false);
});

test('Teste 6: Nenhum campo visível contém "undefined" ou "NaN"', () => {
  const plan = makePlan({
    resumoDiario: { calorias: undefined, proteinas: NaN, carboidratos: 0, gorduras: 4 },
    nutritionConfidence: { score: NaN, level: 'low' }
  });
  const result = vp.buildVisualPrescription({ plan });
  const visibleText = JSON.stringify({
    summary: result.summary,
    meals: result.meals,
    technicalBlock: result.technicalBlock
  });
  assert.ok(!/\bundefined\b/.test(visibleText), 'campos visíveis não devem conter "undefined": ' + visibleText.slice(0, 200));
  assert.ok(!/\bNaN\b/.test(visibleText), 'campos visíveis não devem conter "NaN": ' + visibleText.slice(0, 200));
});
