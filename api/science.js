var cors   = require('../src/server/apihelpers/_cors');
var auth   = require('../src/server/apihelpers/_auth');
var rl     = require('../src/server/apihelpers/_ratelimit');
var crypto = require('crypto');

// Lazy-loaded to prevent top-level require from crashing the process when
// transitive dependencies (e.g. @supabase/supabase-js) are not resolvable
// from the src/ scope at cold-start in Vercel's runtime-install mode.
var _science = null;
var _scienceInsight = null;
var _nutritionService = null;
var _kronaEngine = null;
var _lazyLoadAttempted = false;
var _lazyLoadError = null;

function ensureModulesLoaded() {
  if (_lazyLoadAttempted) return _lazyLoadError;
  _lazyLoadAttempted = true;
  try {
    _science = require('../src/lib/science/scienceSyncService');
    _scienceInsight = require('../src/lib/science/scienceInsightService');
    _nutritionService = require('../src/lib/nutrition/nutritionService');
    _kronaEngine = require('../src/core/diet/kronaEngine');
    return null;
  } catch (err) {
    _lazyLoadError = err;
    console.error('[api/science] dependency load failed:', err && err.message ? err.message : String(err));
    return err;
  }
}

// Lazy-loaded exercise modules (loaded only when kronia-exercise-details route is hit)
var _ExerciseApp   = null;
var _adminClient   = null;
var _exLoadAttempted = false;
var _exLoadError   = null;

function ensureExerciseModulesLoaded() {
  if (_exLoadAttempted) return _exLoadError;
  _exLoadAttempted = true;
  try {
    var appMod      = require('../src/lib/exercises/application');
    var supabaseMod = require('../src/lib/supabase/admin');
    _ExerciseApp = appMod.KroniaExerciseApplication;
    _adminClient = supabaseMod.createAdminSupabaseClient;
    return null;
  } catch (err) {
    _exLoadError = err;
    console.error('[api/science] exercise dependency load failed:', err && err.message ? err.message : String(err));
    return err;
  }
}

function buildExerciseSuccessPayload(data, meta) {
  return { success: true, type: 'exercise_details', message: 'Detalhes do exercício carregados com sucesso.', data: data, meta: meta || {} };
}
function buildExercisePartialPayload(message, data, meta) {
  return { success: false, type: 'exercise_partial', message: message, data: data, meta: meta || {} };
}
function buildExerciseErrorPayload(message, code, meta, data) {
  return { success: false, type: 'exercise_error', message: message, error: { code: code || 'EXERCISE_ERROR' }, data: data || null, meta: meta || {} };
}
function normalizeExerciseEnvelope(result) {
  var meta = result.meta || {};
  var knownResolution = Number((meta && meta.confidenceScore) || 0) >= 0.9;
  var firstError = result.errors && result.errors[0];
  if (result.status === 'success' && result.data) {
    return { payload: buildExerciseSuccessPayload(result.data, Object.assign({}, meta, { knownResolution: knownResolution })), httpStatus: 200 };
  }
  if (!result.data) {
    var errorCode = (firstError && firstError.code) || 'EXERCISE_ERROR';
    return { payload: buildExerciseErrorPayload((firstError && firstError.message) || 'Não foi possível carregar os detalhes do exercício.', errorCode, meta, null), httpStatus: errorCode === 'EXERCISE_NOT_FOUND' ? 404 : 422 };
  }
  return { payload: buildExercisePartialPayload((firstError && firstError.message) || 'Não foi possível enriquecer os detalhes do exercício agora.', result.data, Object.assign({}, meta, { code: (firstError && firstError.code) || 'EXERCISE_PARTIAL', knownResolution: knownResolution })), httpStatus: 206 };
}

