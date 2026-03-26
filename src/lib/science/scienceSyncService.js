const { searchPubmed, fetchPubmedSummaries } = require('./pubmedClient');
const { searchCrossref } = require('./crossrefClient');

function normalizeArticle(source, raw) {
  return {
    source,
    external_id: source === 'pubmed' ? String(raw.uid || raw.articleids?.[0]?.value || '') : String(raw.DOI || ''),
    title: source === 'pubmed' ? raw.title : raw.title?.[0],
    published_at: source === 'pubmed' ? raw.pubdate : raw.created?.['date-time'] || null,
    doi: source === 'pubmed' ? (raw.articleids || []).find((x) => x.idtype === 'doi')?.value || null : raw.DOI || null,
    raw_payload: raw
  };
}

async function collectScientificSuggestions(query) {
  const pubmedSearch = await searchPubmed(query, 10);
  const pubmedIds = pubmedSearch?.esearchresult?.idlist || [];
  const pubmedSummary = await fetchPubmedSummaries(pubmedIds);
  const pubmedArticles = pubmedIds
    .map((id) => normalizeArticle('pubmed', pubmedSummary.result[id]))
    .filter((item) => item.external_id);

  const crossrefData = await searchCrossref(query, 10);
  const crossrefArticles = (crossrefData?.message?.items || [])
    .map((item) => normalizeArticle('crossref', item))
    .filter((item) => item.external_id);

  return [...pubmedArticles, ...crossrefArticles].map((article) => ({
    ...article,
    review_status: 'pending_review'
  }));
}

module.exports = { collectScientificSuggestions };
