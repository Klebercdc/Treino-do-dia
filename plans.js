// ══════════════════════════════
// CONFIGURAÇÃO DO PLANO
// ══════════════════════════════
var HOTMART_CHECKOUT_URL       = '';
var HOTMART_CHECKOUT_URL_ULTRA = '';
var FREE_AI_LIMIT = 5; // Free: 5/mês; sobrescrito após fetch do /api/config

var _configPromise = (function fetchConfigWithRetry(attempt) {
  return fetch(location.origin + '/api/config')
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(cfg) {
      if (cfg.checkoutUrl)        HOTMART_CHECKOUT_URL = cfg.checkoutUrl;
      if (cfg.checkoutUrlUltra)   HOTMART_CHECKOUT_URL_ULTRA = cfg.checkoutUrlUltra;
      if (cfg.freePlanLimit)      FREE_AI_LIMIT = cfg.freePlanLimit;
      if (cfg.trialDays)          TRIAL_DAYS = Number(cfg.trialDays) || TRIAL_DAYS;
    })
    .catch(function() {
      if (attempt < 3) {
        return new Promise(function(res) { setTimeout(res, 1000 * attempt); })
          .then(function() { return fetchConfigWithRetry(attempt + 1); });
      }
    });
})(1);

var _userPlan = {
  plan: 'free',
  ai_requests_used: 0,
  limit: FREE_AI_LIMIT,
  trial_started_at: null,
  trial_expires_at: null,
  trial_status: null
};
window._userPlan = Object.assign({}, _userPlan);

function syncPlanContext() {
  window._userPlan = Object.assign({}, _userPlan);

  if (window.KroniaAccessScope && typeof window.KroniaAccessScope.buildUserCapabilities === 'function') {
    window.currentUserCapabilities = window.KroniaAccessScope.buildUserCapabilities({
      accessProfile: getCurrentAccessProfile(),
      planContext: window._userPlan
    });

    if (typeof window.KroniaAccessScope.setupAdminDebug === 'function') {
      window.KroniaAccessScope.setupAdminDebug();
    }
  }
}
window.KroniaAccessProfile = {
  email: '',
  isAuthenticated: false,
  isAdmin: false,
  isDeveloper: false,
  canBypassQuota: false,
  canSeeDevTools: false,
  canSeeAdminUI: false,
  canSeeTestFeatures: false,
  source: 'unknown'
};
var INTERNAL_FEATURES = Object.freeze({
  adminPanel: true,
  devTools: true,
  providerTest: true,
  fakeDataTools: true,
  experimentalWorkoutFlow: true,
  experimentalDietFlow: true,
  forceUnlimitedPlan: true,
  viewRawApiResponses: true
});

function getCurrentAccessProfile() {
  return window.KroniaAccessProfile || {};
}
function isCurrentUserAdmin() { return !!getCurrentAccessProfile().isAdmin; }
function isCurrentUserDeveloper() { return !!getCurrentAccessProfile().isDeveloper; }
function canShowDevFeatures() { return !!getCurrentAccessProfile().canSeeDevTools; }
function canShowAdminFeatures() { return !!getCurrentAccessProfile().canSeeAdminUI; }
function canShowTestFeatures() { return !!getCurrentAccessProfile().canSeeTestFeatures; }
function isInternalFeatureEnabled(flagName, accessProfile) {
  if (!INTERNAL_FEATURES[flagName]) return false;
  var profile = accessProfile || getCurrentAccessProfile();
  return !!(profile.canSeeDevTools || profile.canSeeAdminUI || profile.canSeeTestFeatures);
}
function showElementForAdmin(selector) {
  if (!canShowAdminFeatures()) return;
  document.querySelectorAll(selector).forEach(function(el) { el.style.display = ''; });
}
function showElementForDev(selector) {
  if (!canShowDevFeatures()) return;
  document.querySelectorAll(selector).forEach(function(el) { el.style.display = ''; });
}
function hideElementForNonAdmin(selector) {
  if (canShowAdminFeatures()) return;
  document.querySelectorAll(selector).forEach(function(el) { el.style.display = 'none'; });
}
function maybeRenderDevSection(container, renderer) {
  if (!canShowDevFeatures()) return;
  if (!container || typeof renderer !== 'function') return;
  renderer(container, getCurrentAccessProfile());
}

