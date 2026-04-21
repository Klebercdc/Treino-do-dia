import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "../../../../lib/utils/serverRateLimit"
import { requireBearerAuth } from "../../_shared/requireBearerAuth"
import { KroniaChatService } from "../../../../ai/chatService"
import { SupabasePlanRepository } from "../../../../ai/supabasePlanRepository"
import { SupabaseMemoryRepository } from "../../../../ai/supabaseMemoryRepository"
import { SupabaseRagProvider } from "../../../../ai/supabaseRagProvider"
import { createEmbeddingProvider } from "../../../../ai/embeddings"
import { createClient } from "@supabase/supabase-js"
import { AI_ENV } from "../../../../ai/env"
import type { ChatMessage, UserProfile } from "../../../../ai/types"
import { extractHormoneContextFromProfileRow } from "../../../../core/labs/labInterpretation"

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return undefined
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function toStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? "").trim()).filter(Boolean)
    return items.length ? items : undefined
  }
  if (typeof value === "string") {
    const items = value.split(",").map((item) => item.trim()).filter(Boolean)
    return items.length ? items : undefined
  }
  return undefined
}

function mapProfileRowToUserProfile(userId: string, profileRow: Record<string, unknown> | null): UserProfile | null {
  if (!profileRow || typeof profileRow !== "object") return null

  const config = profileRow.config && typeof profileRow.config === "object"
    ? (profileRow.config as Record<string, unknown>)
    : {}
  const hormoneContext = extractHormoneContextFromProfileRow(profileRow)

  return {
    id: userId,
    nome: firstString(profileRow.nome, profileRow.full_name, config.full_name, config.nome),
    objetivo: firstString(profileRow.objetivo, profileRow.objective, config.objetivo, config.objective),
    nivel: firstString(profileRow.nivel, config.nivel, config.level),
    idade: firstNumber(profileRow.idade, config.idade, config.age),
    sexo: firstString(profileRow.sexo, profileRow.sex, config.sexo, config.sex),
    pesoKg: firstNumber(profileRow.peso_kg, profileRow.current_weight_kg, config.peso_kg, config.current_weight_kg, config.pesoKg),
    alturaCm: firstNumber(profileRow.altura_cm, profileRow.height_cm, config.altura_cm, config.height_cm, config.alturaCm),
    patologia: firstString(profileRow.patologia as string | undefined, config.patologia as string | undefined),
    patologias: toStringArray(profileRow.patologias ?? profileRow.pathologies ?? profileRow.conditions ?? config.patologias ?? config.pathologies),
    padraoAlimentar: firstString(profileRow.dietary_pattern as string | undefined, config.dietary_pattern as string | undefined, config.padraoAlimentar as string | undefined),
    restricoes: toStringArray(profileRow.restricoes ?? profileRow.intolerances ?? config.restricoes ?? config.intolerances),
    preferencias: toStringArray(profileRow.preferencias ?? profileRow.liked_foods ?? config.preferencias ?? config.liked_foods),
    lesoes: toStringArray(profileRow.lesoes ?? config.lesoes ?? config.injuries),
    rotina: firstString(profileRow.rotina, profileRow.activity_level, config.rotina, config.activity_level),
    observacoes: firstString(profileRow.observacoes, profileRow.clinical_notes, config.observacoes, config.clinical_notes),
    usesExogenousHormones: hormoneContext.uses_exogenous_hormones,
    hormoneContextType: hormoneContext.hormone_context_type,
    declaredCompounds: hormoneContext.declared_compounds,
    lastAdministrationAt: hormoneContext.last_administration_at,
    monitoringMode: hormoneContext.monitoring_mode,
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação
    const authResult = await requireBearerAuth(req)
    if ("response" in authResult) return authResult.response
    const auth = authResult

    const userId = auth.user.id

    // 1b. Rate limit
    const rl = await checkRateLimit(userId, { max: 20, windowMs: 60000, category: 'chat_light' })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests', retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })
    }

    // 2. Validação do body
    const body = await req.json().catch(() => null)
    if (!body?.message || typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: "message é obrigatório" }, { status: 400 })
    }

    const userMessage: string = body.message.slice(0, 4000)
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : []

    // 3. Carregar perfil do usuário
    const adminClient = createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { data: profileRow } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()

    const userProfile: UserProfile | null = mapProfileRowToUserProfile(
      userId,
      profileRow as Record<string, unknown> | null,
    )

    // 4. Executar KroniaBrain
    const service = new KroniaChatService(
      new SupabaseRagProvider(createEmbeddingProvider()),
      new SupabasePlanRepository(),
      new SupabaseMemoryRepository(),
      adminClient,
    )

    const result = await service.run({
      userId,
      userMessage,
      history,
      userProfile,
    })

    return NextResponse.json({
      ok: true,
      message: result.response.message,
      intent: result.response.intent,
      action: result.response.action,
      appAction: result.appAction,
      pdfHtml: result.pdfHtml,
      planId: result.planId,
      shouldCreateButton: result.response.shouldCreateButton,
      buttonType: result.response.buttonType,
      workoutPayload: result.response.workoutPayload ?? null,
      dietPayload: result.response.dietPayload ?? null,
      supplementPayload: result.response.supplementPayload ?? null,
      mobilityPayload: result.response.mobilityPayload ?? null,
    })
  } catch (error) {
    // Loga o erro real no servidor mas nunca expõe detalhes internos ao cliente
    console.error("[kronia/chat] erro interno:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: "Não foi possível processar sua mensagem. Tente novamente." },
      { status: 500 },
    )
  }
}
