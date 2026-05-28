import type { SupabaseClient } from '@supabase/supabase-js'
import type { LoadState, LoadAnalysis, WorkoutSetRow } from './types'

// MEV (Minimum Effective Volume) / MRV (Maximum Recoverable Volume)
// séries por semana por nível
const VOLUME_STANDARDS: Record<string, { mev: number; mrv: number }> = {
  iniciante:    { mev: 6,  mrv: 14 },
  intermediario:{ mev: 10, mrv: 20 },
  avancado:     { mev: 14, mrv: 26 },
}

function rpeFactor(rpe: number): number {
  // RPE < 5 = muito leve, RPE 10 = máximo
  return Math.max(0.3, Math.min(1.0, rpe / 10))
}

function classifyLoad(effectiveSetsPerWeek: number, level: string): LoadState {
  const { mev, mrv } = VOLUME_STANDARDS[level] ?? VOLUME_STANDARDS.intermediario
  if (effectiveSetsPerWeek < mev * 0.6) return 'LOW'
  if (effectiveSetsPerWeek <= mev * 1.1) return 'MODERATE'
  if (effectiveSetsPerWeek <= mrv) return 'HIGH'
  return 'VERY_HIGH'
}

export async function analyzeTrainingLoad(
  db: SupabaseClient,
  userId: string,
  level = 'intermediario',
): Promise<LoadAnalysis> {
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const since7  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Busca treinos + logs das últimas 2 semanas via join
  const { data: rows } = await db
    .from('workout_logs')
    .select(`
      workout_id,
      exercise_id,
      weight_kg,
      reps,
      rpe,
      workouts!inner(user_id, date)
    `)
    .eq('workouts.user_id', userId)
    .gte('workouts.date', since14)
    .order('workouts.date', { ascending: false })

  const sets = (rows ?? []) as unknown as Array<{
    workout_id: string
    exercise_id: string
    weight_kg: number | null
    reps: number | null
    rpe: number
    workouts: { user_id: string; date: string }
  }>

  if (sets.length === 0) {
    // Usuário sem treinos — verificar último treino para RETURN_REMINDER
    const { data: lastWorkout } = await db
      .from('workouts')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { count: totalDays } = await db
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const lastDate = lastWorkout?.date ?? null
    const daysSince = lastDate
      ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
      : 999

    return {
      state: 'LOW',
      daysInCurrentState: daysSince,
      avgRpe: 0,
      totalSetsLast7Days: 0,
      totalSetsLast14Days: 0,
      lastWorkoutDate: lastDate,
      daysSinceLastWorkout: daysSince,
      totalTrainingDays: totalDays ?? 0,
    }
  }

  const sets7  = sets.filter(s => s.workouts.date >= since7)
  const sets14 = sets

  // Volume efetivo = séries × fator_RPE
  const effectiveSets7  = sets7.reduce((acc, s)  => acc + rpeFactor(s.rpe), 0)
  const effectiveSets14 = sets14.reduce((acc, s) => acc + rpeFactor(s.rpe), 0)
  const effectiveSetsPerWeek = effectiveSets7 // semana atual como referência

  const avgRpe = sets.reduce((acc, s) => acc + s.rpe, 0) / sets.length

  const state = classifyLoad(effectiveSetsPerWeek, level)

  // Dias no estado atual: conta dias consecutivos de treino no mesmo estado
  const allDates = [...new Set(sets.map(s => s.workouts.date))].sort().reverse()
  const daysInCurrentState = allDates.length > 0
    ? Math.floor((Date.now() - new Date(allDates[allDates.length - 1]).getTime()) / 86400000)
    : 0

  const { data: lastWorkoutRow } = await db
    .from('workouts')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: totalDays } = await db
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const lastDate = lastWorkoutRow?.date ?? null
  const daysSince = lastDate
    ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
    : 999

  return {
    state,
    daysInCurrentState,
    avgRpe: Math.round(avgRpe * 10) / 10,
    totalSetsLast7Days: sets7.length,
    totalSetsLast14Days: sets14.length,
    lastWorkoutDate: lastDate,
    daysSinceLastWorkout: daysSince,
    totalTrainingDays: totalDays ?? 0,
  }
}
