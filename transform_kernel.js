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
    fraco: ['treino','malhar','malhação','ginástica']
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
  action: function() { /* silencioso — não ativar */ }
},
{
  id: 'injury_alert',
  detect: function(txt) {
    return /dor\s+(aguda|forte|intensa|persistente)|lesão|lesionado|me machuquei|torci|quebrei|fraturei/i.test(txt);
  },
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
 * Roda os Transforms após cada resposta do KRONOS.
 * Mensagem do usuário tem peso 2x — intento real sempre vence o bot.
 * Threshold mínimo: score > 2 para exibir o botão.
 */
function runTransforms(userMessage, botResponse, containerId) {
  var textoUser = (userMessage || '').toLowerCase();
  var textoBot  = (botResponse  || '').toLowerCase();
  var best = null;
  var bestScore = 2; // threshold: score > 2

  for (var i = 0; i < TRANSFORMS.length; i++) {
    // Usuário pesa 2x — evita que a resposta do bot sobrescreva o intent
    var sc = _scoreTransform(TRANSFORMS[i], textoUser) * 2
           + _scoreTransform(TRANSFORMS[i], textoBot);
    if (sc > bestScore) {
      bestScore = sc;
      best = TRANSFORMS[i];
    }
  }

  if (best) renderTransformButton(best, containerId);
}

/**
 * Roda Defensive Transforms antes de enviar mensagem.
 * Retorna true se deve bloquear o envio.
 */
function runDefensiveTransforms(userMessage, history) {
  for (var i = 0; i < DEFENSIVE_TRANSFORMS.length; i++) {
    var dt = DEFENSIVE_TRANSFORMS[i];
    if (dt.detect(userMessage, history)) {
      dt.action();
      if (dt.id === 'rate_guard') return true;
    }
  }
  return false;
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
    try { transform.action(containerId); } catch(e) { console.warn('[Transform] action error:', e); }
    wrap.remove();
  };

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}
