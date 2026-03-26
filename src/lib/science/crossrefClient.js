const CROSSREF_BASE = 'https://api.crossref.org/works';
const DEFAULT_TIMEOUT_MS = 12000;

function withTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function normalizeDateParts(dateParts = []) {
  if (!Array.isArray(dateParts) || !Array.isArray(dateParts[0])) return null;
  const [year, month, day] = dateParts[0];
  if (!year) return null;
  const mm = String(month || 1).padStart(2, '0');
  const dd = String(day || 1).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function normalizeCrossrefItem(item) {
  return {
    source: 'crossref',
    doi: item.DOI || null,
    title: Array.isArray(item.title) ? item.title[0] || null : null,
    publisher: item.publisher || null,
    reference_count: Number.isFinite(item['reference-count']) ? item['reference-count'] : null,
    journal: Array.isArray(item['container-title']) ? item['container-title'][0] || null : null,
    published_at: normalizeDateParts(item['published-print']?.['date-parts'])
      || normalizeDateParts(item.issued?.['date-parts'])
      || normalizeDateParts(item.created?.['date-parts']),
    raw_payload_json: item
  };
}

async function searchCrossrefByTitle(title, rows = 5) {
  const params = new URLSearchParams({
    rows: String(rows),
    select: 'DOI,title,publisher,reference-count,container-title,published-print,issued,created,author',
    'query.title': title
  });

  const res = await withTimeout(`${CROSSREF_BASE}?${params.toString()}`, {
    headers: {
      'User-Agent': 'kronia-science-sync/1.0 (mailto:support@kronia.app)'
    }
  });

  if (!res.ok) throw new Error(`Crossref search falhou: ${res.status}`);
  const payload = await res.json();
  const items = payload?.message?.items || [];
  return items.map(normalizeCrossrefItem);
}

module.exports = {
  searchCrossrefByTitle
};
