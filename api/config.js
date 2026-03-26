var cors = require('./_cors');
var plans = require('./_plans');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  plans.getTrialDays(function(tdErr, trialDays) {
    res.status(200).json({
      checkoutUrl: process.env.HOTMART_CHECKOUT_PRO_URL || process.env.CHECKOUT_URL || '',
      checkoutUrlUltra: process.env.HOTMART_CHECKOUT_ULTRA_URL || '',
      kiwifyCheckoutUrl: process.env.KIWIFY_CHECKOUT_PRO_URL || '',
      kiwifyCheckoutUrlUltra: process.env.KIWIFY_CHECKOUT_ULTRA_URL || '',
      freePlanLimit: parseInt(process.env.FREE_AI_LIMIT || '15', 10),
      trialDays: tdErr ? 7 : trialDays
    });
  });
};
