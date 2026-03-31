import type { ExerciseEntity } from './types';

export type CuratedExerciseContent = {
  name_pt?: string;
  instructions: string[];
  common_errors: string[];
  breathing_tip: string;
  range_of_motion: string;
};

const REQUIRED_FLAGS = {
  missingInstructions: 'missing_instructions',
  missingCommonErrors: 'missing_common_errors',
  missingBreathingTip: 'missing_breathing_tip',
  missingRangeOfMotion: 'missing_range_of_motion',
  missingMedia: 'missing_media',
  lowMediaConfidence: 'low_media_confidence',
  missingNamePt: 'missing_name_pt',
} as const;

function normalizeKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const CURATED: Record<string, CuratedExerciseContent> = {
  barbell_bench_press: {
    name_pt: 'Supino reto com barra',
    instructions: ['Apoie pés e escápulas firmes no banco.', 'Desça a barra até a linha média do peito.', 'Empurre para cima mantendo punhos e cotovelos alinhados.'],
    common_errors: ['Cotovelos muito abertos.', 'Quadril sair do banco.', 'Perder controle na descida.'],
    breathing_tip: 'Inspire na descida e expire ao subir.',
    range_of_motion: 'Desça até tocar levemente o peito e suba quase até estender os cotovelos.',
  },
  incline_dumbbell_press: {
    name_pt: 'Supino inclinado com halteres',
    instructions: ['Ajuste banco entre 30° e 45°.', 'Desça halteres ao lado do peitoral superior.', 'Suba em arco controlado sem fechar ombros.'],
    common_errors: ['Inclinação muito alta.', 'Descer sem controle.', 'Bater halteres no topo.'],
    breathing_tip: 'Inspire descendo, expire subindo.',
    range_of_motion: 'Desça até alongar o peitoral sem dor e suba mantendo estabilidade.',
  },
  dumbbell_bench_press: {
    name_pt: 'Supino reto com halteres',
    instructions: ['Fixe escápulas e pés no chão.', 'Desça os halteres até a linha do peito.', 'Empurre para cima com trajetória estável.'],
    common_errors: ['Punhos quebrados.', 'Perder estabilidade do ombro.', 'Amplitude curta.'],
    breathing_tip: 'Inspire para descer e expire para subir.',
    range_of_motion: 'Use descida controlada até alongamento confortável e suba completo.',
  },
  squat: {
    name_pt: 'Agachamento livre',
    instructions: ['Pés na largura dos ombros e tronco firme.', 'Desça quadril para trás e para baixo.', 'Suba empurrando o chão com o pé inteiro.'],
    common_errors: ['Joelho colapsar para dentro.', 'Lombar arredondar no fundo.', 'Perder equilíbrio no pé.'],
    breathing_tip: 'Faça brace antes de descer e solte o ar ao subir.',
    range_of_motion: 'Desça até manter coluna neutra e suba em extensão completa.',
  },
  leg_press: {
    name_pt: 'Leg press',
    instructions: ['Apoie lombar no banco e pés firmes na plataforma.', 'Desça o trenó com joelhos alinhados.', 'Empurre sem travar totalmente os joelhos.'],
    common_errors: ['Quadril descolar do encosto.', 'Joelhos colapsarem para dentro.', 'Amplitude curta demais.'],
    breathing_tip: 'Inspire descendo e expire empurrando.',
    range_of_motion: 'Desça até limite seguro da mobilidade e retorne quase à extensão total.',
  },
  deadlift: {
    name_pt: 'Levantamento terra',
    instructions: ['Posicione a barra próxima da canela.', 'Ative tronco e inicie com pernas e quadril juntos.', 'Suba com a barra rente ao corpo até ficar ereto.'],
    common_errors: ['Arredondar lombar.', 'Barra afastar do corpo.', 'Puxar com braços.'],
    breathing_tip: 'Inspire e trave o tronco antes de puxar.',
    range_of_motion: 'Suba da barra no chão até postura ereta sem hiperextender lombar.',
  },
  romanian_deadlift: {
    name_pt: 'Stiff / Terra romeno',
    instructions: ['Mantenha joelhos semi-flexionados.', 'Leve quadril para trás com coluna neutra.', 'Retorne contraindo posteriores e glúteos.'],
    common_errors: ['Arredondar costas.', 'Dobrar joelhos em excesso.', 'Descer além da mobilidade.'],
    breathing_tip: 'Inspire descendo e expire subindo.',
    range_of_motion: 'Desça até alongar posteriores sem perder neutralidade lombar.',
  },
  lat_pulldown: {
    name_pt: 'Puxada frontal',
    instructions: ['Mantenha peito aberto e escápulas ativas.', 'Puxe a barra ao alto do peito.', 'Retorne com controle sem soltar tensão.'],
    common_errors: ['Puxar atrás da nuca.', 'Balançar o tronco.', 'Elevar ombros na puxada.'],
    breathing_tip: 'Expire puxando e inspire voltando.',
    range_of_motion: 'Desça até contração máxima das costas e retorne com alongamento controlado.',
  },
  pull_up: {
    name_pt: 'Barra fixa',
    instructions: ['Comece pendurado com escápulas ativas.', 'Puxe até o queixo passar da barra.', 'Desça controlado até extensão total.'],
    common_errors: ['Usar impulso excessivo.', 'Encolher ombros.', 'Não completar a descida.'],
    breathing_tip: 'Expire na subida e inspire na descida.',
    range_of_motion: 'Use amplitude completa em todas as repetições.',
  },
  barbell_curl: {
    name_pt: 'Rosca direta',
    instructions: ['Cotovelos fixos ao lado do tronco.', 'Flexione os cotovelos elevando a barra.', 'Desça lentamente sem relaxar total.'],
    common_errors: ['Roubar com balanço.', 'Avançar cotovelos.', 'Descer muito rápido.'],
    breathing_tip: 'Expire subindo, inspire descendo.',
    range_of_motion: 'Suba até contrair bíceps e desça quase à extensão total com controle.',
  },
  hammer_curl: {
    name_pt: 'Rosca martelo',
    instructions: ['Segure halteres com pegada neutra.', 'Eleve mantendo cotovelos perto do tronco.', 'Desça de forma controlada.'],
    common_errors: ['Girar o punho durante a subida.', 'Balançar o tronco.', 'Amplitude parcial.'],
    breathing_tip: 'Expire na subida e inspire na descida.',
    range_of_motion: 'Suba até contração forte e desça mantendo tensão.',
  },
  shoulder_press: {
    name_pt: 'Desenvolvimento',
    instructions: ['Ative abdômen e glúteos.', 'Empurre a carga acima da cabeça.', 'Desça até altura do queixo com controle.'],
    common_errors: ['Hiperextensão lombar.', 'Cotovelos fora da linha.', 'Trajetória instável.'],
    breathing_tip: 'Inspire descendo e expire ao pressionar.',
    range_of_motion: 'Desça até amplitude confortável e suba em extensão controlada.',
  },
  lateral_raise: {
    name_pt: 'Elevação lateral',
    instructions: ['Inicie com cotovelos semi-flexionados.', 'Eleve até linha dos ombros.', 'Desça lentamente mantendo tensão.'],
    common_errors: ['Subir acima dos ombros.', 'Usar impulso.', 'Rodar ombros para frente.'],
    breathing_tip: 'Expire na subida e inspire na descida.',
    range_of_motion: 'Vá de halteres ao lado do corpo até a linha dos ombros.',
  },
  triceps_pushdown: {
    name_pt: 'Tríceps pulley',
    instructions: ['Cotovelos fixos ao lado do tronco.', 'Empurre o cabo até estender os cotovelos.', 'Retorne sem perder postura.'],
    common_errors: ['Mover os ombros.', 'Abrir os cotovelos.', 'Perder controle na volta.'],
    breathing_tip: 'Expire empurrando e inspire retornando.',
    range_of_motion: 'Estenda quase total e retorne até cerca de 90°.',
  },
  bent_over_row: {
    name_pt: 'Remada curvada',
    instructions: ['Incline o tronco com coluna neutra.', 'Puxe a barra em direção ao abdômen.', 'Desça mantendo estabilidade lombar.'],
    common_errors: ['Arredondar costas.', 'Excesso de impulso.', 'Encolher ombros.'],
    breathing_tip: 'Expire puxando e inspire descendo.',
    range_of_motion: 'Puxe até contração dorsal e retorne com alongamento controlado.',
  },
  seated_row: {
    name_pt: 'Remada baixa',
    instructions: ['Sente com peito aberto e tronco firme.', 'Puxe o cabo para a linha do abdômen.', 'Retorne sem projetar ombros para frente.'],
    common_errors: ['Balançar o tronco.', 'Encostar ombros nas orelhas.', 'Amplitude incompleta.'],
    breathing_tip: 'Expire na puxada e inspire na volta.',
    range_of_motion: 'Vá do alongamento dorsal até contração máxima das costas.',
  },
  pec_deck_fly: {
    name_pt: 'Crucifixo máquina',
    instructions: ['Ajuste o banco para alinhar cotovelos ao peitoral.', 'Feche os braços em arco até contrair o peito.', 'Retorne devagar até alongar.'],
    common_errors: ['Cotovelos muito baixos.', 'Movimento rápido demais.', 'Perder contato das costas com o encosto.'],
    breathing_tip: 'Expire ao fechar e inspire ao abrir.',
    range_of_motion: 'Feche até contração forte e abra até alongamento confortável.',
  },
  crunch: {
    name_pt: 'Abdominal crunch',
    instructions: ['Mantenha lombar apoiada no solo.', 'Eleve o tronco curto contraindo o abdômen.', 'Retorne lentamente sem relaxar totalmente.'],
    common_errors: ['Puxar pescoço com as mãos.', 'Usar impulso.', 'Subir com flexão de quadril.'],
    breathing_tip: 'Expire na contração e inspire no retorno.',
    range_of_motion: 'Use flexão curta focando na contração abdominal.',
  },
  calf_raise: {
    name_pt: 'Panturrilha em pé',
    instructions: ['Apoie a ponta dos pés com estabilidade.', 'Eleve os calcanhares ao máximo.', 'Desça até alongamento total controlado.'],
    common_errors: ['Repetições muito rápidas.', 'Amplitude curta.', 'Dobrar joelhos para compensar.'],
    breathing_tip: 'Expire subindo e inspire descendo.',
    range_of_motion: 'Vá do alongamento máximo ao pico de contração em cada repetição.',
  },
  lunge: {
    name_pt: 'Passada / avanço',
    instructions: ['Dê um passo à frente mantendo tronco ereto.', 'Desça até ambos joelhos ficarem alinhados.', 'Empurre o chão para retornar.'],
    common_errors: ['Passo curto demais.', 'Joelho da frente colapsar.', 'Inclinar tronco excessivamente.'],
    breathing_tip: 'Inspire descendo e expire subindo.',
    range_of_motion: 'Desça até quase tocar o joelho de trás no solo mantendo alinhamento.',
  },
};

