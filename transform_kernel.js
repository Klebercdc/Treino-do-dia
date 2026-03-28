/* ═══════════════════════════════════════════════════
   TRANSFORM KERNEL — inspirado no Maltego
   Cada mensagem é uma entidade. Cada Transform detecta
   intenção com pontuação ponderada e roteia para a ação
   mais relevante no contexto correto.

   Pesos: forte=3pts · medio=2pts · fraco=1pt
   Threshold mínimo para exibir botão: 2pts
═══════════════════════════════════════════════════ */

const TRANSFORMS = [

/* ── 1. GERAR TREINO ────────────────────────────── */
{
  id: 'gerar_treino',
  score: {
    forte: ['gerar treino','montar treino','criar treino','quero um treino',
            'preciso de treino','novo treino','treino pra mim','me dá um treino',
            'faz um treino','elabora um treino'],
    medio: ['treino personalizado','programa de treino','plano de treino'],
    fraco: []
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
    forte: ['supino','agachamento','leg press','rosca direta','terra','levantamento terra',
            'barra fixa','crucifixo','desenvolvimento','remada','pulldown','cadeira extensora'],
    medio: ['exercício','musculação','série','repetição','carga','academia','halter','barra'],
    fraco: ['malhar','malhação','ginástica']
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
    forte: ['tmb','tdee','taxa metabólica','gasto calórico total','metabolismo basal',
            'calorias de manutenção','gasto energético'],
    medio: ['metabolismo','gasto calórico','basal','mifflin'],
    fraco: ['kcal','caloria','calorias']
  },
  action: function() { openBasalSheet(); },
  botao: { label: 'Calculadora Basal', icon: 'flame', cor: 'accent' }
},

/* ── 4. CRIAR DIETA ─────────────────────────────── */
{
  id: 'dieta',
  score: {
    forte: ['gerar dieta','criar dieta','montar dieta','quero uma dieta','preciso de dieta',
            'minha dieta','cardápio personalizado','fazer dieta','meu cardápio'],
    medio: ['alimentação','nutrição','refeição','o que comer','o que devo comer',
            'dieta para','como comer','plano alimentar'],
    fraco: ['dieta','carboidrato','gordura','macros']
  },
  action: function(cid) {
    if (cid === 'orientExpertMessages') {
      // Já está na tela de orientação — chama diretamente
      try { iniciarFluxoDietaNutri(); } catch(e) { try { openDietaSheet(); } catch(e2) {} }
    } else {
      // Abre a orientação primeiro, depois inicia o fluxo de dieta
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
    forte: ['creatina','whey protein','whey','bcaa','pré-treino','proteína em pó',
            'hipercalórico','albumina','caseína','termogênico'],
    medio: ['suplemento','suplementação','vitamina d','ômega 3','beta alanina',
            'citrulina','cafeína','glutamina'],
    fraco: ['vitamina','mineral','zinco','magnésio']
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
    forte: ['ver evolução','meu progresso','meu pr','meu recorde','1rm estimado',
            'quanto evoluí','quanto progredi'],
    medio: ['evolução','progresso','gráfico de treino','1rm','pr'],
    fraco: ['recorde','melhora','cresci','fiquei mais forte']
  },
  action: function() { showEvoChart(); },
  botao: { label: 'Ver Evolução', icon: 'bar-chart-3', cor: 'blue' }
},

/* ── 7. HISTÓRICO ───────────────────────────────── */
{
  id: 'historico',
  score: {
    forte: ['histórico de treinos','sessões anteriores','últimos treinos',
            'ver meus treinos','meus treinos passados'],
    medio: ['histórico','treinos anteriores','sessões de treino'],
    fraco: ['ver treinos']
  },
  action: function() { verHistorico(); },
  botao: { label: 'Ver Histórico', icon: 'list', cor: 'blue' }
},

/* ── 8. MESOCICLO / PERIODIZAÇÃO ────────────────── */
{
  id: 'mesociclo',
  score: {
    forte: ['mesociclo','periodização','deload','bloco de treino',
            'semanas de treino','periodizar','estruturar treino'],
    medio: ['bloco','ondulação','linear','ciclo de treino'],
    fraco: ['semanas','planejamento']
  },
  action: function() { abrirMesociclo(); },
  botao: { label: 'Gerar Mesociclo', icon: 'calendar', cor: 'purple' }
},

/* ── 9. RECUPERAÇÃO ─────────────────────────────── */
{
  id: 'recuperacao',
  score: {
    forte: ['dor muscular','músculo doendo','dor no músculo','lesão','me machuquei',
            'overtraining','sobretreinamento','muito cansado para treinar'],
    medio: ['recuperação muscular','doms','descanso ativo','fadiga muscular',
            'recuperar mais rápido'],
    fraco: ['cansado','fatigado','exausto','dolorido']
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
    forte: ['exercício de respiração','respiração guiada','relaxamento','ansiedade',
            'estresse','cool-down','meditação'],
    medio: ['respirar','calma','tensão','nervoso','agitado'],
    fraco: []
  },
  action: function() { abrirRespiracao(); },
  botao: { label: 'Respiração Guiada', icon: 'wind', cor: 'blue' }
},

/* ── 11. PLANO PRO ──────────────────────────────── */
{
  id: 'plano',
  score: {
    forte: ['assinar pro','upgrade pro','virar pro','plano pro','quero o pro',
            'consultas esgotadas','limite de mensagens','sem consultas'],
    medio: ['plano premium','premium','sem limite','plano pago'],
    fraco: ['assinar','pro','upgrade','premium','limite']
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
    return /dor\s+(aguda|forte|intensa|persistente)|lesão|lesionado|me machuquei|torci|quebrei|fraturei/i.test(txt);
  },
  // Lesão ativa: bloqueia transforms de treino — não faz sentido sugerir "Ir para Treino"
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
    var clean = txt.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 20);
    return last5.filter(function(m) {
      return m.content.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 20) === clean;
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
   Calcula a relevância de cada Transform para a mensagem.
═══════════════════════════════════════════════════ */
function _scoreTransform(transform, texto) {
  var score = 0;
  var s = transform.score;
  if (!s) return 0;
  (s.forte || []).forEach(function(k) { if (texto.includes(k)) score += 3; });
  (s.medio || []).forEach(function(k) { if (texto.includes(k)) score += 2; });
  (s.fraco || []).forEach(function(k) { if (texto.includes(k)) score += 1; });
  return score;
}

/**
 * Boost contextual — lê histórico e config para aumentar relevância
 * quando o contexto do usuário torna aquele transform mais pertinente.
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
      // Treinou nas últimas 24h → recuperação mais relevante
      if (horasDesdeUltimo < 24) boost += 2;
      // Streak alto → corpo sob estresse acumulado
      if (hist.length >= 5) boost += 1;
    }
    if (transformId === 'evolucao') {
      // Só faz sentido mostrar se há histórico real para exibir
      if (hist.length >= 3) boost += 2;
    }
    if (transformId === 'gerar_treino') {
      // Sem programa → criar um é urgente
      if (!temPrograma) boost += 2;
    }
    if (transformId === 'dieta') {
      // Tem dados de perfil preenchidos → fluxo de dieta é completo
      if (cfg.peso && cfg.objetivo) boost += 1;
    }
    if (transformId === 'mesociclo') {
      // Só útil se já tem pelo menos 4 semanas de histórico (~8 sessões)
      if (hist.length < 8) boost -= 2;
    }
  } catch(e) {}
  return boost;
}

/* ── Memória de sessão: evita repetir o mesmo transform ── */
var _usedTransforms = {};

/**
 * Roda os Transforms após cada resposta do KRONOS.
 * — Mensagem do usuário tem peso 2x (intenção > contexto)
 * — Boost contextual baseado em histórico e perfil real
 * — Mostra até 2 botões quando há intenção dupla explícita
 * — Ignora transforms já utilizados nesta sessão
 * — Respeita bloqueios dos Defensive Transforms
 */
// Padrões que indicam intenção informacional — não de navegação.
// Quando presentes, transforms de navegação (treino, dieta, etc.) não devem aparecer.
var INFO_INTENT_PATTERNS = [
  'dica','me dê','me de ','me explica','como posso','como fazer','como devo',
  'por que','qual é','qual a','qual sua','qual seu','o que é','o que devo','me conta','me fala',
  'maximizar','melhorar','aumentar resultado','entender','analis','diagnos',
  'me oriente','me ajude a entender','qual seria','devo fazer',
  'sua referência','seu conhecimento','sua base','sua fonte','você usa','você tem acesso'
];

function _isInfoIntent(texto) {
  return INFO_INTENT_PATTERNS.some(function(p) { return texto.includes(p); });
}

// Transforms que são de NAVEGAÇÃO — bloqueados quando usuário só pede info
var NAV_TRANSFORM_IDS = ['treino', 'gerar_treino', 'dieta', 'suplemento', 'evolucao'];

// Intents classificadas pelo IntentAgent que NÃO devem acionar transforms de navegação
var SERVER_INTENT_NO_NAV = ['chat', 'duvida', 'continuidade', 'ajuste'];

function runTransforms(userMessage, botResponse, containerId, blockedIds, serverIntent) {
  var textoUser = (userMessage || '').toLowerCase();
  var textoBot  = (botResponse  || '').toLowerCase();
  var bloqueados = blockedIds || [];
  var THRESHOLD  = 2;

  // Gate primário: IntentAgent semântico (servidor) tem prioridade sobre keywords
  // Se o agente classificou como conversa/dúvida/continuidade → zero transforms de nav
  var serverSaysNoNav = serverIntent && SERVER_INTENT_NO_NAV.indexOf(serverIntent) >= 0;
  // Fallback: detecção client-side por padrões de texto (quando serverIntent ausente)
  var infoIntent = serverSaysNoNav || (!serverIntent && _isInfoIntent(textoUser));

  var scored = [];

  for (var i = 0; i < TRANSFORMS.length; i++) {
    var t = TRANSFORMS[i];
    // Pula transforms bloqueados por Defensive ou já usados nesta sessão
    if (bloqueados.indexOf(t.id) >= 0) continue;
    if (_usedTransforms[t.id])         continue;
    // Gate semântico: se servidor (ou fallback client) diz que é info/chat, bloqueia nav
    if (infoIntent && NAV_TRANSFORM_IDS.indexOf(t.id) >= 0) continue;

    var sc = _scoreTransform(t, textoUser) * 2
           + _scoreTransform(t, textoBot)
           + _contextBoost(t.id);

    if (sc > THRESHOLD) scored.push({ t: t, sc: sc, userSc: _scoreTransform(t, textoUser) });
  }

  if (!scored.length) return;

  // Ordena por score
  scored.sort(function(a, b) { return b.sc - a.sc; });

  // Mostra o melhor + segundo se ambos têm intenção explícita do usuário
  var toShow = [scored[0]];
  if (scored.length >= 2 && scored[1].userSc > 0 && scored[1].sc >= scored[0].sc * 0.65) {
    toShow.push(scored[1]);
  }

  toShow.forEach(function(item) { renderTransformButton(item.t, containerId); });
}

/**
 * Roda Defensive Transforms antes de enviar mensagem.
 * Retorna lista de IDs de Transforms ofensivos a bloquear.
 */
function runDefensiveTransforms(userMessage, history) {
  var blockedIds = [];
  for (var i = 0; i < DEFENSIVE_TRANSFORMS.length; i++) {
    var dt = DEFENSIVE_TRANSFORMS[i];
    if (dt.detect(userMessage, history)) {
      dt.action();
      // Acumula IDs bloqueados (sem impedir outros defensivos de rodar)
      if (dt.blocks) {
        dt.blocks.forEach(function(id) {
          if (blockedIds.indexOf(id) < 0) blockedIds.push(id);
        });
      }
      if (dt.id === 'rate_guard') return 'block'; // único que para o envio
    }
  }
  return blockedIds; // array vazio = sem bloqueios
}

/**
 * Renderiza botão de ação Transform no container do chat.
 */
function renderTransformButton(transform, containerId) {
  var container = document.getElementById(containerId || 'orientExpertMessages');
  if (!container) return;

  // Remove wrap anterior
  var oldWrap = container.querySelector('.transform-wrap');
  if (oldWrap) oldWrap.remove();

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
    _usedTransforms[transform.id] = true; // memoriza uso nesta sessão
    try { transform.action(containerId); } catch(e) { console.warn('[Transform] action error:', e); }
    wrap.remove();
  };

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}
