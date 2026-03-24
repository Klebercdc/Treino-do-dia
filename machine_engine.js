/* ═══════════════════════════════════════════════════════════════
   KRONIA MACHINE ENGINE — Pipeline Executor + Fan-out
   ═══════════════════════════════════════════════════════════════
   Inspirado na Maltego Machine Scripting Language (sessão 158 RE)
   mas em JSON/JS puro — sem dependências externas.

   Capacidades:
     ∙ Pipeline declarativo em JSON (machines)
     ∙ Fan-out automático: 1 entidade → N → N×M
     ∙ Execução paralela (paths) e sequencial
     ∙ Filtro por tipo de entidade entre steps
     ∙ Confidence scoring (0.0–1.0) por entidade
     ∙ Max entities por step (equivalente ao Slider)
     ∙ Mensagens multi-nível: info / warn / error / debug
     ∙ 100% aditivo — não altera nenhum arquivo existente
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── 1. ENTIDADE KRONIA (com confidence) ─────────────────────── */
class KroniaEntity {
  /**
   * @param {string} type   - ex: 'Treino', 'FadigaScore', 'PR'
   * @param {*}      value  - valor principal da entidade
   * @param {number} confidence - 0.0 a 1.0 (padrão 1.0)
   * @param {object} props  - campos extras
   */
  constructor(type, value, confidence = 1.0, props = {}) {
    this.type       = type;
    this.value      = value;
    this.confidence = Math.max(0, Math.min(1, confidence));
    this.props      = props;
    this.id         = `${type}::${JSON.stringify(value)}`;  // dedup key
  }
}

/* ── 2. TRANSFORM REGISTRY ───────────────────────────────────── */
const KM_REGISTRY = {};

function kmRegister(name, fn) {
  KM_REGISTRY[name] = fn;
}

/* ── 3. TRANSFORMS NATIVOS ──────────────────────────────────── */

/**
 * expandTreinos
 * Usuario → [Treino, Treino, ...]
 * Lê kronia_history_v2 do localStorage.
 * Confidence: 1.0 para todos (dado direto do usuário).
 */
kmRegister('expandTreinos', (entity /*, config*/) => {
  if (entity.type !== 'Usuario') return [];
  try {
    const hist = JSON.parse(localStorage.getItem('kronia_history_v2') || '[]');
    return hist.map(s => new KroniaEntity(
      'Treino',
      { id: s.id || s.createdAt, data: s.createdAt, duracao: s.duracao },
      1.0,
      { raw: s }
    ));
  } catch { return []; }
});

/**
 * expandExercicios
 * Treino → [Exercicio, Exercicio, ...]
 * Confidence: 1.0 — extraído direto dos dados registrados.
 */
kmRegister('expandExercicios', (entity /*, config*/) => {
  if (entity.type !== 'Treino') return [];
  const session = entity.props.raw || {};
  return (session.exercicios || []).map(ex => new KroniaEntity(
    'Exercicio',
    { nome: ex.nome || ex.name, treinoId: entity.value.id },
    1.0,
    { raw: ex }
  ));
});

/**
 * extractRPE
 * Treino → [RPE, RPE, ...]
 * Confidence: depende da qualidade do dado.
 *   - RPE digitado pelo usuário  → 0.9
 *   - RPE calculado pelo sistema → 0.7
 *   - RPE ausente (0 ou null)    → 0.3
 */
kmRegister('extractRPE', (entity /*, config*/) => {
  if (entity.type !== 'Treino') return [];
  const session = entity.props.raw || {};
  const exercicios = session.exercicios || [];
  const rpeValues = exercicios.map(ex => ex.rpe).filter(r => r != null && r > 0);

  if (rpeValues.length === 0) {
    return [new KroniaEntity('RPE', 0, 0.3, { fonte: 'ausente', treinoId: entity.value.id })];
  }

  return rpeValues.map(r => new KroniaEntity(
    'RPE',
    r,
    r > 0 && r <= 10 ? 0.9 : 0.5,
    { fonte: 'usuario', treinoId: entity.value.id }
  ));
});

/**
 * computeFadiga
 * [RPE, RPE, ...] → FadigaScore
 * Confidence: média ponderada pelas confidences dos RPEs.
 */
kmRegister('computeFadiga', (entity /*, config*/) => {
  if (entity.type !== 'RPE') return [];
  const rpe = parseFloat(entity.value) || 0;
  if (rpe <= 0) return [];

  const fadiga = rpe;  // simplificado — no futuro: ACWR weight
  return [new KroniaEntity(
    'FadigaScore',
    parseFloat(fadiga.toFixed(2)),
    entity.confidence * 0.95,  // propaga com leve desconto
    { rpeOrigem: rpe, fonte: entity.props.fonte || 'calculado' }
  )];
});

