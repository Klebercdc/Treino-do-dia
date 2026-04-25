const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const nutritionService = require('../../src/lib/nutrition/nutritionService');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

test('findNutritionFood prefers premium foods and falls back to TACO', () => {
  const premium = nutritionService.findNutritionFood('pao integral');
  assert.equal(premium.source, 'kronia');
  assert.equal(premium.code, 'pao_integral');

  const taco = nutritionService.findNutritionFood('pao frances');
  assert.equal(taco.source, 'taco');
  assert.equal(taco.taco_id, 'TACO_0053');
  assert.equal(taco.code, 'TACO_0053');
  assert.equal(taco.nome, 'Pão francês');
  assert.equal(taco.official_name, 'Pão, trigo, francês');
  assert.equal(taco.default_portion_g, 50);
});

test('searchNutritionFoods merges premium and TACO results without ugly duplicates', () => {
  const results = nutritionService.searchNutritionFoods('arroz branco', { limit: 20 });
  const names = results.map((item) => item.nome);
  const uniqueNames = new Set(names);

  assert.equal(results[0].source, 'kronia');
  assert.equal(results[0].taco_id, 'TACO_0003');
  assert.ok(!results.some((item, index) => index > 0 && item.taco_id === 'TACO_0003'));
  assert.equal(uniqueNames.size, names.length);
});

test('searchNutritionFoods supports accentless popular TACO aliases and realistic portions', () => {
  const cases = [
    ['pao frances', 'TACO_0053', 'Pão francês', 50],
    ['pão francês', 'TACO_0053', 'Pão francês', 50],
    ['ovo', 'TACO_0488', 'Ovo de galinha', 50],
    ['banana', 'TACO_0182', 'Banana', 86],
    ['feijao', 'TACO_0561', 'Feijão carioca cozido', 100],
    ['feijão preto', 'TACO_0567', 'Feijão preto cozido', 100],
    ['maca', 'TACO_0221', 'Maçã', 130],
    ['maçã', 'TACO_0221', 'Maçã', 130],
    ['batata doce', 'TACO_0088', 'Batata-doce cozida', 130],
    ['batata inglesa', 'TACO_0091', 'Batata inglesa cozida', 150],
    ['tapioca', 'TACO_0551', 'Tapioca', 70],
    ['macarrao', 'TACO_0040', 'Macarrão de trigo', 80],
    ['macarrão', 'TACO_0040', 'Macarrão de trigo', 80],
  ];

  for (const [query, tacoId, name, grams] of cases) {
    const results = nutritionService.searchNutritionFoods(query, { limit: 10 });
    const item = results.find((entry) => entry.taco_id === tacoId);
    assert.ok(item, query);
    if (item.source === 'taco') assert.equal(item.nome, name);
    assert.equal(item.default_portion_g, grams);
  }
});

test('nutritionService re-exports the unified food search helpers', () => {
  assert.equal(typeof nutritionService.findNutritionFood, 'function');
  assert.equal(typeof nutritionService.searchNutritionFoods, 'function');
});

test('estimateNutritionFromTaco scales 50g correctly through the unified lookup', () => {
  const tacoFood = nutritionService.findNutritionFood('pao frances');
  const estimated = nutritionService.estimateNutritionFromTaco(tacoFood, 50);

  assert.equal(estimated.grams, 50);
  assert.equal(estimated.scaleFactor, 0.5);
  assert.equal(estimated.kcal, Number((tacoFood.kcal_por_100g / 2).toFixed(4)));
  assert.equal(estimated.proteina, Number((tacoFood.proteina_por_100g / 2).toFixed(4)));
  assert.equal(estimated.carbo, Number((tacoFood.carbo_por_100g / 2).toFixed(4)));
});

