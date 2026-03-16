// ══════════════════════════════
// CONFIGURAÇÃO DO PLANO
// ══════════════════════════════
// URL de checkout carregada via /api/config (env var CHECKOUT_URL no Vercel)
var HOTMART_CHECKOUT_URL = '';
var FREE_AI_LIMIT = 15; // valor padrão; sobrescrito após fetch do /api/config

// Carrega configurações públicas do backend
// Promise guardada para que assinarPro() possa aguardar se ainda não resolveu
var _configPromise = fetch('/api/config')
  .then(function(r) { return r.json(); })
  .then(function(cfg) {
    if (cfg.checkoutUrl)   HOTMART_CHECKOUT_URL = cfg.checkoutUrl;
    if (cfg.freePlanLimit) FREE_AI_LIMIT = cfg.freePlanLimit;
  })
  .catch(function() { /* falha silenciosa — continua com defaults */ });

var _userPlan = { plan: 'free', ai_requests_used: 0, limit: FREE_AI_LIMIT };

// Busca plano do usuário no Supabase (anon pode ler o próprio registro via RLS)
async function fetchUserPlan() {
  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return;
    const { data } = await _sb
      .from('user_plans')
      .select('plan,ai_requests_used,period_start,expires_at')
      .eq('user_id', session.user.id)
      .single();
    if (data) {
      _userPlan = { plan: data.plan, ai_requests_used: data.ai_requests_used || 0, limit: FREE_AI_LIMIT };
      updatePlanBadge();
    }
  } catch(e) { /* silencioso */ }
}

function updatePlanBadge() {
  const badge = document.getElementById('authMenuPlanBadge');
  if (!badge) return;
  if (_userPlan.plan === 'pro') {
    badge.textContent = 'PRO';
    badge.style.background = 'rgba(249,115,22,0.3)';
    badge.style.color = 'var(--accent)';
  } else {
    var rem = Math.max(0, FREE_AI_LIMIT - _userPlan.ai_requests_used);
    badge.textContent = 'FREE · ' + rem + '/' + FREE_AI_LIMIT;
    badge.style.background = rem <= 3 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)';
    badge.style.color = rem <= 3 ? '#ef4444' : 'var(--text-2)';
  }
}

// ══════════════════════════════
// MODAL DE PLANOS
// ══════════════════════════════
function openPlanModal() {
  document.getElementById('planModal').style.display = 'block';
  var usageEl = document.getElementById('planFreeUsage');
  var statusEl = document.getElementById('planStatusMsg');
  var btnAssinar = document.getElementById('btnAssinarPro');

  if (_userPlan.plan === 'pro') {
    if (usageEl) usageEl.textContent = '';
    if (statusEl) statusEl.innerHTML = '✅ <strong style="color:var(--accent)">Você está no plano Pro.</strong> Obrigado!';
    if (btnAssinar) { btnAssinar.textContent = 'Gerenciar assinatura'; btnAssinar.onclick = assinarPro; }
  } else {
    var rem = Math.max(0, FREE_AI_LIMIT - _userPlan.ai_requests_used);
    if (usageEl) usageEl.textContent = 'Você usou ' + _userPlan.ai_requests_used + ' de ' + FREE_AI_LIMIT + ' consultas este mês (' + rem + ' restantes)';
    if (statusEl) statusEl.innerHTML = rem === 0 ? '⚠️ Limite gratuito esgotado — faça upgrade para continuar.' : '';
    if (btnAssinar) { btnAssinar.textContent = 'Assinar Pro — R$29,90/mês'; btnAssinar.onclick = assinarPro; }
  }
}

function closePlanModal() {
  document.getElementById('planModal').style.display = 'none';
}

