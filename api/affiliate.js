var cors = require('../src/server/apihelpers/_cors');
var auth = require('../src/server/apihelpers/_auth');
var rl   = require('../src/server/apihelpers/_ratelimit');
var plans = require('../src/server/apihelpers/_plans');
var { buildAffiliateReference } = require('../src/lib/affiliate/commission');
var affiliateSaleHandler = require('../src/server/legacy/affiliate-sale');
var billingSyncHandler = require('../src/server/legacy/billing-sync');

function handleAffiliateReferral(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  return auth.requireAuth(req, res, function(user) {
    return rl.rateLimit(req, res, function() {
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
    }, { max: 10, windowMs: 60000 }, user.id);
  });
}

function handleAffiliateCommissions(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return auth.requireAuth(req, res, function(user) {
    return rl.rateLimit(req, res, function() {
      plans.supabaseRequest(
        'GET',
        'affiliate_commissions?affiliate_user_id=eq.' + user.id + '&select=*&order=created_at.desc',
        null,
        function(err, rows) {
          if (err) return res.status(500).json({ error: String(err) });
          return res.status(200).json({ items: rows || [] });
        }
      );
    }, { max: 10, windowMs: 60000 }, user.id);
  });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var route = (req.query && req.query.__route) || 'affiliate-referral';
  switch (route) {
    case 'affiliate-sale':
      return affiliateSaleHandler(req, res);
    case 'billing-sync':
      return billingSyncHandler(req, res);
    case 'affiliate-commissions':
      return handleAffiliateCommissions(req, res);
    case 'affiliate-referral':
    default:
      return handleAffiliateReferral(req, res);
  }
};
