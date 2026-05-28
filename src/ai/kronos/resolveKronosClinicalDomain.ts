export type ClinicalDomainKey = 'treino' | 'dieta' | 'exames' | 'misto';
export type ClinicalConfidence = 'high' | 'medium' | 'low';

export interface ClinicalDomain {
  key: ClinicalDomainKey;
  label: string;
  physicianRole: string;
  matchedDomains: string[];
  confidence: ClinicalConfidence;
}

interface ResolveInput {
  topic?: string;
  intent?: string;
  message?: string;
  userMessage?: string;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function scoreMatch(text: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern) => pattern.test(text) ? score + 1 : score, 0);
}

export function resolveKronosClinicalDomain(input?: ResolveInput): ClinicalDomain {
  const options = input && typeof input === 'object' ? input : {};
  const text = normalizeText([
    options.topic,
    options.intent,
    options.message,
    options.userMessage,
  ].filter(Boolean).join(' '));

  const workoutScore = scoreMatch(text, [
    /\btreino\b/, /\btreinar\b/, /\bmusculacao\b/, /\bcardio\b/, /\bforca\b/,
    /\bvolume\b/, /\bseries?\b/, /\brepeticoes\b/, /\bcarga\b/, /\brpe\b/,
    /\bfadiga\b/, /\brecuperacao\b/, /\bperformance\b/, /\bworkout\b/,
  ]);

  const dietScore = scoreMatch(text, [
    /\bdieta\b/, /\bnutricao\b/, /\brefeicao\b/, /\balimento\b/, /\bgramas\b/,
    /\bmacro/, /\bcaloria/, /\bproteina\b/, /\bcarbo/, /\bgordura\b/,
    /\bemagrecer\b/, /\bcutting\b/, /\bbulking\b/,
  ]);

  const labsScore = scoreMatch(text, [
    /\bexames?\b/, /\blaudo\b/, /\blaborator/, /\bbiomarcador/, /\bhemograma\b/,
    /\bcolesterol\b/, /\bglicose\b/, /\binsulina\b/, /\btsh\b/, /\bferritina\b/,
    /\btestosterona\b/, /\bvitamina d\b/, /\bcreatinina\b/, /\bhdl\b/, /\bldl\b/,
  ]);

  const matched = [
    workoutScore > 0 ? 'treino' : null,
    dietScore > 0 ? 'dieta' : null,
    labsScore > 0 ? 'exames' : null,
  ].filter((x): x is string => x !== null);

  if (matched.length > 1) {
    return {
      key: 'misto',
      label: 'abordagem integrada',
      physicianRole: 'médico do esporte + endocrinologia esportiva',
      matchedDomains: matched,
      confidence: 'high',
    };
  }

  if (labsScore > 0) {
    return {
      key: 'exames',
      label: 'endocrinologia + esporte',
      physicianRole: 'endocrinologista com integração em medicina do esporte',
      matchedDomains: ['exames'],
      confidence: labsScore >= 2 ? 'high' : 'medium',
    };
  }

  if (dietScore > 0) {
    return {
      key: 'dieta',
      label: 'endocrinologia esportiva',
      physicianRole: 'endocrinologista esportivo',
      matchedDomains: ['dieta'],
      confidence: dietScore >= 2 ? 'high' : 'medium',
    };
  }

  if (workoutScore > 0) {
    return {
      key: 'treino',
      label: 'médico do esporte',
      physicianRole: 'médico do esporte',
      matchedDomains: ['treino'],
      confidence: workoutScore >= 2 ? 'high' : 'medium',
    };
  }

  return {
    key: 'misto',
    label: 'abordagem integrada',
    physicianRole: 'médico do esporte + endocrinologia esportiva',
    matchedDomains: ['treino', 'dieta', 'exames'],
    confidence: 'low',
  };
}
