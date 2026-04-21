'use strict';

var nutritionService = require('../../lib/nutrition/nutritionService');

/**
 * Renders the final diet prescription (meals, substitutions, clinical notes,
 * strategic observations) from a computed nutrition strategy.
 *
 * Accepts the strategy object produced by diet_strategy_engine.buildStrategy.
 */
function renderPrescription(strategy) {
  return nutritionService.buildNutritionPrescription(strategy);
}

/**
 * Full pipeline shortcut: raw profile input → strategy → prescription.
 * Equivalent to nutritionService.generateNutritionPlan but routed through
 * the explicit architecture boundary.
 */
function generatePlan(profileInput) {
  return nutritionService.generateNutritionPlan(profileInput);
}

module.exports = {
  renderPrescription: renderPrescription,
  generatePlan: generatePlan,
};
