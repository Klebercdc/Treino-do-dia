'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const at = require('../../src/core/nutrition/nutritionAuditTrail');

test('Teste 1: createNutritionAuditTrail → retorna objeto com events[] vazio e generatedAt', () => {
  const trail = at.createNutritionAuditTrail();
  assert.ok(Array.isArray(trail.events), 'events deve ser array');
  assert.strictEqual(trail.events.length, 0, 'events deve ser vazio');
  assert.ok(typeof trail.generatedAt === 'string' && trail.generatedAt.length > 0, 'generatedAt deve ser string não vazia');
});

test('Teste 2: addAuditEvent → evento aparece em trail.events', () => {
  const trail = at.createNutritionAuditTrail();
  at.addAuditEvent(trail, { type: 'food_selected', detail: 'Frango grelhado', foodCode: 'frango_120' });
  assert.strictEqual(trail.events.length, 1);
  assert.strictEqual(trail.events[0].type, 'food_selected');
  assert.strictEqual(trail.events[0].foodCode, 'frango_120');
});

test('Teste 3: summarizeAuditTrail → contadores corretos por tipo de evento', () => {
  const trail = at.createNutritionAuditTrail();
  at.addAuditEvent(trail, { type: 'ai_active', detail: 'blueprint gerado' });
  at.addAuditEvent(trail, { type: 'food_selected', detail: 'Frango' });
  at.addAuditEvent(trail, { type: 'food_selected', detail: 'Arroz' });
  at.addAuditEvent(trail, { type: 'semantic_repair', detail: 'iogurte' });
  at.addAuditEvent(trail, { type: 'fallback_used', detail: 'timeout' });

  const summary = at.summarizeAuditTrail(trail);
  assert.strictEqual(summary.total, 5);
  assert.strictEqual(summary.byType['food_selected'], 2);
  assert.strictEqual(summary.byType['semantic_repair'], 1);
  assert.strictEqual(summary.byType['ai_active'], 1);
  assert.ok(summary.warnings.includes('timeout'), 'warnings deve incluir detalhe de fallback');
});

test('Teste 4: evento "semantic_repair" registrado após reparo semântico', () => {
  const trail = at.createNutritionAuditTrail();
  at.addAuditEvent(trail, { type: 'semantic_repair', detail: 'iogurte_natural → iogurte grego', foodCode: 'iogurte_natural' });
  const summary = at.summarizeAuditTrail(trail);
  assert.strictEqual(summary.semanticRepairs, 1);
  assert.strictEqual(trail.events[0].foodCode, 'iogurte_natural');
});
