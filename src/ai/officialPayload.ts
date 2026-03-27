import type { AssistantStructuredResponse } from "./types"

export interface OfficialContent {
  kind: "treino" | "dieta" | "suplementacao" | "mobilidade" | "chat"
  message: string
  payload: unknown | null
}

export function getOfficialContent(response: AssistantStructuredResponse): OfficialContent {
  if (response.action === "abrir_tela_treino_com_payload") {
    return {
      kind: "treino",
      message: response.message,
      payload: response.workoutPayload ?? null,
    }
  }

  if (response.action === "gerar_pdf_dieta" || response.action === "abrir_config_dieta") {
    return {
      kind: "dieta",
      message: response.message,
      payload: response.dietPayload ?? null,
    }
  }

  if (response.action === "responder_suplementacao") {
    return {
      kind: "suplementacao",
      message: response.message,
      payload: response.supplementPayload ?? null,
    }
  }

  if (response.action === "responder_mobilidade") {
    return {
      kind: "mobilidade",
      message: response.message,
      payload: response.mobilityPayload ?? null,
    }
  }

  return {
    kind: "chat",
    message: response.message,
    payload: null,
  }
}
