import { NextRequest, NextResponse } from "next/server"
import { classifyIntent, normalizeMessage } from "../../../../core/intent/intentClassifier"
import { requireBearerAuth } from "../../_shared/requireBearerAuth"

// Endpoint leve e determinístico: normaliza e classifica intenção
// com contrato fixo para o decision engine.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)
    const message = typeof body?.message === "string" ? body.message : ""

    const normalized = normalizeMessage(message)
    const result = classifyIntent(normalized)

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({
      intent: "OTHER",
      confidence: 0.3,
      needs_clarification: true,
      domain: "general",
    }, { status: 500 })
  }
}