async function assinarPro() {
  // Aguarda config carregar caso ainda não tenha resolvido (race condition)
  await _configPromise;
  if (!HOTMART_CHECKOUT_URL) {
    if (typeof showToast === 'function') {
      showToast('Checkout em breve. Fale com o suporte.', 'warning');
    }
    return;
  }
  try {
    const { data: { session } } = await _sb.auth.getSession();
    var email = session && session.user && session.user.email ? '?email=' + encodeURIComponent(session.user.email) : '';
    window.open(HOTMART_CHECKOUT_URL + email, '_blank');
  } catch(e) {
    window.open(HOTMART_CHECKOUT_URL, '_blank');
  }
}

// ══════════════════════════════
// PAYWALL
// ══════════════════════════════
function showPaywall(msg) {
  var modal = document.getElementById('paywallModal');
  if (!modal) return;
  var msgEl = document.getElementById('paywallMsg');
  if (msgEl && msg) msgEl.textContent = msg;
  modal.style.display = 'flex';
}

function closePaywall() {
  var modal = document.getElementById('paywallModal');
  if (modal) modal.style.display = 'none';
}

// Intercepta respostas 402 (quota excedida) das APIs
var _originalFetch = window.fetch;
window.fetch = async function(url, opts) {
  var resp = await _originalFetch.apply(this, arguments);
  if (resp.status === 402 && typeof url === 'string' && url.startsWith('/api/')) {
    try {
      var clone = resp.clone();
      var json = await clone.json();
      if (json.code === 'QUOTA_EXCEEDED') {
        _userPlan.ai_requests_used = json.used || FREE_AI_LIMIT;
        updatePlanBadge();
        showPaywall(json.error || 'Limite do plano gratuito atingido. Faça upgrade para o Pro.');
      }
    } catch(e) {}
  }
  return resp;
};

// ══════════════════════════════
// EXPORTAR DADOS (LGPD)
// ══════════════════════════════
async function exportUserData() {
  showToast('Preparando seus dados para exportação...', 'info', 3000);
  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return;
    const resp = await fetch('/api/lgpd-export', {
      headers: { 'Authorization': 'Bearer ' + session.access_token }
    });
    if (!resp.ok) throw new Error('Falha na exportação');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'titan-pro-meus-dados.json';
    document.body.appendChild(a); a.click();
    setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 1000);
    showToast('Dados exportados com sucesso!', 'success', 3000);
  } catch(e) {
    showToast('Erro ao exportar dados. Tente novamente.', 'error', 4000);
  }
}

// ══════════════════════════════
// EXCLUIR CONTA (LGPD)
// ══════════════════════════════
function confirmDeleteAccount() {
  var confirmed = window.confirm(
    'ATENÇÃO: Esta ação é irreversível.\n\n' +
    'Todos os seus dados (treinos, histórico, perfil) serão permanentemente excluídos, conforme a LGPD (Art. 18, VI).\n\n' +
    'Deseja continuar?'
  );
  if (!confirmed) return;
  var confirmed2 = window.confirm('Tem certeza absoluta? Esta ação NÃO pode ser desfeita.');
  if (!confirmed2) return;
  deleteAccount();
}

async function deleteAccount() {
  showToast('Excluindo sua conta...', 'info', 5000);
  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return;
    const resp = await fetch('/api/lgpd-delete', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + session.access_token }
    });
    const json = await resp.json();
    if (json.ok) {
      showToast('Conta excluída. Obrigado por usar o TITAN PRO.', 'success', 5000);
      setTimeout(function() { window.location.reload(); }, 3000);
    } else {
      showToast('Erro ao excluir conta: ' + (json.error || 'tente novamente'), 'error', 5000);
    }
  } catch(e) {
    showToast('Erro de conexão ao excluir conta.', 'error', 4000);
  }
}

