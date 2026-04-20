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
// RISCO 1 — In-memory hub cache (per warm instance, TTL 5 min)
//
// Eliminates 6–7 parallel DB queries for back-to-back requests
// from the same user within the same Vercel function instance.
// invalidateHubCache(userId) must be called after any event that
// changes the user's data (workouts, labs, diet, weight, etc.).
// ─────────────────────────────────────────────────────────────

var _hubCache = new Map(); // userId → { hub, expiresAt }
var HUB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedHub(userId) {
  var entry = _hubCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _hubCache.delete(userId);
    return null;
  }
  return entry.hub;
}

function setCachedHub(userId, hub) {
  _hubCache.set(userId, { hub: hub, expiresAt: Date.now() + HUB_CACHE_TTL_MS });
}

/**
 * Invalidate the cached hub for a user.
 * Call this after any event that changes user data:
 *   workout_completed, diet_generated, lab_processed, weight_update, etc.
 */
function invalidateHubCache(userId) {
  if (userId) _hubCache.delete(userId);
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
  // Production uses public.profiles with canonical fields. Legacy/dev flows may
  // still write public.user_profiles. Query them separately so a missing
  // optional column never makes the whole profile disappear from KRONOS.
  var canonicalRows = await supabase(
    'GET',
    'profiles?id=eq.' + userId +
    '&select=id,full_name,birth_date,sex,height_cm,current_weight_kg,activity_level,objective,dietary_pattern,allergies,intolerances,disliked_foods,liked_foods,clinical_notes&limit=1',
    null
  ).catch(function () { return []; });

  var hormoneRows = await supabase(
    'GET',
    'profiles?id=eq.' + userId +
    '&select=uses_exogenous_hormones,hormone_context_type,declared_compounds,last_administration_at,monitoring_mode&limit=1',
    null
  ).catch(function () { return []; });

  var legacyRows = await supabase(
    'GET',
    'user_profiles?user_id=eq.' + userId +
    '&select=user_id,nome,objetivo,nivel,idade,sexo,peso_kg,altura_cm,rotina,preferencias,restricoes,lesoes,observacoes&limit=1',
    null
  ).catch(function () { return []; });

  var canonical = (canonicalRows && canonicalRows[0]) ? canonicalRows[0] : null;
  var hormone = (hormoneRows && hormoneRows[0]) ? hormoneRows[0] : null;
  var legacy = (legacyRows && legacyRows[0]) ? legacyRows[0] : null;
  if (!canonical && !hormone && !legacy) return null;
  return Object.assign({}, legacy || {}, canonical || {}, hormone || {});
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

async function loadLatestMealPlan(userId) {
  var rows = await supabase(
    'GET',
    'meal_plans?user_id=eq.' + userId +
    '&select=id,title,description,status,valid_from,valid_to,active,plan_data,context_snapshot,created_at,updated_at' +
    '&order=active.desc,updated_at.desc.nullslast,created_at.desc&limit=1',
    null
  ).catch(function () { return []; });
  return (rows && rows[0]) ? rows[0] : null;
}

async function loadMealPlanItems(mealPlanId) {
  if (!mealPlanId) return [];
  return supabase(
    'GET',
    'meal_plan_items?meal_plan_id=eq.' + mealPlanId +
    '&select=meal_name,time_hint,food_name,quantity,unit,calories,protein_g,carbs_g,fat_g,notes,sort_order' +
    '&order=sort_order.asc,created_at.asc&limit=500',
    null
  ).catch(function () { return []; });
}

async function loadTodayFoodLogs(userId) {
  var today = new Date().toISOString().slice(0, 10);
  return supabase(
    'GET',
    'user_food_logs?user_id=eq.' + userId +
    '&consumed_at=gte.' + today + 'T00:00:00.000Z' +
    '&select=consumed_at,meal_type,food_name,quantity,estimated_calories,estimated_protein_g,estimated_carbs_g,estimated_fat_g,source,notes' +
    '&order=consumed_at.asc&limit=200',
    null
  ).catch(function () { return []; });
}

async function loadLatestLabSummary(userId) {
  // RISCO 3 — include parse_status so mapLabs can distinguish
  // "valid but still processing" from "valid and fully interpreted".
  var rows = await supabase(
    'GET',
    'lab_reports?user_id=eq.' + userId +
    '&is_valid=eq.true' +
    '&select=id,created_at,processed_at,parse_status,clinical_flags,critical_flags,ai_insights,normalized_payload,confidence' +
    '&order=processed_at.desc.nullslast,created_at.desc&limit=1',
    null
  ).catch(function () { return []; });
  return (rows && rows[0]) ? rows[0] : null;
}

async function loadRecentWorkouts(userId) {
  return supabase(
    'GET',
    'workouts?user_id=eq.' + userId +
    '&select=id,date,duration_minutes,notes,created_at&order=date.desc.nullslast,created_at.desc&limit=14',
    null
  ).catch(function () { return []; });
}

async function loadWorkoutLogs(workoutIds) {
  if (!workoutIds || !workoutIds.length) return [];
  return supabase(
    'GET',
    'workout_logs?workout_id=in.(' + workoutIds.join(',') + ')' +
    '&select=workout_id,weight_kg,reps,rpe,exercise_id,created_at&limit=2000',
    null
  ).catch(function () { return []; });
}

async function loadExercises(exerciseIds) {
  if (!exerciseIds || !exerciseIds.length) return [];
  return supabase(
    'GET',
    'exercises?id=in.(' + exerciseIds.join(',') + ')&select=id,name,muscle_group&limit=1000',
    null
  ).catch(function () { return []; });
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

function round1(v) {
  var n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function nullableRound1(v) {
  var n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function parseGrams(quantity, unit) {
  var q = firstNum(quantity);
  if (q == null && typeof quantity === 'string') {
    var match = quantity.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
    if (match) q = Number(match[1]);
  }
  var u = String(unit || '').trim().toLowerCase();
  var rawQuantity = String(quantity || '').trim().toLowerCase();
  if (q == null) return null;
  if (!u && /kg/.test(rawQuantity)) return q * 1000;
  if (!u && /g|grama/.test(rawQuantity)) return q;
  if (!u || /^g(rama|ramas)?$/.test(u)) return q;
  if (/^kg$/.test(u)) return q * 1000;
  return null;
}

function groupByKey(items, keyFn) {
  var grouped = Object.create(null);
  (items || []).forEach(function (item) {
    var key = keyFn(item) || 'Sem refeição definida';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });
  return grouped;
}

function toStrArr(v) {
  if (Array.isArray(v)) return v.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  return [];
}

function uniqueArr(values) {
  var seen = Object.create(null);
  var out = [];
  (values || []).forEach(function (value) {
    var text = String(value || '').trim();
    var key = text.toLowerCase();
    if (!text || seen[key]) return;
    seen[key] = true;
    out.push(text);
  });
  return out;
}

function yearsFromBirthDate(value) {
  if (!value) return null;
  var birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  var now = new Date();
  var age = now.getUTCFullYear() - birth.getUTCFullYear();
  var beforeBirthday = now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function mapProfile(row) {
  if (!row) return null;
  var config = (row.config && typeof row.config === 'object' && !Array.isArray(row.config))
    ? row.config
    : {};

  // RISCO 2 — cover every alias variant seen across the codebase so a new
  // column name never silently drops a field.
  var goal = firstStr(
    row.objetivo, row.objective,
    config.objetivo, config.objective
  );
  var level = firstStr(
    row.nivel, row.level,
    config.nivel, config.level
  );
  var athleteLevel = null;
  if (level) {
    if (/iniciante|beginner/i.test(level)) athleteLevel = 'iniciante';
    else if (/avan[cç]ado|advanced/i.test(level)) athleteLevel = 'avancado';
    else if (/intermediar/i.test(level)) athleteLevel = 'intermediario';
  }

  return {
    name: firstStr(
      row.nome, row.full_name, row.name,
      config.nome, config.full_name, config.name
    ),
    age: firstNum(
      row.idade, row.age,
      config.idade, config.age,
      yearsFromBirthDate(row.birth_date)
    ),
    sex: firstStr(
      row.sexo, row.sex, row.gender,
      config.sexo, config.sex, config.gender
    ),
    // RISCO 2 — weight aliases: peso_kg, current_weight_kg, peso, weight,
    // weight_kg, pesoKg, weightKg (all from real codebase references)
    weightKg: firstNum(
      row.peso_kg, row.current_weight_kg, row.peso,
      row.weight, row.weight_kg, row.pesoKg, row.weightKg,
      config.peso_kg, config.current_weight_kg, config.peso,
      config.weight, config.pesoKg, config.weightKg
    ),
    // RISCO 2 — height aliases: altura_cm, height_cm, altura, height, alturaCm, heightCm
    heightCm: firstNum(
      row.altura_cm, row.height_cm, row.altura,
      row.height, row.alturaCm, row.heightCm,
      config.altura_cm, config.height_cm, config.altura,
      config.height, config.alturaCm, config.heightCm
    ),
    goal: goal,
    activityLevel: firstStr(
      row.activity_level, row.rotina, row.activityLevel,
      config.activity_level, config.rotina, config.activityLevel
    ),
    athleteLevel: athleteLevel,
    restrictions: uniqueArr([]
      .concat(toStrArr(row.restricoes || row.restrictions || config.restricoes || config.restrictions))
      .concat(toStrArr(row.allergies || config.allergies))
      .concat(toStrArr(row.intolerances || config.intolerances))),
    pathologies: toStrArr(
      row.patologias || row.pathologies || row.conditions || row.medical_conditions ||
      config.patologias || config.pathologies || config.conditions || config.medical_conditions
    ),
    medications: toStrArr(
      row.medicacoes || row.medicações || row.medicamentos || row.medications ||
      config.medicacoes || config.medicamentos || config.medications
    ),
    preferences: uniqueArr([]
      .concat(toStrArr(row.preferencias || row.preferences || config.preferencias || config.preferences))
      .concat(toStrArr(row.liked_foods || config.liked_foods))),
    injuries: toStrArr(row.lesoes || row.injuries || config.lesoes || config.injuries),
    observations: [
      firstStr(row.observacoes, row.notes, config.observacoes, config.notes),
      firstStr(row.clinical_notes, config.clinical_notes),
      firstStr(row.dietary_pattern, config.dietary_pattern)
    ].filter(Boolean),
    hormoneContext: {
      usesExogenousHormones: typeof row.uses_exogenous_hormones === 'boolean' ? row.uses_exogenous_hormones : null,
      type: firstStr(row.hormone_context_type, config.hormone_context_type) || null,
      declaredCompounds: toStrArr(row.declared_compounds || config.declared_compounds),
      lastAdministrationAt: firstStr(row.last_administration_at, config.last_administration_at) || null,
      monitoringMode: firstStr(row.monitoring_mode, config.monitoring_mode) || null
    }
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

function normalizeMealItem(row) {
  var nome = firstStr(row && row.food_name, row && row.nome, row && row.name);
  if (!nome) return null;
  return {
    nome: nome,
    gramas: parseGrams(row.quantity, row.unit),
    unidade: firstStr(row.unit) || null,
    quantidade: firstStr(row.quantity) || null,
    calorias: nullableRound1(row.calories),
    proteina: nullableRound1(row.protein_g),
    carboidrato: nullableRound1(row.carbs_g),
    gordura: nullableRound1(row.fat_g),
    observacoes: firstStr(row.notes) || null
  };
}

function sumMeal(items, field) {
  var sum = 0;
  var hasAny = false;
  (items || []).forEach(function (item) {
    var n = Number(item && item[field]);
    if (Number.isFinite(n)) {
      sum += n;
      hasAny = true;
    }
  });
  return hasAny ? round1(sum) : null;
}

function normalizeMealsFromItems(items) {
  var grouped = groupByKey(items || [], function (row) { return firstStr(row.meal_name); });
  return Object.keys(grouped).map(function (mealName) {
    var rows = grouped[mealName];
    var normalizedItems = rows.map(normalizeMealItem).filter(Boolean);
    return {
      nome: mealName,
      horario: firstStr(rows[0] && rows[0].time_hint) || null,
      calorias: sumMeal(normalizedItems, 'calorias'),
      proteina: sumMeal(normalizedItems, 'proteina'),
      carboidrato: sumMeal(normalizedItems, 'carboidrato'),
      gordura: sumMeal(normalizedItems, 'gordura'),
      itens: normalizedItems
    };
  });
}

function normalizeFoodLogItem(row) {
  var nome = firstStr(row && row.food_name);
  if (!nome) return null;
  return {
    nome: nome,
    gramas: parseGrams(row.quantity, null),
    unidade: null,
    quantidade: firstStr(row.quantity) || null,
    calorias: nullableRound1(row.estimated_calories),
    proteina: nullableRound1(row.estimated_protein_g),
    carboidrato: nullableRound1(row.estimated_carbs_g),
    gordura: nullableRound1(row.estimated_fat_g),
    observacoes: firstStr(row.notes) || null
  };
}

function normalizeTodayFoodLogs(rows) {
  var grouped = groupByKey(rows || [], function (row) { return firstStr(row.meal_type) || 'Consumo registrado'; });
  var meals = Object.keys(grouped).map(function (mealName) {
    var logs = grouped[mealName];
    var items = logs.map(normalizeFoodLogItem).filter(Boolean);
    return {
      nome: mealName,
      horario: firstStr(logs[0] && logs[0].consumed_at) || null,
      calorias: sumMeal(items, 'calorias'),
      proteina: sumMeal(items, 'proteina'),
      carboidrato: sumMeal(items, 'carboidrato'),
      gordura: sumMeal(items, 'gordura'),
      itens: items
    };
  });
  var flat = meals.reduce(function (acc, meal) { return acc.concat(meal.itens || []); }, []);
  return {
    refeicoes: meals,
    total: {
      calorias: sumMeal(flat, 'calorias'),
      proteina: sumMeal(flat, 'proteina'),
      carboidrato: sumMeal(flat, 'carboidrato'),
      gordura: sumMeal(flat, 'gordura')
    }
  };
}

function mapDetailedDiet(nutritionGoal, mealPlan, mealItems, todayFoodLogs) {
  var planMeals = normalizeMealsFromItems(mealItems || []);
  var today = normalizeTodayFoodLogs(todayFoodLogs || []);
  var hasPlan = !!mealPlan;
  var hasItems = planMeals.some(function (meal) { return meal.itens && meal.itens.length; });
  var hasTodayLogs = today.refeicoes.some(function (meal) { return meal.itens && meal.itens.length; });
  var observations = [];
  if (hasPlan && !hasItems) observations.push('Plano alimentar encontrado sem itens detalhados por alimento.');
  if (!hasPlan && nutritionGoal) observations.push('Metas nutricionais encontradas sem plano alimentar salvo.');
  if (hasTodayLogs) observations.push('Consumo de hoje foi agregado a partir de user_food_logs.');

  return {
    disponivel: !!(nutritionGoal || hasPlan || hasItems || hasTodayLogs),
    planoAtual: mealPlan ? {
      id: mealPlan.id || null,
      titulo: mealPlan.title || null,
      descricao: mealPlan.description || null,
      status: mealPlan.status || null,
      ativo: mealPlan.active !== false,
      validoDe: mealPlan.valid_from || null,
      validoAte: mealPlan.valid_to || null,
      atualizadoEm: mealPlan.updated_at || mealPlan.created_at || null,
      planData: mealPlan.plan_data || null,
      contextSnapshot: mealPlan.context_snapshot || null
    } : null,
    metaCalorica: nutritionGoal ? nullableRound1(nutritionGoal.calories_target) : null,
    metaMacros: {
      proteina: nutritionGoal ? nullableRound1(nutritionGoal.protein_g) : null,
      carboidrato: nutritionGoal ? nullableRound1(nutritionGoal.carbs_g) : null,
      gordura: nutritionGoal ? nullableRound1(nutritionGoal.fat_g) : null
    },
    totalConsumidoHoje: today.total,
    refeicoes: planMeals,
    refeicoesConsumidasHoje: today.refeicoes,
    observacoes: observations
  };
}

function safeStrArr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

// RISCO 3 — parse_status values seen in the codebase
var LAB_PROCESSING_STATUSES = new Set(['uploaded', 'processing', 'pending', 'pending_upload', 'queued']);
var LAB_FAILED_STATUSES = new Set(['failed', 'error']);

/**
 * Derive labsStatus from the row.
 *
 * 'ready'      — ai_insights present and has interpretable content
 * 'processing' — is_valid=true but parse_status indicates async job still running
 * 'partial'    — is_valid=true, parse_status looks done, but ai_insights is empty
 * 'failed'     — parse_status explicitly failed
 */
function deriveLabsStatus(labRow, ai) {
  var parseStatus = String(labRow.parse_status || '').toLowerCase();
  var hasAiInsights = !!(ai && (ai.contextual_summary || ai.clinical_flags || ai.health_profile || ai.summary));

  if (LAB_FAILED_STATUSES.has(parseStatus)) return 'failed';
  if (LAB_PROCESSING_STATUSES.has(parseStatus)) return 'processing';
  if (hasAiInsights) return 'ready';
  // is_valid=true but ai_insights empty — async interpretation pending
  return 'partial';
}

function firstPayloadDate(payload, labRow) {
  var extraction = payload && payload.extraction && typeof payload.extraction === 'object'
    ? payload.extraction
    : {};
  var metadata = extraction.metadata && typeof extraction.metadata === 'object'
    ? extraction.metadata
    : {};
  return firstStr(
    payload && payload.collection_date,
    payload && payload.collected_at,
    payload && payload.sample_collected_at,
    payload && payload.exam_date,
    payload && payload.report_date,
    metadata.collection_date,
    metadata.collected_at,
    metadata.sample_collected_at,
    metadata.exam_date,
    metadata.report_date,
    labRow && labRow.processed_at,
    labRow && labRow.created_at
  );
}

function mapLabs(labRow) {
  if (!labRow) return null;
  var ai = (labRow.ai_insights && typeof labRow.ai_insights === 'object') ? labRow.ai_insights : {};
  var payload = (labRow.normalized_payload && typeof labRow.normalized_payload === 'object') ? labRow.normalized_payload : {};

  // RISCO 3 — status-aware interpretation
  var labsStatus = deriveLabsStatus(labRow, ai);

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
    .filter(function (b) { return b && (b.marker_key || b.marker_name || b.name); })
    .sort(function (a, b) {
      var af = (a.flag === 'high' || a.flag === 'low') ? 0 : 1;
      var bf = (b.flag === 'high' || b.flag === 'low') ? 0 : 1;
      return af - bf;
    })
    .map(function (b) {
      var flag = (b.flag === 'low' || b.flag === 'high' || b.flag === 'normal') ? b.flag : null;
      var reference = firstStr(
        b.reference_range,
        b.reference_text,
        b.reference_text_raw,
        b.raw_reference_text,
        b.reference,
        b.ref,
        b.range,
        b.reference_min != null || b.reference_max != null ? [b.reference_min, b.reference_max].filter(function (x) { return x != null; }).join(' - ') : null,
        b.min != null || b.max != null ? [b.min, b.max].filter(function (x) { return x != null; }).join(' - ') : null
      );
      return {
        key: String(b.marker_key || ''),
        name: String(b.marker_name || b.name || b.marker_key || ''),
        value: b.value_numeric !== undefined && b.value_numeric !== null ? b.value_numeric : (b.value_text || null),
        unit: b.unit || null,
        reference: reference || null,
        flag: flag,
        observations: [b.feedback_summary, b.source_line].map(function (x) { return firstStr(x); }).filter(Boolean)
      };
    });

  var reportDate = firstPayloadDate(payload, labRow);

  return {
    labsStatus: labsStatus,          // RISCO 3 — explicit status
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

function mapTraining(memoryBlocks, recentWorkouts, workoutLogs, exercises) {
  var workouts = Array.isArray(recentWorkouts) ? recentWorkouts : [];
  var logs = Array.isArray(workoutLogs) ? workoutLogs : [];
  var exerciseRows = Array.isArray(exercises) ? exercises : [];
  if (!memoryBlocks && !workouts.length) return null;

  var exerciseById = Object.create(null);
  exerciseRows.forEach(function (ex) {
    if (ex && ex.id) exerciseById[ex.id] = ex;
  });

  var logsByWorkout = Object.create(null);
  logs.forEach(function (log) {
    if (!log || !log.workout_id) return;
    if (!logsByWorkout[log.workout_id]) logsByWorkout[log.workout_id] = [];
    logsByWorkout[log.workout_id].push(log);
  });

  function mapWorkout(row) {
    var workoutLogsForRow = logsByWorkout[row.id] || [];
    var exercicios = workoutLogsForRow.map(function (log) {
      var ex = exerciseById[log.exercise_id] || {};
      return {
        nome: firstStr(ex.name, log.exercise_name) || 'Exercício registrado',
        grupoMuscular: firstStr(ex.muscle_group) || null,
        series: 1,
        repeticoes: firstNum(log.reps),
        carga: firstNum(log.weight_kg),
        rpe: firstNum(log.rpe),
        realizadoEm: log.created_at || null
      };
    });
    var volume = workoutLogsForRow.reduce(function (sum, log) {
      return sum + ((Number(log.weight_kg) || 0) * (Number(log.reps) || 0));
    }, 0);
    return {
      id: row.id || null,
      data: row.date || row.created_at || null,
      duracaoMinutos: firstNum(row.duration_minutes),
      observacoes: firstStr(row.notes) || null,
      exercicios: exercicios,
      volume: round1(volume)
    };
  }

  var blocks = memoryBlocks || {};
  var perf = blocks.performance_trend || {};
  var adherence = blocks.adherence_state || {};
  var recovery = blocks.recovery_state || {};
  var fatigue = blocks.fatigue_state || {};
  var tolerance = blocks.training_tolerance_state || {};
  var alignment = blocks.objective_alignment_state || {};

  var historico = workouts.map(mapWorkout);
  var lastWorkoutRow = workouts[0] || null;
  var lastWorkoutAt = lastWorkoutRow ? firstStr(lastWorkoutRow.date, lastWorkoutRow.created_at) : null;

  var weeklyFreq = null;
  if (adherence.sourceSignals && adherence.sourceSignals.weeklyFrequencyEstimate != null) {
    weeklyFreq = Number(adherence.sourceSignals.weeklyFrequencyEstimate) || null;
  }

  var sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  var weeklyVolume = historico.reduce(function (sum, workout) {
    var date = new Date(workout.data || 0);
    if (Number.isNaN(date.getTime()) || date.getTime() < sevenDaysAgo) return sum;
    return sum + (Number(workout.volume) || 0);
  }, 0);
  var flatExercises = historico.reduce(function (acc, workout) {
    return acc.concat(workout.exercicios || []);
  }, []);

  return {
    disponivel: !!(historico.length || memoryBlocks),
    treinoAtual: historico[0] || null,
    ultimoTreino: historico[0] || null,
    historicoRecente: historico,
    exercicios: flatExercises.slice(0, 80),
    series: flatExercises.length,
    repeticoes: flatExercises.reduce(function (sum, ex) { return sum + (Number(ex.repeticoes) || 0); }, 0),
    cargas: flatExercises.map(function (ex) { return ex.carga; }).filter(function (v) { return v != null; }),
    volumeSemanal: round1(weeklyVolume),
    aderencia: adherence.status || null,
    observacoes: [],
    lastWorkoutAt: lastWorkoutAt,
    weeklyFrequency: weeklyFreq,
    performanceTrend: perf.status || null,
    adherenceStatus: adherence.status || null,
    recoveryStatus: recovery.status || null,
    fatigueStatus: fatigue.status || null,
    trainingTolerance: tolerance.status || null,
    objectiveAlignment: alignment.status || null,
    topExercises: flatExercises.slice(0, 10)
  };
}

function buildUserContext(profile) {
  return {
    nome: profile && profile.name || null,
    idade: profile && profile.age || null,
    sexo: profile && profile.sex || null,
    peso: profile && profile.weightKg || null,
    altura: profile && profile.heightCm || null,
    objetivo: profile && profile.goal || null,
    nivel: profile && profile.athleteLevel || null,
    observacoes: []
      .concat(profile && profile.activityLevel ? [profile.activityLevel] : [])
      .concat(profile && profile.observations ? profile.observations : [])
  };
}

function buildLabsContext(labs) {
  if (!labs) {
    return {
      disponivel: false,
      dataUltimaColeta: null,
      biomarcadores: [],
      alteracoesImportantes: [],
      observacoes: []
    };
  }
  var statusMap = { low: 'baixo', normal: 'normal', high: 'alto' };
  return {
    disponivel: labs.labsStatus !== 'failed',
    dataUltimaColeta: labs.lastReportAt || null,
    biomarcadores: (labs.keyMarkers || []).map(function (marker) {
      return {
        nome: marker.name || marker.key || '',
        valor: marker.value != null ? marker.value : null,
        unidade: marker.unit || null,
        referencia: marker.reference || null,
        status: statusMap[marker.flag] || 'indeterminado',
        observacoes: marker.observations || []
      };
    }).filter(function (marker) { return marker.nome; }),
    alteracoesImportantes: []
      .concat(labs.criticalFlags || [])
      .concat(labs.clinicalFlags || [])
      .concat((labs.keyMarkers || []).filter(function (m) { return m.flag === 'high' || m.flag === 'low'; }).map(function (m) { return m.name + ': ' + m.flag; })),
    observacoes: [labs.summaryText, labs.readinessSignal, labs.hormonalSignal, labs.metabolicSignal].filter(Boolean)
  };
}

function extractDietClinicalContext(diet) {
  var plan = diet && diet.planoAtual ? diet.planoAtual : {};
  var snapshots = [
    plan.contextSnapshot,
    plan.planData,
    plan.contextSnapshot && plan.contextSnapshot.healthContext,
    plan.planData && plan.planData.healthContext,
    plan.contextSnapshot && plan.contextSnapshot.profile,
    plan.planData && plan.planData.profile
  ].filter(function (item) { return item && typeof item === 'object'; });

  return snapshots.reduce(function (acc, item) {
    acc.pathologies = acc.pathologies.concat(toStrArr(item.patologias || item.patologia || item.pathologies || item.conditions));
    acc.medications = acc.medications.concat(toStrArr(item.medicacoes || item.medicamentos || item.medications));
    acc.preferences = acc.preferences.concat(toStrArr(item.preferencias || item.preferences || item.liked_foods));
    acc.observations = acc.observations.concat(toStrArr(item.observacoes || item.observations || item.notes));
    return acc;
  }, { pathologies: [], medications: [], preferences: [], observations: [] });
}

function buildClinicalContext(profile, labs, diet) {
  var dietClinical = extractDietClinicalContext(diet);
  return {
    patologias: uniqueArr([]
      .concat(profile && profile.pathologies ? profile.pathologies : [])
      .concat(dietClinical.pathologies)),
    restricoes: profile && profile.restrictions ? profile.restrictions : [],
    medicacoes: uniqueArr([]
      .concat(profile && profile.medications ? profile.medications : [])
      .concat(dietClinical.medications)),
    sinais: labs ? []
      .concat(labs.clinicalFlags || [])
      .concat(labs.criticalFlags || [])
      .filter(Boolean) : [],
    preferencias: uniqueArr([]
      .concat(profile && profile.preferences ? profile.preferences : [])
      .concat(dietClinical.preferences)),
    lesoes: profile && profile.injuries ? profile.injuries : [],
    hormonios: profile && profile.hormoneContext ? profile.hormoneContext : null,
    observacoes: []
      .concat(profile && profile.activityLevel ? [profile.activityLevel] : [])
      .concat(profile && profile.observations ? profile.observations : [])
      .concat(dietClinical.observations)
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

function buildMissingData(inventory, profile, training, nutrition, labs, diet) {
  var missing = [];
  if (!inventory.hasProfile || !profile) missing.push('perfil do usuário');
  else {
    if (!profile.age) missing.push('idade');
    if (!profile.sex) missing.push('sexo');
    if (!profile.weightKg) missing.push('peso');
    if (!profile.goal) missing.push('objetivo');
  }
  if (!inventory.hasTrainingHistory || !training) missing.push('histórico de treino');
  if (!inventory.hasNutritionPlan || (!nutrition && !(diet && diet.disponivel))) missing.push('plano nutricional');
  // RISCO 3 — labs processing/partial means the report EXISTS; don't flag as missing.
  // Only flag as missing when the inventory says no valid report exists at all.
  if (!inventory.hasLabReports || !labs) {
    missing.push('exames laboratoriais');
  } else if (labs.labsStatus === 'processing' || labs.labsStatus === 'partial') {
    missing.push('interpretação de exames em andamento');
  }
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
 * RISCO 1 — Results are cached per userId for HUB_CACHE_TTL_MS (5 min).
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
      profile: null, training: null, nutrition: null, diet: null, labs: null,
      progress: null, memory: null, science: null,
      missingData: ['userId ausente'],
      generatedAt: new Date().toISOString(),
      user: buildUserContext(null),
      treino: {
        disponivel: false,
        treinoAtual: null,
        ultimoTreino: null,
        historicoRecente: [],
        exercicios: [],
        series: null,
        repeticoes: null,
        cargas: [],
        volumeSemanal: null,
        aderencia: null,
        observacoes: []
      },
      dieta: {
        disponivel: false,
        planoAtual: null,
        metaCalorica: null,
        metaMacros: { proteina: null, carboidrato: null, gordura: null },
        totalConsumidoHoje: { calorias: null, proteina: null, carboidrato: null, gordura: null },
        refeicoes: [],
        refeicoesConsumidasHoje: [],
        observacoes: []
      },
      exames: buildLabsContext(null),
      contextoClinico: buildClinicalContext(null, null, null)
    };
  }

  // RISCO 1 — serve from cache when available
  var cached = getCachedHub(userId);
  if (cached) return cached;

  // 1. Inventory + all data loaders in parallel
  var settled = await Promise.allSettled([
    buildKronosInventory(userId),               // 0
    loadProfile(userId),                        // 1
    loadNutritionGoal(userId),                  // 2
    loadLatestLabSummary(userId),               // 3
    loadRecentWorkouts(userId),                 // 4
    userMemory.getCoachingSummary(userId),       // 5
    loadLatestMealPlan(userId),                 // 6
    loadTodayFoodLogs(userId)                   // 7
  ]);

  function get(idx) {
    return settled[idx].status === 'fulfilled' ? settled[idx].value : null;
  }

  var inventory = get(0) || {};
  var profileRow = get(1);
  var nutritionGoalRow = get(2);
  var labRow = get(3);
  var recentWorkoutRows = get(4) || [];
  var memorySummary = get(5);
  var mealPlanRow = get(6);
  var todayFoodLogRows = get(7) || [];

  var mealItemRows = await loadMealPlanItems(mealPlanRow && mealPlanRow.id);
  var workoutIds = (recentWorkoutRows || []).map(function (w) { return w && w.id; }).filter(Boolean);
  var workoutLogRows = await loadWorkoutLogs(workoutIds);
  var exerciseIds = (workoutLogRows || []).map(function (log) { return log && log.exercise_id; }).filter(Boolean);
  var seenExerciseIds = Object.create(null);
  exerciseIds = exerciseIds.filter(function (id) {
    if (!id || seenExerciseIds[id]) return false;
    seenExerciseIds[id] = true;
    return true;
  });
  var exerciseRows = await loadExercises(exerciseIds);

  // 2. Map to clean domain slices
  var profileSlice = mapProfile(profileRow);
  var nutritionSlice = mapNutrition(nutritionGoalRow, profileRow);
  var detailedDietSlice = mapDetailedDiet(nutritionGoalRow, mealPlanRow, mealItemRows, todayFoodLogRows);
  var labsSlice = mapLabs(labRow);

  // Enrich nutrition with clinical flags from labs if available
  if (nutritionSlice && labsSlice) {
    nutritionSlice.clinicalFlags = labsSlice.clinicalFlags.slice(0, 3);
    nutritionSlice.criticalFlags = labsSlice.criticalFlags.slice(0, 2);
  }

  // Memory blocks → training slice
  var memoryBlocks = (memorySummary && memorySummary.blocks) ? memorySummary.blocks : null;
  var trainingSlice = mapTraining(memoryBlocks, recentWorkoutRows, workoutLogRows, exerciseRows);
  var progressSlice = mapProgress(memorySummary);
  var memorySlice = mapMemory(memorySummary);

  // Enrich nutrition status from memory blocks
  if (nutritionSlice && memoryBlocks && memoryBlocks.nutrition_state) {
    nutritionSlice.nutritionStatus = memoryBlocks.nutrition_state.status || null;
  }

  // Update inventory flags we can now confirm
  inventory.hasWorkoutPlan = !!(trainingSlice && trainingSlice.lastWorkoutAt);
  inventory.hasNutritionPlan = !!(detailedDietSlice && detailedDietSlice.disponivel);
  inventory.hasMemoryState = !!(memoryBlocks);

  var missingData = buildMissingData(inventory, profileSlice, trainingSlice, nutritionSlice, labsSlice, detailedDietSlice);

  var hub = {
    generatedAt: new Date().toISOString(),
    inventory: inventory,
    profile: profileSlice,
    training: trainingSlice,
    nutrition: nutritionSlice,
    diet: detailedDietSlice,
    labs: labsSlice,
    progress: progressSlice,
    memory: memorySlice,
    science: null, // populated on-demand by scienceInsightService
    missingData: missingData,
    user: buildUserContext(profileSlice),
    treino: trainingSlice || {
      disponivel: false,
      treinoAtual: null,
      ultimoTreino: null,
      historicoRecente: [],
      exercicios: [],
      series: null,
      repeticoes: null,
      cargas: [],
      volumeSemanal: null,
      aderencia: null,
      observacoes: []
    },
    dieta: detailedDietSlice,
    exames: buildLabsContext(labsSlice),
    contextoClinico: buildClinicalContext(profileSlice, labsSlice, detailedDietSlice)
  };

  // RISCO 1 — only cache successful, non-empty hubs
  if (inventory.hasProfile || inventory.hasTrainingHistory || inventory.hasLabReports) {
    setCachedHub(userId, hub);
  }

  return hub;
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
      selected.exames = hub.exames;
      selected.profile = hub.profile; // for clinical context
      selected.user = hub.user;
      selected.contextoClinico = hub.contextoClinico;
      // Nutrition only if labs have metabolic/clinical flags
      if (hub.labs && (hub.labs.clinicalFlags.length || hub.labs.criticalFlags.length)) {
        selected.nutrition = hub.nutrition;
        selected.diet = hub.diet;
        selected.dieta = hub.dieta;
      }
      break;

    case KRONOS_INTENT.WORKOUT_PLANNING:
    case KRONOS_INTENT.WORKOUT_FEEDBACK:
      selected.profile = hub.profile;
      selected.training = hub.training;
      selected.treino = hub.treino;
      selected.user = hub.user;
      selected.memory = hub.memory;
      selected.progress = hub.progress;
      // Labs only if training readiness signal exists
      if (hub.labs && hub.labs.readinessSignal && hub.labs.readinessSignal !== 'ok') {
        selected.labs = hub.labs;
        selected.exames = hub.exames;
      }
      break;

    case KRONOS_INTENT.NUTRITION_PLANNING:
    case KRONOS_INTENT.NUTRITION_FEEDBACK:
      selected.profile = hub.profile;
      selected.nutrition = hub.nutrition;
      selected.diet = hub.diet;
      selected.dieta = hub.dieta;
      selected.user = hub.user;
      // Labs if there are clinical/metabolic flags relevant to diet
      if (hub.labs && (hub.labs.metabolicSignal || hub.labs.clinicalFlags.length)) {
        selected.labs = hub.labs;
        selected.exames = hub.exames;
      }
      break;

    case KRONOS_INTENT.RECOVERY_ANALYSIS:
      selected.profile = hub.profile;
      selected.training = hub.training;
      selected.treino = hub.treino;
      selected.user = hub.user;
      selected.memory = hub.memory;
      // Labs if recovery signal is not ok
      if (hub.labs && hub.labs.readinessSignal) {
        selected.labs = hub.labs;
        selected.exames = hub.exames;
      }
      break;

    case KRONOS_INTENT.SUPPLEMENT_GUIDANCE:
      selected.profile = hub.profile;
      selected.training = hub.training;
      selected.treino = hub.treino;
      selected.user = hub.user;
      if (hub.labs && hub.labs.keyMarkers.length) {
        selected.labs = hub.labs; // labs calibrate supplement decisions
        selected.exames = hub.exames;
      }
      break;

    case KRONOS_INTENT.PROGRESS_REVIEW:
    case KRONOS_INTENT.MIXED_CONTEXT:
      // Full context for progress/mixed
      selected.profile = hub.profile;
      selected.training = hub.training;
      selected.nutrition = hub.nutrition;
      selected.user = hub.user;
      selected.treino = hub.treino;
      selected.diet = hub.diet;
      selected.dieta = hub.dieta;
      selected.contextoClinico = hub.contextoClinico;
      selected.memory = hub.memory;
      selected.progress = hub.progress;
      if (hub.labs) {
        selected.labs = hub.labs;
        selected.exames = hub.exames;
      }
      break;

    default: // FALLBACK
      selected.profile = hub.profile;
      selected.user = hub.user;
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
    if (Array.isArray(t.exercicios) && t.exercicios.length) {
      lines.push('[TREINO EXERCÍCIOS] ' + t.exercicios.slice(0, 16).map(function (ex) {
        var parts = [ex.nome];
        if (ex.repeticoes != null) parts.push(String(ex.repeticoes) + ' reps');
        if (ex.carga != null) parts.push(String(ex.carga) + ' kg');
        if (ex.rpe != null) parts.push('RPE ' + ex.rpe);
        return parts.join(' ');
      }).join('; '));
    }
    if (Array.isArray(t.historicoRecente) && t.historicoRecente.length) {
      lines.push('[TREINO HISTÓRICO RECENTE] ' + t.historicoRecente.slice(0, 5).map(function (w) {
        return (w.data ? String(w.data).slice(0, 10) : 'sem data') + ': ' + ((w.exercicios || []).length) + ' exercícios, volume ' + (w.volume || 0);
      }).join(' | '));
    }
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

  var d = selected.diet || selected.dieta;
  if (d && d.disponivel) {
    var dParts = [];
    if (d.planoAtual && d.planoAtual.titulo) dParts.push('plano: ' + d.planoAtual.titulo);
    if (d.metaCalorica != null) dParts.push('meta: ' + d.metaCalorica + ' kcal');
    if (d.metaMacros) {
      if (d.metaMacros.proteina != null) dParts.push('proteína meta: ' + d.metaMacros.proteina + 'g');
      if (d.metaMacros.carboidrato != null) dParts.push('carbo meta: ' + d.metaMacros.carboidrato + 'g');
      if (d.metaMacros.gordura != null) dParts.push('gordura meta: ' + d.metaMacros.gordura + 'g');
    }
    if (d.totalConsumidoHoje) {
      var total = d.totalConsumidoHoje;
      var totalParts = [];
      if (total.calorias != null) totalParts.push(total.calorias + ' kcal');
      if (total.proteina != null) totalParts.push(total.proteina + 'g proteína');
      if (total.carboidrato != null) totalParts.push(total.carboidrato + 'g carbo');
      if (total.gordura != null) totalParts.push(total.gordura + 'g gordura');
      if (totalParts.length) dParts.push('consumido hoje: ' + totalParts.join(', '));
    }
    if (dParts.length) lines.push('[DIETA DETALHADA] ' + dParts.join(' | '));

    var meals = Array.isArray(d.refeicoes) && d.refeicoes.length ? d.refeicoes : d.refeicoesConsumidasHoje;
    if (Array.isArray(meals) && meals.length) {
      meals.slice(0, 8).forEach(function (meal) {
        var mealParts = [];
        if (meal.horario) mealParts.push('horário ' + String(meal.horario).slice(0, 16));
        if (meal.calorias != null) mealParts.push(meal.calorias + ' kcal');
        if (meal.proteina != null) mealParts.push(meal.proteina + 'g proteína');
        if (meal.carboidrato != null) mealParts.push(meal.carboidrato + 'g carbo');
        if (meal.gordura != null) mealParts.push(meal.gordura + 'g gordura');
        lines.push('[DIETA REFEIÇÃO] ' + meal.nome + (mealParts.length ? ' | ' + mealParts.join(' | ') : ''));
        if (Array.isArray(meal.itens) && meal.itens.length) {
          lines.push('[DIETA ITENS ' + meal.nome + '] ' + meal.itens.slice(0, 12).map(function (item) {
            var parts = [item.nome];
            if (item.gramas != null) parts.push(item.gramas + 'g');
            else if (item.quantidade) parts.push(String(item.quantidade) + (item.unidade ? ' ' + item.unidade : ''));
            if (item.calorias != null) parts.push(item.calorias + ' kcal');
            if (item.proteina != null) parts.push(item.proteina + 'P');
            if (item.carboidrato != null) parts.push(item.carboidrato + 'C');
            if (item.gordura != null) parts.push(item.gordura + 'G');
            return parts.join(' ');
          }).join('; '));
        }
      });
    }
  }

  // ── Labs (RISCO 3 — status-aware rendering)
  var l = selected.labs;
  if (l) {
    if (l.lastReportAt) lines.push('[EXAMES] Último resultado: ' + l.lastReportAt.slice(0, 10));

    // RISCO 3 — inform KRONOS of the processing state so it doesn't pretend
    // to have full data when ai_insights is still being computed.
    if (l.labsStatus === 'processing') {
      lines.push('[EXAMES STATUS] Processamento em andamento — interpretação ainda não disponível. Informe o usuário que o resultado estará pronto em instantes, sem inventar valores.');
    } else if (l.labsStatus === 'partial') {
      lines.push('[EXAMES STATUS] Exame registrado mas interpretação automática incompleta — use apenas os dados presentes abaixo, não invente valores ausentes.');
    } else if (l.labsStatus === 'failed') {
      lines.push('[EXAMES STATUS] Falha no processamento do exame — não usar dados de labs para esta resposta.');
    }

    // Only render detailed content when ready or partial (some data may exist)
    if (l.labsStatus !== 'processing' && l.labsStatus !== 'failed') {
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
        lines.push('[EXAMES BIOMARCADORES] ' + l.keyMarkers.slice(0, 24).map(function (k) {
          return k.name + ' ' + k.value + (k.unit ? ' ' + k.unit : '') + (k.reference ? ' ref ' + k.reference : '') + (k.flag ? ' (' + k.flag + ')' : '');
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

async function buildKronosContext(options) {
  var input = options && typeof options === 'object' ? options : {};
  var hub = await buildKronosContextHub(input.userId || input.user_id || input.id, input.message || input.queryText || input.query);
  var context = {
    generatedAt: hub.generatedAt || new Date().toISOString(),
    user: hub.user || buildUserContext(hub.profile),
    treino: hub.treino || {
      disponivel: false,
      treinoAtual: null,
      ultimoTreino: null,
      historicoRecente: [],
      exercicios: [],
      series: null,
      repeticoes: null,
      cargas: [],
      volumeSemanal: null,
      aderencia: null,
      observacoes: []
    },
    dieta: hub.dieta || hub.diet || {
      disponivel: false,
      planoAtual: null,
      metaCalorica: null,
      metaMacros: { proteina: null, carboidrato: null, gordura: null },
      totalConsumidoHoje: { calorias: null, proteina: null, carboidrato: null, gordura: null },
      refeicoes: [],
      refeicoesConsumidasHoje: [],
      observacoes: []
    },
    exames: hub.exames || buildLabsContext(hub.labs),
    contextoClinico: hub.contextoClinico || buildClinicalContext(hub.profile, hub.labs, hub.dieta || hub.diet),
    inventory: hub.inventory || {},
    missingData: hub.missingData || [],
    legacy: {
      profile: hub.profile,
      training: hub.training,
      nutrition: hub.nutrition,
      labs: hub.labs,
      progress: hub.progress,
      memory: hub.memory
    }
  };

  if (process.env.KRONOS_CONTEXT_DEBUG === '1') {
    console.debug('[kronos.context]', JSON.stringify({
      userId: input.userId || input.user_id || input.id || null,
      treinoDisponivel: !!(context.treino && context.treino.disponivel),
      dietaDisponivel: !!(context.dieta && context.dieta.disponivel),
      examesDisponivel: !!(context.exames && context.exames.disponivel),
      refeicoes: context.dieta && Array.isArray(context.dieta.refeicoes) ? context.dieta.refeicoes.length : 0,
      alimentos: context.dieta && Array.isArray(context.dieta.refeicoes)
        ? context.dieta.refeicoes.reduce(function (sum, meal) { return sum + ((meal.itens || []).length); }, 0)
        : 0,
      biomarcadores: context.exames && Array.isArray(context.exames.biomarcadores) ? context.exames.biomarcadores.length : 0
    }));
  }

  return context;
}

// ─────────────────────────────────────────────────────────────
// H. EXPORTS
// ─────────────────────────────────────────────────────────────

module.exports = {
  buildKronosInventory: buildKronosInventory,
  buildKronosContextHub: buildKronosContextHub,
  buildKronosContext: buildKronosContext,
  deriveKronosIntent: deriveKronosIntent,
  selectContextForIntent: selectContextForIntent,
  formatContextForPrompt: formatContextForPrompt,
  invalidateHubCache: invalidateHubCache,  // RISCO 1
  KRONOS_INTENT: KRONOS_INTENT
};
