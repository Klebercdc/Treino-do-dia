/* ═══════════════════════════════════════════════════
   TRANSFORM KERNEL — inspirado no Maltego
   Cada mensagem é uma entidade. Cada Transform detecta
   intenção com pontuação ponderada e roteia para a ação
   mais relevante no contexto correto.

   Pesos: forte=3pts · medio=2pts · fraco=1pt
   Threshold mínimo para exibir botão: 2pts
   v2.0 — normalização de acentos + keywords expandidas
═══════════════════════════════════════════════════ */

/* ── Normaliza texto: remove acentos + lowercase ── */
function _normalizeText(str) {
  return (str || '').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const TRANSFORMS = [

/* ── 1. GERAR TREINO ────────────────────────────── */
{
  id: 'gerar_treino',
  score: {
    forte: [
      'gerar treino','montar treino','criar treino','quero um treino',
      'preciso de treino','novo treino','treino pra mim','me da um treino',
      'faz um treino','elabora um treino','quero treinar','fazer treino',
      'me passa um treino','montar um treino','cria um treino','preciso treinar',
      'treino para hoje','treino de hoje','fazer musculacao','treino para iniciante',
      'treino para ganhar massa','treino para emagrecer','treino para perder peso',
      'treino para hipertrofia','montar meu treino','criar meu treino',
      'quero comecar a treinar','quero comecar treinar','me monta um treino',
      'me cria um treino','treino de pernas','treino de peito','treino de costas',
      'treino de ombro','treino de braco','treino de bracos','treino completo',
      'treino fullbody','treino upper lower'
    ],
    medio: [
      'treino personalizado','programa de treino','plano de treino',
      'rotina de treino','rotina de musculacao','exercicios para',
      'exercicios de pernas','exercicios de peito','exercicios de costas',
      'exercicios de ombro','exercicios de biceps','exercicios de triceps'
    ],
    fraco: ['treino','rotina','programa','musculacao','academia']
  },
  action: function() {
    try { closeOrientacao(); } catch(e) {}
    try { iniciarFluxoGeradorTreino(); } catch(e) { navTo('treino'); }
  },
  botao: { label: 'Criar Treino', icon: 'dumbbell', cor: 'accent' }
},

/* ── 2. NAVEGAR PARA TREINO ─────────────────────── */
{
  id: 'treino',
  score: {
    forte: [
      'supino','agachamento','leg press','rosca direta','terra','levantamento terra',
      'barra fixa','crucifixo','desenvolvimento','remada','pulldown','cadeira extensora',
      'pernas','peito','costas','ombro','biceps','triceps','abdomen','gluteo',
      'panturrilha','quadriceps','isquiotibiais','deltoides','trapezio',
      'stiff','hack squat','smith','afundo','bulgarian','rdl','good morning',
      'extensao de quadril','extensao de joelho'
    ],
    medio: [
      'exercicio','musculacao','serie','repeticao','carga','academia','halter','barra',
      'exercicios compostos','exercicios isolados','amplitude','contração','tensao',
      'tempo sob tensao','falha muscular','carga progressiva'
    ],
    fraco: ['treino','malhar','malhacao','ginastica','peso','levantar']
  },
  action: function() {
    try { closeOrientacao(); } catch(e) {}
    navTo('treino');
    try { closeHome(); } catch(e) {}
  },
  botao: { label: 'Ir para Treino', icon: 'dumbbell', cor: 'accent' }
},

/* ── 3. CALCULADORA BASAL / TDEE ────────────────── */
{
  id: 'basal',
  score: {
    forte: [
      'tmb','tdee','taxa metabolica','gasto calorico total','metabolismo basal',
      'calorias de manutencao','gasto energetico','quantas calorias preciso',
      'quantas calorias devo comer','quanto devo comer','meu gasto calorico',
      'calcular calorias','calculo de calorias','calorias para emagrecer',
      'calorias para ganhar massa','deficit calorico','superavit calorico',
      'quantas kcal'
    ],
    medio: [
      'metabolismo','gasto calorico','basal','mifflin','quantas calorias',
      'gasto diario','manutencao calorica','meta calorica','necessidade calorica'
    ],
    fraco: ['kcal','caloria','calorias','metabolismo']
  },
  action: function() { openBasalSheet(); },
  botao: { label: 'Calculadora Basal', icon: 'flame', cor: 'accent' }
},

/* ── 4. CRIAR DIETA ─────────────────────────────── */
{
  id: 'dieta',
  score: {
    forte: [
      'gerar dieta','criar dieta','montar dieta','quero uma dieta','preciso de dieta',
      'minha dieta','cardapio personalizado','fazer dieta','meu cardapio',
      'emagrecer','quero emagrecer','perder peso','quero perder peso','quero secar',
      'ganhar massa','quero ganhar massa','aumentar massa','quero engordar',
      'como me alimentar','o que devo comer','minha alimentacao',
      'plano alimentar','dieta para hipertrofia','dieta para emagrecimento',
      'cardapio saudavel','dieta balanceada','alimentacao saudavel',
      'refeicoes do dia','o que comer no dia'
    ],
    medio: [
      'alimentacao','nutricao','refeicao','o que comer','como comer',
      'dieta para','comida','alimento','proteina','bulking','cutting',
      'deficit','superavit','comer para','macro','macros',
      'cafe da manha','almoco','janta','lanche','pos treino alimentar'
    ],
    fraco: [
      'dieta','carboidrato','gordura','proteina','refeicao',
      'comer','alimento','comida'
    ]
  },
  action: function(cid) {
    if (cid === 'orientExpertMessages') {
      try { iniciarFluxoDietaNutri(); } catch(e) { try { openDietaSheet(); } catch(e2) {} }
    } else {
      try { openOrientacao(); } catch(e) {}
      setTimeout(function() {
        try { iniciarFluxoDietaNutri(); } catch(e) { try { openDietaSheet(); } catch(e2) {} }
      }, 500);
    }
  },
  botao: { label: 'Criar Dieta', icon: 'utensils', cor: 'green' }
},

/* ── 5. SUPLEMENTOS ─────────────────────────────── */
{
  id: 'suplementos',
  score: {
    forte: [
      'creatina','whey protein','whey','bcaa','pre-treino','proteina em po',
      'hipercalorico','albumina','caseina','termogenico',
      'qual suplemento','quais suplementos','devo tomar suplemento',
      'suplemento para ganhar massa','suplemento para emagrecer',
      'tomar proteina','proteina pos treino','creatina funciona','whey funciona',
      'monohidrato','cafeina para treino','beta alanina funciona'
    ],
    medio: [
      'suplemento','suplementacao','vitamina d','omega 3','beta alanina',
      'citrulina','cafeina','glutamina','proteina','pos treino',
      'pre treino','suplemento esportivo','suplemento fitness'
    ],
    fraco: ['vitamina','mineral','zinco','magnesio','omega','suplemento']
  },
  action: function(cid) {
    var msg = 'Quais suplementos têm evidência científica real e realmente valem a pena para meus objetivos?';
    if (cid === 'orientExpertMessages') {
      var inp = document.getElementById('orientExpertInput');
      if (inp) { inp.value = msg; sendOrientExpert(); }
    } else {
      try { openOrientacao(); setTimeout(function() {
        var inp = document.getElementById('orientExpertInput');
        if (inp) { inp.value = msg; sendOrientExpert(); }
      }, 400); } catch(e) {}
    }
  },
  botao: { label: 'Suplementos com Evidência', icon: 'zap', cor: 'blue' }
},

/* ── 6. EVOLUÇÃO / PROGRESSO ────────────────────── */
{
  id: 'evolucao',
  score: {
    forte: [
      'ver evolucao','meu progresso','meu pr','meu recorde','1rm estimado',
      'quanto evolui','quanto progredi','ver meu progresso','minha evolucao',
      'como evolui','quero ver meu pr','meus recordes','minha forca',
      'estou evoluindo','quero ver minha evolucao','meu historico de pr',
      'minha performance','ver grafico','meu 1rm'
    ],
    medio: [
      'evolucao','progresso','grafico de treino','1rm','pr',
      'meu desempenho','comparar','antes e depois','minha forca atual',
      'carga atual','evolucao de carga','quanto to carregando'
    ],
    fraco: [
      'recorde','melhora','cresci','fiquei mais forte','evoluir',
      'melhorar','crescer','ficar forte','forca'
    ]
  },
  action: function() { showEvoChart(); },
  botao: { label: 'Ver Evolução', icon: 'bar-chart-3', cor: 'blue' }
},

/* ── 7. HISTÓRICO ───────────────────────────────── */
{
  id: 'historico',
  score: {
    forte: [
      'historico de treinos','sessoes anteriores','ultimos treinos',
      'ver meus treinos','meus treinos passados','ver meus treinos anteriores',
      'o que eu treinei','minhas sessoes','log de treino','diario de treino',
      'registro de treino','ver o que fiz','treinos da semana','semana passada treinei'
    ],
    medio: [
      'historico','treinos anteriores','sessoes de treino',
      'passado','sessoes','registro','ultimo treino','ontem treinei'
    ],
    fraco: [
      'ver treinos','ontem','semana passada','ultimo treino','antes'
    ]
  },
  action: function() { verHistorico(); },
  botao: { label: 'Ver Histórico', icon: 'list', cor: 'blue' }
},

/* ── 8. MESOCICLO / PERIODIZAÇÃO ────────────────── */
{
  id: 'mesociclo',
  score: {
    forte: [
      'mesociclo','periodizacao','deload','bloco de treino',
      'semanas de treino','periodizar','estruturar treino',
      'planejar treino','planejamento de treino','estruturar meu treino',
      'proximo ciclo','periodizar meus treinos','programa de 12 semanas',
      'programa de 8 semanas','planilha de treino','plano de treinamento',
      'fase de ganho','fase de definicao','ciclo de treino completo'
    ],
    medio: [
      'bloco','ondulacao','linear','ciclo de treino',
      'progressao','longo prazo','meses de treino','macrociclo',
      'semanas de programa','ciclos de treino'
    ],
    fraco: ['semanas','planejamento','planejar','organizar','estruturar','ciclo']
  },
  action: function() { abrirMesociclo(); },
  botao: { label: 'Gerar Mesociclo', icon: 'calendar', cor: 'purple' }
},

/* ── 9. RECUPERAÇÃO ─────────────────────────────── */
{
  id: 'recuperacao',
  score: {
    forte: [
      'dor muscular','musculo doendo','dor no musculo','lesao','me machuquei',
      'overtraining','sobretreinamento','muito cansado para treinar',
      'estou com dor','dor nas costas','dor no joelho','dor no ombro',
      'muito cansado','esgotado','sem energia para treinar','corpo destruido',
      'nao consigo treinar','me recuperar mais rapido',
      'musculo inflamado','inflamacao muscular','tendinite','tendinite',
      'dor aguda','dor forte','dor intensa'
    ],
    medio: [
      'recuperacao muscular','doms','descanso ativo','fadiga muscular',
      'recuperar mais rapido','sono','dormir','descanso','descansar',
      'inflamacao','alongamento','massagem','fisioterapia','gelo no musculo',
      'compressao','anti-inflamatorio','ibuprofeno muscular'
    ],
    fraco: [
      'cansado','fatigado','exausto','dolorido','dor','cansaco',
      'doendo','machucado','lesao','descanso','descansar','dormindo'
    ]
  },
  action: function(cid) {
    try { showToast('Ouça seu corpo. Em caso de dor aguda, consulte um profissional de saúde.', 'info', 5000); } catch(e) {}
    var msg = 'Estou sentindo dor muscular e cansaço. O que fazer para acelerar minha recuperação e quando voltar a treinar?';
    if (cid === 'orientExpertMessages') {
      var inp = document.getElementById('orientExpertInput');
      if (inp) { inp.value = msg; sendOrientExpert(); }
    } else {
      try { openOrientacao(); setTimeout(function() {
        var inp = document.getElementById('orientExpertInput');
        if (inp) { inp.value = msg; sendOrientExpert(); }
      }, 400); } catch(e) {}
    }
  },
  botao: { label: 'Dicas de Recuperação', icon: 'heart', cor: 'blue' }
},

/* ── 10. RESPIRAÇÃO / RELAXAMENTO ───────────────── */
{
  id: 'respiracao',
  score: {
    forte: [
      'exercicio de respiracao','respiracao guiada','relaxamento','ansiedade',
      'estresse','cool-down','meditacao','ansioso','muito estressado',
      'preciso relaxar','tecnica de respiracao','respirar fundo',
      'controle de ansiedade','exercicio de relaxamento','exercicio respiratorio',
      'tenho ansiedade','ataque de panico','panico','hiperventilando'
    ],
    medio: [
      'respirar','calma','tensao','nervoso','agitado',
      'estressado','stress','nervosismo','panico','calmar',
      'acalmar','meditacao','mindfulness','relaxar','desestressar'
    ],
    fraco: ['respirar','calma','relaxar','estresse','ansioso','nervoso']
  },
  action: function() { abrirRespiracao(); },
  botao: { label: 'Respiração Guiada', icon: 'wind', cor: 'blue' }
},

/* ── 11. PLANO PRO ──────────────────────────────── */
{
  id: 'plano',
  score: {
    forte: [
      'assinar pro','upgrade pro','virar pro','plano pro','quero o pro',
      'consultas esgotadas','limite de mensagens','sem consultas',
      'quero assinar','assinar o pro','plano pago','versao paga',
      'funcionalidades pro','recursos pro','desbloquear','sem limite de mensagens',
      'acabou minhas mensagens','esgotei','consultas acabaram',
      'mensagens acabaram','quero mais mensagens','quero mais consultas'
    ],
    medio: [
      'plano premium','premium','sem limite','plano pago',
      'sem acesso','bloqueado','tier','versao pro'
    ],
    fraco: ['assinar','pro','premium','upgrade','pago','limite','mensagens']
  },
  action: function() {
    try { closeOrientacao(); } catch(e) {}
    openPricingScreen();
  },
  botao: { label: 'Ver Planos PRO', icon: 'zap', cor: 'accent' }
},

];

/* ═══════════════════════════════════════════════════
   TRANSFORMS DEFENSIVOS — proteção e segurança
   Rodam ANTES do envio e podem bloquear ou avisar.
═══════════════════════════════════════════════════ */
const DEFENSIVE_TRANSFORMS = [
{
  id: 'paywall_bypass',
  detect: function(txt) { return /sem pagar|hack|burlar|contornar|bypass/i.test(txt); },
  blocks: [],
  action: function() { /* silencioso */ }
},
{
  id: 'injury_alert',
  detect: function(txt) {
    return /dor\s+(aguda|forte|intensa|persistente)|lesao|lesionado|me machuquei|torci|quebrei|fraturei/i.test(
      _normalizeText(txt)
    );
  },
  blocks: ['treino', 'gerar_treino', 'mesociclo'],
  action: function() {
    try { showToast('Em caso de dor aguda ou lesão, consulte um médico ou fisioterapeuta antes de continuar treinando.', 'info', 6000); } catch(e) {}
  }
},
{
  id: 'rate_guard',
  detect: function(txt, history) {
    if (!history || history.length < 5) return false;
    var last5 = history.slice(-5).filter(function(m) { return m.role === 'user'; });
    var clean = _normalizeText(txt).replace(/\s+/g, ' ').trim().slice(0, 20);
    return last5.filter(function(m) {
      return _normalizeText(m.content).replace(/\s+/g, ' ').trim().slice(0, 20) === clean;
    }).length >= 3;
  },
  blocks: [],
  action: function() {
    try { showToast('Já respondi isso recentemente! Role para cima para ver a resposta.', 'info', 4000); } catch(e) {}
  }
}
];

/* ═══════════════════════════════════════════════════
   MOTOR DE PONTUAÇÃO
   Usa normalização de acentos para matching robusto.
═══════════════════════════════════════════════════ */
function _scoreTransform(transform, texto) {
  var score = 0;
  var s = transform.score;
  if (!s) return 0;
  var norm = _normalizeText(texto);
  (s.forte || []).forEach(function(k) { if (norm.includes(_normalizeText(k))) score += 3; });
  (s.medio || []).forEach(function(k) { if (norm.includes(_normalizeText(k))) score += 2; });
  (s.fraco || []).forEach(function(k) {
    // fraco: match apenas palavras completas para evitar falsos positivos
    var kn = _normalizeText(k);
    var re = new RegExp('(?:^|\\s|[^a-z])' + kn.replace(/[-]/g, '[-]') + '(?=$|\\s|[^a-z])', 'i');
    if (re.test(norm)) score += 1;
  });
  return score;
}

/**
 * Boost contextual — lê histórico e config para aumentar relevância
 */
function _contextBoost(transformId) {
  var boost = 0;
  try {
    var hist = JSON.parse(localStorage.getItem('kronia_history_v2') || '[]');
    var cfg  = JSON.parse(localStorage.getItem('kronia_config')     || '{}');
    var last = hist.length ? hist[0] : null;
    var horasDesdeUltimo = last
      ? (Date.now() - new Date(last.createdAt).getTime()) / 3600000
      : 999;
    var draft = JSON.parse(localStorage.getItem('kronia_draft_v2') || 'null');
    var temPrograma = draft && (draft.sections || []).length > 0;

    if (transformId === 'recuperacao') {
      if (horasDesdeUltimo < 24) boost += 2;
      if (hist.length >= 5) boost += 1;
    }
    if (transformId === 'evolucao') {
      if (hist.length >= 3) boost += 2;
    }
    if (transformId === 'gerar_treino') {
      if (!temPrograma) boost += 2;
    }
    if (transformId === 'dieta') {
      if (cfg.peso && cfg.objetivo) boost += 1;
    }
    if (transformId === 'mesociclo') {
      if (hist.length < 8) boost -= 2;
    }
    if (transformId === 'historico') {
      if (hist.length < 1) boost -= 3; // sem histórico = botão inútil
    }
    if (transformId === 'evolucao') {
      if (hist.length < 1) boost -= 3;
    }
  } catch(e) {}
  return boost;
}

/**
 * Roda os Transforms após cada resposta do KRONOS.
 *
 * — Mensagem do usuário tem peso 2x (intenção > contexto)
 * — Boost contextual baseado em histórico e perfil real
 * — Mostra até 2 botões quando há intenção dupla explícita
 * — Threshold: score >= 2 (era > 2, agora mais sensível)
 * — Sem bloqueio permanente de sessão (mostra se relevante)
 */
function runTransforms(userMessage, botResponse, containerId, blockedIds) {
  var textoUser = (userMessage || '');
  var textoBot  = (botResponse  || '');
  var bloqueados = blockedIds || [];
  var THRESHOLD  = 2; // >= THRESHOLD para mostrar
  var scored = [];

  for (var i = 0; i < TRANSFORMS.length; i++) {
    var t = TRANSFORMS[i];
    if (bloqueados.indexOf(t.id) >= 0) continue;

    var userSc = _scoreTransform(t, textoUser);
    var botSc  = _scoreTransform(t, textoBot);
    var sc = userSc * 2 + botSc + _contextBoost(t.id);

    if (sc >= THRESHOLD) scored.push({ t: t, sc: sc, userSc: userSc });
  }

  if (!scored.length) return;

  scored.sort(function(a, b) { return b.sc - a.sc; });

  // Mostra o melhor + segundo se ambos têm intenção explícita do usuário
  var toShow = [scored[0]];
  if (scored.length >= 2 && scored[1].userSc > 0 && scored[1].sc >= scored[0].sc * 0.65) {
    toShow.push(scored[1]);
  }

  // Limpa wraps anteriores uma vez antes de renderizar
  _clearTransformWraps(containerId);
  toShow.forEach(function(item) { renderTransformButton(item.t, containerId); });
}

/**
 * Remove todos os botões transform anteriores do container.
 */
function _clearTransformWraps(containerId) {
  var container = document.getElementById(containerId || 'orientExpertMessages');
  if (!container) return;
  var wraps = container.querySelectorAll('.transform-wrap');
  wraps.forEach(function(w) { w.remove(); });
}

/**
 * Roda Defensive Transforms antes de enviar mensagem.
 */
function runDefensiveTransforms(userMessage, history) {
  var blockedIds = [];
  for (var i = 0; i < DEFENSIVE_TRANSFORMS.length; i++) {
    var dt = DEFENSIVE_TRANSFORMS[i];
    if (dt.detect(userMessage, history)) {
      dt.action();
      if (dt.blocks) {
        dt.blocks.forEach(function(id) {
          if (blockedIds.indexOf(id) < 0) blockedIds.push(id);
        });
      }
      if (dt.id === 'rate_guard') return 'block';
    }
  }
  return blockedIds;
}

/**
 * Renderiza botão de ação Transform no container do chat.
 * Não remove wraps anteriores — _clearTransformWraps faz isso antes.
 */
function renderTransformButton(transform, containerId) {
  var container = document.getElementById(containerId || 'orientExpertMessages');
  if (!container) return;

  var colorMap = {
    accent: { css: 'var(--accent)',          rgba: '249,115,22'  },
    green:  { css: 'var(--green,#22c55e)',   rgba: '34,197,94'   },
    blue:   { css: 'var(--blue,#3b82f6)',    rgba: '59,130,246'  },
    purple: { css: 'var(--purple,#a855f7)',  rgba: '168,85,247'  },
  };
  var c = colorMap[transform.botao.cor] || colorMap.accent;

  var btn = document.createElement('button');
  btn.className = 'transform-btn';
  btn.style.cssText = 'display:block;width:100%;padding:12px 16px;' +
    'background:rgba(' + c.rgba + ',0.12);border:1.5px solid ' + c.css + ';' +
    'border-radius:12px;color:' + c.css + ';font-family:var(--font);' +
    'font-size:0.88rem;font-weight:700;cursor:pointer;text-align:left;' +
    'transition:all .15s;animation:fadeInUp .3s ease;';
  btn.innerHTML = _ico(transform.botao.icon || 'zap', 14) + ' ' + transform.botao.label;

  btn.addEventListener('touchstart', function() {
    btn.style.background = c.css;
    btn.style.color = '#fff';
  }, { passive: true });
  btn.addEventListener('touchend', function() {
    setTimeout(function() {
      btn.style.background = 'rgba(' + c.rgba + ',0.12)';
      btn.style.color = c.css;
    }, 150);
  }, { passive: true });

  var wrap = document.createElement('div');
  wrap.className = 'ai-msg assistant transform-wrap';
  wrap.style.paddingLeft = containerId === 'orientExpertMessages' ? '0' : '38px';
  wrap.appendChild(btn);

  btn.onclick = function() {
    try { transform.action(containerId); } catch(e) { console.warn('[Transform] action error:', e); }
    wrap.remove();
  };

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}
