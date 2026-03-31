import type { ExerciseEntity } from './types';

export type CuratedExerciseContent = {
  name_pt?: string;
  target_muscle?: string;
  secondary_muscles?: string[];
  instructions?: string[];
  common_errors?: string[];
  breathing_tip?: string;
  range_of_motion?: string;
};

function normalizeKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function isStrongList(value: unknown, minItems: number): boolean {
  return Array.isArray(value) && value.map((v) => String(v || '').trim()).filter(Boolean).length >= minItems;
}

function toList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : [];
}

function resolveFallbackKey(key: string): string {
  if (!key) return '';
  if (key.includes('supino') && key.includes('inclinado')) return 'incline_bench_press';
  if (key.includes('supino')) return 'barbell_bench_press';
  if (key.includes('agachamento')) return 'squat';
  if (key.includes('puxada')) return 'lat_pulldown';
  if (key.includes('rosca')) return 'barbell_curl';
  if (key.includes('elevacao') || key.includes('pelvica')) return 'barbell_hip_thrust';
  return key;
}

function fallbackContent(name_pt: string, target_muscle: string, secondary_muscles: string[]): CuratedExerciseContent {
  return {
    name_pt,
    target_muscle,
    secondary_muscles,
    instructions: [
      'Ajuste postura e base antes de iniciar o movimento.',
      'Execute a fase principal com controle e foco no músculo-alvo.',
      'Retorne de forma lenta sem perder alinhamento articular.',
    ],
    common_errors: [
      'Usar impulso e perder o controle da técnica.',
      'Reduzir demais a amplitude sem necessidade.',
    ],
    breathing_tip: 'Expire na fase de esforço e inspire no retorno.',
    range_of_motion: 'Use amplitude segura e consistente, sem compensar com a lombar.',
  };
}