function hydrateAccessProfileFromPlan(planPayload) {
  var data = planPayload || {};
  var email = String(data.email || '').trim().toLowerCase();
  window.KroniaAccessProfile = {
    email: email,
    isAuthenticated: !!email,
    isAdmin: !!data.isAdmin,
    isDeveloper: !!data.isDeveloper,
    canBypassQuota: !!data.canBypassQuota,
    canSeeDevTools: !!(data.canSeeDevTools || data.isDeveloper || data.isAdmin),
    canSeeAdminUI: !!(data.canSeeAdminUI || data.isAdmin),
    canSeeTestFeatures: !!(data.canSeeTestFeatures || data.isDeveloper || data.isAdmin),
    source: data.accessMode || 'plan_current'
  };

  if (window.KroniaAccessScope && typeof window.KroniaAccessScope.buildUserCapabilities === 'function') {
    window.currentUserCapabilities = window.KroniaAccessScope.buildUserCapabilities(window.KroniaAccessProfile);
    if (typeof window.KroniaAccessScope.setupAdminDebug === 'function') {
      window.KroniaAccessScope.setupAdminDebug();
    }
  }

  if (window.KroniaObservability && typeof window.KroniaObservability.logAuthDecision === 'function') {
    window.KroniaObservability.logAuthDecision('plan_hydration', {
      user_email: email || null,
      is_admin: !!window.KroniaAccessProfile.isAdmin,
      source: window.KroniaAccessProfile.source
    });
  }
}


function normalizePlanId(plan) {
  var normalized = String(plan || '').trim().toLowerCase();
  if (normalized === 'trial_ultra_7_days' || normalized === 'trial') return 'trial_ultra_7_days';
  if (normalized === 'pro' || normalized === 'ultra' || normalized === 'free') return normalized;
  return 'free';
}

function getPlanDisplayLabel() {
  var plan = normalizePlanId(_userPlan.plan);
  var trial = getTrialStatus();
  var inTrial = !!(trial && trial.active && plan !== 'pro' && plan !== 'ultra');

  if (plan === 'ultra') return 'ULTRA';
  if (plan === 'pro') return 'PRO';
  if (inTrial) return 'TRIAL';
  return 'FREE';
}

// ══════════════════════════════
// SISTEMA DE TRIAL — 7 DIAS
// ══════════════════════════════
var TRIAL_DAYS = 7;
var TRIAL_AI_LIMIT = 30; // queries durante o trial

function initTrial() {
  // Trial agora é controlado no backend; função mantida por compatibilidade.
}

function getTrialStatus() {
  if (_userPlan.trial_status && typeof _userPlan.trial_status === 'object') {
    return _userPlan.trial_status;
  }
  return null;
}

// ══════════════════════════════
// FETCH DO PLANO DO USUÁRIO
// ══════════════════════════════
async function fetchUserPlan() {
  try {
    var session = (await _sb.auth.getSession()).data.session;
    if (!session) return;
    var currentResp = await apiFetch('/api/plan-current');
    if (!currentResp.ok) throw new Error('plan-current');
    var current = await currentResp.json();
    hydrateAccessProfileFromPlan(current);

    var featuresResp = await apiFetch('/api/plan-features');
    var features = null;
    if (featuresResp.ok) features = await featuresResp.json();

    var usage = typeof current.aiRequestsUsed === 'number'
      ? current.aiRequestsUsed
      : (features && features.quota ? Number(features.quota.used || 0) : 0);
    var quotaLimit = features && features.quota && Number.isFinite(Number(features.quota.limit))
      ? Number(features.quota.limit)
      : (normalizePlanId(current.plan) === 'trial_ultra_7_days' ? TRIAL_AI_LIMIT : FREE_AI_LIMIT);

    _userPlan = {
      plan: normalizePlanId(current.effectivePlan || current.plan),
      rawPlan: normalizePlanId(current.rawPlanCanonical || current.rawPlan),
      effectiveAccess: current.effectiveAccess || 'standard',
      canBypassQuota: !!current.canBypassQuota,
      ai_requests_used: usage,
      trial_started_at: current.trialStartedAt || null,
      trial_expires_at: current.trialExpiresAt || null,
      trial_status: current.trialStatus && typeof current.trialStatus === 'object' ? current.trialStatus : null,
      limit: quotaLimit
    };
    syncPlanContext();
    updatePlanBadge();
  } catch(e) { /* silencioso */ }
}

