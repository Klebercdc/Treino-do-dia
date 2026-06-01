import type { SupabaseClient } from '@supabase/supabase-js'
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

/* ══════════════════════════════════════════════════════════════
   KRONOS — Contexto nutricional enriquecido (Parte 2)
   Princípio: geração resiliente — retorna o que existe, nunca lança erro.
   Chamado pelo diet route ANTES de montar o prompt para o modelo.
══════════════════════════════════════════════════════════════ */

export interface KronosNutricaoProfile {
  sexo: string | null
  idade: number | null
  peso_kg: number | null
  altura_cm: number | null
  objetivo: string | null
  nivel_atividade: string | null
  refeicoes_por_dia: number | null
  faz_jejum: boolean | null
  tipo_jejum: string | null
  come_fora_frequencia: string | null
  quem_cozinha: string | null
  restricoes_alimentares: string[]
  condicoes_saude: string[]
  medicamentos_continuos: string | null
  alimentos_nao_abre_mao: string | null
  alimentos_nao_come: string | null
  orcamento_alimentar: string | null
  agua_litros_dia: string | null
  consumo_alcool: string | null
  consumo_cafeina: string | null
  historico_dieta: string | null
  tem_compulsao: string | null
  observacoes: string | null
  anamnese_completa: boolean
}

export interface KronosWorkoutSummary {
  diasTreinados: number
  frequenciaSemanal: number
  ultimoTreinoData: string | null
  gruposMusculares: string[]
  volumeEstimado: number
}

export interface KronosFadigaSummary {
  media: number
  tendencia: 'melhorando' | 'piorando' | 'estavel' | 'desconhecida'
  ultimaScore: number | null
}

export interface KronosBiomarkerEntry {
  valor: number | null
  status: 'normal' | 'atencao' | 'alto' | 'baixo' | 'desconhecido'
  unidade: string | null
}

export interface KronosNutricaoContext {
  available: {
    nutritionProfile: boolean
    workoutHistory: boolean
    fadiga: boolean
    biomarkers: boolean
  }
  nutritionProfile: KronosNutricaoProfile | null
  workoutSummary: KronosWorkoutSummary | null
  fadigaSummary: KronosFadigaSummary | null
  biomarkers: Record<string, KronosBiomarkerEntry>
}

const BIOMARKER_TARGETS = [
  'Testosterona Total', 'Vitamina D', 'Ferritina', 'Cortisol',
  'PCR', 'TSH', 'Hemoglobina',
]

function _classifyBiomarker(
  markerName: string,
  value: number | null,
  labFlag: string | null,
  contextFlag: string | null,
): KronosBiomarkerEntry['status'] {
  const flag = (contextFlag || labFlag || '').toLowerCase()
  if (flag.includes('crítico') || flag.includes('critico')) return 'atencao'
  if (flag.includes('alto') || flag.includes('elevado') || flag === 'high') return 'alto'
  if (flag.includes('baixo') || flag.includes('defici') || flag === 'low') return 'baixo'
  if (flag.includes('normal') || flag === 'ok') return 'normal'
  if (value == null) return 'desconhecido'
  return 'normal'
}

/**
 * Builds a rich nutritional + training context for KRONOS diet generation.
 * Always returns a valid context object — never throws, never blocks on missing data.
 */
