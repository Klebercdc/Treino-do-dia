'use strict';

async function safeQuery(label, fn, fallback) {
  try { return await fn(); } catch (e) {
    console.warn('[KRONOS_CONTEXT] ' + label + ' unavailable:', e && e.message);
    return fallback;
  }
}

async function buildKronosWorkoutContext(adminClient, userId) {
  if (!adminClient || !userId) return _emptyContext();

  const [pR, dR, lR, fR, hR, prR, alR, adR] = await Promise.allSettled([
    safeQuery('profile',       () => _fetchProfile(adminClient, userId),  null),
    safeQuery('diet',          () => _fetchDiet(adminClient, userId),      null),
    safeQuery('labs',          () => _fetchLabs(adminClient, userId),      null),
    safeQuery('fatigue',       () => _fetchFatigue(adminClient, userId),   null),
    safeQuery('history',       () => _fetchHistory(adminClient, userId),   []),
    safeQuery('protocol',      () => _fetchProtocol(adminClient, userId),  null),
    safeQuery('alerts',        () => _fetchAlerts(adminClient, userId),    []),
    safeQuery('adaptations',   () => _fetchAdaptations(adminClient, userId), []),
  ]);

  function val(r)  { return r.status === 'fulfilled' ? r.value : null; }
  function arr(r)  { return r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []; }

  const profileRaw     = val(pR);
  const nutritionProfile = profileRaw ? profileRaw._np : null;
  const profile        = profileRaw ? (function(p) { var c = Object.assign({}, p); delete c._np; return c; })(profileRaw) : null;
  const diet           = val(dR);
  const labs           = val(lR);
  const fatigue        = val(fR);
  const workoutHistory = arr(hR);
  const currentProtocol = val(prR);
  const alerts         = arr(alR);
  const adaptationEvents = arr(adR);

  const available = {
    profile:          !!(profile),
    nutritionProfile: !!(nutritionProfile),
    diet:             !!(diet),
    labs:             !!(labs && labs.biomarkers && labs.biomarkers.length > 0),
    fatigue:          !!(fatigue),
    workoutHistory:   workoutHistory.length > 0,
    currentProtocol:  !!(currentProtocol),
    exercises:        false,
    alerts:           alerts.length > 0,
    adaptationEvents: adaptationEvents.length > 0,
  };

  const readiness           = deriveKronosReadiness({ fatigue, labs });
  const personalizationLevel = detectWorkoutPersonalizationLevel({ available, diet, labs, fatigue, workoutHistory, currentProtocol });
  const { overloadedMuscleGroups, neglectedMuscleGroups } = _analyzeHistory(workoutHistory);
  const safetyFlags = _buildSafetyFlags(labs);

  const missingAdvancedData = [];
  if (!available.diet) missingAdvancedData.push('dieta');
  if (!available.labs) missingAdvancedData.push('exames');
  if (!available.fatigue) missingAdvancedData.push('fadiga');
  if (!available.workoutHistory) missingAdvancedData.push('histórico de treino');

  return {
    available, profile, nutritionProfile, diet, labs, fatigue,
    workoutHistory, currentProtocol, exercises: {}, alerts, adaptationEvents,
    readiness, personalizationLevel, detectedWeakPoints: [],
    overloadedMuscleGroups, neglectedMuscleGroups, missingAdvancedData, safetyFlags,
  };
}

async function _fetchProfile(adminClient, userId) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('config, uses_exogenous_hormones, hormone_context_type, monitoring_mode, declared_compounds')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;

  const { data: np } = await adminClient
    .from('nutrition_profiles')
    .select('sexo, idade, peso_kg, altura_cm, objetivo, nivel_atividade, restricoes_alimentares, condicoes_saude, medicamentos_continuos, observacoes, anamnese_completa')
    .eq('user_id', userId)
    .maybeSingle();

  return Object.assign({}, data, { _np: np || null });
}

