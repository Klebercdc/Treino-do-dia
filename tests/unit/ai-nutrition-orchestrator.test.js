'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const orchestrator = require('../../src/core/nutrition/aiNutritionOrchestrator');

// ─── getMealSlots ─────────────────────────────────────────────────────────────

test('getMealSlots returns 5 slots for count 5', () => {
  const slots = orchestrator.getMealSlots(5);
  assert.equal(slots.length, 5);
  assert.ok(slots.includes('cafe_da_manha'));
  assert.ok(slots.includes('almoco'));
  assert.ok(slots.includes('jantar'));
});

test('getMealSlots returns 3 slots for count 3', () => {
  const slots = orchestrator.getMealSlots(3);
  assert.equal(slots.length, 3);
  assert.deepEqual(slots, ['cafe_da_manha', 'almoco', 'jantar']);
});

test('getMealSlots returns 6 slots for count 6', () => {
  const slots = orchestrator.getMealSlots(6);
  assert.equal(slots.length, 6);
  assert.ok(slots.includes('ceia'));
});

test('getMealSlots clamps to [3,6]', () => {
  assert.equal(orchestrator.getMealSlots(1).length, 3);
  assert.equal(orchestrator.getMealSlots(99).length, 6);
});

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

test('buildSystemPrompt includes blueprint and diversity instructions', () => {
  const prompt = orchestrator.buildSystemPrompt();
  assert.ok(typeof prompt === 'string' && prompt.length > 100);
  assert.ok(prompt.includes('JSON'));
  assert.ok(prompt.includes('suggestedAliases'));
  assert.ok(prompt.includes('diversidade') || prompt.includes('DIVERSIDADE'));
});

// ─── parseAIResponse ─────────────────────────────────────────────────────────

test('parseAIResponse parses clean JSON', () => {
  const json = JSON.stringify({ strategyName: 'test', mealBlueprints: [], macroDistribution: {} });
  const result = orchestrator.parseAIResponse(json);
  assert.equal(result.strategyName, 'test');
});

test('parseAIResponse strips markdown fences', () => {
  const json = '```json\n{"strategyName":"hipertrofia","mealBlueprints":[],"macroDistribution":{}}\n```';
  const result = orchestrator.parseAIResponse(json);
  assert.equal(result.strategyName, 'hipertrofia');
});

test('parseAIResponse ignores text before first brace', () => {
  const raw = 'Aqui está:\n{"strategyName":"performance","mealBlueprints":[],"macroDistribution":{}}';
  const result = orchestrator.parseAIResponse(raw);
  assert.equal(result.strategyName, 'performance');
});

// ─── validateBlueprint ───────────────────────────────────────────────────────

test('validateBlueprint returns false for null input', () => {
  assert.equal(orchestrator.validateBlueprint(null, ['cafe_da_manha']), false);
});

test('validateBlueprint returns false when mealBlueprints missing', () => {
  const bp = { strategyName: 'test', macroDistribution: {} };
  assert.equal(orchestrator.validateBlueprint(bp, ['cafe_da_manha']), false);
});

test('validateBlueprint returns false when a slot is missing from mealBlueprints', () => {
  const bp = {
    strategyName: 'test',
    macroDistribution: {},
    mealBlueprints: [
      { tipo: 'cafe_da_manha', foodRoles: [{ role: 'protein', suggestedAliases: ['ovo'] }] }
    ]
  };
  const slots = ['cafe_da_manha', 'almoco'];
  assert.equal(orchestrator.validateBlueprint(bp, slots), false);
});

test('validateBlueprint returns false when foodRoles empty', () => {
  const bp = {
    strategyName: 'test',
    macroDistribution: {},
    mealBlueprints: [{ tipo: 'cafe_da_manha', foodRoles: [] }]
  };
  assert.equal(orchestrator.validateBlueprint(bp, ['cafe_da_manha']), false);
});

