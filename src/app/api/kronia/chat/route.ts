import { NextResponse } from "next/server"
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

export async function POST(req: Request) {
  try {
    // 1. Autenticação
    const auth = await requireBearerAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = auth.user.id

    // 1b. Rate limit
    const rl = checkRateLimit(userId, { max: 20, windowMs: 60000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
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
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    const userProfile: UserProfile | null = profileRow
      ? {
          id: userId,
          nome: profileRow.nome ?? undefined,
          objetivo: profileRow.objetivo ?? undefined,
          nivel: profileRow.nivel ?? undefined,
          idade: profileRow.idade ?? undefined,
          sexo: profileRow.sexo ?? undefined,
          pesoKg: profileRow.peso_kg ?? undefined,
          alturaCm: profileRow.altura_cm ?? undefined,
          restricoes: profileRow.restricoes ?? [],
          preferencias: profileRow.preferencias ?? [],
          lesoes: profileRow.lesoes ?? [],
          rotina: profileRow.rotina ?? undefined,
          observacoes: profileRow.observacoes ?? undefined,
        }
      : null

    // 4. Executar KroniaBrain
    const service = new KroniaChatService(
      new SupabaseRagProvider(createEmbeddingProvider()),
      new SupabasePlanRepository(),
      new SupabaseMemoryRepository(),
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
