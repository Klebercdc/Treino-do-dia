'use strict';

// ─── Helpers ────────────────────────────────────────────────────────────────

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 0;
  var factor = Math.pow(10, d);
  return Math.round(Number(value || 0) * factor) / factor;
}

function normalizeFreeText(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeClinicalFlags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
  return [];
}

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

// ─── Lab / Clinical core ────────────────────────────────────────────────────

function resolveDietMode(labReport) {
  if (!labReport || !labReport.isValid || !labReport.parsed) return 'standard';
  return 'clinical';
}

function applyClinicalRules(labReport) {
  var parsed = labReport && labReport.parsed && typeof labReport.parsed === 'object' ? labReport.parsed : null;
  if (!parsed) return { mode: 'standard', clinicalFlags: [], criticalFlags: [] };

  var clinicalFlags = [];
  var criticalFlags = [];

  if (Number(parsed.glucose) > 100) clinicalFlags.push('pre_diabetes');
  if (Number(parsed.hba1c) > 5.7) clinicalFlags.push('glycemic_risk');
  if (Number(parsed.potassium) > 5) clinicalFlags.push('high_potassium');
  if (Number(parsed.ldl) > 130) clinicalFlags.push('high_ldl');

  if (Number(parsed.glucose) >= 126) criticalFlags.push('hyperglycemia_alert');
  if (Number(parsed.hba1c) >= 6.5) criticalFlags.push('hba1c_alert');
  if (Number(parsed.potassium) >= 5.5) criticalFlags.push('potassium_alert');
  if (Number(parsed.creatinine) >= 2) criticalFlags.push('kidney_alert');
  if (Number(parsed.ldl) >= 160) criticalFlags.push('ldl_alert');

  return { mode: 'clinical', clinicalFlags: clinicalFlags, criticalFlags: criticalFlags };
}

function buildLabContext(input) {
  var source = input && typeof input === 'object' ? input : null;
  if (!source) return { mode: 'standard', parsed: null, clinicalFlags: [], criticalFlags: [], isValid: false };

  var parsed = source.parsed && typeof source.parsed === 'object' ? source.parsed : null;
  var clinicalFlags = normalizeClinicalFlags(source.clinicalFlags || source.clinical_flags);
  var criticalFlags = normalizeClinicalFlags(source.criticalFlags || source.critical_flags);
  var isValid = source.isValid === true || source.is_valid === true;
  var mode = resolveDietMode({ parsed: parsed, isValid: isValid });

  if (mode === 'clinical' && !clinicalFlags.length && !criticalFlags.length) {
    var recalculated = applyClinicalRules({ parsed: parsed, isValid: isValid });
    clinicalFlags = recalculated.clinicalFlags;
    criticalFlags = recalculated.criticalFlags;
  }

  return {
    id: source.id || null,
    parsed: parsed,
    confidence: Number(source.confidence || 0),
    isValid: isValid,
    mode: mode,
    clinicalFlags: clinicalFlags,
    criticalFlags: criticalFlags,
    createdAt: source.createdAt || source.created_at || null
  };
}

function hasClinicalFlag(profile, flag) {
  return !!(
    profile.labContext &&
    Array.isArray(profile.labContext.clinicalFlags) &&
    profile.labContext.clinicalFlags.indexOf(flag) !== -1
  );
}

function hasCriticalLabFlag(profile) {
  return !!(
    profile.labContext &&
    Array.isArray(profile.labContext.criticalFlags) &&
    profile.labContext.criticalFlags.length
  );
}

function shouldAvoidFoodForClinical(food, profile) {
  var name = normalizeFreeText(food && food.name);
  if (!name) return false;
  if (hasClinicalFlag(profile, 'high_potassium') && /banana|abacate|batata-doce/.test(name)) return true;
  if (hasClinicalFlag(profile, 'high_ldl') && /patinho/.test(name)) return true;
  if ((hasClinicalFlag(profile, 'pre_diabetes') || hasClinicalFlag(profile, 'glycemic_risk')) && /mel/.test(name)) return true;
  return false;
}

function getClinicalPenalty(food, profile) {
  var name = normalizeFreeText(food && food.name);
  var penalty = 0;
  if (
    (hasClinicalFlag(profile, 'pre_diabetes') || hasClinicalFlag(profile, 'glycemic_risk')) &&
    /granola|pao integral|macarrao/.test(name)
  ) penalty += 4;
  if (hasClinicalFlag(profile, 'high_ldl') && /ovo|iogurte/.test(name)) penalty += 2;
  return penalty;
}

function applyMedicalAdjustments(profile, targetCalories, macros) {
  var adjustedCalories = hasCriticalLabFlag(profile)
    ? round(profile.getForClinicalSafety || targetCalories)
    : targetCalories;

  return {
    targetCalories: adjustedCalories,
    macros: { protein: macros.protein, carbs: macros.carbs, fat: macros.fat }
  };
}

