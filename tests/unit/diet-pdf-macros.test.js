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
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
  };
}

function loadContext() {
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
    extract(code, /function getDietMacroValue\(source, keys\) \{[\s\S]*?\n\}/, 'getDietMacroValue'),
    extract(code, /function getDietKcalValue\(source\) \{[\s\S]*?\n\}/, 'getDietKcalValue'),
    extract(code, /function getDietProteinValue\(source\) \{[\s\S]*?\n\}/, 'getDietProteinValue'),
    extract(code, /function getDietCarbsValue\(source\) \{[\s\S]*?\n\}/, 'getDietCarbsValue'),
    extract(code, /function getDietFatValue\(source\) \{[\s\S]*?\n\}/, 'getDietFatValue'),
  ].join('\n\n');

  const localStorage = createLocalStorage();
  const context = {
    window: {
      KRONIA_PREMIUM_FOOD_CATALOG: {
        foods: [
          {
            id: 'frango_grelhado', slug: 'frango_grelhado',
            display_name_pt: 'Frango grelhado', canonical_name_pt: 'Frango grelhado',
            group_key: 'proteinas', default_portion_g: 120, default_unit: '120 g',
            kcal_100g: 165, protein_100g: 31, carbs_100g: 0, fat_100g: 3.6,
            fiber_100g: 0, sodium_mg_100g: 35, source: 'premium'
          },
          {
            id: 'salmo_grelhado', slug: 'salmo_grelhado',
            display_name_pt: 'Salmão grelhado', canonical_name_pt: 'Salmão grelhado',
            group_key: 'proteinas', default_portion_g: 100, default_unit: '100 g',
            kcal_100g: 208, protein_100g: 20.4, carbs_100g: 0, fat_100g: 13.4,
            fiber_100g: 0, sodium_mg_100g: 50, source: 'premium'
          }
        ],
        aliases: [
          { food_slug: 'frango_grelhado', alias: 'Frango grelhado', normalized_alias: 'frango grelhado' },
          { food_slug: 'salmo_grelhado', alias: 'Salmão grelhado', normalized_alias: 'salmao grelhado' }
        ]
      },
      _kroniaDietPlan: null,
      KRONIA_TACO_DATABASE: [
        {
          taco_id: 'TACO_0488', codigo_taco: 488,
          nome: 'Ovo, de galinha, inteiro, cozido/10minutos',
          categoria: 'Ovos e derivados',
          energia_kcal: 155, proteina_g: 13, carboidrato_g: 1.1, lipidios_g: 11,
          fibra_g: 0, sodio_mg: 124
        },
        {
          taco_id: 'TACO_0221', codigo_taco: 221,
          nome: 'Maçã, Argentina, com casca, crua',
          categoria: 'Frutas e derivados',
          energia_kcal: 63, proteina_g: 0.2, carboidrato_g: 16.6, lipidios_g: 0.2,
          fibra_g: 2, sodio_mg: 1
        },
        {
          taco_id: 'TACO_0316', codigo_taco: 316,
          nome: 'Nozes',
          categoria: 'Nozes e sementes',
          energia_kcal: 654, proteina_g: 14.3, carboidrato_g: 13.7, lipidios_g: 65.2,
          fibra_g: 6.7, sodio_mg: 1
        },
        {
          taco_id: 'TACO_0284', codigo_taco: 284,
          nome: 'Castanha-do-pará, crua',
          categoria: 'Nozes e sementes',
          energia_kcal: 656, proteina_g: 14.3, carboidrato_g: 4.8, lipidios_g: 66.4,
          fibra_g: 7.5, sodio_mg: 1
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
  vm.runInContext(snippet, context, { filename: 'diet-pdf-macros-snippet.js' });
  return context;
}

// --- Ovo (egg) ---

test('ovo - tem proteína e gordura altos, carboidrato quase zero', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ taco_id: 'TACO_0488' });
  assert.ok(food, 'ovo encontrado no catálogo');
  const m = ctx.calculateFoodMacros(food, 50); // 1 ovo ≈ 50 g
  assert.ok(m.protein > 5, `proteína ovo 50g deve ser > 5g, foi ${m.protein}`);
  assert.ok(m.fat > 4, `gordura ovo 50g deve ser > 4g, foi ${m.fat}`);
  assert.ok(m.carbs < 2, `carbs ovo 50g devem ser < 2g, foi ${m.carbs}`);
  assert.ok(m.kcal > 60, `kcal ovo 50g deve ser > 60, foi ${m.kcal}`);
});

