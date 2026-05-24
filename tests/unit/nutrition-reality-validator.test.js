'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const validator = require('../../src/core/nutrition/nutritionRealityValidator');

// ─── validateFoodItem ──────────────────────────────────────────────────────────

test('validateFoodItem: frango grelhado with valid protein range passes', () => {
  const item = { nome: 'Frango grelhado', gramas: 120, proteinas: 37, carboidratos: 0, gorduras: 4, calorias: 198 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true, 'valid frango should pass');
  assert.equal(result.warnings.length, 0);
});

test('validateFoodItem: frango with very low protein fails', () => {
  const item = { nome: 'Frango grelhado', gramas: 120, proteinas: 10, carboidratos: 0, gorduras: 4, calorias: 80 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, false, 'frango with 8.3g/100g protein should fail');
  assert.ok(result.warnings.some(w => w.includes('proteína')));
});

test('validateFoodItem: frango with high carbs fails', () => {
  const item = { nome: 'Frango grelhado', gramas: 120, proteinas: 37, carboidratos: 8, gorduras: 4, calorias: 210 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, false, 'frango with 6.7g/100g carbs should fail');
});

test('validateFoodItem: iogurte natural with low protein passes', () => {
  const item = { nome: 'Iogurte natural', gramas: 170, proteinas: 6, carboidratos: 8, gorduras: 5, calorias: 104 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true);
});

test('validateFoodItem: iogurte natural with high protein fails', () => {
  const item = { nome: 'Iogurte natural', gramas: 170, proteinas: 22, carboidratos: 6, gorduras: 4, calorias: 140 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, false, 'iogurte natural com 12.9g/100g proteína deve falhar');
  assert.ok(result.warnings.some(w => w.includes('proteína')));
});

test('validateFoodItem: iogurte grego with high protein passes', () => {
  const item = { nome: 'Iogurte grego natural', gramas: 170, proteinas: 17, carboidratos: 6, gorduras: 4, calorias: 130 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true, 'iogurte grego com 10g/100g proteína deve passar');
});

test('validateFoodItem: salmão with valid macros passes', () => {
  const item = { nome: 'Salmão grelhado', gramas: 120, proteinas: 26, carboidratos: 0, gorduras: 14, calorias: 247 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true, 'salmão com proteína alta e carbo zero deve passar');
});

test('validateFoodItem: salmão with carbs fails', () => {
  const item = { nome: 'Salmão grelhado', gramas: 120, proteinas: 26, carboidratos: 10, gorduras: 14, calorias: 270 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, false, 'salmão com 8.3g/100g carbo deve falhar');
});

test('validateFoodItem: maçã with high protein fails', () => {
  const item = { nome: 'Maçã', gramas: 130, proteinas: 5, carboidratos: 14, gorduras: 0.2, calorias: 72 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, false, 'maçã com 3.8g/100g proteína deve falhar');
});

test('validateFoodItem: maçã with normal macros passes', () => {
  const item = { nome: 'Maçã', gramas: 130, proteinas: 0.4, carboidratos: 18, gorduras: 0.2, calorias: 72 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true);
});

test('validateFoodItem: ovo cozido with high carbs fails', () => {
  const item = { nome: 'Ovo cozido', gramas: 100, proteinas: 13, carboidratos: 10, gorduras: 10, calorias: 180 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, false, 'ovo com 10g/100g carbo deve falhar');
});

test('validateFoodItem: ovo cozido with low carbs passes', () => {
  const item = { nome: 'Ovo cozido', gramas: 100, proteinas: 13, carboidratos: 1.1, gorduras: 10.6, calorias: 155 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true);
});

test('validateFoodItem: castanhas with high fat passes', () => {
  const item = { nome: 'Castanhas', gramas: 20, proteinas: 3, carboidratos: 4, gorduras: 10, calorias: 120 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true, 'castanhas com 50g/100g gordura deve passar');
});

test('validateFoodItem: nozes with low fat fails', () => {
  const item = { nome: 'Nozes', gramas: 20, proteinas: 3, carboidratos: 3, gorduras: 4, calorias: 60 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, false, 'nozes com 20g/100g gordura deve falhar (min 35g)');
});

test('validateFoodItem: pão integral with normal macros passes', () => {
  const item = { nome: 'Pão integral', gramas: 50, proteinas: 6, carboidratos: 24, gorduras: 2, calorias: 125 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true, 'pão integral com macros normais deve passar');
});

test('validateFoodItem: pão integral with excessive protein fails', () => {
  const item = { nome: 'Pão integral', gramas: 50, proteinas: 12, carboidratos: 24, gorduras: 2, calorias: 200 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, false, 'pão integral com 24g/100g proteína deve falhar');
});

test('validateFoodItem: tilápia with valid protein passes', () => {
  const item = { nome: 'Tilápia grelhada', gramas: 140, proteinas: 36, carboidratos: 0, gorduras: 4, calorias: 179 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true, 'tilápia com 25.7g/100g proteína deve passar');
});

test('validateFoodItem: unknown food passes without warning', () => {
  const item = { nome: 'Alimento desconhecido', gramas: 100, proteinas: 50, carboidratos: 50, gorduras: 50, calorias: 800 };
  const result = validator.validateFoodItem(item);
  assert.equal(result.valid, true, 'alimento sem categoria conhecida deve passar sem aviso');
});

// ─── validateMeal ─────────────────────────────────────────────────────────────