/**
 * calcFadiga (direto do Usuario — atalho sem fan-out)
 * Usuario → FadigaScore
 * Usa teComputeAthleteData se disponível.
 */
kmRegister('calcFadiga', (entity /*, config*/) => {
  if (entity.type !== 'Usuario') return [];
  try {
    const d = typeof teComputeAthleteData === 'function'
      ? teComputeAthleteData()
      : null;
    if (!d || !d.hasData) return [];
    return [new KroniaEntity(
      'FadigaScore',
      parseFloat((d.fadigaScore || 0).toFixed(2)),
      0.85,  // calculado por agregação — leve incerteza
      {
        rpeVariance:     d.rpeVariance,
        semSemPR:        d.semSemPR,
        cargaRegression: d.cargaRegression,
        diasSemTreino:   d.diasSemTreino,
        fonte:           'calcFadiga',
      }
    )];
  } catch { return []; }
});

/**
 * detectPR
 * Exercicio → PR (se for record pessoal)
 * Confidence: 1.0 — dado direto.
 */
kmRegister('detectPR', (entity /*, config*/) => {
  if (entity.type !== 'Exercicio') return [];
  const ex = entity.props.raw || {};
  const nome = entity.value.nome;

  try {
    const prs = JSON.parse(localStorage.getItem('kronia_prs') || '{}');
    const historicoPR = prs[nome] || [];

    // Melhor série da sessão atual
    const series = ex.series || [];
    const melhores = series
      .filter(s => s.peso > 0 && s.reps > 0)
      .map(s => ({
        peso: s.peso,
        reps: s.reps,
        oneRM: s.reps <= 10 ? s.peso / (1.0278 - 0.0278 * s.reps) : null,
      }));

    if (melhores.length === 0) return [];

    const best = melhores.reduce((a, b) => (a.oneRM || 0) > (b.oneRM || 0) ? a : b);
    const prevBest = historicoPR.length > 0
      ? Math.max(...historicoPR.map(p => p.oneRM || 0))
      : 0;

    if ((best.oneRM || 0) > prevBest) {
      return [new KroniaEntity(
        'PR',
        { exercicio: nome, peso: best.peso, reps: best.reps, oneRM: parseFloat((best.oneRM || 0).toFixed(2)) },
        1.0,
        { novo: true, ganho: parseFloat(((best.oneRM || 0) - prevBest).toFixed(2)) }
      )];
    }
  } catch { /* sem PR */ }
  return [];
});

/**
 * projecaoEvolucao
 * PR → Recomendacao (projeção de evolução)
 * Confidence: 0.75 — inferência baseada em modelo linear.
 */
kmRegister('projecaoEvolucao', (entity /*, config*/) => {
  if (entity.type !== 'PR') return [];
  const { exercicio, peso, reps, oneRM } = entity.value;
  const proximo = parseFloat((oneRM * 1.025).toFixed(2));  // +2.5% (microload)

  return [new KroniaEntity(
    'Recomendacao',
    `${exercicio}: próximo alvo ${proximo} kg 1RM (+2,5%)`,
    entity.confidence * 0.75,
    {
      tipo:        'evolucao',
      exercicio,
      pesoAtual:   peso,
      oneRMAtual:  oneRM,
      oneRMAlvo:   proximo,
      sugestao:    `Tente ${peso + 2.5} kg × ${reps} reps na próxima sessão.`,
    }
  )];
});

/**
 * kronosAdvise
 * FadigaScore → Recomendacao (prescrição clínica baseada em ACWR)
 * Confidence: 0.80 — modelo determinístico + dados de entrada.
 */
kmRegister('kronosAdvise', (entity /*, config*/) => {
  if (entity.type !== 'FadigaScore') return [];
  const fadiga = entity.value;
  const zones = {
    destreino:    { min: 0,   max: 0.8,  msg: 'Volume abaixo do ideal. Aumente a frequência gradualmente.' },
    otimo:        { min: 0.8, max: 1.3,  msg: 'Zona ótima. Liberado para progressão de carga e quebra de PR.' },
    atencao:      { min: 1.3, max: 1.5,  msg: 'Fadiga acumulada. Mantenha cargas e reduza 1 série por exercício.' },
    perigo:       { min: 1.5, max: 99,   msg: 'Risco ortopédico. Treino regenerativo (RPE máx: 4).' },
  };

  // Normaliza fadiga (RPE médio) para ACWR estimado
  const acwrEstimado = fadiga / 6.5;  // RPE 6.5 = zona ótima base
  let zona = 'sem_historico';
  let msg  = 'Registre treinos por 4 semanas para calibrar o motor.';

  for (const [z, cfg] of Object.entries(zones)) {
    if (acwrEstimado >= cfg.min && acwrEstimado < cfg.max) {
      zona = z;
      msg  = cfg.msg;
      break;
    }
  }

  return [new KroniaEntity(
    'Recomendacao',
    msg,
    entity.confidence * 0.80,
    {
      tipo:          'fadiga',
      zona,
      fadigaScore:   fadiga,
      acwrEstimado:  parseFloat(acwrEstimado.toFixed(3)),
      ...entity.props,
    }
  )];
});


