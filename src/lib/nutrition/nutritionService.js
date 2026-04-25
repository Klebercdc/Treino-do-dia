'use strict';

var premiumCatalog = require('./premiumCatalog');
var tacoService = require('./tacoService');
var foodSearchService = require('./foodSearchService');
var clinical = require('../../core/nutrition/diet_context_clinical');
var strategyEngine = require('../../core/nutrition/diet_strategy_engine');
var renderer = require('../../core/nutrition/diet_prescription_renderer');

module.exports = {
  ACTIVITY_FACTORS: strategyEngine.ACTIVITY_FACTORS,
  FOOD_LIBRARY: renderer.FOOD_LIBRARY,
  CANONICAL_FOODS: premiumCatalog.CANONICAL_FOODS,
  RECIPE_CATALOG: premiumCatalog.RECIPE_CATALOG,
  DIET_TEMPLATES: renderer.DIET_TEMPLATES,
  TACO_DATABASE: tacoService.TACO_DATABASE,

  buildNutritionProfile: strategyEngine.buildNutritionProfile,
  buildUnifiedNutritionContext: strategyEngine.buildUnifiedNutritionContext,

  buildNutritionStrategy: strategyEngine.buildNutritionStrategy,
  calculateNutrition: strategyEngine.calculateNutrition,

  buildNutritionPrescription: renderer.buildNutritionPrescription,
  generateNutritionPlan: renderer.generateNutritionPlan,
  selectDietTemplate: renderer.selectDietTemplate,
  generateDietFromTemplate: renderer.generateDietFromTemplate,
  substituteFood: renderer.substituteFood,
  rebalanceDiet: renderer.rebalanceDiet,
  normalizeDietItem: renderer.normalizeDietItem,

  normalizeText: tacoService.normalizeText,
  getAllTacoFoods: tacoService.getAllTacoFoods,
  getTacoFoodById: tacoService.getTacoFoodById,
  getTacoFoodByCode: tacoService.getTacoFoodByCode,
  searchTacoFoods: tacoService.searchTacoFoods,
  getTacoFoodsByCategory: tacoService.getTacoFoodsByCategory,
  mapTacoFoodToKroniaMacros: tacoService.mapTacoFoodToKroniaMacros,
  estimateNutritionFromTaco: tacoService.estimateNutritionFromTaco,
  findBestTacoMatch: tacoService.findBestTacoMatch,
  findNutritionFood: foodSearchService.findNutritionFood,
  searchNutritionFoods: foodSearchService.searchNutritionFoods,

  resolveDietMode: clinical.resolveDietMode,
  applyClinicalRules: clinical.applyClinicalRules,
  applyMedicalAdjustments: clinical.applyMedicalAdjustments,
  buildLabContext: clinical.buildLabContext,

  round: clinical.round
};