const CURATED_EXERCISES: Record<string, CuratedExerciseContent> = {
  hip_thrust: fallbackContent('Hip Thrust', 'gluteos', ['posteriores_de_coxa', 'core']),
  barbell_hip_thrust: {
    name_pt: 'Hip Thrust com Barra',
    target_muscle: 'gluteos',
    secondary_muscles: ['posteriores_de_coxa', 'core'],
    instructions: [
      'Apoie a parte superior das costas em um banco firme.',
      'Posicione a barra sobre o quadril e mantenha os pés firmes no chão.',
      'Eleve o quadril contraindo os glúteos até alinhar joelhos, quadril e tronco.',
      'Desça de forma controlada sem relaxar totalmente no final.',
    ],
    common_errors: [
      'Subir com a lombar em vez de contrair os glúteos.',
      'Não completar a extensão do quadril.',
      'Deixar os joelhos abrirem ou fecharem demais.',
    ],
    breathing_tip: 'Expire ao subir e inspire ao descer.',
    range_of_motion: 'Eleve até alinhar joelhos, quadril e tronco, sem hiperestender a lombar.',
  },
  smith_machine_hip_thrust: fallbackContent('Hip Thrust na Smith', 'gluteos', ['posteriores_de_coxa', 'core']),
  glute_bridge: fallbackContent('Ponte de Glúteo', 'gluteos', ['core']),
  barbell_bench_press: {
    name_pt: 'Supino Reto com Barra',
    target_muscle: 'peito',
    secondary_muscles: ['triceps', 'ombros'],
    instructions: [
      'Deite no banco com os pés firmes no chão.',
      'Segure a barra com pegada estável e alinhada ao peito.',
      'Desça a barra de forma controlada até a linha média do peito.',
      'Empurre a barra para cima sem perder a estabilidade dos ombros.',
    ],
    common_errors: ['Tirar os pés do chão.', 'Deixar os cotovelos abrirem excessivamente.', 'Quicar a barra no peito.'],
    breathing_tip: 'Inspire na descida e expire na subida.',
    range_of_motion: 'Desça até perto do peito com controle e suba sem perder a tensão.',
  },
  dumbbell_bench_press: fallbackContent('Supino Reto com Halteres', 'peito', ['triceps', 'ombros']),
  incline_bench_press: {
    name_pt: 'Supino Inclinado com Barra',
    target_muscle: 'peito_superior',
    secondary_muscles: ['triceps', 'ombros'],
    instructions: [
      'Ajuste o banco entre 30° e 45° e firme os pés no chão.',
      'Desça a barra de forma controlada até a região superior do peito.',
      'Empurre mantendo estabilidade de tronco e ombros.',
      'Finalize a subida sem relaxar totalmente a tensão muscular.',
    ],
    common_errors: ['Inclinar o banco em excesso.', 'Descer a barra na linha média do peito.', 'Perder tensão no topo do movimento.'],
    breathing_tip: 'Inspire ao descer e expire ao subir.',
    range_of_motion: 'Desça até próximo ao peito superior com controle e suba sem perder alinhamento.',
  },
  incline_dumbbell_press: fallbackContent('Supino Inclinado com Halteres', 'peito', ['triceps', 'ombros']),
  decline_bench_press: fallbackContent('Supino Declinado', 'peito', ['triceps', 'ombros']),
  squat: {
    name_pt: 'Agachamento',
    target_muscle: 'quadriceps',
    secondary_muscles: ['gluteos', 'posteriores_de_coxa', 'core'],
    instructions: [
      'Posicione os pés em largura confortável e mantenha o peito aberto.',
      'Inicie o movimento flexionando quadris e joelhos ao mesmo tempo.',
      'Desça com controle mantendo o tronco estável.',
      'Suba empurrando o chão e mantendo o alinhamento dos joelhos.',
    ],
    common_errors: ['Deixar os joelhos colapsarem para dentro.', 'Perder a estabilidade da coluna lombar.', 'Subir o quadril antes do tronco.'],
    breathing_tip: 'Inspire antes da descida e expire ao subir.',
    range_of_motion: 'Desça até a maior amplitude que consiga sem perder alinhamento.',
  },
  smith_machine_squat: fallbackContent('Agachamento na Smith', 'quadriceps', ['gluteos', 'core']),
  leg_press: fallbackContent('Leg Press', 'quadriceps', ['gluteos', 'posteriores_de_coxa']),
  deadlift: fallbackContent('Levantamento Terra', 'posteriores_de_coxa', ['gluteos', 'dorsais', 'core']),
  romanian_deadlift: fallbackContent('Levantamento Terra Romeno', 'posteriores_de_coxa', ['gluteos', 'core']),
  stiff_leg_deadlift: fallbackContent('Stiff', 'posteriores_de_coxa', ['gluteos', 'core']),
  shoulder_press: fallbackContent('Desenvolvimento', 'ombros', ['triceps', 'core']),
  military_press: fallbackContent('Desenvolvimento Militar', 'ombros', ['triceps', 'core']),
  lateral_raise: fallbackContent('Elevação Lateral', 'ombros', ['trapezio']),
  lat_pulldown: {
    name_pt: 'Puxada Frontal',
    target_muscle: 'dorsais',
    secondary_muscles: ['biceps', 'deltoides_posteriores'],
    instructions: [
      'Segure a barra com pegada estável e sente-se com apoio firme.',
      'Mantenha o peito aberto e as escápulas organizadas.',
      'Puxe a barra em direção à parte superior do peito com controle.',
      'Retorne lentamente sem perder a tensão nas costas.',
    ],
    common_errors: ['Puxar com excesso de balanço do tronco.', 'Levar a barra atrás da cabeça.', 'Encurtar demais a fase de retorno.'],
    breathing_tip: 'Expire na puxada e inspire na volta.',
    range_of_motion: 'Puxe até perto do peito e retorne controlando a subida.',
  },
  pull_up: fallbackContent('Barra Fixa', 'dorsais', ['biceps', 'core']),
  seated_row: fallbackContent('Remada Baixa', 'dorsais', ['biceps', 'deltoides_posteriores']),
  bent_over_row: fallbackContent('Remada Curvada', 'dorsais', ['biceps', 'lombar']),
  barbell_curl: {
    name_pt: 'Rosca Direta com Barra',
    target_muscle: 'biceps',
    secondary_muscles: ['antebracos'],
    instructions: [
      'Fique em pé com a barra nas mãos e cotovelos próximos ao tronco.',
      'Flexione os cotovelos levando a barra para cima com controle.',
      'Evite balançar o corpo para ajudar o movimento.',
      'Desça lentamente até quase estender os braços.',
    ],
    common_errors: ['Usar impulso do tronco.', 'Abrir os cotovelos para os lados.', 'Descer rápido demais.'],
    breathing_tip: 'Expire ao subir e inspire ao descer.',
    range_of_motion: 'Suba até a contração do bíceps e desça controlando até quase estender.',
  },
  hammer_curl: fallbackContent('Rosca Martelo', 'biceps', ['antebracos']),
  triceps_pushdown: fallbackContent('Tríceps Pulley', 'triceps', ['antebracos']),
  overhead_triceps_extension: fallbackContent('Tríceps Francês', 'triceps', ['ombros']),
  pec_deck_fly: fallbackContent('Crucifixo na Máquina', 'peito', ['ombros']),
  dumbbell_fly: fallbackContent('Crucifixo com Halteres', 'peito', ['ombros']),
  lunge: fallbackContent('Avanço', 'quadriceps', ['gluteos', 'posteriores_de_coxa']),
  walking_lunge: fallbackContent('Passada Caminhando', 'quadriceps', ['gluteos', 'core']),
  calf_raise: fallbackContent('Elevação de Panturrilha', 'panturrilhas', []),
  seated_calf_raise: fallbackContent('Panturrilha Sentado', 'panturrilhas', []),
  crunch: fallbackContent('Abdominal Crunch', 'abdomen', ['core']),
  leg_raise: fallbackContent('Elevação de Pernas', 'abdomen', ['flexores_do_quadril']),
};