// ══════════════════════════════
// ATUALIZA BADGE DO PLANO (visível na home)
// ══════════════════════════════
function updatePlanBadge() {
  var accessProfile = getCurrentAccessProfile();
  var plan    = _userPlan.plan;
  var isUltra = plan === 'ultra';
  var isPro   = plan === 'pro' || isUltra;
  var trial   = getTrialStatus();
  var inTrial = trial && trial.active && !isPro;
  var trialDaysLeft = trial && Number.isFinite(Number(trial.daysLeft)) ? Math.max(0, Number(trial.daysLeft)) : null;
  var trialDaysLabel = trialDaysLeft === null ? '—' : String(trialDaysLeft);

  renderAdminPlanInspection({
    plan: plan,
    isUltra: isUltra,
    isPro: isPro,
    inTrial: inTrial,
    rem: Math.max(0, (Number.isFinite(Number(_userPlan.limit)) ? Number(_userPlan.limit) : FREE_AI_LIMIT) - Number(_userPlan.ai_requests_used || 0)),
    activeLimit: Number.isFinite(Number(_userPlan.limit)) ? Number(_userPlan.limit) : FREE_AI_LIMIT
  });
  var activeLimit = Number.isFinite(Number(_userPlan.limit))
    ? Number(_userPlan.limit)
    : (inTrial ? TRIAL_AI_LIMIT : FREE_AI_LIMIT);
  var rem     = Math.max(0, activeLimit - _userPlan.ai_requests_used);

  // ── Badge visível no topo da home ──
  var homeBadge = document.getElementById('homePlanBadge');
  if (homeBadge) {
    homeBadge.className = '';
    var _zapIco = '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    var _crownIco = '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>';
    if (isCurrentUserAdmin()) {
      homeBadge.innerHTML = _crownIco + ' ADMIN · ' + getPlanDisplayLabel();
      homeBadge.className = 'badge-ultra';
    } else if (isUltra) {
      homeBadge.innerHTML = _crownIco + ' ULTRA';
      homeBadge.className = 'badge-ultra';
    } else if (isPro) {
      homeBadge.innerHTML = _zapIco + ' PRO';
      homeBadge.className = 'badge-pro';
    } else if (inTrial) {
      homeBadge.innerHTML = _zapIco + ' TRIAL · ' + trialDaysLabel + 'd';
      homeBadge.className = 'badge-trial';
    } else {
      homeBadge.textContent = 'FREE · ' + rem + '/' + FREE_AI_LIMIT;
    }
  }

  // ── Trial strip na home ──
  var trialStrip = document.getElementById('homeTrialStrip');
  if (trialStrip) {
    trialStrip.style.display = (inTrial && !isPro) ? 'flex' : 'none';
    if (inTrial) {
      var titleEl = document.getElementById('homeTrialTitle');
      var subEl   = document.getElementById('homeTrialSub');
      var daysEl  = document.getElementById('homeTrialDays');
      if (titleEl) titleEl.textContent = trialDaysLeft === 1 ? 'Trial expira amanhã!' : 'Trial ULTRA ativo';
      if (subEl)   subEl.textContent   = (trialDaysLeft !== null && trialDaysLeft <= 2)
        ? 'Assine agora e não perca o acesso ⚡'
        : trialDaysLabel + ' dias restantes de acesso completo';
      if (daysEl)  daysEl.textContent  = trialDaysLabel + 'd';
      if (daysEl && trialDaysLeft !== null && trialDaysLeft <= 2) daysEl.style.color = '#ef4444';
    }
  }

  // ── Banner de upgrade na home ──
  var homeBanner  = document.getElementById('homeUpgradeBanner');
  var homeSubtext = document.getElementById('homeUpgradeSubtext');
  if (homeBanner) {
    if (accessProfile.canBypassQuota || isPro) {
      homeBanner.style.display = 'none';
    } else if (inTrial) {
      homeBanner.style.display = 'none'; // trial strip já aparece
    } else {
      homeBanner.style.display = 'flex';
      if (homeSubtext) {
        if (rem === 0) {
          homeSubtext.textContent = 'Limite esgotado — vá de ULTRA para liberar IA + transforms + PDF premium + análise avançada';
        } else if (rem <= 2) {
          homeSubtext.textContent = 'ULTRA é o próximo passo: transforms, PDF premium e análise avançada · PRO como alternativa intermediária';
        } else {
          homeSubtext.textContent = 'ULTRA: Transforms + PDF premium + análise avançada · PRO como opção intermediária';
        }
      }
      homeBanner.style.borderColor = rem === 0 ? 'rgba(239,68,68,0.4)'
        : rem <= 2 ? 'rgba(168,85,247,0.55)' : 'rgba(168,85,247,0.3)';
    }
  }

  // ── Chip de quota no KRONOS ──
  var orientChip = document.getElementById('orientQuotaChip');
  var orientText = document.getElementById('orientQuotaText');
  if (orientChip) {
    if (accessProfile.canBypassQuota || isPro) {
      orientChip.style.display = 'none';
    } else {
      orientChip.style.display = 'block';
      if (orientText) {
        orientText.textContent = rem === 0 ? 'Limite atingido' : rem + ' restante' + (rem === 1 ? '' : 's');
        orientText.style.color = rem === 0 ? '#ef4444' : rem <= 2 ? 'var(--accent)' : 'var(--text-2)';
      }
    }
  }

  // ── Badge no menu de conta (settings) ──
  var badge = document.getElementById('authMenuPlanBadge');
  if (badge) {
    if (isCurrentUserAdmin()) {
      badge.textContent = 'ADMIN · ' + getPlanDisplayLabel();
      badge.style.background = 'rgba(168,85,247,0.3)';
      badge.style.color = '#c084fc';
    } else if (isUltra) {
      badge.textContent = 'ULTRA';
      badge.style.background = 'rgba(168,85,247,0.3)';
      badge.style.color = '#c084fc';
    } else if (isPro) {
      badge.textContent = 'PRO';
      badge.style.background = 'rgba(249,115,22,0.3)';
      badge.style.color = 'var(--accent)';
    } else if (inTrial) {
      badge.textContent = 'TRIAL';
      badge.style.background = 'rgba(168,85,247,0.2)';
      badge.style.color = '#c084fc';
    } else {
      badge.textContent = 'FREE · ' + rem + '/' + FREE_AI_LIMIT;
      badge.style.background = rem <= 2 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)';
      badge.style.color = rem <= 2 ? '#ef4444' : 'var(--text-2)';
    }
  }

  // ── Texto no modal de plano (free limit) ──
  var freeLimitTxt = document.getElementById('freeLimitText');
  if (freeLimitTxt) freeLimitTxt.textContent = FREE_AI_LIMIT + ' consultas de IA por mês';
  var freeQueryLimitTxt = document.getElementById('freeQueryLimitTxt');
  if (freeQueryLimitTxt) freeQueryLimitTxt.textContent = FREE_AI_LIMIT + ' consultas IA/mês';
  maybeRenderDevSection(document.getElementById('authMenuPlanBadge') && document.getElementById('authMenuPlanBadge').parentElement, function(container) {
    if (container.querySelector('[data-internal-tools]')) return;
    var el = document.createElement('div');
    el.setAttribute('data-internal-tools', '1');
    el.style.cssText = 'margin-top:8px;font-size:0.7rem;color:#a78bfa;opacity:0.9';
    el.textContent = 'Ferramentas internas habilitadas';
    container.appendChild(el);
  });

  renderAdminPlanInspection({
    plan: plan,
    isUltra: isUltra,
    isPro: isPro,
    inTrial: inTrial,
    rem: rem,
    activeLimit: activeLimit
  });
}