test('validateMeal: valid meal with all coherent items passes', () => {
  const meal = {
    nome: 'Almoço',
    itens: [
      { nome: 'Frango grelhado', gramas: 120, proteinas: 37, carboidratos: 0, gorduras: 4, calorias: 198 },
      { nome: 'Arroz cozido', gramas: 120, proteinas: 3, carboidratos: 34, gorduras: 0.4, calorias: 156 },
    ]
  };
  const result = validator.validateMeal(meal);
  assert.equal(result.valid, true);
});

test('validateMeal: meal with incoherent iogurte natural fails', () => {
  const meal = {
    nome: 'Lanche',
    itens: [
      { nome: 'Iogurte natural', gramas: 170, proteinas: 22, carboidratos: 6, gorduras: 4, calorias: 180 }
    ]
  };
  const result = validator.validateMeal(meal);
  assert.equal(result.valid, false);
  assert.ok(result.warnings.length > 0);
});

// ─── validatePlan ─────────────────────────────────────────────────────────────

test('validatePlan: valid plan passes', () => {
  const plan = {
    refeicoes: [
      {
        nome: 'Café da manhã',
        itens: [
          { nome: 'Ovos mexidos', gramas: 150, proteinas: 12, carboidratos: 1, gorduras: 10, calorias: 140 }
        ]
      },
      {
        nome: 'Almoço',
        itens: [
          { nome: 'Frango grelhado', gramas: 120, proteinas: 37, carboidratos: 0, gorduras: 4, calorias: 198 }
        ]
      }
    ]
  };
  const result = validator.validatePlan(plan);
  assert.equal(result.valid, true);
});

test('validatePlan: returns valid true when no refeicoes', () => {
  const result = validator.validatePlan({});
  assert.equal(result.valid, true);
});

test('validatePlan: returns valid true for null plan', () => {
  const result = validator.validatePlan(null);
  assert.equal(result.valid, true);
});

// ─── assertPlanIntegrity ──────────────────────────────────────────────────────

test('assertPlanIntegrity: plan with matching totals has no issues', () => {
  const plan = {
    resumoDiario: { calorias: 198, proteinas: 37, carboidratos: 0, gorduras: 4 },
    refeicoes: [
      {
        nome: 'Almoço',
        subtotal: { calorias: 198, proteinas: 37, carboidratos: 0, gorduras: 4 },
        itens: [
          { nome: 'Frango grelhado', gramas: 120, proteinas: 37, carboidratos: 0, gorduras: 4, calorias: 198, source: 'USDA' }
        ]
      }
    ]
  };
  const issues = validator.assertPlanIntegrity(plan);
  assert.equal(issues.length, 0, 'valid plan should have no integrity issues');
});

test('assertPlanIntegrity: item without source flagged', () => {
  const plan = {
    resumoDiario: { calorias: 198, proteinas: 37, carboidratos: 0, gorduras: 4 },
    refeicoes: [
      {
        nome: 'Almoço',
        subtotal: { calorias: 198, proteinas: 37, carboidratos: 0, gorduras: 4 },
        itens: [
          { nome: 'Frango grelhado', gramas: 120, proteinas: 37, carboidratos: 0, gorduras: 4, calorias: 198 }
        ]
      }
    ]
  };
  const issues = validator.assertPlanIntegrity(plan);
  assert.ok(issues.some(i => i.includes('no source')), 'item without source should be flagged');
});

test('assertPlanIntegrity: mismatched totals flagged', () => {
  const plan = {
    resumoDiario: { calorias: 500, proteinas: 80, carboidratos: 50, gorduras: 20 },
    refeicoes: [
      {
        nome: 'Almoço',
        subtotal: { calorias: 198, proteinas: 37, carboidratos: 0, gorduras: 4 },
        itens: [
          { nome: 'Frango grelhado', gramas: 120, proteinas: 37, carboidratos: 0, gorduras: 4, calorias: 198, source: 'USDA' }
        ]
      }
    ]
  };
  const issues = validator.assertPlanIntegrity(plan);
  assert.ok(issues.some(i => i.includes('mismatch')), 'mismatched totals should be flagged');
});

// ─── getMacros100g ────────────────────────────────────────────────────────────

test('getMacros100g: normalizes macros correctly', () => {
  const item = { gramas: 120, proteinas: 37, carboidratos: 0, gorduras: 4, calorias: 198 };
  const m = validator.getMacros100g(item);
  assert.ok(Math.abs(m.protein - 30.83) < 0.1, 'protein/100g should be ~30.83');
  assert.ok(Math.abs(m.kcal - 165) < 1, 'kcal/100g should be ~165');
});

test('getMacros100g: handles missing grams gracefully', () => {
  const item = { proteinas: 10, carboidratos: 20, gorduras: 5, calorias: 165 };
  const m = validator.getMacros100g(item);
  assert.equal(m.protein, 10, 'defaults to 100g when grams missing');
});

// ─── matchCategory ────────────────────────────────────────────────────────────

test('matchCategory: identifies frango correctly', () => {
  const match = validator.matchCategory('Frango grelhado');
  assert.ok(match !== null, 'frango should match a category');
  assert.equal(match.key, 'aves');
});

test('matchCategory: identifies iogurte natural (not grego)', () => {
  const match = validator.matchCategory('Iogurte natural');
  assert.ok(match !== null);
  assert.equal(match.key, 'iogurte_natural');
});

test('matchCategory: identifies iogurte grego, not natural', () => {
  const match = validator.matchCategory('Iogurte grego natural');
  assert.ok(match !== null);
  assert.equal(match.key, 'iogurte_grego');
});

test('matchCategory: returns null for unknown food', () => {
  const match = validator.matchCategory('Alimento fantastico XYZ');
  assert.equal(match, null);
});
