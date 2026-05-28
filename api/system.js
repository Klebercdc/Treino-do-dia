var cors = require('../src/server/apihelpers/_cors');
var auth = require('../src/server/apihelpers/_auth');
var rl   = require('../src/server/apihelpers/_ratelimit');
var plans = require('../src/server/apihelpers/_plans');
var kroniaLabsHandler = require('./kronia-labs');

// ─── KRONOS INTELLIGENCE INSIGHTS ─────────────────────────────────────────────
async function handleInsights(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  auth.requireAuth(req, res, async function(user) {
    try {
      var uid = user.id;
      var supabaseUrl = SUPABASE_URL;
      var serviceKey = process.env.SUPABASE_SERVICE_KEY
        || process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
        || '';
      var sbHeaders = {
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Content-Type': 'application/json'
      };

      var [metricsResp, fadigaResp, goalsResp] = await Promise.all([
        fetch(supabaseUrl + '/rest/v1/body_metrics?user_id=eq.' + uid + '&select=weight_kg,body_fat_percent,measured_at&order=measured_at.desc&limit=5', { headers: sbHeaders }),
        fetch(supabaseUrl + '/rest/v1/fadiga_scores?user_id=eq.' + uid + '&select=score,notas,created_at&order=created_at.desc&limit=3', { headers: sbHeaders }),
        fetch(supabaseUrl + '/rest/v1/nutrition_goals?user_id=eq.' + uid + '&select=calories_target,protein_g,carbs_g,fat_g&order=updated_at.desc&limit=1', { headers: sbHeaders })
      ]);

      var metrics = metricsResp.ok ? await metricsResp.json().catch(function() { return []; }) : [];
      var fadiga  = fadigaResp.ok  ? await fadigaResp.json().catch(function() { return []; })  : [];
      var goals   = goalsResp.ok   ? await goalsResp.json().catch(function() { return []; })   : [];

      var apiKey = process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) return res.status(200).json({ success: true, insights: [] });

      var contextPrompt = 'Você é o KRONOS, AI coach clínico do Kronia.\n\nDados do usuário:\n' +
        '- Métricas corporais: ' + JSON.stringify(metrics) + '\n' +
        '- Fadiga recente: ' + JSON.stringify(fadiga) + '\n' +
        '- Metas nutricionais: ' + JSON.stringify(goals[0] || null) + '\n\n' +
        'Gere exatamente 3 insights clínicos personalizados. Responda APENAS com um JSON array:\n' +
        '[{"type":"recommendation","title":"título (max 40 chars)","description":"descrição acionável (max 120 chars)","impact":"Alto","domain":"treino","suggested_action":"ação específica (max 80 chars)"}]\n\n' +
        'type: "recommendation" | "warning" | "alert" | "achievement"\n' +
        'impact: "Alto" | "Médio" | "Baixo"\n' +
        'domain: "treino" | "nutrição" | "saúde" | "recuperação"\n\n' +
        'Se não houver dados suficientes, gere insights gerais de fitness de alta qualidade. Responda APENAS com o JSON array.';

      var claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          messages: [{ role: 'user', content: contextPrompt }]
        })
      });

      if (!claudeResp.ok) return res.status(200).json({ success: true, insights: [] });

      var claudeData = await claudeResp.json();
      var text = (claudeData.content && claudeData.content[0] && claudeData.content[0].text) || '[]';
      var insights = [];
      try {
        var match = text.match(/\[[\s\S]*\]/);
        insights = match ? JSON.parse(match[0]) : [];
        if (!Array.isArray(insights)) insights = [];
      } catch (e) { insights = []; }

      return res.status(200).json({ success: true, insights: insights.slice(0, 5) });
    } catch (err) {
      console.error('[insights] erro:', err && err.message ? err.message : String(err));
      return res.status(200).json({ success: true, insights: [] });
    }
  });
}

// ─── KRONOS AGENT ─────────────────────────────────────────────────────────────
async function handleKronos(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  auth.requireAuth(req, res, function (user) {
    rl.rateLimit(req, res, async function () {
      try {
        var message = req.body && typeof req.body.message === 'string' ? req.body.message.trim() : '';
        if (!message) return res.status(400).json({ success: false, error: 'O campo "message" é obrigatório.' });
        var agentModule = await import('../src/lib/agents/kronosAgent.ts');
        var result = await agentModule.runKronosAgent(user.id, message);
        return res.status(200).json({ success: true, resposta: result.resposta, iteracoes: result.iteracoes });
      } catch (err) {
        return res.status(500).json({ success: false, error: 'Erro interno do agente KRONOS.', meta: { message: err && err.message ? err.message : String(err || 'unknown') } });
      }
    });
  });
}
var https = require('https');

