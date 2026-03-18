// ══════════════════════════════
// CONFIGURAÇÃO DO PLANO
// ══════════════════════════════
var HOTMART_CHECKOUT_URL = ‘’;
var FREE_AI_LIMIT = 15;

(function loadAppConfig() {
fetch(’/api/config’)
.then(function(r) { return r.json(); })
.then(function(cfg) {
if (cfg.checkoutUrl)   HOTMART_CHECKOUT_URL = cfg.checkoutUrl;
if (cfg.freePlanLimit) FREE_AI_LIMIT = cfg.freePlanLimit;
})
.catch(function() {});
})();

var _userPlan = { plan: ‘free’, ai_requests_used: 0, limit: FREE_AI_LIMIT };

async function fetchUserPlan() {
try {
const { data: { session } } = await _sb.auth.getSession();
if (!session) return;
const { data } = await _sb
.from(‘user_plans’)
.select(‘plan,ai_requests_used,period_start,expires_at’)
.eq(‘user_id’, session.user.id)
.single();
if (data) {
_userPlan = { plan: data.plan, ai_requests_used: data.ai_requests_used || 0, limit: FREE_AI_LIMIT };
updatePlanBadge();
}
} catch(e) {}
}

function updatePlanBadge() {
const badge = document.getElementById(‘authMenuPlanBadge’);
if (!badge) return;
if (_userPlan.plan === ‘pro’) {
badge.textContent = ‘PRO ⚡’;
badge.style.background = ‘rgba(249,115,22,0.3)’;
badge.style.color = ‘var(–accent)’;
} else {
var rem = Math.max(0, FREE_AI_LIMIT - _userPlan.ai_requests_used);
badge.textContent = ’FREE · ’ + rem + ‘/’ + FREE_AI_LIMIT;
badge.style.background = rem <= 3 ? ‘rgba(239,68,68,0.2)’ : ‘rgba(255,255,255,0.08)’;
badge.style.color = rem <= 3 ? ‘#ef4444’ : ‘var(–text-2)’;
}
}

// ══════════════════════════════
// MODAL DE PLANOS — Mensal vs Anual
// ══════════════════════════════
var _planSelected = ‘anual’; // padrão: anual destacado

function openPlanModal() {
const modal = document.getElementById(‘planModal’);
if (!modal) return;
modal.style.display = ‘block’;
renderPlanModal();
}