const ALIASES: Record<string, string> = {
  supino_reto: 'barbell_bench_press',
  supino_reto_barra: 'barbell_bench_press',
  supino_com_halteres: 'dumbbell_bench_press',
  supino_inclinado_halteres: 'incline_dumbbell_press',
  agachamento_livre: 'squat',
  stiff: 'romanian_deadlift',
  puxada_frontal: 'lat_pulldown',
  remada_baixa: 'seated_row',
  triceps_pulley: 'triceps_pushdown',
  abdominal_crunch: 'crunch',
};

function hasArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function getCuratedExerciseContent(normalizedLookupKey: string): CuratedExerciseContent | null {
  const normalized = normalizeKey(normalizedLookupKey);
  if (!normalized) return null;
  const resolved = ALIASES[normalized] || normalized;
  return CURATED[resolved] ?? null;
}

export function applyCuratedExerciseContent(exercise: Partial<ExerciseEntity>): Partial<ExerciseEntity> {
  const curated = getCuratedExerciseContent(String(exercise.normalized_lookup_key || exercise.slug || ''));
  if (!curated) return exercise;
  return {
    ...exercise,
    name_pt: exercise.name_pt || curated.name_pt || exercise.name_en || 'Exercício',
    instructions: hasArray(exercise.instructions) ? exercise.instructions : curated.instructions,
    common_errors: hasArray(exercise.common_errors) ? exercise.common_errors : curated.common_errors,
    breathing_tip: exercise.breathing_tip || curated.breathing_tip,
    range_of_motion: exercise.range_of_motion || curated.range_of_motion,
    content_source: exercise.content_source || 'curated_v1',
    last_enriched_at: exercise.last_enriched_at || new Date().toISOString(),
  };
}