async function _fetchDiet(adminClient, userId) {
  const { data: plan, error } = await adminClient
    .from('meal_plans')
    .select('id, title, plan_data, context_snapshot, updated_at')
    .eq('user_id', userId)
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !plan) return null;

  const { data: items } = await adminClient
    .from('meal_plan_items')
    .select('calories, protein_g, carbs_g, fat_g, meal_name')
    .eq('meal_plan_id', plan.id);

  const si = Array.isArray(items) ? items : [];
  return {
    id: plan.id, title: plan.title,
    total_calorias:  si.reduce(function(s, i) { return s + (Number(i.calories)  || 0); }, 0),
    total_proteina:  si.reduce(function(s, i) { return s + (Number(i.protein_g) || 0); }, 0),
    total_carbo:     si.reduce(function(s, i) { return s + (Number(i.carbs_g)   || 0); }, 0),
    total_gordura:   si.reduce(function(s, i) { return s + (Number(i.fat_g)     || 0); }, 0),
    num_refeicoes:   new Set(si.map(function(i) { return i.meal_name; }).filter(Boolean)).size,
    plan_data: plan.plan_data, context_snapshot: plan.context_snapshot,
  };
}

async function _fetchLabs(adminClient, userId) {
  const { data: reports } = await adminClient
    .from('lab_reports')
    .select('id')
    .eq('user_id', userId)
    .in('canonical_status', ['released_to_patient', 'analyzed', 'extracted'])
    .order('created_at', { ascending: false })
    .limit(5);
  if (!reports || !reports.length) return null;

  const ids = reports.map(function(r) { return r.id; });
  const { data: bio } = await adminClient
    .from('lab_report_biomarkers')
    .select('marker_key, marker_name, value_numeric, unit, reference_min, reference_max, flag, context_flag, safety_relevance')
    .in('lab_report_id', ids)
    .not('value_numeric', 'is', null)
    .limit(60);
  if (!bio || !bio.length) return null;

  const safetyFlags = bio
    .filter(function(b) { return b.safety_relevance && b.flag && b.flag !== 'normal' && b.flag !== 'normal_range'; })
    .map(function(b) { return b.marker_name || b.marker_key; });

  return { biomarkers: bio, safetyFlags: safetyFlags, hasCriticalFlags: safetyFlags.length > 0 };
}

