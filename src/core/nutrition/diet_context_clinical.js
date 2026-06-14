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

function parseNumeric(value) {
  if (value == null || value === '') return null;
  var normalized = String(value).replace(',', '.').replace(/[^0-9.\-]/g, '');
  var parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBiomarker(item) {
  item = safe(item);
  var name = pickString(item.marker_name, item.biomarker_name, item.name, item.nome, item.marker, item.marker_key, 'Marcador');
  var value = item.released_value;
  if (value == null || value === '') value = item.reviewed_value_override;
  if (value == null || value === '') value = item.value_numeric;
  if (value == null || value === '') value = item.value;
  if (value == null || value === '') value = item.value_text;
  return {
    name: name,
    value: value,
    numericValue: parseNumeric(value),
    unit: pickString(item.unit, item.unidade) || '',
    flag: pickString(item.released_flag, item.flag, item.lab_flag, item.context_flag) || '',
    raw: item,
  };
}

function normalizeBiomarkers(value) {
  if (!Array.isArray(value)) return [];
  var seen = Object.create(null);
  return value.map(normalizeBiomarker).filter(function(item) {
    var key = normalizeFreeText(item.name + '|' + item.value + '|' + item.unit);
    if (!item.name || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function extractBiomarkersFromSource(source) {
  source = safe(source);
  var normalizedPayload = safe(source.normalizedPayload || source.normalized_payload);
  var aiInsights = safe(source.aiInsights || source.ai_insights);
  var candidates = [];
  if (Array.isArray(source.biomarkers)) candidates = candidates.concat(source.biomarkers);
  if (Array.isArray(normalizedPayload.biomarkers)) candidates = candidates.concat(normalizedPayload.biomarkers);
  if (Array.isArray(aiInsights.marker_interpretations)) candidates = candidates.concat(aiInsights.marker_interpretations);
  return normalizeBiomarkers(candidates);
}

function biomarkerValue(biomarkers, patterns) {
  for (var i = 0; i < biomarkers.length; i += 1) {
    var item = biomarkers[i];
    var name = normalizeFreeText(item.name);
    if (patterns.some(function(pattern) { return pattern.test(name); }) && item.numericValue != null) {
      return item.numericValue;
    }
  }
  return null;
}

function mergeParsedWithBiomarkers(parsed, biomarkers) {
  var result = parsed && typeof parsed === 'object' ? Object.assign({}, parsed) : {};
  var mappings = [
    ['glucose', [/\bglicemia\b/, /\bglicose\b/, /glucose/]],
    ['hba1c', [/hemoglobina\s+glicada/, /hba1c/, /hb\s*a1c/]],
    ['potassium', [/\bpotassio\b/, /potassium/]],
    ['creatinine', [/\bcreatinina\b/, /creatinine/]],
    ['ldl', [/\bldl\b/]],
    ['hdl', [/\bhdl\b/]],
    ['triglycerides', [/triglicer/, /triglycer/]],
    ['sodium', [/\bsodio\b/, /sodium/]],
    ['urea', [/\bureia\b/, /\burea\b/]],
    ['tgo', [/\btgo\b/, /\bast\b/]],
    ['tgp', [/\btgp\b/, /\balt\b/]],
  ];

  mappings.forEach(function(pair) {
    if (result[pair[0]] != null) return;
    var value = biomarkerValue(biomarkers, pair[1]);
    if (value != null) result[pair[0]] = value;
  });

  return Object.keys(result).length ? result : null;
}

// ─── Lab / Clinical core ────────────────────────────────────────────────────

function resolveDietMode(labReport) {
  if (!labReport || !labReport.isValid) return 'standard';
  if (labReport.parsed || (Array.isArray(labReport.biomarkers) && labReport.biomarkers.length)) return 'clinical';
  if (Array.isArray(labReport.clinicalFlags) && labReport.clinicalFlags.length) return 'clinical';
  if (Array.isArray(labReport.criticalFlags) && labReport.criticalFlags.length) return 'clinical';
  return 'standard';
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
  if (!source) return { mode: 'standard', parsed: null, biomarkers: [], clinicalFlags: [], criticalFlags: [], isValid: false };

  var aiInsights = safe(source.aiInsights || source.ai_insights);
  var biomarkers = extractBiomarkersFromSource(source);
  var parsed = mergeParsedWithBiomarkers(source.parsed && typeof source.parsed === 'object' ? source.parsed : null, biomarkers);
  var clinicalFlags = normalizeClinicalFlags(source.clinicalFlags || source.clinical_flags || aiInsights.clinical_flags);
  var criticalFlags = normalizeClinicalFlags(source.criticalFlags || source.critical_flags || aiInsights.critical_flags);
  var isValid = source.isValid === true || source.is_valid === true || biomarkers.length > 0 || clinicalFlags.length > 0 || criticalFlags.length > 0;
  var mode = resolveDietMode({ parsed: parsed, biomarkers: biomarkers, isValid: isValid, clinicalFlags: clinicalFlags, criticalFlags: criticalFlags });

  if (mode === 'clinical' && !clinicalFlags.length && !criticalFlags.length) {
    var recalculated = applyClinicalRules({ parsed: parsed, isValid: isValid });
    clinicalFlags = recalculated.clinicalFlags;
    criticalFlags = recalculated.criticalFlags;
  }

  return {
    id: source.id || null,
    parsed: parsed,
    biomarkers: biomarkers,
    scores: aiInsights.scores || source.scores || null,
    healthProfile: aiInsights.health_profile || source.healthProfile || source.health_profile || null,
    confidence: Number(source.confidence || 0),
    isValid: isValid,
    mode: mode,
    clinicalFlags: clinicalFlags,
    criticalFlags: criticalFlags,
    aiInsights: Object.keys(aiInsights).length ? aiInsights : null,
    createdAt: source.createdAt || source.created_at || null,
    processedAt: source.processedAt || source.processed_at || null,
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

  // Lab-based flags (from biomarker results)
  if (hasClinicalFlag(profile, 'high_potassium') && /banana|abacate|batata.doce/.test(name)) return true;
  if (hasClinicalFlag(profile, 'high_ldl') && /patinho/.test(name)) return true;
  if ((hasClinicalFlag(profile, 'pre_diabetes') || hasClinicalFlag(profile, 'glycemic_risk')) && /\bmel\b|tapioca/.test(name)) return true;

  // Condition-based flags (from user-declared healthConditions)
  var condFlags = profile.clinicalData && profile.clinicalData.flags ? profile.clinicalData.flags : {};
  if (condFlags.hasDoencaRenal && /banana|abacate|batata.doce/.test(name)) return true;
  if ((condFlags.hasDiabetes || condFlags.hasDoencaRenal) && /\bmel\b|tapioca/.test(name)) return true;

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