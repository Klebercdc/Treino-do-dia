import { NextRequest, NextResponse } from 'next/server'
import { requireBearerAuth } from '../../_shared/requireBearerAuth'
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin'
import { analyzeTrainingLoad } from '../../../../core/training/trainingLoadEngine'
import { detectAndSavePRs } from '../../../../core/training/prDetection'
import { runDecisionLayer, saveAdaptation } from '../../../../core/training/decisionLayerV1'

// GET — busca adaptações pendentes do usuário
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

// POST — analisa treino OU resolve adaptação existente
export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req)
  if (!auth.ok) return auth.response

  const userId = auth.user.id
  const body = await req.json().catch(() => null)
  if (!body?.action) {
    return NextResponse.json({ error: 'action é obrigatório' }, { status: 400 })
  }

  const db = createAdminSupabaseClient()

  // Aceitar ou rejeitar adaptação existente
  if (body.action === 'accept' || body.action === 'reject') {
    if (!body.id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const { error } = await db
      .from('adaptation_events')
      .update({
        status: body.action === 'accept' ? 'accepted' : 'rejected',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Analisar treino e gerar adaptação se necessário
  if (body.action === 'analyze') {
    try {
      // Buscar nível do usuário no perfil
      const { data: profile } = await db
        .from('profiles')
        .select('nivel')
        .eq('id', userId)
        .maybeSingle()

      const level = (profile?.nivel as string | null) ?? 'intermediario'

      // Detectar PRs do treino atual (se workoutId fornecido)
      const prs = body.workoutId
        ? await detectAndSavePRs(db, userId, body.workoutId)
        : []

      // Analisar carga de treino
      const load = await analyzeTrainingLoad(db, userId, level)

      // Rodar Decision Layer
      const suggestion = await runDecisionLayer(db, userId, load, prs)

      if (!suggestion) {
        return NextResponse.json({
          ok: true,
          adaptation: null,
          load: { state: load.state, avgRpe: load.avgRpe },
          message: 'Nenhuma adaptação necessária agora.',
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
