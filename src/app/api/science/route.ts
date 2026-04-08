/**
 * POST /api/science
 *
 * Retorna evidências científicas relevantes para um objetivo de treino/dieta.
 * Usado por buildScientificConstraintsByObjective() no frontend para enriquecer
 * scientificConstraints antes de chamar /api/kronia/workout ou /api/kronia/diet.
 *
 * Payload: { objetivo, sexo?, idade?, peso?, altura?, nivelAtividade? }
 * Resposta: { ok: true, science: ScienceEvidenceRow[] }
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "../../../lib/supabase/admin"

export const runtime = "nodejs"

// Mapeamento objetivo → palavras-chave para busca nos tópicos científicos
const OBJETIVO_KEYWORDS: Record<string, string[]> = {
  hipertrofia: ["hypertrophy", "muscle gain", "protein", "strength", "creatine"],
  emagrecimento: ["fat loss", "weight loss", "protein", "deficit", "calorie"],
  manutencao: ["maintenance", "protein", "recovery", "energy balance"],
  recomposicao: ["body recomposition", "fat loss", "hypertrophy", "protein"],
  forca: ["strength", "strength training", "progressive overload", "creatine", "protein"],
  // aliases comuns vindos do frontend
  emagrecer: ["fat loss", "weight loss", "protein", "deficit"],
  definicao: ["fat loss", "body recomposition", "protein", "deficit"],
  saude: ["health", "general fitness", "protein", "recovery"],
  resistencia: ["endurance", "aerobic", "protein", "recovery"],
}

function resolveKeywords(objetivo: string): string[] {
  const key = String(objetivo || "").toLowerCase().trim()
  return (
    OBJETIVO_KEYWORDS[key] ||
    OBJETIVO_KEYWORDS["hipertrofia"] // fallback seguro
  )
}

interface ScienceRow {
  relevance_score: number
  ai_rank_score: number | null
  recency_score: number | null
  topic: { topic: string } | null
  article: {
    title: string
    journal: string | null
    published_at: string | null
    classification: string | null
    evidence_score: number | null
    confidence_label: string | null
  } | null
}

async function fetchEvidenceByObjective(
  objetivo: string,
  limit: number = 5,
): Promise<ScienceRow[]> {
  const admin = createAdminSupabaseClient()
  const keywords = resolveKeywords(objetivo)

  // Busca tópicos correspondentes ao objetivo
  const topicOrFilters = keywords
    .map((k) => `topic.ilike.%${k}%`)
    .join(",")

  const { data: topics, error: topicsError } = await admin
    .from("scientific_topics")
    .select("id, topic, status")
    .or(topicOrFilters)
    .limit(20)

  if (topicsError || !topics || topics.length === 0) {
    return []
  }

  const activeTopics = topics.filter(
    (t) => !t.status || t.status === "active",
  )
  if (activeTopics.length === 0) return []

  const topicIds = activeTopics.map((t) => t.id)

  const { data: evidence, error: evidenceError } = await admin
    .from("scientific_evidence")
    .select(
      `relevance_score,
       ai_rank_score,
       recency_score,
       topic:scientific_topics(topic),
       article:scientific_articles(title,journal,published_at,classification,evidence_score,confidence_label)`,
    )
    .in("topic_id", topicIds)
    .eq("needs_review", false)
    .order("ai_rank_score", { ascending: false, nullsFirst: false })
    .order("relevance_score", { ascending: false })
    .limit(limit)

  if (evidenceError || !evidence) return []

  return evidence as ScienceRow[]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const objetivo = String(body?.objetivo || "hipertrofia").trim()
    const limit = Math.min(Number(body?.limit) || 5, 10)

    const science = await fetchEvidenceByObjective(objetivo, limit)

    return NextResponse.json({ ok: true, science })
  } catch (error) {
    // Falha silenciosa — o frontend tem fallback local para este endpoint
    console.error("[science-route] erro interno:", error)
    return NextResponse.json({ ok: false, science: [] }, { status: 500 })
  }
}
