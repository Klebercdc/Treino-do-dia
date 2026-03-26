var cors = require('./_cors');
var auth = require('./_auth');
var science = require('../src/lib/science/scienceSyncService');

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  return auth.requireAuth(req, res, async function() {
    try {
      var items = await science.listPendingReviews();
      return res.status(200).json({ items: items });
    } catch (error) {
      return res.status(200).json({ items: [], warning: String(error.message || error) });
    }
  });
};
