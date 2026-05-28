export type LoadState = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'

export type AdaptationType =
  | 'VOLUME_INCREASE'
  | 'VOLUME_DECREASE'
  | 'DELOAD'
  | 'PR_CELEBRATED'
  | 'PROGRESSIVE_OVERLOAD_READY'
  | 'CONSISTENCY_REWARD'
  | 'RETURN_REMINDER'

export interface WorkoutSetRow {
  workout_id: string
  exercise_id: string
  exercise_name: string
  weight_kg: number | null
  reps: number | null
  rpe: number
  workout_date: string
}

export interface LoadAnalysis {
  state: LoadState
  daysInCurrentState: number
  avgRpe: number
  totalSetsLast7Days: number
  totalSetsLast14Days: number
  lastWorkoutDate: string | null
  daysSinceLastWorkout: number
  totalTrainingDays: number
}

export interface PREvent {
  exerciseId: string
  exerciseName: string
  newOneRmKg: number
  previousOneRmKg: number | null
  weightKg: number
  reps: number
}

export interface AdaptationSuggestion {
  type: AdaptationType
  loadState: LoadState | null
  reasoning: string
  metadata: Record<string, unknown>
}