function renderPlanModal() {
const container = modal_getPlanContainer();
if (!container) return;

const isPro = _userPlan.plan === ‘pro’;
const rem = Math.max(0, FREE_AI_LIMIT - _userPlan.ai_requests_used);

container.innerHTML = `
<div style="background:linear-gradient(135deg,#1a1a1a,#212121);padding:28px 24px 20px;text-align:center;border-bottom:1px solid var(--border);position:relative">
<button onclick="closePlanModal()" style="position:absolute;right:16px;top:16px;background:none;border:none;color:var(--text-2);cursor:pointer;font-size:1.3rem;line-height:1">✕</button>
<div style="font-family:var(--display);font-size:2rem;color:var(--accent);letter-spacing:.06em;margin-bottom:4px">TITAN PRO</div>
<div style="font-size:0.85rem;color:var(--text-2)">Desbloqueie todo o potencial do KRONOS</div>
</div>

```
<div style="padding:20px 20px 0">

  ${isPro ? `
    <div style="background:rgba(249,115,22,0.08);border:1px solid var(--accent);border-radius:14px;padding:16px;margin-bottom:12px;text-align:center">
      <div style="font-size:1.1rem;font-weight:800;color:var(--accent);margin-bottom:4px">⚡ Você é PRO!</div>
      <div style="font-size:0.8rem;color:var(--text-2)">Acesso ilimitado ao KRONOS ativo.</div>
    </div>
  ` : `
    <!-- Plano Gratuito -->
    <div style="border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:700;font-size:0.95rem;color:var(--text)">Gratuito</div>
        <div style="font-size:1.2rem;font-weight:800;color:var(--text)">R$0</div>
      </div>
      <div style="font-size:0.78rem;color:var(--text-2);line-height:1.8">
        ✓ Registro ilimitado de treinos<br>
        ✓ Histórico e progresso completo<br>
        ✓ <span id="freeLimitText">${FREE_AI_LIMIT} consultas de IA por mês</span><br>
        ✗ Coach IA sem limite<br>
        ✗ Geração ilimitada de treinos
      </div>
      <div style="margin-top:8px;font-size:0.75rem;color:${rem<=3?'#ef4444':'var(--accent)'}">
        ${rem === 0 ? '⚠️ Limite esgotado' : `Restam ${rem} de ${FREE_AI_LIMIT} consultas`}
      </div>
    </div>

    <!-- Toggle Mensal / Anual -->
    <div style="display:flex;background:var(--bg2);border-radius:12px;padding:4px;gap:4px;margin-bottom:12px">
      <button id="btnToggleMensal" onclick="selectPlanPeriod('mensal')"
        style="flex:1;padding:10px;border-radius:9px;border:none;font-family:var(--font);font-size:0.85rem;font-weight:700;cursor:pointer;transition:all .2s;
        background:${_planSelected==='mensal'?'var(--card)':'transparent'};
        color:${_planSelected==='mensal'?'var(--text)':'var(--muted)'}">
        Mensal
      </button>
      <button id="btnToggleAnual" onclick="selectPlanPeriod('anual')"
        style="flex:1;padding:10px;border-radius:9px;border:none;font-family:var(--font);font-size:0.85rem;font-weight:700;cursor:pointer;transition:all .2s;
        background:${_planSelected==='anual'?'var(--card)':'transparent'};
        color:${_planSelected==='anual'?'var(--accent)':'var(--muted)'}">
        Anual 🔥
      </button>
    </div>

    <!-- Card do plano selecionado -->
    <div id="planCardPro" style="border:1.5px solid var(--accent);border-radius:14px;padding:16px;background:rgba(249,115,22,0.04);position:relative;margin-bottom:12px">
      <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:0.68rem;font-weight:800;padding:3px 12px;border-radius:20px;letter-spacing:.04em">
        ${_planSelected==='anual'?'🔥 MAIS POPULAR':'PRO'}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;margin-top:4px">
        <div>
          <div style="font-weight:700;font-size:0.95rem;color:var(--accent)">Pro ${_planSelected==='anual'?'Anual':'Mensal'}</div>
          ${_planSelected==='anual'?'<div style="font-size:0.7rem;color:var(--green);font-weight:700;margin-top:2px">💰 Economize R$203,00/ano</div>':''}
        </div>
        <div style="text-align:right">
          ${_planSelected==='anual'?`
            <div><span style="font-size:0.75rem;color:var(--muted);text-decoration:line-through">R$29,90/mês</span></div>
            <div><span style="font-size:1.4rem;font-weight:800;color:var(--text)">R$12,90</span><span style="font-size:0.75rem;color:var(--text-2)">/mês</span></div>
            <div style="font-size:0.7rem;color:var(--text-2)">R$154,80/ano</div>
          `:`
            <div><span style="font-size:1.4rem;font-weight:800;color:var(--text)">R$29,90</span><span style="font-size:0.75rem;color:var(--text-2)">/mês</span></div>
          `}
        </div>
      </div>
      ${_planSelected==='anual'?`
        <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:8px 12px;margin-bottom:10px;font-size:0.75rem;color:var(--green);font-weight:700;text-align:center">
          🎉 57% de desconto · Equivale a 5 meses grátis
        </div>
      `:''}
      <div style="font-size:0.78rem;color:var(--text-2);line-height:1.8;margin-bottom:14px">
        ✓ Registro ilimitado de treinos<br>
        ✓ Histórico e progresso completo<br>
        ✓ <strong style="color:var(--text)">Coach IA ilimitado</strong><br>
        ✓ <strong style="color:var(--text)">Geração ilimitada de treinos com IA</strong><br>
        ✓ <strong style="color:var(--text)">Suporte prioritário</strong>
      </div>
      <button onclick="assinarPro()"
        style="width:100%;background:var(--accent);border:none;border-radius:12px;padding:14px;color:#fff;font-family:var(--font);font-size:0.92rem;font-weight:800;cursor:pointer;letter-spacing:.02em;box-shadow:0 4px 16px rgba(249,115,22,0.3)">
        ${_planSelected==='anual'?'Assinar Anual — R$154,80/ano':'Assinar Mensal — R$29,90/mês'}
      </button>
      <div style="text-align:center;font-size:0.7rem;color:var(--text-2);margin-top:8px">Cancele quando quiser · Sem fidelidade</div>
    </div>
  `}

  <div id="planStatusMsg" style="margin-top:8px;text-align:center;font-size:0.78rem;color:var(--text-2)"></div>

  <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);text-align:center;font-size:0.72rem;color:rgba(255,255,255,0.35)">
    <span onclick="openLegalModal('privacy');closePlanModal()" style="cursor:pointer;text-decoration:underline;color:rgba(255,255,255,0.45)">Política de Privacidade</span>
    &nbsp;·&nbsp;
    <span onclick="openLegalModal('terms');closePlanModal()" style="cursor:pointer;text-decoration:underline;color:rgba(255,255,255,0.45)">Termos de Uso</span>
    &nbsp;·&nbsp;
    <span onclick="confirmDeleteAccount();closePlanModal()" style="cursor:pointer;text-decoration:underline;color:rgba(239,68,68,0.5)">Excluir conta</span>
  </div>