const ALIASES: Record<string, string> = {
  elevacao_pelvica: 'hip_thrust',
  elevacao_pelvica_com_barra: 'barbell_hip_thrust',
  ponte_de_gluteo: 'glute_bridge',
  supino_reto: 'barbell_bench_press',
  supino_reto_barra: 'barbell_bench_press',
  supino_reto_com_barra: 'barbell_bench_press',
  supino_com_halteres: 'dumbbell_bench_press',
  supino_inclinado: 'incline_dumbbell_press',
  supino_inclinado_com_barra: 'incline_bench_press',
  supino_inclinado_barra: 'incline_bench_press',
  supino_inclinado_com_halteres: 'incline_dumbbell_press',
  puxada_frontal: 'lat_pulldown',
  puxada_frente: 'lat_pulldown',
  barra_fixa: 'pull_up',
  desenvolvimento_militar: 'military_press',
  remada_curvada: 'bent_over_row',
  remada_curvada_com_barra: 'bent_over_row',
  rosca_direta: 'barbell_curl',
  rosca_direta_barra: 'barbell_curl',
  rosca_martelo: 'hammer_curl',
  triceps_pulley: 'triceps_pushdown',
  triceps_corda: 'triceps_pushdown',
  crucifixo: 'dumbbell_fly',
  stiff: 'romanian_deadlift',
  agachamento_livre: 'squat',
  leg_press_45: 'leg_press',
};

export function getCuratedExerciseContent(normalizedLookupKey: string): CuratedExerciseContent | null {
  const normalized = normalizeKey(normalizedLookupKey);
  if (!normalized) return null;
  const resolved = ALIASES[normalized] || normalized;
  const curated = CURATED_EXERCISES[resolved];
  if (curated) return curated;
  const fallback = resolveFallbackKey(resolved);
  return CURATED_EXERCISES[fallback] ?? null;
}

export function mergeCuratedExerciseContent<T extends Record<string, any>>(baseExercise: T, curated: CuratedExerciseContent | null): T {
  if (!curated) return baseExercise;
  const baseNamePt = String(baseExercise.name_pt || '').trim();
  const baseNameEn = String(baseExercise.name_en || '').trim();
  const instructions = toList(baseExercise.instructions);
  const commonErrors = toList(baseExercise.common_errors);
  const secondaryMuscles = toList(baseExercise.secondary_muscles);

  return {
    ...baseExercise,
    name_pt: (!baseNamePt || normalizeKey(baseNamePt) === normalizeKey(baseNameEn)) ? (curated.name_pt || baseNamePt || baseNameEn || null) : baseNamePt,
    target_muscle: String(baseExercise.target_muscle || '').trim() || curated.target_muscle || null,
    secondary_muscles: secondaryMuscles.length ? secondaryMuscles : (curated.secondary_muscles || []),
    instructions: isStrongList(instructions, 2) ? instructions : (curated.instructions || instructions),
    common_errors: commonErrors.length ? commonErrors : (curated.common_errors || commonErrors),
    breathing_tip: String(baseExercise.breathing_tip || '').trim() || curated.breathing_tip || null,
    range_of_motion: String(baseExercise.range_of_motion || '').trim() || curated.range_of_motion || null,
  } as T;
}

export function applyCuratedExerciseContent(exercise: Partial<ExerciseEntity>): Partial<ExerciseEntity> {
  const curated = getCuratedExerciseContent(String(exercise.normalized_lookup_key || exercise.slug || ''));
  return mergeCuratedExerciseContent(exercise, curated);
}

export function computeExerciseCompletenessScore(exercise: Record<string, any>): number {
  let score = 0;
  if (String(exercise.name_pt || '').trim()) score += 10;
  if (String(exercise.target_muscle || '').trim()) score += 10;
  if (toList(exercise.secondary_muscles).length) score += 5;
  if (toList(exercise.instructions).length >= 3) score += 25;
  if (toList(exercise.common_errors).length >= 2) score += 15;
  if (String(exercise.breathing_tip || '').trim()) score += 10;
  if (String(exercise.range_of_motion || '').trim()) score += 10;
  if (String(exercise.media_url || '').trim()) score += 10;
  if (String(exercise.media_type || '').toLowerCase() === 'video' && Number(exercise.media_confidence_score || 0) >= 0.7) score += 5;
  return Math.max(0, Math.min(100, score));
}

export function computeQualityFlags(exercise: Record<string, any>): string[] {
  const flags: string[] = [];
  if (!String(exercise.name_pt || '').trim()) flags.push('missing_name_pt');
  if (!String(exercise.target_muscle || '').trim()) flags.push('missing_target_muscle');

  const instructions = toList(exercise.instructions);
  if (!instructions.length) flags.push('missing_instructions');
  else if (instructions.length < 2) flags.push('weak_instructions');

  if (!toList(exercise.common_errors).length) flags.push('missing_common_errors');
  if (!String(exercise.breathing_tip || '').trim()) flags.push('missing_breathing_tip');
  if (!String(exercise.range_of_motion || '').trim()) flags.push('missing_range_of_motion');
  if (!String(exercise.media_url || '').trim()) flags.push('missing_media');
  if (Number(exercise.media_confidence_score || 0) < 0.5) flags.push('low_media_confidence');
  if (computeExerciseCompletenessScore(exercise) < 55) flags.push('low_content_value');

  return Array.from(new Set(flags));
}
