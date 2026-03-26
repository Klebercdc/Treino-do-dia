var cors = require('./_cors');
var auth = require('./_auth');
var plans = require('./_plans');
var { buildAffiliateReference } = require('../src/lib/affiliate/commission');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  return auth.requireAuth(req, res, function(user) {
    var body = req.body || {};
    if (!body.referredUserId) return res.status(400).json({ error: 'referredUserId é obrigatório' });

    var reference = buildAffiliateReference({
      referrerUserId: user.id,
      referredUserId: body.referredUserId,
      level: body.level || 1
    });

    plans.supabaseRequest('POST', 'affiliate_referrals', reference, function(err, rows) {
      if (err) return res.status(500).json({ error: String(err) });
      return res.status(200).json({ ok: true, referral: rows && rows[0] ? rows[0] : reference });
    });
  });
};
