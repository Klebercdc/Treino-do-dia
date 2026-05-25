'use strict';

var semanticValidator = require('./semanticNutritionValidator');
var confidenceScore = require('./nutritionConfidenceScore');
var auditTrail = require('./nutritionAuditTrail');
var enterpriseIntegrator = require('./enterpriseNutritionAIIntegrator');

function applyEnterprisePipeline(plan, profile, options) {
  var settings = options || {};

  var trail = auditTrail.createNutritionAuditTrail();

  auditTrail.addAuditEvent(trail, {
    type: 'ai_active',
    detail: 'Adaptive Enterprise Nutrition AI pipeline iniciado.'
  });

  var validatedPlan = semanticValidator.validatePlanSemantic(
    plan,
    settings.catalog || null
  );

  auditTrail.addAuditEvent(trail, {
    type: 'semantic_repair',
    detail: 'Plano validado semanticamente.'
  });

  var adaptivePlan = enterpriseIntegrator.applyEnterpriseNutritionAI(
    validatedPlan,
    profile || {},
    settings
  );

  auditTrail.addAuditEvent(trail, {
    type: 'adaptive_strategy',
    detail: 'Estratégia adaptativa aplicada.',
    metadata: {
      strategy: adaptivePlan.adaptiveStrategy && adaptivePlan.adaptiveStrategy.strategy
    }
  });

  var confidence = confidenceScore.scorePlanConfidence(adaptivePlan);

  auditTrail.addAuditEvent(trail, {
    type: 'confidence_recalculated',
    detail: 'Confidence score recalculado.',
    metadata: confidence
  });

  adaptivePlan.confidence = confidence;
  adaptivePlan.auditTrail = trail;
  adaptivePlan.auditSummary = auditTrail.summarizeAuditTrail(trail);

  adaptivePlan.productionReady = (
    confidence.level !== 'low' &&
    adaptivePlan.premiumValidation &&
    adaptivePlan.premiumValidation.semanticValidation !== false
  );

  return adaptivePlan;
}

module.exports = {
  applyEnterprisePipeline: applyEnterprisePipeline
};
