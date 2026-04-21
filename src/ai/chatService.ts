import type { SupabaseClient } from "@supabase/supabase-js"
import { GroqClient } from "./modelClient"
import { KroniaOrchestrator } from "./orchestrator"
import { getLatestValidLabReport, getUserLabLongitudinalContext } from "../core/labs/labRepository"
import type {
  ActiveDietContext,
  ActiveDietMeal,
  ActiveDietMealItem,
  ChatMessage,
  RecentWorkoutEntry,
  RetrievedContextItem,
  UserProfile,
  WorkoutSet,
} from "./types"
import type { PlanRepository } from "./persistence"
import type { RagProvider } from "./rag"
import type { MemoryRepository } from "./memory"

export interface ChatServiceInput {
  userId?: string
  userMessage: string
  history: ChatMessage[]
  userProfile?: UserProfile | null
}

async function loadActiveDiet(client: SupabaseClient, userId: string): Promise<ActiveDietContext | null> {
  const { data: plans } = await client
    .from('meal_plans')
    .select('id, title, status, plan_data')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  const plan = plans?.[0]
  if (!plan) return null

  const { data: items } = await client
    .from('meal_plan_items')
    .select('meal_name, time_hint, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g')
    .eq('meal_plan_id', plan.id)
    .order('sort_order', { ascending: true })

  const mealMap = new Map<string, ActiveDietMeal>()
  for (const item of items ?? []) {
    const key = String(item.meal_name ?? 'Refeição')
    if (!mealMap.has(key)) {
      mealMap.set(key, { nome: key, horario: item.time_hint ?? undefined, itens: [] })
    }
    const entry: ActiveDietMealItem = {
      alimento: String(item.food_name ?? ''),
      quantidade: `${item.quantity ?? ''}${item.unit ? ' ' + item.unit : ''}`.trim(),
      calorias: item.calories ?? undefined,
      proteinas: item.protein_g ?? undefined,
      carboidratos: item.carbs_g ?? undefined,
      gorduras: item.fat_g ?? undefined,
    }
    mealMap.get(key)!.itens.push(entry)
  }

  const refeicoes = Array.from(mealMap.values())
  const metas = refeicoes.reduce(
    (acc, r) => {
      for (const i of r.itens) {
        if (i.calorias) acc.calorias = (acc.calorias ?? 0) + i.calorias
        if (i.proteinas) acc.proteinas = (acc.proteinas ?? 0) + i.proteinas
        if (i.carboidratos) acc.carboidratos = (acc.carboidratos ?? 0) + i.carboidratos
        if (i.gorduras) acc.gorduras = (acc.gorduras ?? 0) + i.gorduras
      }
      return acc
    },
    {} as ActiveDietContext['metas'],
  )

  return { titulo: String(plan.title ?? 'Plano alimentar'), metas, refeicoes }
}

async function loadRecentWorkouts(client: SupabaseClient, userId: string): Promise<RecentWorkoutEntry[]> {
  const { data: workouts } = await client
    .from('workouts')
    .select('id, date, duration_minutes')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(3)

  if (!workouts?.length) return []

  const results: RecentWorkoutEntry[] = []
  for (const workout of workouts) {
    const { data: logs } = await client
      .from('workout_logs')
      .select('weight_kg, reps, rpe, exercise_id, exercises(name, muscle_group)')
      .eq('workout_id', workout.id)
      .order('created_at', { ascending: true })

    const exerciseMap = new Map<string, { nome: string; grupoMuscular?: string; series: WorkoutSet[] }>()
    for (const log of logs ?? []) {
      const ex = (log as Record<string, unknown>).exercises as Record<string, unknown> | null
      const nome = String(ex?.name ?? log.exercise_id ?? 'Exercício')
      if (!exerciseMap.has(nome)) {
        exerciseMap.set(nome, { nome, grupoMuscular: ex?.muscle_group ? String(ex.muscle_group) : undefined, series: [] })
      }
      exerciseMap.get(nome)!.series.push({
        repeticoes: log.reps ?? undefined,
        carga: log.weight_kg ?? undefined,
        rpe: log.rpe ?? undefined,
      })
    }

    results.push({
      data: String(workout.date ?? ''),
      duracao: workout.duration_minutes ?? undefined,
      exercicios: Array.from(exerciseMap.values()),
    })
  }
  return results
}

export class KroniaChatService {
  private readonly orchestrator: KroniaOrchestrator

  constructor(
    private readonly ragProvider: RagProvider,
    repository?: PlanRepository,
    memoryRepository?: MemoryRepository,
    private readonly adminClient?: SupabaseClient,
  ) {
    const modelClient = new GroqClient()
    this.orchestrator = new KroniaOrchestrator(modelClient, repository, memoryRepository)
  }

  async run(input: ChatServiceInput) {
    let retrievedContext: RetrievedContextItem[] = []
    try {
      retrievedContext = await this.ragProvider.search({
        userId: input.userId,
        query: input.userMessage,
        topK: 8,
      })
    } catch {
      // sem contexto recuperado — continua sem ele
    }

    let labHealthProfile = null
    let labLatestContext = null
    let labLongitudinalContext = null
    let activeDiet: ActiveDietContext | null = null
    let recentWorkouts: RecentWorkoutEntry[] = []

    if (input.userId && this.adminClient) {
      const [labResults, dietResult, workoutResult] = await Promise.allSettled([
        Promise.all([
          getLatestValidLabReport(this.adminClient, input.userId),
          getUserLabLongitudinalContext(this.adminClient, input.userId),
        ]),
        loadActiveDiet(this.adminClient, input.userId),
        loadRecentWorkouts(this.adminClient, input.userId),
      ])

      if (labResults.status === 'fulfilled') {
        const [latestLabReport, longitudinalContext] = labResults.value
        labLatestContext = latestLabReport ?? null
        labHealthProfile = latestLabReport?.healthProfile ?? null
        labLongitudinalContext = longitudinalContext
      }
      if (dietResult.status === 'fulfilled') activeDiet = dietResult.value
      if (workoutResult.status === 'fulfilled') recentWorkouts = workoutResult.value
    }

    return this.orchestrator.run({
      userId: input.userId,
      userMessage: input.userMessage,
      history: input.history,
      userProfile: input.userProfile,
      labHealthProfile,
      labLatestContext,
      labLongitudinalContext,
      activeDiet,
      recentWorkouts,
      retrievedContext,
      sourceOfTruthMode: retrievedContext.length ? "rag_required" : "rag_preferred",
    })
  }
}