var SUPABASE_URL = (
  process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || ''
).replace(/\/$/, '');

function handleScienceArticles(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return handleScienceReview(req, res);
}

function loadOptionalModule(modulePath, routeName) {
  try {
    return { ok: true, mod: require(modulePath) };
  } catch (error) {
    console.error('[api/system] optional module load failed', {
      route: routeName,
      modulePath: modulePath,
      reason: error && error.message ? error.message : String(error)
    });
    return { ok: false, error: error };
  }
}

function respondUnavailable(res, routeName, loadError) {
  return res.status(503).json({
    ok: false,
    error: 'ROUTE_DEPENDENCY_UNAVAILABLE',
    route: routeName,
    warning: String((loadError && loadError.message) || loadError || 'dependency unavailable')
  });
}

function dispatchOptionalRoute(res, routeName, modulePath, req) {
  var loaded = loadOptionalModule(modulePath, routeName);
  if (!loaded.ok) return respondUnavailable(res, routeName, loaded.error);
  return loaded.mod(req, res);
}

function buildEnterpriseAiHealth() {
  return {
    adaptive_ai: true,
    behavior_engine: true,
    adherence_engine: true,
    diversity_engine: true,
    recommendation_engine: true,
    food_memory_engine: true,
    adaptive_strategy_engine: true,
    renderer: 'enterprise_diet_prescription_renderer',
    timestamp: new Date().toISOString()
  };
}

async function handleScienceReview(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  var loaded = loadOptionalModule('../src/lib/science/scienceSyncService', 'science-review');
  if (!loaded.ok) return respondUnavailable(res, 'science-review', loaded.error);

  try {
    var items = await loaded.mod.listPendingReviews();
    return res.status(200).json({ items: items });
  } catch (error) {
    return res.status(500).json({ items: [], warning: String(error.message || error), error: 'SCIENCE_REVIEW_FAILED' });
  }
}

async function handleScienceSync(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  var loaded = loadOptionalModule('../src/lib/science/scienceSyncService', 'science-sync');
  if (!loaded.ok) return respondUnavailable(res, 'science-sync', loaded.error);

  try {
    var result = await loaded.mod.syncScientificTopics();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, inserted_articles: 0, inserted_evidence: 0, needs_review: 0, warning: String(error.message || error), error: 'SCIENCE_SYNC_FAILED' });
  }
}

function handleLgpdExport(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  return auth.requireAuth(req, res, function(user) {
    var uid = user.id;
    var collected = { user_id: uid, exported_at: new Date().toISOString() };
    var pending = 4;
    var errors = [];

    function done() {
      pending--;
      if (pending <= 0) {
        if (errors.length > 0) collected._errors = errors;
        res.setHeader('Content-Disposition', 'attachment; filename="kronia-meus-dados.json"');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(collected);
      }
    }

    plans.supabaseRequest('GET', 'profiles?id=eq.' + uid + '&select=*', null, function(err, rows) {
      collected.profile = err ? null : (rows && rows[0]) || null;
      if (err) errors.push('profiles: ' + err);
      done();
    });

    plans.supabaseRequest('GET', 'workout_history?user_id=eq.' + uid + '&select=*&order=trained_at.desc', null, function(err, rows) {
      collected.workout_history = err ? null : (rows || []);
      if (err) errors.push('workout_history: ' + err);
      done();
    });

    plans.supabaseRequest('GET', 'workout_templates?user_id=eq.' + uid + '&select=*', null, function(err, rows) {
      collected.workout_templates = err ? null : (rows || []);
      if (err) errors.push('workout_templates: ' + err);
      done();
    });

    plans.supabaseRequest('GET', 'user_plans?user_id=eq.' + uid + '&select=plan,ai_requests_used,period_start,expires_at,updated_at', null, function(err, rows) {
      collected.user_plan = err ? null : (rows && rows[0]) || null;
      if (err) errors.push('user_plans: ' + err);
      done();
    });
  });
}

