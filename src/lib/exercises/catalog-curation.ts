import type { ExerciseEntity } from './types';

export type CuratedExerciseContent = {
  instructions: string[];
  common_errors: string[];
  breathing_tip: string;
  range_of_motion: string;
};

function normalizeLookup(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const CURATED_BY_KEY: Record<string, CuratedExerciseContent> = {
  barbell_bench_press: {
    instructions: ['Escápulas fixas no banco e pés firmes no chão.', 'Desça a barra até a linha média do peito com controle.', 'Empurre a barra para cima sem perder alinhamento dos punhos.'],
    common_errors: ['Abrir cotovelos em excesso.', 'Tirar o quadril do banco.', 'Perder controle na fase de descida.'],
    breathing_tip: 'Inspire na descida e solte o ar ao empurrar.',
    range_of_motion: 'Desça até tocar levemente o peito e suba até quase estender os cotovelos.',
  },
  incline_barbell_bench_press: {
    instructions: ['Ajuste o banco em inclinação moderada (30-45°).', 'Desça a barra no alto do peito com cotovelos sob controle.', 'Suba em linha estável sem projetar os ombros.'],
    common_errors: ['Inclinação alta demais.', 'Punhos dobrados para trás.', 'Perder tensão escapular no topo.'],
    breathing_tip: 'Inspire para descer, expire para subir.',
    range_of_motion: 'Desça até amplitude confortável no peitoral superior e suba com controle total.',
  },
  squat: {
    instructions: ['Posicione os pés na largura dos ombros e tronco firme.', 'Desça levando o quadril para trás e para baixo.', 'Suba empurrando o chão com o meio do pé.'],
    common_errors: ['Joelho colapsando para dentro.', 'Arredondar lombar no fundo.', 'Perder estabilidade do pé.'],
    breathing_tip: 'Inspire e gere pressão antes de descer; expire na subida.',
    range_of_motion: 'Desça até onde mantém coluna neutra e joelhos estáveis, depois suba completo.',
  },
  leg_press: {
    instructions: ['Apoie a lombar no banco e pés estáveis na plataforma.', 'Desça o trenó controlando joelhos e quadris.', 'Empurre de volta sem travar totalmente os joelhos.'],
    common_errors: ['Tirar quadril do assento.', 'Descer com joelhos colapsando.', 'Fazer movimento curto demais.'],
    breathing_tip: 'Inspire descendo, expire ao empurrar a plataforma.',
    range_of_motion: 'Desça até o limite com lombar apoiada e retorne quase à extensão total.',
  },
  deadlift: {
    instructions: ['Posicione a barra próxima da canela e segure com tronco firme.', 'Inicie o movimento com quadril e joelhos ao mesmo tempo.', 'Suba mantendo a barra próxima do corpo e coluna neutra.'],
    common_errors: ['Arredondar a lombar no início.', 'Barra afastada do corpo.', 'Puxar com braços em vez de pernas/quadril.'],
    breathing_tip: 'Inspire e faça brace antes de puxar; solte o ar ao finalizar.',
    range_of_motion: 'Suba da barra no chão até postura ereta, sem hiperextender lombar no topo.',
  },
  shoulder_press: {
    instructions: ['Ative abdômen e glúteos antes de iniciar.', 'Empurre a carga acima da cabeça em linha vertical.', 'Desça até nível do queixo/orelhas mantendo controle.'],
    common_errors: ['Hiperextensão lombar.', 'Cotovelos muito atrás da linha do tronco.', 'Subida sem controle da trajetória.'],
    breathing_tip: 'Inspire na descida e expire ao pressionar acima da cabeça.',
    range_of_motion: 'Desça até amplitude confortável dos ombros e suba até braços estendidos com controle.',
  },
  lat_pulldown: {
    instructions: ['Segure a barra com pegada firme e peito aberto.', 'Puxe em direção ao alto do peito com cotovelos para baixo.', 'Retorne controlando a subida sem perder postura.'],
    common_errors: ['Puxar atrás da nuca.', 'Roubar com balanço do tronco.', 'Elevar ombros durante a puxada.'],
    breathing_tip: 'Expire puxando, inspire retornando.',
    range_of_motion: 'Desça até contração máxima das costas e retorne com alongamento controlado.',
  },
  pull_up: {
    instructions: ['Inicie pendurado com escápulas ativas.', 'Puxe o corpo até o queixo ultrapassar a barra.', 'Desça de forma controlada até extensão completa.'],
    common_errors: ['Usar impulso excessivo.', 'Encolher ombros durante a subida.', 'Parar antes da extensão total na descida.'],
    breathing_tip: 'Expire ao subir, inspire ao descer.',
    range_of_motion: 'Use amplitude completa: de braços estendidos até queixo acima da barra.',
  },
  barbell_curl: {
    instructions: ['Mantenha cotovelos próximos ao corpo.', 'Flexione os cotovelos elevando a barra sem balançar.', 'Desça lentamente até extensão quase total.'],
    common_errors: ['Roubar com tronco.', 'Abrir cotovelos para frente.', 'Descer rápido demais.'],
    breathing_tip: 'Expire na subida, inspire na descida.',
    range_of_motion: 'Suba até máxima contração do bíceps e desça controlado sem relaxar totalmente.',
  },
  triceps_pushdown: {
    instructions: ['Mantenha cotovelos fixos ao lado do tronco.', 'Empurre o cabo até estender os cotovelos.', 'Retorne até cerca de 90° mantendo controle.'],
    common_errors: ['Mover os ombros para gerar impulso.', 'Abrir cotovelos lateralmente.', 'Perder controle na volta.'],
    breathing_tip: 'Expire ao empurrar, inspire ao retornar.',
    range_of_motion: 'Estenda quase total no final e retorne até ângulo confortável sem compensar.',
  },
  lateral_raise: {
    instructions: ['Inicie com halteres ao lado do corpo e cotovelos semi-flexionados.', 'Eleve os braços até linha dos ombros.', 'Desça lentamente sem relaxar totalmente.'],
    common_errors: ['Subir acima da linha dos ombros.', 'Usar balanço do tronco.', 'Rodar ombros para frente no topo.'],
    breathing_tip: 'Expire ao elevar, inspire ao descer.',
    range_of_motion: 'Suba até altura dos ombros e desça controlado mantendo tensão lateral.',
  },
  stiff_leg_deadlift: {
    instructions: ['Segure a barra/halteres com joelhos levemente flexionados.', 'Projete quadril para trás mantendo coluna neutra.', 'Retorne contraindo posteriores e glúteos.'],
    common_errors: ['Arredondar lombar.', 'Descer além da mobilidade disponível.', 'Flexionar demais os joelhos.'],
    breathing_tip: 'Inspire descendo, expire ao subir.',
    range_of_motion: 'Desça até alongar posteriores sem perder neutralidade e suba completo.',
  },
  bent_over_row: {
    instructions: ['Incline o tronco com coluna neutra e joelhos semiflexionados.', 'Puxe a carga em direção ao abdômen.', 'Desça com controle mantendo estabilidade lombar.'],
    common_errors: ['Arredondar costas.', 'Usar impulso do tronco.', 'Encolher ombros no final da puxada.'],
    breathing_tip: 'Expire puxando, inspire descendo.',
    range_of_motion: 'Puxe até contração forte das costas e retorne com alongamento sob controle.',
  },
  dumbbell_fly: {
    instructions: ['Mantenha escápulas retraídas e cotovelos levemente flexionados.', 'Abra os braços em arco até alongar o peitoral.', 'Feche os halteres sem bater no topo.'],
    common_errors: ['Flexionar demais cotovelos.', 'Descer além da mobilidade do ombro.', 'Perder estabilização escapular.'],
    breathing_tip: 'Inspire ao abrir, expire ao fechar.',
    range_of_motion: 'Abra até alongamento confortável e feche até contração sem perder controle.',
  },
  lunge: {
    instructions: ['Dê um passo à frente mantendo tronco ereto.', 'Desça até ambos joelhos ficarem bem alinhados.', 'Empurre o chão e retorne à posição inicial.'],
    common_errors: ['Passo curto demais.', 'Joelho da frente colapsando para dentro.', 'Inclinar o tronco em excesso.'],
    breathing_tip: 'Inspire descendo, expire subindo.',
    range_of_motion: 'Desça até quase tocar o joelho de trás no chão, mantendo alinhamento.',
  },
  standing_calf_raise: {
    instructions: ['Apoie a ponta dos pés e mantenha o tronco estável.', 'Eleve os calcanhares ao máximo contraindo panturrilhas.', 'Desça lentamente até alongamento completo.'],
    common_errors: ['Repetições muito rápidas.', 'Amplitude curta.', 'Dobrar joelhos para roubar o movimento.'],
    breathing_tip: 'Expire ao subir, inspire ao descer.',
    range_of_motion: 'Vá do alongamento máximo ao pico de contração em cada repetição.',
  },
  crunch: {
    instructions: ['Mantenha lombar apoiada e mãos leves na cabeça/peito.', 'Eleve o tronco curto contraindo abdômen.', 'Retorne devagar sem perder tensão.'],
    common_errors: ['Puxar o pescoço com as mãos.', 'Subir demais com flexão de quadril.', 'Fazer movimento acelerado sem controle.'],
    breathing_tip: 'Expire ao contrair, inspire ao retornar.',
    range_of_motion: 'Use flexão curta e controlada focando na contração abdominal.',
  },
};

const CURATION_ALIASES: Record<string, string> = {
  supino_reto: 'barbell_bench_press',
  supino_reto_barra: 'barbell_bench_press',
  supino_inclinado: 'incline_barbell_bench_press',
  agachamento: 'squat',
  leg_press_45: 'leg_press',
  levantamento_terra: 'deadlift',
  desenvolvimento_militar: 'shoulder_press',
  puxada_frontal: 'lat_pulldown',
  barra_fixa: 'pull_up',
  rosca_direta: 'barbell_curl',
  triceps_pulley: 'triceps_pushdown',
  elevacao_lateral: 'lateral_raise',
  stiff: 'stiff_leg_deadlift',
  remada_curvada: 'bent_over_row',
  crucifixo: 'dumbbell_fly',
  passada: 'lunge',
  panturrilha: 'standing_calf_raise',
  abdominal: 'crunch',
};

export function getCuratedExerciseContent(normalizedLookupKey: string | null | undefined): CuratedExerciseContent | null {
  const key = normalizeLookup(String(normalizedLookupKey || ''));
  if (!key) return null;
  const resolved = CURATION_ALIASES[key] ?? key;
  return CURATED_BY_KEY[resolved] ?? null;
}

export function mergeCuratedExerciseContent(exercise: Partial<ExerciseEntity>, curated: CuratedExerciseContent | null): Partial<ExerciseEntity> {
  if (!curated) return exercise;
  return {
    ...exercise,
    instructions: Array.isArray(exercise.instructions) && exercise.instructions.length ? exercise.instructions : curated.instructions,
    common_errors: Array.isArray(exercise.common_errors) && exercise.common_errors.length ? exercise.common_errors : curated.common_errors,
    breathing_tip: exercise.breathing_tip || curated.breathing_tip,
    range_of_motion: exercise.range_of_motion || curated.range_of_motion,
  };
}

export function computeExerciseCompletenessScore(exercise: Partial<ExerciseEntity>): number {
  const hasInstructions = Array.isArray(exercise.instructions) && exercise.instructions.length > 0;
  const hasErrors = Array.isArray(exercise.common_errors) && exercise.common_errors.length > 0;
  const hasBreathing = Boolean(exercise.breathing_tip);
  const hasRom = Boolean(exercise.range_of_motion);
  const hasMedia = Boolean(exercise.media_url || exercise.gif_url || exercise.image_url);

  const score = (
    (hasInstructions ? 0.34 : 0)
    + (hasErrors ? 0.24 : 0)
    + (hasBreathing ? 0.16 : 0)
    + (hasRom ? 0.16 : 0)
    + (hasMedia ? 0.1 : 0)
  );

  return Number(Math.min(1, score).toFixed(4));
}
