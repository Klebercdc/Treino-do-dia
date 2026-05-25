'use strict';

var VALID_EVENT_TYPES = [
  'ai_active',
  'fallback_used',
  'food_selected',
  'alias_resolved',
  'food_renamed',
  'food_remapped',
  'semantic_repair',
  'rebalance',
  'clinical_validation',
  'pdf_generated',
  'warning',
  'adaptive_strategy',
  'behavior_detected',
  'meal_simplified',
  'food_rejected',
  'food_preferred',
  'diversity_adjustment',
  'adherence_adjustment',
  'recommendation_generated',
  'confidence_recalculated'
];

function createNutritionAuditTrail() {
  return {
    events: [],
    generatedAt: new Date().toISOString(),
    enterpriseAI: true
  };
}

function addAuditEvent(trail, eventData) {
  if (!trail || !Array.isArray(trail.events)) return trail;

  var type = eventData && eventData.type ? String(eventData.type) : 'warning';
  var detail = eventData && eventData.detail ? String(eventData.detail) : '';
  var foodCode = eventData && eventData.foodCode ? String(eventData.foodCode) : null;

  if (VALID_EVENT_TYPES.indexOf(type) === -1) {
    type = 'warning';
    detail = '[tipo desconhecido] ' + detail;
  }

  var event = {
    type: type,
    detail: detail,
    timestamp: new Date().toISOString(),
    metadata: eventData && eventData.metadata ? eventData.metadata : undefined
  };

  if (foodCode) event.foodCode = foodCode;

  trail.events.push(event);
  return trail;
}

function summarizeAuditTrail(trail) {
  if (!trail) {
    return {
      total: 0,
      byType: {},
      warnings: [],
      generatedAt: null,
      enterpriseAI: false
    };
  }

  var events = Array.isArray(trail.events) ? trail.events : [];
  var byType = {};
  var warnings = [];

  events.forEach(function(event) {
    if (!event) return;
    var t = event.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;

    if (t === 'warning' || t === 'fallback_used') warnings.push(event.detail || '');
  });

  return {
    total: events.length,
    byType: byType,
    warnings: warnings.filter(Boolean),
    semanticRepairs: byType.semantic_repair || 0,
    aiActive: (byType.ai_active || 0) > 0,
    fallbackUsed: (byType.fallback_used || 0) > 0,
    adaptiveStrategyChanges: byType.adaptive_strategy || 0,
    diversityAdjustments: byType.diversity_adjustment || 0,
    adherenceAdjustments: byType.adherence_adjustment || 0,
    recommendationsGenerated: byType.recommendation_generated || 0,
    confidenceRecalculations: byType.confidence_recalculated || 0,
    enterpriseAI: true,
    generatedAt: trail.generatedAt || null
  };
}

module.exports = {
  createNutritionAuditTrail: createNutritionAuditTrail,
  addAuditEvent: addAuditEvent,
  summarizeAuditTrail: summarizeAuditTrail
};
