import type { ActiveDietContext, ChatMessage, MemoryItem, RecentWorkoutEntry, RetrievedContextItem, UserProfile } from './types'
import type { HealthPerformanceProfile, LabLongitudinalContext, StoredLabContext } from '../core/labs/labTypes'
import { serializeHealthProfile } from '../core/labs/labRules'

function serializeProfile(profile?: UserProfile | null): string {
  if (!profile) return 'Sem perfil disponível.'

  const patologiaList = [
    ...(profile.patologias ?? []),
    ...(profile.patologia && !profile.patologias?.includes(profile.patologia) ? [profile.patologia] : []),
  ].filter(Boolean)

  return [
    `nome: ${profile.nome ?? ''}`,
    `objetivo: ${profile.objetivo ?? ''}`,
    `nível: ${profile.nivel ?? ''}`,
    `idade: ${profile.idade ?? ''}`,
    `sexo: ${profile.sexo ?? ''}`,
    `pesoKg: ${profile.pesoKg ?? ''}`,
    `alturaCm: ${profile.alturaCm ?? ''}`,
    `padrao_alimentar: ${profile.padraoAlimentar ?? ''}`,
    `patologia: ${patologiaList.length ? patologiaList.join(', ') : 'não informada'}`,
    `restrições: ${(profile.restricoes ?? []).join(', ')}`,
    `preferências: ${(profile.preferencias ?? []).join(', ')}`,
    `lesões: ${(profile.lesoes ?? []).join(', ')}`,
    `rotina: ${profile.rotina ?? ''}`,
    `observações: ${profile.observacoes ?? ''}`,
    `usa_hormonios_exogenos: ${profile.usesExogenousHormones ?? ''}`,
    `contexto_hormonal: ${profile.hormoneContextType ?? ''}`,
    `compostos_declarados: ${(profile.declaredCompounds ?? []).join(', ')}`,
    `ultima_administracao_hormonal: ${profile.lastAdministrationAt ?? ''}`,
    `modo_monitoramento: ${profile.monitoringMode ?? ''}`,
  ].join('\n')
}

function serializeActiveDiet(diet?: ActiveDietContext | null): string | null {
  if (!diet) return null
  const lines = [
    '=== DIETA ATIVA ===',
    `plano: ${diet.titulo}`,
    `metas: ${diet.metas.calorias ?? '?'}kcal | proteínas: ${diet.metas.proteinas ?? '?'}g | carboidratos: ${diet.metas.carboidratos ?? '?'}g | gorduras: ${diet.metas.gorduras ?? '?'}g`,
  ]
  for (const refeicao of diet.refeicoes) {
    lines.push(`\n${refeicao.nome}${refeicao.horario ? ' (' + refeicao.horario + ')' : ''}:`)
    for (const item of refeicao.itens) {
      const macros: string[] = []
      if (item.calorias) macros.push(`${item.calorias}kcal`)
      if (item.proteinas) macros.push(`P:${item.proteinas}g`)
      if (item.carboidratos) macros.push(`C:${item.carboidratos}g`)
      if (item.gorduras) macros.push(`G:${item.gorduras}g`)
      lines.push(`  • ${item.alimento} — ${item.quantidade}${macros.length ? ' (' + macros.join(' ') + ')' : ''}`)
    }
  }
  return lines.join('\n')
}

function serializeRecentWorkouts(workouts?: RecentWorkoutEntry[]): string | null {
  if (!workouts || !workouts.length) return null
  const lines = ['=== TREINOS RECENTES ===']
  for (const workout of workouts.slice(0, 3)) {
    lines.push(`\nData: ${workout.data}${workout.duracao ? ' | ' + workout.duracao + 'min' : ''}`)
    for (const ex of workout.exercicios) {
      const seriesStr = ex.series
        .map((s) => [s.repeticoes ? `${s.repeticoes}rep` : '', s.carga ? `${s.carga}kg` : '', s.rpe ? `RPE${s.rpe}` : ''].filter(Boolean).join('/'))
        .filter(Boolean)
        .join(', ')
      lines.push(`  • ${ex.nome}${ex.grupoMuscular ? ' [' + ex.grupoMuscular + ']' : ''}: ${seriesStr || 'registrado'}`)
    }
  }
  return lines.join('\n')
}

function serializeHistory(history: ChatMessage[]): string {
  const recent = history.slice(-8)
  return recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
}

