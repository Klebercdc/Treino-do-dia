import type { ExerciseEntity } from './types';
import { resolveFallbackKey } from './fallback-map';

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

function toList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : [];
}

function hasWeakInstructions(value: unknown): boolean {
  const list = toList(value);
  return list.length < 2 || list.every((item) => item.length < 20);
}

const BASE_ALIASES: Record<string, string> = {
  supino_reto: 'barbell_bench_press',
  supino_inclinado: 'incline_bench_press',
  supino_inclinado_com_halteres: 'incline_dumbbell_press',
  supino_com_halteres: 'dumbbell_bench_press',
  agachamento: 'squat',
  puxada_frontal: 'lat_pulldown',
  puxada_frente: 'lat_pulldown',
  rosca_direta: 'barbell_curl',
  rosca_martelo: 'hammer_curl',
  elevacao_lateral: 'lateral_raise',
  elevacao_lateral_cabo: 'lateral_raise',
  elevacao_lateral_no_cabo: 'lateral_raise',
  elevacao_pelvica: 'hip_thrust',
  elevacao_pelvica_com_barra: 'barbell_hip_thrust',
  hip_thrust_com_barra: 'barbell_hip_thrust',
  ponte_de_gluteo: 'glute_bridge',
  stiff: 'romanian_deadlift',
  terra: 'deadlift',
  remada_curvada: 'bent_over_row',
  triceps_pulley: 'triceps_pushdown',
  triceps_corda: 'triceps_pushdown',
};

