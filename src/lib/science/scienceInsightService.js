const { createSupabaseAdminClient } = require('../supabase/admin.js');
const { synthesizeTopic } = require('./topicSynthesizer');

function encode(value) {
  return encodeURIComponent(String(value || ''));
}

async function findTopicByName(client, topic) {
  const normalized = String(topic || '').trim();
  if (!normalized) return null;

  const exact = await client.request(
    'GET',
    `scientific_topics?topic=ilike.${encode(normalized)}&select=id,topic,keywords&limit=1`
  );

  if (exact && exact[0]) return exact[0];

  const fallback = await client.request(
    'GET',
    `scientific_topics?topic=ilike.*${encode(normalized)}*&select=id,topic,keywords&limit=1`
  );

  return (fallback && fallback[0]) || null;
}

async function getTopicEvidenceRows(client, topicId) {
  return client.request(
    'GET',
    `scientific_evidence?topic_id=eq.${topicId}&select=id,relevance_score,summary,article:scientific_articles(id,title,abstract,published_at,doi,pmid,journal)&order=relevance_score.desc&limit=50`
  );
}

async function getScienceInsightByTopic(topic) {
  const client = createSupabaseAdminClient();
  const topicRow = await findTopicByName(client, topic);

  if (!topicRow) {
    return {
      found: false,
      topic: topic,
      message: 'Tópico não encontrado na base científica.'
    };
  }

  const evidenceRows = await getTopicEvidenceRows(client, topicRow.id);
  const synthesis = synthesizeTopic(topicRow.topic, evidenceRows || []);

  return {
    found: true,
    topic: topicRow.topic,
    keywords: topicRow.keywords || [],
    synthesis,
    evidence_level: synthesis.evidence_level,
    top_articles: synthesis.top_articles
  };
}

async function buildScienceContextFromText(userText) {
  const clean = String(userText || '').trim();
  if (!clean || clean.length < 4) return null;

  const insight = await getScienceInsightByTopic(clean);
  if (!insight.found) return null;

  const top = (insight.top_articles || []).slice(0, 3).map((article, index) => {
    return `${index + 1}. ${article.title} (evidência ${article.evidence_level}, score ${article.combined_score}/100)`;
  }).join('\n');

  return [
    '[INSTRUÇÃO INTERNA — NÃO MENCIONAR AO USUÁRIO]',
    `Tópico científico de referência: ${insight.topic}`,
    `Nível de evidência: ${insight.evidence_level}`,
    `Confiança: ${insight.synthesis.confidence_level}`,
    `Síntese técnica: ${insight.synthesis.summary}`,
    'Referências técnicas de suporte:',
    top,
    '[USE ESTE CONTEÚDO INTERNAMENTE PARA CALIBRAR A RESPOSTA. NÃO CITE ARTIGOS, FONTES OU "BASE CIENTÍFICA" NA RESPOSTA AO USUÁRIO.]'
  ].join('\n');
}

module.exports = {
  getScienceInsightByTopic,
  buildScienceContextFromText
};