function renderAdminPlanInspection(state) {
  if (!isCurrentUserAdmin()) return;
  var modal = document.getElementById('planModal');
  if (!modal) return;
  var container = document.getElementById('planAdminInspection');
  if (!container) {
    container = document.createElement('div');
    container.id = 'planAdminInspection';
    container.className = 'plan-admin-inspection';
    var parent = document.getElementById('planCarousel') || modal.querySelector('.plan-modal-card') || modal;
    parent.appendChild(container);
  }
  var trial = getTrialStatus();
  container.innerHTML = [
    '<details class="plan-admin-inspection-details">',
    '<summary>Admin Plan Inspection</summary>',
    '<div class="plan-admin-inspection-grid">',
    '<div>raw_plan=' + String((_userPlan.rawPlan || _userPlan.plan || 'n/a')) + '</div>',
    '<div>effective_plan=' + String(_userPlan.plan || 'n/a') + ' · effective_access=' + String(_userPlan.effectiveAccess || 'standard') + '</div>',
    '<div>trial_active=' + (!!(trial && trial.active)) + ' · trial_days_left=' + String(trial && trial.daysLeft != null ? trial.daysLeft : 'n/a') + '</div>',
    '<div>quota_used=' + String(_userPlan.ai_requests_used || 0) + '/' + String(state && state.activeLimit != null ? state.activeLimit : 'n/a') + ' · remaining=' + String(state && state.rem != null ? state.rem : 'n/a') + '</div>',
    '<div>gating_reason=' + (state && state.isPro ? 'paid_or_ultra' : (state && state.inTrial ? 'trial_window' : 'free_plan_limited')) + '</div>',
    '</div>',
    '</details>'
  ].join('');
}

// ══════════════════════════════
// MODAL DE PLANOS
// ══════════════════════════════
var _planCarouselIdx = 2; // começa no ULTRA
var _planBilling = 'mensal';