async function handleKroniaExerciseDetails(req, res, user) {
  var exErr = ensureExerciseModulesLoaded();
  if (exErr) {
    return res.status(503).json(buildExerciseErrorPayload('Serviço de exercícios temporariamente indisponível.', 'SERVICE_UNAVAILABLE', { cause: exErr && exErr.message ? exErr.message : String(exErr) }));
  }
  try {
    var exerciseId = '', slug = '', lookupKey = '', exerciseName = '', locale = 'pt';
    if (req.method === 'GET') {
      var q = req.query || {};
      exerciseId   = String(q.id || '').trim();
      slug         = String(q.slug || '').trim();
      lookupKey    = String(q.lookupKey || q.normalized_lookup_key || '').trim();
      exerciseName = lookupKey || slug;
    } else {
      var body = req.body || {};
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      exerciseId   = typeof body.exerciseId === 'string'            ? body.exerciseId.slice(0, 120)            : '';
      slug         = typeof body.slug === 'string'                  ? body.slug.slice(0, 240)                  : '';
      lookupKey    = typeof body.normalized_lookup_key === 'string' ? body.normalized_lookup_key.slice(0, 240)
                   : (typeof body.normalizedLookupKey === 'string'  ? body.normalizedLookupKey.slice(0, 240)   : '');
      exerciseName = typeof body.exerciseName === 'string'          ? body.exerciseName.slice(0, 240)          : '';
      locale       = body.locale === 'en' ? 'en' : 'pt';
    }
    if (!exerciseId && !slug && !lookupKey) {
      return res.status(400).json(buildExerciseErrorPayload('Informe id, slug ou lookupKey.', 'VALIDATION_ERROR'));
    }
    var adminClient = _adminClient();
    var service     = new _ExerciseApp(adminClient);
    var result      = await service.getExerciseDetailsByName({
      userId: user.id,
      exerciseId:          exerciseId   || undefined,
      slug:                slug         || undefined,
      normalizedLookupKey: lookupKey    || undefined,
      exerciseName:        exerciseName || lookupKey || slug || undefined,
      locale:              locale,
    });
    var envelope = normalizeExerciseEnvelope(result);
    return res.status(envelope.httpStatus).json(envelope.payload);
  } catch (err) {
    console.error('[api/science][kronia-exercise-details] erro interno:', err && err.message ? err.message : String(err));
    return res.status(500).json(buildExerciseErrorPayload('Falha ao buscar detalhes do exercício.', 'INTERNAL_ERROR', { cause: err && err.message ? err.message : 'unknown' }));
  }
}

function isJsonContentType(req) {
  var contentType = req && req.headers ? req.headers['content-type'] || req.headers['Content-Type'] : '';
  var normalized = String(contentType || '').toLowerCase();
  return normalized.indexOf('application/json') === 0 || normalized.indexOf('+json') > -1;
}

function parseJsonBodyIfNeeded(req) {
  if (!req) return {};

  var currentBody = req.body;
  if (currentBody && typeof currentBody === 'object' && !Buffer.isBuffer(currentBody)) return currentBody;

  var raw = currentBody;
  if ((raw === undefined || raw === null || raw === '') && req.rawBody !== undefined && req.rawBody !== null) {
    raw = req.rawBody;
  }

  if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');

  if (typeof raw === 'string') {
    var trimmed = raw.trim();
    if (!trimmed) return {};

    if (isJsonContentType(req) || trimmed[0] === '{' || trimmed[0] === '[') {
      try {
        return JSON.parse(trimmed);
      } catch (_) {
        return {};
      }
    }
  }

  return {};
}