</div>
```

`;
}

function modal_getPlanContainer() {
const modal = document.getElementById(‘planModal’);
if (!modal) return null;
let inner = modal.querySelector(’.plan-inner’);
if (!inner) {
inner = document.createElement(‘div’);
inner.className = ‘plan-inner’;
inner.style.cssText = ‘background:var(–surface);border:1px solid var(–border);border-radius:20px;max-width:400px;margin:20px auto;overflow:hidden’;
modal.innerHTML = ‘’;
modal.appendChild(inner);
}
return inner;
}

function selectPlanPeriod(period) {
_planSelected = period;
renderPlanModal();
}

function closePlanModal() {
const modal = document.getElementById(‘planModal’);
if (modal) modal.style.display = ‘none’;
}

async function assinarPro() {
if (!HOTMART_CHECKOUT_URL) {
alert(‘Link de pagamento não configurado. Entre em contato com o suporte.’);
return;
}
try {
const { data: { session } } = await _sb.auth.getSession();
var email = session?.user?.email ? ‘?email=’ + encodeURIComponent(session.user.email) : ‘’;
var planParam = _planSelected === ‘anual’ ? ‘&plano=anual’ : ‘&plano=mensal’;
window.open(HOTMART_CHECKOUT_URL + email + planParam, ‘_blank’);
} catch(e) {
window.open(HOTMART_CHECKOUT_URL, ‘_blank’);
}
}

// ══════════════════════════════
// PAYWALL
// ══════════════════════════════
function showPaywall(msg) {
var modal = document.getElementById(‘paywallModal’);
if (!modal) return;
var msgEl = document.getElementById(‘paywallMsg’);
if (msgEl && msg) msgEl.textContent = msg;
modal.style.display = ‘flex’;
}

function closePaywall() {
var modal = document.getElementById(‘paywallModal’);
if (modal) modal.style.display = ‘none’;
}

// Intercepta 402 (quota excedida)
var _originalFetch = window.fetch;
window.fetch = async function(url, opts) {
var resp = await _originalFetch.apply(this, arguments);
if (resp.status === 402 && typeof url === ‘string’ && url.startsWith(’/api/’)) {
try {
var clone = resp.clone();
var json = await clone.json();
if (json.code === ‘QUOTA_EXCEEDED’) {
_userPlan.ai_requests_used = json.used || FREE_AI_LIMIT;
updatePlanBadge();
showPaywall(json.error || ‘Limite do plano gratuito atingido. Faça upgrade para o Pro.’);
}
} catch(e) {}
}
return resp;
};

// ══════════════════════════════
// EXPORTAR DADOS (LGPD)
// ══════════════════════════════
async function exportUserData() {
showToast(‘Preparando seus dados para exportação…’, ‘info’, 3000);
try {
const resp = await apiFetch(’/api/lgpd-export’);
if (!resp.ok) throw new Error(‘Falha na exportação’);
const blob = await resp.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement(‘a’);
a.href = url; a.download = ‘titan-pro-meus-dados.json’;
document.body.appendChild(a); a.click();
setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 1000);
showToast(‘Dados exportados com sucesso!’, ‘success’, 3000);
} catch(e) {
showToast(‘Erro ao exportar dados. Tente novamente.’, ‘error’, 4000);
}
}

// ══════════════════════════════
// EXCLUIR CONTA (LGPD)
// ══════════════════════════════
function confirmDeleteAccount() {
var confirmed = window.confirm(
‘ATENÇÃO: Esta ação é irreversível.\n\n’ +
‘Todos os seus dados (treinos, histórico, perfil) serão permanentemente excluídos, conforme a LGPD (Art. 18, VI).\n\n’ +
‘Deseja continuar?’
);
if (!confirmed) return;
var confirmed2 = window.confirm(‘Tem certeza absoluta? Esta ação NÃO pode ser desfeita.’);
if (!confirmed2) return;
deleteAccount();
}

