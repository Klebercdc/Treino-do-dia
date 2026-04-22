'use strict';

// KRONIA Rebalance Engine
// Triggered after any food swap, removal or block change.
// Compares meal actual macros vs targets and compensates within tolerances.
//
// TOLERANCES (from spec):
//   protein: ±5 g
//   carbs:   ±10 g
//   fat:     ±5 g
//   kcal:    ±80 kcal

var TOLERANCES = {
  protein: 5,
  carbs:   10,
  fat:     5,
  kcal:    80
};

var round = function(v, d) {
  var f = Math.pow(10, typeof d === 'number' ? d : 1);
  return Math.round(Number(v || 0) * f) / f;
};

function sumBlocks(blocks) {
  return Object.values(blocks).reduce(function(acc, block) {
    acc.calorias     += Number((block.nutrição && block.nutrição.calorias)     || 0);
    acc.proteinas    += Number((block.nutrição && block.nutrição.proteinas)    || 0);
    acc.carboidratos += Number((block.nutrição && block.nutrição.carboidratos) || 0);
    acc.gorduras     += Number((block.nutrição && block.nutrição.gorduras)     || 0);
    acc.fibras       += Number((block.nutrição && block.nutrição.fibras)       || 0);
    return acc;
  }, { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0, fibras: 0 });
}

function calcGaps(subtotal, meta) {
  return {
    protein: round(meta.proteinas - subtotal.proteinas, 1),
    carbs:   round(meta.carboidratos - subtotal.carboidratos, 1),
    fat:     round(meta.gorduras - subtotal.gorduras, 1),
    kcal:    round(meta.calorias - subtotal.calorias, 0)
  };
}

function isWithinTolerance(gaps) {
  return (
    Math.abs(gaps.protein) <= TOLERANCES.protein &&
    Math.abs(gaps.carbs)   <= TOLERANCES.carbs   &&
    Math.abs(gaps.fat)     <= TOLERANCES.fat      &&
    Math.abs(gaps.kcal)    <= TOLERANCES.kcal
  );
}

// Scale a single block's food portion to close a macro gap.
// Returns updated block or null if no adjustment possible.
function scaleBlock(block, macroKey, currentValue, targetValue) {
  if (!currentValue || currentValue <= 0) return null;
  var factor = targetValue / currentValue;
  // Clamp scale factor between 0.5x and 2x to avoid unrealistic portions
  factor = Math.min(2.0, Math.max(0.5, factor));
  var newGrams = round(block.gramas * factor, 0);
  newGrams = Math.min(500, Math.max(20, newGrams));

  var ratio = newGrams / 100;
  var db = require('../../lib/nutrition/kronaFoodDatabase');
  var food = db.getFoodByCode(block.food_code);
  if (!food) return null;

  return Object.assign({}, block, {
    gramas: newGrams,
    porcao: newGrams + ' g',
    nutrição: {
      calorias:      round(food.kcal_por_100g * ratio, 0),
      proteinas:     round(food.proteina_por_100g * ratio, 1),
      carboidratos:  round(food.carbo_por_100g * ratio, 1),
      gorduras:      round(food.gordura_por_100g * ratio, 1),
      fibras:        round(food.fibra_por_100g * ratio, 1)
    }
  });
}

// Pick the best block to adjust for a given macro gap.
// Avoids adjusting salada/vegetal blocks (low impact, structural role).
function pickAdjustableBlock(blocks, macroField, preferPositive) {
  var STRUCTURAL = ['salada', 'vegetal'];
  var best = null;
  var bestValue = -1;

  Object.keys(blocks).forEach(function(blockName) {
    if (STRUCTURAL.indexOf(blockName) !== -1) return;
    var block = blocks[blockName];
    var val = Number((block.nutrição && block.nutrição[macroField]) || 0);
    if (preferPositive && val > bestValue) {
      bestValue = val;
      best = blockName;
    } else if (!preferPositive && val > bestValue) {
      bestValue = val;
      best = blockName;
    }
  });
  return best;
}

/**
 * Rebalances a single meal's blocks to meet its macro targets.
 *
 * @param {object} meal - meal object with { meta, blocos, subtotal }
 * @returns {object} updated meal with recalculated subtotal
 */
