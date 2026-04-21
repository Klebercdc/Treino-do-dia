'use strict';

var nutritionService = require('../../lib/nutrition/nutritionService');

function safe(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function pickString() {
  for (var i = 0; i < arguments.length; i += 1) {
    var v = arguments[i];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickLabSource(raw, context, profile, health, supabase) {
  var candidates = [
    raw.labContext, raw.labs,
    profile.labContext,
    context.labContext,
    health.labContext,
  ];
  var supabaseReport = safe(supabase.latestLabReport);
  for (var i = 0; i < candidates.length; i += 1) {
    var c = candidates[i];
    if (c && typeof c === 'object' && Object.keys(c).length) return c;
  }
  return Object.keys(supabaseReport).length ? supabaseReport : null;
}

/**
 * Extracts health context (pathologies, medications, sleep, stress) and
 * lab/biomarker context from any payload shape.
 * Canonical source for clinical signals that influence diet strategy.
 */
function buildClinicalContext(input) {
  var raw = safe(input);
  var context = safe(raw.context);
  var profile = safe(raw.profile);
  var supabase = safe(raw.supabaseSnapshot || profile.supabaseSnapshot || context.supabaseSnapshot);
  var health = safe(raw.saude || raw.healthContext || context.saude || context.healthContext);

  var labSource = pickLabSource(raw, context, profile, health, supabase);
  var labContext = labSource ? nutritionService.buildLabContext(labSource) : null;

  return {
    saude: {
      patologia: pickString(health.patologia, health.pathology),
      medicamentos: pickString(health.medicamentos, health.medications),
      sono: pickString(health.sono, health.sleep),
      estresse: pickString(health.estresse, health.stress),
    },
    labContext: labContext,
  };
}

module.exports = { buildClinicalContext: buildClinicalContext };
