const { searchPubmedArticles } = require('./pubmedClient');
const { searchCrossrefByTitle } = require('./crossrefClient');
const { createSupabaseAdminClient } = require('../supabase/admin');

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

async function safeCrossrefEnrichment(article) {
  try {
    const matches = await searchCrossrefByTitle(article.title || '', 3);
    const best = matches.find((item) => item.doi) || matches[0];
    if (!best) return article;

    return {
      ...article,
      doi: article.doi || best.doi || null,
      publisher: best.publisher || null,
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
    enriched.push(article);
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

async function saveArticle(client, article) {
  const existing = await getExistingArticleByIdentifiers(client, article.pmid, article.doi);
  if (existing) return { row: existing, isNew: false };

  const payload = {
    source: article.source || 'pubmed',
    pmid: article.pmid || null,
    doi: article.doi || null,
    title: article.title || null,
    abstract: article.abstract || null,
    authors: Array.isArray(article.authors) ? article.authors : [],
    journal: article.journal || null,
    publisher: article.publisher || null,
    published_at: article.published_at || null,
    raw_payload_json: article.raw_payload_json || {}
  };

  const created = await client.request('POST', 'scientific_articles', payload);
  return { row: (created && created[0]) || payload, isNew: true };
}

async function fetchTopicEvidences(client, topicId) {
  return client.request(
    'GET',
    `scientific_evidence?topic_id=eq.${topicId}&select=id,summary,created_at,relevance_score,article:scientific_articles(id,title,abstract,published_at)&order=created_at.desc`
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
  const already = await client.request(
    'GET',
    `scientific_evidence?topic_id=eq.${topic.id}&article_id=eq.${articleRow.id}&select=id&limit=1`
  );
  if (already && already[0]) return { created: false, needsReview: false };

  const summary = `Evidência para o tópico "${topic.topic}" com score ${relevanceScore}. Revisão manual obrigatória antes de qualquer mudança de regra.`;

  await client.request('POST', 'scientific_evidence', {
    topic_id: topic.id,
    article_id: articleRow.id,
    relevance_score: relevanceScore,
    summary,
    needs_review: needsReview
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
    'scientific_evidence?needs_review=eq.true&select=id,relevance_score,summary,created_at,topic:scientific_topics(id,topic,keywords),article:scientific_articles(id,source,pmid,doi,title,abstract,journal,publisher,published_at)&order=created_at.desc'
  );

  return rows || [];
}

module.exports = {
  searchScientificArticles,
  syncScientificTopics,
  listPendingReviews
};
