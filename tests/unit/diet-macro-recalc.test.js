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
    extract(code, /var TACO_FOOD_UX_OVERRIDES = \{[\s\S]*?\n\};/, 'TACO_FOOD_UX_OVERRIDES'),
    extract(code, /var TACO_RUNTIME_PORTION_MAP = TACO_FOOD_UX_OVERRIDES;/, 'TACO_RUNTIME_PORTION_MAP'),
    extract(code, /function mapTacoCatalogGroup\(category\) \{[\s\S]*?\n\}/, 'mapTacoCatalogGroup'),
    extract(code, /function mergeDietAliases\(\) \{[\s\S]*?\n\}(?=\n\nfunction applyTacoFoodUx)/, 'mergeDietAliases'),
    extract(code, /function applyTacoFoodUx\(food\) \{[\s\S]*?\n\}/, 'applyTacoFoodUx'),
    extract(code, /function normalizeRuntimeFoodEntry\(food, sourceKind\) \{[\s\S]*?\n\}/, 'normalizeRuntimeFoodEntry'),
    extract(code, /function buildDefaultDietVisualPrescription\(\) \{[\s\S]*?\n\}/, 'buildDefaultDietVisualPrescription'),
    extract(code, /function cloneDietVisualPrescription\(value\) \{[\s\S]*?\n\}/, 'cloneDietVisualPrescription'),
    extract(code, /function getDietItemName\(item\) \{[\s\S]*?\n\}/, 'getDietItemName'),
    extract(code, /function extractDietQuantityGrams\(\) \{[\s\S]*?\n\}/, 'extractDietQuantityGrams'),
    extract(code, /function ensureDietTacoCatalogLoaded\(\) \{[\s\S]*?\n\}/, 'ensureDietTacoCatalogLoaded'),
    extract(code, /function getDietCatalogDedupKey\(item\) \{[\s\S]*?\n\}/, 'getDietCatalogDedupKey'),
    extract(code, /function getDietCatalogTacoKey\(item\) \{[\s\S]*?\n\}/, 'getDietCatalogTacoKey'),
    extract(code, /function getDietRuntimeCatalogFoods\(\) \{[\s\S]*?\n\}/, 'getDietRuntimeCatalogFoods'),
    extract(code, /function buildDietCatalogIndexes\(\) \{[\s\S]*?\n\}/, 'buildDietCatalogIndexes'),
    extract(code, /function getDietCatalogIndexes\(\) \{[\s\S]*?\n\}/, 'getDietCatalogIndexes'),
    extract(code, /function resolveDietCatalogFood\(item\) \{[\s\S]*?\n\}/, 'resolveDietCatalogFood'),
    extract(code, /function findDietCatalogItems\(query\) \{[\s\S]*?\n\}/, 'findDietCatalogItems'),
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
      _kroniaDietPlan: null,
      KRONIA_TACO_DATABASE: [
        {
          taco_id: 'TACO_0053',
          codigo_taco: 53,
          nome: 'Pão, trigo, francês',
          categoria: 'Cereais e derivados',
          energia_kcal: 300,
          proteina_g: 8,
          carboidrato_g: 58,
          lipidios_g: 3,
          fibra_g: 2,
          sodio_mg: 500
        },
        {
          taco_id: 'TACO_0488',
          codigo_taco: 488,
          nome: 'Ovo, de galinha, inteiro, cozido/10minutos',
          categoria: 'Ovos e derivados',
          energia_kcal: 155,
          proteina_g: 13,
          carboidrato_g: 1.1,
          lipidios_g: 11,
          fibra_g: 0,
          sodio_mg: 124
        },
        {
          taco_id: 'TACO_0182',
          codigo_taco: 182,
          nome: 'Banana, prata, crua',
          categoria: 'Frutas e derivados',
          energia_kcal: 98,
          proteina_g: 1.3,
          carboidrato_g: 26,
          lipidios_g: 0.1,
          fibra_g: 2,
          sodio_mg: 0
        },
        {
          taco_id: 'TACO_0003',
          codigo_taco: 3,
          nome: 'Arroz, tipo 1, cozido',
          categoria: 'Cereais e derivados',
          energia_kcal: 128,
          proteina_g: 2.5,
          carboidrato_g: 28.1,
          lipidios_g: 0.2,
          fibra_g: 1.6,
          sodio_mg: 1
        },
        {
          taco_id: 'TACO_0561',
          codigo_taco: 561,
          nome: 'Feijão, carioca, cozido',
          categoria: 'Leguminosas e derivados',
          energia_kcal: 76,
          proteina_g: 4.8,
          carboidrato_g: 13.6,
          lipidios_g: 0.5,
          fibra_g: 8.5,
          sodio_mg: 2
        },
        {
          taco_id: 'TACO_0001',
          codigo_taco: 1,
          nome: 'Arroz, integral, cozido',
          categoria: 'Cereais e derivados',
          energia_kcal: 124,
          proteina_g: 2.6,
          carboidrato_g: 25.8,
          lipidios_g: 1,
          fibra_g: 2.7,
          sodio_mg: 1
        },
        {
          taco_id: 'TACO_0567',
          codigo_taco: 567,
          nome: 'Feijão, preto, cozido',
          categoria: 'Leguminosas e derivados',
          energia_kcal: 77,
          proteina_g: 4.5,
          carboidrato_g: 14,
          lipidios_g: 0.5,
          fibra_g: 8.4,
          sodio_mg: 2
        },
        {
          taco_id: 'TACO_0088',
          codigo_taco: 88,
          nome: 'Batata, doce, cozida',
          categoria: 'Raízes, tubérculos e derivados',
          energia_kcal: 77,
          proteina_g: 0.6,
          carboidrato_g: 18.4,
          lipidios_g: 0.1,
          fibra_g: 2.2,
          sodio_mg: 3
        },
        {
          taco_id: 'TACO_0091',
          codigo_taco: 91,
          nome: 'Batata, inglesa, cozida',
          categoria: 'Raízes, tubérculos e derivados',
          energia_kcal: 52,
          proteina_g: 1.2,
          carboidrato_g: 11.9,
          lipidios_g: 0,
          fibra_g: 1.3,
          sodio_mg: 2
        },
        {
          taco_id: 'TACO_0551',
          codigo_taco: 551,
          nome: 'Tapioca, com manteiga',
          categoria: 'Preparações',
          energia_kcal: 348,
          proteina_g: 0.1,
          carboidrato_g: 63.6,
          lipidios_g: 10.9,
          fibra_g: 0,
          sodio_mg: 158
        },
        {
          taco_id: 'TACO_0040',
          codigo_taco: 40,
          nome: 'Macarrão, trigo, cru',
          categoria: 'Cereais e derivados',
          energia_kcal: 371,
          proteina_g: 10,
          carboidrato_g: 77.9,
          lipidios_g: 1.3,
          fibra_g: 2.9,
          sodio_mg: 7
        },
        {
          taco_id: 'TACO_0221',
          codigo_taco: 221,
          nome: 'Maçã, Argentina, com casca, crua',
          categoria: 'Frutas e derivados',
          energia_kcal: 63,
          proteina_g: 0.2,
          carboidrato_g: 16.6,
          lipidios_g: 0.2,
          fibra_g: 2,
          sodio_mg: 1
        }
      ]
    },
    localStorage,
    KRONIA_ACTIVE_DIET_PLAN_KEY: 'kronia_active_diet_plan_v1',
    NUTRITION_FOOD_CATALOG: [],
    _dietCatalogIndexCache: null,
    _dietTacoCatalogPromise: null,
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

