const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

async function searchPubmed(term, retmax = 20) {
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(term)}&retmax=${retmax}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed search falhou: ${res.status}`);
  return res.json();
}

async function fetchPubmedSummaries(ids = []) {
  if (!ids.length) return { result: {} };
  const url = `${PUBMED_BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed summary falhou: ${res.status}`);
  return res.json();
}

module.exports = { searchPubmed, fetchPubmedSummaries };
