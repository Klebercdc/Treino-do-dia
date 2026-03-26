var cors = require('./_cors');
var auth = require('./_auth');
var science = require('../src/lib/science/scienceSyncService');

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  return auth.requireAuth(req, res, async function() {
    try {
      var result = await science.syncScientificTopics();
      return res.status(200).json(result);
    } catch (error) {
      return res.status(200).json({ ok: false, inserted_articles: 0, inserted_evidence: 0, needs_review: 0, warning: String(error.message || error) });
    }
  });
};
