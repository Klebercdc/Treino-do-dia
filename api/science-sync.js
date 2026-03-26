var cors = require('./_cors');
var auth = require('./_auth');
var science = require('../src/lib/science/scienceSyncService');

function getCronSecret(req) {
  if (!req) return '';

  var querySecret = req.query && req.query.secret ? String(req.query.secret).trim() : '';
  if (querySecret) return querySecret;

  var headerSecret = req.headers && req.headers['x-cron-secret'] ? String(req.headers['x-cron-secret']).trim() : '';
  if (headerSecret) return headerSecret;

  var altHeaderSecret = req.headers && req.headers['cron-secret'] ? String(req.headers['cron-secret']).trim() : '';
  if (altHeaderSecret) return altHeaderSecret;

  return '';
}

function isValidCronSecret(req) {
  var expected = process.env.CRON_SECRET ? String(process.env.CRON_SECRET).trim() : '';
  if (!expected) return false;

  var provided = getCronSecret(req);
  return Boolean(provided) && provided === expected;
}

async function runScienceSync(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    var result = await science.syncScientificTopics();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(200).json({
      ok: false,
      inserted_articles: 0,
      inserted_evidence: 0,
      needs_review: 0,
      warning: String(error.message || error)
    });
  }
}

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (isValidCronSecret(req)) {
    return runScienceSync(req, res);
  }

  return auth.requireAuth(req, res, async function() {
    return runScienceSync(req, res);
  });
};