function serializeContext(context: RetrievedContextItem[] = []): string {
  if (!context.length) return 'Sem contexto recuperado.'
  return context
    .slice(0, 8)
    .map((item, idx) => {
      const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
      const title = item.title ? `Título: ${item.title}\n` : ''
      const source = metadata.source ? `Origem: ${String(metadata.source)}\n` : ''
      const category = metadata.category ? `Categoria: ${String(metadata.category)}\n` : ''
      const href = metadata.url ? `Link: ${String(metadata.url)}\n` : ''
      const similarity = item.score != null ? `Relevância: ${Number(item.score).toFixed(3)}\n` : ''
      return `Fonte ${idx + 1}\n${title}${source}${category}${href}${similarity}Conteúdo: ${item.content}`
    })
    .join('\n\n')
}

function serializeMemory(memoryItems: MemoryItem[] = []): string {
  if (!memoryItems.length) return 'Sem memória útil.'
  return memoryItems
    .slice(0, 10)
    .map((m, idx) => `Memória ${idx + 1} [${m.memoryType}]: ${m.content}`)
    .join('\n')
}

/**
 * Serialize a HealthPerformanceProfile into AI-ready context text.
 * Returns null when no profile is available (keeps prompt clean).
 */
function serializeLabContext(healthProfile?: HealthPerformanceProfile | null): string | null {
  if (!healthProfile) return null
  try {
    return serializeHealthProfile(healthProfile)
  } catch {
    return null
  }
}

function serializeLatestLabContext(context?: StoredLabContext | null): string | null {
  if (!context) return null

  const lines: string[] = [
    '=== ÚLTIMO EXAME LABORATORIAL ===',
    `exame_id: ${context.id}`,
    `data: ${context.createdAt ?? 'n/a'}`,
    `modo: ${context.mode}`,
  ]

  if (context.hormoneContext) {
    lines.push(`contexto_hormonal: ${context.hormoneContext.hormone_context_type}`)
    lines.push(`usa_hormonios_exogenos: ${context.hormoneContext.uses_exogenous_hormones}`)
    if (context.hormoneContext.declared_compounds.length) {
      lines.push(`compostos_declarados: ${context.hormoneContext.declared_compounds.join(', ')}`)
    }
  }

  if (context.interpretationSummary) {
    lines.push(`resumo_contextual: ${context.interpretationSummary}`)
  }

  const topMarkers = (context.markerInterpretations ?? [])
    .filter((item) => (item.lab_flag ?? item.flag) || item.context_flag)
    .slice(0, 8)

  if (topMarkers.length) {
    lines.push('marcadores_contextualizados:')
    for (const marker of topMarkers) {
      const value = marker.value_numeric != null ? String(marker.value_numeric) : (marker.value_text ?? 'n/a')
      lines.push(
        `  • ${marker.marker_name}: valor=${value}${marker.unit ? ' ' + marker.unit : ''} | lab_flag=${marker.lab_flag ?? marker.flag ?? 'n/a'} | context_flag=${marker.context_flag ?? 'n/a'} | prioridade=${marker.monitor_priority ?? 'n/a'} | resumo=${marker.feedback_summary ?? 'n/a'}`,
      )
    }
  }

  return lines.join('\n')
}

