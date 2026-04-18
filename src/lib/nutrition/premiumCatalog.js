'use strict';

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 1;
  var factor = Math.pow(10, d);
  return Math.round(Number(value || 0) * factor) / factor;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '_');
}

var GROUPS = {
  proteinas: {
    label: 'Proteínas',
    defaultTags: ['high_protein'],
    subgroups: {
      aves: ['Frango grelhado', 'Frango desfiado', 'Peito de peru assado', 'Sobrecoxa sem pele assada'],
      bovinos_magros: ['Patinho grelhado', 'Coxão mole magro', 'Músculo cozido', 'Carne moída magra'],
      suinos_magros: ['Lombo suíno assado', 'Filé mignon suíno', 'Pernil magro desfiado'],
      peixes_brancos: ['Tilápia grelhada', 'Merluza assada', 'Pescada cozida', 'Linguado grelhado'],
      peixes_gordos: ['Salmão grelhado', 'Sardinha assada', 'Atum em lata', 'Cavalinha assada'],
      frutos_do_mar: ['Camarão cozido', 'Lula grelhada', 'Mexilhão cozido'],
      ovos: ['Ovos mexidos', 'Ovo cozido', 'Claras de ovo'],
      laticinios_proteicos: ['Iogurte grego natural', 'Cottage', 'Queijo branco', 'Skyr natural'],
      proteinas_vegetais: ['Tofu firme', 'Tempeh', 'Seitan', 'Edamame', 'Grão-de-bico cozido', 'Lentilha cozida', 'Feijão preto cozido'],
      suplementos: ['Whey protein', 'Caseína', 'Proteína vegetal em pó']
    }
  },
  carboidratos: {
    label: 'Carboidratos',
    defaultTags: [],
    subgroups: {
      arroz_e_graos: ['Arroz cozido', 'Arroz integral cozido', 'Quinoa cozida', 'Cuscuz de milho', 'Milho cozido', 'Trigo sarraceno cozido'],
      tuberculos: ['Batata-doce cozida', 'Batata inglesa cozida', 'Mandioca cozida', 'Inhame cozido', 'Mandioquinha cozida'],
      massas: ['Macarrão cozido', 'Macarrão integral cozido', 'Nhoque de batata'],
      paes: ['Pão integral', 'Pão francês', 'Pão sírio integral', 'Tortilha integral'],
      cereais: ['Aveia', 'Granola sem açúcar', 'Creme de arroz', 'Tapioca', 'Cereal de milho sem açúcar'],
      leguminosas: ['Feijão cozido', 'Feijão carioca cozido', 'Ervilha cozida', 'Lentilha cozida carbo', 'Grão-de-bico cozido carbo'],
      frutas_energeticas: ['Banana', 'Uva', 'Manga', 'Tâmara seca']
    }
  },
  gorduras: {
    label: 'Gorduras',
    defaultTags: ['alta_densidade_calorica'],
    subgroups: {
      azeites_e_oleos: ['Azeite de oliva', 'Óleo de abacate', 'Óleo de coco'],
      oleaginosas: ['Castanhas', 'Amêndoas', 'Nozes', 'Castanha-do-pará', 'Pistache'],
      sementes: ['Sementes de chia', 'Linhaça', 'Semente de abóbora', 'Gergelim'],
      pastas: ['Pasta de amendoim', 'Pasta de amêndoas', 'Tahine'],
      abacate_e_azeitona: ['Abacate', 'Azeitona verde', 'Azeitona preta']
    }
  },
  frutas: {
    label: 'Frutas',
    defaultTags: ['baixa_densidade_calorica'],
    subgroups: {
      menor_impacto_glicemico: ['Frutas vermelhas', 'Morango', 'Kiwi', 'Pera', 'Ameixa'],
      neutras: ['Maçã', 'Laranja', 'Mamão', 'Melão', 'Abacaxi', 'Pêssego'],
      mais_energeticas: ['Banana prata', 'Manga palmer', 'Uva rubi', 'Caqui', 'Tâmara seca fruta']
    }
  },
  vegetais: {
    label: 'Vegetais',
    defaultTags: ['baixa_densidade_calorica', 'alta_saciedade'],
    subgroups: {
      folhas: ['Salada verde', 'Alface', 'Rúcula', 'Espinafre', 'Couve refogada', 'Agrião'],
      cruciferos: ['Brócolis cozido', 'Couve-flor cozida', 'Repolho roxo', 'Couve-de-bruxelas'],
      legumes: ['Cenoura cozida', 'Abobrinha refogada', 'Berinjela assada', 'Chuchu cozido', 'Vagem cozida', 'Pepino'],
      aromaticos: ['Tomate', 'Pimentão', 'Cebola roxa', 'Alho poró'],
      cogumelos: ['Cogumelo paris', 'Shitake', 'Shimeji']
    }
  },
  laticinios: {
    label: 'Laticínios e substitutos',
    defaultTags: [],
    subgroups: {
      leite: ['Leite', 'Leite desnatado', 'Leite zero lactose'],
      iogurtes: ['Iogurte natural', 'Iogurte grego natural lac', 'Kefir natural'],
      queijos: ['Queijo minas frescal', 'Ricota', 'Cottage lac'],
      bebidas_vegetais: ['Bebida vegetal de soja', 'Bebida vegetal de amêndoas', 'Bebida vegetal de aveia'],
      zero_lactose: ['Iogurte zero lactose', 'Queijo zero lactose']
    }
  },
  temperos: {
    label: 'Temperos e molhos',
    defaultTags: ['facil_preparo'],
    subgroups: {
      ervas_secas: ['Ervas secas', 'Orégano', 'Manjericão', 'Alecrim', 'Tomilho'],
      especiarias: ['Cúrcuma', 'Páprica', 'Pimenta-do-reino', 'Canela', 'Cominho'],
      molhos_leves: ['Mostarda', 'Vinagrete', 'Molho de tomate caseiro', 'Molho de iogurte', 'Shoyu light'],
      bases_culinarias: ['Alho e cebola', 'Limão', 'Gengibre', 'Salsinha e cebolinha']
    }
  }
};

