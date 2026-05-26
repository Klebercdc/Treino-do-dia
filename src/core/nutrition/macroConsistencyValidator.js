'use strict';

function calculateCaloriesFromMacros(item) {
  var p = Number(item.proteinas || 0);
  var c = Number(item.carboidratos || 0);
  var g = Number(item.gorduras || 0);
  return (p * 4) + (c * 4) + (g * 9);
}

function validateMacroConsistency(item) {
  if (!item) return item;
  var calculated = calculateCaloriesFromMacros(item);
  var current = Number(item.calorias || 0);
  var delta = Math.abs(calculated - current);

  if (delta > 25) {
    item.semanticWarning = 'macro_calorie_mismatch';
    item.calorias = Math.round(calculated);
    item.autoCorrected = true;
  }

  return item;
}

module.exports = {
  calculateCaloriesFromMacros: calculateCaloriesFromMacros,
  validateMacroConsistency: validateMacroConsistency
};
