'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../../src/core/nutrition/semanticNutritionValidator');

test('Teste 1: iogurte natural com proteína 20g/100g → repaired, nome corrigido', () => {
  const item = {
    nome: 'Iogurte natural',
    gramas: 100,
    proteinas: 20,
    carboidratos: 5,
    gorduras: 3,
    calorias: 127,
    porcao: '100g',
    source: 'teste'
  };
  const result = v.repairFoodSemantic(item, null);
  assert.ok(result.semanticStatus === 'repaired' || result.semanticStatus === 'substituted', 'status deve ser repaired ou substituted, foi: ' + result.semanticStatus);
  const nomeResultado = result.nome || result.name || '';
  assert.ok(
    /iogurte grego/i.test(nomeResultado),
    'nome deve ser corrigido para iogurte grego, foi: ' + nomeResultado
  );
});

test('Teste 2: frango 120g → proteína entre 30g e 38g', () => {
  const item = {
    nome: 'Frango grelhado',
    gramas: 120,
    proteinas: 37,
    carboidratos: 0,
    gorduras: 4,
    calorias: 198,
    porcao: '120g',
    source: 'TACO 191'
  };
  const result = v.repairFoodSemantic(item, null);
  assert.ok(result.proteinas >= 30 && result.proteinas <= 38, 'proteína deve estar entre 30-38g para 120g, foi: ' + result.proteinas);
});

test('Teste 3: pão integral "2 fatias (50g)" → tem gramagem explícita no label', () => {
  const item = {
    nome: 'Pão integral',
    gramas: 50,
    proteinas: 6,
    carboidratos: 24,
    gorduras: 2,
    calorias: 128,
    porcao: '2 fatias (50g)',
    source: 'TACO/USDA'
  };
  const result = v.repairFoodSemantic(item, null);
  const portionLabel = result.porcao || '';
  assert.ok(/\d+\s*g/.test(portionLabel), 'portionLabel deve conter gramagem explícita, foi: ' + portionLabel);
});

test('Teste 4: maçã com proteína 15g/100g → repaired ou substituted', () => {
  const item = {
    nome: 'Maçã',
    gramas: 130,
    proteinas: 19.5,
    carboidratos: 20,
    gorduras: 0.2,
    calorias: 160,
    porcao: '130g',
    source: 'teste'
  };
  const result = v.repairFoodSemantic(item, null);
  assert.ok(
    result.semanticStatus === 'repaired' || result.semanticStatus === 'substituted' || result.semanticStatus === 'flagged',
    'maçã com proteína 15g/100g deve ser flagged/repaired, foi: ' + result.semanticStatus
  );
  assert.ok(result.semanticWarnings.length > 0, 'deve ter warnings');
});

test('Teste 5: salmão com carbo > 5g/100g → warning gerado', () => {
  const item = {
    nome: 'Salmão grelhado',
    gramas: 120,
    proteinas: 24,
    carboidratos: 10,
    gorduras: 12,
    calorias: 240,
    porcao: '120g',
    source: 'TACO'
  };
  const validation = v.validateFoodSemantic(item, null);
  assert.ok(
    validation.warnings.some(w => /carb/i.test(w) || /carbo/i.test(w)),
    'deve gerar warning de carboidrato incoerente para salmão, warnings: ' + JSON.stringify(validation.warnings)
  );
});

test('Teste 6: item sem source → semanticStatus repaired (source atribuído)', () => {
  const item = {
    nome: 'Arroz cozido',
    gramas: 120,
    proteinas: 3,
    carboidratos: 34,
    gorduras: 0.3,
    calorias: 156,
    porcao: '120g'
  };
  const result = v.repairFoodSemantic(item, null);
  assert.ok(result.semanticStatus === 'repaired', 'deve ser repaired, foi: ' + result.semanticStatus);
  assert.ok(result.source, 'source deve ser atribuído: ' + result.source);
});

test('Teste 7: item válido → semanticStatus valid, warnings vazio', () => {
  const item = {
    nome: 'Frango grelhado',
    gramas: 120,
    proteinas: 37,
    carboidratos: 0,
    gorduras: 4,
    calorias: 198,
    porcao: '120g',
    source: 'TACO 191'
  };
  const result = v.repairFoodSemantic(item, null);
  assert.strictEqual(result.semanticStatus, 'valid');
  assert.strictEqual(result.semanticWarnings.length, 0);
});