test('diet editor search resolves TACO fallback items in the app flow', () => {
  const appCode = fs.readFileSync('app.js', 'utf8');
  const snippet = [
    extract(appCode, /var TACO_FOOD_UX_OVERRIDES = \{[\s\S]*?\n\};/, 'TACO_FOOD_UX_OVERRIDES'),
    extract(appCode, /var TACO_RUNTIME_PORTION_MAP = TACO_FOOD_UX_OVERRIDES;/, 'TACO_RUNTIME_PORTION_MAP'),
    extract(appCode, /function mapTacoCatalogGroup\(category\) \{[\s\S]*?\n\}/, 'mapTacoCatalogGroup'),
    extract(appCode, /function mergeDietAliases\(\) \{[\s\S]*?\n\}(?=\n\nfunction applyTacoFoodUx)/, 'mergeDietAliases'),
    extract(appCode, /function applyTacoFoodUx\(food\) \{[\s\S]*?\n\}/, 'applyTacoFoodUx'),
    extract(appCode, /function normalizeRuntimeFoodEntry\(food, sourceKind\) \{[\s\S]*?\n\}/, 'normalizeRuntimeFoodEntry'),
    extract(appCode, /function ensureDietTacoCatalogLoaded\(\) \{[\s\S]*?\n\}/, 'ensureDietTacoCatalogLoaded'),
    extract(appCode, /function getDietCatalogDedupKey\(item\) \{[\s\S]*?\n\}/, 'getDietCatalogDedupKey'),
    extract(appCode, /function getDietCatalogTacoKey\(item\) \{[\s\S]*?\n\}/, 'getDietCatalogTacoKey'),
    extract(appCode, /function getDietRuntimeCatalogFoods\(\) \{[\s\S]*?\n\}/, 'getDietRuntimeCatalogFoods'),
    extract(appCode, /function buildDietCatalogIndexes\(\) \{[\s\S]*?\n\}/, 'buildDietCatalogIndexes'),
    extract(appCode, /function getDietCatalogIndexes\(\) \{[\s\S]*?\n\}/, 'getDietCatalogIndexes'),
    extract(appCode, /function findDietCatalogItems\(query\) \{[\s\S]*?\n\}/, 'findDietCatalogItems'),
  ].join('\n\n');

  const context = {
    console,
    Promise,
    Array,
    Number,
    String,
    Object,
    Math,
    Date,
    Set,
    Map,
    JSON,
    document: {
      getElementById() {
        return null;
      },
    },
    normalizeDietFoodText(value) {
      return String(value == null ? '' : value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },
    asKroniaNumber(value, fallback) {
      const n = Number(value);
      return Number.isFinite(n) ? n : (fallback || 0);
    },
    dietRound(value, digits) {
      const factor = Math.pow(10, typeof digits === 'number' ? digits : 1);
      return Math.round(Number(value || 0) * factor) / factor;
    },
    NUTRITION_FOOD_CATALOG: [],
    _dietCatalogIndexCache: null,
    _dietTacoCatalogPromise: null,
    window: {
      KRONIA_PREMIUM_FOOD_CATALOG: {
        foods: [
          {
            id: 'pao_integral',
            slug: 'pao_integral',
            display_name_pt: 'Pão integral',
            canonical_name_pt: 'Pão integral',
            group_key: 'carboidratos',
            default_portion_g: 50,
            default_unit: '2 fatias',
            kcal_100g: 247,
            protein_100g: 8.5,
            carbs_100g: 41,
            fat_100g: 3.4,
            fiber_100g: 7,
            source: 'premium',
          },
          {
            id: 'arroz_cozido',
            slug: 'arroz_cozido',
            display_name_pt: 'Arroz cozido',
            canonical_name_pt: 'Arroz cozido',
            group_key: 'carboidratos',
            taco_id: 'TACO_0003',
            default_portion_g: 120,
            default_unit: '120 g',
            kcal_100g: 130,
            protein_100g: 2.5,
            carbs_100g: 28,
            fat_100g: 0.3,
            fiber_100g: 0.4,
            source: 'premium',
          },
        ],
        aliases: [],
      },
      KRONIA_TACO_DATABASE: [
        {
          taco_id: 'TACO_0053',
          codigo_taco: 53,
          nome: 'Pão, trigo, francês',
          categoria: 'Carboidratos',
          energia_kcal: 300,
          proteina_g: 9,
          lipidios_g: 3,
          carboidrato_g: 58,
          fibra_g: 2,
          sodio_mg: 500,
        },
        {
          taco_id: 'TACO_0003',
          codigo_taco: 3,
          nome: 'Arroz, integral, cozido',
          categoria: 'Cereais e derivados',
          energia_kcal: 124,
          proteina_g: 2.6,
          lipidios_g: 0.9,
          carboidrato_g: 25,
          fibra_g: 1.8,
          sodio_mg: 1,
        },
      ],
    },
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'app-food-search-snippet.js' });

  const french = context.findDietCatalogItems('pao frances');
  assert.ok(french.length > 0);
  assert.equal(french[0].source, 'taco');
  assert.equal(french[0].taco_id, 'TACO_0053');
  assert.equal(french[0].nome, 'Pão francês');
  assert.equal(french[0].official_name, 'Pão, trigo, francês');
  assert.equal(french[0].default_portion_g, 50);
  assert.match(french[0].default_unit, /1 unidade/i);

  const banana = context.normalizeRuntimeFoodEntry({
    taco_id: 'TACO_0182',
    codigo_taco: 182,
    nome: 'Banana',
    energia_kcal: 100,
    proteina_g: 1,
    carboidrato_g: 23,
    lipidios_g: 0.2,
    fibra_g: 2.6,
  }, 'taco');
  assert.equal(banana.default_portion_g, 86);
  assert.match(banana.default_unit, /86 g/);

  const apple = context.normalizeRuntimeFoodEntry({
    taco_id: 'TACO_0221',
    codigo_taco: 221,
    nome: 'Maçã',
    energia_kcal: 52,
    proteina_g: 0.3,
    carboidrato_g: 14,
    lipidios_g: 0.2,
    fibra_g: 2.4,
  }, 'taco');
  assert.equal(apple.default_portion_g, 130);
  assert.match(apple.default_unit, /130 g/);

  const egg = context.normalizeRuntimeFoodEntry({
    taco_id: 'TACO_0488',
    codigo_taco: 488,
    nome: 'Ovo',
    energia_kcal: 155,
    proteina_g: 13,
    carboidrato_g: 1.1,
    lipidios_g: 11,
    fibra_g: 0,
  }, 'taco');
  assert.equal(egg.default_portion_g, 50);
  assert.match(egg.default_unit, /50 g/);

  const rice = context.findDietCatalogItems('arroz');
  const riceNames = rice.map((item) => item.nome);
  assert.ok(rice.some((item) => item.source !== 'taco'));
  assert.ok(!rice.some((item) => item.source === 'taco' && item.taco_id === 'TACO_0003'));
  assert.equal(new Set(riceNames).size, riceNames.length);
});
