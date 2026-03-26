const { rankEvidence } = require('./evidenceRanker');

function safeDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
}

function getRecencyScore(publishedAt) {
  const published = safeDate(publishedAt);
  if (!published) return 45;

  const now = new Date();
  const years = Math.max(0, (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

  if (years <= 2) return 100;
  if (years <= 5) return Math.round(100 - (years - 2) * 7);
  if (years <= 10) return Math.round(79 - (years - 5) * 5);
  if (years <= 20) return Math.round(54 - (years - 10) * 1.8);
  return 35;
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractScientificSnippet(article) {
  const abstractSentences = splitSentences(article.abstract || '');
  if (abstractSentences.length) return abstractSentences[0];
  return String(article.title || '').trim();
}

function detectDivergence(article) {
  const text = `${article.title || ''} ${article.abstract || ''}`;
  return /\bhowever\b|\bmixed\b|\binconclusive\b|\bconflict(?:ing)?\b|\bunclear\b|\bno significant\b/i.test(text);
}

function computeCombinedScore(relevanceScore, evidenceScore, recencyScore) {
  const relevance = Math.max(0, Math.min(100, Number(relevanceScore || 0) * 100));
  return Math.round((relevance * 0.4) + (evidenceScore * 0.4) + (recencyScore * 0.2));
}

function getConfidenceLevel(weightedMean, highEvidenceRatio) {
  if (weightedMean >= 78 && highEvidenceRatio >= 0.5) return 'high';
  if (weightedMean >= 60) return 'moderate';
  return 'low';
}

function synthesizeTopic(topicName, evidenceRows) {
  const rows = Array.isArray(evidenceRows) ? evidenceRows : [];
  const ranked = rows.map((row) => {
    const article = row.article || {};
    const rankedEvidence = rankEvidence(article);
    const recency = getRecencyScore(article.published_at);
    const combined = computeCombinedScore(row.relevance_score, rankedEvidence.evidence_score, recency);

    return {
      topic: topicName,
      relevance_score: Number(row.relevance_score || 0),
      evidence_score: rankedEvidence.evidence_score,
      evidence_level: rankedEvidence.label,
      recency_score: recency,
      combined_score: combined,
      divergence_signal: detectDivergence(article),
      snippet: extractScientificSnippet(article),
      article: {
        id: article.id,
        title: article.title || 'Sem título',
        abstract: article.abstract || null,
        published_at: article.published_at || null,
        doi: article.doi || null,
        pmid: article.pmid || null,
        journal: article.journal || null
      }
    };
  });

  ranked.sort((a, b) => b.combined_score - a.combined_score);

  const top = ranked.slice(0, 5);
  const divergences = ranked.filter((item) => item.divergence_signal).slice(0, 3);

  const weightedMean = ranked.length
    ? ranked.reduce((acc, item) => acc + item.combined_score, 0) / ranked.length
    : 0;
  const highEvidenceCount = ranked.filter((item) => item.evidence_score >= 80).length;
  const highEvidenceRatio = ranked.length ? highEvidenceCount / ranked.length : 0;

  const confidence = getConfidenceLevel(weightedMean, highEvidenceRatio);

  const consensusPoints = top
    .map((item) => item.snippet)
    .filter(Boolean)
    .slice(0, 3);

  const divergencePoints = divergences.map((item) => item.snippet).filter(Boolean);

  const summaryParts = [];
  if (consensusPoints.length) {
    summaryParts.push(`Consenso atual em ${topicName}: ${consensusPoints[0]}`);
  } else {
    summaryParts.push(`Ainda há pouca evidência consolidada para ${topicName}.`);
  }

  if (divergencePoints.length) {
    summaryParts.push(`Há divergências relevantes: ${divergencePoints[0]}`);
  }

  summaryParts.push(`Confiança geral ${confidence}, com score médio ${Math.round(weightedMean)} de 100.`);

  const highestEvidence = ranked[0] ? ranked[0].evidence_level : 'Narrative Review';

  return {
    topic: topicName,
    summary: summaryParts.join(' '),
    confidence_level: confidence,
    evidence_level: highestEvidence,
    consensus: consensusPoints,
    divergences: divergencePoints,
    top_articles: top.map((item) => ({
      ...item.article,
      relevance_score: item.relevance_score,
      evidence_score: item.evidence_score,
      recency_score: item.recency_score,
      combined_score: item.combined_score,
      evidence_level: item.evidence_level
    }))
  };
}

module.exports = {
  getRecencyScore,
  synthesizeTopic
};
