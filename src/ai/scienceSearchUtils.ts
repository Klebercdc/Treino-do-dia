interface ScienceEvidenceLikeRow {
  summary?: string | null
  topic?: { topic?: string | null } | null
  article?: {
    title?: string | null
    journal?: string | null
  } | null
}

const SCIENCE_QUERY_ALIASES: Record<string, string[]> = {
  hipertrofia: ["hypertrophy", "muscle gain", "ganho muscular", "protein", "proteina", "creatine", "creatina", "strength", "forca"],
  hypertrophy: ["hipertrofia", "muscle gain", "ganho muscular", "protein", "proteina", "creatine", "creatina"],
  proteina: ["protein", "muscle protein synthesis", "intake", "hipertrofia", "hypertrophy"],
  protein: ["proteina", "muscle protein synthesis", "intake", "hipertrofia", "hypertrophy"],
  creatina: ["creatine", "supplementation", "performance", "forca", "strength"],
  creatine: ["creatina", "supplementation", "performance", "forca", "strength"],
  emagrecimento: ["fat loss", "weight loss", "deficit", "perda de gordura", "body fat"],
  forca: ["strength", "powerlifting", "creatine", "creatina", "protein", "proteina"],
  strength: ["forca", "powerlifting", "creatine", "creatina", "protein", "proteina"],
}

function tokenizeQuery(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

export function expandScienceTokens(text: string): string[] {
  const base = tokenizeQuery(text)
  const expanded = new Set<string>(base)
  base.forEach((token) => {
    const aliases = SCIENCE_QUERY_ALIASES[token]
    if (aliases) {
      aliases.forEach((alias) => expanded.add(alias.toLowerCase()))
    }
  })
  return Array.from(expanded).slice(0, 12)
}

export function scoreScientificTextMatch(row: ScienceEvidenceLikeRow, tokens: string[]): number {
  const article = row.article ?? {}
  const topic = row.topic ?? {}
  const haystack = [
    row.summary,
    topic.topic,
    article.title,
    article.journal,
  ].filter(Boolean).join(" ").toLowerCase()

  if (!haystack) return 0
  const hits = tokens.filter((token) => haystack.includes(token.toLowerCase())).length
  return hits / Math.max(tokens.length, 1)
}
