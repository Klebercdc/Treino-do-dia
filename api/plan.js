var cors = require('./_cors');
var auth = require('./_auth');
var rl   = require('./_ratelimit');
var plans = require('./_plans');
var planRules = require('../src/lib/plans/planRules');

function handleConfig(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return plans.getTrialDays(function(tdErr, trialDays) {
    return res.status(200).json({
      checkoutUrl: process.env.HOTMART_CHECKOUT_PRO_URL || process.env.CHECKOUT_URL || '',
      checkoutUrlUltra: process.env.HOTMART_CHECKOUT_ULTRA_URL || '',
      kiwifyCheckoutUrl: process.env.KIWIFY_CHECKOUT_PRO_URL || '',
      kiwifyCheckoutUrlUltra: process.env.KIWIFY_CHECKOUT_ULTRA_URL || '',
      freePlanLimit: parseInt(process.env.FREE_AI_LIMIT || '15', 10),
      trialDays: tdErr ? 7 : trialDays
    });
  });
}

function handlePlanFeatures(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return auth.requireAuth(req, res, function(user) {
    return rl.rateLimit(req, res, function() {
      plans.getQuotaInfo(user.id, function(err, info) {
        if (err) return res.status(500).json({ error: String(err) });
        return res.status(200).json({
          plan: info.plan,
          features: info.features,
          quota: {
            used: info.used,
            limit: info.limit,
            remaining: info.remaining
          }
        });
      });
    }, { max: 10, windowMs: 60000 }, user.id);
  });
}

function handlePlanCurrent(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return auth.requireAuth(req, res, function(user) {
    return rl.rateLimit(req, res, function() {
    plans.getTrialDays(function(tdErr, trialDays) {
      var safeTrialDays = tdErr ? 7 : trialDays;
      plans.getUserPlan(user.id, function(err, planRow) {
        if (err) return res.status(500).json({ error: String(err) });

        plans.getQuotaInfo(user.id, function(qErr, info) {
          if (qErr) return res.status(500).json({ error: String(qErr) });

          plans.getPlanSnapshot(user.id, function(sErr, snapshot) {
            var rawPlanDb = snapshot ? snapshot.raw_plan : planRow.plan;
            var effectivePlanDb = snapshot ? snapshot.effective_plan : null;
            var canonicalPlan = info.plan;
            var trialStatus = {
              active: canonicalPlan === 'trial_ultra_7_days',
              expired: canonicalPlan !== 'trial_ultra_7_days' && planRules.toCanonicalPlan(rawPlanDb) === 'trial_ultra_7_days',
              daysLeft: null,
              hoursLeft: null,
              source: 'backend'
            };
            var trialExpiresAt = snapshot ? snapshot.trial_expires_at : null;
            if (trialStatus.active && trialExpiresAt) {
              var expiresTs = new Date(trialExpiresAt).getTime();
              if (Number.isFinite(expiresTs)) {
                var remainingMs = expiresTs - Date.now();
                var safeMs = remainingMs > 0 ? remainingMs : 0;
                trialStatus.daysLeft = Math.ceil(safeMs / (24 * 60 * 60 * 1000));
                trialStatus.hoursLeft = Math.floor(safeMs / (60 * 60 * 1000));
              }
            }

            if (sErr) {
              return res.status(200).json({
                plan: info.plan,
                rawPlan: rawPlanDb,
                rawPlanCanonical: planRules.toCanonicalPlan(rawPlanDb),
                aiRequestsUsed: planRow.ai_requests_used || 0,
                trialStartedAt: planRow.trial_started_at || null,
                expiresAt: planRow.expires_at || null,
                trialDays: safeTrialDays,
                trialStatus: trialStatus
              });
            }

            return res.status(200).json({
              plan: info.plan,
              rawPlan: rawPlanDb,
              rawPlanCanonical: planRules.toCanonicalPlan(rawPlanDb),
              effectivePlanDb: effectivePlanDb,
              effectivePlanCanonical: effectivePlanDb ? planRules.toCanonicalPlan(effectivePlanDb) : null,
              aiRequestsUsed: planRow.ai_requests_used || 0,
              trialStartedAt: planRow.trial_started_at || null,
              trialExpiresAt: trialExpiresAt,
              expiresAt: planRow.expires_at || null,
              subscriptionActive: snapshot ? snapshot.subscription_active : null,
              trialDays: safeTrialDays,
              trialStatus: trialStatus
            });
          });
        });
      });
    });
    }, { max: 10, windowMs: 60000 }, user.id);
  });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var route = (req.query && req.query.__route) || 'plan-current';
  switch (route) {
    case 'config':
      return handleConfig(req, res);
    case 'plan-features':
      return handlePlanFeatures(req, res);
    case 'plan-current':
    default:
      return handlePlanCurrent(req, res);
  }
};