/* ── 4. TRANSFORMS DE ENRIQUECIMENTO (WEB) ──────────────────── */

/**
 * Cache em memória para o índice de exercícios (free-exercise-db).
 * Carregado uma única vez por sessão de página.
 * null = ainda não carregado | Map = índice pronto | 'error' = falha
 */
let _exdbIndex = null;
const _EXDB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const _EXDB_IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

const _MUSCLE_GROUP = {
  'abdominals':  'Abdômen/Lombar',  'abductors':   'Glúteos',
  'adductors':   'Quadríceps/Isquiotibiais',        'biceps': 'Bíceps/Tríceps',
  'calves':      'Panturrilha',     'chest':        'Peito',
  'forearms':    'Antebraço',       'glutes':       'Glúteos',
  'hamstrings':  'Quadríceps/Isquiotibiais',        'lats':   'Costas',
  'lower back':  'Abdômen/Lombar',  'middle back':  'Costas',
  'neck':        'Pescoço',         'quadriceps':   'Quadríceps/Isquiotibiais',
  'shoulders':   'Ombros',          'traps':        'Costas',
  'triceps':     'Bíceps/Tríceps',
};

/** Normaliza nome para lookup: minúsculas, só letras/números/espaço. */
function _normKey(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Carrega o índice free-exercise-db (uma vez, depois fica em memória).
 * Circuit breaker: timeout de 6s — se a CDN do GitHub não responder,
 * retorna Map vazio para não bloquear o pipeline.
 * @returns {Promise<Map<string, object>>}
 */
async function _loadExdb() {
  if (_exdbIndex instanceof Map) return _exdbIndex;
  if (_exdbIndex === 'error')    return new Map();

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout CDN')), 6000)
  );

  try {
    const res  = await Promise.race([fetch(_EXDB_URL), timeout]);
    const data = await res.json();
    _exdbIndex = new Map();
    for (const ex of data) {
      const key = _normKey(ex.name);
      if (key && !_exdbIndex.has(key)) _exdbIndex.set(key, ex);
    }
    return _exdbIndex;
  } catch {
    _exdbIndex = 'error';
    return new Map();
  }
}

/**
 * enrichExercicio (ASYNC)
 * Exercicio → ExercicioInfo
 *
 * Busca dados do free-exercise-db (GitHub CDN) por similaridade de nome.
 * Enriquece o exercício com:
 *   - Músculos primários/secundários
 *   - Nível (beginner / intermediate / expert)
 *   - Mecânica (compound / isolation)
 *   - Tipo de força (push / pull / static)
 *   - Instruções de execução
 *   - URL de imagem
 *
 * Confidence:
 *   - Match exato     → entity.confidence × 0.95
 *   - Match parcial   → entity.confidence × 0.75
 *   - Sem match       → 0.30 (dado mínimo)
 */
kmRegister('enrichExercicio', async (entity) => {
  if (entity.type !== 'Exercicio') return [];
  const nomeOriginal = (entity.value.nome || '').trim();
  if (!nomeOriginal) return [];

  const index   = await _loadExdb();
  const keyBusca = _normKey(nomeOriginal);

  // 1. Busca exata
  let found      = index.get(keyBusca);
  let matchType  = 'exato';
  let confMult   = 0.95;

  // 2. Busca por substring (keyBusca dentro do nome do índice)
  if (!found) {
    for (const [k, v] of index) {
      if (k.includes(keyBusca) || keyBusca.includes(k)) {
        found     = v;
        matchType = 'parcial';
        confMult  = 0.75;
        break;
      }
    }
  }

  if (!found) {
    return [new KroniaEntity(
      'ExercicioInfo',
      { nome: nomeOriginal, enriched: false },
      0.30,
      { ...entity.props, fonte: 'sem-match', matchType: 'nenhum' }
    )];
  }

  const primaryMuscle = (found.primaryMuscles || [])[0] || '';
  const muscleGroup   = _MUSCLE_GROUP[primaryMuscle] || 'Geral';

  const instructions = Array.isArray(found.instructions)
    ? found.instructions.join('\n')
    : (found.instructions || '');

  const imageUrl = (found.images && found.images.length > 0)
    ? _EXDB_IMG + found.images[0]
    : '';

  return [new KroniaEntity(
    'ExercicioInfo',
    { nome: nomeOriginal, nomeEn: found.name },
    entity.confidence * confMult,
    {
      muscleGroup,
      musclesPrimary:    found.primaryMuscles   || [],
      musclesSecondary:  found.secondaryMuscles || [],
      equipment:         found.equipment        || '',
      level:             found.level            || '',
      mechanic:          found.mechanic         || '',
      force:             found.force            || '',
      instructions,
      imageUrl,
      matchType,
      fonte: 'github-exdb',
    }
  )];
});

