import { NextRequest, NextResponse } from 'next/server'
import { requireBearerAuth } from '../../_shared/requireBearerAuth'
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin'
import { analyzeTrainingLoad } from '../../../../core/training/trainingLoadEngine'
import { detectAndSavePRs } from '../../../../core/training/prDetection'
import { runDecisionLayer, saveAdaptation } from '../../../../core/training/decisionLayerV1'
import type { SupabaseClient } from '@supabase/supabase-js'

// Estrutura que o app.js envia
interface SessionSet {
  kg: string | number
  reps: string | number
  rpe: string | number
}

interface SessionCard {
  name: string
  exerciseRef?: { exercise_id?: string | null }
  values: SessionSet[]
}

interface SessionSection {
  treinoKey: string
  cards: SessionCard[]
}

interface WorkoutSession {
  createdAt?: string
  durationMin?: number
  state?: {
    sections?: SessionSection[]
  }
}

// Garante que o exercício existe na tabela exercises (upsert por nome normalizado)
async function resolveExerciseId(
  db: SupabaseClient,
  name: string,
  hintId?: string | null,
): Promise<string | null> {
  if (!name?.trim()) return null

  // Se o frontend já conhece o ID, confiar nele
  if (hintId) {
    const { data } = await db.from('exercises').select('id').eq('id', hintId).maybeSingle()
    if (data?.id) return data.id
  }

  // Buscar por nome normalizado
  const normalized = name.trim().toLowerCase()
  const { data: existing } = await db
    .from('exercises')
    .select('id')
    .ilike('name', normalized)
    .maybeSingle()

  if (existing?.id) return existing.id

  // Criar novo exercício
  const { data: created } = await db
    .from('exercises')
    .insert({ name: name.trim(), source: 'auto' })
    .select('id')
    .maybeSingle()

  return created?.id ?? null
}

// Normaliza a sessão do app.js para as tabelas relacionais
async function normalizeSession(
  db: SupabaseClient,
  userId: string,
  session: WorkoutSession,
): Promise<string | null> {
  const sections = session.state?.sections
  if (!sections?.length) return null

  const date = session.createdAt
    ? new Date(session.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  // Criar registro de treino
  const { data: workout } = await db
    .from('workouts')
    .insert({
      user_id: userId,
      date,
      duration_minutes: session.durationMin ?? null,
    })
    .select('id')
    .single()

  if (!workout?.id) return null

  // Criar logs dos exercícios
  const logs: Array<{
    workout_id: string
    exercise_id: string
    weight_kg: number | null
    reps: number | null
    rpe: number
  }> = []

  for (const section of sections) {
    for (const card of section.cards ?? []) {
      const exerciseId = await resolveExerciseId(
        db,
        card.name,
        card.exerciseRef?.exercise_id,
      )
      if (!exerciseId) continue

      for (const set of card.values ?? []) {
        const kg = set.kg !== '' && set.kg != null ? Number(set.kg) : null
        const reps = set.reps !== '' && set.reps != null ? Number(set.reps) : null
        const rpe = set.rpe !== '' && set.rpe != null ? Number(set.rpe) : 7

        if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) continue

        logs.push({
          workout_id: workout.id,
          exercise_id: exerciseId,
          weight_kg: kg && Number.isFinite(kg) ? kg : null,
          reps: reps && Number.isFinite(reps) ? reps : null,
          rpe: rpe,
        })
      }
    }
  }

  if (logs.length > 0) {
    await db.from('workout_logs').insert(logs)
  }

  return workout.id
}

// GET — busca adaptações pendentes
export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req)
  if (!auth.ok) return auth.response

  const db = createAdminSupabaseClient()

  const { data: pending } = await db
    .from('adaptation_events')
    .select('id, adaptation_type, load_state, reasoning, metadata, created_at')
    .eq('user_id', auth.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ ok: true, adaptations: pending ?? [] })
}

// POST — normalize + analyze | accept | reject
export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req)
  if (!auth.ok) return auth.response

  const userId = auth.user.id
  const body = await req.json().catch(() => null)
  if (!body?.action) {
    return NextResponse.json({ error: 'action é obrigatório' }, { status: 400 })
  }

  const db = createAdminSupabaseClient()

  // Aceitar ou rejeitar
  if (body.action === 'accept' || body.action === 'reject') {
    if (!body.id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    await db
      .from('adaptation_events')
      .update({
        status: body.action === 'accept' ? 'accepted' : 'rejected',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .eq('user_id', userId)
      .eq('status', 'pending')

    return NextResponse.json({ ok: true })
  }

  // Analisar treino
  if (body.action === 'analyze') {
    try {
      // Normalizar sessão para tabelas relacionais
      let workoutId: string | null = null
      if (body.session) {
        workoutId = await normalizeSession(db, userId, body.session as WorkoutSession)
      }

      // Nível do usuário
      const { data: profile } = await db
        .from('profiles')
        .select('nivel')
        .eq('id', userId)
        .maybeSingle()

      const level = (profile?.nivel as string | null) ?? 'intermediario'

      // Detectar PRs do treino atual
      const prs = workoutId ? await detectAndSavePRs(db, userId, workoutId) : []

      // Analisar carga
      const load = await analyzeTrainingLoad(db, userId, level)

      // Decision Layer
      const suggestion = await runDecisionLayer(db, userId, load, prs)

      if (!suggestion) {
        return NextResponse.json({
          ok: true,
          adaptation: null,
          load: { state: load.state, avgRpe: load.avgRpe },
        })
      }

      const adaptationId = await saveAdaptation(db, userId, suggestion)

      return NextResponse.json({
        ok: true,
        adaptation: {
          id: adaptationId,
          type: suggestion.type,
          reasoning: suggestion.reasoning,
          loadState: suggestion.loadState,
          metadata: suggestion.metadata,
        },
        load: { state: load.state, avgRpe: load.avgRpe },
      })
    } catch (err) {
      console.error('[adaptations] analyze error:', err)
      return NextResponse.json({ error: 'Erro ao analisar treino.' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action inválido' }, { status: 400 })
}
