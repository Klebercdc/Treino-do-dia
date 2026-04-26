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
    extract(code, /function getDietMacroValue\(source, keys\) \{[\s\S]*?\n\}/, 'getDietMacroValue'),
    extract(code, /function getDietKcalValue\(source\) \{[\s\S]*?\n\}/, 'getDietKcalValue'),
    extract(code, /function getDietProteinValue\(source\) \{[\s\S]*?\n\}/, 'getDietProteinValue'),
    extract(code, /function getDietCarbsValue\(source\) \{[\s\S]*?\n\}/, 'getDietCarbsValue'),
    extract(code, /function getDietFatValue\(source\) \{[\s\S]*?\n\}/, 'getDietFatValue'),
    extract(code, /function getDietFiberValue\(source\) \{[\s\S]*?\n\}/, 'getDietFiberValue'),
    extract(code, /function formatFoodDisplayNumber\(value\) \{[\s\S]*?\n\}/, 'formatFoodDisplayNumber'),
    extract(code, /function normalizeFoodQuantityText\(quantity\) \{[\s\S]*?\n\}/, 'normalizeFoodQuantityText'),
    extract(code, /function getFoodDisplayQuantity\(item\) \{[\s\S]*?\n\}/, 'getFoodDisplayQuantity'),
    extract(code, /function getFoodDisplayValue\(item, keys\) \{[\s\S]*?\n\}/, 'getFoodDisplayValue'),
    extract(code, /function formatFoodQuantityLine\(item\) \{[\s\S]*?\n\}/, 'formatFoodQuantityLine'),
    extract(code, /function formatFoodMacrosLine\(item\) \{[\s\S]*?\n\}/, 'formatFoodMacrosLine'),
    extract(code, /function renderFoodMacrosLineHtml\(item, className\) \{[\s\S]*?\n\}/, 'renderFoodMacrosLineHtml'),
    extract(code, /function formatDietPdfMacro\(value, suffix\) \{[\s\S]*?\n\}/, 'formatDietPdfMacro'),
    extract(code, /function renderDietMacroSummaryCard\(plan, targets\) \{[\s\S]*?\n\}/, 'renderDietMacroSummaryCard'),
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
    dietRound: (value, precision) => {
      const factor = 10 ** Number(precision || 0);
      return Math.round(Number(value || 0) * factor) / factor;
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
    getDietFoodEmoji: () => '🍽️',
    getDietItemName: (item) => String(item?.name || item?.nome || 'Alimento'),
    _tpMealSlotIcon: () => 'utensils',
    _tpMealSlotColorClass: () => 'tp-meal-icon--orange',
    _tpMealStatusBadge: () => '<span class="tp-badge">Pendente</span>',
    escapeHTML: (value) => String(value || ''),
    escapeAttr: (value) => String(value || ''),
    safeJSON: () => ({}),
    localStorage: {
      getItem() {
        return null;
      },
    },
    lucide: { createIcons() {} },
    Number,
    NaN,
  };

  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'diet-render-binding-snippet.js' });
  context.__elements = elements;
  return context;
}

test('Minha Dieta shell uses compact header and removes legacy diet hero copy', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  assert.match(html, /class="tp-diet-compact-header"/);
  assert.match(html, />Minha Dieta</);
  assert.match(html, /class="tp-diet-pdf-btn"[^>]*>PDF</);
  assert.doesNotMatch(html, /Boa noite, Kleber/);
  assert.doesNotMatch(html, /Aqui está seu plano alimentar de hoje/);
  assert.doesNotMatch(html, /class="tp-bell-btn"/);
});

