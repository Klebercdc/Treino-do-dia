import { NextResponse } from "next/server"
import { classifyIntent, normalizeMessage } from "../../../../core/intent/intentClassifier"

// Endpoint leve e determinístico: normaliza e classifica intenção
// com contrato fixo para o decision engine.
export async function POST(req: Request) {
  try {
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
    })
  }
}
