const test = require('node:test');
const assert = require('node:assert/strict');

const tacoDatabase = require('../../src/lib/nutrition/tacoDatabase');
const tacoService = require('../../src/lib/nutrition/tacoService');
const nutritionService = require('../../src/lib/nutrition/nutritionService');
const kronaFoodDatabase = require('../../src/lib/nutrition/kronaFoodDatabase');

test('TACO_DATABASE exists and contains the full official 4th edition count', () => {
  assert.ok(Array.isArray(tacoDatabase.TACO_DATABASE));
  assert.equal(tacoDatabase.TACO_DATABASE.length, 597);
});

test('TACO_DATABASE contains Pão francês through a search alias', () => {
  const item = tacoDatabase.TACO_DATABASE.find((food) => Array.isArray(food.aliases) && food.aliases.includes('Pão francês'));
  assert.ok(item);
  assert.equal(item.codigo_taco, 53);
  assert.match(item.nome, /Pão, trigo, francês/);
});

test('applyTacoFoodUx applies global Brazilian UX without changing official per100 nutrition', () => {
  const official = tacoDatabase.TACO_DATABASE.find((food) => food.taco_id === 'TACO_0053');
  const normalized = tacoService.applyTacoFoodUx(official);

  assert.equal(official.nome, 'Pão, trigo, francês');
  assert.equal(normalized.nome, 'Pão francês');
  assert.equal(normalized.official_name, 'Pão, trigo, francês');
  assert.equal(normalized.default_portion_g, 50);
  assert.equal(normalized.default_unit, '1 unidade média (50 g)');
  assert.equal(normalized.energia_kcal, official.energia_kcal);
  assert.equal(normalized.proteina_g, official.proteina_g);
  assert.ok(normalized.aliases.some((alias) => tacoService.normalizeText(alias) === 'pao frances'));
});

test('searchTacoFoods ignores accents and finds multiple rice entries', () => {
  const results = tacoService.searchTacoFoods('arroz');
  const codes = results.map((food) => food.codigo_taco);
  assert.ok(results.length > 1);
  assert.ok(codes.includes(1));
  assert.ok(codes.includes(3));
});

test('searchTacoFoods finds Pão francês from accent-insensitive input', () => {
  const results = tacoService.searchTacoFoods('pao frances');
  assert.ok(results.length > 0);
  assert.equal(results[0].codigo_taco, 53);
});

test('getTacoFoodByCode and getTacoFoodById work', () => {
  const byCode = tacoService.getTacoFoodByCode(53);
  const byId = tacoService.getTacoFoodById('TACO_0053');

  assert.equal(byCode.nome, 'Pão francês');
  assert.equal(byCode.official_name, 'Pão, trigo, francês');
  assert.equal(byId.codigo_taco, 53);
});

test('estimateNutritionFromTaco scales 50g from a 100g reference correctly', () => {
  const food = tacoService.getTacoFoodByCode(53);
  const estimated = tacoService.estimateNutritionFromTaco(food, 50);

  assert.equal(estimated.grams, 50);
  assert.equal(estimated.scaleFactor, 0.5);
  assert.equal(estimated.kcal, Number((food.energia_kcal / 2).toFixed(4)));
  assert.equal(estimated.proteina, Number((food.proteina_g / 2).toFixed(4)));
  assert.equal(estimated.carbo, Number((food.carboidrato_g / 2).toFixed(4)));
  assert.ok(Object.prototype.hasOwnProperty.call(food, 'vitamina_e_mg'));
  assert.equal(food.vitamina_e_mg, null);
});

test('mapTacoFoodToKroniaMacros returns the KroniA per-100g macro shape', () => {
  const food = tacoService.getTacoFoodByCode(53);
  const mapped = tacoService.mapTacoFoodToKroniaMacros(food);

  assert.deepEqual(
    Object.keys(mapped).sort(),
    ['calcio_mg_por_100g', 'carbo_por_100g', 'categoria', 'codigo_taco', 'ferro_mg_por_100g', 'fibra_por_100g', 'gordura_por_100g', 'kcal_por_100g', 'nome', 'official_name', 'potassio_mg_por_100g', 'proteina_por_100g', 'sodio_mg_por_100g', 'taco_id'].sort(),
  );
  assert.equal(mapped.kcal_por_100g, food.energia_kcal);
  assert.equal(mapped.proteina_por_100g, food.proteina_g);
  assert.equal(mapped.gordura_por_100g, food.lipidios_g);
});

