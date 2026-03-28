/**
 * POST /api/machine
 * ═══════════════════════════════════════════════════════════════
 * KRONIA Machine Engine — Executor Server-Side
 *
 * Executa qualquer machine do grafo de entidades KRONIA no servidor.
 * Busca dados do usuário diretamente do Supabase (sem localStorage),
 * tornando o engine disponível para qualquer cliente autenticado:
 * browser, mobile, integrações externas.
 *
 * Body (JSON):
 *   { "machineId": "kronia.full_analysis" }
 *
 * Retorna:
 *   { "entities": [...], "messages": [...], "machine": {...} }
 *
 * Machines disponíveis:
 *   kronia.full_analysis        — Análise completa (fadiga + ACWR)
 *   kronia.pr_hunter            — Caçador de PRs + projeção
 *   kronia.overtraining_watch   — Vigilante de overtraining
 *   kronia.exercise_intel       — Inteligência de exercício (async)
 *   kronia.muscle_balance       — Radar de desequilíbrio muscular
 *
 * Variáveis de ambiente obrigatórias:
 *   SUPABASE_URL         — URL do projeto Supabase
 *   SUPABASE_SERVICE_KEY — chave service_role (lê dados de qualquer user)
 *   SUPABASE_ANON_KEY    — fallback se service_role não estiver disponível
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

var https = require('https');
var cors  = require('./_cors');
var auth  = require('./_auth');

var SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
var SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// ── Supabase REST helper ──────────────────────────────────────────────────────

function supaGET(path, userToken) {
  return new Promise(function(resolve, reject) {
    var urlStr = SUPABASE_URL + '/rest/v1' + path;
    var urlObj;
    try { urlObj = new URL(urlStr); } catch(e) { return reject(new Error('URL inválida: ' + urlStr)); }

    var req = https.request({
      hostname: urlObj.hostname,
      port:     443,
      path:     urlObj.pathname + urlObj.search,
      method:   'GET',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + (userToken || SUPABASE_KEY),
        'Accept':        'application/json',
      },
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch(e) { reject(new Error('JSON inválido do Supabase')); }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, function() { req.destroy(); reject(new Error('Timeout Supabase')); });
    req.end();
  });
}

// ── KroniaEntity (servidor) ───────────────────────────────────────────────────

function KE(type, value, confidence, props) {
  this.type       = type;
  this.value      = value;
  this.confidence = Math.max(0, Math.min(1, confidence == null ? 1 : confidence));
  this.props      = props || {};
  this.id         = type + '::' + JSON.stringify(value);
}

// ── Deduplicação + TopN ───────────────────────────────────────────────────────

function dedup(entities) {
  var seen = new Map();
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (!seen.has(e.id) || e.confidence > seen.get(e.id).confidence) seen.set(e.id, e);
  }
  return Array.from(seen.values());
}

function topN(entities, n) {
  if (!n || entities.length <= n) return entities;
  return entities.slice().sort(function(a, b) { return b.confidence - a.confidence; }).slice(0, n);
}

// ── free-exercise-db (cached por instância Vercel) ────────────────────────────

var _exdbCache = null;
var _EXDB_URL  = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
var _EXDB_IMG  = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
var _MG = {
  abdominals:'Abdômen/Lombar', abductors:'Glúteos', adductors:'Quadríceps/Isquiotibiais',
  biceps:'Bíceps/Tríceps', calves:'Panturrilha', chest:'Peito', forearms:'Antebraço',
  glutes:'Glúteos', hamstrings:'Quadríceps/Isquiotibiais', lats:'Costas',
  'lower back':'Abdômen/Lombar', 'middle back':'Costas', neck:'Pescoço',
  quadriceps:'Quadríceps/Isquiotibiais', shoulders:'Ombros', traps:'Costas', triceps:'Bíceps/Tríceps',
};

function normKey(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadExdb() {
  if (_exdbCache instanceof Map) return Promise.resolve(_exdbCache);
  return new Promise(function(resolve) {
    var urlObj = new URL(_EXDB_URL);
    var req = https.request({
      hostname: urlObj.hostname, port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'KRONIA-Server/1.0', 'Accept': 'application/json' },
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          var data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          _exdbCache = new Map();
          data.forEach(function(ex) {
            var key = normKey(ex.name);
            if (key && !_exdbCache.has(key)) _exdbCache.set(key, ex);
          });
        } catch(e) { _exdbCache = new Map(); }
        resolve(_exdbCache);
      });
    });
    req.on('error', function() { _exdbCache = new Map(); resolve(_exdbCache); });
    req.setTimeout(8000, function() { req.destroy(); _exdbCache = new Map(); resolve(_exdbCache); });
    req.end();
  });
}

// ── Engine Factory — injeta dados do usuário nos transforms ──────────────────

function createEngine(workoutHistory) {

  /* ── REGISTRY DE TRANSFORMS ── */
  var R = {};

  R.expandTreinos = function(entity) {
    if (entity.type !== 'Usuario') return [];
    return (workoutHistory || []).map(function(row) {
      var sd = row.session_data || row;
      return new KE('Treino',
        { id: sd.id || row.id, data: sd.createdAt || row.trained_at, duracao: sd.durationMin },
        1.0, { raw: sd });
    });
  };

  R.expandExercicios = function(entity) {
    if (entity.type !== 'Treino') return [];
    var session = entity.props.raw || {};
    return (session.exercicios || []).map(function(ex) {
      return new KE('Exercicio',
        { nome: ex.nome || ex.name, treinoId: entity.value.id },
        1.0, { raw: ex });
    });
  };

  R.extractRPE = function(entity) {
    if (entity.type !== 'Treino') return [];
    var exs     = (entity.props.raw || {}).exercicios || [];
    var vals    = exs.map(function(e) { return e.rpe; }).filter(function(r) { return r > 0; });
    if (!vals.length) return [new KE('RPE', 0, 0.3, { fonte: 'ausente', treinoId: entity.value.id })];
    return vals.map(function(r) {
      return new KE('RPE', r, (r > 0 && r <= 10) ? 0.9 : 0.5, { fonte: 'usuario', treinoId: entity.value.id });
    });
  };

  R.computeFadiga = function(entity) {
    if (entity.type !== 'RPE') return [];
    var rpe = parseFloat(entity.value) || 0;
    if (rpe <= 0) return [];
    return [new KE('FadigaScore', parseFloat(rpe.toFixed(2)), entity.confidence * 0.95,
      { rpeOrigem: rpe, fonte: entity.props.fonte || 'calculado' })];
  };

  R.calcFadiga = function(entity) {
    if (entity.type !== 'Usuario') return [];
    var hist = workoutHistory || [];
    if (hist.length < 2) return [];
    var rpeList = [];
    hist.slice(0, 10).forEach(function(row) {
      var sd = row.session_data || row;
      (sd.exercicios || []).forEach(function(ex) { if (ex.rpe > 0) rpeList.push(ex.rpe); });
    });
    if (!rpeList.length) return [];
    var avg = rpeList.reduce(function(a, b) { return a + b; }, 0) / rpeList.length;
    return [new KE('FadigaScore', parseFloat(avg.toFixed(2)), 0.85,
      { fonte: 'calcFadiga_srv', amostras: rpeList.length })];
  };

  R.detectPR = function(entity) {
    if (entity.type !== 'Exercicio') return [];
    var ex    = entity.props.raw || {};
    var nome  = entity.value.nome;
    var melhores = (ex.series || [])
      .filter(function(s) { return s.peso > 0 && s.reps > 0; })
      .map(function(s) {
        return { peso: s.peso, reps: s.reps,
          oneRM: s.reps <= 10 ? s.peso / (1.0278 - 0.0278 * s.reps) : null };
      });
    if (!melhores.length) return [];
    var best = melhores.reduce(function(a, b) { return (a.oneRM || 0) > (b.oneRM || 0) ? a : b; });
    if (!best.oneRM) return [];
    return [new KE('PR',
      { exercicio: nome, peso: best.peso, reps: best.reps, oneRM: parseFloat(best.oneRM.toFixed(2)) },
      1.0, { novo: true, fonte: 'srv' })];
  };

  R.projecaoEvolucao = function(entity) {
    if (entity.type !== 'PR') return [];
    var v      = entity.value;
    var proximo = parseFloat((v.oneRM * 1.025).toFixed(2));
    return [new KE('Recomendacao',
      v.exercicio + ': próximo alvo ' + proximo + ' kg 1RM (+2,5%)',
      entity.confidence * 0.75,
      { tipo: 'evolucao', exercicio: v.exercicio, oneRMAtual: v.oneRM, oneRMAlvo: proximo,
        sugestao: 'Tente ' + (v.peso + 2.5) + ' kg × ' + v.reps + ' reps na próxima sessão.' })];
  };

  R.kronosAdvise = function(entity) {
    if (entity.type !== 'FadigaScore') return [];
    var fadiga = entity.value;
    var acwr   = fadiga / 6.5;
    var zona, msg;
    if      (acwr < 0.8)  { zona = 'destreino'; msg = 'Volume abaixo do ideal. Aumente a frequência gradualmente.'; }
    else if (acwr <= 1.3) { zona = 'otimo';     msg = 'Zona ótima. Liberado para progressão de carga e quebra de PR.'; }
    else if (acwr <= 1.5) { zona = 'atencao';   msg = 'Fadiga acumulada. Mantenha cargas e reduza 1 série por exercício.'; }
    else                  { zona = 'perigo';    msg = 'Risco ortopédico. Treino regenerativo (RPE máx: 4).'; }
    return [new KE('Recomendacao', msg, entity.confidence * 0.80,
      { tipo: 'fadiga', zona: zona, fadigaScore: fadiga, acwrEstimado: parseFloat(acwr.toFixed(3)) })];
  };

  R.enrichExercicio = async function(entity) {
    if (entity.type !== 'Exercicio') return [];
    var nome = (entity.value.nome || '').trim();
    if (!nome) return [];

    // Circuit breaker: timeout de 6s na carga do índice
    var index;
    try {
      index = await Promise.race([
        loadExdb(),
        new Promise(function(_, reject) { setTimeout(function() { reject(new Error('Timeout exdb')); }, 6000); }),
      ]);
    } catch(e) {
      return [new KE('ExercicioInfo', { nome: nome, enriched: false }, 0.30, { matchType: 'timeout', fonte: 'github-exdb' })];
    }

    var key   = normKey(nome);
    var found = index.get(key);
    var matchType = 'exato', confMult = 0.95;

    if (!found) {
      for (var entry of index) {
        if (entry[0].includes(key) || key.includes(entry[0])) {
          found = entry[1]; matchType = 'parcial'; confMult = 0.75; break;
        }
      }
    }

    if (!found) {
      return [new KE('ExercicioInfo', { nome: nome, enriched: false }, 0.30,
        { matchType: 'nenhum', fonte: 'github-exdb' })];
    }

    var pm           = (found.primaryMuscles || [])[0] || '';
    var instructions = Array.isArray(found.instructions) ? found.instructions.join('\n') : (found.instructions || '');
    var imageUrl     = (found.images && found.images.length > 0) ? _EXDB_IMG + found.images[0] : '';

    return [new KE('ExercicioInfo', { nome: nome, nomeEn: found.name }, entity.confidence * confMult, {
      muscleGroup:      _MG[pm] || 'Geral',
      musclesPrimary:   found.primaryMuscles   || [],
      musclesSecondary: found.secondaryMuscles || [],
      equipment:        found.equipment || '',
      level:            found.level     || '',
      mechanic:         found.mechanic  || '',
      force:            found.force     || '',
      instructions:     instructions,
      imageUrl:         imageUrl,
      matchType:        matchType,
      fonte:            'github-exdb',
    })];
  };

  R.sugerirVariacoes = function(entity) {
    if (entity.type !== 'ExercicioInfo') return [];
    var nome = entity.value.nome;
    var p    = entity.props;
    var conf = entity.confidence * 0.85;
    var recs = [];
    if (p.level === 'beginner') recs.push(new KE('Recomendacao', nome + ': iniciante — domine a técnica antes de progredir em carga.', conf, { tipo: 'progressao', nivel: p.level, muscleGroup: p.muscleGroup }));
    else if (p.level === 'expert') recs.push(new KE('Recomendacao', nome + ': avançado — pré-requisito: domínio das variações intermediárias.', conf, { tipo: 'progressao', nivel: p.level, muscleGroup: p.muscleGroup }));
    if (p.mechanic === 'compound') recs.push(new KE('Recomendacao', nome + ': movimento composto — execute primeiro no treino, quando o SNC está descansado.', conf, { tipo: 'ordem_treino', mecanica: p.mechanic }));
    if (p.force === 'pull' || p.force === 'push') recs.push(new KE('Recomendacao', nome + ' (' + (p.force === 'pull' ? 'puxada' : 'empurrada') + ') — equilibre com movimentos ' + (p.force === 'pull' ? 'de empurrada' : 'de puxada') + ' no bloco semanal.', conf, { tipo: 'equilibrio_push_pull', force: p.force }));
    if (!recs.length) recs.push(new KE('Recomendacao', nome + ' — ' + p.muscleGroup + ': foco na contração muscular e controle excêntrico.', conf * 0.80, { tipo: 'tecnica', muscleGroup: p.muscleGroup }));
    return recs;
  };

  R.detectDesequilibrio = function(entities) {
    var infos = entities.filter(function(e) { return e.type === 'ExercicioInfo' && e.props.enriched !== false; });
    if (infos.length < 2) return [];
    var byGroup = {}, byForce = { push: 0, pull: 0 }, total = infos.length;
    infos.forEach(function(e) {
      var g = e.props.muscleGroup || 'Geral';
      byGroup[g] = (byGroup[g] || 0) + 1;
      if (e.props.force === 'push') byForce.push++;
      else if (e.props.force === 'pull') byForce.pull++;
    });
    var avgConf = infos.reduce(function(s, e) { return s + e.confidence; }, 0) / total;
    var recs = [];
    if (byForce.push > 0 && byForce.pull > 0) {
      var ratio = byForce.push / byForce.pull;
      if (ratio > 1.8) recs.push(new KE('Recomendacao', 'Desequilíbrio push/pull: ' + byForce.push + ' empurradas vs ' + byForce.pull + ' puxadas. Adicione remadas e puxadas.', avgConf * 0.88, { tipo: 'desequilibrio', subtipo: 'push_pull', ratio: parseFloat(ratio.toFixed(2)) }));
      else if (ratio < 0.55) recs.push(new KE('Recomendacao', 'Desequilíbrio push/pull: ' + byForce.pull + ' puxadas vs ' + byForce.push + ' empurradas. Adicione supinos e desenvolvimentos.', avgConf * 0.88, { tipo: 'desequilibrio', subtipo: 'push_pull', ratio: parseFloat(ratio.toFixed(2)) }));
    }
    var sorted = Object.entries(byGroup).sort(function(a, b) { return b[1] - a[1]; });
    if (sorted.length && sorted[0][1] / total > 0.40) recs.push(new KE('Recomendacao', 'Concentração excessiva em ' + sorted[0][0] + ': ' + sorted[0][1] + '/' + total + ' exercícios (' + Math.round(sorted[0][1] / total * 100) + '%). Diversifique.', avgConf * 0.85, { tipo: 'desequilibrio', subtipo: 'grupo_dominante', grupo: sorted[0][0] }));
    var CHAVE = ['Costas', 'Peito', 'Ombros', 'Abdômen/Lombar', 'Quadríceps/Isquiotibiais', 'Glúteos'];
    var ausentes = CHAVE.filter(function(g) { return !byGroup[g]; });
    if (ausentes.length) recs.push(new KE('Recomendacao', 'Grupos não trabalhados: ' + ausentes.join(', ') + '. Inclua no plano semanal.', avgConf * 0.80, { tipo: 'desequilibrio', subtipo: 'grupo_ausente', grupos: ausentes }));
    if (!recs.length) recs.push(new KE('Recomendacao', 'Distribuição equilibrada: ' + Object.keys(byGroup).length + ' grupos em ' + total + ' exercícios. Continue assim.', avgConf * 0.90, { tipo: 'equilibrio', distribuicao: byGroup }));
    return recs;
  };

  /* ── MACHINES ── */
  var MACHINES = {
    'kronia.full_analysis': {
      id: 'kronia.full_analysis', displayName: 'Análise Completa do Atleta',
      description: 'Expande treinos, calcula fadiga em paralelo e gera recomendações.',
      inputType: 'Usuario', maxEntities: 255,
      steps: [
        { id: 'step_1_coleta',  type: 'parallel',   transforms: ['expandTreinos', 'calcFadiga'] },
        { id: 'step_2_filter',  type: 'filter',     entityType: 'FadigaScore' },
        { id: 'step_3_advise',  type: 'sequential', transforms: ['kronosAdvise'], maxEntities: 1 },
      ],
    },
    'kronia.pr_hunter': {
      id: 'kronia.pr_hunter', displayName: 'Caçador de PRs',
      description: 'Detecta Personal Records e projeta evolução de carga.',
      inputType: 'Usuario', maxEntities: 56,
      steps: [
        { id: 'step_1_treinos',    type: 'sequential', transforms: ['expandTreinos'],    maxEntities: 20 },
        { id: 'step_2_exercicios', type: 'sequential', transforms: ['expandExercicios'] },
        { id: 'step_3_pr',         type: 'sequential', transforms: ['detectPR'] },
        { id: 'step_4_projecao',   type: 'sequential', transforms: ['projecaoEvolucao'] },
      ],
    },
    'kronia.overtraining_watch': {
      id: 'kronia.overtraining_watch', displayName: 'Vigilante de Overtraining',
      description: 'Extrai RPE dos treinos, computa fadiga e emite alerta de risco.',
      inputType: 'Usuario', maxEntities: 12,
      steps: [
        { id: 'step_1_treinos', type: 'sequential', transforms: ['expandTreinos'], maxEntities: 10 },
        { id: 'step_2_rpe',     type: 'sequential', transforms: ['extractRPE'] },
        { id: 'step_3_fadiga',  type: 'sequential', transforms: ['computeFadiga'] },
        { id: 'step_4_filter',  type: 'filter',     entityType: 'FadigaScore' },
        { id: 'step_5_advise',  type: 'sequential', transforms: ['kronosAdvise'], maxEntities: 1 },
      ],
    },
    'kronia.exercise_intel': {
      id: 'kronia.exercise_intel', displayName: 'Inteligência de Exercício',
      description: 'Enriquece exercícios com dados externos e gera recomendações por nível e mecânica.',
      inputType: 'Usuario', maxEntities: 48,
      steps: [
        { id: 'step_1_treinos',    type: 'sequential', transforms: ['expandTreinos'],    maxEntities: 5 },
        { id: 'step_2_exercicios', type: 'sequential', transforms: ['expandExercicios'] },
        { id: 'step_3_enrich',     type: 'sequential', transforms: ['enrichExercicio'] },
        { id: 'step_4_sugestoes',  type: 'sequential', transforms: ['sugerirVariacoes'] },
      ],
    },
    'kronia.muscle_balance': {
      id: 'kronia.muscle_balance', displayName: 'Radar de Desequilíbrio Muscular',
      description: 'Detecta desequilíbrios push/pull, grupos dominantes e músculos ausentes.',
      inputType: 'Usuario', maxEntities: 12,
      steps: [
        { id: 'step_1_treinos',    type: 'sequential', transforms: ['expandTreinos'],    maxEntities: 10 },
        { id: 'step_2_exercicios', type: 'sequential', transforms: ['expandExercicios'] },
        { id: 'step_3_enrich',     type: 'sequential', transforms: ['enrichExercicio'] },
        { id: 'step_4_radar',      type: 'aggregate',  transform:  'detectDesequilibrio' },
      ],
    },
  };

  /* ── STEP EXECUTOR ── */
  async function execStep(step, workingSet, logger) {
    logger('[step:' + step.id + '] tipo=' + step.type + ' entrada=' + workingSet.length);

    if (step.type === 'filter') {
      var filtered = workingSet.filter(function(e) { return e.type === step.entityType; });
      logger('[step:' + step.id + '] filtro "' + step.entityType + '" → ' + filtered.length);
      return filtered;
    }

    if (step.type === 'sequential' || step.type === 'parallel') {
      var transforms = step.transforms || [];
      var allResults = [];
      var currentSet = step.type === 'sequential' ? workingSet.slice() : workingSet;

      for (var ti = 0; ti < transforms.length; ti++) {
        var tName = transforms[ti];
        var fn    = R[tName];
        if (!fn) { logger('[warn] transform "' + tName + '" não encontrado'); continue; }

        var iterSet = step.type === 'sequential' ? (allResults.length ? dedup(allResults) : currentSet) : currentSet;
        if (step.type === 'sequential') allResults = [];

        for (var ei = 0; ei < iterSet.length; ei++) {
          try {
            var res = await fn(iterSet[ei], step.config || {});
            if (res) allResults = allResults.concat(res);
          } catch(e) { logger('[error] ' + tName + '(' + iterSet[ei].type + ') → ' + e.message); }
        }
        logger('[step:' + step.id + '] ' + tName + '() → ' + dedup(allResults).length + ' entidades');
      }

      return topN(dedup(allResults), step.maxEntities);
    }

    if (step.type === 'aggregate') {
      var fn = R[step.transform];
      if (!fn) { logger('[warn] aggregate "' + step.transform + '" não encontrado'); return workingSet; }
      try {
        var res = await fn(workingSet, step.config || {});
        var merged = dedup(res || []);
        logger('[step:' + step.id + '] aggregate "' + step.transform + '" → ' + merged.length + ' entidades');
        return topN(merged, step.maxEntities);
      } catch(e) { logger('[error] aggregate "' + step.transform + '" → ' + e.message); return []; }
    }

    logger('[warn] tipo de step desconhecido: "' + step.type + '"');
    return workingSet;
  }

  /* ── MACHINE RUNNER ── */
  async function run(machineId, userId) {
    var machine = MACHINES[machineId];
    if (!machine) throw new Error('Machine "' + machineId + '" não encontrada. Disponíveis: ' + Object.keys(MACHINES).join(', '));

    var messages = [];
    function logger(msg) {
      messages.push({
        level: msg.startsWith('[error]') ? 'error' : msg.startsWith('[warn]') ? 'warn' : 'info',
        text:  msg,
        ts:    Date.now(),
      });
    }

    logger('▶ Iniciando: ' + machine.displayName);
    logger('   Fonte: Supabase workout_history (' + (workoutHistory || []).length + ' sessões)');

    var input = new KE('Usuario', userId, 1.0);
    if (input.type !== machine.inputType) {
      logger('[error] Tipo de entrada incompatível');
      return { entities: [], messages: messages, machine: machine };
    }

    var workingSet = [input];
    for (var i = 0; i < machine.steps.length; i++) {
      workingSet = await execStep(machine.steps[i], workingSet, logger);
      if (!workingSet.length) {
        logger('[warn] Working set vazio após "' + machine.steps[i].id + '" — pipeline abortado.');
        break;
      }
    }

    var finalSet = topN(workingSet, machine.maxEntities);
    logger('■ Concluído: ' + finalSet.length + ' entidade(s) de saída');
    return { entities: finalSet, messages: messages, machine: machine };
  }

  return { run: run, machines: MACHINES };
}

// ── Handler HTTP ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Use POST' }); return; }

  // Autenticação
  var authHeader = req.headers['authorization'] || '';
  var token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) { res.status(401).json({ error: 'Autenticação necessária' }); return; }

  var user = await new Promise(function(resolve) {
    auth.verifyToken(token, function(err, u) { resolve(err ? null : u); });
  });
  if (!user) { res.status(401).json({ error: 'Token inválido ou expirado' }); return; }

  // Valida body
  var body      = req.body || {};
  var machineId = (body.machineId || '').trim();
  if (!machineId) { res.status(400).json({ error: 'machineId é obrigatório' }); return; }

  // Busca histórico do usuário no Supabase
  var workoutHistory = [];
  try {
    var rows = await supaGET(
      '/workout_history?user_id=eq.' + user.id +
      '&order=trained_at.desc&limit=80' +
      '&select=id,session_data,trained_at',
      token
    );
    if (Array.isArray(rows)) workoutHistory = rows;
  } catch(e) {
    // Falha silenciosa — roda com histórico vazio (sem dados = recomendações vazias)
  }

  // Executa a machine
  try {
    var engine = createEngine(workoutHistory);
    var result = await engine.run(machineId, user.id);
    res.status(200).json(result);
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
};
