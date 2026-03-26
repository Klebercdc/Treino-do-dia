const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const DEFAULT_TIMEOUT_MS = 12000;

function withTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeXml(value) {
  return safeText(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pickFirst(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function pickAll(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results = [];
  let match = regex.exec(xml);
  while (match) {
    results.push(decodeXml(match[1]));
    match = regex.exec(xml);
  }
  return results;
}

function parsePubmedArticle(xmlBlock) {
  const pmid = pickFirst(xmlBlock, 'PMID');
  const title = pickFirst(xmlBlock, 'ArticleTitle');
  const abstractPieces = pickAll(xmlBlock, 'AbstractText');
  const abstract = safeText(abstractPieces.join(' '));
  const journal = pickFirst(xmlBlock, 'Title') || pickFirst(xmlBlock, 'ISOAbbreviation');
  const year = pickFirst(xmlBlock, 'Year');
  const month = pickFirst(xmlBlock, 'Month');
  const day = pickFirst(xmlBlock, 'Day');
  const publishedAt = safeText([year, month, day].filter(Boolean).join('-')) || null;

  const authorBlocks = xmlBlock.match(/<Author[\s\S]*?<\/Author>/gi) || [];
  const authors = authorBlocks
    .map((authorXml) => {
      const lastName = pickFirst(authorXml, 'LastName');
      const foreName = pickFirst(authorXml, 'ForeName') || pickFirst(authorXml, 'Initials');
      return safeText(`${foreName} ${lastName}`);
    })
    .filter(Boolean);

  return {
    source: 'pubmed',
    pmid: pmid || null,
    title: title || null,
    abstract: abstract || null,
    authors,
    journal: journal || null,
    published_at: publishedAt,
    raw_payload_json: xmlBlock
  };
}

async function searchPubmed(query, retmax = 20) {
  const apiKey = process.env.NCBI_API_KEY;
  const params = new URLSearchParams({
    db: 'pubmed',
    retmode: 'json',
    sort: 'relevance',
    retmax: String(retmax),
    term: query
  });
  if (apiKey) params.set('api_key', apiKey);

  const res = await withTimeout(`${PUBMED_BASE}/esearch.fcgi?${params.toString()}`);
  if (!res.ok) throw new Error(`PubMed esearch falhou: ${res.status}`);
  const data = await res.json();
  return data?.esearchresult?.idlist || [];
}

async function fetchPubmedDetails(pmids = []) {
  if (!pmids.length) return [];

  const apiKey = process.env.NCBI_API_KEY;
  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml'
  });
  if (apiKey) params.set('api_key', apiKey);

  const res = await withTimeout(`${PUBMED_BASE}/efetch.fcgi?${params.toString()}`);
  if (!res.ok) throw new Error(`PubMed efetch falhou: ${res.status}`);

  const xml = await res.text();
  const articleBlocks = xml.match(/<PubmedArticle[\s\S]*?<\/PubmedArticle>/gi) || [];
  return articleBlocks.map(parsePubmedArticle).filter((item) => item.pmid && item.title);
}

async function searchPubmedArticles(query, retmax = 20) {
  const pmids = await searchPubmed(query, retmax);
  return fetchPubmedDetails(pmids);
}

module.exports = {
  searchPubmed,
  fetchPubmedDetails,
  searchPubmedArticles
};