function openPlanModal() {
  try { window.KroniaIntelligence?.track?.({ module: 'monetization', action: 'premium_modal_open', status: 'success', source: 'plans_modal' }); } catch (_) {}
  var modal = document.getElementById('planModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.classList.add('overlay-open');

  var plan    = _userPlan.plan;
  var isUltra = plan === 'ultra';
  var isPro   = plan === 'pro' || isUltra;
  var trial   = getTrialStatus();
  var inTrial = trial && trial.active && !isPro;
  var trialDaysLeft = trial && Number.isFinite(Number(trial.daysLeft)) ? Math.max(0, Number(trial.daysLeft)) : null;
  var trialDaysLabel = trialDaysLeft === null ? '—' : String(trialDaysLeft);

  // Trial banner
  var trialBanner = document.getElementById('planTrialBanner');
  if (trialBanner) {
    trialBanner.style.display = inTrial ? 'block' : 'none';
    if (inTrial) {
      var t = document.getElementById('planTrialTitle');
      var s = document.getElementById('planTrialSub');
      if (t) t.textContent = (trialDaysLeft !== null && trialDaysLeft <= 2)
        ? '⚠️ Trial expira em ' + trialDaysLabel + ' dia' + (trialDaysLeft === 1 ? '' : 's') + '!'
        : 'Trial ULTRA ativo — ' + trialDaysLabel + ' dias restantes';
      if (s) s.textContent = inTrial
        ? 'Você está com acesso completo do ULTRA durante o trial'
        : '';
    }
  }

  // Status do plano atual
  var statusEl = document.getElementById('planStatusMsg');
  if (statusEl) {
    if (isUltra) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(168,85,247,0.12)';
      statusEl.style.border = '1px solid rgba(168,85,247,0.3)';
      statusEl.style.color = '#c084fc';
      statusEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>Você está no plano ULTRA. Obrigado!';
    } else if (isPro) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(249,115,22,0.1)';
      statusEl.style.border = '1px solid rgba(249,115,22,0.3)';
      statusEl.style.color = 'var(--accent)';
      statusEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Você está no plano PRO. Obrigado!';
    } else {
      statusEl.style.display = 'none';
    }
  }

  // Uso atual no card FREE
  var usageEl = document.getElementById('planFreeUsage');
  if (usageEl) {
    if (!isPro) {
      var currentLimit = inTrial ? TRIAL_AI_LIMIT : FREE_AI_LIMIT;
      var rem = Math.max(0, currentLimit - _userPlan.ai_requests_used);
      usageEl.textContent = 'Você usou ' + _userPlan.ai_requests_used + ' de ' + currentLimit + ' consultas este mês (' + rem + ' restantes)';
      usageEl.style.display = 'block';
    } else {
      usageEl.style.display = 'none';
    }
  }

  // Scroll para o plano correto
  var targetIdx = isUltra ? 2 : (isPro ? 1 : 2);
  setTimeout(function() { scrollPlanTo(targetIdx); }, 80);

  // Atualizar preços
  setPlanBilling(_planBilling);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePlanModal() {
  var modal = document.getElementById('planModal');
  if (modal) modal.style.display = 'none';
  document.body.classList.remove('overlay-open');
}

// ── Carousel navigation (tab-based) ──
function scrollPlanTo(idx) {
  _planCarouselIdx = idx;
  // Mostra apenas o slide correto
  [0, 1, 2].forEach(function(i) {
    var slide = document.getElementById('planSlide' + i);
    if (slide) slide.style.display = (i === idx) ? 'block' : 'none';
  });
  // Reset scroll do container ao topo
  var carousel = document.getElementById('planCarousel');
  if (carousel) carousel.scrollTop = 0;
  updatePlanDots(idx);
  updatePlanCTA(idx);
}

function onPlanCarouselScroll(el) {
  // Não usado na versão tab — mantido por compatibilidade
}

function updatePlanDots(idx) {
  // Atualiza tabs de seleção de plano
  var colors  = ['rgba(255,255,255,0.14)', 'var(--accent)', 'linear-gradient(135deg,#a855f7,#7c3aed)'];
  var tcolors = ['rgba(255,255,255,0.85)', '#fff', '#fff'];
  [0, 1, 2].forEach(function(i) {
    var tab = document.getElementById('planTab' + i);
    if (!tab) return;
    if (i === idx) {
      tab.style.background = colors[i];
      tab.style.color      = tcolors[i];
    } else {
      tab.style.background = 'transparent';
      tab.style.color      = 'rgba(255,255,255,0.35)';
    }
  });
}