async function deleteAccount() {
showToast(‘Excluindo sua conta…’, ‘info’, 5000);
try {
const resp = await apiFetch(’/api/lgpd-delete’, { method: ‘POST’ });
const json = await resp.json();
if (json.ok) {
showToast(‘Conta excluída. Obrigado por usar o TITAN PRO.’, ‘success’, 5000);
setTimeout(function() { window.location.reload(); }, 3000);
} else {
showToast(’Erro ao excluir conta: ’ + (json.error || ‘tente novamente’), ‘error’, 5000);
}
} catch(e) {
showToast(‘Erro de conexão ao excluir conta.’, ‘error’, 4000);
}
}

// ══════════════════════════════
// DOCUMENTOS LEGAIS
// ══════════════════════════════
var _legalDocs = {
privacy: {
title: ‘Política de Privacidade — LGPD’,
content: `<strong>Última atualização: março de 2026</strong><br><br> <strong>1. Responsável pelo Tratamento</strong><br> TITAN PRO (titanpro.app.br) é responsável pelo tratamento dos seus dados pessoais, nos termos da LGPD — Lei 13.709/2018.<br><br> <strong>2. Dados Coletados</strong><br> Coletamos: endereço de e-mail, dados de treino, configurações do perfil e registros de uso. Não coletamos dados de pagamento diretamente.<br><br> <strong>3. Finalidade do Tratamento</strong><br> • Autenticar e identificar sua conta<br> • Sincronizar seu histórico de treinos<br> • Personalizar as respostas do Coach IA<br> • Controlar quotas de uso do plano gratuito<br><br> <strong>4. Base Legal (LGPD)</strong><br> Art. 7º, I — Consentimento; Art. 7º, V — Execução do contrato; Art. 7º, IX — Legítimo interesse.<br><br> <strong>5. Compartilhamento</strong><br> • Supabase — banco de dados e autenticação<br> • Groq API — processamento das mensagens do Coach IA<br> • Vercel — hospedagem<br> • Hotmart/Kiwify — pagamentos<br> Não vendemos dados a terceiros.<br><br> <strong>6. Seus Direitos (Art. 18)</strong><br> • Exportar dados: Menu → "Exportar meus dados"<br> • Excluir conta: Menu → "Excluir conta"<br><br> <strong>7. Contato</strong><br> Para dúvidas de privacidade, use o suporte disponível no app.`
},
terms: {
title: ‘Termos de Uso’,
content: `<strong>Última atualização: março de 2026</strong><br><br> <strong>1. Aceitação</strong><br> Ao usar o TITAN PRO você concorda com estes termos.<br><br> <strong>2. ⚠️ DISCLAIMER — SAÚDE</strong><br> <span style="color:#f97316;font-weight:600">O TITAN PRO não substitui avaliação médica ou orientação de profissional de Educação Física.</span><br> Consulte um médico antes de iniciar qualquer programa de exercícios. Os desenvolvedores não se responsabilizam por lesões.<br><br> <strong>3. Planos e Pagamento</strong><br> • Plano Gratuito: ${FREE_AI_LIMIT} consultas de IA/mês<br> • Plano Pro Mensal: R$29,90/mês<br> • Plano Pro Anual: R$154,80/ano (R$12,90/mês)<br> Cancelamentos seguem a política do Hotmart/Kiwify (até 7 dias, conforme CDC Art. 49).<br><br> <strong>4. Uso Aceitável</strong><br> Proibido usar para fins ilícitos, burlar limites de quota ou obter diagnósticos médicos via IA.<br><br> <strong>5. Lei Aplicável</strong><br> Leis brasileiras. Foro: São Paulo/SP.`
}
};

function openLegalModal(type) {
var modal = document.getElementById(‘legalModal’);
var titleEl = document.getElementById(‘legalTitle’);
var contentEl = document.getElementById(‘legalContent’);
if (!modal || !_legalDocs[type]) return;
titleEl.textContent = _legalDocs[type].title;
contentEl.innerHTML = _legalDocs[type].content;
contentEl.scrollTop = 0;
modal.style.display = ‘block’;
}

function closeLegalModal() {
document.getElementById(‘legalModal’).style.display = ‘none’;
}

// Fecha modais ao clicar no overlay
document.getElementById(‘planModal’)?.addEventListener(‘click’, function(e) {
if (e.target === this) closePlanModal();
});
document.getElementById(‘legalModal’)?.addEventListener(‘click’, function(e) {
if (e.target === this) closeLegalModal();
});

// Carrega plano ao autenticar
_sb.auth.onAuthStateChange(function(event, session) {
if (session?.user) {
setTimeout(fetchUserPlan, 1000);
} else {
_userPlan = { plan: ‘free’, ai_requests_used: 0, limit: FREE_AI_LIMIT };
updatePlanBadge();
}
});