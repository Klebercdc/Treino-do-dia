var cors = require('./_cors');
var auth = require('./_auth');
var science = require('../src/lib/science/scienceSyncService');

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  return auth.requireAuth(req, res, async function() {
    try {
      var query = String((req.body && req.body.query) || '').trim();
      if (!query) return res.status(400).json({ error: 'query é obrigatório' });

      var items = await science.searchScientificArticles(query);
      return res.status(200).json({ query: query, items: items });
    } catch (error) {
      return res.status(200).json({ query: req.body && req.body.query, items: [], warning: String(error.message || error) });
    }
  });
};
