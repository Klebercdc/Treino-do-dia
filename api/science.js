var cors = require('./_cors');
var auth = require('./_auth');
var science = require('../src/lib/science/scienceSyncService');
var scienceInsight = require('../src/lib/science/scienceInsightService');
var nutritionService = require('../src/lib/nutrition/nutritionService');

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

  var querySecret = req.query && req.query.secret ? String(req.query.secret).trim() : '';
  if (querySecret) return querySecret;

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
  return Boolean(provided) && provided === expected;
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
  if (pathname.endsWith('/science')) return 'science';

  return '';
}

function handleNutritionCalc(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  var payload = req.body || {};
  var result = nutritionService.calculateNutrition(payload);

  if (result.failSafe) {
    return res.status(200).json({
      ok: false,
      failSafe: true,
      limitedOrientation: result.limitedOrientation
    });
  }

  return res.status(200).json({ ok: true, failSafe: false, data: result });
}

function handleNutritionPlan(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var bodyPayload = parseJsonBodyIfNeeded(req);
  var queryPayload = req && req.query ? req.query : {};
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

  var payloadFinal = {
    sexo: pickValue(['sexo']),
    idade: toNumber(pickValue(['idade'])),
    peso: toNumber(pickValue(['peso', 'peso_kg', 'pesoKg'])),
    altura: toNumber(pickValue(['altura', 'altura_cm', 'alturaCm'])),
    nivelAtividade: pickValue(['nivelAtividade', 'nivel_atividade']),
    objetivo: pickValue(['objetivo']),
    refeicoesPorDia: toNumber(pickValue(['refeicoesPorDia', 'refeicoes_por_dia']))
  };

  var forwardedKeys = Object.keys(payloadFinal).filter(function(key) {
    return isNonEmptyValue(payloadFinal[key]);
  });
  console.log('[nutrition-plan] payload mapping', {
    forwardedKeys: forwardedKeys
  });

  var result = nutritionService.generateNutritionPlan(payloadFinal);

  if (result.failSafe) {
    return res.status(200).json({
      ok: false,
      failSafe: true,
      limitedOrientation: result.limitedOrientation
    });
  }

  return res.status(200).json({ ok: true, failSafe: false, data: result });
}

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  req.body = parseJsonBodyIfNeeded(req);

  var route = detectRoute(req);

  if (route === 'science-sync' && isValidCronSecret(req)) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
      var cronResult = await science.syncScientificTopics();
      return res.status(200).json(cronResult);
    } catch (error) {
      return res.status(200).json({ ok: false, inserted_articles: 0, inserted_evidence: 0, needs_review: 0, warning: String(error.message || error) });
    }
  }

  if (route === 'science-classify' && isValidCronSecret(req)) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
      var cronLimit = Number((req.body && req.body.limit) || (req.query && req.query.limit) || 25);
      var cronClassifyResult = await science.classifyScientificArticlesBatch(cronLimit);
      return res.status(200).json(cronClassifyResult);
    } catch (error) {
      return res.status(200).json({
        ok: false,
        updated_articles: 0,
        scanned_articles: 0,
        warning: String(error.message || error)
      });
    }
  }

  if (route === 'nutrition-plan' && isValidCronSecret(req)) {
    return handleNutritionPlan(req, res);
  }

  return auth.requireAuth(req, res, async function() {
    if (route === 'science-search') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var query = String((req.body && req.body.query) || '').trim();
        if (!query) return res.status(400).json({ error: 'query é obrigatório' });

        var items = await science.searchScientificArticles(query);
        return res.status(200).json({ query: query, items: items });
      } catch (error) {
        return res.status(200).json({ query: req.body && req.body.query, items: [], warning: String(error.message || error) });
      }
    }

    if (route === 'science-sync') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var syncResult = await science.syncScientificTopics();
        return res.status(200).json(syncResult);
      } catch (error) {
        return res.status(200).json({ ok: false, inserted_articles: 0, inserted_evidence: 0, needs_review: 0, warning: String(error.message || error) });
      }
    }

    if (route === 'science-review') {
      if (req.method !== 'GET') return res.status(405).end();
      try {
        var reviewItems = await science.listPendingReviews();
        return res.status(200).json({ items: reviewItems });
      } catch (error) {
        return res.status(200).json({ items: [], warning: String(error.message || error) });
      }
    }

    if (route === 'science-insight') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var topic = String((req.body && req.body.topic) || '').trim();
        if (!topic) return res.status(400).json({ error: 'topic é obrigatório' });

        var insight = await scienceInsight.getScienceInsightByTopic(topic);
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
        return res.status(200).json({
          topic: req.body && req.body.topic,
          warning: String(error.message || error),
          synthesis: null,
          evidence_level: null,
          top_articles: []
        });
      }
    }

    if (route === 'science-classify') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var classifyLimit = Number((req.body && req.body.limit) || (req.query && req.query.limit) || 25);
        var classifyResult = await science.classifyScientificArticlesBatch(classifyLimit);
        return res.status(200).json(classifyResult);
      } catch (error) {
        return res.status(200).json({
          ok: false,
          updated_articles: 0,
          scanned_articles: 0,
          warning: String(error.message || error)
        });
      }
    }

    if (route === 'nutrition-calc') {
      return handleNutritionCalc(req, res);
    }

    if (route === 'nutrition-plan') {
      return handleNutritionPlan(req, res);
    }

    return res.status(404).json({ error: 'rota científica não encontrada' });
  });
};