test('nutritionService re-exports the TACO helpers', () => {
  assert.equal(nutritionService.TACO_DATABASE.length, 597);
  assert.equal(typeof nutritionService.getAllTacoFoods, 'function');
  assert.equal(typeof nutritionService.getTacoFoodById, 'function');
  assert.equal(typeof nutritionService.getTacoFoodByCode, 'function');
  assert.equal(typeof nutritionService.searchTacoFoods, 'function');
  assert.equal(typeof nutritionService.getTacoFoodsByCategory, 'function');
  assert.equal(typeof nutritionService.mapTacoFoodToKroniaMacros, 'function');
  assert.equal(typeof nutritionService.estimateNutritionFromTaco, 'function');
  assert.equal(typeof nutritionService.findBestTacoMatch, 'function');
  assert.equal(typeof nutritionService.applyTacoFoodUx, 'function');
  assert.equal(typeof nutritionService.classifyTacoFoodGroup, 'function');
});

test('TACO UX overrides cover common Brazilian editor portions and groups', () => {
  const cases = [
    ['TACO_0488', 'Ovo de galinha', 50, 'proteinas'],
    ['TACO_0182', 'Banana', 86, 'frutas'],
    ['TACO_0221', 'Maçã', 130, 'frutas'],
    ['TACO_0003', 'Arroz branco cozido', 120, 'carboidratos'],
    ['TACO_0001', 'Arroz integral cozido', 120, 'carboidratos'],
    ['TACO_0561', 'Feijão carioca cozido', 100, 'leguminosas'],
    ['TACO_0567', 'Feijão preto cozido', 100, 'leguminosas'],
    ['TACO_0088', 'Batata-doce cozida', 130, 'carboidratos'],
    ['TACO_0091', 'Batata inglesa cozida', 150, 'carboidratos'],
    ['TACO_0551', 'Tapioca', 70, 'carboidratos'],
    ['TACO_0040', 'Macarrão de trigo', 80, 'carboidratos'],
  ];

  for (const [id, name, grams, group] of cases) {
    const food = tacoService.getTacoFoodById(id);
    assert.equal(food.nome, name);
    assert.equal(food.default_portion_g, grams);
    assert.equal(food.group_key, group);
    assert.ok(food.official_name);
  }
});

test('kronaFoodDatabase keeps existing foods and adds safe taco_id mappings', () => {
  assert.ok(Array.isArray(kronaFoodDatabase.KRONA_FOODS));
  assert.ok(kronaFoodDatabase.KRONA_FOODS.length > 0);

  assert.equal(kronaFoodDatabase.getFoodByCode('pao_integral').taco_id, 'TACO_0052');
  assert.equal(kronaFoodDatabase.getFoodByCode('arroz_branco').taco_id, 'TACO_0003');
  assert.equal(kronaFoodDatabase.getFoodByCode('arroz_integral').taco_id, 'TACO_0001');
  assert.equal(kronaFoodDatabase.getFoodByCode('feijao_cozido').taco_id, 'TACO_0561');
  assert.equal(kronaFoodDatabase.getFoodByCode('batata_doce').taco_id, 'TACO_0088');
  assert.equal(kronaFoodDatabase.getFoodByCode('batata_inglesa').taco_id, 'TACO_0091');
  assert.equal(kronaFoodDatabase.getFoodByCode('aveia').taco_id, 'TACO_0007');
  assert.equal(kronaFoodDatabase.getFoodByCode('ovo_inteiro').taco_id, 'TACO_0488');
  assert.equal(kronaFoodDatabase.getFoodByCode('frango_grelhado').taco_id, 'TACO_0410');
  assert.equal(kronaFoodDatabase.getFoodByCode('patinho_grelhado').taco_id, 'TACO_0377');
  assert.equal(kronaFoodDatabase.getFoodByCode('banana').taco_id, 'TACO_0182');
  assert.equal(kronaFoodDatabase.getFoodByCode('maca').taco_id, 'TACO_0221');
});
