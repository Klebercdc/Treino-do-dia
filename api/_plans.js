/**
 * Helper de planos — verifica quota de IA e plano do usuário.
 *
 * Planos:
 *   free → FREE_AI_LIMIT requisições de IA por mês
 *   pro  → ilimitado
 *
 * Variáveis de ambiente obrigatórias (configure via: vercel env add):
 *   SUPABASE_URL          = URL do projeto Supabase (ex: https://xyz.supabase.co)
 *   SUPABASE_SERVICE_KEY  = chave service_role — NUNCA expor no frontend
 */

var https = require('https');

var SUPABASE_URL        = process.env.SUPABASE_URL;
var SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL) {
  throw new Error('[_plans] SUPABASE_URL não configurada. Adicione a variável de ambiente no Vercel.');
}
var FREE_AI_LIMIT       = parseInt(process.env.FREE_AI_LIMIT || '15', 10); // req/mês grátis
var TRIAL_AI_LIMIT      = parseInt(process.env.TRIAL_AI_LIMIT || '30', 10); // req durante trial
var TRIAL_DAYS          = parseInt(process.env.TRIAL_DAYS || '7', 10);

// ─── HTTP helper simples para Supabase REST ─────────
function supabaseRequest(method, path, body, callback) {
  var hostname = SUPABASE_URL.replace('https://', '').replace('http://', '').split('/')[0];
  var bodyStr  = body ? JSON.stringify(body) : '';
  var headers  = {
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation'
  };
  if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

  var options = { hostname: hostname, path: '/rest/v1/' + path, method: method, headers: headers };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      if (res.statusCode >= 400) return callback('Supabase HTTP ' + res.statusCode + ': ' + data, null);
      try { callback(null, JSON.parse(data || 'null')); }
      catch(e) { callback('JSON parse: ' + e.message, null); }
    });
  });
  req.on('error', function(e) { callback(e.message, null); });
  if (bodyStr) req.write(bodyStr);
  req.end();
}

/**
 * Busca ou cria o plano do usuário.
 * @param {string}   userId
 * @param {function} callback - function(err, planRow)
 */
function getUserPlan(userId, callback) {
  // Busca plano existente
  supabaseRequest('GET', 'user_plans?user_id=eq.' + userId + '&select=*', null, function(err, rows) {
    if (err) return callback(err, null);

    if (rows && rows.length > 0) {
      var row = rows[0];
      // Reset mensal automático se necessário
      var periodStart = new Date(row.period_start);
      var now = new Date();
      var currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      if (periodStart < currentMonthStart) {
        var updateBody = { ai_requests_used: 0, period_start: currentMonthStart.toISOString(), updated_at: now.toISOString() };
        supabaseRequest('PATCH', 'user_plans?user_id=eq.' + userId, updateBody, function(e, updated) {
          if (e) return callback(null, row); // ignora erro de reset, continua com dado antigo
          var fresh = (updated && updated[0]) || row;
          fresh.ai_requests_used = 0;
          callback(null, fresh);
        });
      } else {
        callback(null, row);
      }
    } else {
      // Cria plano free (caso trigger não tenha rodado)
      var newPlan = { user_id: userId, plan: 'free', ai_requests_used: 0, period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() };
      supabaseRequest('POST', 'user_plans', newPlan, function(e2, created) {
        if (e2) return callback(e2, null);
        callback(null, (created && created[0]) || newPlan);
      });
    }
  });
}

/**
 * Verifica se o usuário pode fazer uma requisição de IA.
 * Se sim, incrementa o contador e chama next(planRow).
 * Se não (quota esgotada), responde 402 com erro.
 *
 * @param {string}   userId
 * @param {object}   res    - Vercel response object
 * @param {function} next   - function(planRow)
 */
