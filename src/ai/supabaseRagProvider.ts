import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { AI_ENV } from "./env"
import type { RagProvider, RagSearchInput } from "./rag"
import type { RetrievedContextItem } from "./types"
import type { EmbeddingProvider } from "./embeddings"
import { vectorToSqlLiteral } from "./embeddings"

interface SupabaseRagRow {
  id: string | number
  title?: string
  content?: string
  similarity?: number
  metadata?: Record<string, unknown>
}

interface ScienceTopicRow {
  id: string | number
  topic?: string
  keywords?: string[] | null
  status?: string | null
}

interface ScienceEvidenceRow {
  relevance_score?: number
  summary?: string | null
  topic?: { topic?: string | null } | null
  article?: {
    title?: string | null
    journal?: string | null
    published_at?: string | null
    doi?: string | null
    pmid?: string | null
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
    .filter((token) => token.length >= 3);
}

function expandScienceTokens(text: string): string[] {
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

function mapRows(rows: SupabaseRagRow[], source: string): RetrievedContextItem[] {
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    title: row.title ?? undefined,
    content: String(row.content ?? ""),
    score: typeof row.similarity === "number" ? row.similarity : undefined,
    metadata: {
      source,
      ...(row.metadata ?? {}),
    },
  }));
}

export class SupabaseRagProvider implements RagProvider {
  private readonly supabase: SupabaseClient

  constructor(private readonly embeddingProvider: EmbeddingProvider) {
    this.supabase = createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY)
  }

  private async searchByVectorMatch(query: string, topK: number): Promise<RetrievedContextItem[]> {
    const embedding = await this.embeddingProvider.embedText(query)
    const { data, error } = await this.supabase.rpc("match_knowledge_chunks", {
      query_embedding: vectorToSqlLiteral(embedding),
      match_count: topK,
    })

    if (error) {
      throw new Error(`Erro RAG vector match: ${error.message}`)
    }

    return mapRows((data ?? []) as SupabaseRagRow[], "match_knowledge_chunks")
  }

  private async searchByNutritionRpc(query: string, topK: number): Promise<RetrievedContextItem[]> {
    const { data, error } = await this.supabase.rpc("search_nutrition_knowledge", {
      search_query: query,
      match_count: topK,
      category_filter: null,
    })

    if (error) {
      throw new Error(`Erro search_nutrition_knowledge: ${error.message}`)
    }

    return mapRows((data ?? []) as SupabaseRagRow[], "search_nutrition_knowledge")
  }

  private async searchScientificEvidence(query: string, topK: number): Promise<RetrievedContextItem[]> {
    const tokens = expandScienceTokens(query)
    if (!tokens.length) return []

    const orFilter = tokens
      .flatMap((token) => [
        `topic.ilike.*${encodeURIComponent(token)}*`,
        `keywords.cs.{"${token.replace(/"/g, '\\"')}"}`
      ])
      .join(",")

    const { data: topicData, error: topicError } = await this.supabase
      .from("scientific_topics")
      .select("id,topic,keywords,status")
      .or(orFilter)

    if (topicError) {
      throw new Error(`Erro scientific_topics: ${topicError.message}`)
    }

    let activeTopics = ((topicData ?? []) as ScienceTopicRow[]).filter((topic) => {
      const status = String(topic.status ?? "active").toLowerCase()
      return status === "active"
    })

    if (!activeTopics.length) {
      const { data: allTopicData, error: allTopicError } = await this.supabase
        .from("scientific_topics")
        .select("id,topic,keywords,status")

      if (allTopicError) {
        throw new Error(`Erro scientific_topics fallback: ${allTopicError.message}`)
      }

      activeTopics = ((allTopicData ?? []) as ScienceTopicRow[]).filter((topic) => {
        const status = String(topic.status ?? "active").toLowerCase()
        if (status !== "active") return false
        const haystack = [topic.topic]
          .concat(Array.isArray(topic.keywords) ? topic.keywords : [])
          .join(" ")
          .toLowerCase()
        return tokens.some((token) => haystack.includes(token))
      })
    }

    if (!activeTopics.length) return []

    const topicIds = activeTopics.map((topic) => topic.id)
    const { data: evidenceData, error: evidenceError } = await this.supabase
      .from("scientific_evidence")
      .select("relevance_score,summary,topic:scientific_topics(topic),article:scientific_articles(title,journal,published_at,doi,pmid)")
      .in("topic_id", topicIds)
      .eq("needs_review", false)
      .order("relevance_score", { ascending: false })
      .limit(topK)

    if (evidenceError) {
      throw new Error(`Erro scientific_evidence: ${evidenceError.message}`)
    }

    return ((evidenceData ?? []) as ScienceEvidenceRow[]).map((row, index) => {
      const article = row.article ?? {}
      const topic = row.topic ?? {}
      const content = [
        row.summary ? `Resumo: ${row.summary}` : "",
        topic.topic ? `Tópico: ${topic.topic}` : "",
        article.journal ? `Journal: ${article.journal}` : "",
        article.published_at ? `Publicado em: ${article.published_at}` : "",
      ].filter(Boolean).join("\n")

      return {
        id: `scientific_evidence_${index}_${article.doi || article.pmid || topic.topic || "row"}`,
        title: article.title ?? topic.topic ?? "Evidência científica",
        content,
        score: typeof row.relevance_score === "number" ? row.relevance_score : undefined,
        metadata: {
          source: "scientific_evidence",
          category: "science_reference",
          url: article.doi ? `https://doi.org/${article.doi}` : undefined,
          pmid: article.pmid ?? undefined,
          topic: topic.topic ?? undefined,
        },
      }
    })
  }

  async search(input: RagSearchInput): Promise<RetrievedContextItem[]> {
    const matchCount = input.topK ?? 8
    const query = String(input.query || "").trim()
    if (!query) return []

    try {
      const vectorRows = await this.searchByVectorMatch(query, matchCount)
      if (vectorRows.length) return vectorRows
    } catch {
      // fallback below
    }

    try {
      const nutritionRows = await this.searchByNutritionRpc(query, matchCount)
      if (nutritionRows.length) return nutritionRows
    } catch {
      // fallback below
    }

    return this.searchScientificEvidence(query, matchCount)
  }
}