test('normalizeDietEditorItem adiciona TACO com porção UX, per100 e identidade persistente', () => {
  const context = loadDietMacroContext();

  const cases = [
    ['TACO_0053', 'Pão francês', 50],
    ['TACO_0488', 'Ovo de galinha', 50],
    ['TACO_0182', 'Banana', 86],
    ['TACO_0221', 'Maçã', 130],
    ['TACO_0003', 'Arroz branco cozido', 120],
    ['TACO_0001', 'Arroz integral cozido', 120],
    ['TACO_0561', 'Feijão carioca cozido', 100],
    ['TACO_0567', 'Feijão preto cozido', 100],
    ['TACO_0088', 'Batata-doce cozida', 130],
    ['TACO_0091', 'Batata inglesa cozida', 150],
    ['TACO_0551', 'Tapioca', 70],
    ['TACO_0040', 'Macarrão cozido', 120],
  ];

  for (const [tacoId, name, grams] of cases) {
    const catalogFood = context.resolveDietCatalogFood({ taco_id: tacoId });
    assert.ok(catalogFood, tacoId);
    const item = context.normalizeDietEditorItem({
      nome: catalogFood.nome,
      sourceType: 'taco',
      source: 'taco',
      source_id: tacoId,
      taco_id: tacoId,
      codigo_taco: catalogFood.codigo_taco,
      official_name: catalogFood.official_name,
      is_taco_fallback: true,
      gramas: catalogFood.default_portion_g,
      porcao: catalogFood.default_unit,
      per100: {
        kcal: catalogFood.kcal_100g,
        protein: catalogFood.protein_100g,
        carbs: catalogFood.carbs_100g,
        fat: catalogFood.fat_100g,
        fiber: catalogFood.fiber_100g,
        sodium: catalogFood.sodium_mg_100g
      }
    }, 1);

    assert.equal(item.name, name);
    assert.equal(item.grams, grams);
    assert.equal(item.quantity, catalogFood.default_unit);
    assert.equal(item.source, 'taco');
    assert.equal(item.sourceType, 'taco');
    assert.equal(item.taco_id, tacoId);
    assert.equal(item.official_name, catalogFood.official_name);
    assert.equal(item.is_taco_fallback, true);
    assert.equal(item.kcal, context.dietRound(catalogFood.kcal_100g * grams / 100, 1));
    assert.equal(item.protein, context.dietRound(catalogFood.protein_100g * grams / 100, 1));
    assert.equal(item.carbs, context.dietRound(catalogFood.carbs_100g * grams / 100, 1));
    assert.equal(item.per100.kcal, catalogFood.kcal_100g);
  }
});

