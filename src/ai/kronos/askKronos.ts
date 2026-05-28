'use strict'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const promptBuilder = require('./buildKronosSystemPrompt')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const domainResolver = require('./resolveKronosClinicalDomain')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const evidenceContextBuilder = require('./buildClinicalEvidenceContext')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const guardrailsBuilder = require('./buildClinicalGuardrails')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const examInterpreter = require('./interpretarExames')

interface ContextoClinico {
  patologias?: string[]
  [key: string]: unknown
}

// Index signature garante assignability a Record<string, unknown>
interface ClinicalEvidenceContext {
  domain?: unknown
  evidenceAvailable?: boolean
  topics?: string[]
  sources?: unknown[]
  clinicalFocus?: {
    patologia?: string[]
    biomarcadoresAlterados?: string[]
    usarTreinoReal?: boolean
    usarDietaReal?: boolean
    usarExamesReais?: boolean
  }
  priorityFlags?: string[]
  repository?: { sourceTable?: string | null; error?: string | null }
  [key: string]: unknown
}

interface KronosContext {
  contextoClinico?: ContextoClinico
  user?: { patologia?: string; patologias?: string[] }
  exames?: Record<string, unknown>
  examesInterpretados?: unknown
  clinicalDomain?: unknown
  clinicalEvidenceContext?: ClinicalEvidenceContext
  clinicalGuardrails?: unknown
  [key: string]: unknown
}

function getDefaultBuildKronosContext() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./buildKronosContext').buildKronosContext
}

function buildClinicalContextForExams(ctx: KronosContext): ContextoClinico {
  const clinical: ContextoClinico = Object.assign({}, ctx?.contextoClinico ?? {})

  // Tipagem explícita para evitar unknown[] no concat
  const patologias: string[] = ([] as string[])
    .concat(Array.isArray(clinical.patologias) ? (clinical.patologias as string[]) : [])
    .concat(ctx?.user?.patologia ? [ctx.user.patologia] : [])
    .concat(ctx?.user && Array.isArray(ctx.user.patologias) ? (ctx.user.patologias as string[]) : [])

  const seen: Record<string, boolean> = Object.create(null)
  clinical.patologias = patologias.filter((item) => {
    const clean = String(item ?? '').trim()
    const key = clean.toLowerCase()
    if (!clean || seen[key]) return false
    seen[key] = true
    return true
  })

  return clinical
}

function withClinicalAppContext(
  kronosContext: KronosContext,
  clinicalDomain: unknown,
  clinicalEvidenceContext: ClinicalEvidenceContext,
  clinicalGuardrails: unknown,
): KronosContext {
  const ctx: KronosContext = Object.assign({}, kronosContext ?? {})
  const originalExams =
    ctx.exames && typeof ctx.exames === 'object' ? (ctx.exames as Record<string, unknown>) : {}
  const interpretedExams = examInterpreter.interpretarExames(
    originalExams,
    buildClinicalContextForExams(ctx),
  )
  ctx.examesInterpretados = interpretedExams
  ctx.exames = Object.assign({}, originalExams, {
    disponivel: originalExams.disponivel === true || interpretedExams.disponivel,
    dataUltimaColeta: interpretedExams.dataUltimaColeta,
    alertas: interpretedExams.alertas,
    impactoClinicoPorBiomarcador: interpretedExams.impactoClinicoPorBiomarcador,
    resumoClinico: interpretedExams.resumoClinico,
  })
  ctx.clinicalDomain = clinicalDomain
  ctx.clinicalEvidenceContext = clinicalEvidenceContext
  ctx.clinicalGuardrails = clinicalGuardrails
  return ctx
}

interface AskKronosInput {
  callLLM: (args: {
    systemPrompt: string
    userMessage: string
    appContext: KronosContext
    history: unknown[]
    maxTokens?: number
    temperature?: number
  }) => Promise<unknown>
  message?: string
  userMessage?: string
  userId?: string
  kronosContext?: KronosContext
  buildKronosContext?: (args: {
    userId?: string
    message: string
    screenContext: unknown | null
  }) => Promise<KronosContext>
  topic?: string
  intent?: string
  mode?: string
  maxTokens?: number
  temperature?: number
  history?: unknown[]
  screenContext?: unknown
}

async function askKronos(input: AskKronosInput) {
  const options = input && typeof input === 'object' ? input : ({} as AskKronosInput)
  if (typeof options.callLLM !== 'function') {
    throw new Error('askKronos requires callLLM({ systemPrompt, userMessage, appContext })')
  }

  const message = String(options.message ?? options.userMessage ?? '').trim()
  const kronosContext: KronosContext =
    options.kronosContext ??
    (await (options.buildKronosContext ?? getDefaultBuildKronosContext())({
      userId: options.userId,
      message,
      screenContext: options.screenContext ?? null,
    }))

  const clinicalDomain = domainResolver.resolveKronosClinicalDomain({
    topic: options.topic,
    intent: options.intent,
    message,
  })

  const clinicalEvidenceContext: ClinicalEvidenceContext =
    await evidenceContextBuilder.buildClinicalEvidenceContext({
      kronosContext,
      message,
      topic: options.topic,
      intent: options.intent,
      clinicalDomain,
    })

  const clinicalGuardrails = guardrailsBuilder.buildClinicalGuardrails(clinicalDomain)
  const appContext = withClinicalAppContext(
    kronosContext,
    clinicalDomain,
    clinicalEvidenceContext,
    clinicalGuardrails,
  )

  const systemPrompt = promptBuilder.buildKronosSystemPrompt(appContext, options.intent, {
    mode: options.mode,
    topic: options.topic,
    maxTokens: options.maxTokens,
    clinicalDomain,
    clinicalEvidenceContext,
    clinicalGuardrails,
  })

  const response = await options.callLLM({
    systemPrompt,
    userMessage: message,
    appContext,
    history: options.history ?? [],
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  })

  return {
    response,
    kronosContext: appContext,
    systemPrompt,
  }
}

module.exports = { askKronos }