function updatePlanCTA(idx) {
  var btn = document.getElementById('planCTA');
  if (!btn) return;
  var plan = _userPlan.plan;
  var isPro = plan === 'pro' || plan === 'ultra';

  if (idx === 0) { // FREE
    btn.style.background = 'rgba(255,255,255,0.1)';
    btn.style.border = '1px solid rgba(255,255,255,0.15)';
    btn.textContent = isPro ? 'Gerenciar assinatura' : 'Continuar grátis';
  } else if (idx === 1) { // PRO
    btn.style.background = 'var(--accent)';
    btn.style.border = 'none';
    var proPrice = _planBilling === 'anual' ? 'R$20,93/mês' : 'R$29,90/mês';
    var zapSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    btn.innerHTML = plan === 'pro' ? 'Gerenciar PRO' : '<span style="display:flex;align-items:center;justify-content:center;gap:6px">' + zapSvg + 'Assinar PRO — ' + proPrice + '</span>';
  } else { // ULTRA
    btn.style.background = 'linear-gradient(135deg,#a855f7,#7c3aed)';
    btn.style.border = 'none';
    var ultraPrice = _planBilling === 'anual' ? 'R$41,93/mês' : 'R$59,90/mês';
    var crownSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>';
    btn.innerHTML = plan === 'ultra' ? 'Gerenciar ULTRA' : '<span style="display:flex;align-items:center;justify-content:center;gap:6px">' + crownSvg + 'Assinar ULTRA — ' + ultraPrice + '</span>';
  }
}

function onPlanCTA() {
  var idx = _planCarouselIdx;
  if (idx === 0) { closePlanModal(); }
  else if (idx === 1) { assinarPro(); }
  else { assinarUltra(); }
}

function setPlanBilling(mode) {
  _planBilling = mode;
  var btnM = document.getElementById('planBtnMensal');
  var btnA = document.getElementById('planBtnAnual');
  if (btnM) { btnM.style.background = mode === 'mensal' ? 'rgba(255,255,255,0.14)' : 'transparent'; btnM.style.color = mode === 'mensal' ? '#fff' : 'rgba(255,255,255,0.45)'; }
  if (btnA) { btnA.style.background = mode === 'anual'  ? 'rgba(255,255,255,0.14)' : 'transparent'; btnA.style.color = mode === 'anual'  ? '#fff' : 'rgba(255,255,255,0.45)'; }

  // Preços PRO
  var pp = document.getElementById('planProPrice');
  var pc = document.getElementById('planProCents');
  var pp2 = document.getElementById('planProPeriod');
  if (pp) pp.textContent  = mode === 'anual' ? 'R$20' : 'R$29';
  if (pc) pc.textContent  = mode === 'anual' ? ',93' : ',90';
  if (pp2) pp2.textContent = mode === 'anual' ? '/mês (anual)' : '/mês';

  // Preços ULTRA
  var up = document.getElementById('planUltraPrice');
  var uc = document.getElementById('planUltraCents');
  var up2 = document.getElementById('planUltraPeriod');
  if (up) up.textContent  = mode === 'anual' ? 'R$41' : 'R$59';
  if (uc) uc.textContent  = mode === 'anual' ? ',93' : ',90';
  if (up2) up2.textContent = mode === 'anual' ? '/mês (anual)' : '/mês';

  // Sync pricing screen
  if (typeof setPricingBilling === 'function') setPricingBilling(mode);

  updatePlanCTA(_planCarouselIdx);
}

// ── Init: garante que o slide ULTRA aparece por padrão ──
document.addEventListener('DOMContentLoaded', function() {
  // planSlide2 (ULTRA) é o default — o JS inicializa via openPlanModal → scrollPlanTo
});

// ══════════════════════════════
// CHECKOUT
// ══════════════════════════════
async function assinarPro() {
  var startedAt = Date.now();
  var correlationId = 'upgrade_pro_' + startedAt;
  try { window.KroniaIntelligence?.track?.({ module: 'monetization', action: 'upgrade_attempt', status: 'start', correlationId: correlationId, source: 'plans_checkout', metadata: { plan: 'pro' } }); } catch (_) {}
  await _configPromise;
  if (!HOTMART_CHECKOUT_URL) {
    try { window.KroniaIntelligence?.track?.({ module: 'monetization', action: 'upgrade_attempt', status: 'error', correlationId: correlationId, durationMs: Date.now() - startedAt, source: 'plans_checkout', metadata: { plan: 'pro', reason: 'checkout_url_missing' } }); } catch (_) {}
    if (typeof showToast === 'function') showToast('Checkout em breve. Fale com o suporte.', 'warning');
    return;
  }
  try {
    var session = (await _sb.auth.getSession()).data.session;
    var email = session && session.user && session.user.email ? '?email=' + encodeURIComponent(session.user.email) : '';
    window.open(HOTMART_CHECKOUT_URL + email, '_blank');
    try { window.KroniaIntelligence?.track?.({ module: 'monetization', action: 'upgrade_attempt', status: 'success', correlationId: correlationId, durationMs: Date.now() - startedAt, source: 'plans_checkout', metadata: { plan: 'pro' } }); } catch (_) {}
  } catch(e) { window.open(HOTMART_CHECKOUT_URL, '_blank'); }
}

