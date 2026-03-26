var cors = require('./_cors');
var auth = require('./_auth');
var nutritionService = require('../src/lib/nutrition/nutritionService');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  return auth.requireAuth(req, res, function() {
    var payload = req.body || {};
    var result = nutritionService.generateNutritionPlan(payload);

    if (result.failSafe) {
      return res.status(200).json({
        ok: false,
        failSafe: true,
        limitedOrientation: result.limitedOrientation
      });
    }

    return res.status(200).json({ ok: true, failSafe: false, data: result });
  });
};
