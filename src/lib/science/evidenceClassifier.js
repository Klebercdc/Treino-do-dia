const EVIDENCE_TYPES = {
  GUIDELINE: 'guideline_or_position_stand',
  META_ANALYSIS: 'meta_analysis',
  SYSTEMATIC_REVIEW: 'systematic_review',
  RANDOMIZED_CONTROLLED_TRIAL: 'randomized_controlled_trial',
  COHORT_OBSERVATIONAL: 'cohort_or_observational',
  CASE_STUDY: 'case_study',
  NARRATIVE_REVIEW: 'narrative_review',
  UNKNOWN: 'unknown'
};

const EVIDENCE_SCORES = {
  [EVIDENCE_TYPES.GUIDELINE]: 95,
  [EVIDENCE_TYPES.META_ANALYSIS]: 92,
  [EVIDENCE_TYPES.SYSTEMATIC_REVIEW]: 88,
  [EVIDENCE_TYPES.RANDOMIZED_CONTROLLED_TRIAL]: 82,
  [EVIDENCE_TYPES.COHORT_OBSERVATIONAL]: 68,
  [EVIDENCE_TYPES.CASE_STUDY]: 45,
  [EVIDENCE_TYPES.NARRATIVE_REVIEW]: 35,
  [EVIDENCE_TYPES.UNKNOWN]: 20
};


function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function buildCombinedText(input) {
  return [
    input && input.title,
    input && input.abstract,
    input && input.journal,
    input && input.publisher,
    input && input.article_type,
    input && input.publication_type,
    input && input.type
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function classifyScientificEvidence(input) {
  const combinedText = buildCombinedText(input || {});

  const guidelinePatterns = [
    /\bguideline(s)?\b/,
    /\bclinical practice guideline(s)?\b/,
    /\bposition stand(s)?\b/,
    /\bconsensus\b/,
    /\bstatement\b/
  ];
  const metaPatterns = [/\bmeta[-\s]?analysis\b/, /\bmeta analysis\b/];
  const systematicPatterns = [/\bsystematic review\b/, /\bumbrella review\b/];
  const randomizedPatterns = [
    /\brandomi[sz]ed\b/,
    /\brandomi[sz]ed controlled trial\b/,
    /\brct\b/,
    /\bclinical trial\b/,
    /\bdouble[-\s]?blind\b/,
    /\bplacebo\b/
  ];
  const cohortPatterns = [
    /\bcohort\b/,
    /\bprospective\b/,
    /\bretrospective\b/,
    /\bobservational\b/,
    /\blongitudinal\b/
  ];
  const caseStudyPatterns = [/\bcase study\b/, /\bcase report\b/, /\bcase series\b/];
  const narrativeReviewPatterns = [/\bnarrative review\b/];
  const reviewPattern = /\breview\b/;

  if (hasAny(combinedText, guidelinePatterns)) {
    return buildClassification(EVIDENCE_TYPES.GUIDELINE, 'Palavras-chave de guideline/position stand/consensus detectadas.');
  }

  const hasMeta = hasAny(combinedText, metaPatterns);
  const hasSystematic = hasAny(combinedText, systematicPatterns);
  if (hasMeta) {
    return buildClassification(EVIDENCE_TYPES.META_ANALYSIS, 'Padrão explícito de meta-analysis detectado.');
  }

  if (hasSystematic) {
    return buildClassification(EVIDENCE_TYPES.SYSTEMATIC_REVIEW, 'Padrão explícito de systematic review detectado.');
  }

  if (hasAny(combinedText, randomizedPatterns)) {
    return buildClassification(EVIDENCE_TYPES.RANDOMIZED_CONTROLLED_TRIAL, 'Padrões de ensaio clínico randomizado detectados.');
  }

  if (hasAny(combinedText, cohortPatterns)) {
    return buildClassification(EVIDENCE_TYPES.COHORT_OBSERVATIONAL, 'Padrões de estudo observacional/coorte detectados.');
  }

  if (hasAny(combinedText, caseStudyPatterns)) {
    return buildClassification(EVIDENCE_TYPES.CASE_STUDY, 'Padrões de case study/report/series detectados.');
  }

  if (hasAny(combinedText, narrativeReviewPatterns)) {
    return buildClassification(EVIDENCE_TYPES.NARRATIVE_REVIEW, 'Padrão explícito de narrative review detectado.');
  }

  if (reviewPattern.test(combinedText)) {
    return buildClassification(EVIDENCE_TYPES.NARRATIVE_REVIEW, 'Detectado apenas termo genérico review sem evidência de systematic/meta-analysis.');
  }

  return buildClassification(EVIDENCE_TYPES.UNKNOWN, 'Sem padrões confiáveis para classificar o tipo de evidência.');
}

function buildClassification(classification, reason) {
  const evidenceScore = EVIDENCE_SCORES[classification] || EVIDENCE_SCORES[EVIDENCE_TYPES.UNKNOWN];
  const confidenceLabel = deriveConfidenceLabel(classification, evidenceScore);

  return {
    classification,
    evidence_score: evidenceScore,
    confidence_label: confidenceLabel,
    classification_reason: reason
  };
}

function deriveConfidenceLabel(classification, score) {
  if (classification === EVIDENCE_TYPES.UNKNOWN) return 'very_low';
  if (score >= 90) return 'very_high';
  if (score >= 80) return 'high';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'low';
  return 'very_low';
}

module.exports = {
  EVIDENCE_TYPES,
  EVIDENCE_SCORES,
  classifyScientificEvidence,
  deriveConfidenceLabel
};