export async function buildKronosNutricaoContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<KronosNutricaoContext> {
  const ctx: KronosNutricaoContext = {
    available: { nutritionProfile: false, workoutHistory: false, fadiga: false, biomarkers: false },
    nutritionProfile: null,
    workoutSummary: null,
    fadigaSummary: null,
    biomarkers: {},
  }

  // 1. Nutrition profile
  try {
    const { data } = await supabase
      .from('nutrition_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      ctx.nutritionProfile = {
        sexo: data.sexo ?? null,
        idade: data.idade ?? null,
        peso_kg: data.peso_kg != null ? Number(data.peso_kg) : null,
        altura_cm: data.altura_cm != null ? Number(data.altura_cm) : null,
        objetivo: data.objetivo ?? null,
        nivel_atividade: data.nivel_atividade ?? null,
        refeicoes_por_dia: data.refeicoes_por_dia ?? null,
        faz_jejum: data.faz_jejum ?? null,
        tipo_jejum: data.tipo_jejum ?? null,
        come_fora_frequencia: data.come_fora_frequencia ?? null,
        quem_cozinha: data.quem_cozinha ?? null,
        restricoes_alimentares: data.restricoes_alimentares ?? [],
        condicoes_saude: data.condicoes_saude ?? [],
        medicamentos_continuos: data.medicamentos_continuos ?? null,
        alimentos_nao_abre_mao: data.alimentos_nao_abre_mao ?? null,
        alimentos_nao_come: data.alimentos_nao_come ?? null,
        orcamento_alimentar: data.orcamento_alimentar ?? null,
        agua_litros_dia: data.agua_litros_dia ?? null,
        consumo_alcool: data.consumo_alcool ?? null,
        consumo_cafeina: data.consumo_cafeina ?? null,
        historico_dieta: data.historico_dieta ?? null,
        tem_compulsao: data.tem_compulsao ?? null,
        observacoes: data.observacoes ?? null,
        anamnese_completa: data.anamnese_completa ?? false,
      }
      ctx.available.nutritionProfile = true
    }
  } catch (e) {
    console.error('[buildKronosNutricaoContext] nutrition_profiles error', e)
  }

  // 2. Workout history — últimos 7 dias
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: workouts } = await supabase
      .from('workout_history')
      .select('id, created_at, muscle_groups, exercises')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20)

    if (workouts && workouts.length > 0) {
      const uniqueDays = new Set(workouts.map((w: Record<string, unknown>) => String(w.created_at ?? '').slice(0, 10)))
      const muscleGroups: string[] = []
      let volumeEstimado = 0

      for (const w of workouts as Record<string, unknown>[]) {
        if (Array.isArray(w.muscle_groups)) {
          for (const g of w.muscle_groups) {
            if (typeof g === 'string' && !muscleGroups.includes(g)) muscleGroups.push(g)
          }
        }
        if (Array.isArray(w.exercises)) {
          for (const ex of w.exercises as Record<string, unknown>[]) {
            const series = Array.isArray(ex.series) ? ex.series.length : (Number(ex.sets) || 3)
            const reps = Number(ex.reps) || 10
            volumeEstimado += series * reps
          }
        }
      }

      ctx.workoutSummary = {
        diasTreinados: uniqueDays.size,
        frequenciaSemanal: uniqueDays.size,
        ultimoTreinoData: String(workouts[0].created_at ?? '').slice(0, 10) || null,
        gruposMusculares: muscleGroups.slice(0, 8),
        volumeEstimado,
      }
      ctx.available.workoutHistory = true
    }
  } catch (e) {
    console.error('[buildKronosNutricaoContext] workout_history error', e)
  }

  // 3. Fadiga — últimos 5 registros
  try {
    const { data: fadScores } = await supabase
      .from('fadiga_scores')
      .select('score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (fadScores && fadScores.length > 0) {
      const scores = (fadScores as Record<string, unknown>[]).map((r) => Number(r.score) || 5)
      const media = scores.reduce((a, b) => a + b, 0) / scores.length

      let tendencia: KronosFadigaSummary['tendencia'] = 'estavel'
      if (scores.length >= 2) {
        const first = scores[scores.length - 1]
        const last = scores[0]
        if (last - first > 1) tendencia = 'piorando'
        else if (first - last > 1) tendencia = 'melhorando'
      }

      ctx.fadigaSummary = {
        media: Math.round(media * 10) / 10,
        tendencia,
        ultimaScore: scores[0],
      }
      ctx.available.fadiga = true
    }
  } catch (e) {
    console.error('[buildKronosNutricaoContext] fadiga_scores error', e)
  }

  // 4. Biomarcadores — valores mais recentes
  try {
    const { data: bioRows } = await supabase
      .from('lab_report_biomarkers')
      .select('marker_name, value_numeric, unit, lab_flag, context_flag, created_at')
      .eq('user_id', userId)
      .in('marker_name', BIOMARKER_TARGETS)
      .order('created_at', { ascending: false })

    if (bioRows && bioRows.length > 0) {
      const seen = new Set<string>()
      for (const row of bioRows as Record<string, unknown>[]) {
        const name = String(row.marker_name ?? '')
        if (seen.has(name)) continue
        seen.add(name)
        const valor = row.value_numeric != null ? Number(row.value_numeric) : null
        ctx.biomarkers[name] = {
          valor,
          status: _classifyBiomarker(
            name,
            valor,
            row.lab_flag != null ? String(row.lab_flag) : null,
            row.context_flag != null ? String(row.context_flag) : null,
          ),
          unidade: row.unit != null ? String(row.unit) : null,
        }
      }
      ctx.available.biomarkers = Object.keys(ctx.biomarkers).length > 0
    }
  } catch (e) {
    console.error('[buildKronosNutricaoContext] biomarkers error', e)
  }

  return ctx
}

