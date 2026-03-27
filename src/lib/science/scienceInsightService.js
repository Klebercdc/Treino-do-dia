const { createSupabaseAdminClient } = require('../supabase/admin');
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

const STOPWORDS = new Set([
  // Português
  'de','a','o','que','e','do','da','em','um','para','com','uma','os','no','se',
  'na','por','mais','as','dos','como','mas','ao','ele','das','tem','seu','sua',
  'ou','quando','muito','nos','já','eu','também','só','pelo','pela','até','isso',
  'ela','entre','depois','sem','mesmo','aos','seus','quem','nas','me','esse',
  'eles','você','essa','num','nem','suas','meu','às','minha','numa','pelos',
  'elas','seja','qual','será','nós','tenho','lhe','deles','essas','esses',
  'pelas','este','dele','tu','te','vocês','lhes','meus','minhas','teu','tua',
  'nosso','nossa','nossos','nossas','dela','delas','esta','estes','estas',
  'estou','está','estamos','estão','isso','aquilo','isto','aquele','aquela',
  'preciso','quero','queria','pode','consigo','devo','tentar','fazer','usar',
  'qual','quanto','quanta','quantos','quantas','como','onde','quando','porque',
  // Inglês
  'the','is','are','was','were','be','been','have','has','had','do','does',
  'did','will','would','could','should','may','might','can','to','of','in',
  'on','at','by','for','with','about','as','into','this','that','it','its',
  'my','your','his','her','our','their','i','a','an','and','or','not','no'
]);

function extractKeywords(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

async function findTopicsByKeywords(client, keywords) {
  const found = new Map();

  for (const kw of keywords) {
    let rows = [];
    try {
      rows = await client.request(
        'GET',
        `scientific_topics?topic=ilike.*${encode(kw)}*&status=eq.active&select=id,topic,keywords&limit=3`
      ) || [];
    } catch (_) {}
    for (const row of rows) {
      if (!found.has(row.id)) found.set(row.id, row);
    }
  }

  return Array.from(found.values());
}

async function searchArticlesDirect(client, keywords, limit) {
  const results = new Map();

  for (const kw of keywords.slice(0, 3)) {
    let rows = [];
    try {
      rows = await client.request(
        'GET',
        `scientific_articles?title=ilike.*${encode(kw)}*` +
        `&select=id,title,abstract,journal,published_at,classification,evidence_score,confidence_label` +
        `&order=evidence_score.desc.nullslast&limit=${limit}`
      ) || [];
    } catch (_) {}
    for (const row of rows) {
      if (!results.has(row.id)) results.set(row.id, row);
    }
  }

  return Array.from(results.values()).slice(0, limit);
}

async function buildScienceContextFromText(userText) {
  const clean = String(userText || '').trim();
  if (!clean || clean.length < 4) return null;

  const client = createSupabaseAdminClient();
  const keywords = extractKeywords(clean);
  if (!keywords.length) return null;

  // Busca tópicos que casam com os termos extraídos
  const topics = await findTopicsByKeywords(client, keywords);

  const contextBlocks = [];

  if (topics.length) {
    for (const topicRow of topics.slice(0, 3)) {
      try {
        const evidenceRows = await getTopicEvidenceRows(client, topicRow.id);
        if (!evidenceRows || !evidenceRows.length) continue;

        const synthesis = synthesizeTopic(topicRow.topic, evidenceRows);
        const topArticles = (synthesis.top_articles || []).slice(0, 3).map((a, i) =>
          `  ${i + 1}. ${a.title} | ${a.evidence_level} | score ${a.combined_score}/100 | ${a.journal || 'N/A'}`
        ).join('\n');

        contextBlocks.push([
          `Tópico: ${topicRow.topic}`,
          `Nível de evidência: ${synthesis.evidence_level} | Confiança: ${synthesis.confidence_level}`,
          `Resumo: ${synthesis.summary}`,
          `Artigos:`,
          topArticles
        ].join('\n'));
      } catch (_) {}
    }
  }

  // Se não achou tópicos, busca artigos direto por título
  if (!contextBlocks.length) {
    try {
      const articles = await searchArticlesDirect(client, keywords, 4);
      if (articles.length) {
        const list = articles.map((a, i) =>
          `  ${i + 1}. ${a.title} | ${a.classification || 'N/A'} | score ${a.evidence_score || '?'}/100 | ${a.journal || 'N/A'}`
        ).join('\n');
        contextBlocks.push(`Artigos encontrados diretamente:\n${list}`);
      }
    } catch (_) {}
  }

  if (!contextBlocks.length) return null;

  return [
    '=== BASE CIENTÍFICA DO BANCO KRONIA (PubMed/Crossref) ===',
    `Termos identificados na pergunta: ${keywords.slice(0, 6).join(', ')}`,
    '',
    contextBlocks.join('\n\n'),
    '',
    'REGRA: use esses dados para embasar a resposta. Nunca altere recomendações de treino ou nutrição sem validação humana.'
  ].join('\n');
}

module.exports = {
  getScienceInsightByTopic,
  buildScienceContextFromText
};
