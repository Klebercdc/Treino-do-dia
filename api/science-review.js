var cors = require('./_cors');
var plans = require('./_plans');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  var body = req.body || {};
  if (!body.articleId || !['approved', 'rejected'].includes(body.decision)) {
    return res.status(400).json({ error: 'payload inválido' });
  }

  plans.supabaseRequest('PATCH', 'scientific_articles?id=eq.' + body.articleId, {
    review_status: body.decision,
    reviewed_at: new Date().toISOString()
  }, function(err) {
    if (err) return res.status(500).json({ error: String(err) });
    return res.status(200).json({ ok: true });
  });
};
