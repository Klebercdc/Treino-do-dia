'use strict';

// KRONIA Active State Manager (DIET_ACTIVE_STATE)
// Tracks the current "live" diet as displayed on screen.
// Every user edit passes through here so print always reflects the active state.
//
// Supported operations:
//   - swapFood(mealOrdem, blockName, newFoodCode)
//   - removeBlock(mealOrdem, blockName)
//   - adjustPortion(mealOrdem, blockName, newGrams)
//   - resetMeal(mealOrdem)
//   - getActiveState()
//   - renderForPrint()

var subEngine  = require('./substitutionEngine');
var rebalance  = require('./rebalanceEngine');

var round = function(v, d) {
  var f = Math.pow(10, typeof d === 'number' ? d : 1);
  return Math.round(Number(v || 0) * f) / f;
};

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function findMeal(state, ordem) {
  return (state.refeicoes || []).find(function(m) { return m.ordem === ordem; }) || null;
}

/**
 * Creates a new active state from a freshly generated plan.
 *
 * @param {object} plan - output from kronaEngine.generatePlan
 * @param {object} profile - user profile used to generate the plan
 * @returns {object} DIET_ACTIVE_STATE
 */
function initActiveState(plan, profile) {
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    profile: cloneDeep(profile),
    prescription: cloneDeep(plan.prescription),
    refeicoes: cloneDeep(plan.refeicoes),
    resumo_diario: cloneDeep(plan.resumo_diario),
    history: [],          // audit trail of all mutations
    is_modified: false
  };
}

/**
 * Swaps a food in a block. Rebalances the meal after the swap.
 *
 * @param {object} state - DIET_ACTIVE_STATE (mutated in place via clone)
 * @param {number} mealOrdem - meal.ordem (1-based)
 * @param {string} blockName - e.g. 'proteina', 'carbo', 'gordura'
 * @param {string} newFoodCode - food code from kronaFoodDatabase
 * @returns {{ state, message, warnings }}
 */
function swapFood(state, mealOrdem, blockName, newFoodCode) {
  var next = cloneDeep(state);
  var meal = findMeal(next, mealOrdem);
  if (!meal) return { state: state, message: null, warnings: ['Refeição não encontrada: ' + mealOrdem] };

  var block = meal.blocos && meal.blocos[blockName];
  if (!block) return { state: state, message: null, warnings: ['Bloco não encontrado: ' + blockName] };

  var prevCode = block.food_code;
  var updatedBlock;
  try {
    updatedBlock = subEngine.applySubstitution(block, newFoodCode, next.profile);
  } catch (e) {
    return { state: state, message: null, warnings: [e.message] };
  }

  meal.blocos[blockName] = updatedBlock;

  var rebalanced = rebalance.rebalanceMeal(meal);
  var mealIndex = next.refeicoes.findIndex(function(m) { return m.ordem === mealOrdem; });
  next.refeicoes[mealIndex] = rebalanced;

  next = rebalance.recalcPlanTotals(next);
  next.is_modified = true;
  next.history.push({
    ts: new Date().toISOString(),
    op: 'swap_food',
    meal: mealOrdem,
    block: blockName,
    from: prevCode,
    to: newFoodCode
  });

  var message = 'Quantidade ajustada automaticamente para manter suas metas nutricionais.';
  if (!rebalance.mealWithinTolerance(next.refeicoes[mealIndex])) {
    message = 'Refeição recalculada com base na sua escolha. Pequeno desvio nas metas.';
  }

  return { state: next, message: message, warnings: [] };
}

/**
 * Removes a block from a meal and rebalances.
 *
 * @param {object} state - DIET_ACTIVE_STATE
 * @param {number} mealOrdem
 * @param {string} blockName
 * @returns {{ state, message, warnings }}
 */
function removeBlock(state, mealOrdem, blockName) {
  var PROTECTED = ['proteina'];   // Cannot remove protein block
  if (PROTECTED.indexOf(blockName) !== -1) {
    return { state: state, message: null, warnings: ['O bloco de proteína não pode ser removido.'] };
  }

  var next = cloneDeep(state);
  var meal = findMeal(next, mealOrdem);
  if (!meal) return { state: state, message: null, warnings: ['Refeição não encontrada: ' + mealOrdem] };
  if (!meal.blocos || !meal.blocos[blockName]) {
    return { state: state, message: null, warnings: ['Bloco não encontrado: ' + blockName] };
  }

  var removedCode = meal.blocos[blockName].food_code;
  delete meal.blocos[blockName];

  var rebalanced = rebalance.rebalanceMeal(meal);
  var mealIndex = next.refeicoes.findIndex(function(m) { return m.ordem === mealOrdem; });
  next.refeicoes[mealIndex] = rebalanced;

  next = rebalance.recalcPlanTotals(next);
  next.is_modified = true;
  next.history.push({
    ts: new Date().toISOString(),
    op: 'remove_block',
    meal: mealOrdem,
    block: blockName,
    removed: removedCode
  });

  return {
    state: next,
    message: 'Refeição recalculada com base na sua escolha.',
    warnings: []
  };
}

