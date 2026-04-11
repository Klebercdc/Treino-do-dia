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
const trainingActions = new Set<AssistantAction>(["abrir_config_treino", "abrir_tela_treino_com_payload"])
const dietActions = new Set<AssistantAction>(["abrir_config_dieta", "gerar_pdf_dieta"])

function hasWorkoutPayload(response: AssistantStructuredResponse): boolean {
  return Boolean(response.workoutPayload && Array.isArray(response.workoutPayload.exercicios) && response.workoutPayload.exercicios.length > 0)
}

function hasDietPayload(response: AssistantStructuredResponse): boolean {
  return Boolean(response.dietPayload && Array.isArray(response.dietPayload.refeicoes) && response.dietPayload.refeicoes.length > 0)
}

function downgradeDomainCta(response: AssistantStructuredResponse): AssistantStructuredResponse {
  return {
    ...response,
    action: "responder_chat",
    shouldCreateButton: false,
    buttonType: null,
    workoutPayload: null,
    dietPayload: null,
  }
}

function sanitizeDomainCoherence(response: AssistantStructuredResponse): AssistantStructuredResponse {
  const normalized: AssistantStructuredResponse = {
    ...response,
    workoutPayload: response.workoutPayload ?? null,
    dietPayload: response.dietPayload ?? null,
    supplementPayload: response.supplementPayload ?? null,
    mobilityPayload: response.mobilityPayload ?? null,
    buttonType: response.buttonType ?? null,
  }

  if (trainingActions.has(normalized.action)) {
    const coherent =
      normalized.intent === "treino" &&
      (
        (normalized.action === "abrir_config_treino"
          && normalized.shouldCreateButton === false
          && normalized.buttonType === null
          && !hasWorkoutPayload(normalized))
        || (normalized.action === "abrir_tela_treino_com_payload"
          && normalized.shouldCreateButton === true
          && normalized.buttonType === "treino"
          && hasWorkoutPayload(normalized))
      )

    return coherent ? { ...normalized, dietPayload: null } : downgradeDomainCta(normalized)
  }

  if (dietActions.has(normalized.action)) {
    if (normalized.action === "abrir_config_dieta") {
      return downgradeDomainCta(normalized)
    }

    const coherent =
      normalized.intent === "dieta" &&
      (
        normalized.action === "gerar_pdf_dieta"
          && normalized.shouldCreateButton === true
          && normalized.buttonType === "dieta"
          && hasDietPayload(normalized)
      )

    return coherent ? { ...normalized, workoutPayload: null } : downgradeDomainCta(normalized)
  }

  if (normalized.buttonType === "treino" || normalized.buttonType === "dieta") {
    return {
      ...normalized,
      shouldCreateButton: false,
      buttonType: null,
      workoutPayload: normalized.buttonType === "treino" ? null : normalized.workoutPayload,
      dietPayload: normalized.buttonType === "dieta" ? null : normalized.dietPayload,
    }
  }

  return {
    ...normalized,
    workoutPayload: normalized.action === "abrir_tela_treino_com_payload" ? normalized.workoutPayload : null,
    dietPayload: normalized.action === "gerar_pdf_dieta" || normalized.action === "abrir_config_dieta" ? normalized.dietPayload : null,
  }
}

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

  const validButtonTypes = ["treino", "dieta", "suplemento"]
  if (r.buttonType !== undefined && r.buttonType !== null && !validButtonTypes.includes(r.buttonType)) {
    throw new Error("buttonType inválido")
  }

  const normalized = sanitizeDomainCoherence({
    ...r,
    workoutPayload: r.workoutPayload ?? null,
    dietPayload: r.dietPayload ?? null,
    supplementPayload: r.supplementPayload ?? null,
    mobilityPayload: r.mobilityPayload ?? null,
    buttonType: r.buttonType ?? null,
  })

  return normalized
}