var MACRO_PRESETS = {
  proteinas: { kcal: 165, protein: 27, carbs: 1, fat: 6, fiber: 0, portion: 120, unit: 'g' },
  carboidratos: { kcal: 130, protein: 3, carbs: 28, fat: 0.6, fiber: 2, portion: 120, unit: 'g' },
  gorduras: { kcal: 590, protein: 10, carbs: 12, fat: 52, fiber: 7, portion: 20, unit: 'g' },
  frutas: { kcal: 65, protein: 0.8, carbs: 16, fat: 0.2, fiber: 2.6, portion: 120, unit: 'g' },
  vegetais: { kcal: 28, protein: 1.8, carbs: 5, fat: 0.3, fiber: 2.4, portion: 100, unit: 'g' },
  laticinios: { kcal: 70, protein: 6, carbs: 6, fat: 3, fiber: 0, portion: 170, unit: 'g' },
  temperos: { kcal: 25, protein: 1, carbs: 4, fat: 0.7, fiber: 1, portion: 10, unit: 'g' }
};

var FOOD_OVERRIDES = {
  'frango_grelhado': { kcal: 165, protein: 31, carbs: 0, fat: 3.6, portion: 120, unitLabel: '120 g', tags: ['high_protein', 'facil_preparo', 'pos_treino'] },
  'ovos_mexidos': { kcal: 140, protein: 12, carbs: 1, fat: 10, portion: 150, unitLabel: '3 un', tags: ['high_protein', 'cafe_da_manha'] },
  'patinho_grelhado': { kcal: 188, protein: 28, carbs: 0, fat: 8, portion: 120, unitLabel: '120 g' },
  'tilapia_grelhada': { kcal: 128, protein: 26, carbs: 0, fat: 2.7, portion: 140, unitLabel: '140 g' },
  'atum_em_lata': { kcal: 132, protein: 28, carbs: 0, fat: 1.5, portion: 120, unitLabel: '1 lata' },
  'salmão_grelhado': { kcal: 206, protein: 22, carbs: 0, fat: 12, portion: 120, unitLabel: '120 g' },
  'tofu_firme': { kcal: 96, protein: 10, carbs: 2.5, fat: 5.5, fiber: 1.2, portion: 200, unitLabel: '200 g', tags: ['vegano', 'vegetariano', 'high_protein'] },
  'whey_protein': { kcal: 400, protein: 80, carbs: 10, fat: 6, portion: 30, unitLabel: '30 g', tags: ['high_protein', 'pos_treino'] },
  'arroz_cozido': { kcal: 130, protein: 2.5, carbs: 28, fat: 0.3, fiber: 0.4, portion: 120, unitLabel: '120 g' },
  'feijão_cozido': { kcal: 76, protein: 4.8, carbs: 13.6, fat: 0.5, fiber: 8.5, portion: 100, unitLabel: '100 g' },
  'batata_doce_cozida': { kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, portion: 130, unitLabel: '130 g', tags: ['pre_treino'] },
  'aveia': { kcal: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6, portion: 40, unitLabel: '40 g' },
  'pão_integral': { kcal: 250, protein: 12, carbs: 48, fat: 4, fiber: 8, portion: 50, unitLabel: '2 fatias' },
  'tapioca': { kcal: 240, protein: 0.5, carbs: 60, fat: 0, fiber: 0.3, portion: 60, unitLabel: '60 g' },
  'banana': { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, portion: 90, unitLabel: '1 un média', tags: ['pre_treino'] },
  'maçã': { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, portion: 130, unitLabel: '1 un média' },
  'frutas_vermelhas': { kcal: 50, protein: 0.8, carbs: 12, fat: 0.4, fiber: 4.2, portion: 140, unitLabel: '140 g', tags: ['baixo_ig'] },
  'azeite_de_oliva': { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, portion: 10, unitLabel: '1 colher de sopa' },
  'castanhas': { kcal: 600, protein: 15, carbs: 20, fat: 50, fiber: 8, portion: 20, unitLabel: '1 punhado' },
  'abacate': { kcal: 96, protein: 1.2, carbs: 6, fat: 8.4, fiber: 6.3, portion: 100, unitLabel: '100 g' },
  'brócolis_cozido': { kcal: 25, protein: 3, carbs: 4.4, fat: 0.5, fiber: 3.4, portion: 100, unitLabel: '100 g' },
  'salada_verde': { kcal: 20, protein: 1, carbs: 3, fat: 0.2, fiber: 2, portion: 100, unitLabel: '1 prato' },
  'cenoura_cozida': { kcal: 35, protein: 0.8, carbs: 8.2, fat: 0.2, fiber: 2.9, portion: 100, unitLabel: '100 g' },
  'iogurte_grego_natural': { kcal: 76, protein: 10, carbs: 3.6, fat: 2.3, portion: 170, unitLabel: '170 g' },
  'iogurte_natural': { kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, portion: 170, unitLabel: '170 g' },
  'bebida_vegetal_de_soja': { kcal: 41, protein: 3.3, carbs: 2.3, fat: 2, fiber: 0.6, portion: 200, unitLabel: '200 ml' }
};

