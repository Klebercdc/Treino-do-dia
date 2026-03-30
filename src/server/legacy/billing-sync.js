var cors = require('../apihelpers/_cors');
var auth = require('../apihelpers/_auth');
var rl   = require('../apihelpers/_ratelimit');
var plans = require('../apihelpers/_plans');
var billingProviders = require('../../lib/plans/billingProviders');
var planRules = require('../../lib/plans/planRules');
var { PLAN } = require('../../types/domain');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  return auth.requireAuth(req, res, function(user) {
    return rl.rateLimit(req, res, function() {
    var body = req.body || {};
    var provider = (body.provider || 'hotmart').toLowerCase();
    var targetPlan = planRules.toCanonicalPlan(body.targetPlan || PLAN.PRO);

    if (!['hotmart', 'kiwify'].includes(provider)) {
      return res.status(400).json({ error: 'provider inválido' });
    }
    if (![PLAN.PRO, PLAN.ULTRA].includes(targetPlan)) {
      return res.status(400).json({ error: 'targetPlan inválido' });
    }

    var checkoutUrl = billingProviders.getCheckoutUrl(provider, targetPlan, user.email);
    if (!checkoutUrl) return res.status(400).json({ error: 'checkout não configurado' });

    plans.supabaseRequest('PATCH', 'user_plans?user_id=eq.' + user.id, { updated_at: new Date().toISOString() }, function() {
      return res.status(200).json({
        checkoutUrl: checkoutUrl,
        targetPlan: targetPlan,
        provider: provider
      });
    });
    }, { max: 5, windowMs: 60000 }, user.id);
  });
};
