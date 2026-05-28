import { resolveKronosClinicalDomain } from './resolveKronosClinicalDomain';
import type { ClinicalDomain } from './resolveKronosClinicalDomain';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const evidenceRepository = require('../../server/apihelpers/_clinicalEvidenceRepository') as {
  searchClinicalEvidence: (
    query: { domain: string; topic: string[]; patologia: string[]; biomarcador: string[] },
    opts: { limit: number }
  ) => Promise<{ sources?: unknown[]; sourceTable?: string | null; error?: string | null }>;
};

interface Biomarcador {
  nome?: string;
  status?: string;
}

interface ExamesContext {
  disponivel?: boolean;
  biomarcadores?: Biomarcador[];
}

interface TreinoContext {
  disponivel?: boolean;
  fatigueStatus?: string;
  recoveryStatus?: string;
}

interface DietaContext {
  disponivel?: boolean;
}

interface KronosContext {
  exames?: ExamesContext;
  treino?: TreinoContext;
  dieta?: DietaContext;
  contextoClinico?: { patologias?: string[] };
  user?: { patologia?: string; patologias?: string[] };
  [key: string]: unknown;
}

interface BuildClinicalEvidenceInput {
  kronosContext?: KronosContext;
  context?: KronosContext;
  message?: string;
  userMessage?: string;
  topic?: string;
  intent?: string;
  clinicalDomain?: ClinicalDomain;
}

export interface ClinicalEvidenceContext {
  domain: ClinicalDomain;
  evidenceAvailable: boolean;
  topics: string[];
  sources: unknown[];
  clinicalFocus: {
    patologia: string[];
    biomarcadoresAlterados: string[];
    usarTreinoReal: boolean;
    usarDietaReal: boolean;
    usarExamesReais: boolean;
  };
  priorityFlags: string[];
  repository: { sourceTable: string | null; error: string | null };
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function unique(values: string[]): string[] {
  const seen: Record<string, boolean> = Object.create(null);
  return values.reduce<string[]>((acc, value) => {
    const clean = String(value ?? '').trim();
    const key = clean.toLowerCase();
    if (!clean || seen[key]) return acc;
    seen[key] = true;
    acc.push(clean);
    return acc;
  }, []);
}

function extractBiomarkers(context: KronosContext): string[] {
  const exames = context?.exames;
  if (!exames || !Array.isArray(exames.biomarcadores)) return [];
  return exames.biomarcadores
    .filter((m) => m?.nome && m.status && m.status !== 'normal')
    .map((m) => m.nome as string)
    .slice(0, 8);
}

function extractTopics(message: string, clinicalDomain: ClinicalDomain, context: KronosContext): string[] {
  const text = normalizeText(message);
  const topics: string[] = [];
  if (clinicalDomain?.key) topics.push(clinicalDomain.key);
  if (/\btreino|musculacao|forca|cardio|fadiga|recuperacao\b/.test(text)) topics.push('treino');
  if (/\bdieta|nutricao|refeicao|proteina|caloria|macro|alimento\b/.test(text)) topics.push('dieta');
  if (/\bexame|laborator|biomarcador|glicose|colesterol|testosterona|tsh|ferritina\b/.test(text)) topics.push('exames');
  if (context?.treino?.disponivel) topics.push('treino atual');
  if (context?.dieta?.disponivel) topics.push('plano alimentar atual');
  if (context?.exames?.disponivel) topics.push('exames laboratoriais');
  return unique(topics).slice(0, 10);
}

function extractPathologies(context: KronosContext): string[] {
  const clinical = context?.contextoClinico;
  const user = context?.user;
  return unique([
    ...(Array.isArray(clinical?.patologias) ? clinical!.patologias : []),
    ...(user?.patologia ? [user.patologia] : []),
    ...(Array.isArray(user?.patologias) ? user!.patologias! : []),
  ]);
}

function buildPriorityFlags(context: KronosContext, pathologies: string[], biomarkers: string[]): string[] {
  const flags: string[] = [];
  if (pathologies.length) flags.push('patologia_obrigatoria');
  if (context?.exames?.disponivel) flags.push('cruzar_exames');
  if (biomarkers.length) flags.push('biomarcadores_alterados');
  if (context?.treino?.fatigueStatus && context.treino.fatigueStatus !== 'ok') flags.push('fadiga_treino');
  if (context?.treino?.recoveryStatus && context.treino.recoveryStatus !== 'ok') flags.push('recuperacao_treino');
  return unique(flags);
}

export async function buildClinicalEvidenceContext(
  input?: BuildClinicalEvidenceInput
): Promise<ClinicalEvidenceContext> {
  const options = input ?? {};
  const context: KronosContext = options.kronosContext ?? options.context ?? {};
  const message = String(options.message ?? options.userMessage ?? '');
  const clinicalDomain = options.clinicalDomain ?? resolveKronosClinicalDomain({
    topic: options.topic,
    intent: options.intent,
    message,
  });

  const pathologies = extractPathologies(context);
  const biomarkers = extractBiomarkers(context);
  const topics = extractTopics(message, clinicalDomain, context);

  const evidence = await evidenceRepository.searchClinicalEvidence(
    { domain: clinicalDomain.key, topic: topics, patologia: pathologies, biomarcador: biomarkers },
    { limit: 8 }
  );

  return {
    domain: clinicalDomain,
    evidenceAvailable: !!(evidence.sources?.length),
    topics,
    sources: evidence.sources ?? [],
    clinicalFocus: {
      patologia: pathologies,
      biomarcadoresAlterados: biomarkers,
      usarTreinoReal: !!context.treino?.disponivel,
      usarDietaReal: !!context.dieta?.disponivel,
      usarExamesReais: !!context.exames?.disponivel,
    },
    priorityFlags: buildPriorityFlags(context, pathologies, biomarkers),
    repository: {
      sourceTable: evidence.sourceTable ?? null,
      error: evidence.error ?? null,
    },
  };
}
