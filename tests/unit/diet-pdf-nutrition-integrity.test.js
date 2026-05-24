'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// pdfDietGenerator is TypeScript — require compiled version or mock
let buildDietHtml;
try {
  const mod = require('../../src/ai/pdfDietGenerator');
  buildDietHtml = mod.buildDietHtml;
} catch (_) {
  // TypeScript not compiled in test env — skip
  buildDietHtml = null;
}

function makeMeal(name, foods, horario, obs) {
  return { refeicao: name, horario: horario || null, alimentos: foods || [], observacoes: obs || null };
}

function makePayload(overrides) {
  return Object.assign({
    titulo: 'Plano de hipertrofia',
    objetivo: 'Hipertrofia muscular',
    calorias: '2800 kcal',
    observacoesGerais: null,
    refeicoes: [
      makeMeal('Café da manhã', ['Ovos mexidos', 'Aveia', 'Banana'], '07:00'),
      makeMeal('Almoço', ['Frango grelhado', 'Arroz integral', 'Brócolis'], '12:30'),
    ]
  }, overrides || {});
}

// ─── PDF HTML generation ──────────────────────────────────────────────────────

(buildDietHtml ? test : test.skip)('buildDietHtml returns valid HTML string', () => {
  const html = buildDietHtml(makePayload());
  assert.ok(typeof html === 'string');
  assert.ok(html.includes('<!doctype html') || html.includes('<!DOCTYPE html'));
  assert.ok(html.includes('Plano de hipertrofia'));
});

(buildDietHtml ? test : test.skip)('buildDietHtml escapes HTML entities', () => {
  const payload = makePayload({ titulo: '<Script>alert(1)</Script>' });
  const html = buildDietHtml(payload);
  assert.ok(!html.includes('<Script>'), 'HTML should be escaped');
  assert.ok(html.includes('&lt;Script&gt;'));
});

(buildDietHtml ? test : test.skip)('buildDietHtml includes all meal names', () => {
  const html = buildDietHtml(makePayload());
  assert.ok(html.includes('Café da manhã'));
  assert.ok(html.includes('Almoço'));
});

(buildDietHtml ? test : test.skip)('buildDietHtml does NOT contain "estimativa proporcional" by default', () => {
  const html = buildDietHtml(makePayload());
  assert.ok(!html.includes('estimativa proporcional'), 'should not contain estimation text');
});

(buildDietHtml ? test : test.skip)('buildDietHtml shows AI active when aiMetadata.aiGenerated is true', () => {
  const payload = makePayload({
    aiMetadata: {
      aiGenerated: true,
      fallbackEngine: false,
      strategyName: 'hipertrofia_alta_proteina',
      validationSource: 'premiumCatalog/TACO/USDA'
    }
  });
  const html = buildDietHtml(payload);
  assert.ok(html.includes('IA') || html.includes('gerada por IA'), 'should mention AI generation');
  assert.ok(html.includes('ativa') || html.includes('active'), 'should show AI as active');
  assert.ok(!html.includes('inativa'), 'should not show AI as inactive');
});

(buildDietHtml ? test : test.skip)('buildDietHtml shows fallback when aiMetadata.fallbackEngine is true', () => {
  const payload = makePayload({
    aiMetadata: {
      aiGenerated: false,
      fallbackEngine: true,
      validationSource: 'premiumCatalog'
    }
  });
  const html = buildDietHtml(payload);
  assert.ok(html.includes('fallback') || html.includes('Fallback'), 'should mention fallback');
});

(buildDietHtml ? test : test.skip)('buildDietHtml shows validation source in AI footer', () => {
  const payload = makePayload({
    aiMetadata: {
      aiGenerated: true,
      fallbackEngine: false,
      validationSource: 'premiumCatalog/TACO/USDA/TBCA'
    }
  });
  const html = buildDietHtml(payload);
  assert.ok(html.includes('TACO') || html.includes('USDA'), 'should show validation source');
});

(buildDietHtml ? test : test.skip)('buildDietHtml renders gracefully without aiMetadata', () => {
  const payload = makePayload();
  // Should not throw and should still produce valid HTML
  let html;
  assert.doesNotThrow(() => { html = buildDietHtml(payload); });
  assert.ok(typeof html === 'string');
  assert.ok(html.includes('Almoço'));
});

(buildDietHtml ? test : test.skip)('buildDietHtml shows strategy name when provided', () => {
  const payload = makePayload({
    aiMetadata: {
      aiGenerated: true,
      fallbackEngine: false,
      strategyName: 'hipertrofia_alta_proteina_ciclagem_carbo',
    }
  });
  const html = buildDietHtml(payload);
  assert.ok(html.includes('hipertrofia_alta_proteina_ciclagem_carbo'), 'strategy name should appear in PDF');
});

// ─── Nutrition integrity of generated plan items ──────────────────────────────

test('nutrition integrity: no food item should have negative macros', () => {
  const renderer = require('../../src/core/nutrition/diet_prescription_renderer');
  const profile = {
    objetivo: 'hipertrofia', sexo: 'masculino', idade: 28, peso: 80, altura: 178,
    nivelAtividade: 'moderado', refeicoesPorDia: 4,
    restricoesAlimentares: [], alimentosEvitar: [], preferencias: [],
    labContext: { mode: null, clinicalFlags: [], criticalFlags: [] },
    clinicalData: { healthConditions: [], flags: {} },
  };
  const result = renderer.generateNutritionPlan(profile);
  (result.plan.refeicoes || []).forEach(meal => {
    (meal.itens || []).forEach(item => {
      assert.ok(item.proteinas >= 0, `${item.nome}: proteinas should be ≥ 0`);
      assert.ok(item.carboidratos >= 0, `${item.nome}: carboidratos should be ≥ 0`);
      assert.ok(item.gorduras >= 0, `${item.nome}: gorduras should be ≥ 0`);
      assert.ok(item.calorias >= 0, `${item.nome}: calorias should be ≥ 0`);
    });
  });
});

test('nutrition integrity: all items come from catalog (have a source)', () => {
  const renderer = require('../../src/core/nutrition/diet_prescription_renderer');
  const profile = {
    objetivo: 'emagrecimento', sexo: 'feminino', idade: 32, peso: 65, altura: 165,
    nivelAtividade: 'ativo', refeicoesPorDia: 5,
    restricoesAlimentares: [], alimentosEvitar: [], preferencias: [],
    labContext: { mode: null, clinicalFlags: [], criticalFlags: [] },
    clinicalData: { healthConditions: [], flags: {} },
  };
  const result = renderer.generateNutritionPlan(profile);
  (result.plan.refeicoes || []).forEach(meal => {
    (meal.itens || []).forEach(item => {
      assert.ok(
        item.source && item.source.length > 0,
        `item "${item.nome}" must have a non-empty source (catalog reference)`
      );
    });
  });
});