function buildFood(groupKey, subgroupKey, name, index) {
  var preset = MACRO_PRESETS[groupKey] || MACRO_PRESETS.vegetais;
  var normalized = slugify(name);
  var override = FOOD_OVERRIDES[normalized] || {};
  var kcal100 = override.kcal != null ? override.kcal : preset.kcal + ((index % 5) - 2) * 7;
  var protein100 = override.protein != null ? override.protein : Math.max(0, preset.protein + ((index % 4) - 1) * 0.8);
  return {
    id: normalized,
    slug: normalized,
    canonical_name_pt: name,
    display_name_pt: name.replace(/\s+lac$/, '').replace(/\s+carbo$/, '').replace(/\s+fruta$/, ''),
    group_key: groupKey,
    subgroup_key: subgroupKey,
    source: 'KRONIA premium seed; TACO/USDA adaptado',
    source_code: 'kronia_' + normalized,
    brand_name: null,
    default_portion_g: override.portion || preset.portion,
    default_unit: override.unitLabel || ((override.portion || preset.portion) + ' ' + preset.unit),
    kcal_100g: round(kcal100, 1),
    protein_100g: round(protein100, 1),
    carbs_100g: round(override.carbs != null ? override.carbs : Math.max(0, preset.carbs + ((index % 6) - 2) * 1.4), 1),
    fat_100g: round(override.fat != null ? override.fat : Math.max(0, preset.fat + ((index % 5) - 2) * 0.6), 1),
    fiber_100g: round(override.fiber != null ? override.fiber : Math.max(0, preset.fiber + ((index % 4) - 1) * 0.4), 1),
    sugar_100g: groupKey === 'frutas' ? 9 : null,
    sodium_mg_100g: groupKey === 'temperos' ? 260 : 35,
    potassium_mg_100g: groupKey === 'frutas' || groupKey === 'vegetais' ? 220 : null,
    cholesterol_mg_100g: /aves|bovinos|suinos|peixes|ovos|laticinios/.test(subgroupKey) ? 55 : null,
    saturated_fat_100g: groupKey === 'gorduras' ? round((override.fat || preset.fat) * 0.13, 1) : null,
    glycemic_index_hint: groupKey === 'carboidratos' || groupKey === 'frutas' ? (/(tapioca|pão|banana|uva|tâmara)/i.test(name) ? 'moderado_alto' : 'moderado') : 'baixo',
    glycemic_load_hint: groupKey === 'carboidratos' ? 'moderada' : 'baixa',
    score_practicality: override.practicality || (groupKey === 'temperos' ? 5 : 4),
    score_cost: override.cost || (/(salmão|pistache|amêndoas|skyr|camarão)/i.test(name) ? 2 : 4),
    is_common: !/(cavalinha|seitan|trigo sarraceno|kefir|shimeji|shitake)/i.test(name),
    is_recipe_ingredient: true,
    is_active: true,
    tags: (GROUPS[groupKey].defaultTags || []).concat(override.tags || [])
  };
}