test('ovo - normalizeDietEditorItem com per100 explícito (formato armazenado pelo sistema)', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ taco_id: 'TACO_0488' });
  const item = ctx.normalizeDietEditorItem({
    nome: 'Ovo mexido',
    taco_id: 'TACO_0488',
    source: 'taco',
    is_taco_fallback: true,
    gramas: 50,
    porcao: '50 g',
    per100: {
      kcal: food.kcal_100g, protein: food.protein_100g, carbs: food.carbs_100g,
      fat: food.fat_100g, fiber: food.fiber_100g, sodium: food.sodium_mg_100g
    }
  }, 1);
  assert.ok(item.kcal > 60, `kcal ovo deve ser > 60, foi ${item.kcal}`);
  assert.ok(item.protein > 5, `proteína ovo deve ser > 5g, foi ${item.protein}`);
  assert.ok(item.fat > 4, `gordura ovo deve ser > 4g, foi ${item.fat}`);
  assert.ok(item.carbs < 2, `carbs ovo devem ser < 2g, foi ${item.carbs}`);
});

test('ovo - getDietKcalValue / getDietProteinValue lêem campos kcal/protein de item normalizado', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ taco_id: 'TACO_0488' });
  const item = ctx.normalizeDietEditorItem({
    taco_id: 'TACO_0488', source: 'taco', is_taco_fallback: true, gramas: 50, porcao: '50 g',
    per100: { kcal: food.kcal_100g, protein: food.protein_100g, carbs: food.carbs_100g,
              fat: food.fat_100g, fiber: food.fiber_100g, sodium: food.sodium_mg_100g }
  }, 1);
  assert.ok(ctx.getDietKcalValue(item) > 0, 'getDietKcalValue deve retornar > 0 para ovo');
  assert.ok(ctx.getDietProteinValue(item) > 0, 'getDietProteinValue deve retornar > 0 para ovo');
  assert.ok(ctx.getDietFatValue(item) > 0, 'getDietFatValue deve retornar > 0 para ovo');
  assert.ok(ctx.getDietCarbsValue(item) < 2, 'getDietCarbsValue deve ser < 2 para ovo');
});

// --- Maçã (apple in high-protein plan) ---

test('maçã - tem carboidrato alto e proteína quase zero', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ taco_id: 'TACO_0221' });
  assert.ok(food, 'maçã encontrada no catálogo');
  const m = ctx.calculateFoodMacros(food, 130); // 1 maçã média ≈ 130 g
  assert.ok(m.carbs > 15, `carbs maçã 130g devem ser > 15g, foi ${m.carbs}`);
  assert.ok(m.protein < 1, `proteína maçã 130g deve ser < 1g, foi ${m.protein}`);
  assert.ok(m.fat < 1, `gordura maçã 130g deve ser < 1g, foi ${m.fat}`);
  assert.ok(m.kcal > 50 && m.kcal < 120, `kcal maçã 130g deve estar entre 50 e 120, foi ${m.kcal}`);
});

test('maçã - normalizeDietEditorItem com per100 mantém carboidrato dominante', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ taco_id: 'TACO_0221' });
  const item = ctx.normalizeDietEditorItem({
    nome: 'Maçã', taco_id: 'TACO_0221', source: 'taco', is_taco_fallback: true,
    gramas: 130, porcao: '130 g',
    per100: { kcal: food.kcal_100g, protein: food.protein_100g, carbs: food.carbs_100g,
              fat: food.fat_100g, fiber: food.fiber_100g, sodium: food.sodium_mg_100g }
  }, 1);
  assert.ok(item.carbs > item.protein, `maçã: carbs (${item.carbs}) devem ser maiores que proteína (${item.protein})`);
  assert.ok(item.carbs > item.fat, `maçã: carbs (${item.carbs}) devem ser maiores que gordura (${item.fat})`);
  assert.ok(item.kcal > 0, `kcal maçã deve ser > 0`);
});

// --- Nozes / Castanhas (nuts: high fat + coherent kcal) ---

test('nozes - têm gordura muito alta e kcal coerente com 9kcal/g de gordura', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ taco_id: 'TACO_0316' });
  assert.ok(food, 'nozes encontradas no catálogo');
  const m = ctx.calculateFoodMacros(food, 30); // porção típica 30 g
  assert.ok(m.fat > 15, `gordura nozes 30g deve ser > 15g, foi ${m.fat}`);
  // Kcal coerente: gordura*9 + proteína*4 + carbs*4 deve ser próximo de m.kcal
  const estimatedKcal = m.fat * 9 + m.protein * 4 + m.carbs * 4;
  assert.ok(Math.abs(m.kcal - estimatedKcal) < 20,
    `kcal nozes (${m.kcal}) deve estar próximo de estimativa termodinâmica (${estimatedKcal.toFixed(1)})`);
});

