import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "../../../../lib/supabase/server"
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
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accessToken = authHeader.replace("Bearer ", "").trim()
    const db = createServerSupabaseClient(accessToken)
    const { data: userData, error: authError } = await db.auth.getUser()

    if (authError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = userData.user.id

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    )
  }
}
