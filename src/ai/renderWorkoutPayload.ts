import type { WorkoutPayload } from "./types"

export interface WorkoutScreenViewModel {
  title: string
  subtitle?: string
  notes?: string
  items: {
    nome: string
    detalhes: string[]
  }[]
}

export function renderWorkoutPayloadToViewModel(payload: WorkoutPayload): WorkoutScreenViewModel {
  return {
    title: payload.titulo ?? "Treino",
    subtitle: payload.objetivo ?? undefined,
    notes: payload.observacoesGerais ?? undefined,
    items: payload.exercicios.map((exercise) => {
      const details = [
        exercise.series ? `Séries: ${exercise.series}` : null,
        exercise.repeticoes ? `Repetições: ${exercise.repeticoes}` : null,
        exercise.carga ? `Carga: ${exercise.carga}` : null,
        exercise.descanso ? `Descanso: ${exercise.descanso}` : null,
        exercise.observacoes ? `Obs: ${exercise.observacoes}` : null,
      ].filter(Boolean) as string[]

      return {
        nome: exercise.nome,
        detalhes: details,
      }
    }),
  }
}
