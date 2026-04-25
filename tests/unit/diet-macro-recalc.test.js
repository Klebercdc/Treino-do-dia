const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function loadDietMacroContext() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = [
    extract(code, /function safeJSON\(key, fallback\) \{[\s\S]*?\n\}/, 'safeJSON'),
    extract(code, /function asKroniaNumber\(value, fallback\) \{[\s\S]*?\n\}/, 'asKroniaNumber'),
    extract(code, /function dietRound\(value, decimals\) \{[\s\S]*?\n\}/, 'dietRound'),
    extract(code, /function normalizeDietFoodText\(value\) \{[\s\S]*?\n\}/, 'normalizeDietFoodText'),
    extract(code, /var TACO_RUNTIME_PORTION_MAP = \{[\s\S]*?\n\};/, 'TACO_RUNTIME_PORTION_MAP'),
    extract(code, /function mapTacoCatalogGroup\(category\) \{[\s\S]*?\n\}/, 'mapTacoCatalogGroup'),
    extract(code, /function normalizeRuntimeFoodEntry\(food, sourceKind\) \{[\s\S]*?\n\}/, 'normalizeRuntimeFoodEntry'),
    extract(code, /function buildDefaultDietVisualPrescription\(\) \{[\s\S]*?\n\}/, 'buildDefaultDietVisualPrescription'),
    extract(code, /function cloneDietVisualPrescription\(value\) \{[\s\S]*?\n\}/, 'cloneDietVisualPrescription'),
    extract(code, /function getDietItemName\(item\) \{[\s\S]*?\n\}/, 'getDietItemName'),
    extract(code, /function extractDietQuantityGrams\(\) \{[\s\S]*?\n\}/, 'extractDietQuantityGrams'),
    extract(code, /function getDietRuntimeCatalogFoods\(\) \{[\s\S]*?\n\}/, 'getDietRuntimeCatalogFoods'),
    extract(code, /function buildDietCatalogIndexes\(\) \{[\s\S]*?\n\}/, 'buildDietCatalogIndexes'),
    extract(code, /function getDietCatalogIndexes\(\) \{[\s\S]*?\n\}/, 'getDietCatalogIndexes'),
    extract(code, /function resolveDietCatalogFood\(item\) \{[\s\S]*?\n\}/, 'resolveDietCatalogFood'),
    extract(code, /function calculateFoodMacros\(food, grams\) \{[\s\S]*?\n\}/, 'calculateFoodMacros'),
    extract(code, /function buildDietFallbackPer100\(item, grams\) \{[\s\S]*?\n\}/, 'buildDietFallbackPer100'),
    extract(code, /function calculateDietFallbackMacros\(per100, grams, currentValues\) \{[\s\S]*?\n\}/, 'calculateDietFallbackMacros'),
    extract(code, /function syncDietPlanVisualPrescription\(plan\) \{[\s\S]*?\n\}/, 'syncDietPlanVisualPrescription'),
    extract(code, /function normalizeDietEditorItem\(item, order\) \{[\s\S]*?\n\}/, 'normalizeDietEditorItem'),
    extract(code, /function recalculateDietPlan\(plan\) \{[\s\S]*?\n\}/, 'recalculateDietPlan'),
    extract(code, /function readLocalActiveDietPlan\(\) \{[\s\S]*?\n\}/, 'readLocalActiveDietPlan'),
    extract(code, /function setActiveDietPlan\(plan, options\) \{[\s\S]*?\n\}/, 'setActiveDietPlan'),
    extract(code, /function updateDietPlanItem\(mealIndex, itemIndex, field, value\) \{[\s\S]*?\n\}/, 'updateDietPlanItem'),
  ].join('\n\n');

  const localStorage = createLocalStorage();
  const context = {
    window: {
      KRONIA_PREMIUM_FOOD_CATALOG: {
        foods: [
          {
            id: 'frango_grelhado',
            slug: 'frango_grelhado',
            display_name_pt: 'Frango grelhado',
            canonical_name_pt: 'Frango grelhado',
            group_key: 'proteinas',
            default_portion_g: 120,
            default_unit: '120 g',
            kcal_100g: 165,
            protein_100g: 31,
            carbs_100g: 0,
            fat_100g: 3.6,
            fiber_100g: 0,
            sodium_mg_100g: 35,
            source: 'premium'
          },
          {
            id: 'arroz_cozido',
            slug: 'arroz_cozido',
            display_name_pt: 'Arroz cozido',
            canonical_name_pt: 'Arroz cozido',
            group_key: 'carboidratos',
            default_portion_g: 120,
            default_unit: '120 g',
            kcal_100g: 130,
            protein_100g: 2.5,
            carbs_100g: 28,
            fat_100g: 0.3,
            fiber_100g: 0.4,
            sodium_mg_100g: 35,
            source: 'premium'
          },
          {
            id: 'feijao_cozido',
            slug: 'feijao_cozido',
            display_name_pt: 'Feijão cozido',
            canonical_name_pt: 'Feijão cozido',
            group_key: 'carboidratos',
            default_portion_g: 100,
            default_unit: '100 g',
            kcal_100g: 76,
            protein_100g: 4.8,
            carbs_100g: 13.6,
            fat_100g: 0.5,
            fiber_100g: 8.5,
            sodium_mg_100g: 35,
            source: 'premium'
          }
        ],
        aliases: [
          { food_slug: 'frango_grelhado', alias: 'Frango grelhado', normalized_alias: 'frango grelhado' },
          { food_slug: 'arroz_cozido', alias: 'Arroz cozido', normalized_alias: 'arroz cozido' },
          { food_slug: 'feijao_cozido', alias: 'Feijão cozido', normalized_alias: 'feijao cozido' }
        ]
      },
      _kroniaDietPlan: null
    },
    localStorage,
    KRONIA_ACTIVE_DIET_PLAN_KEY: 'kronia_active_diet_plan_v1',
    NUTRITION_FOOD_CATALOG: [],
    _dietCatalogIndexCache: null,
    _dietTacoCatalogPromise: null,
    TACO_RUNTIME_PORTION_MAP: {
      TACO_0053: {
        default_portion_g: 50,
        default_unit: '1 unidade média (50 g)',
        medida_caseira: '1 unidade média (50 g)',
      },
    },
    renderActiveDietPlan() {},
    schedulePersistActiveDietPlan() {},
    buildFallbackActiveDietPlan() {
      return { meals: [], totals: {}, visualPrescription: null };
    }
  };

  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'diet-macro-recalc-snippet.js' });
  return context;
}

