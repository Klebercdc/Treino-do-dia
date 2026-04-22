'use strict';

// DIET_TEMPLATE and BLOCK_STRUCTURE builder for the KRONIA diet engine.
// Each meal is decomposed into blocks (protein, carbo, leguminosa, vegetal,
// salad, fat). Every block tracks its current item and nutritional target.

var db = require('../../lib/nutrition/kronaFoodDatabase');

var round = function(v, d) {
  var f = Math.pow(10, typeof d === 'number' ? d : 1);
  return Math.round(Number(v || 0) * f) / f;
};

// Which food codes to default to for each block in each meal type.
// These are starting selections before profile/preference filtering.
var MEAL_BLOCK_DEFAULTS = {
  cafe_da_manha: {
    proteina:   { code: 'ovo_inteiro',    equivalencia: 'proteina_cafe' },
    carbo:      { code: 'aveia',          equivalencia: 'carbo_cafe' },
    gordura:    { code: 'pasta_amendoim', equivalencia: 'gordura_cafe' },
    fruta:      { code: 'frutas_vermelhas', equivalencia: 'fruta_neutra' }
  },
  lanche_manha: {
    proteina:   { code: 'iogurte_grego', equivalencia: 'proteina_cafe' },
    fruta:      { code: 'maca',          equivalencia: 'fruta_neutra' }
  },
  almoco: {
    proteina:   { code: 'frango_grelhado', equivalencia: 'proteina_magra' },
    carbo:      { code: 'arroz_integral',  equivalencia: 'carbo_almoco' },
    leguminosa: { code: 'feijao_cozido',   equivalencia: 'leguminosa' },
    vegetal:    { code: 'legumes_cozidos', equivalencia: 'vegetal_legume' },
    salada:     { code: 'salada_verde',    equivalencia: 'vegetal_folha' },
    gordura:    { code: 'azeite_oliva',    equivalencia: 'gordura_boa' }
  },
  lanche_pre_treino: {
    proteina:   { code: 'whey_protein',   equivalencia: 'proteina_suplemento' },
    carbo:      { code: 'banana',         equivalencia: 'fruta_energetica' }
  },
  lanche_tarde: {
    proteina:   { code: 'cottage',        equivalencia: 'proteina_cafe' },
    fruta:      { code: 'maca',           equivalencia: 'fruta_neutra' }
  },
  jantar: {
    proteina:   { code: 'tilapia_grelhada', equivalencia: 'proteina_magra' },
    carbo:      { code: 'batata_doce',      equivalencia: 'carbo_almoco' },
    vegetal:    { code: 'brocolis',         equivalencia: 'vegetal_crucifero' },
    salada:     { code: 'salada_verde',     equivalencia: 'vegetal_folha' },
    gordura:    { code: 'azeite_oliva',     equivalencia: 'gordura_boa' }
  },
  jantar_pos_treino: {
    proteina:   { code: 'frango_grelhado', equivalencia: 'proteina_magra' },
    carbo:      { code: 'arroz_integral',  equivalencia: 'carbo_almoco' },
    vegetal:    { code: 'brocolis',        equivalencia: 'vegetal_crucifero' },
    salada:     { code: 'salada_verde',    equivalencia: 'vegetal_folha' }
  },
  ceia: {
    proteina:   { code: 'iogurte_grego', equivalencia: 'proteina_cafe' },
    gordura:    { code: 'chia',          equivalencia: 'gordura_cafe' }
  }
};

// How much of each meal's macro target is allocated to each block (fractions).
var BLOCK_MACRO_SHARES = {
  cafe_da_manha: {
    proteina: { protein: 0.60, carbs: 0.05, fat: 0.15 },
    carbo:    { protein: 0.15, carbs: 0.60, fat: 0.10 },
    gordura:  { protein: 0.10, carbs: 0.05, fat: 0.60 },
    fruta:    { protein: 0.05, carbs: 0.20, fat: 0.05 }
  },
  lanche_manha: {
    proteina: { protein: 0.70, carbs: 0.20, fat: 0.30 },
    fruta:    { protein: 0.10, carbs: 0.65, fat: 0.05 }
  },
  almoco: {
    proteina:   { protein: 0.70, carbs: 0.00, fat: 0.05 },
    carbo:      { protein: 0.05, carbs: 0.55, fat: 0.05 },
    leguminosa: { protein: 0.10, carbs: 0.20, fat: 0.05 },
    vegetal:    { protein: 0.05, carbs: 0.10, fat: 0.05 },
    salada:     { protein: 0.02, carbs: 0.05, fat: 0.03 },
    gordura:    { protein: 0.00, carbs: 0.00, fat: 0.72 }
  },
  lanche_pre_treino: {
    proteina: { protein: 0.70, carbs: 0.10, fat: 0.10 },
    carbo:    { protein: 0.05, carbs: 0.80, fat: 0.05 }
  },
  lanche_tarde: {
    proteina: { protein: 0.70, carbs: 0.20, fat: 0.30 },
    fruta:    { protein: 0.05, carbs: 0.65, fat: 0.05 }
  },
  jantar: {
    proteina: { protein: 0.72, carbs: 0.00, fat: 0.05 },
    carbo:    { protein: 0.05, carbs: 0.70, fat: 0.05 },
    vegetal:  { protein: 0.08, carbs: 0.12, fat: 0.05 },
    salada:   { protein: 0.03, carbs: 0.05, fat: 0.03 },
    gordura:  { protein: 0.00, carbs: 0.00, fat: 0.72 }
  },
  jantar_pos_treino: {
    proteina: { protein: 0.75, carbs: 0.00, fat: 0.10 },
    carbo:    { protein: 0.05, carbs: 0.75, fat: 0.05 },
    vegetal:  { protein: 0.08, carbs: 0.12, fat: 0.05 },
    salada:   { protein: 0.03, carbs: 0.05, fat: 0.03 }
  },
  ceia: {
    proteina: { protein: 0.75, carbs: 0.20, fat: 0.30 },
    gordura:  { protein: 0.05, carbs: 0.05, fat: 0.60 }
  }
};