/**
 * sugerirVariacoes
 * ExercicioInfo → Recomendacao
 *
 * Gera recomendações contextuais baseadas em:
 *   - Nível de dificuldade (beginner → sugerir progressão)
 *   - Mecânica (compound → priorizar no início do treino)
 *   - Tipo de força (push/pull → equilibrar no plano semanal)
 * Confidence: entity.confidence × 0.85
 */
kmRegister('sugerirVariacoes', (entity) => {
  if (entity.type !== 'ExercicioInfo') return [];
  const { nome } = entity.value;
  const { level, mechanic, force, muscleGroup } = entity.props;

  const recs = [];
  const conf = entity.confidence * 0.85;

  if (level === 'beginner') {
    recs.push(new KroniaEntity(
      'Recomendacao',
      `${nome}: iniciante — domine a técnica antes de progredir em carga.`,
      conf,
      { tipo: 'progressao', nivel: level, muscleGroup }
    ));
  } else if (level === 'expert') {
    recs.push(new KroniaEntity(
      'Recomendacao',
      `${nome}: avançado — pré-requisito: domínio das variações intermediárias.`,
      conf,
      { tipo: 'progressao', nivel: level, muscleGroup }
    ));
  }

  if (mechanic === 'compound') {
    recs.push(new KroniaEntity(
      'Recomendacao',
      `${nome}: movimento composto — execute primeiro no treino, quando o SNC está descansado.`,
      conf,
      { tipo: 'ordem_treino', mecanica: mechanic }
    ));
  }

  if (force === 'pull' || force === 'push') {
    recs.push(new KroniaEntity(
      'Recomendacao',
      `${nome} (${force === 'pull' ? 'puxada' : 'empurrada'}) — equilibre com movimentos ${force === 'pull' ? 'de empurrada' : 'de puxada'} no bloco semanal.`,
      conf,
      { tipo: 'equilibrio_push_pull', force, muscleGroup }
    ));
  }

  if (recs.length === 0) {
    recs.push(new KroniaEntity(
      'Recomendacao',
      `${nome} — ${muscleGroup}: execute com foco na contração muscular e controle excêntrico.`,
      conf * 0.80,
      { tipo: 'tecnica', muscleGroup }
    ));
  }

  return recs;
});

/**
 * detectDesequilibrio (AGGREGATE — recebe TODAS as ExercicioInfo de uma vez)
 * [ExercicioInfo, ...] → [Recomendacao, ...]
 *
 * Analisa o volume total de exercícios por grupo muscular e tipo (push/pull)
 * para detectar desequilíbrios no plano de treino.
 *
 * Padrões detectados:
 *   ▸ Push >> Pull (ou vice-versa) → risco de desequilíbrio postural
 *   ▸ Grupo muscular dominante → sobrecarga isolada
 *   ▸ Grupo ausente → omissão de músculo importante
 *
 * Registrado no registry mas usado via step type 'aggregate'.
 */
