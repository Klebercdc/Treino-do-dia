var cors = require('./_cors');
var auth = require('./_auth');
var scienceInsight = require('../src/lib/science/scienceInsightService');

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  return auth.requireAuth(req, res, async function() {
    try {
      var topic = String((req.body && req.body.topic) || '').trim();
      if (!topic) return res.status(400).json({ error: 'topic é obrigatório' });

      var result = await scienceInsight.getScienceInsightByTopic(topic);
      if (!result.found) return res.status(404).json(result);

      return res.status(200).json({
        topic: result.topic,
        synthesis: result.synthesis,
        evidence_level: result.evidence_level,
        top_articles: result.top_articles,
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
  });
};
