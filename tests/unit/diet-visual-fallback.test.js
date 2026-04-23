const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function loadDietVisualHelpers() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = [
    extract(code, /function asKroniaNumber\(value, fallback\) \{[\s\S]*?\n\}/, 'asKroniaNumber'),
    extract(code, /function normalizeDietFoodText\(value\) \{[\s\S]*?\n\}/, 'normalizeDietFoodText'),
    extract(code, /function buildDefaultDietVisualPrescription\(\) \{[\s\S]*?\n\}/, 'buildDefaultDietVisualPrescription'),
    extract(code, /function cloneDietVisualPrescription\(value\) \{[\s\S]*?\n\}/, 'cloneDietVisualPrescription'),
    extract(code, /function buildDietVisualPrescriptionFromLegacyPlan\(plan\) \{[\s\S]*?\n\}/, 'buildDietVisualPrescriptionFromLegacyPlan'),
  ].join('\n\n');

  const context = {};
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'diet-visual-fallback-snippet.js' });
  return context;
}

test('buildDefaultDietVisualPrescription returns a complete professional fallback', () => {
  const context = loadDietVisualHelpers();
  const visual = context.buildDefaultDietVisualPrescription();

  assert.equal(visual.summary.kcal_total > 0, true);
  assert.equal(visual.summary.proteina > 0, true);
  assert.equal(Array.isArray(visual.meals), true);
  assert.equal(visual.meals.length >= 4, true);
  assert.equal(Array.isArray(visual.meals[0].items), true);
  assert.equal(visual.meals[0].items.length >= 3, true);
});

test('buildDietVisualPrescriptionFromLegacyPlan preserves real meals and quantities', () => {
  const context = loadDietVisualHelpers();
  const visual = context.buildDietVisualPrescriptionFromLegacyPlan({
    meta: { calorias: 2400, proteina: 160, carbo: 250, gordura: 70 },
    refeicoes: [
      {
        id: 'meal_1',
        tipo: 'cafe_da_manha',
        nome: 'Café da manhã',
        horario: '07:00',
        subtotal: { kcal: 540 },
        alimentos: [
          { nome: 'Ovos mexidos', qtde: '3 unidades' },
          { nome: 'Pão integral', qtde: '2 fatias' },
        ],
      },
    ],
  });

  assert.equal(visual.summary.kcal_total, 2400);
  assert.equal(visual.meals.length, 1);
  assert.equal(visual.meals[0].name, 'Café da manhã');
  assert.equal(visual.meals[0].kcal_estimada, 540);
  assert.deepEqual(Array.from(visual.meals[0].items), [
    'Ovos mexidos - 3 unidades',
    'Pão integral - 2 fatias',
  ]);
});
