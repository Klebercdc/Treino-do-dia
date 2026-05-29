import { buildKronosSystemPrompt } from './buildKronosSystemPrompt';
import { resolveKronosClinicalDomain } from './resolveKronosClinicalDomain';
import { buildClinicalEvidenceContext } from './buildClinicalEvidenceContext';
import { buildClinicalGuardrails } from './buildClinicalGuardrails';
import { interpretarExames } from './interpretarExames';
import { buildKronosContext as defaultBuildKronosContext } from './buildKronosContext';
import type { ClinicalDomain } from './resolveKronosClinicalDomain';
import type { ClinicalGuardrails } from './buildClinicalGuardrails';
import type { ClinicalEvidenceContext } from './buildClinicalEvidenceContext';

interface LLMCallInput {
  systemPrompt: string;
  userMessage: string;
  appContext: Record<string, unknown>;
  history: unknown[];
  maxTokens?: number;
  temperature?: number;
}

interface AskKronosInput {
  callLLM: (input: LLMCallInput) => Promise<unknown>;
  message?: string;
  userMessage?: string;
  userId?: string;
  topic?: string;
  intent?: string;
  mode?: string;
  maxTokens?: number;
  temperature?: number;
  kronosContext?: Record<string, unknown>;
  buildKronosContext?: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  screenContext?: unknown;
  history?: unknown[];
}

export interface AskKronosResult {
  response: unknown;
  kronosContext: Record<string, unknown>;
  systemPrompt: string;
}

interface ContextoClinico {
  patologias?: string[];
}

interface ContextoUser {
  patologia?: string;
  patologias?: string[];
}

function buildClinicalContextForExams(ctx: Record<string, unknown>): ContextoClinico {
  const clinical: ContextoClinico = Object.assign({}, (ctx.contextoClinico as ContextoClinico) ?? {});
  const user = ctx.user as ContextoUser | undefined;

  const patologias: string[] = [
    ...(Array.isArray(clinical.patologias) ? clinical.patologias as string[] : []),
    ...(user?.patologia ? [user.patologia] : []),
    ...(Array.isArray(user?.patologias) ? user!.patologias! : []),
  ];

  const seen: Record<string, boolean> = Object.create(null);
  clinical.patologias = patologias.filter((item) => {
    const clean = String(item ?? '').trim();
    const key = clean.toLowerCase();
    if (!clean || seen[key]) return false;
    seen[key] = true;
    return true;
  });
  return clinical;
}

function withClinicalAppContext(
  kronosContext: Record<string, unknown>,
  clinicalDomain: ClinicalDomain,
  clinicalEvidenceContext: ClinicalEvidenceContext,
  clinicalGuardrails: ClinicalGuardrails
): Record<string, unknown> {
  const ctx = { ...kronosContext };
  const originalExams = ctx.exames && typeof ctx.exames === 'object' ? ctx.exames as Record<string, unknown> : {};
  const interpretedExams = interpretarExames(
    originalExams as Parameters<typeof interpretarExames>[0],
    buildClinicalContextForExams(ctx)
  );

  ctx.examesInterpretados = interpretedExams;
  ctx.exames = {
    ...originalExams,
    disponivel: originalExams['disponivel'] === true || interpretedExams.disponivel,
    dataUltimaColeta: interpretedExams.dataUltimaColeta,
    alertas: interpretedExams.alertas,
    impactoClinicoPorBiomarcador: interpretedExams.impactoClinicoPorBiomarcador,
    resumoClinico: interpretedExams.resumoClinico,
  };
  ctx.clinicalDomain = clinicalDomain;
  ctx.clinicalEvidenceContext = clinicalEvidenceContext;
  ctx.clinicalGuardrails = clinicalGuardrails;
  return ctx;
}

export async function askKronos(input: AskKronosInput): Promise<AskKronosResult> {
  if (typeof input.callLLM !== 'function') {
    throw new Error('askKronos requires callLLM({ systemPrompt, userMessage, appContext })');
  }

  const message = String(input.message ?? input.userMessage ?? '').trim();
  const buildCtx = input.buildKronosContext ?? defaultBuildKronosContext;

  const kronosContext = input.kronosContext ?? await buildCtx({
    userId: input.userId,
    message,
    screenContext: input.screenContext ?? null,
  });

  const clinicalDomain = resolveKronosClinicalDomain({
    topic: input.topic,
    intent: input.intent,
    message,
  });

  const clinicalEvidenceContext = await buildClinicalEvidenceContext({
    kronosContext,
    message,
    topic: input.topic,
    intent: input.intent,
    clinicalDomain,
  });

  const clinicalGuardrails = buildClinicalGuardrails(clinicalDomain);
  const appContext = withClinicalAppContext(kronosContext, clinicalDomain, clinicalEvidenceContext, clinicalGuardrails);

  const systemPrompt = buildKronosSystemPrompt(appContext, input.intent, {
    mode: input.mode,
    topic: input.topic,
    maxTokens: input.maxTokens,
    clinicalDomain,
    clinicalEvidenceContext,
    clinicalGuardrails,
  });

  const response = await input.callLLM({
    systemPrompt,
    userMessage: message,
    appContext,
    history: input.history ?? [],
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  });

  return { response, kronosContext: appContext, systemPrompt };
}
