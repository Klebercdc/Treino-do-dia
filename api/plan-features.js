var cors = require('./_cors');
var auth = require('./_auth');
var plans = require('./_plans');

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  return auth.requireAuth(req, res, function(user) {
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
  });
};