test('validateBlueprint returns false when suggestedAliases empty', () => {
  const bp = {
    strategyName: 'test',
    macroDistribution: {},
    mealBlueprints: [
      { tipo: 'cafe_da_manha', foodRoles: [{ role: 'protein', suggestedAliases: [] }] }
    ]
  };
  assert.equal(orchestrator.validateBlueprint(bp, ['cafe_da_manha']), false);
});

test('validateBlueprint returns true for valid blueprint', () => {
  const bp = {
    strategyName: 'hipertrofia',
    macroDistribution: { cafe_da_manha: { proteinShare: 0.25, carbShare: 0.20, fatShare: 0.25 } },
    mealBlueprints: [
      {
        tipo: 'cafe_da_manha',
        foodRoles: [
          { role: 'protein', suggestedAliases: ['ovos', 'iogurte grego', 'cottage'] },
          { role: 'carb', suggestedAliases: ['aveia', 'pão integral'] }
        ]
      }
    ]
  };
  assert.equal(orchestrator.validateBlueprint(bp, ['cafe_da_manha']), true);
});

// ─── normalizeMacroDistribution ──────────────────────────────────────────────

test('normalizeMacroDistribution normalizes shares to sum 1.0', () => {
  const dist = {
    cafe: { proteinShare: 0.3, carbShare: 0.3, fatShare: 0.3 },
    almoco: { proteinShare: 0.3, carbShare: 0.3, fatShare: 0.3 },
    jantar: { proteinShare: 0.3, carbShare: 0.3, fatShare: 0.3 },
  };
  const result = orchestrator.normalizeMacroDistribution(dist);
  const pSum = Object.values(result).reduce((s, d) => s + d.proteinShare, 0);
  assert.ok(Math.abs(pSum - 1.0) < 0.05);
});

test('normalizeMacroDistribution handles empty input', () => {
  const result = orchestrator.normalizeMacroDistribution({});
  assert.deepEqual(result, {});
});

// ─── sanitizeBlueprint ───────────────────────────────────────────────────────

test('sanitizeBlueprint marks aiGenerated true and fallbackEngine false', () => {
  const raw = {
    strategyName: 'test',
    mealBlueprints: [
      {
        tipo: 'almoco',
        nome: 'Almoço',
        foodRoles: [{ role: 'protein', suggestedAliases: ['frango', 'tilapia'] }]
      }
    ],
    macroDistribution: {}
  };
  const result = orchestrator.sanitizeBlueprint(raw, ['almoco']);
  assert.equal(result.aiGenerated, true);
  assert.equal(result.fallbackEngine, false);
  assert.equal(result.strategyName, 'test');
});

test('sanitizeBlueprint caps suggestedAliases at 6', () => {
  const raw = {
    strategyName: 'test',
    mealBlueprints: [
      {
        tipo: 'almoco',
        foodRoles: [{
          role: 'protein',
          suggestedAliases: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        }]
      }
    ],
    macroDistribution: {}
  };
  const result = orchestrator.sanitizeBlueprint(raw, ['almoco']);
  assert.equal(result.mealBlueprints[0].foodRoles[0].suggestedAliases.length, 6);
});

test('sanitizeBlueprint removes foodRoles missing suggestedAliases', () => {
  const raw = {
    strategyName: 'test',
    mealBlueprints: [
      {
        tipo: 'almoco',
        foodRoles: [
          { role: 'protein', suggestedAliases: ['frango'] },
          { role: 'carb' } // missing suggestedAliases
        ]
      }
    ],
    macroDistribution: {}
  };
  const result = orchestrator.sanitizeBlueprint(raw, ['almoco']);
  assert.equal(result.mealBlueprints[0].foodRoles.length, 1);
});

// ─── Fallback behavior (no real API call) ────────────────────────────────────

test('generateAINutritionBlueprint returns null when ANTHROPIC_API_KEY is absent', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const result = await orchestrator.generateAINutritionBlueprint({
      profile: { objetivo: 'hipertrofia', refeicoesPorDia: 4 }
    });
    assert.equal(result, null);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});