kmRegister('detectDesequilibrio', (entities) => {
  const infos = entities.filter(e => e.type === 'ExercicioInfo' && e.props.enriched !== false);
  if (infos.length < 2) return [];

  const byGroup  = {};
  const byForce  = { push: 0, pull: 0, static: 0, outro: 0 };
  const total    = infos.length;

  for (const e of infos) {
    const g = e.props.muscleGroup || 'Geral';
    byGroup[g] = (byGroup[g] || 0) + 1;

    const f = (e.props.force || '').toLowerCase();
    if (f === 'push')       byGroup[g] && (byForce.push++);
    else if (f === 'pull')  byGroup[g] && (byForce.pull++);
    else if (f === 'static') byForce.static++;
    else                    byForce.outro++;
  }

  const recs = [];
  const avgConf = infos.reduce((s, e) => s + e.confidence, 0) / total;

  // ── Desequilíbrio Push/Pull ────────────────────────────────────
  const push = byForce.push;
  const pull = byForce.pull;
  if (push > 0 && pull > 0) {
    const ratio = push / pull;
    if (ratio > 1.8) {
      recs.push(new KroniaEntity(
        'Recomendacao',
        `Desequilíbrio push/pull detectado: ${push} exercícios de empurrada vs ${pull} de puxada. Adicione mais remadas e puxadas.`,
        avgConf * 0.88,
        { tipo: 'desequilibrio', subtipo: 'push_pull', ratioPushPull: parseFloat(ratio.toFixed(2)) }
      ));
    } else if (ratio < 0.55) {
      recs.push(new KroniaEntity(
        'Recomendacao',
        `Desequilíbrio push/pull detectado: ${pull} exercícios de puxada vs ${push} de empurrada. Adicione mais supinos e desenvolvimentos.`,
        avgConf * 0.88,
        { tipo: 'desequilibrio', subtipo: 'push_pull', ratioPushPull: parseFloat(ratio.toFixed(2)) }
      ));
    }
  }

  // ── Grupo dominante (>40% do total) ───────────────────────────
  const sorted = Object.entries(byGroup).sort((a, b) => b[1] - a[1]);
  const [topGroup, topCount] = sorted[0] || [];
  if (topGroup && topCount / total > 0.40) {
    recs.push(new KroniaEntity(
      'Recomendacao',
      `Concentração excessiva em ${topGroup}: ${topCount}/${total} exercícios (${Math.round(topCount / total * 100)}%). Diversifique os grupos musculares.`,
      avgConf * 0.85,
      { tipo: 'desequilibrio', subtipo: 'grupo_dominante', grupo: topGroup, percentual: topCount / total }
    ));
  }

  // ── Grupos ausentes (músculos-chave sem exercícios) ────────────
  const CHAVE = ['Costas', 'Peito', 'Ombros', 'Abdômen/Lombar', 'Quadríceps/Isquiotibiais', 'Glúteos'];
  const ausentes = CHAVE.filter(g => !byGroup[g]);
  if (ausentes.length > 0) {
    recs.push(new KroniaEntity(
      'Recomendacao',
      `Grupos musculares não trabalhados: ${ausentes.join(', ')}. Considere incluí-los no plano semanal.`,
      avgConf * 0.80,
      { tipo: 'desequilibrio', subtipo: 'grupo_ausente', grupos: ausentes }
    ));
  }

  // ── Plano equilibrado ──────────────────────────────────────────
  if (recs.length === 0) {
    recs.push(new KroniaEntity(
      'Recomendacao',
      `Distribuição muscular equilibrada: ${Object.keys(byGroup).length} grupos trabalhados em ${total} exercícios. Continue assim.`,
      avgConf * 0.90,
      { tipo: 'equilibrio', distribuicao: byGroup }
    ));
  }

  return recs;
});


