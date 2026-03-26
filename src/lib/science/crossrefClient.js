const CROSSREF_BASE = 'https://api.crossref.org/works';

async function searchCrossref(query, rows = 20) {
  const url = `${CROSSREF_BASE}?query=${encodeURIComponent(query)}&rows=${rows}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'kronia-science-sync/1.0 (mailto:support@kronia.app)' } });
  if (!res.ok) throw new Error(`Crossref search falhou: ${res.status}`);
  return res.json();
}

module.exports = { searchCrossref };