async function _fetchFatigue(adminClient, userId) {
  const { data } = await adminClient
    .from('fadiga_scores')
    .select('score, notas, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);
  if (!data || !data.length) return null;
  const latest = data[0];
  return {
    score: Number(latest.score), notas: latest.notas, created_at: latest.created_at,
    isRecent: (Date.now() - new Date(latest.created_at).getTime()) < 86400000,
  };
}

async function _fetchHistory(adminClient, userId) {
  const { data } = await adminClient
    .from('workout_history')
    .select('session_data, trained_at')
    .eq('user_id', userId)
    .order('trained_at', { ascending: false })
    .limit(10);
  return Array.isArray(data) ? data : [];
}

async function _fetchProtocol(adminClient, userId) {
  const { data } = await adminClient
    .from('workout_templates')
    .select('templates, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function _fetchAlerts(adminClient, userId) {
  const { data } = await adminClient
    .from('alertas_kronos')
    .select('tipo, mensagem, created_at')
    .eq('user_id', userId)
    .eq('lido', false)
    .order('created_at', { ascending: false })
    .limit(5);
  return Array.isArray(data) ? data : [];
}

async function _fetchAdaptations(adminClient, userId) {
  const { data } = await adminClient
    .from('adaptation_events')
    .select('adaptation_type, load_state, reasoning, status, created_at')
    .eq('user_id', userId)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(3);
  return Array.isArray(data) ? data : [];
}

function _analyzeHistory(workoutHistory) {
  const overloadedMuscleGroups = [];
  const neglectedMuscleGroups = [];
  if (!workoutHistory || !workoutHistory.length) return { overloadedMuscleGroups, neglectedMuscleGroups };
  const now = Date.now();
  const h48 = 172800000;
  const d5  = 432000000;
  const lastTrained = {};
  workoutHistory.forEach(function(s) {
    const t = s.trained_at ? new Date(s.trained_at).getTime() : 0;
    const grupos = Array.isArray(s.session_data && s.session_data.grupos) ? s.session_data.grupos : [];
    grupos.forEach(function(g) {
      const n = String(g.nome || g.group || '').toLowerCase();
      if (n && (!lastTrained[n] || lastTrained[n] < t)) lastTrained[n] = t;
    });
  });
  Object.keys(lastTrained).forEach(function(g) {
    if (now - lastTrained[g] < h48) overloadedMuscleGroups.push(g);
    else if (now - lastTrained[g] > d5) neglectedMuscleGroups.push(g);
  });
  return { overloadedMuscleGroups, neglectedMuscleGroups };
}

function _buildSafetyFlags(labs) {
  if (!labs || !labs.biomarkers) return [];
  return labs.biomarkers
    .filter(function(b) { return b.safety_relevance && b.flag && b.flag !== 'normal' && b.flag !== 'normal_range'; })
    .map(function(b) { return { marker: b.marker_name || b.marker_key, flag: b.flag, contextFlag: b.context_flag }; });
}

function _emptyContext() {
  return {
    available: { profile: false, nutritionProfile: false, diet: false, labs: false, fatigue: false, workoutHistory: false, currentProtocol: false, exercises: false, alerts: false, adaptationEvents: false },
    profile: null, nutritionProfile: null, diet: null, labs: null, fatigue: null,
    workoutHistory: [], currentProtocol: null, exercises: {}, alerts: [], adaptationEvents: [],
    readiness: { score: null, level: 'desconhecida', reasons: [] },
    personalizationLevel: 'base', detectedWeakPoints: [], overloadedMuscleGroups: [],
    neglectedMuscleGroups: [], missingAdvancedData: ['dieta', 'exames', 'fadiga', 'histórico de treino'], safetyFlags: [],
  };
}

function deriveKronosReadiness(ctx) {
  const fatigue = ctx.fatigue;
  const labs    = ctx.labs;
  const reasons = [];
  var score = null, level = 'desconhecida';

  if (fatigue && fatigue.score != null) {
    score = fatigue.score;
    if (score >= 7)      { level = 'baixa';    reasons.push('Fadiga elevada (' + score + '/10)'); }
    else if (score >= 5) { level = 'moderada'; reasons.push('Fadiga moderada (' + score + '/10)'); }
    else                 { level = 'alta';     reasons.push('Boa disposição (' + score + '/10)'); }
  }
  if (labs && labs.hasCriticalFlags) {
    if (level === 'alta') level = 'moderada';
    else if (level === 'desconhecida') level = 'baixa';
    reasons.push('Biomarcadores com atenção clínica');
  }
  return { score: score, level: level, reasons: reasons };
}

function detectWorkoutPersonalizationLevel(ctx) {
  const { available, diet, labs, fatigue, workoutHistory, currentProtocol } = ctx;
  const hasDiet = !!diet;
  const hasLabs = !!(labs && labs.biomarkers && labs.biomarkers.length);
  const hasFatigue = !!fatigue;
  const hasHistory = workoutHistory && workoutHistory.length > 0;
  const hasProtocol = !!currentProtocol;
  if (hasDiet && hasLabs && hasFatigue && (hasHistory || hasProtocol)) return 'precision';
  if ((hasDiet || hasLabs) && (hasFatigue || hasHistory || hasProtocol)) return 'advanced';
  if (available.profile && (hasHistory || hasProtocol)) return 'contextual';
  return 'base';
}

function serializeKronosWorkoutContext(ctx) {
  if (!ctx) return '{}';
  return JSON.stringify({
    available: ctx.available,
    personalizationLevel: ctx.personalizationLevel,
    readiness: ctx.readiness,
    profile: ctx.nutritionProfile ? {
      sexo: ctx.nutritionProfile.sexo, idade: ctx.nutritionProfile.idade,
      peso_kg: ctx.nutritionProfile.peso_kg, objetivo: ctx.nutritionProfile.objetivo,
      nivel_atividade: ctx.nutritionProfile.nivel_atividade,
      condicoes_saude: ctx.nutritionProfile.condicoes_saude,
    } : null,
    diet: ctx.diet ? { total_calorias: ctx.diet.total_calorias, total_proteina: ctx.diet.total_proteina } : null,
    fatigue: ctx.fatigue,
    safetyFlags: ctx.safetyFlags,
    overloadedMuscleGroups: ctx.overloadedMuscleGroups,
    neglectedMuscleGroups: ctx.neglectedMuscleGroups,
    activeAlerts: ctx.alerts.slice(0, 3),
  });
}

module.exports = {
  buildKronosWorkoutContext: buildKronosWorkoutContext,
  deriveKronosReadiness: deriveKronosReadiness,
  detectWorkoutPersonalizationLevel: detectWorkoutPersonalizationLevel,
  serializeKronosWorkoutContext: serializeKronosWorkoutContext,
};