/**
 * Serializes KronosNutricaoContext into a prompt-ready string block.
 * Returns empty string if no data is available (keeps prompt lean).
 */
export function serializeKronosNutricaoContext(ctx: KronosNutricaoContext | null): string {
  if (!ctx) return ''
  const lines: string[] = []

  if (ctx.nutritionProfile) {
    const p = ctx.nutritionProfile
    lines.push('═══════════════════════════════════════')
    lines.push('PERFIL NUTRICIONAL (anamnese)')
    lines.push('═══════════════════════════════════════')
    if (p.refeicoes_por_dia) lines.push(`refeicoes_por_dia: ${p.refeicoes_por_dia}`)
    if (p.faz_jejum) lines.push(`faz_jejum: sim${p.tipo_jejum ? ' (' + p.tipo_jejum + ')' : ''}`)
    if (p.come_fora_frequencia) lines.push(`come_fora: ${p.come_fora_frequencia}`)
    if (p.quem_cozinha) lines.push(`cozinha: ${p.quem_cozinha}`)
    if (p.restricoes_alimentares?.length) lines.push(`restricoes: ${p.restricoes_alimentares.join(', ')}`)
    if (p.condicoes_saude?.filter((c) => c !== 'nenhuma').length) lines.push(`condicoes_saude: ${p.condicoes_saude.join(', ')}`)
    if (p.medicamentos_continuos) lines.push(`medicamentos: ${p.medicamentos_continuos}`)
    if (p.alimentos_nao_abre_mao) lines.push(`nao_abre_mao: ${p.alimentos_nao_abre_mao}`)
    if (p.alimentos_nao_come) lines.push(`nao_come: ${p.alimentos_nao_come}`)
    if (p.orcamento_alimentar) lines.push(`orcamento: ${p.orcamento_alimentar}`)
    if (p.agua_litros_dia) lines.push(`agua: ${p.agua_litros_dia}`)
    if (p.consumo_alcool) lines.push(`alcool: ${p.consumo_alcool}`)
    if (p.consumo_cafeina) lines.push(`cafeina: ${p.consumo_cafeina}`)
    if (p.historico_dieta) lines.push(`historico_dieta: ${p.historico_dieta}`)
    if (p.tem_compulsao) lines.push(`tem_compulsao: ${p.tem_compulsao}`)
    if (p.observacoes) lines.push(`observacoes: ${p.observacoes.slice(0, 200)}`)
    if (!p.anamnese_completa) lines.push('AVISO: anamnese incompleta — gerar com defaults conservadores')
  }

  if (ctx.workoutSummary) {
    const w = ctx.workoutSummary
    lines.push('')
    lines.push('CARGA DE TREINO (últimos 7 dias)')
    lines.push(`dias_treinados: ${w.diasTreinados} | frequencia_semanal: ${w.frequenciaSemanal}`)
    lines.push(`ultimo_treino: ${w.ultimoTreinoData ?? 'desconhecido'}`)
    lines.push(`grupos_musculares: ${w.gruposMusculares.join(', ') || 'não registrado'}`)
    lines.push(`volume_estimado_reps: ${w.volumeEstimado}`)
  } else {
    lines.push('')
    lines.push('CARGA DE TREINO: sem dados recentes — assumir sedentário moderado para cálculo calórico')
  }

  if (ctx.fadigaSummary) {
    const f = ctx.fadigaSummary
    lines.push('')
    lines.push('FADIGA')
    lines.push(`media: ${f.media}/10 | tendencia: ${f.tendencia} | ultima: ${f.ultimaScore}/10`)
    if (f.media >= 7) lines.push('⚠ Fadiga alta — priorizar anti-inflamatórios e não aumentar déficit')
    else if (f.media < 4) lines.push('✓ Fadiga baixa — pode usar plano normal ou hipercalórico')
  } else {
    lines.push('')
    lines.push('FADIGA: sem dados — usar nível médio (5/10) como referência')
  }

  if (Object.keys(ctx.biomarkers).length > 0) {
    lines.push('')
    lines.push('BIOMARCADORES')
    for (const [name, entry] of Object.entries(ctx.biomarkers)) {
      lines.push(`${name}: ${entry.valor ?? 'n/a'}${entry.unidade ? ' ' + entry.unidade : ''} [${entry.status}]`)
    }
  } else {
    lines.push('')
    lines.push('BIOMARCADORES: sem exames disponíveis — gerar sem ajuste por biomarcadores')
  }

  return lines.join('\n')
}