// ─── Health condition flags (from user-selected clinicalData.healthConditions) ─

function normalizeCondition(item) {
  return String(item || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Derives boolean condition flags from the structured healthConditions array
 * (e.g. ['Diabetes', 'Hipertensão']) provided by the nutrition flow UI.
 */
function buildConditionFlags(healthConditions) {
  var conditions = Array.isArray(healthConditions)
    ? healthConditions.map(normalizeCondition).filter(Boolean)
    : [];

  return {
    healthConditions: healthConditions || [],
    hasDiabetes: conditions.some(function(c) { return /diabet|insulina|glicemia/.test(c); }),
    hasHipertensao: conditions.some(function(c) { return /hipertens/.test(c); }),
    hasDoencaRenal: conditions.some(function(c) { return /renal|hemodial|nefropat/.test(c); }),
    hasDislipidemia: conditions.some(function(c) { return /dislipid|colesterol|triglice/.test(c); }),
    hasGastriteRefluxo: conditions.some(function(c) { return /gastrit|refluxo|gerd/.test(c); }),
    hasAlergiaIntolerancia: conditions.some(function(c) { return /alergia|intoler/.test(c); }),
    hasGestacao: conditions.some(function(c) { return /gesta|gravid/.test(c); }),
    hasPosBariatrica: conditions.some(function(c) { return /bariatr|pos-cirurg/.test(c); }),
  };
}

/**
 * Picks clinicalData (healthConditions + bcmManual) from the payload,
 * searching all nested locations where the client may have placed it.
 */
function pickClinicalData(raw, context, profile, health) {
  var sources = [
    raw.clinicalData,
    health.clinicalData,
    profile.clinicalData,
    context.clinicalData,
  ];

  var clinicalDataObj = null;
  for (var i = 0; i < sources.length; i += 1) {
    var s = sources[i];
    if (s && typeof s === 'object' && Array.isArray(s.healthConditions)) {
      clinicalDataObj = s;
      break;
    }
  }

  // Also check clinicalFlow.patologias as fallback (set by buildNutritionFlowInput)
  var patologias = null;
  var flowSources = [raw.clinicalFlow, profile.clinicalFlow, context.clinicalFlow];
  for (var j = 0; j < flowSources.length; j += 1) {
    var f = flowSources[j];
    if (f && Array.isArray(f.patologias) && f.patologias.length) {
      patologias = f.patologias;
      break;
    }
  }

  var healthConditions = (clinicalDataObj && clinicalDataObj.healthConditions) || patologias || [];
  var bcmManual = (clinicalDataObj && clinicalDataObj.bcmManual) || null;
  var exams = (clinicalDataObj && clinicalDataObj.exams) || null;

  return {
    healthConditions: healthConditions,
    bcmManual: bcmManual,
    exams: exams,
    flags: buildConditionFlags(healthConditions),
  };
}

// ─── Context builder (payload → clinical context) ──────────────────────────

function pickLabSource(raw, context, profile, health, supabase) {
  var candidates = [raw.labContext, raw.labs, profile.labContext, context.labContext, health.labContext];
  var supabaseReport = safe(supabase.latestLabReport);
  for (var i = 0; i < candidates.length; i += 1) {
    var c = candidates[i];
    if (c && typeof c === 'object' && Object.keys(c).length) return c;
  }
  return Object.keys(supabaseReport).length ? supabaseReport : null;
}

/**
 * Extracts health context (pathologies, medications, sleep, stress),
 * structured clinicalData (healthConditions, bcmManual) and
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
  var labContext = labSource ? buildLabContext(labSource) : null;
  var clinicalData = pickClinicalData(raw, context, profile, health);

  return {
    saude: {
      patologia: pickString(health.patologia, health.pathology),
      medicamentos: pickString(health.medicamentos, health.medications),
      sono: pickString(health.sono, health.sleep),
      estresse: pickString(health.estresse, health.stress),
    },
    labContext: labContext,
    clinicalData: clinicalData,
  };
}

module.exports = {
  round: round,
  normalizeFreeText: normalizeFreeText,
  normalizeClinicalFlags: normalizeClinicalFlags,
  resolveDietMode: resolveDietMode,
  applyClinicalRules: applyClinicalRules,
  buildLabContext: buildLabContext,
  buildConditionFlags: buildConditionFlags,
  pickClinicalData: pickClinicalData,
  hasClinicalFlag: hasClinicalFlag,
  hasCriticalLabFlag: hasCriticalLabFlag,
  shouldAvoidFoodForClinical: shouldAvoidFoodForClinical,
  getClinicalPenalty: getClinicalPenalty,
  applyMedicalAdjustments: applyMedicalAdjustments,
  buildClinicalContext: buildClinicalContext,
};