/* ── 4. DEFINIÇÃO DE MACHINES ────────────────────────────────── */
const KM_MACHINES = {

  /**
   * Análise completa do atleta
   * Entrada: Usuario → saída: [Recomendacao]
   */
  'kronia.full_analysis': {
    id:           'kronia.full_analysis',
    displayName:  'Análise Completa do Atleta',
    description:  'Expande treinos, calcula fadiga em paralelo e gera recomendações.',
    inputType:    'Usuario',
    maxEntities:  255,
    steps: [
      {
        id:   'step_1_coleta',
        type: 'parallel',
        transforms: ['expandTreinos', 'calcFadiga'],
      },
      {
        id:        'step_2_filtro_fadiga',
        type:      'filter',
        entityType: 'FadigaScore',
      },
      {
        id:          'step_3_advise',
        type:        'sequential',
        transforms:  ['kronosAdvise'],
        maxEntities: 1,  // só a top recomendação
      },
    ],
  },

  /**
   * Caçador de PRs
   * Entrada: Usuario → saída: [PR, PR, ...]
   */
  'kronia.pr_hunter': {
    id:           'kronia.pr_hunter',
    displayName:  'Caçador de PRs',
    description:  'Detecta Personal Records em todos os exercícios e projeta evolução.',
    inputType:    'Usuario',
    maxEntities:  56,
    steps: [
      {
        id:          'step_1_treinos',
        type:        'sequential',
        transforms:  ['expandTreinos'],
        maxEntities: 20,  // últimos 20 treinos
      },
      {
        id:         'step_2_exercicios',
        type:       'sequential',
        transforms: ['expandExercicios'],
      },
      {
        id:         'step_3_pr',
        type:       'sequential',
        transforms: ['detectPR'],
      },
      {
        id:         'step_4_projecao',
        type:       'sequential',
        transforms: ['projecaoEvolucao'],
      },
    ],
  },

  /**
   * Inteligência de Exercício
   * Entrada: Usuario → saída: [Recomendacao]
   * Enriquece cada exercício dos treinos recentes com dados externos
   * (músculos, nível, mecânica, imagens) e gera recomendações individuais.
   */
  'kronia.exercise_intel': {
    id:          'kronia.exercise_intel',
    displayName: 'Inteligência de Exercício',
    description: 'Enriquece exercícios dos treinos com dados externos e gera recomendações por nível, mecânica e tipo de força.',
    inputType:   'Usuario',
    maxEntities: 48,
    steps: [
      {
        id:          'step_1_treinos',
        type:        'sequential',
        transforms:  ['expandTreinos'],
        maxEntities: 5,   // últimos 5 treinos
      },
      {
        id:         'step_2_exercicios',
        type:       'sequential',
        transforms: ['expandExercicios'],
      },
      {
        id:         'step_3_enrich',
        type:       'sequential',
        transforms: ['enrichExercicio'],  // async — busca no GitHub CDN
      },
      {
        id:         'step_4_sugestoes',
        type:       'sequential',
        transforms: ['sugerirVariacoes'],
      },
    ],
  },

  /**
   * Radar de Desequilíbrio Muscular
   * Entrada: Usuario → saída: [Recomendacao]
   * Analisa TODOS os exercícios dos treinos recentes de uma vez (aggregate)
   * para detectar desequilíbrios push/pull, grupos dominantes e grupos ausentes.
   */
  'kronia.muscle_balance': {
    id:          'kronia.muscle_balance',
    displayName: 'Radar de Desequilíbrio Muscular',
    description: 'Detecta desequilíbrios push/pull, grupos dominantes e músculos ausentes no plano de treino.',
    inputType:   'Usuario',
    maxEntities: 12,
    steps: [
      {
        id:          'step_1_treinos',
        type:        'sequential',
        transforms:  ['expandTreinos'],
        maxEntities: 10,
      },
      {
        id:         'step_2_exercicios',
        type:       'sequential',
        transforms: ['expandExercicios'],
      },
      {
        id:         'step_3_enrich',
        type:       'sequential',
        transforms: ['enrichExercicio'],
      },
      {
        id:        'step_4_radar',
        type:      'aggregate',          // novo step type: recebe TODOS de uma vez
        transform: 'detectDesequilibrio',
      },
    ],
  },

  /**
   * Vigilante de overtraining
   * Entrada: Usuario → saída: [Recomendacao] focada em fadiga
   */
  'kronia.overtraining_watch': {
    id:          'kronia.overtraining_watch',
    displayName: 'Vigilante de Overtraining',
    description: 'Extrai RPE dos últimos treinos, computa fadiga e emite alerta se necessário.',
    inputType:   'Usuario',
    maxEntities: 12,
    steps: [
      {
        id:          'step_1_treinos',
        type:        'sequential',
        transforms:  ['expandTreinos'],
        maxEntities: 10,
      },
      {
        id:         'step_2_rpe',
        type:       'sequential',
        transforms: ['extractRPE'],
      },
      {
        id:         'step_3_fadiga',
        type:       'sequential',
        transforms: ['computeFadiga'],
      },
      {
        id:         'step_4_filter',
        type:       'filter',
        entityType: 'FadigaScore',
      },
      {
        id:          'step_5_advise',
        type:        'sequential',
        transforms:  ['kronosAdvise'],
        maxEntities: 1,
      },
    ],
  },
};


/* ── 5. FAN-OUT ENGINE ───────────────────────────────────────── */

function _dedup(entities) {
  const seen = new Map();
  for (const e of entities) {
    const prev = seen.get(e.id);
    if (!prev || e.confidence > prev.confidence) seen.set(e.id, e);
  }
  return [...seen.values()];
}

function _topN(entities, n) {
  if (!n || entities.length <= n) return entities;
  return [...entities].sort((a, b) => b.confidence - a.confidence).slice(0, n);
}

