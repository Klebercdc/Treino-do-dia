'use strict';

/**
 * KRONOS Context Hub — server-side factual inventory + context builder.
 *
 * Responsabilities:
 *  1. buildKronosInventory(userId)     — what data exists for this user
 *  2. buildKronosContextHub(userId, queryText?) — full consolidated context
 *  3. selectContextForIntent(hub, intent) — pick only relevant slices
 *  4. formatContextForPrompt(slices)   — render as injected system text
 *
 * Rules:
 *  - never invent absent data
 *  - never block if a slice is missing; log and continue
 *  - never expose raw sensitive fields to caller
 */

var plans = require('./_plans');
var userMemory = require('./_userMemory');

// ─────────────────────────────────────────────────────────────
// Internal REST helper (same pattern as _userMemory.js)
// ─────────────────────────────────────────────────────────────

function supabase(method, path, body) {
  return new Promise(function (resolve, reject) {
    plans.supabaseRequest(method, path, body, function (err, data) {
      if (err) return reject(new Error(String(err)));
      resolve(data);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// A. INVENTORY — fast, parallel presence checks
// ─────────────────────────────────────────────────────────────

/**
 * Returns KronosInventory: what buckets of data exist for the user.
 * Each check is independent; failures are treated as "not found".
 */
async function buildKronosInventory(userId) {
  var results = await Promise.allSettled([
    // 0 – profile
    supabase('GET', 'profiles?id=eq.' + userId + '&select=id&limit=1', null),
    // 1 – workouts (training history)
    supabase('GET', 'workouts?user_id=eq.' + userId + '&select=id&limit=1', null),
    // 2 – nutrition goals
    supabase('GET', 'nutrition_goals?user_id=eq.' + userId + '&select=id&limit=1', null),
    // 3 – valid lab reports (presence check)
    supabase('GET', 'lab_reports?user_id=eq.' + userId + '&is_valid=eq.true&select=id&limit=1', null),
    // 4 – memory state
    supabase('GET', 'user_memory_state?user_id=eq.' + userId + '&select=user_id&limit=1', null),
    // 5 – lab reports count (longitudinal)
    supabase('GET', 'lab_reports?user_id=eq.' + userId + '&is_valid=eq.true&select=id&limit=3', null),
    // 6 – body metrics / progress entries
    supabase('GET', 'body_metrics?user_id=eq.' + userId + '&select=id&limit=1', null)
  ]);

  function hasRows(idx) {
    return results[idx].status === 'fulfilled' &&
      Array.isArray(results[idx].value) &&
      results[idx].value.length > 0;
  }

  var labCount = (results[5].status === 'fulfilled' && Array.isArray(results[5].value))
    ? results[5].value.length
    : 0;

  return {
    hasProfile: hasRows(0),
    hasTrainingHistory: hasRows(1),
    hasWorkoutPlan: false, // resolved later when we load actual workouts
    hasNutritionProfile: hasRows(0), // nutritional fields live in profiles
    hasNutritionPlan: hasRows(2),
    hasLabReports: hasRows(3),
    hasLabLongitudinal: labCount >= 2,
    hasProgressMetrics: hasRows(6),
    hasMemoryState: hasRows(4),
    hasScienceMatch: false // resolved on-demand by scienceInsightService
  };
}

// ─────────────────────────────────────────────────────────────
// B. DATA LOADERS — one per domain
// ─────────────────────────────────────────────────────────────

async function loadProfile(userId) {
  var rows = await supabase(
    'GET',
    'profiles?id=eq.' + userId +
    '&select=id,nome,full_name,objetivo,objective,nivel,idade,sexo,sex,' +
    'peso_kg,current_weight_kg,altura_cm,height_cm,activity_level,rotina,' +
    'restricoes,intolerances,lesoes,config&limit=1',
    null
  ).catch(function () { return []; });
  return (rows && rows[0]) ? rows[0] : null;
}

async function loadNutritionGoal(userId) {
  var rows = await supabase(
    'GET',
    'nutrition_goals?user_id=eq.' + userId +
    '&select=calories_target,protein_g,carbs_g,fat_g,updated_at&order=updated_at.desc&limit=1',
    null
  ).catch(function () { return []; });
  return (rows && rows[0]) ? rows[0] : null;
}

async function loadLatestLabSummary(userId) {
  var rows = await supabase(
    'GET',
    'lab_reports?user_id=eq.' + userId +
    '&is_valid=eq.true' +
    '&select=id,created_at,processed_at,clinical_flags,critical_flags,ai_insights,normalized_payload,confidence' +
    '&order=processed_at.desc.nullslast,created_at.desc&limit=1',
    null
  ).catch(function () { return []; });
  return (rows && rows[0]) ? rows[0] : null;
}

async function loadLatestWorkout(userId) {
  var rows = await supabase(
    'GET',
    'workouts?user_id=eq.' + userId +
    '&select=id,date,created_at&order=date.desc.nullslast,created_at.desc&limit=1',
    null
  ).catch(function () { return []; });
  return (rows && rows[0]) ? rows[0] : null;
}

// ─────────────────────────────────────────────────────────────
// C. DOMAIN MAPPERS — raw row → clean context slice
// ─────────────────────────────────────────────────────────────

function firstStr() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function firstNum() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v === null || v === undefined || v === '') continue;
    var n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toStrArr(v) {
  if (Array.isArray(v)) return v.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  return [];
}

function mapProfile(row) {
  if (!row) return null;
  var config = (row.config && typeof row.config === 'object' && !Array.isArray(row.config))
    ? row.config
    : {};
  var goal = firstStr(row.objetivo, row.objective, config.objetivo, config.objective);
  var level = firstStr(row.nivel, config.nivel, config.level);
  var athleteLevel = null;
  if (/iniciante|beginner/i.test(level)) athleteLevel = 'iniciante';
  else if (/avan[cç]ado|advanced/i.test(level)) athleteLevel = 'avancado';
  else if (/intermediar/i.test(level)) athleteLevel = 'intermediario';

  return {
    name: firstStr(row.nome, row.full_name, config.nome, config.full_name),
    age: firstNum(row.idade, config.idade, config.age),
    sex: firstStr(row.sexo, row.sex, config.sexo, config.sex),
    weightKg: firstNum(row.peso_kg, row.current_weight_kg, config.peso_kg, config.current_weight_kg, config.pesoKg),
    heightCm: firstNum(row.altura_cm, row.height_cm, config.altura_cm, config.height_cm, config.alturaCm),
    goal: goal,
    activityLevel: firstStr(row.activity_level, row.rotina, config.activity_level, config.rotina),
    athleteLevel: athleteLevel,
    restrictions: toStrArr(row.restricoes || row.intolerances || config.restricoes || config.intolerances)
  };
}

function mapNutrition(nutritionGoal, profileRow) {
  var hasGoal = !!(nutritionGoal && (nutritionGoal.calories_target || nutritionGoal.protein_g));
  if (!hasGoal && !profileRow) return null;

  var config = profileRow && profileRow.config && typeof profileRow.config === 'object'
    ? profileRow.config
    : {};
  var restrictions = toStrArr(
    (profileRow && (profileRow.restricoes || profileRow.intolerances)) ||
    config.restricoes || config.intolerances
  );

  return {
    targetCalories: nutritionGoal ? firstNum(nutritionGoal.calories_target) : null,
    proteinG: nutritionGoal ? firstNum(nutritionGoal.protein_g) : null,
    carbsG: nutritionGoal ? firstNum(nutritionGoal.carbs_g) : null,
    fatG: nutritionGoal ? firstNum(nutritionGoal.fat_g) : null,
    nutritionStatus: null, // filled from memory blocks below
    dietaryRestrictions: restrictions,
    clinicalFlags: [],
    criticalFlags: []
  };
}

function safeStrArr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function mapLabs(labRow) {
  if (!labRow) return null;
  var ai = (labRow.ai_insights && typeof labRow.ai_insights === 'object') ? labRow.ai_insights : {};
  var payload = (labRow.normalized_payload && typeof labRow.normalized_payload === 'object') ? labRow.normalized_payload : {};

  // Clinical / critical flags from row or ai_insights
  var clinicalFlags = safeStrArr(ai.clinical_flags || labRow.clinical_flags);
  var criticalFlags = safeStrArr(ai.critical_flags || labRow.critical_flags);

  // Contextual summary
  var summaryText = firstStr(ai.contextual_summary, ai.summary);

  // Signals from health_profile
  var hp = (ai.health_profile && typeof ai.health_profile === 'object') ? ai.health_profile : {};
  var readinessSignal = firstStr(
    hp.training_readiness && hp.training_readiness.level,
    hp.trainingReadiness && hp.trainingReadiness.level
  );
  var hormonalSignal = firstStr(
    hp.androgen_status && hp.androgen_status.level,
    hp.androgenStatus && hp.androgenStatus.level
  );
  var metabolicSignal = firstStr(
    hp.metabolic_health && hp.metabolic_health.level,
    hp.metabolicHealth && hp.metabolicHealth.level
  );

  // Key markers — up to 6 most relevant (flagged first)
  var biomarkers = Array.isArray(payload.biomarkers) ? payload.biomarkers : [];
  var keyMarkers = biomarkers
    .filter(function (b) { return b && b.marker_key; })
    .sort(function (a, b) {
      // flagged markers first
      var af = (a.flag === 'high' || a.flag === 'low') ? 0 : 1;
      var bf = (b.flag === 'high' || b.flag === 'low') ? 0 : 1;
      return af - bf;
    })
    .slice(0, 6)
    .map(function (b) {
      return {
        key: String(b.marker_key || ''),
        name: String(b.marker_name || b.marker_key || ''),
        value: b.value_numeric !== undefined && b.value_numeric !== null ? b.value_numeric : (b.value_text || null),
        unit: b.unit || null,
        flag: (b.flag === 'low' || b.flag === 'high' || b.flag === 'normal') ? b.flag : null
      };
    });

  var reportDate = firstStr(labRow.processed_at, labRow.created_at);

  return {
    lastReportAt: reportDate,
    summaryText: summaryText,
    clinicalFlags: clinicalFlags,
    criticalFlags: criticalFlags,
    readinessSignal: readinessSignal,
    hormonalSignal: hormonalSignal,
    metabolicSignal: metabolicSignal,
    keyMarkers: keyMarkers
  };
}

function mapTraining(memoryBlocks, lastWorkoutRow) {
  if (!memoryBlocks) return null;
  var perf = memoryBlocks.performance_trend || {};
  var adherence = memoryBlocks.adherence_state || {};
  var recovery = memoryBlocks.recovery_state || {};
  var fatigue = memoryBlocks.fatigue_state || {};
  var tolerance = memoryBlocks.training_tolerance_state || {};
  var alignment = memoryBlocks.objective_alignment_state || {};

  var lastWorkoutAt = null;
  if (lastWorkoutRow) {
    lastWorkoutAt = firstStr(lastWorkoutRow.date, lastWorkoutRow.created_at);
  }

  var weeklyFreq = null;
  if (adherence.sourceSignals && adherence.sourceSignals.weeklyFrequencyEstimate != null) {
    weeklyFreq = Number(adherence.sourceSignals.weeklyFrequencyEstimate) || null;
  }

  return {
    lastWorkoutAt: lastWorkoutAt,
    weeklyFrequency: weeklyFreq,
    performanceTrend: perf.status || null,
    adherenceStatus: adherence.status || null,
    recoveryStatus: recovery.status || null,
    fatigueStatus: fatigue.status || null,
    trainingTolerance: tolerance.status || null,
    objectiveAlignment: alignment.status || null,
    topExercises: []
  };
}

function mapProgress(memorySummary) {
  if (!memorySummary) return null;
  var verdict = memorySummary.status === 'improving'
    ? 'melhorou'
    : (memorySummary.status === 'declining' ? 'piorou' : 'estabilizou');
  return {
    verdict: verdict,
    explanation: memorySummary.text || null,
    confidence: memorySummary.confidence || null
  };
}

function mapMemory(memorySummary) {
  if (!memorySummary || !memorySummary.text) return null;
  return {
    coachingSummary: memorySummary.text,
    updatedAt: memorySummary.updatedAt || null
  };
}

// ─────────────────────────────────────────────────────────────
// D. MISSING DATA REPORTER
// ─────────────────────────────────────────────────────────────

function buildMissingData(inventory, profile, training, nutrition, labs) {
  var missing = [];
  if (!inventory.hasProfile || !profile) missing.push('perfil do usuário');
  else {
    if (!profile.age) missing.push('idade');
    if (!profile.sex) missing.push('sexo');
    if (!profile.weightKg) missing.push('peso');
    if (!profile.goal) missing.push('objetivo');
  }
  if (!inventory.hasTrainingHistory || !training) missing.push('histórico de treino');
  if (!inventory.hasNutritionPlan || !nutrition || !nutrition.targetCalories) missing.push('plano nutricional');
  if (!inventory.hasLabReports || !labs) missing.push('exames laboratoriais');
  if (!inventory.hasMemoryState) missing.push('memória longitudinal');
  return missing;
}

// ─────────────────────────────────────────────────────────────
// E. MAIN BUILDER
// ─────────────────────────────────────────────────────────────

/**
 * buildKronosContextHub(userId, queryText?)
 *
 * Fetches all available context for a user in parallel.
 * Never throws — always returns at least { inventory, missingData }.
 */
async function buildKronosContextHub(userId, queryText) {
  if (!userId) {
    return {
      inventory: {
        hasProfile: false, hasTrainingHistory: false, hasWorkoutPlan: false,
        hasNutritionProfile: false, hasNutritionPlan: false, hasLabReports: false,
        hasLabLongitudinal: false, hasProgressMetrics: false, hasMemoryState: false,
        hasScienceMatch: false
      },
      profile: null, training: null, nutrition: null, labs: null,
      progress: null, memory: null, science: null,
      missingData: ['userId ausente']
    };
  }

  // 1. Inventory + all data loaders in parallel
  var settled = await Promise.allSettled([
    buildKronosInventory(userId),               // 0
    loadProfile(userId),                        // 1
    loadNutritionGoal(userId),                  // 2
    loadLatestLabSummary(userId),               // 3
    loadLatestWorkout(userId),                  // 4
    userMemory.getCoachingSummary(userId)        // 5
  ]);

  function get(idx) {
    return settled[idx].status === 'fulfilled' ? settled[idx].value : null;
  }

  var inventory = get(0) || {};
  var profileRow = get(1);
  var nutritionGoalRow = get(2);
  var labRow = get(3);
  var lastWorkoutRow = get(4);
  var memorySummary = get(5);

  // 2. Map to clean domain slices
  var profileSlice = mapProfile(profileRow);
  var nutritionSlice = mapNutrition(nutritionGoalRow, profileRow);
  var labsSlice = mapLabs(labRow);

  // Enrich nutrition with clinical flags from labs if available
  if (nutritionSlice && labsSlice) {
    nutritionSlice.clinicalFlags = labsSlice.clinicalFlags.slice(0, 3);
    nutritionSlice.criticalFlags = labsSlice.criticalFlags.slice(0, 2);
  }

  // Memory blocks → training slice
  var memoryBlocks = (memorySummary && memorySummary.blocks) ? memorySummary.blocks : null;
  var trainingSlice = mapTraining(memoryBlocks, lastWorkoutRow);
  var progressSlice = mapProgress(memorySummary);
  var memorySlice = mapMemory(memorySummary);

  // Enrich nutrition status from memory blocks
  if (nutritionSlice && memoryBlocks && memoryBlocks.nutrition_state) {
    nutritionSlice.nutritionStatus = memoryBlocks.nutrition_state.status || null;
  }

  // Update inventory flags we can now confirm
  inventory.hasWorkoutPlan = !!(trainingSlice && trainingSlice.lastWorkoutAt);
  inventory.hasMemoryState = !!(memoryBlocks);

  var missingData = buildMissingData(inventory, profileSlice, trainingSlice, nutritionSlice, labsSlice);

  return {
    inventory: inventory,
    profile: profileSlice,
    training: trainingSlice,
    nutrition: nutritionSlice,
    labs: labsSlice,
    progress: progressSlice,
    memory: memorySlice,
    science: null, // populated on-demand by scienceInsightService
    missingData: missingData
  };
}

// ─────────────────────────────────────────────────────────────
// F. INTENT-BASED CONTEXT SELECTOR
// ─────────────────────────────────────────────────────────────

/**
 * KronosIntent enum (mirrors the contract in the spec).
 * Used to decide which slices to inject into the prompt.
 */
var KRONOS_INTENT = {
  LAB_ANALYSIS: 'lab_analysis',
  WORKOUT_PLANNING: 'workout_planning',
  WORKOUT_FEEDBACK: 'workout_feedback',
  NUTRITION_PLANNING: 'nutrition_planning',
  NUTRITION_FEEDBACK: 'nutrition_feedback',
  PROGRESS_REVIEW: 'progress_review',
  RECOVERY_ANALYSIS: 'recovery_analysis',
  SUPPLEMENT_GUIDANCE: 'supplement_guidance',
  MIXED_CONTEXT: 'mixed_context',
  FALLBACK: 'fallback'
};

/**
 * Derive KronosIntent from classifier topic + kind.
 * topic: workout | diet | supplement | recovery | progress | labs | general
 * kind: request | question | adjust | vent | complaint | general
 */
function deriveKronosIntent(topic, kind) {
  if (topic === 'labs' || topic === 'exams') return KRONOS_INTENT.LAB_ANALYSIS;
  if (topic === 'workout') {
    return kind === 'request' ? KRONOS_INTENT.WORKOUT_PLANNING : KRONOS_INTENT.WORKOUT_FEEDBACK;
  }
  if (topic === 'diet') {
    return kind === 'request' ? KRONOS_INTENT.NUTRITION_PLANNING : KRONOS_INTENT.NUTRITION_FEEDBACK;
  }
  if (topic === 'recovery') return KRONOS_INTENT.RECOVERY_ANALYSIS;
  if (topic === 'supplement') return KRONOS_INTENT.SUPPLEMENT_GUIDANCE;
  if (topic === 'progress') return KRONOS_INTENT.PROGRESS_REVIEW;
  if (kind === 'question' || kind === 'adjust') return KRONOS_INTENT.MIXED_CONTEXT;
  return KRONOS_INTENT.FALLBACK;
}

/**
 * selectContextForIntent(hub, intent)
 *
 * Returns a filtered view of hub with only the slices relevant to this intent.
 * Auxiliary slices are included only when they have causal value.
 */
function selectContextForIntent(hub, intent) {
  if (!hub) return { inventory: {}, missingData: [] };

  var selected = {
    inventory: hub.inventory,
    missingData: hub.missingData
  };

  switch (intent) {
    case KRONOS_INTENT.LAB_ANALYSIS:
      selected.labs = hub.labs;
      selected.profile = hub.profile; // for clinical context
      // Nutrition only if labs have metabolic/clinical flags
      if (hub.labs && (hub.labs.clinicalFlags.length || hub.labs.criticalFlags.length)) {
        selected.nutrition = hub.nutrition;
      }
      break;

    case KRONOS_INTENT.WORKOUT_PLANNING:
    case KRONOS_INTENT.WORKOUT_FEEDBACK:
      selected.profile = hub.profile;
      selected.training = hub.training;
      selected.memory = hub.memory;
      selected.progress = hub.progress;
      // Labs only if training readiness signal exists
      if (hub.labs && hub.labs.readinessSignal && hub.labs.readinessSignal !== 'ok') {
        selected.labs = hub.labs;
      }
      break;

    case KRONOS_INTENT.NUTRITION_PLANNING:
    case KRONOS_INTENT.NUTRITION_FEEDBACK:
      selected.profile = hub.profile;
      selected.nutrition = hub.nutrition;
      // Labs if there are clinical/metabolic flags relevant to diet
      if (hub.labs && (hub.labs.metabolicSignal || hub.labs.clinicalFlags.length)) {
        selected.labs = hub.labs;
      }
      break;

    case KRONOS_INTENT.RECOVERY_ANALYSIS:
      selected.profile = hub.profile;
      selected.training = hub.training;
      selected.memory = hub.memory;
      // Labs if recovery signal is not ok
      if (hub.labs && hub.labs.readinessSignal) {
        selected.labs = hub.labs;
      }
      break;

    case KRONOS_INTENT.SUPPLEMENT_GUIDANCE:
      selected.profile = hub.profile;
      selected.training = hub.training;
      if (hub.labs && hub.labs.keyMarkers.length) {
        selected.labs = hub.labs; // labs calibrate supplement decisions
      }
      break;

    case KRONOS_INTENT.PROGRESS_REVIEW:
    case KRONOS_INTENT.MIXED_CONTEXT:
      // Full context for progress/mixed
      selected.profile = hub.profile;
      selected.training = hub.training;
      selected.nutrition = hub.nutrition;
      selected.memory = hub.memory;
      selected.progress = hub.progress;
      if (hub.labs) selected.labs = hub.labs;
      break;

    default: // FALLBACK
      selected.profile = hub.profile;
      selected.memory = hub.memory;
      break;
  }

  return selected;
}

// ─────────────────────────────────────────────────────────────
// G. PROMPT FORMATTER
// ─────────────────────────────────────────────────────────────

/**
 * formatContextForPrompt(selected)
 *
 * Converts selected context slices into a compact text block
 * suitable for injection into a system prompt.
 * Never exposes raw sensitive fields.
 */
function formatContextForPrompt(selected) {
  if (!selected) return '';
  var lines = [];

  // ── Profile
  var p = selected.profile;
  if (p) {
    var pParts = [];
    if (p.name) pParts.push('nome: ' + p.name);
    if (p.age) pParts.push('idade: ' + p.age + ' anos');
    if (p.sex) pParts.push('sexo: ' + p.sex);
    if (p.weightKg) pParts.push('peso: ' + p.weightKg + ' kg');
    if (p.heightCm) pParts.push('altura: ' + p.heightCm + ' cm');
    if (p.goal) pParts.push('objetivo: ' + p.goal);
    if (p.athleteLevel) pParts.push('nível: ' + p.athleteLevel);
    if (p.activityLevel) pParts.push('atividade: ' + p.activityLevel);
    if (p.restrictions && p.restrictions.length) pParts.push('restrições: ' + p.restrictions.join(', '));
    if (pParts.length) lines.push('[PERFIL] ' + pParts.join(' | '));
  }

  // ── Training
  var t = selected.training;
  if (t) {
    var tParts = [];
    if (t.lastWorkoutAt) tParts.push('último treino: ' + t.lastWorkoutAt.slice(0, 10));
    if (t.weeklyFrequency != null) tParts.push('frequência/sem: ' + Number(t.weeklyFrequency).toFixed(1) + 'x');
    if (t.performanceTrend) tParts.push('performance: ' + t.performanceTrend);
    if (t.adherenceStatus) tParts.push('adesão: ' + t.adherenceStatus);
    if (t.recoveryStatus) tParts.push('recuperação: ' + t.recoveryStatus);
    if (t.fatigueStatus) tParts.push('fadiga: ' + t.fatigueStatus);
    if (t.trainingTolerance) tParts.push('tolerância: ' + t.trainingTolerance);
    if (t.objectiveAlignment) tParts.push('alinhamento: ' + t.objectiveAlignment);
    if (tParts.length) lines.push('[TREINO] ' + tParts.join(' | '));
  }

  // ── Memory / coaching summary
  var m = selected.memory;
  if (m && m.coachingSummary) {
    lines.push('[MEMÓRIA EVOLUTIVA] ' + m.coachingSummary);
  }

  // ── Progress verdict
  var pr = selected.progress;
  if (pr && pr.verdict) {
    var prLine = '[PROGRESSO] Tendência: ' + pr.verdict;
    if (pr.explanation) prLine += '. ' + pr.explanation;
    lines.push(prLine);
  }

  // ── Nutrition
  var n = selected.nutrition;
  if (n) {
    var nParts = [];
    if (n.targetCalories) nParts.push('meta: ' + n.targetCalories + ' kcal');
    if (n.proteinG) nParts.push('proteína: ' + n.proteinG + 'g');
    if (n.carbsG) nParts.push('carbo: ' + n.carbsG + 'g');
    if (n.fatG) nParts.push('gordura: ' + n.fatG + 'g');
    if (n.nutritionStatus) nParts.push('status: ' + n.nutritionStatus);
    if (n.dietaryRestrictions && n.dietaryRestrictions.length) nParts.push('restrições: ' + n.dietaryRestrictions.join(', '));
    if (nParts.length) lines.push('[NUTRIÇÃO] ' + nParts.join(' | '));
    if (n.criticalFlags && n.criticalFlags.length) {
      lines.push('[NUTRIÇÃO ALERTA CRÍTICO] ' + n.criticalFlags.join('; '));
    }
  }

  // ── Labs
  var l = selected.labs;
  if (l) {
    if (l.lastReportAt) lines.push('[EXAMES] Último resultado: ' + l.lastReportAt.slice(0, 10));
    if (l.summaryText) lines.push('[EXAMES RESUMO] ' + l.summaryText);
    if (l.readinessSignal) lines.push('[EXAMES PRONTIDÃO TREINO] ' + l.readinessSignal);
    if (l.hormonalSignal) lines.push('[EXAMES HORMONAL] ' + l.hormonalSignal);
    if (l.metabolicSignal) lines.push('[EXAMES METABÓLICO] ' + l.metabolicSignal);
    if (l.criticalFlags && l.criticalFlags.length) {
      lines.push('[EXAMES ALERTA CRÍTICO] ' + l.criticalFlags.join('; '));
    } else if (l.clinicalFlags && l.clinicalFlags.length) {
      lines.push('[EXAMES ATENÇÃO CLÍNICA] ' + l.clinicalFlags.slice(0, 3).join('; '));
    }
    if (l.keyMarkers && l.keyMarkers.length) {
      var flagged = l.keyMarkers.filter(function (k) { return k.flag === 'high' || k.flag === 'low'; });
      if (flagged.length) {
        lines.push('[EXAMES MARCADORES ALTERADOS] ' + flagged.map(function (k) {
          return k.name + ' ' + k.value + (k.unit ? ' ' + k.unit : '') + ' (' + k.flag + ')';
        }).join('; '));
      }
    }
  }

  // ── Inventory summary (what KRONOS knows it has)
  var inv = selected.inventory;
  if (inv) {
    var have = [];
    var missing = [];
    if (inv.hasProfile) have.push('perfil');
    else missing.push('perfil');
    if (inv.hasTrainingHistory) have.push('histórico de treino');
    else missing.push('histórico de treino');
    if (inv.hasNutritionPlan) have.push('plano nutricional');
    else missing.push('plano nutricional');
    if (inv.hasLabReports) have.push('exames laboratoriais');
    else missing.push('exames laboratoriais');
    if (inv.hasMemoryState) have.push('memória longitudinal');

    if (have.length) lines.push('[KRONOS TEM ACESSO A] ' + have.join(', '));
    if (missing.length) lines.push('[KRONOS NÃO TEM] ' + missing.join(', ') + ' — não inventar dados ausentes');
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// H. EXPORTS
// ─────────────────────────────────────────────────────────────

module.exports = {
  buildKronosInventory: buildKronosInventory,
  buildKronosContextHub: buildKronosContextHub,
  deriveKronosIntent: deriveKronosIntent,
  selectContextForIntent: selectContextForIntent,
  formatContextForPrompt: formatContextForPrompt,
  KRONOS_INTENT: KRONOS_INTENT
};