function serializeLabLongitudinalContext(context?: LabLongitudinalContext | null): string | null {
  if (!context || context.totalReports <= 0) return null

  const lines: string[] = [
    '=== HISTÓRICO LONGITUDINAL DE EXAMES ===',
    `total_exames_validos: ${context.totalReports}`,
    `ultimo_exame_id: ${context.latestReportId ?? 'n/a'}`,
    `ultimo_exame_data: ${context.latestReportDate ?? 'n/a'}`,
  ]

  if (context.previousReportId) {
    lines.push(`exame_anterior_id: ${context.previousReportId}`)
    lines.push(`exame_anterior_data: ${context.previousReportDate ?? 'n/a'}`)
  }

  if (context.summaryText) {
    lines.push(`resumo_longitudinal: ${context.summaryText}`)
  }

  if (context.newAlertMarkers.length) {
    lines.push(`novos_alertas: ${context.newAlertMarkers.slice(0, 6).join(', ')}`)
  }
  if (context.persistentAbnormalMarkers.length) {
    lines.push(`alteracoes_persistentes: ${context.persistentAbnormalMarkers.slice(0, 6).join(', ')}`)
  }
  if (context.worseningMarkers.length) {
    lines.push(`marcadores_piorando: ${context.worseningMarkers.slice(0, 6).join(', ')}`)
  }
  if (context.improvingMarkers.length) {
    lines.push(`marcadores_melhorando: ${context.improvingMarkers.slice(0, 6).join(', ')}`)
  }
  if (context.stableMarkers.length) {
    lines.push(`marcadores_estaveis: ${context.stableMarkers.slice(0, 6).join(', ')}`)
  }
  if (context.latestClinicalFlags.length) {
    lines.push(`flags_clinicas_atuais: ${context.latestClinicalFlags.slice(0, 6).join(', ')}`)
  }
  if (context.latestCriticalFlags.length) {
    lines.push(`flags_criticas_atuais: ${context.latestCriticalFlags.slice(0, 6).join(', ')}`)
  }

  const signals = context.signals || {}
  const signalEntries = [
    ['recuperacao', signals.recovery],
    ['prontidao_treino', signals.trainingReadiness],
    ['risco_metabolico', signals.metabolicRisk],
    ['tendencia_hormonal', signals.hormonalTrend],
    ['persistencia_clinica', signals.clinicalPersistence],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  if (signalEntries.length) {
    lines.push('sinais_globais:')
    for (const [label, value] of signalEntries) {
      lines.push(`  • ${label}: ${value}`)
    }
  }

  const trendRows = context.markerTimeline.slice(0, 12)
  if (trendRows.length) {
    lines.push('comparacoes_por_biomarcador:')
    for (const marker of trendRows) {
      const latestValue = marker.latestValueNumeric != null ? String(marker.latestValueNumeric) : (marker.latestValueText || 'n/a')
      const previousValue = marker.previousValueNumeric != null ? String(marker.previousValueNumeric) : (marker.previousValueText || 'n/a')
      lines.push(`  • ${marker.markerName}: ${marker.status} | atual=${latestValue}${marker.unit ? ' ' + marker.unit : ''} | anterior=${previousValue}${marker.unit ? ' ' + marker.unit : ''}`)
    }
  }

  return lines.join('\n')
}

export function buildUserMessageBundle(args: {
  userMessage: string
  history: ChatMessage[]
  userProfile?: UserProfile | null
  retrievedContext?: RetrievedContextItem[]
  memoryItems?: MemoryItem[]
  sourceOfTruthMode?: 'rag_required' | 'rag_preferred'
  labHealthProfile?: HealthPerformanceProfile | null
  labLatestContext?: StoredLabContext | null
  labLongitudinalContext?: LabLongitudinalContext | null
  activeDiet?: ActiveDietContext | null
  recentWorkouts?: RecentWorkoutEntry[]
  [key: string]: unknown
}): string {
  const labSection = serializeLabContext(args.labHealthProfile)
  const latestLabSection = serializeLatestLabContext(args.labLatestContext)
  const longitudinalSection = serializeLabLongitudinalContext(args.labLongitudinalContext)
  const dietSection = serializeActiveDiet(args.activeDiet)
  const workoutSection = serializeRecentWorkouts(args.recentWorkouts)

  const parts = [
    'MODO DE CONHECIMENTO:',
    args.sourceOfTruthMode === 'rag_required'
      ? 'Use apenas o contexto recuperado, memória útil e dados do usuário. Trate o CONTEXTO RECUPERADO como referência oficial. Se não houver contexto suficiente, diga claramente.'
      : 'Priorize o contexto recuperado, memória útil e dados do usuário. Trate o CONTEXTO RECUPERADO como referência oficial quando existir. Se o contexto vier vazio, responda de forma útil e conservadora com base no perfil e na memória. Nunca mencione ao usuário a presença ou ausência de artigos, base científica ou contexto recuperado.',
    '',
    'PERFIL DO USUÁRIO:',
    serializeProfile(args.userProfile),
    '',
    'MEMÓRIA ÚTIL:',
    serializeMemory(args.memoryItems),
    '',
    'HISTÓRICO RECENTE:',
    serializeHistory(args.history),
    '',
    'CONTEXTO RECUPERADO:',
    serializeContext(args.retrievedContext),
  ]

  if (dietSection) {
    parts.push('')
    parts.push('DIETA ATIVA DO USUÁRIO (usar para ajustes, análise e geração de nova dieta):')
    parts.push(dietSection)
  }

  if (workoutSection) {
    parts.push('')
    parts.push('TREINOS RECENTES DO USUÁRIO (usar para análise de volume, progressão e recomendações):')
    parts.push(workoutSection)
  }

  if (labSection) {
    parts.push('')
    parts.push('DADOS DE EXAMES LABORATORIAIS (usar para personalização de treino, dieta e recuperação):')
    parts.push(labSection)
  }

  if (latestLabSection) {
    parts.push('')
    parts.push('CONTEXTO INTERPRETATIVO DO ÚLTIMO EXAME (referência laboratorial + leitura esportiva contextual):')
    parts.push(latestLabSection)
  }

  if (longitudinalSection) {
    parts.push('')
    parts.push('HISTÓRICO LONGITUDINAL DE EXAMES (comparar evolução real sem diagnosticar):')
    parts.push(longitudinalSection)
  }

  parts.push('')
  parts.push('MENSAGEM ATUAL DO USUÁRIO:')
  parts.push(args.userMessage)

  return parts.join('\n')
}