/**
 * Manually adjusts the grams of a block item.
 *
 * @param {object} state - DIET_ACTIVE_STATE
 * @param {number} mealOrdem
 * @param {string} blockName
 * @param {number} newGrams
 * @returns {{ state, message, warnings }}
 */
function adjustPortion(state, mealOrdem, blockName, newGrams) {
  var grams = Math.min(500, Math.max(10, Number(newGrams) || 100));
  var next = cloneDeep(state);
  var meal = findMeal(next, mealOrdem);
  if (!meal) return { state: state, message: null, warnings: ['Refeição não encontrada: ' + mealOrdem] };

  var block = meal.blocos && meal.blocos[blockName];
  if (!block) return { state: state, message: null, warnings: ['Bloco não encontrado: ' + blockName] };

  var db = require('../../lib/nutrition/kronaFoodDatabase');
  var food = db.getFoodByCode(block.food_code);
  if (!food) return { state: state, message: null, warnings: ['Alimento não encontrado: ' + block.food_code] };

  var ratio = grams / 100;
  meal.blocos[blockName] = Object.assign({}, block, {
    gramas: grams,
    porcao: grams + ' g',
    nutrição: {
      calorias:      round(food.kcal_por_100g * ratio, 0),
      proteinas:     round(food.proteina_por_100g * ratio, 1),
      carboidratos:  round(food.carbo_por_100g * ratio, 1),
      gorduras:      round(food.gordura_por_100g * ratio, 1),
      fibras:        round(food.fibra_por_100g * ratio, 1)
    }
  });

  var rebalanced = rebalance.rebalanceMeal(meal);
  var mealIndex = next.refeicoes.findIndex(function(m) { return m.ordem === mealOrdem; });
  next.refeicoes[mealIndex] = rebalanced;

  next = rebalance.recalcPlanTotals(next);
  next.is_modified = true;
  next.history.push({
    ts: new Date().toISOString(),
    op: 'adjust_portion',
    meal: mealOrdem,
    block: blockName,
    new_grams: grams
  });

  return {
    state: next,
    message: 'Porção ajustada. Refeição recalculada.',
    warnings: []
  };
}

/**
 * Formats the active state as a clean, printable prescription object.
 * This is what gets sent to the print/PDF renderer.
 */
function renderForPrint(state) {
  var profile = state.profile || {};
  var prescription = state.prescription || {};
  var daily = state.resumo_diario || {};

  var refeicoes = (state.refeicoes || []).map(function(meal) {
    var itens = Object.keys(meal.blocos || {}).map(function(blockName) {
      var block = meal.blocos[blockName];
      return {
        bloco: blockName,
        alimento: block.nome,
        porcao: block.porcao,
        calorias: (block.nutrição && block.nutrição.calorias) || 0,
        proteinas: (block.nutrição && block.nutrição.proteinas) || 0,
        carboidratos: (block.nutrição && block.nutrição.carboidratos) || 0,
        gorduras: (block.nutrição && block.nutrição.gorduras) || 0
      };
    });

    return {
      nome: meal.nome,
      horario: meal.horario,
      itens: itens,
      subtotal: meal.subtotal
    };
  });

  return {
    titulo: 'PRESCRIÇÃO NUTRICIONAL – KRONIA',
    gerado_em: new Date().toISOString(),
    paciente: {
      objetivo: profile.objetivo,
      peso: profile.peso,
      altura: profile.altura,
      idade: profile.idade,
      sexo: profile.sexo
    },
    resumo_diario: {
      calorias:     daily.calorias,
      proteinas:    daily.proteinas,
      carboidratos: daily.carboidratos,
      gorduras:     daily.gorduras,
      fibras:       daily.fibras
    },
    metas: prescription.metas || null,
    plano_alimentar: refeicoes,
    orientacoes: prescription.orientacoes || [],
    sequencia_consumo: prescription.sequencia_consumo || [],
    observacoes: prescription.observacoes || [],
    aviso_clinico: 'Plano esportivo educacional. Não substitui conduta clínica ou nutricional individualizada.'
  };
}

module.exports = {
  initActiveState: initActiveState,
  swapFood: swapFood,
  removeBlock: removeBlock,
  adjustPortion: adjustPortion,
  renderForPrint: renderForPrint
};
