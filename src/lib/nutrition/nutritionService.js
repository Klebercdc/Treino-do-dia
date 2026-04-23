'use strict';

var premiumCatalog = require('./premiumCatalog');
var clinical = require('../../core/nutrition/diet_context_clinical');
var strategyEngine = require('../../core/nutrition/diet_strategy_engine');
var renderer = require('../../core/nutrition/diet_prescription_renderer');

module.exports = {
  ACTIVITY_FACTORS: strategyEngine.ACTIVITY_FACTORS,
  FOOD_LIBRARY: renderer.FOOD_LIBRARY,
  CANONICAL_FOODS: premiumCatalog.CANONICAL_FOODS,
  RECIPE_CATALOG: premiumCatalog.RECIPE_CATALOG,

  buildNutritionProfile: strategyEngine.buildNutritionProfile,
  buildUnifiedNutritionContext: strategyEngine.buildUnifiedNutritionContext,

  buildNutritionStrategy: strategyEngine.buildNutritionStrategy,
  calculateNutrition: strategyEngine.calculateNutrition,

  buildNutritionPrescription: renderer.buildNutritionPrescription,
  generateNutritionPlan: renderer.generateNutritionPlan,

  resolveDietMode: clinical.resolveDietMode,
  applyClinicalRules: clinical.applyClinicalRules,
  applyMedicalAdjustments: clinical.applyMedicalAdjustments,
  buildLabContext: clinical.buildLabContext,

  round: clinical.round
};
