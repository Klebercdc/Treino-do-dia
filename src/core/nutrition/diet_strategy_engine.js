'use strict';

var nutritionService = require('../../lib/nutrition/nutritionService');

/**
 * Computes calorie target, macros and training/clinical adjustments
 * from a normalized nutrition profile (output of buildNutritionProfile).
 *
 * Returns the strategy object expected by diet_prescription_renderer.
 */
function buildStrategy(profile) {
  return nutritionService.buildNutritionStrategy(profile);
}

/**
 * Builds a normalized nutrition profile from raw input, then computes strategy.
 * Convenience entry-point that covers the full context → strategy pipeline.
 */
function buildStrategyFromInput(profileInput) {
  return nutritionService.calculateNutrition(profileInput);
}

module.exports = {
  buildStrategy: buildStrategy,
  buildStrategyFromInput: buildStrategyFromInput,
};
