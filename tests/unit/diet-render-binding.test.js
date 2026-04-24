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
    extract(code, /function buildDietItemSubtitle\(item\) \{[\s\S]*?\n\}/, 'buildDietItemSubtitle'),
    extract(code, /function renderDietMealCard\(meal, mealIndex\) \{[\s\S]*?\n\}/, 'renderDietMealCard'),
    extract(code, /function renderActiveDietPlan\(\) \{[\s\S]*?\n\}/, 'renderActiveDietPlan'),
  ].join('\n\n');

  const elements = {
    dietDataSummary: { innerHTML: '' },
    dietDataProgress: { innerHTML: '' },
    dietDataMeals: { innerHTML: '' },
    headerTitle: { textContent: '' },
    headerSubtitle: { textContent: '' },
    floatingRecalc: {
      style: {},
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
    },
  };

  const context = {
    window: {
      _kroniaDietPlan: null,
    },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(selector) {
        if (selector === '#dietDataScreen .diet-premium-header h1') return elements.headerTitle;
        if (selector === '#dietDataScreen .diet-premium-header p') return elements.headerSubtitle;
        if (selector === '#dietDataScreen .diet-premium-floating') return elements.floatingRecalc;
        return null;
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
    getDietVisualReasons: () => ['Proteínas distribuídas ao longo do dia'],
    getDietVisualGuidance: () => ['Concentre carboidratos perto do treino'],
    getDietPlanSequenceText: () => 'Proteína -> arroz e feijão -> legumes -> salada',
    getDietDisplayGrams: (item) => Number(item?.grams || 100),
    escapeHTML: (value) => String(value || ''),
    escapeAttr: (value) => String(value || ''),
    safeJSON: () => ({}),
    localStorage: {
      getItem() {
        return null;
      },
    },
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

test('renderDietMealCard preserves access to every meal item via preview chips', () => {
  const context = loadDietRenderContext();
  const html = context.renderDietMealCard({
    name: 'Almoço',
    time: '12:30',
    subtotal: { kcal: 640 },
    items: [
      { name: 'Frango', quantity: '180 g', grams: 180, kcal: 300, protein: 54, carbs: 0, fat: 7 },
      { name: 'Arroz', quantity: '160 g', grams: 160, kcal: 208, protein: 4, carbs: 45, fat: 1 },
      { name: 'Feijão', quantity: '100 g', grams: 100, kcal: 76, protein: 5, carbs: 14, fat: 0.5 },
    ],
  }, 1);

  assert.match(html, /Frango/);
  assert.match(html, /Arroz/);
  assert.match(html, /Feijão/);
  assert.equal((html.match(/diet-premium-preview-chip/g) || []).length, 3);
});

test('renderActiveDietPlan preserves nutritional summary and KRONOS guidance blocks', () => {
  const context = loadDietRenderContext();
  context.window._kroniaDietPlan = {
    totals: { kcal: 2100, protein: 150, carbs: 200, fat: 60 },
    targets: { kcal: 2300, protein: 170, carbs: 240, fat: 70 },
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
      guidance: ['Concentre carboidratos perto do treino'],
      reasons: ['Proteínas distribuídas ao longo do dia'],
      observation: '',
    },
    meals: [],
  };

  context.renderActiveDietPlan();

  assert.match(context.__elements.dietDataProgress.innerHTML, /Resumo nutricional/);
  assert.match(context.__elements.dietDataProgress.innerHTML, /Meta calórica/);
  assert.match(context.__elements.dietDataProgress.innerHTML, /Direção do KRONOS/);
  assert.match(context.__elements.dietDataProgress.innerHTML, /Proteína -&gt; arroz e feijão -&gt; legumes -&gt; salada|Proteína -> arroz e feijão -> legumes -> salada/);
});