const CURATED_EXERCISES: Record<string, CuratedExerciseContent> = {
  barbell_hip_thrust: {
    name_pt: 'Hip Thrust com Barra',
    target_muscle: 'gluteos',
    secondary_muscles: ['posteriores_de_coxa', 'core'],
    instructions: ['Apoie as escápulas no banco e a barra sobre o quadril.', 'Posicione os pés na largura do quadril com joelhos alinhados.', 'Eleve o quadril até formar linha joelho-quadril-ombro.', 'Segure 1 segundo contraindo glúteos no topo.', 'Desça controlando sem relaxar totalmente no fundo.'],
    common_errors: ['Empurrar com lombar em vez de glúteos.', 'Pés muito à frente, transferindo carga para posteriores.', 'Hiperestender a coluna no topo.'],
    breathing_tip: 'Inspire na descida e expire ao estender o quadril.',
    range_of_motion: 'Suba até alinhamento total sem extensão lombar excessiva.',
  },
  hip_thrust: {
    name_pt: 'Hip Thrust',
    target_muscle: 'gluteos',
    secondary_muscles: ['posteriores_de_coxa', 'core'],
    instructions: ['Apoie costas altas no banco e firme os pés no chão.', 'Inicie com quadril baixo e abdômen ativo.', 'Empurre o chão e eleve o quadril com foco nos glúteos.', 'Pause no topo antes de retornar com controle.'],
    common_errors: ['Subir rápido sem controle.', 'Perder alinhamento dos joelhos.', 'Deixar o queixo subir e arquear cervical.'],
    breathing_tip: 'Expire na subida e inspire na volta.',
    range_of_motion: 'Eleve até extensão completa do quadril com tronco estável.',
  },
  glute_bridge: {
    name_pt: 'Ponte de Glúteo',
    target_muscle: 'gluteos',
    secondary_muscles: ['core', 'posteriores_de_coxa'],
    instructions: ['Deite de costas com joelhos flexionados e pés apoiados.', 'Ative abdômen e pressione o chão com os calcanhares.', 'Eleve o quadril até alinhar coxas e tronco.', 'Desça devagar mantendo tensão nos glúteos.'],
    common_errors: ['Empurrar com ponta dos pés.', 'Perder ativação de core e compensar com lombar.'],
    breathing_tip: 'Solte o ar ao subir e inspire ao descer.',
    range_of_motion: 'Suba até alinhamento sem tirar costelas da posição neutra.',
  },
  barbell_bench_press: {
    name_pt: 'Supino Reto com Barra',
    target_muscle: 'peito',
    secondary_muscles: ['triceps', 'ombros'],
    instructions: ['Apoie pés no chão e escápulas retraídas no banco.', 'Segure a barra com punhos neutros e pegada estável.', 'Desça a barra até a linha média do peito com controle.', 'Empurre mantendo cotovelos em trajetória consistente.'],
    common_errors: ['Quicar a barra no peito.', 'Perder tensão escapular no topo.', 'Abrir excessivamente os cotovelos.'],
    breathing_tip: 'Inspire na descida e expire na subida.',
    range_of_motion: 'Desça até perto do peito sem perder estabilidade dos ombros.',
  },
  incline_bench_press: {
    name_pt: 'Supino Inclinado',
    target_muscle: 'peito_superior',
    secondary_muscles: ['triceps', 'ombros'],
    instructions: ['Ajuste o banco entre 30 e 45 graus.', 'Desça a carga controladamente até a região superior do peito.', 'Empurre mantendo estabilidade dos ombros.', 'Evite perder tensão no topo.'],
    common_errors: ['Inclinação muito alta.', 'Descer a carga na linha errada do peito.'],
    breathing_tip: 'Inspire na descida e expire na subida.',
    range_of_motion: 'Desça até perto do peito superior com controle e suba sem perder tensão.',
  },
  incline_dumbbell_press: {
    name_pt: 'Supino Inclinado com Halteres',
    target_muscle: 'peito_superior',
    secondary_muscles: ['triceps', 'ombros'],
    instructions: ['Regule o banco em inclinação moderada.', 'Desça os halteres ao lado da parte alta do peito.', 'Suba convergindo levemente os halteres sem bater.', 'Controle a fase excêntrica até o limite seguro.'],
    common_errors: ['Usar amplitude curta por excesso de carga.', 'Perder estabilidade dos punhos.'],
    breathing_tip: 'Expire na subida e inspire na descida.',
    range_of_motion: 'Desça até alongar peitoral superior mantendo ombros encaixados.',
  },
  dumbbell_bench_press: {
    name_pt: 'Supino Reto com Halteres',
    target_muscle: 'peito',
    secondary_muscles: ['triceps', 'ombros'],
    instructions: ['Deite no banco e estabilize os halteres acima do peito.', 'Desça em arco natural com cotovelos controlados.', 'Suba mantendo punhos alinhados e peito ativo.', 'Finalize sem travar os ombros para frente.'],
    common_errors: ['Bater halteres no topo.', 'Rotacionar punhos excessivamente durante a subida.'],
    breathing_tip: 'Inspire ao descer, expire ao subir.',
    range_of_motion: 'Desça até alongamento seguro do peitoral e retorne com controle.',
  },
  squat: {
    name_pt: 'Agachamento',
    target_muscle: 'quadriceps',
    secondary_muscles: ['gluteos', 'posteriores_de_coxa', 'core'],
    instructions: ['Posicione os pés em base estável e abdômen ativo.', 'Flexione quadril e joelhos simultaneamente.', 'Desça mantendo joelhos acompanhando a ponta dos pés.', 'Suba empurrando o chão sem colapsar tronco.'],
    common_errors: ['Valgo de joelho na subida.', 'Perder neutralidade lombar no fundo.', 'Deslocar peso para ponta dos pés.'],
    breathing_tip: 'Inspire antes da descida e solte o ar na subida.',
    range_of_motion: 'Use amplitude máxima que preserve alinhamento e controle.',
  },
  leg_press: {
    name_pt: 'Leg Press',
    target_muscle: 'quadriceps',
    secondary_muscles: ['gluteos', 'posteriores_de_coxa'],
    instructions: ['Ajuste o assento para manter lombar apoiada.', 'Desça a plataforma controlando joelhos e quadril.', 'Empurre sem estender completamente os joelhos.', 'Mantenha pés firmes durante toda a série.'],
    common_errors: ['Descolar lombar do encosto.', 'Encostar joelhos no peito sem controle.'],
    breathing_tip: 'Inspire ao descer e expire na extensão.',
    range_of_motion: 'Desça até limite sem retroversão pélvica e suba com controle.',
  },
  deadlift: {
    name_pt: 'Levantamento Terra',
    target_muscle: 'posteriores_de_coxa',
    secondary_muscles: ['gluteos', 'dorsais', 'core'],
    instructions: ['Posicione a barra próxima às canelas e ative dorsais.', 'Empurre o chão mantendo coluna neutra.', 'Suba com quadril e tronco sincronizados.', 'Desça guiando a barra próxima ao corpo.'],
    common_errors: ['Arredondar lombar na saída.', 'Afastar a barra do corpo.', 'Subir com quadril muito antes do tronco.'],
    breathing_tip: 'Faça pressão abdominal antes de iniciar a puxada.',
    range_of_motion: 'Suba até extensão completa sem hiperextensão lombar.',
  },
  romanian_deadlift: {
    name_pt: 'Stiff / Terra Romeno',
    target_muscle: 'posteriores_de_coxa',
    secondary_muscles: ['gluteos', 'core'],
    instructions: ['Inicie em pé com barra ou halteres próximos às coxas.', 'Empurre o quadril para trás mantendo joelhos semi-flexionados.', 'Desça até sentir alongamento de posteriores.', 'Retorne contraindo glúteos sem perder coluna neutra.'],
    common_errors: ['Flexionar demais os joelhos.', 'Descer além do controle lombar.'],
    breathing_tip: 'Inspire ao descer e expire na subida.',
    range_of_motion: 'Desça até alongamento forte dos posteriores sem arredondar coluna.',
  },
  lat_pulldown: {
    name_pt: 'Puxada Frontal',
    target_muscle: 'dorsais',
    secondary_muscles: ['biceps', 'deltoides_posteriores'],
    instructions: ['Sente com peito aberto e coxas fixas no apoio.', 'Inicie puxando com escápulas antes dos braços.', 'Traga a barra à frente até a parte alta do peito.', 'Retorne devagar controlando a subida da barra.'],
    common_errors: ['Puxar atrás da cabeça.', 'Balançar o tronco para ganhar impulso.'],
    breathing_tip: 'Expire na puxada, inspire na volta.',
    range_of_motion: 'Desça até próximo ao peito sem perder postura neutra.',
  },
  pull_up: {
    name_pt: 'Barra Fixa',
    target_muscle: 'dorsais',
    secondary_muscles: ['biceps', 'core'],
    instructions: ['Pendure-se com pegada firme e escápulas ativas.', 'Inicie com depressão escapular antes de flexionar cotovelos.', 'Eleve o corpo até o queixo passar da barra.', 'Desça com controle até quase extensão completa.'],
    common_errors: ['Usar balanço excessivo.', 'Encurtar a fase excêntrica.'],
    breathing_tip: 'Expire ao subir e inspire ao descer.',
    range_of_motion: 'Busque amplitude completa sem perder controle de escápulas.',
  },
  seated_row: {
    name_pt: 'Remada Baixa',
    target_muscle: 'dorsais',
    secondary_muscles: ['biceps', 'deltoides_posteriores'],
    instructions: ['Sente com coluna neutra e peito aberto.', 'Puxe o triângulo para a linha do abdômen.', 'Aproxime escápulas no final da puxada.', 'Retorne estendendo braços de forma controlada.'],
    common_errors: ['Arredondar coluna para alcançar amplitude.', 'Puxar apenas com bíceps.'],
    breathing_tip: 'Expire na puxada e inspire na volta.',
    range_of_motion: 'Leve a alça ao tronco sem projetar ombros para frente.',
  },
  bent_over_row: {
    name_pt: 'Remada Curvada',
    target_muscle: 'dorsais',
    secondary_muscles: ['biceps', 'lombar'],
    instructions: ['Incline o tronco mantendo coluna neutra.', 'Puxe a barra em direção ao abdômen.', 'Mantenha cotovelos próximos ao corpo.', 'Desça a barra controlando sem perder postura.'],
    common_errors: ['Usar impulso da lombar.', 'Elevar demais o tronco durante a repetição.'],
    breathing_tip: 'Expire ao puxar e inspire ao descer.',
    range_of_motion: 'Puxe até contrair dorsais sem quebrar alinhamento lombar.',
  },
  barbell_curl: {
    name_pt: 'Rosca Direta com Barra',
    target_muscle: 'biceps',
    secondary_muscles: ['antebracos'],
    instructions: ['Fique ereto com cotovelos próximos ao tronco.', 'Flexione os cotovelos elevando a barra sem balanço.', 'Segure breve contração no topo.', 'Desça lentamente até quase extensão total.'],
    common_errors: ['Roubar com tronco.', 'Abrir cotovelos para os lados.', 'Queda rápida na descida.'],
    breathing_tip: 'Expire na subida e inspire na descida.',
    range_of_motion: 'Suba até contração forte do bíceps e desça controlando.',
  },
  hammer_curl: {
    name_pt: 'Rosca Martelo',
    target_muscle: 'biceps',
    secondary_muscles: ['antebracos'],
    instructions: ['Segure halteres com pegada neutra.', 'Suba mantendo punhos alinhados e cotovelos fixos.', 'Evite balanço do corpo.', 'Desça controlando até extensão quase completa.'],
    common_errors: ['Rotacionar o punho durante a subida.', 'Elevar ombros para ajudar no movimento.'],
    breathing_tip: 'Expire ao subir e inspire ao descer.',
    range_of_motion: 'Use amplitude total sem deslocar cotovelos para frente.',
  },
  triceps_pushdown: {
    name_pt: 'Tríceps Pulley',
    target_muscle: 'triceps',
    secondary_muscles: ['antebracos'],
    instructions: ['Ajuste postura com cotovelos próximos ao corpo.', 'Empurre a barra ou corda até extensão dos cotovelos.', 'Mantenha ombros estáveis e tronco firme.', 'Retorne devagar sem abrir cotovelos.'],
    common_errors: ['Abrir cotovelos na fase de força.', 'Usar balanço do tronco.'],
    breathing_tip: 'Expire ao estender e inspire ao retornar.',
    range_of_motion: 'Estenda completamente mantendo controle na volta.',
  },
  shoulder_press: {
    name_pt: 'Desenvolvimento de Ombros',
    target_muscle: 'ombros',
    secondary_muscles: ['triceps', 'core'],
    instructions: ['Inicie com carga na altura dos ombros.', 'Empurre para cima mantendo antebraços verticais.', 'Evite hiperextensão lombar durante a subida.', 'Desça com controle até linha do queixo.'],
    common_errors: ['Arquear lombar para compensar carga.', 'Descer pouco e perder amplitude útil.'],
    breathing_tip: 'Expire na subida e inspire na descida.',
    range_of_motion: 'Suba sem travar ombros e retorne até posição inicial com controle.',
  },
  military_press: {
    name_pt: 'Desenvolvimento Militar',
    target_muscle: 'ombros',
    secondary_muscles: ['triceps', 'core'],
    instructions: ['Fique em pé com glúteos e abdômen ativos.', 'Empurre a barra verticalmente acima da cabeça.', 'Passe a cabeça levemente à frente no topo.', 'Retorne a barra ao peitoral superior com controle.'],
    common_errors: ['Empurrar barra para frente fora da linha.', 'Relaxar o core na fase final.'],
    breathing_tip: 'Inspire antes do empurrão e expire ao concluir a repetição.',
    range_of_motion: 'Leve da clavícula ao topo completo mantendo coluna neutra.',
  },
  lateral_raise: {
    name_pt: 'Elevação Lateral',
    target_muscle: 'ombros',
    secondary_muscles: ['trapezio'],
    instructions: ['Segure halteres ou cabo ao lado do corpo.', 'Eleve os braços lateralmente até a linha dos ombros.', 'Mantenha leve flexão nos cotovelos.', 'Desça lentamente controlando o movimento.'],
    common_errors: ['Elevar acima da linha dos ombros.', 'Usar impulso do corpo.'],
    breathing_tip: 'Expire ao subir e inspire ao descer.',
    range_of_motion: 'Suba até a altura dos ombros mantendo controle.',
  },
  pec_deck_fly: {
    name_pt: 'Voador / Peck Deck',
    target_muscle: 'peito',
    secondary_muscles: ['ombros'],
    instructions: ['Ajuste o banco para alinhar mãos ao centro do peito.', 'Aproxime os braços em arco sem encolher ombros.', 'Pause na contração máxima.', 'Retorne devagar sentindo alongamento peitoral.'],
    common_errors: ['Empurrar com trapézio elevado.', 'Bater as alavancas no centro.'],
    breathing_tip: 'Expire ao fechar e inspire ao abrir.',
    range_of_motion: 'Abra até alongamento confortável e feche com controle.',
  },
  dumbbell_fly: {
    name_pt: 'Crucifixo com Halteres',
    target_muscle: 'peito',
    secondary_muscles: ['ombros'],
    instructions: ['Deite com halteres acima do peito e cotovelos semi-flexionados.', 'Abra os braços em arco mantendo o mesmo ângulo de cotovelo.', 'Contraia peitoral para fechar os halteres no centro.', 'Controle toda a descida sem perder postura escapular.'],
    common_errors: ['Transformar o movimento em supino.', 'Descer além da mobilidade e forçar ombros.'],
    breathing_tip: 'Inspire ao abrir e expire ao fechar.',
    range_of_motion: 'Abra até alongamento seguro e retorne sem alterar o cotovelo.',
  },
  lunge: {
    name_pt: 'Avanço',
    target_muscle: 'quadriceps',
    secondary_muscles: ['gluteos', 'posteriores_de_coxa'],
    instructions: ['Dê um passo à frente mantendo tronco ereto.', 'Flexione ambos os joelhos até próximo de 90 graus.', 'Empurre o chão com o pé da frente para retornar.', 'Repita alternando lados com equilíbrio.'],
    common_errors: ['Passo curto demais, sobrecarregando joelho.', 'Inclinar tronco para frente sem controle.'],
    breathing_tip: 'Inspire ao descer e expire na subida.',
    range_of_motion: 'Desça até quase tocar joelho traseiro no chão com controle.',
  },
  calf_raise: {
    name_pt: 'Elevação de Panturrilha',
    target_muscle: 'panturrilhas',
    secondary_muscles: [],
    instructions: ['Posicione a ponta dos pés na plataforma.', 'Eleve os calcanhares contraindo panturrilhas no topo.', 'Segure breve isometria na contração.', 'Desça lentamente até alongar a panturrilha.'],
    common_errors: ['Executar com amplitude curta.', 'Quicar sem controle no fundo.'],
    breathing_tip: 'Expire na subida e inspire na descida.',
    range_of_motion: 'Desça abaixo da linha da plataforma e suba ao máximo controlado.',
  },
  crunch: {
    name_pt: 'Abdominal Crunch',
    target_muscle: 'abdomen',
    secondary_muscles: ['core'],
    instructions: ['Deite com lombar apoiada e mãos ao lado da cabeça.', 'Flexione o tronco aproximando costelas da pelve.', 'Evite puxar o pescoço durante a subida.', 'Retorne lentamente mantendo tensão abdominal.'],
    common_errors: ['Forçar cervical com as mãos.', 'Subir usando impulso do quadril.'],
    breathing_tip: 'Expire ao subir e inspire ao retornar.',
    range_of_motion: 'Eleve escápulas do chão sem perder lombar neutra.',
  },
  leg_raise: {
    name_pt: 'Elevação de Pernas',
    target_muscle: 'abdomen',
    secondary_muscles: ['flexores_do_quadril'],
    instructions: ['Deite com lombar pressionada no solo.', 'Eleve as pernas até 90 graus mantendo abdômen ativo.', 'Desça lentamente sem perder contato lombar.', 'Interrompa a descida antes de compensar com a lombar.'],
    common_errors: ['Arquear lombar na descida.', 'Descer rápido sem controle.'],
    breathing_tip: 'Expire ao elevar e inspire ao descer.',
    range_of_motion: 'Use amplitude que mantenha lombar estável durante todo o movimento.',
  },
};

