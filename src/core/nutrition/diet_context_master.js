'use strict';

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

function pickNumber() {
  for (var i = 0; i < arguments.length; i += 1) {
    var n = Number(arguments[i]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function toStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(function(v) { return String(v || '').trim(); }).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(function(v) { return v.trim(); }).filter(Boolean);
  return [];
}

function mergeUnique() {
  var seen = Object.create(null);
  var result = [];
  for (var i = 0; i < arguments.length; i += 1) {
    toStringArray(arguments[i]).forEach(function(item) {
      var key = item.toLowerCase();
      if (!seen[key]) { seen[key] = true; result.push(item); }
    });
  }
  return result;
}

/**
 * Extracts the "body + objective" layer from any payload shape.
 * Single source of truth for who the user is: demographics, goal, food identity.
 */
function buildMasterContext(input) {
  var raw = safe(input);
  var profile = safe(raw.profile);
  var context = safe(raw.context);
  var supabase = safe(raw.supabaseSnapshot || profile.supabaseSnapshot || context.supabaseSnapshot);
  var dbProfile = safe(supabase.profile);
  var bodyMetrics = safe(supabase.bodyMetrics);
  var rawGoals = raw.nutritionGoals || raw.goals || profile.nutritionGoals || context.nutritionGoals || supabase.nutritionGoals || null;
  var safeGoals = safe(rawGoals);
  var flowSel = safe(raw.nutritionFlowSelections || context.nutritionFlowSelections);

  return {
    sexo: pickString(raw.sexo, raw.sex, profile.sexo, profile.sex, context.sexo, context.sex, dbProfile.sex),
    idade: pickNumber(raw.idade, raw.age, profile.idade, profile.age, context.idade, context.age),
    peso: pickNumber(raw.peso, raw.pesoKg, raw.weight, raw.weightKg, profile.peso, profile.pesoKg, profile.weight, profile.weightKg, context.peso, bodyMetrics.weight_kg, dbProfile.current_weight_kg),
    altura: pickNumber(raw.altura, raw.alturaCm, raw.height, raw.heightCm, profile.altura, profile.alturaCm, profile.height, profile.heightCm, context.altura, dbProfile.height_cm),
    gorduraCorporal: pickNumber(raw.gorduraCorporal, raw.bodyFatPercent, profile.gorduraCorporal, profile.bodyFatPercent, bodyMetrics.body_fat_percent) || null,
    biotipo: pickString(raw.biotipo, raw.somatotype, profile.biotipo, profile.somatotype) || null,
    objetivo: pickString(raw.objetivo, raw.objective, profile.objetivo, profile.objective, context.objetivo, context.objective, dbProfile.objective),
    rotina: pickString(raw.rotina, raw.routine, profile.rotina, profile.routine, context.rotina, context.routine),
    nivelAtividade: pickString(raw.nivelAtividade, raw.activityLevel, profile.nivelAtividade, profile.activityLevel, context.nivelAtividade, dbProfile.activity_level),
    padraoAlimentar: pickString(raw.padraoAlimentar, raw.dietaryPattern, profile.padraoAlimentar, profile.dietaryPattern, context.padraoAlimentar, dbProfile.dietary_pattern),
    refeicoesPorDia: pickNumber(raw.refeicoesPorDia, raw.meals, raw.mealCount, profile.refeicoesPorDia, profile.meals, context.refeicoesPorDia, context.meals) || 4,
    restricoes: mergeUnique(raw.restricoes, raw.restrictions, profile.restricoes, context.restricoes, dbProfile.allergies, dbProfile.intolerances),
    preferencias: mergeUnique(raw.preferencias, raw.preferences, profile.preferencias, context.preferencias, dbProfile.liked_foods),
    alimentosEvitar: mergeUnique(raw.alimentosEvitar, raw.dislikes, profile.alimentosEvitar, profile.dislikes, context.alimentosEvitar, dbProfile.disliked_foods),
    suplementos: mergeUnique(raw.suplementos, raw.supplements, profile.suplementos, context.suplementos),
    nutritionGoals: Object.keys(safeGoals).length ? {
      calories_target: pickNumber(safeGoals.calories_target, safeGoals.caloriesTarget) || null,
      protein_g: pickNumber(safeGoals.protein_g, safeGoals.proteinTarget) || null,
      carbs_g: pickNumber(safeGoals.carbs_g, safeGoals.carbsTarget) || null,
      fat_g: pickNumber(safeGoals.fat_g, safeGoals.fatTarget) || null,
    } : null,
    foodSelections: Object.keys(flowSel).length ? flowSel : null,
    observacoes: pickString(raw.observacoes, raw.notes, profile.observacoes, context.observacoes),
    // Campos expandidos do wizard 6 etapas
    bcmData: raw.bcmData != null ? raw.bcmData : (profile.bcmData != null ? profile.bcmData : (context.bcmData != null ? context.bcmData : null)),
    pcmManual: raw.pcmManual != null ? raw.pcmManual : (profile.pcmManual != null ? profile.pcmManual : (context.pcmManual != null ? context.pcmManual : null)),
    bodyComposition: raw.bodyComposition != null ? raw.bodyComposition : (profile.bodyComposition != null ? profile.bodyComposition : (context.bodyComposition != null ? context.bodyComposition : null)),
    metabolismBehaviorContext: (raw.metabolismBehaviorContext || profile.metabolismBehaviorContext || context.metabolismBehaviorContext) || {
      respostaPeso:   pickString(raw.respostaPeso,   profile.respostaPeso,   context.respostaPeso)   || null,
      apetite:        pickString(raw.apetite,         profile.apetite,         context.apetite)         || null,
      historicoDieta: pickString(raw.historicoDieta,  profile.historicoDieta,  context.historicoDieta)  || null,
      adesao:         pickString(raw.adesao,           profile.adesao,          context.adesao)          || null,
      rotina:         pickString(raw.rotina,           profile.rotina,          context.rotina)          || null,
      sono:           pickString(raw.sono,             profile.sono,            context.sono)            || null,
      estresse:       pickString(raw.estresse,         profile.estresse,        context.estresse)        || null,
      usoHormonios:   pickString(raw.usoHormonios,     profile.usoHormonios,    context.usoHormonios)    || null,
    },
  };
}

module.exports = { buildMasterContext: buildMasterContext };
