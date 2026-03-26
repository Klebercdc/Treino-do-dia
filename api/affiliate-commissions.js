var cors = require('./_cors');
var auth = require('./_auth');
var plans = require('./_plans');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  return auth.requireAuth(req, res, function(user) {
    plans.supabaseRequest(
      'GET',
      'affiliate_commissions?affiliate_user_id=eq.' + user.id + '&select=*&order=created_at.desc',
      null,
      function(err, rows) {
        if (err) return res.status(500).json({ error: String(err) });
        return res.status(200).json({ items: rows || [] });
      }
    );
  });
};