test('TACO runtime cobre busca, seleção, adição, cálculo, edição, salvamento e recarregamento para alimentos comuns', () => {
  const context = loadDietMacroContext();
  const cases = [
    ['pao frances', 'TACO_0053', 50],
    ['ovo', 'TACO_0488', 50],
    ['banana', 'TACO_0182', 86],
    ['maca', 'TACO_0221', 130],
    ['arroz branco', 'TACO_0003', 120],
    ['arroz integral', 'TACO_0001', 120],
    ['feijao carioca', 'TACO_0561', 100],
    ['feijao preto', 'TACO_0567', 100],
    ['batata doce', 'TACO_0088', 130],
    ['batata inglesa', 'TACO_0091', 150],
    ['tapioca', 'TACO_0551', 70],
    ['macarrao cozido', 'TACO_0040', 120],
  ];

  const items = cases.map(([query, tacoId, grams], index) => {
    const found = context.findDietCatalogItems(query).find((entry) => entry.taco_id === tacoId);
    assert.ok(found, `${query} encontrou ${tacoId}`);
    assert.equal(found.default_portion_g, grams);
    assert.equal(found.source, 'taco');
    assert.equal(found.is_taco_fallback, true);
    const item = context.normalizeDietEditorItem({
      nome: found.nome,
      source: 'taco',
      source_id: found.taco_id,
      taco_id: found.taco_id,
      codigo_taco: found.codigo_taco,
      gramas: found.default_portion_g,
      porcao: found.default_unit,
      official_name: found.official_name,
      is_taco_fallback: true,
      per100: found.per100
    }, index + 1);
    assert.equal(item.grams, grams);
    assert.equal(item.per100.kcal, found.kcal_100g);
    return item;
  });

  context.setActiveDietPlan({
    id: 'plan_taco_common',
    title: 'Plano TACO comum',
    targets: {},
    visualPrescription: context.buildDefaultDietVisualPrescription(),
    meals: [{ id: 'meal_1', name: 'Refeição TACO', slot: 'refeicao', items }]
  }, { render: false });

  context.updateDietPlanItem(0, 0, 'grams', 75);
  const persisted = context.readLocalActiveDietPlan();
  const reloaded = persisted.meals[0].items;
  assert.equal(reloaded.length, cases.length);
  assert.equal(reloaded[0].taco_id, 'TACO_0053');
  assert.equal(reloaded[0].grams, 75);
  assert.equal(reloaded[0].per100.kcal, 300);
  assert.equal(reloaded[0].kcal, 225);

  reloaded.forEach((item) => {
    assert.equal(item.source, 'taco');
    assert.equal(item.sourceType, 'taco');
    assert.ok(item.taco_id);
    assert.ok(item.official_name);
    assert.equal(typeof item.per100, 'object');
    assert.equal(item.kcal, context.dietRound(item.per100.kcal * item.grams / 100, 1));
  });
});

test('TACO salvo e recarregado mantém source, taco_id, grams e per100 sem drift', () => {
  const context = loadDietMacroContext();
  const catalogFood = context.resolveDietCatalogFood({ taco_id: 'TACO_0053' });
  const item = context.normalizeDietEditorItem({
    nome: catalogFood.nome,
    sourceType: 'taco',
    source: 'taco',
    source_id: 'TACO_0053',
    taco_id: 'TACO_0053',
    codigo_taco: 53,
    official_name: catalogFood.official_name,
    is_taco_fallback: true,
    gramas: 50,
    porcao: catalogFood.default_unit,
    per100: {
      kcal: catalogFood.kcal_100g,
      protein: catalogFood.protein_100g,
      carbs: catalogFood.carbs_100g,
      fat: catalogFood.fat_100g,
      fiber: catalogFood.fiber_100g,
      sodium: catalogFood.sodium_mg_100g
    }
  }, 1);

  context.setActiveDietPlan({
    id: 'plan_taco',
    title: 'Plano TACO',
    targets: {},
    visualPrescription: context.buildDefaultDietVisualPrescription(),
    meals: [{ id: 'meal_1', name: 'Café da manhã', slot: 'cafe', items: [item] }]
  }, { render: false });

  context.updateDietPlanItem(0, 0, 'grams', 75);
  const persisted = context.readLocalActiveDietPlan();
  const reloaded = persisted.meals[0].items[0];

  assert.equal(reloaded.name, 'Pão francês');
  assert.equal(reloaded.source, 'taco');
  assert.equal(reloaded.sourceType, 'taco');
  assert.equal(reloaded.taco_id, 'TACO_0053');
  assert.equal(reloaded.official_name, 'Pão, trigo, francês');
  assert.equal(reloaded.grams, 75);
  assert.equal(reloaded.per100.kcal, 300);
  assert.equal(reloaded.kcal, 225);
  assert.equal(reloaded.protein, 6);
  assert.equal(reloaded.carbs, 43.5);
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
