const { searchPubmedArticles } = require('./pubmedClient');
const { searchCrossrefByTitle } = require('./crossrefClient');
const { createSupabaseAdminClient } = require('../supabase/admin');
const { classifyScientificEvidence } = require('./evidenceClassifier');

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function jaccardSimilarity(left, right) {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function computeRelevance(topic, article) {
  const topicText = [topic.topic, ...(topic.keywords || [])].join(' ');
  const articleText = [article.title, article.abstract, article.journal].join(' ');
  const base = jaccardSimilarity(topicText, articleText);
  return Number(base.toFixed(4));
}

function computeRecencyScore(publishedAt) {
  if (!publishedAt) return 0.20;

  const ms = Date.now() - new Date(publishedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0.20;

  const ageDays = ms / (1000 * 60 * 60 * 24);
  if (ageDays <= 365) return 1.00;
  if (ageDays <= 365 * 3) return 0.80;
  if (ageDays <= 365 * 5) return 0.65;
  if (ageDays <= 365 * 8) return 0.50;
  if (ageDays <= 365 * 12) return 0.35;
  return 0.20;
}

function computeAiRankScore(relevanceScore, evidenceScore, publishedAt) {
  const relevanceNorm = Math.max(0, Math.min(1, Number(relevanceScore || 0)));
  const evidenceNorm = Math.max(0, Math.min(100, Number(evidenceScore || 20))) / 100;
  const recency = computeRecencyScore(publishedAt);

  const ranking = (relevanceNorm * 0.50) + (evidenceNorm * 0.35) + (recency * 0.15);
  return Number(ranking.toFixed(4));
}

async function safeCrossrefEnrichment(article) {
  try {
    const matches = await searchCrossrefByTitle(article.title || '', 3);
    const best = matches.find((item) => item.doi) || matches[0];
    if (!best) return article;

    return {
      ...article,
      doi: article.doi || best.doi || null,
      publisher: article.publisher || best.publisher || null,
      reference_count: best.reference_count,
      raw_payload_json: {
        pubmed: article.raw_payload_json,
        crossref: best.raw_payload_json
      }
    };
  } catch (_) {
    return article;
  }
}

async function searchScientificArticles(query) {
  const pubmedArticles = await searchPubmedArticles(query, 20);
  const enriched = [];

  for (let i = 0; i < pubmedArticles.length; i += 1) {
    const article = await safeCrossrefEnrichment(pubmedArticles[i]);
    const evidence = classifyScientificEvidence(article);

    enriched.push({
      ...article,
      ...evidence
    });
  }

  return enriched;
}

async function getExistingArticleByIdentifiers(client, pmid, doi) {
  const clauses = [];
  if (pmid) clauses.push(`pmid.eq.${encodeURIComponent(pmid)}`);
  if (doi) clauses.push(`doi.eq.${encodeURIComponent(doi)}`);
  if (!clauses.length) return null;

  const rows = await client.request('GET', `scientific_articles?or=(${clauses.join(',')})&select=*&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}

function buildArticlePayload(article) {
  const evidence = classifyScientificEvidence(article);

  return {
    source: article.source || 'pubmed',
    pmid: article.pmid || null,
    doi: article.doi || null,
    title: article.title || null,
    abstract: article.abstract || null,
    authors: Array.isArray(article.authors) ? article.authors : [],
    journal: article.journal || null,
    publisher: article.publisher || null,
    published_at: article.published_at || null,
    classification: evidence.classification,
    evidence_score: evidence.evidence_score,
    confidence_label: evidence.confidence_label,
    classification_reason: evidence.classification_reason,
    raw_payload_json: article.raw_payload_json || {}
  };
}

async function saveArticle(client, article) {
  const existing = await getExistingArticleByIdentifiers(client, article.pmid, article.doi);
  const payload = buildArticlePayload(article);

  if (existing) {
    const mergedPayload = {
      ...payload,
      raw_payload_json: {
        ...(existing.raw_payload_json || {}),
        ...(payload.raw_payload_json || {})
      }
    };

    const updated = await client.request('PATCH', `scientific_articles?id=eq.${existing.id}`, mergedPayload);
    return { row: (updated && updated[0]) || { ...existing, ...mergedPayload }, isNew: false };
  }

  const created = await client.request('POST', 'scientific_articles', payload);
  return { row: (created && created[0]) || payload, isNew: true };
}

async function fetchTopicEvidences(client, topicId) {
  return client.request(
    'GET',
    `scientific_evidence?topic_id=eq.${topicId}&select=id,summary,created_at,relevance_score,needs_review,article:scientific_articles(id,title,abstract,published_at)&order=created_at.desc`
  );
}

function shouldFlagReview({ topic, article, relevanceScore, isNewArticle, existingEvidences }) {
  const hasEvidence = Array.isArray(existingEvidences) && existingEvidences.length > 0;
  if (!hasEvidence) return false;

  if (isNewArticle && relevanceScore >= 0.12) {
    return true;
  }

  const latest = existingEvidences[0];
  const latestText = `${latest?.article?.title || ''} ${latest?.article?.abstract || ''}`;
  const currentText = `${article.title || ''} ${article.abstract || ''}`;
  const similarity = jaccardSimilarity(latestText, currentText);

  return relevanceScore >= 0.08 && similarity < 0.18;
}

async function upsertEvidence(client, topic, articleRow, relevanceScore, needsReview) {
  const aiRankScore = computeAiRankScore(relevanceScore, articleRow.evidence_score, articleRow.published_at);
  const recencyScore = computeRecencyScore(articleRow.published_at);
  const summary = `Evidência para o tópico "${topic.topic}" com relevance_score ${relevanceScore}, evidence_score ${articleRow.evidence_score || 'N/A'} e classificação ${articleRow.classification || 'unknown'}. Revisão manual obrigatória antes de qualquer mudança de regra.`;

  const already = await client.request(
    'GET',
    `scientific_evidence?topic_id=eq.${topic.id}&article_id=eq.${articleRow.id}&select=id,needs_review&limit=1`
  );

  if (already && already[0]) {
    const current = already[0];
    const updatedNeedsReview = Boolean(current.needs_review || needsReview);

    await client.request('PATCH', `scientific_evidence?id=eq.${current.id}`, {
      relevance_score: relevanceScore,
      summary,
      needs_review: updatedNeedsReview,
      ai_rank_score: aiRankScore,
      recency_score: recencyScore
    });

    return { created: false, needsReview: updatedNeedsReview };
  }

  await client.request('POST', 'scientific_evidence', {
    topic_id: topic.id,
    article_id: articleRow.id,
    relevance_score: relevanceScore,
    summary,
    needs_review: needsReview,
    ai_rank_score: aiRankScore,
    recency_score: recencyScore
  });

  return { created: true, needsReview };
}

async function syncScientificTopics() {
  const client = createSupabaseAdminClient();
  const topics = await client.request('GET', 'scientific_topics?select=*');

  let insertedArticles = 0;
  let insertedEvidence = 0;
  let needsReviewCount = 0;

  for (let i = 0; i < (topics || []).length; i += 1) {
    const topic = topics[i];
    const searchQuery = [topic.topic, ...(topic.keywords || [])].join(' ').trim();
    if (!searchQuery) continue;

    let articles = [];
    try {
      articles = await searchScientificArticles(searchQuery);
    } catch (_) {
      articles = [];
    }

    const existingEvidences = await fetchTopicEvidences(client, topic.id);

    for (let j = 0; j < articles.length; j += 1) {
      const article = articles[j];
      const relevanceScore = computeRelevance(topic, article);
      if (relevanceScore < 0.05) continue;

      const { row, isNew } = await saveArticle(client, article);
      if (isNew) insertedArticles += 1;

      const needsReview = shouldFlagReview({
        topic,
        article,
        relevanceScore,
        isNewArticle: isNew,
        existingEvidences
      });

      const evidenceResult = await upsertEvidence(client, topic, row, relevanceScore, needsReview);
      if (evidenceResult.created) insertedEvidence += 1;
      if (evidenceResult.needsReview) needsReviewCount += 1;
    }
  }

  return {
    ok: true,
    inserted_articles: insertedArticles,
    inserted_evidence: insertedEvidence,
    needs_review: needsReviewCount
  };
}

async function listPendingReviews() {
  const client = createSupabaseAdminClient();
  const rows = await client.request(
    'GET',
    'scientific_evidence?needs_review=eq.true&select=id,relevance_score,recency_score,ai_rank_score,summary,created_at,topic:scientific_topics(id,topic,keywords),article:scientific_articles(id,source,pmid,doi,title,abstract,journal,publisher,published_at,classification,evidence_score,confidence_label,classification_reason)&order=ai_rank_score.desc.nullslast,created_at.desc'
  );

  return rows || [];
}

function clampBatchLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 25;
  if (parsed < 1) return 1;
  if (parsed > 50) return 50;
  return Math.floor(parsed);
}

function normalizeScore(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 100) / 100;
}

function detectClassificationSignals(article) {
  const text = [
    article && article.title ? article.title : '',
    article && article.abstract ? article.abstract : '',
    article && article.journal ? article.journal : '',
    article && article.publisher ? article.publisher : ''
  ].join(' ').toLowerCase();

  const signals = [];
  function has(pattern) {
    return pattern.test(text);
  }

  if (has(/\bguideline(s)?\b|\bposition stand\b|\bconsensus statement\b|\bpractice guideline\b|\brecommendation(s)?\b/)) {
    signals.push({ classification: 'guideline_or_position_stand', score: 92, confidence: 'high', reason: 'termos de guideline/consenso detectados' });
  }
  if (has(/\bmeta[-\s]?analysis\b|\bnetwork meta[-\s]?analysis\b|\bpooled analysis\b/)) {
    signals.push({ classification: 'meta_analysis', score: 90, confidence: 'high', reason: 'meta-análise identificada no título/resumo' });
  }
  if (has(/\bsystematic review\b|\bsystematic literature review\b/)) {
    signals.push({ classification: 'systematic_review', score: 84, confidence: 'high', reason: 'revisão sistemática detectada' });
  }
  if (has(/\brandomi[sz]ed\b|\brandomised\b|\brandomized\b|\bcontrolled trial\b|\bdouble[-\s]?blind\b|\bplacebo[-\s]?controlled\b|\brct\b/)) {
    signals.push({ classification: 'randomized_controlled_trial', score: 78, confidence: 'moderate', reason: 'sinais de ensaio clínico randomizado' });
  }
  if (has(/\bcohort\b|\bobservational\b|\bprospective\b|\bretrospective\b|\blongitudinal\b|\bcase[-\s]?control\b|\bcross[-\s]?sectional\b/)) {
    signals.push({ classification: 'cohort_or_observational', score: 64, confidence: 'moderate', reason: 'desenho observacional/coorte identificado' });
  }
  if (has(/\bcase report\b|\bcase study\b|\bcase series\b/)) {
    signals.push({ classification: 'case_study', score: 48, confidence: 'low', reason: 'relato ou série de casos detectado' });
  }
  if (has(/\bnarrative review\b|\bexpert opinion\b|\bliterature review\b|\breview article\b/)) {
    signals.push({ classification: 'narrative_review', score: 42, confidence: 'low', reason: 'revisão narrativa/opinião especializada' });
  }

  return signals;
}

function classifyArticleRow(article) {
  const signals = detectClassificationSignals(article);
  if (!signals.length) {
    return {
      classification: 'unknown',
      evidence_score: 18,
      confidence_label: 'very_low',
      classification_reason: 'sinais insuficientes para classificar com segurança'
    };
  }

  const best = signals.sort((a, b) => b.score - a.score)[0];
  const text = `${article && article.title ? article.title : ''} ${article && article.abstract ? article.abstract : ''}`.toLowerCase();
  let score = best.score;

  if (/\bprotocol\b|\bstudy protocol\b/.test(text)) score -= 15;
  if (/\bpilot\b/.test(text)) score -= 8;
  if (/\banimal study\b|\bmurine\b|\bmouse\b|\bin vitro\b/.test(text)) score -= 20;
  if (/\bmulticenter\b/.test(text)) score += 3;
  if (/\bdouble[-\s]?blind\b/.test(text)) score += 3;

  const normalizedScore = normalizeScore(score);
  let confidence = best.confidence;
  if (normalizedScore < 35) confidence = 'very_low';
  else if (normalizedScore < 55 && confidence !== 'very_low') confidence = 'low';
  else if (normalizedScore >= 88) confidence = 'high';

  return {
    classification: best.classification,
    evidence_score: normalizedScore,
    confidence_label: confidence,
    classification_reason: best.reason
  };
}

async function classifyScientificArticlesBatch(limit) {
  const client = createSupabaseAdminClient();
  const batchLimit = clampBatchLimit(limit);
  const rows = await client.request(
    'GET',
    `scientific_articles?classification=is.null&select=id,title,abstract,journal,publisher,raw_payload_json&order=created_at.asc&limit=${batchLimit}`
  );

  const articles = rows || [];
  let updatedCount = 0;

  for (let i = 0; i < articles.length; i += 1) {
    const article = articles[i];
    const classified = classifyArticleRow(article);

    await client.request(
      'PATCH',
      `scientific_articles?id=eq.${article.id}`,
      {
        classification: classified.classification,
        evidence_score: classified.evidence_score,
        confidence_label: classified.confidence_label,
        classification_reason: classified.classification_reason
      }
    );

    updatedCount += 1;
  }

  return {
    ok: true,
    scanned_articles: articles.length,
    updated_articles: updatedCount,
    limit: batchLimit
  };
}

var OBJETIVO_TOPIC_KEYWORDS = {
  hipertrofia: ['hypertrophy', 'protein', 'strength', 'creatine'],
  emagrecimento: ['fat loss', 'protein'],
  manutencao: ['protein', 'recovery'],
  recomposicao: ['fat loss', 'hypertrophy', 'protein']
};

async function listEvidenceByObjective(objetivo, limit) {
  const client = createSupabaseAdminClient();
  const keywords = OBJETIVO_TOPIC_KEYWORDS[String(objetivo || '').toLowerCase()] || ['protein'];
  const safeLimit = Math.min(Number(limit) || 3, 10);

  const topicFilter = keywords.map(function(k) {
    return 'topic.ilike.*' + k.replace(/ /g, '%20') + '*';
  }).join(',');

  let topics = [];
  try {
    topics = await client.request('GET', 'scientific_topics?or=(' + topicFilter + ')&status=eq.active&select=id,topic') || [];
  } catch (_) {
    return [];
  }

  if (!topics.length) return [];

  const topicIds = topics.map(function(t) { return t.id; }).join(',');

  let evidence = [];
  try {
    evidence = await client.request(
      'GET',
      'scientific_evidence?topic_id=in.(' + topicIds + ')&needs_review=eq.false' +
      '&select=relevance_score,ai_rank_score,recency_score,topic:scientific_topics(topic)' +
      ',article:scientific_articles(title,journal,published_at,classification,evidence_score,confidence_label)' +
      '&order=ai_rank_score.desc.nullslast,relevance_score.desc&limit=' + safeLimit
    ) || [];
  } catch (_) {
    return [];
  }

  return evidence;
}

module.exports = {
  searchScientificArticles,
  syncScientificTopics,
  listPendingReviews,
  classifyScientificArticlesBatch,
  computeRecencyScore,
  computeAiRankScore,
  listEvidenceByObjective
};