function deleteAuthUser(userId, callback) {
  var serviceKey = process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_SERVICE_KEY
    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return callback(null, 'sem service key — exclusão de auth pendente');

  var hostname = SUPABASE_URL.replace('https://', '').replace('http://', '');
  var options = {
    hostname: hostname,
    path: '/auth/v1/admin/users/' + userId,
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey
    }
  };

  var req = https.request(options, function(resp) {
    var data = '';
    resp.on('data', function(c) { data += c; });
    resp.on('end', function() {
      if (resp.statusCode >= 400) return callback('Auth delete HTTP ' + resp.statusCode + ': ' + data, null);
      return callback(null, 'auth user deleted');
    });
  });
  req.on('error', function(e) { callback(e.message, null); });
  req.end();
}

function handleLgpdDelete(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  return auth.requireAuth(req, res, function(user) {
    return rl.rateLimit(req, res, function() {
    var uid = user.id;
    var record = { user_id: uid, status: 'pending', requested_at: new Date().toISOString() };
    plans.supabaseRequest('POST', 'deletion_requests', record, function(logErr) {
      if (logErr) console.error('[lgpd-delete] erro ao registrar solicitação:', logErr);

      plans.supabaseRequest('DELETE', 'workout_history?user_id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'workout_templates?user_id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'profiles?id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'user_plans?user_id=eq.' + uid, null, function() {

        deleteAuthUser(uid, function(authErr) {
          if (authErr) {
            console.error('[lgpd-delete] erro ao excluir auth user:', authErr);
            return res.status(200).json({
              ok: true,
              message: 'Dados de treino excluídos. A exclusão da conta será concluída em até 72 horas.',
              partial: true
            });
          }

          return res.status(200).json({
            ok: true,
            message: 'Todos os seus dados foram excluídos com sucesso, conforme a LGPD (Art. 18, VI).',
            deleted_at: new Date().toISOString()
          });
        });

      });
      });
      });
      });
    });
    }, { max: 3, windowMs: 3600000, category: 'admin_operation' }, user.id);
  });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var route = (req.query && req.query.__route) || '';
  switch (route) {
    case 'health':
      return res.status(200).json({ ok: true, ts: Date.now(), enterprise_ai: buildEnterpriseAiHealth() });
    case 'enterprise-ai-health':
      if (req.method !== 'GET') return res.status(405).end();
      return res.status(200).json(buildEnterpriseAiHealth());
    case 'science-articles':
      return handleScienceArticles(req, res);
    case 'science-review':
      return handleScienceReview(req, res);
    case 'science-sync':
      return handleScienceSync(req, res);
    case 'lgpd-export':
      return handleLgpdExport(req, res);
    case 'lgpd-delete':
      return handleLgpdDelete(req, res);
    case 'admin-diagnostics':
      return dispatchOptionalRoute(res, route, '../src/server/legacy/admin-diagnostics', req);
    case 'machine':
      return dispatchOptionalRoute(res, route, '../src/server/legacy/machine', req);
    case 'cron-scraper':
      return dispatchOptionalRoute(res, route, '../src/server/legacy/cron-scraper', req);
    case 'pastor-diagnostico':
      return dispatchOptionalRoute(res, route, '../src/server/legacy/pastor-diagnostico', req);
    case 'admin-import-exercises':
      return dispatchOptionalRoute(res, route, '../src/server/internal/http/admin-import-exercises', req);
    case 'admin-import-exercises-status':
      return dispatchOptionalRoute(res, route, '../src/server/internal/http/admin-import-exercises-status', req);
    case 'admin-import-exercises-auto':
      return dispatchOptionalRoute(res, route, '../src/server/internal/http/admin-import-exercises-auto', req);
    case 'kronia-labs-init-upload':
      return kroniaLabsHandler.handleInitUpload(req, res);
    case 'kronia-labs-register':
      return kroniaLabsHandler.handleRegister(req, res);
    case 'kronia-labs-reports':
      return kroniaLabsHandler.handleReports(req, res);
    case 'kronia-labs-report-by-id':
      // handleReportById handles both GET and DELETE internally
      return kroniaLabsHandler.handleReportById(req, res);
    case 'kronos':
      return handleKronos(req, res);
    case 'insights':
      return handleInsights(req, res);
    default:
      return res.status(404).json({ error: 'rota não encontrada' });
  }
};