async function assinarUltra() {
  var startedAt = Date.now();
  var correlationId = 'upgrade_ultra_' + startedAt;
  try { window.KroniaIntelligence?.track?.({ module: 'monetization', action: 'upgrade_attempt', status: 'start', correlationId: correlationId, source: 'plans_checkout', metadata: { plan: 'ultra' } }); } catch (_) {}
  await _configPromise;
  var url = HOTMART_CHECKOUT_URL_ULTRA || HOTMART_CHECKOUT_URL;
  if (!url) {
    try { window.KroniaIntelligence?.track?.({ module: 'monetization', action: 'upgrade_attempt', status: 'error', correlationId: correlationId, durationMs: Date.now() - startedAt, source: 'plans_checkout', metadata: { plan: 'ultra', reason: 'checkout_url_missing' } }); } catch (_) {}
    if (typeof showToast === 'function') showToast('Checkout Ultra em breve. Fale com o suporte.', 'warning');
    return;
  }
  try {
    var session = (await _sb.auth.getSession()).data.session;
    var email = session && session.user && session.user.email ? '?email=' + encodeURIComponent(session.user.email) : '';
    window.open(url + email + (email ? '&plan=ultra' : '?plan=ultra'), '_blank');
    try { window.KroniaIntelligence?.track?.({ module: 'monetization', action: 'upgrade_attempt', status: 'success', correlationId: correlationId, durationMs: Date.now() - startedAt, source: 'plans_checkout', metadata: { plan: 'ultra' } }); } catch (_) {}
  } catch(e) { window.open(url, '_blank'); }
}

// ══════════════════════════════
// PAYWALL
// ══════════════════════════════
function showPaywall(msg) {
  if (canShowAdminFeatures() || canShowDevFeatures()) return;
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

// Intercepta respostas 402 (quota excedida)
var _originalFetch = window.fetch;
window.fetch = async function(url, opts) {
  var resp = await _originalFetch.apply(this, arguments);
  if (resp.status === 402 && typeof url === 'string' && url.startsWith('/api/')) {
    if (canShowAdminFeatures() || canShowDevFeatures()) return resp;
    try {
      var json = await resp.clone().json();
      if (json.code === 'QUOTA_EXCEEDED') {
        _userPlan.ai_requests_used = json.used || FREE_AI_LIMIT;
        syncPlanContext();
        updatePlanBadge();
        showPaywall(json.error || 'Limite do plano gratuito atingido. Faça upgrade para continuar.');
      }
    } catch(e) {}
  }
  return resp;
};

// ══════════════════════════════
// EXPORTAR DADOS (LGPD)
// ══════════════════════════════
async function exportUserData() {
  showToast('Preparando seus dados para exportação…', 'info', 3000);
  try {
    var resp = await apiFetch('/api/lgpd-export');
    if (!resp.ok) throw new Error('Falha');
    var blob = await resp.blob();
    var url  = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'kronia-meus-dados.json';
    document.body.appendChild(a); a.click();
    setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 1000);
    showToast('Dados exportados com sucesso!', 'success', 3000);
  } catch(e) { showToast('Erro ao exportar dados. Tente novamente.', 'error', 4000); }
}

// ══════════════════════════════
// EXCLUIR CONTA (LGPD)
// ══════════════════════════════
function confirmDeleteAccount() {
  var c1 = window.confirm('ATENÇÃO: Esta ação é irreversível.\n\nTodos os seus dados serão permanentemente excluídos, conforme a LGPD (Art. 18, VI).\n\nDeseja continuar?');
  if (!c1) return;
  var c2 = window.confirm('Tem certeza absoluta? Esta ação NÃO pode ser desfeita.');
  if (!c2) return;
  deleteAccount();
}

async function deleteAccount() {
  showToast('Excluindo sua conta…', 'info', 5000);
  try {
    var resp = await apiFetch('/api/lgpd-delete', { method: 'POST' });
    var json = await resp.json();
    if (json.ok) {
      showToast('Conta excluída. Obrigado por usar o KRONIA.', 'success', 5000);
      setTimeout(function() { window.location.reload(); }, 3000);
    } else {
      showToast('Erro ao excluir conta: ' + (json.error || 'tente novamente'), 'error', 5000);
    }
  } catch(e) { showToast('Erro de conexão ao excluir conta.', 'error', 4000); }
}