export function getCuratedExerciseContent(normalizedLookupKey: string): CuratedExerciseContent | null {
  const normalized = normalizeKey(normalizedLookupKey);
  if (!normalized) return null;
  const direct = CURATED_EXERCISES[normalized];
  if (direct) return direct;
  const aliased = BASE_ALIASES[normalized] || normalized;
  if (CURATED_EXERCISES[aliased]) return CURATED_EXERCISES[aliased];
  const fallback = resolveFallbackKey(aliased);
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
    instructions: hasWeakInstructions(instructions) ? (curated.instructions || instructions) : instructions,
    common_errors: commonErrors.length ? commonErrors : (curated.common_errors || []),
    breathing_tip: String(baseExercise.breathing_tip || '').trim() || curated.breathing_tip || null,
    range_of_motion: String(baseExercise.range_of_motion || '').trim() || curated.range_of_motion || null,
  } as T;
}

export function applyCuratedExerciseContent(exercise: Partial<ExerciseEntity>): Partial<ExerciseEntity> {
  const curated = getCuratedExerciseContent(String(exercise.normalized_lookup_key || exercise.slug || exercise.name_pt || exercise.name_en || ''));
  return mergeCuratedExerciseContent(exercise, curated);
}

export function computeExerciseCompletenessScore(exercise: Record<string, any>): number {
  let score = 0;
  if (String(exercise.name_pt || '').trim()) score += 8;
  if (String(exercise.target_muscle || '').trim()) score += 18;
  if (toList(exercise.secondary_muscles).length) score += 8;
  if (toList(exercise.instructions).length >= 3) score += 28;
  else if (toList(exercise.instructions).length >= 2) score += 18;
  if (toList(exercise.common_errors).length >= 2) score += 18;
  else if (toList(exercise.common_errors).length === 1) score += 10;
  if (String(exercise.breathing_tip || '').trim()) score += 10;
  if (String(exercise.range_of_motion || '').trim()) score += 10;
  if (String(exercise.media_url || '').trim()) score += 6;
  if (String(exercise.media_type || '').toLowerCase() === 'video' && Number(exercise.media_confidence_score || 0) >= 0.75) score += 4;
  return Math.max(0, Math.min(100, score));
}

export function computeQualityFlags(exercise: Record<string, any>): string[] {
  const flags: string[] = [];
  if (!String(exercise.name_pt || '').trim()) flags.push('missing_name_pt');
  if (!String(exercise.target_muscle || '').trim()) flags.push('missing_target_muscle');

  const instructions = toList(exercise.instructions);
  if (!instructions.length) flags.push('missing_instructions');
  else if (hasWeakInstructions(instructions)) flags.push('weak_instructions');

  if (!toList(exercise.common_errors).length) flags.push('missing_common_errors');
  if (!String(exercise.breathing_tip || '').trim()) flags.push('missing_breathing_tip');
  if (!String(exercise.range_of_motion || '').trim()) flags.push('missing_range_of_motion');

  if (!String(exercise.media_url || '').trim()) flags.push('missing_media');
  if (Number(exercise.media_confidence_score || 0) < 0.5) flags.push('low_media_confidence');

  if (computeExerciseCompletenessScore(exercise) < 50) flags.push('low_content_value');

  return Array.from(new Set(flags));
}