function calcFoodGrams(food, targetMacro, macroKey) {
  // macroKey: 'protein', 'carbs', 'fat'
  var foodMacroFieldMap = { protein: 'proteina_por_100g', carbs: 'carbo_por_100g', fat: 'gordura_por_100g' };
  var macroField = foodMacroFieldMap[macroKey];
  var macroPerGram = food[macroField] / 100;
  if (!macroPerGram || macroPerGram <= 0) {
    return food.medida_caseira_g || 100;
  }
  var grams = targetMacro / macroPerGram;
  // Constrain to reasonable serving: 20g – 500g
  return Math.min(500, Math.max(20, round(grams, 0)));
}

function calcItemNutrition(food, grams) {
  var ratio = grams / 100;
  return {
    calorias:      round(food.kcal_por_100g * ratio, 0),
    proteinas:     round(food.proteina_por_100g * ratio, 1),
    carboidratos:  round(food.carbo_por_100g * ratio, 1),
    gorduras:      round(food.gordura_por_100g * ratio, 1),
    fibras:        round(food.fibra_por_100g * ratio, 1)
  };
}

function buildBlock(blockName, foodDefault, mealMacroTarget, blockShares) {
  var food = db.getFoodByCode(foodDefault.code);
  if (!food) food = db.getFoodsByEquivalenceGroup(foodDefault.equivalencia)[0];
  if (!food) return null;

  var shares = blockShares[blockName] || { protein: 0, carbs: 0, fat: 0 };

  // Determine which macro drives the portion size.
  // Protein blocks: driven by protein target.
  // Carb blocks: driven by carb target.
  // Fat blocks: driven by fat target.
  var driverMacro, driverTarget;
  if (blockName === 'proteina') {
    driverMacro = 'protein';
    driverTarget = mealMacroTarget.protein * shares.protein;
  } else if (blockName === 'carbo' || blockName === 'fruta' || blockName === 'leguminosa') {
    driverMacro = 'carbs';
    driverTarget = mealMacroTarget.carbs * shares.carbs;
  } else if (blockName === 'gordura') {
    driverMacro = 'fat';
    driverTarget = mealMacroTarget.fat * shares.fat;
  } else {
    // vegetal / salada: use carbs as proxy for portion
    driverMacro = 'carbs';
    driverTarget = Math.max(3, mealMacroTarget.carbs * (shares.carbs || 0.05));
  }

  var grams = calcFoodGrams(food, driverTarget, driverMacro);
  var nutrition = calcItemNutrition(food, grams);

  return {
    bloco: blockName,
    food_code: food.code,
    nome: food.nome,
    categoria: food.categoria,
    subcategoria: food.subcategoria,
    grupo_equivalencia: food.grupo_equivalencia,
    gramas: grams,
    porcao: grams + ' g',
    nutrição: nutrition,
    alvo_nutricional: {
      protein: round(mealMacroTarget.protein * shares.protein, 1),
      carbs:   round(mealMacroTarget.carbs * shares.carbs, 1),
      fat:     round(mealMacroTarget.fat * shares.fat, 1)
    }
  };
}

function buildMealBlocks(mealTipo, mealMacroTarget) {
  var defaults = MEAL_BLOCK_DEFAULTS[mealTipo] || MEAL_BLOCK_DEFAULTS['jantar'];
  var shares   = BLOCK_MACRO_SHARES[mealTipo]  || BLOCK_MACRO_SHARES['jantar'];

  var blocks = {};
  Object.keys(defaults).forEach(function(blockName) {
    var block = buildBlock(blockName, defaults[blockName], mealMacroTarget, shares);
    if (block) blocks[blockName] = block;
  });
  return blocks;
}

function sumBlocks(blocks) {
  return Object.values(blocks).reduce(function(acc, block) {
    acc.calorias     += Number(block.nutrição.calorias || 0);
    acc.proteinas    += Number(block.nutrição.proteinas || 0);
    acc.carboidratos += Number(block.nutrição.carboidratos || 0);
    acc.gorduras     += Number(block.nutrição.gorduras || 0);
    acc.fibras       += Number(block.nutrição.fibras || 0);
    return acc;
  }, { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0, fibras: 0 });
}

function buildMeal(template, mealMacroTarget) {
  var blocks = buildMealBlocks(template.tipo, mealMacroTarget);
  var subtotal = sumBlocks(blocks);

  return {
    ordem:   template.ordem,
    tipo:    template.tipo,
    nome:    template.nome,
    horario: template.horario,
    meta: {
      calorias:     round(mealMacroTarget.calories || 0, 0),
      proteinas:    round(mealMacroTarget.protein, 1),
      carboidratos: round(mealMacroTarget.carbs, 1),
      gorduras:     round(mealMacroTarget.fat, 1)
    },
    blocos: blocks,
    subtotal: {
      calorias:     round(subtotal.calorias, 0),
      proteinas:    round(subtotal.proteinas, 1),
      carboidratos: round(subtotal.carboidratos, 1),
      gorduras:     round(subtotal.gorduras, 1),
      fibras:       round(subtotal.fibras, 1)
    }
  };
}

module.exports = {
  buildMeal: buildMeal,
  buildMealBlocks: buildMealBlocks,
  sumBlocks: sumBlocks,
  calcItemNutrition: calcItemNutrition,
  calcFoodGrams: calcFoodGrams,
  MEAL_BLOCK_DEFAULTS: MEAL_BLOCK_DEFAULTS
};