function rebalanceMeal(meal) {
  var blocks = Object.assign({}, meal.blocos);
  var meta = meal.meta;
  var metaNormed = {
    calorias:     Number(meta.calorias     || 0),
    proteinas:    Number(meta.proteinas    || 0),
    carboidratos: Number(meta.carboidratos || 0),
    gorduras:     Number(meta.gorduras     || 0)
  };

  var adjustments = [];

  for (var pass = 0; pass < 3; pass += 1) {
    var subtotal = sumBlocks(blocks);
    var gaps = calcGaps(subtotal, metaNormed);
    if (isWithinTolerance(gaps)) break;

    // Adjust protein gap
    if (Math.abs(gaps.protein) > TOLERANCES.protein) {
      var proteinBlock = pickAdjustableBlock(blocks, 'proteinas', true);
      if (proteinBlock) {
        var pb = blocks[proteinBlock];
        var currentProtein = Number((pb.nutrição && pb.nutrição.proteinas) || 0);
        var targetProtein = currentProtein + gaps.protein;
        if (targetProtein > 0) {
          var scaledPb = scaleBlock(pb, 'protein', currentProtein, targetProtein);
          if (scaledPb) {
            blocks[proteinBlock] = scaledPb;
            adjustments.push({ bloco: proteinBlock, motivo: 'proteina_gap', gap: gaps.protein });
          }
        }
      }
    }

    // Adjust carbs gap
    var subtotal2 = sumBlocks(blocks);
    var gaps2 = calcGaps(subtotal2, metaNormed);
    if (Math.abs(gaps2.carbs) > TOLERANCES.carbs) {
      var carbBlock = pickAdjustableBlock(blocks, 'carboidratos', true);
      if (carbBlock) {
        var cb = blocks[carbBlock];
        var currentCarbs = Number((cb.nutrição && cb.nutrição.carboidratos) || 0);
        var targetCarbs = currentCarbs + gaps2.carbs;
        if (targetCarbs > 0) {
          var scaledCb = scaleBlock(cb, 'carbs', currentCarbs, targetCarbs);
          if (scaledCb) {
            blocks[carbBlock] = scaledCb;
            adjustments.push({ bloco: carbBlock, motivo: 'carbo_gap', gap: gaps2.carbs });
          }
        }
      }
    }

    // Adjust fat gap
    var subtotal3 = sumBlocks(blocks);
    var gaps3 = calcGaps(subtotal3, metaNormed);
    if (Math.abs(gaps3.fat) > TOLERANCES.fat) {
      var fatBlock = pickAdjustableBlock(blocks, 'gorduras', true);
      if (fatBlock) {
        var fb = blocks[fatBlock];
        var currentFat = Number((fb.nutrição && fb.nutrição.gorduras) || 0);
        var targetFat = currentFat + gaps3.fat;
        if (targetFat > 0) {
          var scaledFb = scaleBlock(fb, 'fat', currentFat, targetFat);
          if (scaledFb) {
            blocks[fatBlock] = scaledFb;
            adjustments.push({ bloco: fatBlock, motivo: 'gordura_gap', gap: gaps3.fat });
          }
        }
      }
    }
  }

  var finalSubtotal = sumBlocks(blocks);
  return Object.assign({}, meal, {
    blocos: blocks,
    subtotal: {
      calorias:     round(finalSubtotal.calorias, 0),
      proteinas:    round(finalSubtotal.proteinas, 1),
      carboidratos: round(finalSubtotal.carboidratos, 1),
      gorduras:     round(finalSubtotal.gorduras, 1),
      fibras:       round(finalSubtotal.fibras, 1)
    },
    rebalance_log: adjustments
  });
}

/**
 * Recalculates the full plan's daily totals from all meals.
 *
 * @param {object} plan - active diet state
 * @returns {object} updated plan with fresh resumo_diario
 */
function recalcPlanTotals(plan) {
  var meals = (plan.refeicoes || []).map(function(meal) {
    var sub = sumBlocks(meal.blocos || {});
    return Object.assign({}, meal, {
      subtotal: {
        calorias:     round(sub.calorias, 0),
        proteinas:    round(sub.proteinas, 1),
        carboidratos: round(sub.carboidratos, 1),
        gorduras:     round(sub.gorduras, 1),
        fibras:       round(sub.fibras, 1)
      }
    });
  });

  var daily = meals.reduce(function(acc, meal) {
    acc.calorias     += Number(meal.subtotal.calorias     || 0);
    acc.proteinas    += Number(meal.subtotal.proteinas    || 0);
    acc.carboidratos += Number(meal.subtotal.carboidratos || 0);
    acc.gorduras     += Number(meal.subtotal.gorduras     || 0);
    acc.fibras       += Number(meal.subtotal.fibras       || 0);
    return acc;
  }, { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0, fibras: 0 });

  return Object.assign({}, plan, {
    refeicoes: meals,
    resumo_diario: {
      calorias:     round(daily.calorias, 0),
      proteinas:    round(daily.proteinas, 1),
      carboidratos: round(daily.carboidratos, 1),
      gorduras:     round(daily.gorduras, 1),
      fibras:       round(daily.fibras, 1)
    }
  });
}

/**
 * Checks whether a meal's subtotal is within tolerance of its meta.
 */
function mealWithinTolerance(meal) {
  var sub = sumBlocks(meal.blocos || {});
  var gaps = calcGaps(sub, {
    calorias:     Number(meal.meta.calorias     || 0),
    proteinas:    Number(meal.meta.proteinas    || 0),
    carboidratos: Number(meal.meta.carboidratos || 0),
    gorduras:     Number(meal.meta.gorduras     || 0)
  });
  return isWithinTolerance(gaps);
}

module.exports = {
  rebalanceMeal: rebalanceMeal,
  recalcPlanTotals: recalcPlanTotals,
  mealWithinTolerance: mealWithinTolerance,
  sumBlocks: sumBlocks,
  TOLERANCES: TOLERANCES
};