function buildCanonicalFoods() {
  var foods = [];
  Object.keys(GROUPS).forEach(function(groupKey) {
    var group = GROUPS[groupKey];
    Object.keys(group.subgroups).forEach(function(subgroupKey) {
      group.subgroups[subgroupKey].forEach(function(name) {
        foods.push(buildFood(groupKey, subgroupKey, name, foods.length));
      });
    });
  });
  return foods;
}

var CANONICAL_FOODS = buildCanonicalFoods();

function portionMacros(food) {
  var grams = Number(food.default_portion_g || 100);
  var ratio = grams / 100;
  return {
    code: food.slug,
    name: food.display_name_pt,
    portionLabel: food.default_unit,
    grams: grams,
    calories: round(food.kcal_100g * ratio),
    protein: round(food.protein_100g * ratio, 1),
    carbs: round(food.carbs_100g * ratio, 1),
    fat: round(food.fat_100g * ratio, 1),
    fiber: round(food.fiber_100g * ratio, 1),
    source: food.source,
    groupKey: food.group_key,
    subgroupKey: food.subgroup_key,
    tags: food.tags || [],
    scorePracticality: food.score_practicality,
    scoreCost: food.score_cost
  };
}

function byGroup(groupKey, predicate) {
  return CANONICAL_FOODS
    .filter(function(food) { return food.group_key === groupKey && (!predicate || predicate(food)); })
    .map(portionMacros);
}

function buildPremiumFoodLibrary() {
  var proteins = byGroup('proteinas');
  var carbs = byGroup('carboidratos');
  var fats = byGroup('gorduras');
  var fruits = byGroup('frutas');
  var veggies = byGroup('vegetais');
  var dairy = byGroup('laticinios');
  return {
    breakfastProteins: byGroup('proteinas', function(food) { return /ovos|laticinios_proteicos|suplementos|proteinas_vegetais/.test(food.subgroup_key); }).concat(dairy),
    fastProteins: byGroup('proteinas', function(food) { return /suplementos|laticinios_proteicos|proteinas_vegetais|ovos/.test(food.subgroup_key); }).concat(dairy),
    mealProteins: proteins.filter(function(food) { return !/suplementos|laticinios/.test(food.subgroupKey); }),
    breakfastCarbs: carbs.filter(function(food) { return /cereais|paes|frutas_energeticas/.test(food.subgroupKey); }).concat(fruits.slice(0, 8)),
    fastCarbs: carbs.filter(function(food) { return /cereais|paes|frutas_energeticas/.test(food.subgroupKey); }).concat(fruits),
    mealCarbs: carbs.filter(function(food) { return /arroz_e_graos|tuberculos|massas|leguminosas/.test(food.subgroupKey); }),
    supportCarbs: fruits.concat(carbs.filter(function(food) { return /frutas_energeticas|cereais/.test(food.subgroupKey); })),
    breakfastFats: fats.filter(function(food) { return /oleaginosas|sementes|pastas|abacate/.test(food.subgroupKey); }),
    fats: fats,
    veggies: veggies
  };
}

