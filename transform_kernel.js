/* ═══════════════════════════════════════════════════
TRANSFORM KERNEL — inspirado no Maltego
Cada mensagem do usuário é uma entidade.
Cada Transform detecta intenção e gera uma ação.
═══════════════════════════════════════════════════ */
const TRANSFORMS = [
{
id: 'treino',
keywords: ['treino','exercício','musculação','série','repetição','gerar treino','montar treino','academia','supino','agachamento','barra'],
action: () => { navTo('treino'); closeHome(); },
botao: { label: '💪 Ir para Treino', cor: 'accent' }
},
{
id: 'basal',
// FIX: basal antes de dieta para 'caloria/kcal/tmb/tdee' não acionar dieta
keywords: ['tmb','tdee','basal','metabolismo','gasto calórico','kcal','caloria'],
action: () => openBasalSheet(),
botao: { label: '🔥 Calculadora Basal', cor: 'accent' }
},
{
id: 'dieta',
keywords: ['dieta','alimentação','refeição','nutrição','gerar dieta','cardápio','proteína','carboidrato','o que comer','pós-treino'],
action: () => openDietaSheet(),
botao: { label: '🥗 Gerar Dieta', cor: 'green' }
},
{
id: 'evolucao',
keywords: ['evolução','progresso','gráfico','1rm','pr','recorde','melhora','cresci'],
action: () => showEvoChart(),
botao: { label: '📊 Ver Evolução', cor: 'blue' }
},
{
id: 'plano',
keywords: ['assinar','pro','plano','upgrade','premium','limite','consultas'],
action: () => openPlanModal(),
botao: { label: '⚡ Ver Planos', cor: 'accent' }
},
{
id: 'mesociclo',
keywords: ['mesociclo','periodização','bloco','semanas','plano de treino','deload'],
action: () => abrirMesociclo(),
botao: { label: '📅 Gerar Mesociclo', cor: 'purple' }
},
{
id: 'respiracao',
keywords: ['respiração','relaxar','cool-down','estresse','ansiedade'],
action: () => abrirRespiracao(),
botao: { label: '🫁 Respiração', cor: 'blue' }
},
{
id: 'historico',
keywords: ['histórico','sessões anteriores','últimos treinos','ver treinos'],
action: () => verHistorico(),
botao: { label: '📋 Ver Histórico', cor: 'blue' }
},
];

/* Defensive Transforms — proteção do negócio */
const DEFENSIVE_TRANSFORMS = [
{
id: 'paywall_bypass',
detect: (txt) => /sem pagar|hack|burlar|contornar/i.test(txt),
action: () => { /* silencioso */ }
},
{
id: 'rate_guard',
detect: (txt, history) => {
if (!history || history.length < 5) return false;
const last5 = history.slice(-5).filter(m => m.role === 'user');
const prefix = txt.toLowerCase().slice(0, 10);
return last5.filter(m => m.content.toLowerCase().includes(prefix)).length >= 3;
},
action: () => showToast('Já respondi isso recentemente! Role para ver a resposta anterior.', 'info', 4000)
}
];

/**

- Roda os Transforms após cada resposta do KRONOS.
  */
  function runTransforms(userMessage, botResponse, containerId) {
  const texto = ((userMessage || '') + ' ' + (botResponse || '')).toLowerCase();
  for (const transform of TRANSFORMS) {
  const match = transform.keywords.some(k => texto.includes(k));
  if (match) {
  renderTransformButton(transform, containerId);
  break;
  }
  }
  }

/**

- Roda Defensive Transforms antes de enviar mensagem.
- Retorna true se deve bloquear.
  */
  function runDefensiveTransforms(userMessage, history) {
  for (const dt of DEFENSIVE_TRANSFORMS) {
  if (dt.detect(userMessage, history)) {
  dt.action();
  if (dt.id === 'rate_guard') return true;
  }
  }
  return false;
  }

/**

- Renderiza botão de ação Transform no container do chat.
  */
  function renderTransformButton(transform, containerId) {
  const container = document.getElementById(containerId || 'orientExpertMessages');
  if (!container) return;

// FIX BUG 2: remove wrap inteiro (não só o btn)
const oldWrap = container.querySelector('.transform-wrap');
if (oldWrap) oldWrap.remove();

const colorMap = {
accent: { css: 'var(--accent)',  rgba: '249,115,22'  },
green:  { css: 'var(--green)',   rgba: '34,197,94'   },
blue:   { css: 'var(--blue)',    rgba: '59,130,246'  },
purple: { css: 'var(--purple)',  rgba: '168,85,247'  },
};
const c = colorMap[transform.botao.cor] || colorMap.accent;

const btn = document.createElement('button');
btn.className = 'transform-btn';
btn.style.cssText = `display:block;width:100%;padding:12px 16px; background:rgba(${c.rgba},0.12); border:1.5px solid ${c.css};border-radius:12px;color:${c.css}; font-family:var(--font);font-size:0.88rem;font-weight:700; cursor:pointer;text-align:left;transition:all .15s; animation:fadeInUp .3s ease;`;
btn.textContent = transform.botao.label;

// FIX BUG 1: touchstart + touchend para resetar cor
btn.addEventListener('touchstart', () => {
btn.style.background = c.css;
btn.style.color = '#fff';
}, { passive: true });
btn.addEventListener('touchend', () => {
setTimeout(() => {
btn.style.background = `rgba(${c.rgba},0.12)`;
btn.style.color = c.css;
}, 150);
}, { passive: true });

btn.onclick = () => {
transform.action();
wrap.remove(); // FIX BUG 2: remove o wrap inteiro
};

// FIX BUG 2: classe transform-wrap para identificar e remover
const wrap = document.createElement('div');
wrap.className = 'ai-msg assistant transform-wrap';
wrap.style.paddingLeft = containerId === 'orientExpertMessages' ? '0' : '38px';
wrap.appendChild(btn);
container.appendChild(wrap);
container.scrollTop = container.scrollHeight;
}