function buildPlan(context) {
  return {
    id: 'plan_1',
    title: 'Plano teste',
    targets: { kcal: 2200, protein: 160, carbs: 220, fat: 60 },
    visualPrescription: context.buildDefaultDietVisualPrescription(),
    meals: [
      {
        id: 'meal_1',
        name: 'Almoço',
        slot: 'almoco',
        time: '12:30',
        items: [
          {
            id: 'item_frango',
            name: 'Frango grelhado',
            food_slug: 'frango_grelhado',
            grams: 100,
            quantity: '100 g',
            kcal: 999,
            protein: 999,
            carbs: 999,
            fat: 999,
          },
          {
            id: 'item_arroz',
            name: 'Arroz cozido',
            food_slug: 'arroz_cozido',
            grams: 150,
            quantity: '150 g',
            kcal: 999,
            protein: 999,
            carbs: 999,
            fat: 999,
          },
          {
            id: 'item_feijao',
            name: 'Feijão cozido',
            food_slug: 'feijao_cozido',
            grams: 100,
            quantity: '100 g',
          }
        ]
      }
    ]
  };
}

test('calculateFoodMacros recalcula frango de 100g para 150g com proteína e kcal oficiais', () => {
  const context = loadDietMacroContext();
  const food = context.resolveDietCatalogFood({ food_slug: 'frango_grelhado' });
  const result = context.calculateFoodMacros(food, 150);

  assert.equal(result.kcal, 247.5);
  assert.equal(result.protein, 46.5);
  assert.equal(result.carbs, 0);
  assert.equal(result.fat, 5.4);
});

test('calculateFoodMacros recalcula arroz de 150g para 200g com carboidrato e kcal oficiais', () => {
  const context = loadDietMacroContext();
  const food = context.resolveDietCatalogFood({ food_slug: 'arroz_cozido' });
  const result = context.calculateFoodMacros(food, 200);

  assert.equal(result.kcal, 260);
  assert.equal(result.carbs, 56);
  assert.equal(result.protein, 5);
  assert.equal(result.fat, 0.6);
});

