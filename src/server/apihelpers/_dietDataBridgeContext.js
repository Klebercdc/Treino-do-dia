'use strict';

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  var parsed = Number(String(value).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBiomarker(row) {
  row = row && typeof row === 'object' ? row : {};
  return {
    marker_key: row.marker_key || null,
    marker_name: row.marker_name || row.name || row.marker_key || 'Marcador',
    name: row.marker_name || row.name || row.marker_key || 'Marcador',
    value: row.value_numeric != null ? row.value_numeric : row.value_text,
    value_numeric: toNumber(row.value_numeric),
    unit: row.unit || '',
    reference_min: toNumber(row.reference_min),
    reference_max: toNumber(row.reference_max),
    flag: row.released_flag || row.flag || row.context_flag || null,
    released_flag: row.released_flag || null,
    context_flag: row.context_flag || null,
    safety_relevance: row.safety_relevance || null,
  };
}

function pickSnapshotPayload(snapshotRow) {
  if (!snapshotRow) return null;
  var snapshot = snapshotRow.snapshot || snapshotRow.payload || snapshotRow.data || null;
  if (snapshot && typeof snapshot === 'object') return snapshot;
  return null;
}

function latestAiInsights(report, snapshotPayload) {
  if (report && report.ai_insights && typeof report.ai_insights === 'object') return report.ai_insights;
  if (snapshotPayload && snapshotPayload.ai_insights && typeof snapshotPayload.ai_insights === 'object') return snapshotPayload.ai_insights;
  if (snapshotPayload && snapshotPayload.insights && typeof snapshotPayload.insights === 'object') return snapshotPayload.insights;
  return null;
}

async function loadLatestLabReportForDiet(adminClient, userId) {
  if (!adminClient || !userId) return null;

  var reportResult = await adminClient
    .from('lab_reports')
    .select('id,user_id,canonical_status,normalized_payload,ai_insights,confidence,confidence_summary,is_valid,created_at,processed_at')
    .eq('user_id', userId)
    .in('canonical_status', ['released_to_patient', 'analyzed', 'extracted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  var report = reportResult && reportResult.data ? reportResult.data : null;
  if (!report) {
    var fallbackResult = await adminClient
      .from('lab_reports')
      .select('id,user_id,canonical_status,normalized_payload,ai_insights,confidence,confidence_summary,is_valid,created_at,processed_at')
      .eq('user_id', userId)
      .eq('is_valid', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    report = fallbackResult && fallbackResult.data ? fallbackResult.data : null;
  }

  if (!report || !report.id) return null;

  var biomarkersResult = await adminClient
    .from('lab_report_biomarkers')
    .select('marker_key,marker_name,value_numeric,value_text,unit,reference_min,reference_max,flag,released_flag,context_flag,safety_relevance')
    .eq('lab_report_id', report.id)
    .order('marker_name', { ascending: true });

  var snapshotResult = await adminClient
    .from('lab_report_snapshot_versions')
    .select('version,snapshot,created_at')
    .eq('lab_report_id', report.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  var biomarkers = Array.isArray(biomarkersResult && biomarkersResult.data)
    ? biomarkersResult.data.map(normalizeBiomarker)
    : [];
  var normalizedPayload = report.normalized_payload && typeof report.normalized_payload === 'object' ? report.normalized_payload : null;
  var snapshotPayload = pickSnapshotPayload(snapshotResult && snapshotResult.data);
  var aiInsights = latestAiInsights(report, snapshotPayload);
  var snapshotInsights = snapshotPayload && snapshotPayload.ai_insights && typeof snapshotPayload.ai_insights === 'object' ? snapshotPayload.ai_insights : null;
  var clinicalFlags = Array.isArray(aiInsights && aiInsights.clinical_flags) ? aiInsights.clinical_flags : [];
  var criticalFlags = Array.isArray(aiInsights && aiInsights.critical_flags) ? aiInsights.critical_flags : [];

  if (!biomarkers.length && normalizedPayload && Array.isArray(normalizedPayload.biomarkers)) {
    biomarkers = normalizedPayload.biomarkers.map(normalizeBiomarker);
  }

  return {
    id: report.id,
    source: 'lab_reports_released_bridge',
    canonicalStatus: report.canonical_status || null,
    isValid: report.is_valid === true || biomarkers.length > 0,
    createdAt: report.created_at || null,
    processedAt: report.processed_at || null,
    confidence: Number(report.confidence || 0),
    confidenceSummary: report.confidence_summary || null,
    normalizedPayload: normalizedPayload,
    biomarkers: biomarkers,
    aiInsights: aiInsights,
    scores: aiInsights && aiInsights.scores ? aiInsights.scores : null,
    healthProfile: aiInsights && aiInsights.health_profile ? aiInsights.health_profile : null,
    clinicalFlags: clinicalFlags,
    criticalFlags: criticalFlags,
    nutritionAdjustments: aiInsights && aiInsights.nutrition_adjustments ? aiInsights.nutrition_adjustments : null,
    impactOnNutrition: aiInsights && aiInsights.impact_on_nutrition ? aiInsights.impact_on_nutrition : null,
    snapshotVersion: snapshotResult && snapshotResult.data ? snapshotResult.data.version : null,
    snapshotAiInsights: snapshotInsights,
    mode: clinicalFlags.length || criticalFlags.length ? 'clinical' : 'standard',
  };
}

function normalizeFoodCatalogRow(row) {
  row = row && typeof row === 'object' ? row : {};
  var kcal = toNumber(row.kcal_100g || row.calorias_100g || row.calories_100g || row.kcal || row.calorias || row.calories);
  var protein = toNumber(row.protein_g_100g || row.proteina_g_100g || row.proteinas_100g || row.protein_g || row.proteinas || row.proteina);
  var carbs = toNumber(row.carbs_g_100g || row.carboidratos_g_100g || row.carboidratos_100g || row.carbs_g || row.carboidratos);
  var fat = toNumber(row.fat_g_100g || row.gorduras_g_100g || row.gorduras_100g || row.fat_g || row.gorduras);
  var fiber = toNumber(row.fiber_g_100g || row.fibras_g_100g || row.fibras_100g || row.fiber_g || row.fibras);
  var portionGrams = toNumber(row.porcao_gramas || row.portion_grams || row.grams || row.gramas) || 100;
  return {
    id: row.id || row.food_catalog_id || null,
    taco_id: row.taco_id || row.codigo_taco || row.codigo || null,
    name: row.nome || row.name || row.alimento || row.description || '',
    source: row.fonte || row.source || 'food_catalog',
    portionGrams: portionGrams,
    per100g: {
      kcal: portionGrams !== 100 && kcal != null ? kcal * 100 / portionGrams : kcal,
      protein: portionGrams !== 100 && protein != null ? protein * 100 / portionGrams : protein,
      carbs: portionGrams !== 100 && carbs != null ? carbs * 100 / portionGrams : carbs,
      fat: portionGrams !== 100 && fat != null ? fat * 100 / portionGrams : fat,
      fiber: portionGrams !== 100 && fiber != null ? fiber * 100 / portionGrams : fiber,
    },
  };
}

async function loadFoodCatalogForDiet(adminClient) {
  if (!adminClient) return [];
  var result = await adminClient
    .from('food_catalog')
    .select('*')
    .limit(300);
  return Array.isArray(result && result.data) ? result.data.map(normalizeFoodCatalogRow).filter(function(row) { return row.name; }) : [];
}

function mergeDietBridgeContext(body, bridgeContext) {
  var safeBody = body && typeof body === 'object' ? Object.assign({}, body) : {};
  var payload = safeBody.payload && typeof safeBody.payload === 'object' ? Object.assign({}, safeBody.payload) : {};
  var context = payload.context && typeof payload.context === 'object' ? Object.assign({}, payload.context) : {};
  var profile = payload.profile && typeof payload.profile === 'object' ? Object.assign({}, payload.profile) : {};
  var supabaseSnapshot = payload.supabaseSnapshot && typeof payload.supabaseSnapshot === 'object' ? Object.assign({}, payload.supabaseSnapshot) : {};

  if (bridgeContext && bridgeContext.latestLabReport) {
    payload.labContext = bridgeContext.latestLabReport;
    context.labContext = bridgeContext.latestLabReport;
    profile.labContext = bridgeContext.latestLabReport;
    supabaseSnapshot.latestLabReport = bridgeContext.latestLabReport;
  }

  if (bridgeContext && Array.isArray(bridgeContext.foodCatalog)) {
    payload.foodCatalogContext = { source: 'food_catalog', items: bridgeContext.foodCatalog };
    context.foodCatalogContext = payload.foodCatalogContext;
    supabaseSnapshot.foodCatalog = bridgeContext.foodCatalog;
  }

  payload.context = context;
  payload.profile = profile;
  payload.supabaseSnapshot = supabaseSnapshot;
  safeBody.payload = payload;
  return safeBody;
}

async function loadDietBridgeContext(adminClient, userId) {
  var latestLabReport = await loadLatestLabReportForDiet(adminClient, userId).catch(function() { return null; });
  var foodCatalog = await loadFoodCatalogForDiet(adminClient).catch(function() { return []; });
  return { latestLabReport: latestLabReport, foodCatalog: foodCatalog };
}

module.exports = {
  loadLatestLabReportForDiet: loadLatestLabReportForDiet,
  loadFoodCatalogForDiet: loadFoodCatalogForDiet,
  loadDietBridgeContext: loadDietBridgeContext,
  mergeDietBridgeContext: mergeDietBridgeContext,
};