// ══════════════════════════════
// DOCUMENTOS LEGAIS
// ══════════════════════════════
var _legalDocs = {
privacy: { title: 'Política de Privacidade — LGPD', content: `
<strong>Última atualização: março de 2026</strong><br><br>
<strong>1. Responsável pelo Tratamento</strong><br>
KRONIA (treino-do-dia-orpin.vercel.app) é responsável pelo tratamento dos seus dados pessoais, nos termos da Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).<br><br>
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
• <em>NVIDIA</em> — API de IA para processamento de mensagens do Coach;<br>
• <em>Vercel Inc.</em> — hospedagem da aplicação;<br>
• <em>Hotmart/Kiwify</em> — processamento de pagamentos (planos Pro e Ultra).<br>
Não vendemos dados pessoais a terceiros.<br><br>
<strong>6. Retenção de Dados</strong><br>
Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão, os dados são removidos em até 72 horas.<br><br>
<strong>7. Seus Direitos (Art. 18, LGPD)</strong><br>
• <em>Exportar dados</em>: Menu de conta → "Exportar meus dados"<br>
• <em>Excluir conta</em>: Menu de conta → "Meu Plano" → "Excluir conta"<br><br>
<strong>8. Contato do DPO</strong><br>
Para dúvidas sobre privacidade, entre em contato através do suporte disponível no app.
`},
terms: { title: 'Termos de Uso', content: `
<strong>Última atualização: março de 2026</strong><br><br>
<strong>1. Aceitação dos Termos</strong><br>
Ao criar uma conta e usar o KRONIA, você concorda com estes Termos de Uso.<br><br>
<strong>2. Descrição do Serviço</strong><br>
O KRONIA é um aplicativo de registro e planejamento de treinos musculares, com funcionalidades de inteligência artificial para sugestão de exercícios, análise de progresso e coaching personalizado.<br><br>
<strong>3. ⚠️ DISCLAIMER — SAÚDE E EXERCÍCIO FÍSICO</strong><br>
<span style="color:#f97316;font-weight:600">O KRONIA não substitui avaliação médica ou orientação profissional.</span><br><br>
• As sugestões de treino geradas pela IA devem ser adaptadas por um profissional de Educação Física;<br>
• Consulte um médico antes de iniciar qualquer programa de exercícios;<br>
• Os desenvolvedores do KRONIA não se responsabilizam por lesões decorrentes do uso do app.<br><br>
<strong>4. Planos e Pagamento</strong><br>
• <em>Plano Gratuito</em>: acesso básico com 5 consultas de IA por mês;<br>
• <em>Trial de 7 dias</em>: acesso ULTRA completo nos primeiros 7 dias após cadastro;<br>
• <em>Plano Pro</em>: R$29,90/mês — treino com IA, dieta com IA, chat com IA e análise premium intermediária;<br>
• <em>Plano Ultra</em>: R$59,90/mês — tudo do Pro + KRONIA TRANSFORMS, PDF premium e análise premium avançada;<br>
• Cancelamentos seguem a política do Hotmart/Kiwify (até 7 dias após a compra, CDC Art. 49).<br><br>
<strong>5. Uso Aceitável</strong><br>
É proibido: usar o serviço para fins ilícitos; tentar burlar limites de quota; fazer engenharia reversa.<br><br>
<strong>6. Lei Aplicável</strong><br>
Estes termos são regidos pelas leis brasileiras. Foro: comarca de São Paulo/SP.
`}
};

function openLegalModal(type) {
  var modal    = document.getElementById('legalModal');
  var titleEl  = document.getElementById('legalTitle');
  var contentEl = document.getElementById('legalContent');
  if (!modal || !_legalDocs[type]) return;
  titleEl.textContent  = _legalDocs[type].title;
  contentEl.innerHTML  = _legalDocs[type].content;
  contentEl.scrollTop  = 0;
  modal.style.display  = 'block';
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

// Fallback de plano ao autenticar (bootstrap principal ocorre em auth.js)
_sb.auth.onAuthStateChange(function(event, session) {
  if (session && session.user) {
    if (!_userPlan || !_userPlan.plan) {
      fetchUserPlan().catch(function() {});
    }
  } else {
    _userPlan = { plan: 'free', ai_requests_used: 0, trial_started_at: null, limit: FREE_AI_LIMIT };
    updatePlanBadge();
  }
});
