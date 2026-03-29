import type { DetectedExerciseContext } from './types';

const MUSCLE_SYNONYMS: Record<string, string> = {
  ombro: 'shoulders',
  shoulder: 'shoulders',
  shoulders: 'shoulders',
  peito: 'chest',
  chest: 'chest',
  costas: 'back',
  back: 'back',
  perna: 'legs',
  pernas: 'legs',
  legs: 'legs',
  gluteo: 'glutes',
  gluteoos: 'glutes',
  glutes: 'glutes',
  biceps: 'biceps',
  bíceps: 'biceps',
  triceps: 'triceps',
  tríceps: 'triceps',
};

const EQUIPMENT_SYNONYMS: Record<string, string> = {
  halter: 'dumbbell',
  halteres: 'dumbbell',
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  barra: 'barbell',
  barbell: 'barbell',
  maquina: 'machine',
  máquina: 'machine',
  machine: 'machine',
  casa: 'body weight',
  home: 'body weight',
  corpo: 'body weight',
  kettlebell: 'kettlebell',
};

const EXERCISE_NAME_SYNONYMS: Record<string, string> = {
  'desenvolvimento militar': 'military press',
  'shoulder press': 'military press',
  'supino reto': 'barbell bench press',
  'agachamento livre': 'barbell back squat',
};

export function cleanText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectLanguage(text: string): 'pt' | 'en' {
  const normalized = cleanText(text);
  const portugueseHints = ['quero', 'troque', 'exercicio', 'treino', 'ombro', 'peito', 'costas'];
  return portugueseHints.some((hint) => normalized.includes(hint)) ? 'pt' : 'en';
}

export function normalizeMuscle(text?: string): string | undefined {
  if (!text) return undefined;
  const normalized = cleanText(text);
  return MUSCLE_SYNONYMS[normalized] ?? normalized;
}

export function normalizeEquipment(text?: string): string | undefined {
  if (!text) return undefined;
  const normalized = cleanText(text);
  return EQUIPMENT_SYNONYMS[normalized] ?? normalized;
}

export function normalizeExerciseName(text?: string): string | undefined {
  if (!text) return undefined;
  const normalized = cleanText(text);
  return EXERCISE_NAME_SYNONYMS[normalized] ?? normalized;
}

export function extractEntitiesFromMessage(message: string): Pick<DetectedExerciseContext, 'mentionedExercise' | 'targetMuscle' | 'equipment' | 'objective' | 'level' | 'homeContext'> {
  const normalized = cleanText(message);
  const tokens = normalized.split(' ');

  const targetMuscle = Object.keys(MUSCLE_SYNONYMS).find((term) => normalized.includes(cleanText(term)));
  const equipment = Object.keys(EQUIPMENT_SYNONYMS).find((term) => normalized.includes(cleanText(term)));
  const mentionedExercise = Object.keys(EXERCISE_NAME_SYNONYMS).find((term) => normalized.includes(cleanText(term)));

  const objective = /hipertrof|ganhar massa|strength|forca|forca/.test(normalized)
    ? 'hypertrophy_strength'
    : /emagrec|defin|perder gordura|fat loss/.test(normalized)
      ? 'fat_loss'
      : undefined;

  const level = /iniciante|beginner/.test(normalized)
    ? 'beginner'
    : /intermediario|intermediate/.test(normalized)
      ? 'intermediate'
      : /avancado|advanced|expert/.test(normalized)
        ? 'advanced'
        : undefined;

  const homeContext = /em casa|home|sem equipamento/.test(normalized);

  const freeMention = tokens.slice(-3).join(' ');
  return {
    targetMuscle: normalizeMuscle(targetMuscle),
    equipment: normalizeEquipment(equipment),
    mentionedExercise: normalizeExerciseName(mentionedExercise ?? freeMention),
    objective,
    level,
    homeContext,
  };
}
