import type { AssistantStructuredResponse } from "./types"

export type ResolvedAppAction =
  | { type: "chat" }
  | { type: "navigation"; screen: "WorkoutConfig"; payload: null }
  | { type: "navigation"; screen: "ExerciseScreen"; payload: NonNullable<AssistantStructuredResponse["workoutPayload"]> }
  | { type: "navigation"; screen: "DietConfig"; payload: NonNullable<AssistantStructuredResponse["dietPayload"]> | null }
  | { type: "navigation"; screen: "SupplementScreen"; payload: NonNullable<AssistantStructuredResponse["supplementPayload"]> | null }
  | { type: "navigation"; screen: "MobilityScreen"; payload: NonNullable<AssistantStructuredResponse["mobilityPayload"]> | null }
  | { type: "pdf"; payload: NonNullable<AssistantStructuredResponse["dietPayload"]> }

export function resolveAppAction(response: AssistantStructuredResponse): ResolvedAppAction {
  switch (response.action) {
    case "abrir_config_treino":
      return { type: "navigation", screen: "WorkoutConfig", payload: null }

    case "abrir_tela_treino_com_payload":
      if (!response.workoutPayload) throw new Error("workoutPayload ausente")
      return { type: "navigation", screen: "ExerciseScreen", payload: response.workoutPayload }

    case "abrir_config_dieta":
      return { type: "navigation", screen: "DietConfig", payload: response.dietPayload ?? null }

    case "gerar_pdf_dieta":
      if (!response.dietPayload) throw new Error("dietPayload ausente")
      return { type: "pdf", payload: response.dietPayload }

    case "responder_suplementacao":
      return { type: "navigation", screen: "SupplementScreen", payload: response.supplementPayload ?? null }

    case "responder_mobilidade":
      return { type: "navigation", screen: "MobilityScreen", payload: response.mobilityPayload ?? null }

    default:
      return { type: "chat" }
  }
}