function checkAndIncrementQuota(userId, res, next) {
  if (!SUPABASE_SERVICE_KEY) {
    // Sem chave de serviço: não bloqueia (dev mode)
    return next({ plan: 'free', ai_requests_used: 0 });
  }

  getUserPlan(userId, function(err, plan) {
    if (err) {
      // Em caso de erro ao verificar plano, não bloqueia mas loga
      console.error('[plans] erro ao verificar plano:', err);
      return next({ plan: 'free', ai_requests_used: 0 });
    }

    var planName  = plan.plan || 'free';
    var used      = plan.ai_requests_used || 0;
    var isExpired = plan.expires_at && new Date(plan.expires_at) < new Date();

    // Planos ilimitados — passa direto
    var isUnlimited = (planName === 'pro' || planName === 'ultra');

    // Pro/Ultra expirado → downgrade para free
    if (isUnlimited && isExpired) {
      supabaseRequest('PATCH', 'user_plans?user_id=eq.' + userId, { plan: 'free', updated_at: new Date().toISOString() }, function() {});
      isUnlimited = false;
      planName = 'free';
    }

    // Trial: 7 dias + limite de requisições
    var isTrial = (planName === 'trial');
    if (isTrial) {
      var trialStart   = plan.trial_started_at ? new Date(plan.trial_started_at) : null;
      var trialExpired = trialStart ? ((Date.now() - trialStart.getTime()) > TRIAL_DAYS * 86400000) : true;
      if (trialExpired) {
        supabaseRequest('PATCH', 'user_plans?user_id=eq.' + userId, { plan: 'free', updated_at: new Date().toISOString() }, function() {});
        isTrial = false;
        planName = 'free';
      }
    }

    var effectiveLimit = isTrial ? TRIAL_AI_LIMIT : FREE_AI_LIMIT;

    if (!isUnlimited && !isTrial && used >= FREE_AI_LIMIT) {
      return res.status(402).json({
        error: 'Limite do plano gratuito atingido (' + FREE_AI_LIMIT + ' consultas/mês). Faça upgrade para o Pro.',
        code:  'QUOTA_EXCEEDED',
        used:  used,
        limit: FREE_AI_LIMIT,
        plan:  planName
      });
    }

    if (isTrial && used >= TRIAL_AI_LIMIT) {
      return res.status(402).json({
        error: 'Limite do trial atingido (' + TRIAL_AI_LIMIT + ' consultas). Faça upgrade para continuar.',
        code:  'QUOTA_EXCEEDED',
        used:  used,
        limit: TRIAL_AI_LIMIT,
        plan:  'trial'
      });
    }

    // Incrementa contador
    var newUsed = used + 1;
    supabaseRequest('PATCH', 'user_plans?user_id=eq.' + userId,
      { ai_requests_used: newUsed, updated_at: new Date().toISOString() },
      function(patchErr) {
        if (patchErr) console.error('[plans] erro ao incrementar quota:', patchErr);
        plan.ai_requests_used = newUsed;
        next(plan);
      }
    );
  });
}

/**
 * Middleware Vercel: exige autenticação + verifica quota de IA.
 * Uso: checkQuota(user.id, res, function(plan) { ... })
 */
/**
 * Retorna informações de quota sem modificar o estado.
 * Útil para mostrar preview antes do paywall.
 * @param {string}   userId
 * @param {function} callback - function(err, { allowed, used, limit, remaining, plan })
 */
function getQuotaInfo(userId, callback) {
  getUserPlan(userId, function(err, plan) {
    if (err) return callback(err, null);

    var planName  = plan.plan || 'free';
    var used      = plan.ai_requests_used || 0;
    var isExpired = plan.expires_at && new Date(plan.expires_at) < new Date();
    var isUnlimited = (planName === 'pro' || planName === 'ultra') && !isExpired;

    if (isUnlimited) {
      return callback(null, { allowed: true, used: used, limit: Infinity, remaining: Infinity, plan: planName });
    }

    var isTrial = (planName === 'trial');
    var trialStart = plan.trial_started_at ? new Date(plan.trial_started_at) : null;
    var trialExpired = isTrial && trialStart ? ((Date.now() - trialStart.getTime()) > TRIAL_DAYS * 86400000) : true;
    if (isTrial && trialExpired) { isTrial = false; planName = 'free'; }

    var limit = isTrial ? TRIAL_AI_LIMIT : FREE_AI_LIMIT;
    var allowed = used < limit;

    callback(null, {
      allowed:   allowed,
      used:      used,
      limit:     limit,
      remaining: Math.max(0, limit - used),
      plan:      planName
    });
  });
}

module.exports = {
  getUserPlan:            getUserPlan,
  checkAndIncrementQuota: checkAndIncrementQuota,
  getQuotaInfo:           getQuotaInfo,
  FREE_AI_LIMIT:          FREE_AI_LIMIT,
  TRIAL_AI_LIMIT:         TRIAL_AI_LIMIT,
  supabaseRequest:        supabaseRequest
};
