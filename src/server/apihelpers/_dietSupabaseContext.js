function firstDefined() {
  for (var i = 0; i < arguments.length; i += 1) {
    var value = arguments[i];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
  return String(value).split(',').map(function(item) { return item.trim(); }).filter(Boolean);
}

function mergeUniqueArrays() {
  var values = [];
  for (var i = 0; i < arguments.length; i += 1) {
    values = values.concat(toArray(arguments[i]));
  }

  var seen = Object.create(null);
  return values.filter(function(item) {
    var key = String(item || '').toLowerCase();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function parseAgeFromBirthDate(birthDate) {
  if (!birthDate) return undefined;
  var date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return undefined;
  var years = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 10 || years > 120) return undefined;
  return years;
}

function normalizeSupplements(rows) {
  return (Array.isArray(rows) ? rows : []).map(function(row) {
    return row && row.supplement_name ? String(row.supplement_name).trim() : '';
  }).filter(Boolean);
}

function buildDietProfileFromSupabase(context) {
  var profile = context && context.profile ? context.profile : {};
  var bodyMetrics = context && context.bodyMetrics ? context.bodyMetrics : {};
  var nutritionGoals = context && context.nutritionGoals ? context.nutritionGoals : null;
  var supplements = normalizeSupplements(context && context.supplements);
  var restrictions = mergeUniqueArrays(profile.allergies, profile.intolerances);
  var latestLabReport = context && context.latestLabReport ? context.latestLabReport : null;

  return {
    objetivo: profile.objective || undefined,
    sexo: profile.sex || undefined,
    idade: parseAgeFromBirthDate(profile.birth_date),
    peso: firstDefined(bodyMetrics.weight_kg, profile.current_weight_kg),
    altura: profile.height_cm || undefined,
    gorduraCorporal: bodyMetrics.body_fat_percent || undefined,
    nivelAtividade: profile.activity_level || undefined,
    padraoAlimentar: profile.dietary_pattern || undefined,
    restricoes: restrictions,
    preferencias: mergeUniqueArrays(profile.liked_foods),
    alimentosEvitar: mergeUniqueArrays(profile.disliked_foods),
    suplementos: supplements,
    observacoes: profile.clinical_notes || undefined,
    nutritionGoals: nutritionGoals,
    labContext: latestLabReport,
    contextoTreino: {},
    saude: {
      clinicalNotes: profile.clinical_notes || undefined,
      labContext: latestLabReport,
    },
  };
}

function enrichDietPayload(basePayload, context) {
  var payload = basePayload && typeof basePayload === 'object' ? Object.assign({}, basePayload) : {};
  var dbProfile = buildDietProfileFromSupabase(context);
  var existingProfile = payload.profile && typeof payload.profile === 'object' ? Object.assign({}, payload.profile) : {};
  var existingContext = payload.context && typeof payload.context === 'object' ? Object.assign({}, payload.context) : {};

  payload.objetivo = firstDefined(payload.objetivo, payload.objective, dbProfile.objetivo);
  payload.sexo = firstDefined(payload.sexo, payload.sex, dbProfile.sexo);
  payload.idade = firstDefined(payload.idade, payload.age, dbProfile.idade);
  payload.peso = firstDefined(payload.peso, payload.pesoKg, payload.weight, payload.weightKg, dbProfile.peso);
  payload.altura = firstDefined(payload.altura, payload.alturaCm, payload.height, payload.heightCm, dbProfile.altura);
  payload.gorduraCorporal = firstDefined(payload.gorduraCorporal, payload.bodyFatPercent, dbProfile.gorduraCorporal);
  payload.nivelAtividade = firstDefined(payload.nivelAtividade, payload.activityLevel, payload.rotina, payload.routine, dbProfile.nivelAtividade);
  payload.padraoAlimentar = firstDefined(payload.padraoAlimentar, payload.dietaryPattern, dbProfile.padraoAlimentar);
  payload.restricoes = mergeUniqueArrays(payload.restricoes, payload.restrictions, dbProfile.restricoes);
  payload.preferencias = mergeUniqueArrays(payload.preferencias, payload.preferences, dbProfile.preferencias);
  payload.alimentosEvitar = mergeUniqueArrays(payload.alimentosEvitar, payload.dislikes, dbProfile.alimentosEvitar);
  payload.suplementos = mergeUniqueArrays(payload.suplementos, payload.supplements, dbProfile.suplementos);
  payload.observacoes = firstDefined(payload.observacoes, payload.notes, dbProfile.observacoes);
  payload.nutritionGoals = payload.nutritionGoals || payload.goals || dbProfile.nutritionGoals || null;
  payload.labContext = payload.labContext || payload.labs || dbProfile.labContext || null;
  payload.supabaseSnapshot = payload.supabaseSnapshot || context || null;

  payload.profile = Object.assign({}, existingProfile, {
    objetivo: firstDefined(existingProfile.objetivo, existingProfile.objective, payload.objetivo),
    sexo: firstDefined(existingProfile.sexo, existingProfile.sex, payload.sexo),
    idade: firstDefined(existingProfile.idade, existingProfile.age, payload.idade),
    pesoKg: firstDefined(existingProfile.pesoKg, existingProfile.weightKg, payload.peso),
    alturaCm: firstDefined(existingProfile.alturaCm, existingProfile.heightCm, payload.altura),
    bodyFatPercent: firstDefined(existingProfile.bodyFatPercent, payload.gorduraCorporal),
    activityLevel: firstDefined(existingProfile.activityLevel, payload.nivelAtividade),
    dietaryPattern: firstDefined(existingProfile.dietaryPattern, payload.padraoAlimentar),
    restricoes: mergeUniqueArrays(existingProfile.restricoes, payload.restricoes),
    preferencias: mergeUniqueArrays(existingProfile.preferencias, payload.preferencias),
    alimentosEvitar: mergeUniqueArrays(existingProfile.alimentosEvitar, payload.alimentosEvitar),
    suplementos: mergeUniqueArrays(existingProfile.suplementos, payload.suplementos),
    nutritionGoals: existingProfile.nutritionGoals || payload.nutritionGoals || null,
    labContext: existingProfile.labContext || payload.labContext || null,
    supabaseSnapshot: existingProfile.supabaseSnapshot || context || null,
  });

  payload.context = Object.assign({}, existingContext, {
    source: existingContext.source || 'diet_route_supabase_enriched',
    labContext: existingContext.labContext || payload.labContext || null,
    supabaseSnapshot: existingContext.supabaseSnapshot || context || null,
  });

  return payload;
}

function enrichDietRequestBody(body, context) {
  var safeBody = body && typeof body === 'object' ? Object.assign({}, body) : {};
  safeBody.payload = enrichDietPayload(safeBody.payload, context);
  return safeBody;
}

async function loadDietSupabaseContext(adminClient, userId) {
  var empty = {
    profile: null,
    bodyMetrics: null,
    nutritionGoals: null,
    supplements: [],
    latestLabReport: null,
  };

  if (!adminClient || !userId) return empty;

  try {
    var profileQuery = adminClient
      .from('profiles')
      .select('id,full_name,birth_date,sex,height_cm,current_weight_kg,activity_level,objective,dietary_pattern,allergies,intolerances,liked_foods,disliked_foods,clinical_notes,bcm_data,pcm_manual,body_composition_result,diet_flow_step,diet_flow_completed_at')
      .eq('id', userId)
      .maybeSingle();
    var bodyMetricsQuery = adminClient
      .from('body_metrics')
      .select('weight_kg,body_fat_percent,measured_at')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    var goalsQuery = adminClient
      .from('nutrition_goals')
      .select('calories_target,protein_g,carbs_g,fat_g,updated_at,training_context,metabolism_behavior,health_exam_context,food_context,goal_context,get_calculation_mode,behavior_adjustments,diet_alerts')
      .eq('user_id', userId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    var supplementsQuery = adminClient
      .from('supplement_protocols')
      .select('supplement_name,active')
      .eq('user_id', userId)
      .eq('active', true);
    var labReportsQuery = adminClient
      .from('lab_reports')
      .select('id,normalized_payload,ai_insights,confidence,confidence_summary,is_valid,created_at,processed_at')
      .eq('user_id', userId)
      .eq('is_valid', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    var responses = await Promise.allSettled([profileQuery, bodyMetricsQuery, goalsQuery, supplementsQuery, labReportsQuery]);

    return {
      profile: responses[0].status === 'fulfilled' ? responses[0].value.data || null : null,
      bodyMetrics: responses[1].status === 'fulfilled' ? responses[1].value.data || null : null,
      nutritionGoals: responses[2].status === 'fulfilled' ? responses[2].value.data || null : null,
      supplements: responses[3].status === 'fulfilled' ? responses[3].value.data || [] : [],
      // Campos expandidos do wizard 6 etapas (mapeados do perfil)
      bcmData: (function() { var p = responses[0].status === 'fulfilled' ? responses[0].value.data : null; return p ? p.bcm_data || null : null; })(),
      pcmManual: (function() { var p = responses[0].status === 'fulfilled' ? responses[0].value.data : null; return p ? p.pcm_manual || null : null; })(),
      bodyComposition: (function() { var p = responses[0].status === 'fulfilled' ? responses[0].value.data : null; return p ? p.body_composition_result || null : null; })(),
      currentStep: (function() { var p = responses[0].status === 'fulfilled' ? responses[0].value.data : null; return p ? p.diet_flow_step || 1 : 1; })(),
      dietFlowCompletedAt: (function() { var p = responses[0].status === 'fulfilled' ? responses[0].value.data : null; return p ? p.diet_flow_completed_at || null : null; })(),
      contextoTreino: (function() { var g = responses[2].status === 'fulfilled' ? responses[2].value.data : null; return g ? g.training_context || null : null; })(),
      metabolismBehaviorContext: (function() { var g = responses[2].status === 'fulfilled' ? responses[2].value.data : null; return g ? g.metabolism_behavior || null : null; })(),
      latestLabReport: (function() {
        if (responses[4].status !== 'fulfilled' || !responses[4].value.data) return null;
        var d = responses[4].value.data;
        // Canonical biomarker source: normalized_payload.biomarkers (most complete)
        // Fallback to legacy parsed field for backwards compatibility
        var normalizedPayload = d.normalized_payload && typeof d.normalized_payload === 'object' ? d.normalized_payload : null;
        var biomarkers = (normalizedPayload && Array.isArray(normalizedPayload.biomarkers))
          ? normalizedPayload.biomarkers
          : null;

        // Build health profile signals from ai_insights if already computed
        var aiInsights = d.ai_insights && typeof d.ai_insights === 'object' ? d.ai_insights : null;
        var healthProfile = aiInsights && aiInsights.health_profile ? aiInsights.health_profile : null;
        var scores = aiInsights && aiInsights.scores ? aiInsights.scores : null;

        // Derive clinical flags from ai_insights if available, fallback to stored flags
        var clinicalFlags = (aiInsights && Array.isArray(aiInsights.clinical_flags))
          ? aiInsights.clinical_flags
          : (Array.isArray(d.clinical_flags) ? d.clinical_flags : []);
        var criticalFlags = (aiInsights && Array.isArray(aiInsights.critical_flags))
          ? aiInsights.critical_flags
          : (Array.isArray(d.critical_flags) ? d.critical_flags : []);

        return {
          id: d.id || null,
          parsed: null,
          biomarkers: biomarkers,
          healthProfile: healthProfile,
          scores: scores,
          aiInsights: aiInsights,
          confidence: Number(d.confidence || 0),
          confidenceSummary: d.confidence_summary || null,
          isValid: Boolean(d.is_valid),
          mode: criticalFlags.length || clinicalFlags.length ? 'clinical' : 'standard',
          clinicalFlags: clinicalFlags,
          criticalFlags: criticalFlags,
          createdAt: d.created_at || null,
          processedAt: d.processed_at || null,
        };
      })(),
    };
  } catch (_) {
    return empty;
  }
}

async function saveDietProfileContext(adminClient, userId, contextData) {
  if (!adminClient || !userId || !contextData) return { ok: false, error: 'missing params' };
  try {
    var profileUpdates = {};
    if (contextData.bcmData !== undefined)      profileUpdates.bcm_data                = contextData.bcmData;
    if (contextData.pcmManual !== undefined)    profileUpdates.pcm_manual              = contextData.pcmManual;
    if (contextData.bodyComposition !== undefined) profileUpdates.body_composition_result = contextData.bodyComposition;
    if (contextData.currentStep !== undefined)  profileUpdates.diet_flow_step          = contextData.currentStep;
    if (contextData.completedAt !== undefined)  profileUpdates.diet_flow_completed_at  = contextData.completedAt;

    var goalsUpdates = {};
    if (contextData.contextoTreino !== undefined)          goalsUpdates.training_context     = contextData.contextoTreino;
    if (contextData.metabolismBehaviorContext !== undefined) goalsUpdates.metabolism_behavior  = contextData.metabolismBehaviorContext;
    if (contextData.healthExamContext !== undefined)        goalsUpdates.health_exam_context  = contextData.healthExamContext;
    if (contextData.foodContext !== undefined)              goalsUpdates.food_context         = contextData.foodContext;
    if (contextData.goalContext !== undefined)              goalsUpdates.goal_context         = contextData.goalContext;
    if (contextData.getCalculationMode !== undefined)       goalsUpdates.get_calculation_mode = contextData.getCalculationMode;
    if (contextData.behaviorAdjustments !== undefined)      goalsUpdates.behavior_adjustments = contextData.behaviorAdjustments;
    if (contextData.alerts !== undefined)                   goalsUpdates.diet_alerts          = contextData.alerts;

    var ops = [];
    if (Object.keys(profileUpdates).length) {
      ops.push(adminClient.from('profiles').update(profileUpdates).eq('id', userId));
    }
    if (Object.keys(goalsUpdates).length) {
      ops.push(
        adminClient.from('nutrition_goals')
          .update(goalsUpdates)
          .eq('user_id', userId)
          .eq('active', true)
      );
    }
    if (ops.length) await Promise.allSettled(ops);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'unknown' };
  }
}

module.exports = {
  buildDietProfileFromSupabase: buildDietProfileFromSupabase,
  enrichDietPayload: enrichDietPayload,
  enrichDietRequestBody: enrichDietRequestBody,
  loadDietSupabaseContext: loadDietSupabaseContext,
  saveDietProfileContext: saveDietProfileContext,
  parseAgeFromBirthDate: parseAgeFromBirthDate,
};
