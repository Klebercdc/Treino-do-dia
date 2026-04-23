const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function loadDietRenderContext() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = [
    extract(code, /function getDietRenderableMeals\(plan\) \{[\s\S]*?\n\}/, 'getDietRenderableMeals'),
    extract(code, /function renderActiveDietPlan\(\) \{[\s\S]*?\n\}/, 'renderActiveDietPlan'),
  ].join('\n\n');

  const elements = {
    dietDataSummary: { innerHTML: '' },
    dietDataProgress: { innerHTML: '' },
    dietDataMeals: { innerHTML: '' },
  };

  const context = {
    window: {
      _kroniaDietPlan: null,
    },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
    },
    recalculateDietPlan: (plan) => {
      const next = Object.assign({ totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, targets: {}, meals: [] }, plan || {});
      next.totals = next.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      next.targets = next.targets || {};
      return next;
    },
    readLocalActiveDietPlan: () => null,
    buildFallbackActiveDietPlan: () => ({ totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, targets: {}, meals: [] }),
    buildDefaultDietVisualPrescription: () => ({ dashboard: { subtitle: 'fallback' }, observation: '', guidance: [], reasons: [] }),
    getNutritionFlowState: () => null,
    computeDietGenerationBaseline: () => null,
    asKroniaNumber: (value, fallback) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : Number(fallback || 0);
    },
    normalizeDietFoodText: (value) => String(value || '').toLowerCase().replace(/\s+/g, '_'),
    parseDietVisualItem: (item) => {
      const text = String(item || '');
      const parts = text.split(/\s+-\s+/);
      return {
        nome: parts.shift() || 'Alimento',
        porcao: parts.join(' - '),
        kcal: 0,
        prot: 0,
        carb: 0,
        gord: 0,
      };
    },
    normalizeDietEditorItem: (item, order) => ({
      id: `item_${order}`,
      name: item.nome,
      quantity: item.qtde || item.porcao || '',
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }),
    formatKroniaNumber: (value, suffix) => `${value}${suffix ? ` ${suffix}` : ''}`.trim(),
    getDietVisualReasons: () => [],
    getDietVisualGuidance: () => [],
    getDietPlanSequenceText: () => '',
    escapeHTML: (value) => String(value || ''),
    renderDietMealCard: (meal) => `<article data-meal="${meal.name}">${(meal.items || []).map((item) => `<span>${item.name}</span>`).join('')}</article>`,
    lucide: { createIcons() {} },
  };

  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'diet-render-binding-snippet.js' });
  context.__elements = elements;
  return context;
}

test('renderActiveDietPlan renders visualPrescription meals instead of legacy plan.meals', () => {
  const context = loadDietRenderContext();
  context.window._kroniaDietPlan = {
    totals: { kcal: 2100, protein: 150, carbs: 200, fat: 60 },
    targets: { kcal: 2100, protein: 150, carbs: 200, fat: 60 },
    visualPrescription: {
      dashboard: { subtitle: 'visual runtime' },
      meals: [
        {
          id: 'visual_1',
          name: 'Café visual',
          time: '07:00',
          kcal_estimada: 500,
          items: ['Ovos - 3 unidades', 'Pão integral - 2 fatias'],
        },
      ],
      guidance: [],
      reasons: [],
      observation: '',
    },
    meals: [
      {
        id: 'legacy_1',
        name: 'LEGACY',
        items: [{ name: 'ITEM LEGACY', quantity: '999 g' }],
      },
    ],
  };

  context.renderActiveDietPlan();

  assert.match(context.__elements.dietDataMeals.innerHTML, /Café visual/);
  assert.match(context.__elements.dietDataMeals.innerHTML, /Ovos/);
  assert.doesNotMatch(context.__elements.dietDataMeals.innerHTML, /LEGACY/);
  assert.doesNotMatch(context.__elements.dietDataMeals.innerHTML, /ITEM LEGACY/);
});