test('castanha-do-pará - tem gordura dominante sobre proteína e carbs', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ taco_id: 'TACO_0284' });
  assert.ok(food, 'castanha-do-pará encontrada no catálogo');
  const m = ctx.calculateFoodMacros(food, 30);
  assert.ok(m.fat > m.protein, `castanha: gordura (${m.fat}) deve ser maior que proteína (${m.protein})`);
  assert.ok(m.fat > m.carbs, `castanha: gordura (${m.fat}) deve ser maior que carbs (${m.carbs})`);
  assert.ok(m.kcal > 100, `kcal castanha 30g deve ser > 100, foi ${m.kcal}`);
});

test('nozes - normalizeDietEditorItem com per100: kcal coerente com macro ratio de gordura', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ taco_id: 'TACO_0316' });
  const item = ctx.normalizeDietEditorItem({
    nome: 'Nozes', taco_id: 'TACO_0316', source: 'taco', is_taco_fallback: true,
    gramas: 30, porcao: '30 g',
    per100: { kcal: food.kcal_100g, protein: food.protein_100g, carbs: food.carbs_100g,
              fat: food.fat_100g, fiber: food.fiber_100g, sodium: food.sodium_mg_100g }
  }, 1);
  assert.ok(item.fat > 15, `nozes: gordura deve ser > 15g por 30g, foi ${item.fat}`);
  assert.ok(item.kcal > 100, `nozes: kcal deve ser > 100 por 30g, foi ${item.kcal}`);
  const macroKcal = item.fat * 9 + item.protein * 4 + item.carbs * 4;
  assert.ok(Math.abs(item.kcal - macroKcal) < 25,
    `nozes: kcal (${item.kcal}) deve ser coerente com macros (${macroKcal.toFixed(1)})`);
});

// --- Frango / Salmão (high-protein sources) ---

test('frango grelhado - tem proteína dominante sobre gordura e carbs', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ food_slug: 'frango_grelhado' });
  assert.ok(food, 'frango encontrado no catálogo premium');
  const m = ctx.calculateFoodMacros(food, 120); // porção padrão
  assert.ok(m.protein > 30, `frango 120g: proteína deve ser > 30g, foi ${m.protein}`);
  assert.ok(m.protein > m.fat * 4, `frango: proteína (${m.protein}) deve ser bem maior que gordura (${m.fat})`);
  assert.ok(m.carbs === 0, `frango: carbs devem ser 0, foi ${m.carbs}`);
  assert.ok(m.kcal > 150, `frango 120g: kcal deve ser > 150, foi ${m.kcal}`);
});

test('salmão grelhado - tem proteína e gordura altos, sem carbs', () => {
  const ctx = loadContext();
  const food = ctx.resolveDietCatalogFood({ food_slug: 'salmo_grelhado' });
  assert.ok(food, 'salmão encontrado no catálogo premium');
  const m = ctx.calculateFoodMacros(food, 100);
  assert.ok(m.protein > 15, `salmão 100g: proteína deve ser > 15g, foi ${m.protein}`);
  assert.ok(m.fat > 8, `salmão 100g: gordura deve ser > 8g, foi ${m.fat}`);
  assert.ok(m.carbs === 0, `salmão: carbs devem ser 0, foi ${m.carbs}`);
  assert.ok(m.kcal > 150, `salmão 100g: kcal deve ser > 150, foi ${m.kcal}`);
});

test('frango - normalizeDietEditorItem com item inline (sem per100 nem food_slug) usa rawMacros', () => {
  const ctx = loadContext();
  // Item como vem do gerador de dieta AI: tem calorias/proteinas inline
  const item = ctx.normalizeDietEditorItem({
    nome: 'Frango grelhado',
    gramas: 120,
    porcao: '120 g',
    calorias: 198,
    proteinas: 37.2,
    carboidratos: 0,
    gorduras: 4.32,
  }, 1);
  // Sem food_slug ou per100, deve usar rawMacros inline
  assert.ok(item.kcal > 0, `frango inline: kcal deve ser > 0, foi ${item.kcal}`);
  assert.ok(item.protein > 0, `frango inline: proteína deve ser > 0, foi ${item.protein}`);
  assert.ok(item.protein > item.fat, `frango inline: proteína (${item.protein}) deve ser maior que gordura (${item.fat})`);
});

test('getDietKcalValue e getDietProteinValue lêem campos calorias/proteinas (formato do gerador AI)', () => {
  const ctx = loadContext();
  // Simula item como vem do gerador antes de normalizar
  const rawItem = { nome: 'Salmão grelhado', calorias: 208, proteinas: 20.4, carboidratos: 0, gorduras: 13.4 };
  assert.equal(ctx.getDietKcalValue(rawItem), 208);
  assert.equal(ctx.getDietProteinValue(rawItem), 20.4);
  assert.equal(ctx.getDietCarbsValue(rawItem), 0);
  assert.equal(ctx.getDietFatValue(rawItem), 13.4);
});
