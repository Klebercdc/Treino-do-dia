var cors = require('./_cors');
var scienceSync = require('../src/lib/science/scienceSyncService');
var plans = require('./_plans');

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    var query = (req.body && req.body.query) || 'resistance training hypertrophy meta analysis';
    var suggestions = await scienceSync.collectScientificSuggestions(query);

    for (var i = 0; i < suggestions.length; i += 1) {
      var row = suggestions[i];
      await new Promise(function(resolve) {
        plans.supabaseRequest('POST', 'scientific_articles', {
          source: row.source,
          external_id: row.external_id,
          title: row.title,
          doi: row.doi,
          published_at: row.published_at,
          metadata: row.raw_payload,
          review_status: 'pending_review'
        }, function() { resolve(); });
      });
    }

    return res.status(200).json({ ok: true, inserted: suggestions.length });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
};
