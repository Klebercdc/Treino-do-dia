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
  'warning'
];

function createNutritionAuditTrail() {
  return {
    events: [],
    generatedAt: new Date().toISOString()
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
    timestamp: new Date().toISOString()
  };

  if (foodCode) event.foodCode = foodCode;

  trail.events.push(event);
  return trail;
}

function summarizeAuditTrail(trail) {
  if (!trail) return { total: 0, byType: {}, warnings: [], generatedAt: null };

  var events = Array.isArray(trail.events) ? trail.events : [];
  var byType = {};
  var warnings = [];

  events.forEach(function(event) {
    if (!event) return;
    var t = event.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
    if (t === 'warning' || t === 'fallback_used') {
      warnings.push(event.detail || '');
    }
  });

  var semanticRepairs = byType['semantic_repair'] || 0;
  var aiActive = (byType['ai_active'] || 0) > 0;
  var fallbackUsed = (byType['fallback_used'] || 0) > 0;

  return {
    total: events.length,
    byType: byType,
    warnings: warnings.filter(Boolean),
    semanticRepairs: semanticRepairs,
    aiActive: aiActive,
    fallbackUsed: fallbackUsed,
    generatedAt: trail.generatedAt || null
  };
}

module.exports = {
  createNutritionAuditTrail: createNutritionAuditTrail,
  addAuditEvent: addAuditEvent,
  summarizeAuditTrail: summarizeAuditTrail
};
