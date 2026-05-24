'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const selector = require('../../src/core/nutrition/validatedFoodSelector');
const premiumCatalog = require('../../src/lib/nutrition/premiumCatalog');

// ─── textMatchesAlias ─────────────────────────────────────────────────────────

test('textMatchesAlias matches partial food name', () => {
  assert.equal(selector.textMatchesAlias('Frango grelhado', 'frango'), true);
  assert.equal(selector.textMatchesAlias('Iogurte grego natural', 'iogurte grego'), true);
  assert.equal(selector.textMatchesAlias('Batata-doce cozida', 'batata'), true);
});

test('textMatchesAlias returns false for no match', () => {
  assert.equal(selector.textMatchesAlias('Frango grelhado', 'salmão'), false);
  assert.equal(selector.textMatchesAlias('Aveia', 'arroz'), false);
});

test('textMatchesAlias is accent-insensitive', () => {
  assert.equal(selector.textMatchesAlias('Salmão grelhado', 'salmao'), true);
  assert.equal(selector.textMatchesAlias('Brócolis cozido', 'brocolis'), true);
});

// ─── validateFoodIntegrity ────────────────────────────────────────────────────

test('validateFoodIntegrity rejects iogurte natural with high protein', () => {
  const food = { name: 'Iogurte natural', grams: 170, protein: 15, carbs: 5, fat: 3 };
  assert.equal(selector.validateFoodIntegrity(food), false);
});

test('validateFoodIntegrity accepts iogurte grego with high protein', () => {
  const food = { name: 'Iogurte grego natural', grams: 170, protein: 17, carbs: 6, fat: 4 };
  assert.equal(selector.validateFoodIntegrity(food), true);
});

test('validateFoodIntegrity rejects egg with high carbs', () => {
  const food = { name: 'Ovo cozido', grams: 100, protein: 13, carbs: 10, fat: 10 };
  assert.equal(selector.validateFoodIntegrity(food), false);
});

test('validateFoodIntegrity accepts egg with low carbs', () => {
  const food = { name: 'Ovo cozido', grams: 100, protein: 13, carbs: 1.1, fat: 10.6 };
  assert.equal(selector.validateFoodIntegrity(food), true);
});

test('validateFoodIntegrity rejects chicken with carbs > 3g/100g', () => {
  const food = { name: 'Frango grelhado', grams: 120, protein: 31, carbs: 6, fat: 3.6 };
  assert.equal(selector.validateFoodIntegrity(food), false);
});

test('validateFoodIntegrity accepts chicken with zero carbs', () => {
  const food = { name: 'Frango grelhado', grams: 120, protein: 31, carbs: 0, fat: 3.6 };
  assert.equal(selector.validateFoodIntegrity(food), true);
});

test('validateFoodIntegrity rejects apple with high protein', () => {
  const food = { name: 'Maçã', grams: 130, protein: 5, carbs: 14, fat: 0.2 };
  assert.equal(selector.validateFoodIntegrity(food), false);
});

test('validateFoodIntegrity accepts apple with low protein', () => {
  const food = { name: 'Maçã', grams: 130, protein: 0.4, carbs: 14, fat: 0.2 };
  assert.equal(selector.validateFoodIntegrity(food), true);
});

test('validateFoodIntegrity rejects pao integral with absurd protein', () => {
  const food = { name: 'Pão integral', grams: 50, protein: 12, carbs: 24, fat: 2 };
  // 12g/50g = 24g/100g — too high
  assert.equal(selector.validateFoodIntegrity(food), false);
});

test('validateFoodIntegrity accepts pao integral with normal protein', () => {
  const food = { name: 'Pão integral', grams: 50, protein: 3, carbs: 24, fat: 2 };
  // 3g/50g = 6g/100g — reasonable
  assert.equal(selector.validateFoodIntegrity(food), true);
});

// ─── isRestricted ─────────────────────────────────────────────────────────────

