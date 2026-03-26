var cors = require('./_cors');
var auth = require('./_auth');
var plans = require('./_plans');
var planRules = require('../src/lib/plans/planRules');

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  return auth.requireAuth(req, res, function(user) {
    plans.getTrialDays(function(tdErr, trialDays) {
      var safeTrialDays = tdErr ? 7 : trialDays;
      plans.getUserPlan(user.id, function(err, planRow) {
        if (err) return res.status(500).json({ error: String(err) });

        plans.getQuotaInfo(user.id, function(qErr, info) {
          if (qErr) return res.status(500).json({ error: String(qErr) });

          plans.getPlanSnapshot(user.id, function(sErr, snapshot) {
            var rawPlanDb = snapshot ? snapshot.raw_plan : planRow.plan;
            var effectivePlanDb = snapshot ? snapshot.effective_plan : null;

            if (sErr) {
              return res.status(200).json({
                plan: info.plan,
                rawPlan: rawPlanDb,
                rawPlanCanonical: planRules.toCanonicalPlan(rawPlanDb),
                aiRequestsUsed: planRow.ai_requests_used || 0,
                trialStartedAt: planRow.trial_started_at || null,
                expiresAt: planRow.expires_at || null,
                trialDays: safeTrialDays
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
              trialExpiresAt: snapshot ? snapshot.trial_expires_at : null,
              expiresAt: planRow.expires_at || null,
              subscriptionActive: snapshot ? snapshot.subscription_active : null,
              trialDays: safeTrialDays
            });
          });
        });
      });
    });
  });
};