test('normalizeDietEditorItem preserva gramas explícitas em porcao textual antes do default do catálogo', () => {
  const context = loadDietMacroContext();
  const item = context.normalizeDietEditorItem({
    nome: 'Frango grelhado',
    food_slug: 'frango_grelhado',
    porcao: '100 g',
  }, 1);

  assert.equal(item.grams, 100);
  assert.equal(item.quantity, '100 g');
  assert.equal(item.kcal, 165);
  assert.equal(item.protein, 31);
});

test('normalizeDietEditorItem preserva per100 persistido mesmo quando existe catálogo resolvido', () => {
  const context = loadDietMacroContext();
  const item = context.normalizeDietEditorItem({
    nome: 'Frango grelhado',
    food_slug: 'frango_grelhado',
    porcao: '150 g',
    per100: {
      kcal: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fiber: 0,
      sodium: 35,
    },
  }, 1);

  assert.equal(item.grams, 150);
  assert.equal(item.kcal, 247.5);
  assert.equal(item.protein, 46.5);
});

test('editar gramas atualiza subtotal da refeição e total diário imediatamente', () => {
  const context = loadDietMacroContext();
  context.setActiveDietPlan(buildPlan(context), { render: false });
  const before = context.window._kroniaDietPlan;

  assert.equal(before.meals[0].subtotal.kcal, 436);
  assert.equal(before.meals[0].subtotal.protein, 39.6);
  assert.equal(before.totals.kcal, 436);

  context.updateDietPlanItem(0, 0, 'grams', 150);
  const afterChicken = context.window._kroniaDietPlan;

  assert.equal(afterChicken.meals[0].items[0].protein, 46.5);
  assert.equal(afterChicken.meals[0].items[0].kcal, 247.5);
  assert.equal(afterChicken.meals[0].subtotal.kcal, 519);
  assert.equal(afterChicken.meals[0].subtotal.protein, 55.1);
  assert.equal(afterChicken.totals.kcal, 519);

  context.updateDietPlanItem(0, 1, 'grams', 200);
  const afterRice = context.window._kroniaDietPlan;

  assert.equal(afterRice.meals[0].items[1].carbs, 56);
  assert.equal(afterRice.meals[0].items[1].kcal, 260);
  assert.equal(afterRice.meals[0].subtotal.kcal, 584);
  assert.equal(afterRice.totals.kcal, 584);
  assert.equal(afterRice.totals.carbs, 69.6);
});

test('plano salvo mantém novas gramas e visualPrescription refletindo macros recalculados', () => {
  const context = loadDietMacroContext();
  context.setActiveDietPlan(buildPlan(context), { render: false });
  context.updateDietPlanItem(0, 0, 'grams', 150);

  const persisted = context.readLocalActiveDietPlan();
  assert.equal(persisted.meals[0].items[0].grams, 150);
  assert.equal(persisted.meals[0].items[0].protein, 46.5);
  assert.equal(persisted.visualPrescription.summary.kcal_total, persisted.totals.kcal);
  assert.equal(persisted.visualPrescription.summary.proteina, persisted.totals.protein);
  assert.equal(persisted.visualPrescription.meals[0].kcal_estimada, persisted.meals[0].subtotal.kcal);
  assert.match(persisted.visualPrescription.meals[0].items[0], /Frango grelhado - 150 g/);
});

test('quando há food_slug do catálogo, macros errados não são preservados nem inventados', () => {
  const context = loadDietMacroContext();
  const normalized = context.normalizeDietEditorItem({
    nome: 'Frango grelhado',
    food_slug: 'frango_grelhado',
    gramas: 150,
    porcao: '150 g',
    calorias: 12,
    proteinas: 3,
    carboidratos: 9,
    gorduras: 1
  }, 1);

  assert.equal(normalized.catalogMatch, true);
  assert.equal(normalized.kcal, 247.5);
  assert.equal(normalized.protein, 46.5);
  assert.equal(normalized.carbs, 0);
  assert.equal(normalized.fat, 5.4);
  assert.equal(normalized.per100.protein, 31);
});
