var cors = require('./_cors');
var auth = require('./_auth');
var science = require('../src/lib/science/scienceSyncService');
var scienceInsight = require('../src/lib/science/scienceInsightService');

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

function detectRoute(req) {
  var queryRoute = req.query && req.query.__route ? String(req.query.__route) : '';
  if (queryRoute) return queryRoute;

  var action = req.body && req.body.action ? String(req.body.action) : '';
  if (action) return action;

  var parsed = new URL(req.url || '', 'http://localhost');
  var pathname = parsed.pathname || '';

  if (pathname.endsWith('/science-search')) return 'science-search';
  if (pathname.endsWith('/science-sync')) return 'science-sync';
  if (pathname.endsWith('/science-review')) return 'science-review';
  if (pathname.endsWith('/science-insight')) return 'science-insight';
  if (pathname.endsWith('/science-classify')) return 'science-classify';
  if (pathname.endsWith('/science')) return 'science';

  return '';
}

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var route = detectRoute(req);

  if (route === 'science-sync' && isValidCronSecret(req)) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
      var cronResult = await science.syncScientificTopics();
      return res.status(200).json(cronResult);
    } catch (error) {
      return res.status(200).json({ ok: false, inserted_articles: 0, inserted_evidence: 0, needs_review: 0, warning: String(error.message || error) });
    }
  }

  if (route === 'science-classify' && isValidCronSecret(req)) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
      var cronLimit = Number((req.body && req.body.limit) || (req.query && req.query.limit) || 25);
      var cronResult = await science.classifyScientificArticlesBatch(cronLimit);
      return res.status(200).json(cronResult);
    } catch (error) {
      return res.status(200).json({
        ok: false,
        updated_articles: 0,
        scanned_articles: 0,
        warning: String(error.message || error)
      });
    }
  }

  return auth.requireAuth(req, res, async function() {
    if (route === 'science-search') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var query = String((req.body && req.body.query) || '').trim();
        if (!query) return res.status(400).json({ error: 'query é obrigatório' });

        var items = await science.searchScientificArticles(query);
        return res.status(200).json({ query: query, items: items });
      } catch (error) {
        return res.status(200).json({ query: req.body && req.body.query, items: [], warning: String(error.message || error) });
      }
    }

    if (route === 'science-sync') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var result = await science.syncScientificTopics();
        return res.status(200).json(result);
      } catch (error) {
        return res.status(200).json({ ok: false, inserted_articles: 0, inserted_evidence: 0, needs_review: 0, warning: String(error.message || error) });
      }
    }

    if (route === 'science-review') {
      if (req.method !== 'GET') return res.status(405).end();
      try {
        var reviewItems = await science.listPendingReviews();
        return res.status(200).json({ items: reviewItems });
      } catch (error) {
        return res.status(200).json({ items: [], warning: String(error.message || error) });
      }
    }

    if (route === 'science-insight') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var topic = String((req.body && req.body.topic) || '').trim();
        if (!topic) return res.status(400).json({ error: 'topic é obrigatório' });

        var insight = await scienceInsight.getScienceInsightByTopic(topic);
        if (!insight.found) return res.status(404).json(insight);

        return res.status(200).json({
          topic: insight.topic,
          synthesis: insight.synthesis,
          evidence_level: insight.evidence_level,
          top_articles: insight.top_articles,
          human_control_required: true,
          automation_blocked: true
        });
      } catch (error) {
        return res.status(200).json({
          topic: req.body && req.body.topic,
          warning: String(error.message || error),
          synthesis: null,
          evidence_level: null,
          top_articles: []
        });
      }
    }

    if (route === 'science-classify') {
      if (req.method !== 'POST') return res.status(405).end();
      try {
        var limit = Number((req.body && req.body.limit) || (req.query && req.query.limit) || 25);
        var result = await science.classifyScientificArticlesBatch(limit);
        return res.status(200).json(result);
      } catch (error) {
        return res.status(200).json({
          ok: false,
          updated_articles: 0,
          scanned_articles: 0,
          warning: String(error.message || error)
        });
      }
    }

    return res.status(404).json({ error: 'rota científica não encontrada' });
  });
};
