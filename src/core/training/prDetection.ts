import type { SupabaseClient } from '@supabase/supabase-js'
import type { PREvent } from './types'

// Epley: 1RM = peso × (1 + reps / 30)
function epley1RM(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg
  return Math.round((weightKg * (1 + reps / 30)) * 10) / 10
}

export async function detectAndSavePRs(
  db: SupabaseClient,
  userId: string,
  workoutId: string,
): Promise<PREvent[]> {
  // Sets do treino atual com nome do exercício
  const { data: sets } = await db
    .from('workout_logs')
    .select(`
      exercise_id,
      weight_kg,
      reps,
      exercises!inner(name)
    `)
    .eq('workout_id', workoutId)

  if (!sets || sets.length === 0) return []

  // Agrupar por exercício, pegar melhor 1RM estimado do treino atual
  const bestByExercise = new Map<string, {
    exerciseId: string
    exerciseName: string
    oneRm: number
    weightKg: number
    reps: number
  }>()

  for (const set of sets as unknown as Array<{
    exercise_id: string
    weight_kg: number | null
    reps: number | null
    exercises: { name: string }
  }>) {
    if (!set.weight_kg || !set.reps || set.reps > 20) continue // Epley não confiável > 20 reps
    const oneRm = epley1RM(set.weight_kg, set.reps)
    const existing = bestByExercise.get(set.exercise_id)
    if (!existing || oneRm > existing.oneRm) {
      bestByExercise.set(set.exercise_id, {
        exerciseId: set.exercise_id,
        exerciseName: set.exercises.name,
        oneRm,
        weightKg: set.weight_kg,
        reps: set.reps,
      })
    }
  }

  if (bestByExercise.size === 0) return []

  // Buscar PRs existentes para esses exercícios
  const exerciseIds = [...bestByExercise.keys()]
  const { data: existingPRs } = await db
    .from('personal_records')
    .select('exercise_id, one_rm_kg')
    .eq('user_id', userId)
    .in('exercise_id', exerciseIds)
    .order('one_rm_kg', { ascending: false })

  const maxPRByExercise = new Map<string, number>()
  for (const pr of existingPRs ?? []) {
    const current = maxPRByExercise.get(pr.exercise_id)
    if (!current || pr.one_rm_kg > current) {
      maxPRByExercise.set(pr.exercise_id, pr.one_rm_kg)
    }
  }

  const newPRs: PREvent[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const [exerciseId, best] of bestByExercise) {
    const previousPR = maxPRByExercise.get(exerciseId) ?? null
    // PR se 1% acima do melhor anterior (evita falsos positivos por arredondamento)
    if (previousPR !== null && best.oneRm <= previousPR * 1.01) continue

    // Salvar novo PR com source 'auto'
    await db.from('personal_records').insert({
      user_id: userId,
      exercise_id: exerciseId,
      weight_kg: best.weightKg,
      reps: best.reps,
      one_rm_kg: best.oneRm,
      recorded_at: today,
      source: 'auto',
    })

    newPRs.push({
      exerciseId,
      exerciseName: best.exerciseName,
      newOneRmKg: best.oneRm,
      previousOneRmKg: previousPR,
      weightKg: best.weightKg,
      reps: best.reps,
    })
  }

  return newPRs
}