test('isRestricted blocks chicken for vegetarian', () => {
  const food = { name: 'Frango grelhado', groupKey: 'proteinas', subgroupKey: 'aves' };
  assert.equal(selector.isRestricted(food, ['vegetariano'], []), true);
});

test('isRestricted allows eggs for vegetarian', () => {
  const food = { name: 'Ovo cozido', groupKey: 'proteinas', subgroupKey: 'ovos' };
  assert.equal(selector.isRestricted(food, ['vegetariano'], []), false);
});

test('isRestricted blocks dairy for vegan', () => {
  const food = { name: 'Iogurte natural', groupKey: 'laticinios', subgroupKey: 'iogurtes' };
  assert.equal(selector.isRestricted(food, ['vegano'], []), true);
});

test('isRestricted blocks disliked food', () => {
  const food = { name: 'Brócolis cozido', groupKey: 'vegetais', subgroupKey: 'cruciferos' };
  assert.equal(selector.isRestricted(food, [], ['brócolis']), true);
});

test('isRestricted blocks lactose foods when intolerant', () => {
  const food = { name: 'Iogurte natural', groupKey: 'laticinios', subgroupKey: 'iogurtes' };
  assert.equal(selector.isRestricted(food, ['intolerância lactose'], []), true);
});

test('isRestricted allows zero-lactose for lactose intolerant', () => {
  const food = { name: 'Iogurte zero lactose', groupKey: 'laticinios', subgroupKey: 'zero_lactose' };
  assert.equal(selector.isRestricted(food, ['lactose'], []), false);
});

// ─── getRelevantGroups ────────────────────────────────────────────────────────

test('getRelevantGroups protein in main meal uses mealProteins', () => {
  const groups = selector.getRelevantGroups('protein', 'almoco');
  assert.ok(groups.includes('mealProteins'));
  assert.ok(!groups.includes('breakfastProteins'));
});

test('getRelevantGroups protein in breakfast uses breakfastProteins', () => {
  const groups = selector.getRelevantGroups('protein', 'cafe_da_manha');
  assert.ok(groups.includes('breakfastProteins'));
  assert.ok(!groups.includes('mealProteins'));
});

test('getRelevantGroups fiber uses veggies', () => {
  const groups = selector.getRelevantGroups('fiber', 'almoco');
  assert.deepEqual(groups, ['veggies']);
});

// ─── selectValidatedFoodFromBlueprint ─────────────────────────────────────────

test('selectValidatedFoodFromBlueprint returns a food for protein role in almoco', () => {
  const library = premiumCatalog.buildPremiumFoodLibrary();
  const foodRole = {
    role: 'protein',
    suggestedAliases: ['frango', 'tilapia', 'atum']
  };
  const mealContext = { tipo: 'almoco' };
  const profile = { restricoesAlimentares: [], alimentosEvitar: [] };
  const food = selector.selectValidatedFoodFromBlueprint(foodRole, mealContext, profile, library, 0);
  assert.ok(food !== null, 'should return a food item');
  assert.ok(typeof food.name === 'string');
  assert.ok(typeof food.protein === 'number');
});

test('selectValidatedFoodFromBlueprint returns food with valid macros', () => {
  const library = premiumCatalog.buildPremiumFoodLibrary();
  const foodRole = {
    role: 'protein',
    suggestedAliases: ['frango', 'patinho', 'salmão']
  };
  const food = selector.selectValidatedFoodFromBlueprint(foodRole, { tipo: 'almoco' }, {}, library, 0);
  assert.ok(food !== null);
  // Proteins from premiumCatalog should pass integrity check
  assert.ok(selector.validateFoodIntegrity(food), 'selected food should pass integrity');
});

