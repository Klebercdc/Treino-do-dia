import type { SupabaseClient } from '@supabase/supabase-js'
import type { LoadAnalysis, PREvent, AdaptationSuggestion } from './types'

// Garante que só existe 1 adaptação pending por usuário por vez
async function hasPendingAdaptation(db: SupabaseClient, userId: string): Promise<boolean> {
  const { count } = await db
    .from('adaptation_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')
  return (count ?? 0) > 0
}

// Expira adaptações antigas (> 7 dias sem resposta)
async function expireStaleAdaptations(db: SupabaseClient, userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await db
    .from('adaptation_events')
    .update({ status: 'expired', resolved_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('created_at', cutoff)
}

export async function runDecisionLayer(
  db: SupabaseClient,
  userId: string,
  load: LoadAnalysis,
  prs: PREvent[],
): Promise<AdaptationSuggestion | null> {
  await expireStaleAdaptations(db, userId)

  // PRs têm prioridade máxima — emocionalmente relevante, sempre mostrar
  if (prs.length > 0) {
    const pr = prs[0]
    const improvement = pr.previousOneRmKg
      ? Math.round(((pr.newOneRmKg - pr.previousOneRmKg) / pr.previousOneRmKg) * 100)
      : null

    return {
      type: 'PR_CELEBRATED',
      loadState: load.state,
      reasoning: improvement
        ? `Novo recorde em ${pr.exerciseName}! Seu 1RM estimado subiu de ${pr.previousOneRmKg}kg para ${pr.newOneRmKg}kg (+${improvement}%). O sistema atualizou sua baseline.`
        : `Primeiro recorde registrado em ${pr.exerciseName}: 1RM estimado de ${pr.newOneRmKg}kg.`,
      metadata: { prs: prs.map(p => ({ exerciseName: p.exerciseName, newOneRmKg: p.newOneRmKg, previousOneRmKg: p.previousOneRmKg })) },
    }
  }

  // PRs não bloqueia outras adaptações — mas as seguintes precisam de pending limpo
  if (await hasPendingAdaptation(db, userId)) return null

  // Regra 1 — VERY_HIGH ≥ 7 dias → deload imediato
  if (load.state === 'VERY_HIGH' && load.daysInCurrentState >= 7) {
    return {
      type: 'DELOAD',
      loadState: 'VERY_HIGH',
      reasoning: `Você está com volume acima do MRV há ${load.daysInCurrentState} dias (RPE médio: ${load.avgRpe}). Risco de overtraining aumentado. Recomendo uma semana de deload: reduza o volume em 40-50% mantendo a intensidade.`,
      metadata: { daysInState: load.daysInCurrentState, avgRpe: load.avgRpe },
    }
  }

  // Regra 2 — HIGH ≥ 14 dias → reduzir volume
  if (load.state === 'HIGH' && load.daysInCurrentState >= 14) {
    return {
      type: 'VOLUME_DECREASE',
      loadState: 'HIGH',
      reasoning: `Volume elevado por ${load.daysInCurrentState} dias consecutivos. Reduza em 15% nas próximas 2 semanas para consolidar as adaptações antes de progredir.`,
      metadata: { daysInState: load.daysInCurrentState, avgRpe: load.avgRpe },
    }
  }

  // Regra 3 — LOW ≥ 14 dias → aumentar volume
  if (load.state === 'LOW' && load.daysInCurrentState >= 14 && load.daysSinceLastWorkout < 10) {
    return {
      type: 'VOLUME_INCREASE',
      loadState: 'LOW',
      reasoning: `Você está treinando abaixo do volume mínimo efetivo há ${load.daysInCurrentState} dias. Aumente o volume em 1-2 séries por exercício principal para gerar estímulo de adaptação.`,
      metadata: { daysInState: load.daysInCurrentState, totalSetsLast7Days: load.totalSetsLast7Days },
    }
  }

  // Regra 4 — Inativo ≥ 10 dias, mas tinha histórico
  if (load.daysSinceLastWorkout >= 10 && load.totalTrainingDays >= 4) {
    return {
      type: 'RETURN_REMINDER',
      loadState: null,
      reasoning: `Você não treina há ${load.daysSinceLastWorkout} dias. O KRONOS AI pausou a análise de progresso. Quando você voltar, o sistema retoma de onde parou.`,
      metadata: { daysSinceLastWorkout: load.daysSinceLastWorkout },
    }
  }

  // Regra 5 — Consistência ≥ 28 dias + MODERATE → recompensar e sugerir progressão
  if (
    load.state === 'MODERATE' &&
    load.totalTrainingDays >= 28 &&
    load.daysSinceLastWorkout < 5
  ) {
    // Verificar se já deu CONSISTENCY_REWARD nos últimos 30 dias
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await db
      .from('adaptation_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('adaptation_type', 'CONSISTENCY_REWARD')
      .gte('created_at', since30)
    if ((count ?? 0) === 0) {
      return {
        type: 'CONSISTENCY_REWARD',
        loadState: 'MODERATE',
        reasoning: `${load.totalTrainingDays} dias de treino registrados. Sua consistência está no ponto certo para uma progressão de carga. Considere aumentar o peso em 2-5% nos exercícios principais.`,
        metadata: { totalTrainingDays: load.totalTrainingDays },
      }
    }
  }

  // Regra 6 — Múltiplos PRs recentes (≥ 3 em 14 dias) → pronto para sobrecarga progressiva
  const { count: recentPRCount } = await db
    .from('personal_records')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'auto')
    .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())

  if ((recentPRCount ?? 0) >= 3) {
    return {
      type: 'PROGRESSIVE_OVERLOAD_READY',
      loadState: load.state,
      reasoning: `Você bateu ${recentPRCount} recordes nas últimas 2 semanas. Seu corpo está respondendo bem ao estímulo. É hora de adicionar volume ou intensidade de forma sistemática.`,
      metadata: { recentPRCount },
    }
  }

  return null
}

export async function saveAdaptation(
  db: SupabaseClient,
  userId: string,
  suggestion: AdaptationSuggestion,
): Promise<string> {
  const { data, error } = await db
    .from('adaptation_events')
    .insert({
      user_id: userId,
      adaptation_type: suggestion.type,
      load_state: suggestion.loadState,
      reasoning: suggestion.reasoning,
      status: 'pending',
      metadata: suggestion.metadata,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Falha ao salvar adaptação: ${error.message}`)
  return data.id
}
