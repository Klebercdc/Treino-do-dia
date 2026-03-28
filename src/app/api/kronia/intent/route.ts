import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "../../../../../lib/supabase/server"
import { IntentAgent } from "../../../../../ai/intentAgent"
import { GroqClient } from "../../../../../ai/modelClient"
import type { ChatMessage } from "../../../../../ai/types"

// Endpoint leve: apenas classifica a intenção semanticamente via IntentAgent.
// Chamado pelo transforms_patch.js em paralelo com a resposta do KRONOS,
// para que os Transforms usem intenção real em vez de keywords.

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ intent: "chat" }, { status: 200 })
    }

    const accessToken = authHeader.replace("Bearer ", "").trim()
    const db = createServerSupabaseClient(accessToken)
    const { data: userData, error } = await db.auth.getUser()
    if (error || !userData.user) {
      return NextResponse.json({ intent: "chat" }, { status: 200 })
    }

    const body = await req.json().catch(() => null)
    if (!body?.message || typeof body.message !== "string") {
      return NextResponse.json({ intent: "chat" }, { status: 200 })
    }

    const history: ChatMessage[] = Array.isArray(body.history) ? body.history.slice(-4) : []

    const agent = new IntentAgent(new GroqClient())
    const result = await agent.classify({
      userMessage: body.message.slice(0, 500),
      history,
    })

    return NextResponse.json({
      intent: result.intent,
      needsPayload: result.needsPayload,
      requiresClarification: result.requiresClarification,
    })
  } catch {
    // Falha silenciosa — o cliente usa fallback por keywords
    return NextResponse.json({ intent: "chat" })
  }
}
