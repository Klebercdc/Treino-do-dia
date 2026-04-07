import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { AI_ENV } from "./env"
import type { RagProvider, RagSearchInput } from "./rag"
import type { RetrievedContextItem } from "./types"
import type { EmbeddingProvider } from "./embeddings"
import { vectorToSqlLiteral } from "./embeddings"
import {
  expandScienceTokens,
  scoreScientificTextMatch,
} from "./scienceSearchUtils"

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

    if (!activeTopics.length) {
      const { data: fallbackEvidence, error: fallbackError } = await this.supabase
        .from("scientific_evidence")
        .select("relevance_score,summary,topic:scientific_topics(topic),article:scientific_articles(title,journal,published_at,doi,pmid)")
        .eq("needs_review", false)
        .order("relevance_score", { ascending: false })
        .limit(160)

      if (fallbackError) {
        throw new Error(`Erro scientific_evidence fallback: ${fallbackError.message}`)
      }

      return ((fallbackEvidence ?? []) as ScienceEvidenceRow[])
        .map((row) => ({ row, score: scoreScientificTextMatch(row, tokens) }))
        .filter((entry) => entry.score >= 0.25)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((entry, index) => {
          const article = entry.row.article ?? {}
          const topic = entry.row.topic ?? {}
          const content = [
            entry.row.summary ? `Resumo: ${entry.row.summary}` : "",
            topic.topic ? `Tópico: ${topic.topic}` : "",
            article.journal ? `Journal: ${article.journal}` : "",
            article.published_at ? `Publicado em: ${article.published_at}` : "",
          ].filter(Boolean).join("\n")

          return {
            id: `scientific_evidence_text_${index}_${article.doi || article.pmid || topic.topic || "row"}`,
            title: article.title ?? topic.topic ?? "Evidência científica",
            content,
            score: entry.score,
            metadata: {
              source: "scientific_evidence_fallback",
              category: "science_reference",
              url: article.doi ? `https://doi.org/${article.doi}` : undefined,
              pmid: article.pmid ?? undefined,
              topic: topic.topic ?? undefined,
            },
          }
        })
    }

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

    const mapped = ((evidenceData ?? []) as ScienceEvidenceRow[]).map((row, index) => {
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

    if (mapped.length) return mapped

    const { data: fallbackEvidence, error: fallbackError } = await this.supabase
      .from("scientific_evidence")
      .select("relevance_score,summary,topic:scientific_topics(topic),article:scientific_articles(title,journal,published_at,doi,pmid)")
      .eq("needs_review", false)
      .order("relevance_score", { ascending: false })
      .limit(160)

    if (fallbackError) {
      throw new Error(`Erro scientific_evidence empty fallback: ${fallbackError.message}`)
    }

    return ((fallbackEvidence ?? []) as ScienceEvidenceRow[])
      .map((row) => ({ row, score: scoreScientificTextMatch(row, tokens) }))
      .filter((entry) => entry.score >= 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((entry, index) => {
        const article = entry.row.article ?? {}
        const topic = entry.row.topic ?? {}
        const content = [
          entry.row.summary ? `Resumo: ${entry.row.summary}` : "",
          topic.topic ? `Tópico: ${topic.topic}` : "",
          article.journal ? `Journal: ${article.journal}` : "",
          article.published_at ? `Publicado em: ${article.published_at}` : "",
        ].filter(Boolean).join("\n")

        return {
          id: `scientific_evidence_empty_fallback_${index}_${article.doi || article.pmid || topic.topic || "row"}`,
          title: article.title ?? topic.topic ?? "Evidência científica",
          content,
          score: entry.score,
          metadata: {
            source: "scientific_evidence_fallback",
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