async function _execStep(step, workingSet, logger) {
  logger(`[step:${step.id}] tipo=${step.type} entrada=${workingSet.length} entidades`);

  if (step.type === 'filter') {
    const filtered = workingSet.filter(e => e.type === step.entityType);
    logger(`[step:${step.id}] filtro "${step.entityType}" → ${filtered.length} entidades`);
    return filtered;
  }

  if (step.type === 'sequential') {
    let set = [...workingSet];
    for (const tName of step.transforms) {
      const fn = KM_REGISTRY[tName];
      if (!fn) { logger(`[warn] transform "${tName}" não encontrado`); continue; }

      const next = [];
      for (const entity of set) {
        try {
          const results = await fn(entity, step.config || {});  // suporte async
          next.push(...(results || []));
        } catch(e) {
          logger(`[error] ${tName}(${entity.type}) → ${e.message}`);
        }
      }
      set = _dedup(next);
      logger(`[step:${step.id}] ${tName}() → ${set.length} entidades`);
    }
    return _topN(set, step.maxEntities);
  }

  if (step.type === 'parallel') {
    const allResults = [];
    for (const tName of step.transforms) {
      const fn = KM_REGISTRY[tName];
      if (!fn) { logger(`[warn] transform "${tName}" não encontrado`); continue; }

      for (const entity of workingSet) {
        try {
          const results = await fn(entity, step.config || {});  // suporte async
          allResults.push(...(results || []));
        } catch(e) {
          logger(`[error] ${tName}(${entity.type}) → ${e.message}`);
        }
      }
    }
    const merged = _dedup(allResults);
    logger(`[step:${step.id}] parallel → ${merged.length} entidades (union)`);
    return _topN(merged, step.maxEntities);
  }

  // Novo tipo: 'aggregate' — passa o working set INTEIRO para um único transform
  // Útil para análises que precisam ver todos os dados ao mesmo tempo (ex: detectDesequilibrio)
  if (step.type === 'aggregate') {
    const fn = KM_REGISTRY[step.transform];
    if (!fn) {
      logger(`[warn] aggregate transform "${step.transform}" não encontrado`);
      return workingSet;
    }
    try {
      const results = await fn(workingSet, step.config || {});
      const merged  = _dedup(results || []);
      logger(`[step:${step.id}] aggregate "${step.transform}" → ${merged.length} entidades`);
      return _topN(merged, step.maxEntities);
    } catch(e) {
      logger(`[error] aggregate "${step.transform}" → ${e.message}`);
      return [];
    }
  }

  logger(`[warn] tipo de step desconhecido: "${step.type}"`);
  return workingSet;
}


/* ── 6. MACHINE RUNNER ───────────────────────────────────────── */

/**
 * Executa uma machine definida em KM_MACHINES.
 *
 * @param {string}   machineId    - ex: 'kronia.full_analysis'
 * @param {KroniaEntity} input    - entidade inicial (tipo deve bater com machine.inputType)
 * @param {function} [onLog]      - callback(msg:string) para log em tempo real
 * @returns {Promise<{entities: KroniaEntity[], messages: object[]}>}
 */
async function kmRunMachine(machineId, input, onLog) {
  const machine = KM_MACHINES[machineId];
  if (!machine) throw new Error(`Machine "${machineId}" não encontrada.`);

  const messages = [];
  const logger = (msg) => {
    messages.push({ level: msg.startsWith('[error]') ? 'error'
                         : msg.startsWith('[warn]')  ? 'warn'
                         : 'info', text: msg, ts: Date.now() });
    if (typeof onLog === 'function') onLog(msg);
  };

  logger(`▶ Iniciando: ${machine.displayName}`);
  if (input.type !== machine.inputType) {
    logger(`[error] Entidade de entrada "${input.type}" ≠ "${machine.inputType}" esperado.`);
    return { entities: [], messages };
  }

  let workingSet = [input];

  for (const step of machine.steps) {
    workingSet = await _execStep(step, workingSet, logger);
    if (workingSet.length === 0) {
      logger(`[warn] Working set vazio após step "${step.id}" — abortando pipeline.`);
      break;
    }
  }

  // Aplica limite global da machine
  const finalSet = _topN(workingSet, machine.maxEntities);
  logger(`■ Concluído: ${finalSet.length} entidade(s) de saída`);

  return { entities: finalSet, messages };
}


/* ── 7. UI HELPERS ───────────────────────────────────────────── */

/**
 * Executa uma machine e exibe resultado no painel de log existente.
 * Compatível com o runDefensiveScan() já existente.
 *
 * @param {string} machineId
 * @param {string} [userId]   - user id (opcional, só para log)
 */