function normalizeNutritionPayload(rawPayload) {
  var payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  var pickFirst = function() {
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  };
  var toNumberIfNeeded = function(value) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    var normalized = String(value).trim();
    if (!normalized) return undefined;
    var parsed = Number(normalized.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  var canonical = {
    sexo: pickFirst(payload.sexo),
    idade: toNumberIfNeeded(pickFirst(payload.idade)),
    peso: toNumberIfNeeded(pickFirst(payload.peso, payload.peso_kg, payload.pesoKg)),
    altura: toNumberIfNeeded(pickFirst(payload.altura, payload.altura_cm, payload.alturaCm)),
    nivelAtividade: pickFirst(payload.nivelAtividade, payload.nivel_atividade),
    objetivo: pickFirst(payload.objetivo),
    refeicoesPorDia: toNumberIfNeeded(pickFirst(payload.refeicoesPorDia, payload.refeicoes_por_dia))
  };

  var forwardedPayload = {};
  Object.keys(canonical).forEach(function(key) {
    if (canonical[key] !== undefined) forwardedPayload[key] = canonical[key];
  });

  var receivedKeys = Object.keys(payload);
  var forwardedKeys = Object.keys(forwardedPayload);
  console.log('[nutrition-plan] payload mapping', {
    receivedKeys: receivedKeys,
    forwardedKeys: forwardedKeys
  });

  return forwardedPayload;
}

function getCronSecret(req) {
  if (!req) return '';

  var authHeader = req.headers && req.headers['authorization'] ? String(req.headers['authorization']).trim() : '';
  if (/^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  var headerSecret = req.headers && req.headers['x-cron-secret'] ? String(req.headers['x-cron-secret']).trim() : '';
  if (headerSecret) return headerSecret;

  var altHeaderSecret = req.headers && req.headers['cron-secret'] ? String(req.headers['cron-secret']).trim() : '';
  if (altHeaderSecret) return altHeaderSecret;

  return '';
}

function isValidCronSecret(req) {
  var expected = process.env.CRON_SECRET ? String(process.env.CRON_SECRET).trim() : '';
  if (!expected) return false;

  var provided = getCronSecret(req);
  if (!provided || provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}


// ─── KRONIA DIET ENGINE HANDLERS ────────────────────────────────────────────

function handleKronaDietGenerate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  var payload = req.body || {};
  var result = _kronaEngine.generatePlan(payload);
  if (result.failSafe) {
    return res.status(422).json({ success: false, error: result.error || { reason: 'Dados insuficientes para gerar o plano.' } });
  }
  return res.status(200).json({ success: true, activeState: result.activeState, prescription: result.prescription, strategy: result.strategy });
}

function handleKronaSubstitutions(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  var body = req.body || {};
  if (!body.state || !body.mealOrdem || !body.blockName) {
    return res.status(400).json({ success: false, error: 'state, mealOrdem e blockName são obrigatórios.' });
  }
  var result = _kronaEngine.getSubstitutions(body.state, Number(body.mealOrdem), String(body.blockName));
  if (result.error) return res.status(404).json({ success: false, error: result.error });
  return res.status(200).json({ success: true, options: result.options });
}

function handleKronaSwap(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  var body = req.body || {};
  if (!body.state || !body.mealOrdem || !body.blockName || !body.newFoodCode) {
    return res.status(400).json({ success: false, error: 'state, mealOrdem, blockName e newFoodCode são obrigatórios.' });
  }
  var result = _kronaEngine.swapFood(body.state, Number(body.mealOrdem), String(body.blockName), String(body.newFoodCode));
  if (result.warnings && result.warnings.length) return res.status(422).json({ success: false, error: result.warnings[0] });
  return res.status(200).json({ success: true, activeState: result.state, message: result.message });
}

function handleKronaRemoveBlock(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  var body = req.body || {};
  if (!body.state || !body.mealOrdem || !body.blockName) {
    return res.status(400).json({ success: false, error: 'state, mealOrdem e blockName são obrigatórios.' });
  }
  var result = _kronaEngine.removeBlock(body.state, Number(body.mealOrdem), String(body.blockName));
  if (result.warnings && result.warnings.length) return res.status(422).json({ success: false, error: result.warnings[0] });
  return res.status(200).json({ success: true, activeState: result.state, message: result.message });
}

function handleKronaAdjustPortion(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  var body = req.body || {};
  if (!body.state || !body.mealOrdem || !body.blockName || !body.newGrams) {
    return res.status(400).json({ success: false, error: 'state, mealOrdem, blockName e newGrams são obrigatórios.' });
  }
  var result = _kronaEngine.adjustPortion(body.state, Number(body.mealOrdem), String(body.blockName), Number(body.newGrams));
  if (result.warnings && result.warnings.length) return res.status(422).json({ success: false, error: result.warnings[0] });
  return res.status(200).json({ success: true, activeState: result.state, message: result.message });
}

function handleKronaPrint(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  var body = req.body || {};
  if (!body.state) return res.status(400).json({ success: false, error: 'state é obrigatório.' });
  return res.status(200).json({ success: true, prescription: _kronaEngine.renderForPrint(body.state) });
}

// ─── ROUTE HELPERS ──────────────────────────────────────────────────────────

function isPrivilegedRoute(route) {
  return route === 'science-sync' || route === 'science-classify' || route === 'nutrition-selftest';
}

function detectRoute(req) {
  var queryRoute = req.query && req.query.__route ? String(req.query.__route) : '';
  if (queryRoute) return queryRoute;

  var action = req.body && req.body.action ? String(req.body.action) : '';
  if (action) return action;

  var parsed = new URL(req.url || '', 'http://localhost');
  var pathname = parsed.pathname || '';

  if (pathname.endsWith('/science-search')) return 'science-search';
  if (pathname.endsWith('/science-sync')) return 'science-sync';
  if (pathname.endsWith('/science-review')) return 'science-review';
  if (pathname.endsWith('/science-insight')) return 'science-insight';
  if (pathname.endsWith('/science-classify')) return 'science-classify';
  if (pathname.endsWith('/nutrition-calc')) return 'nutrition-calc';
  if (pathname.endsWith('/nutrition-plan')) return 'nutrition-plan';
  if (pathname.endsWith('/nutrition-selftest')) return 'nutrition-selftest';
  if (pathname.endsWith('/science')) return 'science';
  if (pathname.endsWith('/diet/generate'))       return 'krona-diet-generate';
  if (pathname.endsWith('/diet/substitutions'))  return 'krona-diet-substitutions';
  if (pathname.endsWith('/diet/swap'))           return 'krona-diet-swap';
  if (pathname.endsWith('/diet/remove-block'))   return 'krona-diet-remove-block';
  if (pathname.endsWith('/diet/adjust-portion')) return 'krona-diet-adjust-portion';
  if (pathname.endsWith('/diet/print'))          return 'krona-diet-print';

  return '';
}

function handleNutritionCalc(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  var payload = req.body || {};
  var result = _nutritionService.calculateNutrition(payload);

  if (result.failSafe) {
    return res.status(200).json({
      ok: false,
      failSafe: true,
      limitedOrientation: result.limitedOrientation
    });
  }

  return res.status(200).json({ ok: true, failSafe: false, data: result });
}

async function handleNutritionPlan(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var bodyPayload = parseJsonBodyIfNeeded(req);
  var queryPayload = req && req.query ? req.query : {};
  var directPayload = bodyPayload && bodyPayload.payload && typeof bodyPayload.payload === 'object'
    ? Object.assign({}, bodyPayload.payload)
    : (bodyPayload && typeof bodyPayload === 'object' ? Object.assign({}, bodyPayload) : {});
  var isNonEmptyValue = function(value) {
    return value !== undefined && value !== null && value !== '';
  };
  var pickValue = function(aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var alias = aliases[i];
      if (bodyPayload && isNonEmptyValue(bodyPayload[alias])) return bodyPayload[alias];
    }
    for (var j = 0; j < aliases.length; j++) {
      var fallbackAlias = aliases[j];
      if (isNonEmptyValue(queryPayload[fallbackAlias])) return queryPayload[fallbackAlias];
    }
    return undefined;
  };
  var toNumber = function(value) {
    if (!isNonEmptyValue(value)) return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    var normalized = String(value).trim();
    if (!normalized) return undefined;
    var parsed = Number(normalized.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  var payloadFinal = Object.assign({}, directPayload, {
    sexo: pickValue(['sexo']) || directPayload.sexo,
    idade: toNumber(pickValue(['idade'])) || directPayload.idade,
    peso: toNumber(pickValue(['peso', 'peso_kg', 'pesoKg'])) || directPayload.peso || directPayload.pesoKg,
    altura: toNumber(pickValue(['altura', 'altura_cm', 'alturaCm'])) || directPayload.altura || directPayload.alturaCm,
    nivelAtividade: pickValue(['nivelAtividade', 'nivel_atividade']) || directPayload.nivelAtividade || directPayload.activityLevel,
    objetivo: pickValue(['objetivo']) || directPayload.objetivo || directPayload.objective,
    refeicoesPorDia: toNumber(pickValue(['refeicoesPorDia', 'refeicoes_por_dia'])) || directPayload.refeicoesPorDia || directPayload.meals || directPayload.mealCount
  });

  var forwardedKeys = Object.keys(payloadFinal).filter(function(key) {
    return isNonEmptyValue(payloadFinal[key]);
  });
  console.log('[nutrition-plan] payload mapping', {
    forwardedKeys: forwardedKeys,
    preservedContext: Boolean(payloadFinal.context || payloadFinal.supabaseSnapshot || payloadFinal.intakeSnapshot)
  });

  var result = _nutritionService.generateNutritionPlan(payloadFinal);

  if (result.failSafe) {
    return res.status(200).json({
      ok: false,
      failSafe: true,
      limitedOrientation: result.limitedOrientation
    });
  }

  var scienceEvidence = [];
  try {
    scienceEvidence = await _science.listEvidenceByObjective(payloadFinal.objetivo, 3);
  } catch (_) {
    scienceEvidence = [];
  }

  return res.status(200).json({
    ok: true,
    failSafe: false,
    data: result,
    science: scienceEvidence
  });
}

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var loadErr = ensureModulesLoaded();
  if (loadErr) {
    return res.status(503).json({
      ok: false,
      error: 'SCIENCE_DEPENDENCY_UNAVAILABLE',
      warning: String(loadErr.message || loadErr)
    });
  }

  req.body = parseJsonBodyIfNeeded(req);

  var route = detectRoute(req);
  var hasValidCronSecret = isValidCronSecret(req);

  if (isPrivilegedRoute(route) && !hasValidCronSecret) {
    return res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED_CRON_ROUTE',
      message: 'Rota administrativa exige CRON_SECRET válido no header Authorization ou x-cron-secret.'
    });
  }

  if (route === 'science-sync' && hasValidCronSecret) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
      var cronResult = await _science.syncScientificTopics();
      return res.status(200).json(cronResult);
    } catch (error) {
      return res.status(500).json({ ok: false, inserted_articles: 0, inserted_evidence: 0, needs_review: 0, warning: String(error.message || error), error: 'SCIENCE_SYNC_FAILED' });
    }
  }

  if (route === 'science-classify' && hasValidCronSecret) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
      var cronLimit = Number((req.body && req.body.limit) || (req.query && req.query.limit) || 25);
      var cronClassifyResult = await _science.classifyScientificArticlesBatch(cronLimit);
      return res.status(200).json(cronClassifyResult);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        updated_articles: 0,
        scanned_articles: 0,
        warning: String(error.message || error),
        error: 'SCIENCE_CLASSIFY_FAILED'
      });
    }
  }

  if (route === 'nutrition-plan' && hasValidCronSecret) {
    return handleNutritionPlan(req, res);
  }

  if (route === 'nutrition-selftest' && hasValidCronSecret) {
    var selfTestPayload = {
      sexo: 'masculino', idade: 40, peso: 80, altura: 175,
      nivelAtividade: 'moderado', objetivo: 'hipertrofia', refeicoesPorDia: 4
    };
    try {
      var selfTestResult = _nutritionService.generateNutritionPlan(selfTestPayload);
      var selfTestEvidence = [];
      try { selfTestEvidence = await _science.listEvidenceByObjective('hipertrofia', 3); } catch (_) {}
      return res.status(200).json({
        ok: true,
        test: true,
        timestamp: new Date().toISOString(),
        payload_used: selfTestPayload,
        plan: selfTestResult,
        science: selfTestEvidence
      });
    } catch (err) {
      return res.status(500).json({ ok: false, test: true, error: String(err.message || err), code: 'NUTRITION_SELFTEST_FAILED' });
    }
  }

  return auth.requireAuth(req, res, function(user) { rl.rateLimit(req, res, async function() {
    if (route === 'science-search') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var query = String((req.body && req.body.query) || '').trim();
        if (!query) return res.status(400).json({ error: 'query é obrigatório' });

        var items = await _science.searchScientificArticles(query);
        return res.status(200).json({ query: query, items: items });
      } catch (error) {
        return res.status(500).json({ query: req.body && req.body.query, items: [], warning: String(error.message || error), error: 'SCIENCE_SEARCH_FAILED' });
      }
    }

    if (route === 'science-sync') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var syncResult = await _science.syncScientificTopics();
        return res.status(200).json(syncResult);
      } catch (error) {
        return res.status(500).json({ ok: false, inserted_articles: 0, inserted_evidence: 0, needs_review: 0, warning: String(error.message || error), error: 'SCIENCE_SYNC_FAILED' });
      }
    }

    if (route === 'science-review') {
      if (req.method !== 'GET') return res.status(405).end();
      try {
        var reviewItems = await _science.listPendingReviews();
        return res.status(200).json({ items: reviewItems });
      } catch (error) {
        return res.status(500).json({ items: [], warning: String(error.message || error), error: 'SCIENCE_REVIEW_FAILED' });
      }
    }

    if (route === 'science-insight') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var topic = String((req.body && req.body.topic) || '').trim();
        if (!topic) return res.status(400).json({ error: 'topic é obrigatório' });

        var insight = await _scienceInsight.getScienceInsightByTopic(topic);
        if (!insight.found) return res.status(404).json(insight);

        return res.status(200).json({
          topic: insight.topic,
          synthesis: insight.synthesis,
          evidence_level: insight.evidence_level,
          top_articles: insight.top_articles,
          human_control_required: true,
          automation_blocked: true
        });
      } catch (error) {
        return res.status(500).json({
          topic: req.body && req.body.topic,
          warning: String(error.message || error),
          synthesis: null,
          evidence_level: null,
          top_articles: [],
          error: 'SCIENCE_INSIGHT_FAILED'
        });
      }
    }

    if (route === 'science-classify') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var classifyLimit = Number((req.body && req.body.limit) || (req.query && req.query.limit) || 25);
        var classifyResult = await _science.classifyScientificArticlesBatch(classifyLimit);
        return res.status(200).json(classifyResult);
      } catch (error) {
        return res.status(500).json({
          ok: false,
          updated_articles: 0,
          scanned_articles: 0,
          warning: String(error.message || error),
          error: 'SCIENCE_CLASSIFY_FAILED'
        });
      }
    }

    if (route === 'nutrition-calc') {
      return handleNutritionCalc(req, res);
    }

    if (route === 'nutrition-plan') {
      return handleNutritionPlan(req, res);
    }

    if (route === 'krona-diet-generate')       return handleKronaDietGenerate(req, res);
    if (route === 'krona-diet-substitutions')  return handleKronaSubstitutions(req, res);
    if (route === 'krona-diet-swap')           return handleKronaSwap(req, res);
    if (route === 'krona-diet-remove-block')   return handleKronaRemoveBlock(req, res);
    if (route === 'krona-diet-adjust-portion') return handleKronaAdjustPortion(req, res);
    if (route === 'krona-diet-print')          return handleKronaPrint(req, res);
    if (route === 'kronia-exercise-details')   return handleKroniaExerciseDetails(req, res, user);

    return res.status(404).json({ error: 'rota científica não encontrada' });
  }, { max: 20, windowMs: 60000, category: 'ai_heavy_operation' }, user.id); });
};
