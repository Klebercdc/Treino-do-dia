var https = require('https');
var crypto = require('crypto');
var planRules = require('../src/lib/plans/planRules');
var { PLAN } = require('../src/types/domain');

var SUPABASE_URL = process.env.SUPABASE_URL;
var SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL) {
  throw new Error('[_plans] SUPABASE_URL não configurada.');
}

var FREE_AI_LIMIT = parseInt(process.env.FREE_AI_LIMIT || '15', 10);
var TRIAL_AI_LIMIT = parseInt(process.env.TRIAL_AI_LIMIT || '30', 10);

function getTrialDays(callback) {
  supabaseRpcRequest('get_trial_days', {}, function(err, value) {
    if (err) return callback(err, null);
    var trialDays = Number(value);
    if (!Number.isFinite(trialDays) || trialDays <= 0) trialDays = 7;
    callback(null, Math.floor(trialDays));
  });
}

function supabaseRequest(method, path, body, callback) {
  if (!SUPABASE_SERVICE_KEY) {
    return callback('[_plans] SUPABASE_SERVICE_KEY não configurada.', null);
  }
  var hostname = SUPABASE_URL.replace('https://', '').replace('http://', '').split('/')[0];
  var bodyStr = body ? JSON.stringify(body) : '';
  var headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
  if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

  var req = https.request({ hostname: hostname, path: '/rest/v1/' + path, method: method, headers: headers }, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      if (res.statusCode >= 400) return callback('Supabase HTTP ' + res.statusCode + ': ' + data, null);
      try { callback(null, JSON.parse(data || 'null')); }
      catch (e) { callback('JSON parse: ' + e.message, null); }
    });
  });
  req.on('error', function(e) { callback(e.message, null); });
  if (bodyStr) req.write(bodyStr);
  req.end();
}

function supabaseRpcRequest(functionName, body, callback) {
  return supabaseRequest('POST', 'rpc/' + functionName, body, callback);
}

