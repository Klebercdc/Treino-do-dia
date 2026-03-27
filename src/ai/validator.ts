import type { AssistantAction, AssistantIntent, AssistantStructuredResponse, ResponseDepth } from "./types"

const validIntents: AssistantIntent[] = [
  "chat",
  "treino",
  "dieta",
  "suplementacao",
  "mobilidade",
  "ajuste",
  "duvida",
  "continuidade",
  "configuracao",
  "acao_direta",
]

const validActions: AssistantAction[] = [
  "responder_chat",
  "abrir_config_treino",
  "abrir_tela_treino_com_payload",
  "abrir_config_dieta",
  "gerar_pdf_dieta",
  "responder_suplementacao",
  "responder_mobilidade",
  "perguntar_clarificacao",
  "nenhuma",
]

const validDepths: ResponseDepth[] = ["curta", "normal", "detalhada"]

export function validateAssistantResponse(response: unknown): AssistantStructuredResponse {
  if (!response || typeof response !== "object") {
    throw new Error("Resposta da IA inválida")
  }

  const r = response as AssistantStructuredResponse

  if (!validIntents.includes(r.intent)) throw new Error("Intent inválida")
  if (!validActions.includes(r.action)) throw new Error("Action inválida")
  if (!validDepths.includes(r.depth)) throw new Error("Depth inválida")
  if (typeof r.message !== "string" || !r.message.trim()) throw new Error("Message inválida")
  if (typeof r.shouldCreateButton !== "boolean") throw new Error("shouldCreateButton inválido")

  if (r.buttonType !== undefined && r.buttonType !== null && r.buttonType !== "treino" && r.buttonType !== "dieta") {
    throw new Error("buttonType inválido")
  }

  if (r.action === "abrir_tela_treino_com_payload") {
    if (!r.workoutPayload || !Array.isArray(r.workoutPayload.exercicios) || r.workoutPayload.exercicios.length === 0) {
      throw new Error("Workout payload obrigatório e inválido")
    }
  }

  if (r.action === "gerar_pdf_dieta") {
    if (!r.dietPayload || !Array.isArray(r.dietPayload.refeicoes) || r.dietPayload.refeicoes.length === 0) {
      throw new Error("Diet payload obrigatório e inválido")
    }
  }

  return {
    ...r,
    workoutPayload: r.workoutPayload ?? null,
    dietPayload: r.dietPayload ?? null,
    supplementPayload: r.supplementPayload ?? null,
    mobilityPayload: r.mobilityPayload ?? null,
    buttonType: r.buttonType ?? null,
  }
}