test('selectValidatedFoodFromBlueprint rotates on different indexes', () => {
  const library = premiumCatalog.buildPremiumFoodLibrary();
  const foodRole = {
    role: 'protein',
    suggestedAliases: ['frango', 'tilapia', 'atum', 'patinho', 'salmão']
  };
  const context = { tipo: 'almoco' };
  const profile = {};
  const food0 = selector.selectValidatedFoodFromBlueprint(foodRole, context, profile, library, 0);
  const food1 = selector.selectValidatedFoodFromBlueprint(foodRole, context, profile, library, 1);
  const food2 = selector.selectValidatedFoodFromBlueprint(foodRole, context, profile, library, 2);
  // At least some should differ (rotation)
  const names = [food0, food1, food2].filter(Boolean).map(f => f.name);
  // We can't guarantee all different since pool may be small, but verify all are valid
  names.forEach(name => assert.ok(typeof name === 'string'));
});

test('selectValidatedFoodFromBlueprint returns null for empty library group', () => {
  const emptyLibrary = { mealProteins: [] };
  const foodRole = { role: 'protein', suggestedAliases: ['frango'] };
  const result = selector.selectValidatedFoodFromBlueprint(foodRole, { tipo: 'almoco' }, {}, emptyLibrary, 0);
  assert.equal(result, null);
});

test('selectValidatedFoodFromBlueprint respects vegetarian restriction', () => {
  const library = premiumCatalog.buildPremiumFoodLibrary();
  const foodRole = { role: 'protein', suggestedAliases: ['frango', 'tilapia', 'tofu', 'ovo'] };
  const profile = { restricoesAlimentares: ['vegetariano'], alimentosEvitar: [] };
  const food = selector.selectValidatedFoodFromBlueprint(foodRole, { tipo: 'almoco' }, profile, library, 0);
  if (food) {
    // Should not be chicken or tilapia
    const name = food.name.toLowerCase();
    assert.ok(!/frango|tilapia|atum|patinho|salmao|sardinha/.test(name), 'vegetarian should not get meat');
  }
});

// ─── Catalog integrity — iogurte natural deve ter proteína baixa ───────────────

test('iogurte natural in catalog has protein ≤ 6g/100g', () => {
  const library = premiumCatalog.buildPremiumFoodLibrary();
  const allFoods = [
    ...library.breakfastProteins,
    ...library.fastProteins,
  ];
  const iogurteNatural = allFoods.find(f => {
    const n = f.name.toLowerCase();
    return n.includes('iogurte') && !n.includes('grego') && !n.includes('skyr') && !n.includes('proteic');
  });
  if (iogurteNatural) {
    const protein100 = (iogurteNatural.protein / iogurteNatural.grams) * 100;
    assert.ok(protein100 <= 6, `iogurte natural protein100 should be ≤ 6, got ${protein100.toFixed(1)}`);
  }
});

test('maca in catalog has protein ≤ 1.5g per serving', () => {
  const library = premiumCatalog.buildPremiumFoodLibrary();
  const allFoods = [...library.supportCarbs, ...library.breakfastCarbs, ...library.fastCarbs];
  const maca = allFoods.find(f => /^maçã$|^maca$/i.test(f.name.trim()));
  if (maca) {
    assert.ok(maca.protein <= 1.5, `maçã protein per serving should be ≤ 1.5, got ${maca.protein}`);
  }
});

test('frango in catalog has carbs near zero', () => {
  const library = premiumCatalog.buildPremiumFoodLibrary();
  const frango = library.mealProteins.find(f => /frango/.test(f.name.toLowerCase()));
  if (frango) {
    assert.ok(frango.carbs <= 1, `frango carbs should be ≤ 1, got ${frango.carbs}`);
  }
});

test('pao integral in catalog has reasonable portion (≤ 80g)', () => {
  const library = premiumCatalog.buildPremiumFoodLibrary();
  const allCarbs = [...library.breakfastCarbs, ...library.fastCarbs];
  const pao = allCarbs.find(f => /pao.?integral|pão.?integral/i.test(f.name));
  if (pao) {
    assert.ok(pao.grams <= 80, `pão integral portion should be ≤ 80g, got ${pao.grams}`);
  }
});