export function computeExerciseCompletenessScore(exercise: Partial<ExerciseEntity>): number {
  const checks = [
    Boolean(exercise.name_pt),
    hasArray(exercise.instructions),
    hasArray(exercise.common_errors),
    Boolean(exercise.breathing_tip),
    Boolean(exercise.range_of_motion),
    Boolean(exercise.target_muscle),
    Boolean(exercise.media_url),
  ];
  const done = checks.filter(Boolean).length;
  return Number((done / checks.length).toFixed(4));
}

export function computeQualityFlags(exercise: Partial<ExerciseEntity>): string[] {
  const flags: string[] = [];
  if (!hasArray(exercise.instructions)) flags.push(REQUIRED_FLAGS.missingInstructions);
  if (!hasArray(exercise.common_errors)) flags.push(REQUIRED_FLAGS.missingCommonErrors);
  if (!exercise.breathing_tip) flags.push(REQUIRED_FLAGS.missingBreathingTip);
  if (!exercise.range_of_motion) flags.push(REQUIRED_FLAGS.missingRangeOfMotion);
  if (!exercise.media_url) flags.push(REQUIRED_FLAGS.missingMedia);
  if (Number(exercise.media_confidence_score ?? 0) < 0.5) flags.push(REQUIRED_FLAGS.lowMediaConfidence);
  if (!exercise.name_pt) flags.push(REQUIRED_FLAGS.missingNamePt);
  return Array.from(new Set(flags));
}
