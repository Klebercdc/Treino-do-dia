var cors = require('./_cors');
var plans = require('./_plans');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  var status = (req.query && req.query.status) || 'pending_review';
  plans.supabaseRequest('GET', 'scientific_articles?review_status=eq.' + status + '&select=id,title,source,doi,published_at,review_status&order=created_at.desc', null, function(err, rows) {
    if (err) return res.status(500).json({ error: String(err) });
    return res.status(200).json({ items: rows || [] });
  });
};