function buildRecipeCatalog() {
  var proteins = buildPremiumFoodLibrary().mealProteins.slice(0, 14);
  var carbs = buildPremiumFoodLibrary().mealCarbs.slice(0, 14);
  var veggies = buildPremiumFoodLibrary().veggies.slice(0, 10);
  var breakfasts = buildPremiumFoodLibrary().breakfastProteins.slice(0, 10);
  var breakfastCarbs = buildPremiumFoodLibrary().breakfastCarbs.slice(0, 10);
  var recipes = [];

  proteins.forEach(function(protein, index) {
    var carb = carbs[index % carbs.length];
    var veggie = veggies[index % veggies.length];
    recipes.push({
      slug: 'prato_' + slugify(protein.name) + '_' + slugify(carb.name),
      title_pt: protein.name + ' com ' + carb.name,
      meal_slot: index % 2 ? 'jantar_pos_treino' : 'almoco',
      prep_time_min: 20 + (index % 4) * 5,
      difficulty: index % 3 === 0 ? 'media' : 'facil',
      ingredients: [
        { food_slug: protein.code, grams: protein.grams },
        { food_slug: carb.code, grams: carb.grams },
        { food_slug: veggie.code, grams: veggie.grams }
      ],
      tags_json: ['high_protein', index % 2 ? 'pos_treino' : 'alta_saciedade']
    });
  });

  for (var i = 0; i < 110; i += 1) {
    var p = proteins[i % proteins.length];
    var c = carbs[(i * 3) % carbs.length];
    var v = veggies[(i * 5) % veggies.length];
    var b = breakfasts[i % breakfasts.length];
    var bc = breakfastCarbs[(i * 2) % breakfastCarbs.length];
    var isBreakfast = i % 5 === 0;
    var ingredients = isBreakfast
      ? [{ food_slug: b.code, grams: b.grams }, { food_slug: bc.code, grams: bc.grams }]
      : [{ food_slug: p.code, grams: p.grams }, { food_slug: c.code, grams: c.grams }, { food_slug: v.code, grams: v.grams }];
    recipes.push({
      slug: 'kronia_receita_' + String(i + 1).padStart(3, '0'),
      title_pt: isBreakfast ? (b.name + ' com ' + bc.name) : (p.name + ', ' + c.name + ' e ' + v.name),
      meal_slot: isBreakfast ? 'cafe_da_manha' : (i % 4 === 0 ? 'jantar_pos_treino' : 'almoco'),
      prep_time_min: isBreakfast ? 8 + (i % 4) * 2 : 18 + (i % 5) * 4,
      difficulty: i % 6 === 0 ? 'media' : 'facil',
      ingredients: ingredients,
      tags_json: ['kronia_premium', isBreakfast ? 'cafe_da_manha' : 'refeicao_principal']
    });
  }

  return recipes.slice(0, 128).map(function(recipe) {
    var totals = recipe.ingredients.reduce(function(acc, ingredient) {
      var food = CANONICAL_FOODS.find(function(item) { return item.slug === ingredient.food_slug; });
      if (!food) return acc;
      var ratio = Number(ingredient.grams || 0) / 100;
      acc.kcal += food.kcal_100g * ratio;
      acc.protein += food.protein_100g * ratio;
      acc.carbs += food.carbs_100g * ratio;
      acc.fat += food.fat_100g * ratio;
      acc.fiber += food.fiber_100g * ratio;
      return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    return Object.assign({}, recipe, {
      kcal: round(totals.kcal),
      protein_g: round(totals.protein, 1),
      carbs_g: round(totals.carbs, 1),
      fat_g: round(totals.fat, 1),
      fiber_g: round(totals.fiber, 1),
      score_practicality: recipe.difficulty === 'facil' ? 5 : 4,
      score_cost: 4,
      is_active: true
    });
  });
}

var RECIPE_CATALOG = buildRecipeCatalog();

function buildFoodAliases() {
  return CANONICAL_FOODS.reduce(function(acc, food) {
    var name = food.display_name_pt;
    var base = normalizeText(name);
    var aliases = [name, base, base.replace(/\bcozido\b|\bgrelhado\b|\bassado\b/g, '').trim()];
    aliases.forEach(function(alias) {
      if (!alias) return;
      acc.push({ food_slug: food.slug, alias: alias, normalized_alias: normalizeText(alias), locale: 'pt-BR' });
    });
    return acc;
  }, []);
}

function buildFoodPortions() {
  return CANONICAL_FOODS.reduce(function(acc, food) {
    acc.push({ food_slug: food.slug, label_pt: food.default_unit, grams: food.default_portion_g, household_measure: food.default_unit, sort_order: 1 });
    if (food.group_key === 'gorduras') acc.push({ food_slug: food.slug, label_pt: '1 colher de sopa', grams: 10, household_measure: 'colher de sopa', sort_order: 2 });
    if (food.group_key === 'carboidratos') acc.push({ food_slug: food.slug, label_pt: '1 concha pequena', grams: 80, household_measure: 'concha', sort_order: 2 });
    if (food.group_key === 'frutas') acc.push({ food_slug: food.slug, label_pt: '1 unidade média', grams: 120, household_measure: 'unidade', sort_order: 2 });
    return acc;
  }, []);
}

module.exports = {
  CANONICAL_FOODS: CANONICAL_FOODS,
  RECIPE_CATALOG: RECIPE_CATALOG,
  FOOD_ALIASES: buildFoodAliases(),
  FOOD_PORTIONS: buildFoodPortions(),
  buildPremiumFoodLibrary: buildPremiumFoodLibrary,
  normalizeText: normalizeText,
  round: round
};
