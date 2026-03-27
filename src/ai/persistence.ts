import type { AssistantStructuredResponse } from "./types"

export interface SaveGeneratedPlanInput {
  userId: string
  kind: "treino" | "dieta" | "suplementacao" | "mobilidade"
  chatMessage: string
  payload: unknown
  createdAt?: string
}

export interface PlanRepository {
  saveGeneratedPlan(input: SaveGeneratedPlanInput): Promise<{ id: string }>
  saveAssistantLog(input: {
    userId?: string
    userMessage: string
    responseMessage: string
    intent: string
    action: string
    rawResponse: AssistantStructuredResponse
    retrievedContext?: unknown
    memoryItems?: unknown
    createdAt?: string
  }): Promise<void>
}

export async function persistAssistantResult(args: {
  repository: PlanRepository
  userId?: string
  userMessage: string
  response: AssistantStructuredResponse
  retrievedContext?: unknown
  memoryItems?: unknown
}): Promise<{ planId?: string }> {
  const now = new Date().toISOString()

  await args.repository.saveAssistantLog({
    userId: args.userId,
    userMessage: args.userMessage,
    responseMessage: args.response.message,
    intent: args.response.intent,
    action: args.response.action,
    rawResponse: args.response,
    retrievedContext: args.retrievedContext,
    memoryItems: args.memoryItems,
    createdAt: now,
  })

  if (!args.userId) return {}

  if (args.response.action === "abrir_tela_treino_com_payload" && args.response.workoutPayload) {
    const saved = await args.repository.saveGeneratedPlan({
      userId: args.userId,
      kind: "treino",
      chatMessage: args.response.message,
      payload: args.response.workoutPayload,
      createdAt: now,
    })
    return { planId: saved.id }
  }

  if (args.response.action === "gerar_pdf_dieta" && args.response.dietPayload) {
    const saved = await args.repository.saveGeneratedPlan({
      userId: args.userId,
      kind: "dieta",
      chatMessage: args.response.message,
      payload: args.response.dietPayload,
      createdAt: now,
    })
    return { planId: saved.id }
  }

  if (args.response.action === "responder_suplementacao" && args.response.supplementPayload) {
    const saved = await args.repository.saveGeneratedPlan({
      userId: args.userId,
      kind: "suplementacao",
      chatMessage: args.response.message,
      payload: args.response.supplementPayload,
      createdAt: now,
    })
    return { planId: saved.id }
  }

  if (args.response.action === "responder_mobilidade" && args.response.mobilityPayload) {
    const saved = await args.repository.saveGeneratedPlan({
      userId: args.userId,
      kind: "mobilidade",
      chatMessage: args.response.message,
      payload: args.response.mobilityPayload,
      createdAt: now,
    })
    return { planId: saved.id }
  }

  return {}
}