async function kmRunMachineUI(machineId, userId) {
  const machine = KM_MACHINES[machineId];
  if (!machine) return;

  const logBox     = document.getElementById('defensiveLog');
  const logLines   = document.getElementById('defensiveLogLines');
  const kronosBox  = document.getElementById('kronosAnalysis');
  const kronosText = document.getElementById('kronosAnalysisText');

  if (logBox)   logBox.style.display = 'block';
  if (logLines) logLines.innerHTML   = '';

  function addLog(msg) {
    if (!logLines) return;
    const line = document.createElement('div');
    line.style.cssText = 'font-size:0.72rem;color:rgba(255,255,255,0.45);font-family:monospace;margin-bottom:3px';
    line.textContent = msg;
    logLines.appendChild(line);
    if (logBox) logBox.scrollTop = logBox.scrollHeight;
  }

  let entities = [], messages = [], usedServer = false;

  // ── Tenta servidor primeiro (dados Supabase + sem localStorage) ──────────
  try {
    const { data: { session } } = await window._sb?.auth.getSession?.() || { data: {} };
    const token = session?.access_token;
    if (token) {
      addLog(`▶ [server] Iniciando: ${machine.displayName}`);
      const resp = await Promise.race([
        fetch('/api/machine', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body:    JSON.stringify({ machineId }),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('API timeout')), 20000)),
      ]);

      if (resp.ok) {
        const result = await resp.json();
        entities    = result.entities  || [];
        messages    = result.messages  || [];
        usedServer  = true;
        (result.messages || []).forEach(m => addLog(m.text));
      }
    }
  } catch(e) {
    addLog(`[warn] API server indisponível (${e.message}) — executando localmente…`);
  }

  // ── Fallback: execução local (localStorage) ────────────────────────────────
  if (!usedServer) {
    addLog(`▶ [local] Iniciando: ${machine.displayName}`);
    const input  = new KroniaEntity('Usuario', userId || 'local', 1.0);
    const result = await kmRunMachine(machineId, input, addLog);
    entities = result.entities;
    messages = result.messages;
  }

  // ── Badge de fonte ────────────────────────────────────────────────────────
  addLog(usedServer ? '   Fonte: Supabase (dados em nuvem)' : '   Fonte: localStorage (dados locais)');

  // ── Renderiza Recomendações ───────────────────────────────────────────────
  const recs = entities.filter(e => e.type === 'Recomendacao');
  const prs  = entities.filter(e => e.type === 'PR');

  if (recs.length > 0 && kronosBox && kronosText) {
    kronosBox.style.display = 'block';
    kronosText.innerHTML = recs.map(r => {
      const conf = Math.round(r.confidence * 100);
      const bar  = '█'.repeat(Math.round(conf / 10)) + '░'.repeat(10 - Math.round(conf / 10));
      return `<div style="margin-bottom:8px">
        <div style="font-size:0.78rem;color:var(--text)">${r.value}</div>
        <div style="font-size:0.65rem;color:rgba(255,255,255,0.3);font-family:monospace;margin-top:3px">
          confiança ${bar} ${conf}%
        </div>
      </div>`;
    }).join('');
  }

  prs.forEach(pr => {
    addLog(`PR: ${pr.value.exercicio} — ${pr.value.peso} kg × ${pr.value.reps} reps (1RM ~${pr.value.oneRM} kg)`);
  });

  const errorCount = messages.filter(m => m.level === 'error').length;
  if (errorCount > 0) addLog(`⚠ ${errorCount} erro(s) — verifique o console.`);

  return { entities, messages, usedServer };
}

/**
 * Renderiza o catálogo de machines no painel Transforms.
 * Chamar após teRenderCatalog() para adicionar a aba de machines.
 */
function kmRenderMachinesCatalog(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = Object.values(KM_MACHINES).map(m => `
    <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);
                border:1px solid rgba(255,255,255,0.07);margin-bottom:8px">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem;font-weight:700;margin-bottom:3px">${m.displayName}</div>
          <div style="font-family:monospace;font-size:0.65rem;color:rgba(255,107,0,0.7);margin-bottom:4px">${m.id}</div>
          <div style="font-size:0.72rem;color:rgba(255,255,255,0.35)">${m.description}</div>
          <div style="font-size:0.65rem;color:rgba(255,255,255,0.2);margin-top:4px">
            ${m.steps.length} steps · entrada: ${m.inputType} · max ${m.maxEntities || '∞'} entidades
          </div>
        </div>
        <button onclick="kmRunMachineUI('${m.id}')"
          style="flex-shrink:0;padding:6px 12px;border-radius:8px;
                 background:rgba(255,107,0,0.12);border:1px solid rgba(255,107,0,0.3);
                 color:#FF6B00;font-size:0.72rem;font-weight:700;cursor:pointer">
          ▶ Run
        </button>
      </div>
    </div>
  `).join('');
}