function getCurrentMonthStart() {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function createDefaultTrialPlan(userId) {
  return {
    user_id: userId,
    plan: planRules.toDbPlan(PLAN.TRIAL_ULTRA_7_DAYS),
    ai_requests_used: 0,
    period_start: getCurrentMonthStart(),
    trial_started_at: new Date().toISOString()
  };
}

function getUserPlan(userId, callback) {
  supabaseRequest('GET', 'user_plans?user_id=eq.' + userId + '&select=*', null, function(err, rows) {
    if (err) return callback(err, null);

    if (rows && rows.length > 0) {
      var row = rows[0];
      var periodStart = new Date(row.period_start);
      var currentMonthStart = new Date(getCurrentMonthStart());
      if (periodStart < currentMonthStart) {
        supabaseRequest('PATCH', 'user_plans?user_id=eq.' + userId, {
          ai_requests_used: 0,
          period_start: getCurrentMonthStart(),
          updated_at: new Date().toISOString()
        }, function() {
          row.ai_requests_used = 0;
          callback(null, row);
        });
      } else {
        callback(null, row);
      }
      return;
    }

    var newPlan = createDefaultTrialPlan(userId);
    supabaseRequest('POST', 'user_plans', newPlan, function(e2, created) {
      if (e2) return callback(e2, null);
      callback(null, (created && created[0]) || newPlan);
    });
  });
}

function getPlanSnapshot(userId, callback) {
  supabaseRequest(
    'GET',
    'user_plan_access_snapshot?user_id=eq.' + userId + '&select=*',
    null,
    function(err, rows) {
      if (err) return callback(err, null);
      callback(null, rows && rows[0] ? rows[0] : null);
    }
  );
}

function resolveEffectivePlan(userId, planRow, callback) {
  getPlanSnapshot(userId, function(snapshotErr, snapshot) {
    if (!snapshotErr && snapshot && snapshot.effective_plan) {
      return callback({
        canonicalPlan: planRules.toCanonicalPlan(snapshot.effective_plan),
        patch: null,
        snapshot: snapshot,
        source: 'snapshot_sql',
        degraded: false
      });
    }

    return callback({
      canonicalPlan: PLAN.FREE,
      patch: null,
      snapshot: snapshot || null,
      source: 'degraded_free_without_snapshot',
      degraded: true
    });
  });
}

function maybePersistPlanPatch(userId, state, done) {
  if (!state.patch) return done();
  supabaseRequest('PATCH', 'user_plans?user_id=eq.' + userId, state.patch, function() { done(); });
}

function registerFeatureUsage(userId, featureKey, planAtUse, metadata) {
  var planAtUseDb = planRules.toDbPlan(planAtUse || PLAN.FREE);
  var eventKey = (metadata && (metadata.eventKey || metadata.requestId))
    ? String(metadata.eventKey || metadata.requestId)
    : crypto.randomUUID();
  supabaseRpcRequest('register_feature_usage', {
    p_user_id: userId,
    p_feature_key: featureKey,
    p_plan_at_use: planAtUseDb,
    p_quantity: 1,
    p_metadata: metadata || {},
    p_event_key: eventKey
  }, function(err) {
    if (err) {
      supabaseRequest('POST', 'feature_usage_logs', {
        user_id: userId,
        feature_key: featureKey,
        plan_at_use: planAtUseDb,
        quantity: 1,
        metadata: metadata || {},
        event_key: eventKey
      }, function() {});
    }
  });
}

function checkAndIncrementQuota(userId, res, next) {
  if (!SUPABASE_SERVICE_KEY) {
    console.warn('[plans] SUPABASE_SERVICE_KEY ausente — quota guard indisponível, acesso permitido.');
    return next({ ai_requests_used: 0, plan: 'free', _degraded: true });
  }

  getUserPlan(userId, function(err, planRow) {
    if (err) {
      console.error('[plans] erro ao verificar plano:', err, '— acesso permitido em modo degradado.');
      return next({ ai_requests_used: 0, plan: 'free', _degraded: true });
    }

    resolveEffectivePlan(userId, planRow, function(state) {
      maybePersistPlanPatch(userId, state, function() {
        var used = planRow.ai_requests_used || 0;
        var limit = planRules.getQuotaLimit(state.canonicalPlan, { free: FREE_AI_LIMIT, trial: TRIAL_AI_LIMIT });

        if (limit !== Infinity && used >= limit) {
          return res.status(402).json({
            error: state.canonicalPlan === PLAN.TRIAL_ULTRA_7_DAYS
              ? 'Limite do trial atingido. Faça upgrade para continuar.'
              : 'Limite do plano gratuito atingido. Faça upgrade para continuar.',
            code: 'QUOTA_EXCEEDED',
            used: used,
            limit: limit,
            plan: state.canonicalPlan
          });
        }

        var newUsed = used + 1;
        supabaseRequest('PATCH', 'user_plans?user_id=eq.' + userId, { ai_requests_used: newUsed, updated_at: new Date().toISOString() }, function() {
          planRow.ai_requests_used = newUsed;
          planRow.plan = planRules.toDbPlan(state.canonicalPlan);
          registerFeatureUsage(userId, 'ai_chat', state.canonicalPlan, { source: 'quota_increment' });
          next(planRow);
        });
      });
    });
  });
}

function getQuotaInfo(userId, callback) {
  if (!SUPABASE_SERVICE_KEY) {
    return callback('[_plans] quota guard indisponível: SUPABASE_SERVICE_KEY ausente.', null);
  }
  getUserPlan(userId, function(err, planRow) {
    if (err) return callback(err, null);

    resolveEffectivePlan(userId, planRow, function(state) {
      maybePersistPlanPatch(userId, state, function() {
        var used = planRow.ai_requests_used || 0;
        var limit = planRules.getQuotaLimit(state.canonicalPlan, { free: FREE_AI_LIMIT, trial: TRIAL_AI_LIMIT });
        var access = planRules.getPlanAccess(state.canonicalPlan);

        callback(null, {
          allowed: limit === Infinity ? true : used < limit,
          used: used,
          limit: limit,
          remaining: limit === Infinity ? Infinity : Math.max(0, limit - used),
          plan: state.canonicalPlan,
          features: access.features,
          effectivePlanSource: state.source || null,
          degradedMode: state.degraded === true
        });
      });
    });
  });
}

function requireFeatureAccess(userId, featureKey, res, next) {
  getQuotaInfo(userId, function(err, quotaInfo) {
    if (err) return res.status(500).json({ error: String(err) });

    if (!planRules.canAccessFeature(quotaInfo.plan, featureKey)) {
      return res.status(403).json({
        error: 'Feature bloqueada para o plano atual.',
        code: 'FEATURE_LOCKED',
        feature: featureKey,
        plan: quotaInfo.plan
      });
    }

    registerFeatureUsage(userId, featureKey, quotaInfo.plan, { source: 'feature_access' });
    next(quotaInfo);
  });
}

module.exports = {
  getUserPlan: getUserPlan,
  getPlanSnapshot: getPlanSnapshot,
  getTrialDays: getTrialDays,
  checkAndIncrementQuota: checkAndIncrementQuota,
  getQuotaInfo: getQuotaInfo,
  requireFeatureAccess: requireFeatureAccess,
  FREE_AI_LIMIT: FREE_AI_LIMIT,
  TRIAL_AI_LIMIT: TRIAL_AI_LIMIT,
  supabaseRequest: supabaseRequest,
  supabaseRpcRequest: supabaseRpcRequest
};