// ══════════════════════════════
// DOCUMENTOS LEGAIS
// ══════════════════════════════
var _legalDocs = {
  privacy: {
    title: 'Política de Privacidade — LGPD',
    content: `
<strong>Última atualização: março de 2026</strong><br><br>

<strong>1. Responsável pelo Tratamento</strong><br>
TITAN PRO (treino-do-dia-orpin.vercel.app) é responsável pelo tratamento dos seus dados pessoais, nos termos da Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).<br><br>

<strong>2. Dados Coletados</strong><br>
Coletamos: endereço de e-mail (para autenticação), dados de treino (exercícios, séries, cargas, datas), configurações do perfil (peso, objetivo, frequência de treino) e registros de uso do app (data/hora, tipo de consulta).<br>
Não coletamos dados de pagamento diretamente — o processamento é feito pelo Hotmart/Kiwify.<br><br>

<strong>3. Finalidade do Tratamento</strong><br>
• Autenticar e identificar sua conta<br>
• Sincronizar e exibir seu histórico de treinos<br>
• Personalizar as respostas do Coach IA com base no seu perfil<br>
• Controlar quotas de uso do plano gratuito<br>
• Cumprir obrigações legais<br><br>

<strong>4. Base Legal (LGPD)</strong><br>
Art. 7º, I — Consentimento, obtido no cadastro;<br>
Art. 7º, V — Execução do contrato de prestação de serviços;<br>
Art. 7º, IX — Legítimo interesse (segurança e prevenção de fraudes).<br><br>

<strong>5. Compartilhamento de Dados</strong><br>
• <em>Supabase (Supabase Inc.)</em> — banco de dados e autenticação, servidores na AWS us-east-1;<br>
• <em>NVIDIA</em> — API de IA para processamento de mensagens do Coach. Não são enviados dados pessoais identificáveis nas mensagens;<br>
• <em>Vercel Inc.</em> — hospedagem da aplicação;<br>
• <em>Hotmart/Kiwify</em> — processamento de pagamentos (plano Pro).<br>
Não vendemos dados pessoais a terceiros.<br><br>

<strong>6. Transferência Internacional</strong><br>
Seus dados podem ser processados em servidores nos EUA (Supabase/AWS, NVIDIA, Vercel). Estas transferências ocorrem com garantias adequadas conforme o Art. 33 da LGPD.<br><br>

<strong>7. Retenção de Dados</strong><br>
Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão da conta, os dados são removidos em até 72 horas.<br><br>

<strong>8. Seus Direitos (Art. 18, LGPD)</strong><br>
Você tem direito a: confirmar a existência do tratamento; acessar seus dados; corrigir dados incompletos; portabilidade; exclusão. Para exercê-los:<br>
• <em>Exportar dados</em>: Menu de conta → "Exportar meus dados"<br>
• <em>Excluir conta</em>: Menu de conta → "Meu Plano" → "Excluir conta"<br><br>

<strong>9. Segurança</strong><br>
Utilizamos autenticação JWT, HTTPS em todas as comunicações, Row Level Security no banco de dados e confirmação de e-mail obrigatória.<br><br>

<strong>10. Cookies e Armazenamento Local</strong><br>
Usamos localStorage para salvar dados de treino offline. Não usamos cookies de rastreamento ou publicidade.<br><br>

<strong>11. Contato do DPO</strong><br>
Para dúvidas sobre privacidade, entre em contato através do suporte disponível no app.<br><br>

<strong>12. Alterações nesta Política</strong><br>
Notificaremos alterações relevantes por e-mail ou notificação no app com 15 dias de antecedência.
    `
  },
  terms: {
    title: 'Termos de Uso',
    content: `
<strong>Última atualização: março de 2026</strong><br><br>

<strong>1. Aceitação dos Termos</strong><br>
Ao criar uma conta e usar o TITAN PRO, você concorda com estes Termos de Uso. Se não concordar, não utilize o serviço.<br><br>

<strong>2. Descrição do Serviço</strong><br>
O TITAN PRO é um aplicativo de registro e planejamento de treinos musculares, com funcionalidades de inteligência artificial para sugestão de exercícios, análise de progresso e coaching personalizado.<br><br>

<strong>3. ⚠️ DISCLAIMER IMPORTANTE — SAÚDE E EXERCÍCIO FÍSICO</strong><br>
<span style="color:#f97316;font-weight:600">O TITAN PRO não substitui avaliação médica ou orientação profissional.</span><br><br>
• As sugestões de treino geradas pela IA são baseadas em princípios gerais de musculação e devem ser adaptadas pelo usuário ou por um profissional de Educação Física;<br>
• Consulte um médico antes de iniciar qualquer programa de exercícios, especialmente se tiver condições de saúde preexistentes;<br>
• As informações nutricionais são estimativas baseadas em equações científicas e não substituem avaliação nutricional individualizada;<br>
• O uso de cargas inadequadas pode causar lesões. Sempre priorize a técnica correta;<br>
• Os desenvolvedores do TITAN PRO não se responsabilizam por lesões decorrentes do uso das sugestões do app.<br><br>

<strong>4. Elegibilidade</strong><br>
O uso é permitido para maiores de 18 anos, ou menores com supervisão e consentimento dos responsáveis legais.<br><br>

<strong>5. Planos e Pagamento</strong><br>
• <em>Plano Gratuito</em>: acesso a funcionalidades básicas com limite de consultas de IA por mês;<br>
• <em>Plano Pro</em>: acesso ilimitado ao Coach IA, processado pelo Hotmart/Kiwify;<br>
• Cancelamentos e reembolsos seguem a política do Hotmart/Kiwify (até 7 dias após a compra, conforme CDC Art. 49).<br><br>

<strong>6. Uso Aceitável</strong><br>
É proibido: usar o serviço para fins ilícitos; tentar burlar limites de quota; fazer engenharia reversa; usar o Coach IA para obter diagnósticos médicos ou prescrição de medicamentos.<br><br>

<strong>7. Propriedade Intelectual</strong><br>
O código, design e marca TITAN PRO são de propriedade dos desenvolvedores. Seus dados de treino pertencem a você.<br><br>

<strong>8. Disponibilidade</strong><br>
O serviço pode ter interrupções por manutenção ou falhas de infraestrutura. Não garantimos disponibilidade de 100%.<br><br>

<strong>9. Limitação de Responsabilidade</strong><br>
Na extensão máxima permitida por lei, o TITAN PRO não se responsabiliza por danos indiretos, incidentais ou consequentes decorrentes do uso do serviço.<br><br>

<strong>10. Alterações</strong><br>
Reservamos o direito de modificar estes termos com aviso prévio de 15 dias. O uso continuado após as alterações implica aceitação.<br><br>

<strong>11. Lei Aplicável</strong><br>
Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo/SP para dirimir eventuais conflitos.<br><br>

<strong>12. Contato</strong><br>
Para suporte ou dúvidas, utilize os canais de atendimento disponíveis no aplicativo.
    `
  }
};

function openLegalModal(type) {
  var modal = document.getElementById('legalModal');
  var titleEl = document.getElementById('legalTitle');
  var contentEl = document.getElementById('legalContent');
  if (!modal || !_legalDocs[type]) return;
  titleEl.textContent = _legalDocs[type].title;
  contentEl.innerHTML = _legalDocs[type].content;
  contentEl.scrollTop = 0;
  modal.style.display = 'block';
}

function closeLegalModal() {
  document.getElementById('legalModal').style.display = 'none';
}

// Fecha modais ao clicar no overlay
document.getElementById('planModal').addEventListener('click', function(e) {
  if (e.target === this) closePlanModal();
});
document.getElementById('legalModal').addEventListener('click', function(e) {
  if (e.target === this) closeLegalModal();
});

// Carrega plano ao autenticar
_sb.auth.onAuthStateChange(function(event, session) {
  if (session && session.user) {
    setTimeout(fetchUserPlan, 1000);
  } else {
    _userPlan = { plan: 'free', ai_requests_used: 0, limit: FREE_AI_LIMIT };
    updatePlanBadge();
  }
});