test('Minha Dieta CSS allows meal and food names to wrap instead of truncating', () => {
  const css = fs.readFileSync('styles.css', 'utf8');

  assert.match(css, /#dietDataScreen \.tp-meal-name \{[\s\S]*?white-space: normal;[\s\S]*?text-overflow: clip;/);
  assert.match(css, /#dietDataScreen \.diet-premium-food-name \{[\s\S]*?white-space: normal;[\s\S]*?text-overflow: clip;/);
});

test('food macro helpers render standardized Brazilian diet text', () => {
  const context = loadDietRenderContext();
  const item = { name: 'Queijo minas frescal', quantity: '50g', kcal: 76, protein: 7, carbs: 1, fat: 5 };

  assert.equal(context.formatFoodQuantityLine(item), '50 g · 76 kcal');
  assert.equal(context.formatFoodMacrosLine(item), 'C: 1 g  P: 7 g  G: 5 g');
  assert.equal(context.formatFoodQuantityLine({ quantity: '73.9g', kcal: 73.9 }), '73,9 g · 73,9 kcal');
  assert.equal(context.formatFoodMacrosLine({}), 'C: 0 g  P: 0 g  G: 0 g');
});

test('diet food cards no longer duplicate kcal and macros on the same line', () => {
  const context = loadDietRenderContext();
  const html = context.renderDietMealCard({
    name: 'Lanche',
    subtotal: { kcal: 76, protein: 7, carbs: 1, fat: 5 },
    items: [{ name: 'Queijo minas frescal', quantity: '50g', grams: 50, kcal: 76, protein: 7, carbs: 1, fat: 5 }],
  }, 0);

  assert.match(html, /Queijo minas frescal/);
  assert.match(html, /50 g · 76 kcal/);
  assert.match(html, /C: 1 g/);
  assert.match(html, /P: 7 g/);
  assert.match(html, /G: 5 g/);
  assert.doesNotMatch(html, /7g(?:&nbsp;)?\s*P|1g(?:&nbsp;)?\s*C|5g(?:&nbsp;)?\s*G/);
});

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

test('renderDietMealCard preserves access to every meal item without preview icon columns', () => {
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
  assert.doesNotMatch(html, /class="diet-premium-preview-chip"/);
  assert.doesNotMatch(html, /diet-premium-food-emoji/);
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

  assert.match(context.__elements.dietDataProgress.innerHTML, /POR QUE SUA DIETA ESTÁ ASSIM\?/);
  assert.match(context.__elements.dietDataProgress.innerHTML, /Proteínas distribuídas ao longo do dia/);
  assert.match(context.__elements.dietDataProgress.innerHTML, /Concentre carboidratos perto do treino/);
});

test('Minha Dieta renders compact macro card and does not render the old footer total/guidance block', () => {
  const context = loadDietRenderContext();
  context._dietCoreView = 'minha-dieta';
  context.renderDietCoreContent = (view, vm) => context.renderDietMealCard(vm.plan.meals[0], 0);
  context.analyzeDietContext = () => ({});
  context.generateDietViewModel = (dietContext) => ({
    plan: dietContext.activeDiet,
    meals: dietContext.activeDiet.meals,
  });
  context.window._kroniaDietPlan = {
    source: 'supabase_meal_plans',
    totals: { kcal: 2190, protein: 160, carbs: 342, fat: 65, fiber: 28 },
    targets: { kcal: 2190, protein: 160, carbs: 342, fat: 65 },
    meals: [{ name: 'Almoço', subtotal: { kcal: 700 }, items: [{ name: 'Frango', quantity: '150 g', kcal: 248, protein: 46 }] }],
  };

  context.renderActiveDietPlan();

  assert.match(context.__elements.dietDataSummary.innerHTML, /diet-macro-summary-card/);
  assert.match(context.__elements.dietDataSummary.innerHTML, /2190 kcal/);
  assert.match(context.__elements.dietDataSummary.innerHTML, /Proteína/);
  assert.match(context.__elements.dietDataSummary.innerHTML, /Fibra/);
  assert.doesNotMatch(context.__elements.dietDataProgress.innerHTML, /POR QUE SUA DIETA ESTÁ ASSIM/);
});

test('renderDietMealCard keeps meal and food layout text-only without meal or food icons', () => {
  const context = loadDietRenderContext();
  const html = context.renderDietMealCard({
    name: 'Café da manhã reforçado para treino',
    time: '07:00',
    subtotal: { kcal: 520 },
    items: [
      { name: 'Ovos mexidos', quantity: '3 un', grams: 150, kcal: 210, protein: 18, carbs: 1, fat: 15 },
    ],
  }, 0);

  assert.match(html, /Café da manhã reforçado para treino/);
  assert.match(html, /Ovos mexidos/);
  assert.doesNotMatch(html, /diet-premium-food-emoji/);
  assert.doesNotMatch(html, /tp-meal-icon-wrap/);
  assert.doesNotMatch(html, /data-lucide="utensils"/);
  assert.doesNotMatch(html, /data-lucide="pencil"/);
  assert.doesNotMatch(html, /text-overflow/);
});

test('PDF export contains KRONIA logo/fallback and fills macro aliases without dash placeholders', () => {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = [
    extract(code, /function getDietMacroValue\(source, keys\) \{[\s\S]*?\n\}/, 'getDietMacroValue'),
    extract(code, /function getDietKcalValue\(source\) \{[\s\S]*?\n\}/, 'getDietKcalValue'),
    extract(code, /function getDietProteinValue\(source\) \{[\s\S]*?\n\}/, 'getDietProteinValue'),
    extract(code, /function getDietCarbsValue\(source\) \{[\s\S]*?\n\}/, 'getDietCarbsValue'),
    extract(code, /function getDietFatValue\(source\) \{[\s\S]*?\n\}/, 'getDietFatValue'),
    extract(code, /function formatDietPdfMacro\(value, suffix\) \{[\s\S]*?\n\}/, 'formatDietPdfMacro'),
    extract(code, /function exportActiveDietPlanPDF\(\) \{[\s\S]*?\n\}/, 'exportActiveDietPlanPDF'),
  ].join('\n\n');
  let written = '';
  const context = {
    window: {
      _kroniaDietPlan: {
        title: 'Plano alimentar KRONIA',
        objective: 'hipertrofia',
        totals: { kcal: 2190, protein: 160, carbs: 342, fat: 65, fiber: 28 },
        targets: {},
        meals: [{
          name: 'Almoço',
          time: '12:30',
          items: [{ name: 'Frango', quantity: '150 g', calories: 248, prot: 46, carb: 0, gord: 6 }],
        }],
      },
      open() {
        return {
          document: {
            write(html) { written = html; },
            close() {},
          },
        };
      },
    },
    document: {},
    recalculateDietPlan: (plan) => plan,
    readLocalActiveDietPlan: () => null,
    buildFallbackActiveDietPlan: () => null,
    safeJSON: () => ({ nome: 'Kleber' }),
    localStorage: { getItem: () => null },
    getObjectiveLabel: (value) => value,
    getDietRenderableMeals: (plan) => plan.meals,
    getDietItemName: (item) => item.name,
    escapeHTML: (value) => String(value ?? ''),
    asKroniaNumber: (value, fallback) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : Number(fallback || 0);
    },
    formatKroniaNumber: (value, suffix) => `${value}${suffix ? ` ${suffix}` : ''}`.trim(),
    showToast() {},
    Number,
    NaN,
  };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'diet-pdf-snippet.js' });

  context.exportActiveDietPlanPDF();

  assert.match(written, /src="\/Kronia\.png"/);
  assert.match(written, /logo-fallback">KRONIA/);
  assert.match(written, /248 kcal/);
  assert.match(written, /46 g/);
  assert.match(written, /6 g/);
  assert.doesNotMatch(written, />-</);
});
