const EVIDENCE_LEVELS = [
  { key: 'meta-analysis', label: 'Meta-analysis', baseScore: 95, patterns: [/\bmeta[-\s]?analysis\b/i, /\bmeta\s+analysis\b/i] },
  { key: 'systematic-review', label: 'Systematic Review', baseScore: 88, patterns: [/\bsystematic\s+review\b/i, /\bpooled\s+analysis\b/i] },
  { key: 'randomized-controlled-trial', label: 'Randomized Controlled Trial', baseScore: 80, patterns: [/\brandomi[sz]ed\b/i, /\bcontrolled\s+trial\b/i, /\brct\b/i] },
  { key: 'cohort', label: 'Cohort Study', baseScore: 68, patterns: [/\bcohort\b/i, /\bprospective\b/i, /\blongitudinal\b/i, /\bfollow[-\s]?up\b/i] },
  { key: 'case-study', label: 'Case Study', baseScore: 54, patterns: [/\bcase\s+report\b/i, /\bcase\s+study\b/i, /\bcase\s+series\b/i] },
  { key: 'narrative', label: 'Narrative Review', baseScore: 40, patterns: [/\breview\b/i, /\bnarrative\b/i, /\bexpert\s+opinion\b/i] }
];

function clampScore(value) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function getArticleText(article) {
  return `${article?.title || ''} ${article?.abstract || ''}`.trim();
}

function getEvidenceMatch(article) {
  const text = getArticleText(article);

  for (let i = 0; i < EVIDENCE_LEVELS.length; i += 1) {
    const level = EVIDENCE_LEVELS[i];
    const matched = level.patterns.some((pattern) => pattern.test(text));
    if (matched) return level;
  }

  return EVIDENCE_LEVELS[EVIDENCE_LEVELS.length - 1];
}

function getHeuristicAdjustments(text) {
  let adjustment = 0;

  if (/\bdouble[-\s]?blind\b/i.test(text)) adjustment += 4;
  if (/\bplacebo\b/i.test(text)) adjustment += 2;
  if (/\bpilot\b/i.test(text)) adjustment -= 5;
  if (/\bprotocol\b/i.test(text)) adjustment -= 8;
  if (/\banimal\s+study\b|\bmurine\b|\bmouse\b/i.test(text)) adjustment -= 10;
  if (/\bin\s+vitro\b/i.test(text)) adjustment -= 12;

  return adjustment;
}

function rankEvidence(article) {
  const text = getArticleText(article);
  const matchedLevel = getEvidenceMatch(article);
  const heuristicScore = matchedLevel.baseScore + getHeuristicAdjustments(text);

  return {
    level: matchedLevel.key,
    label: matchedLevel.label,
    evidence_score: clampScore(heuristicScore)
  };
}

module.exports = {
  EVIDENCE_LEVELS,
  rankEvidence
};
