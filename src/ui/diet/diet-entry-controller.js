/*
 * KroniA Diet Entry Controller
 * Ponto único e estável para entrada nos fluxos de dieta.
 * Estratégia fora da caixa: o botão não depende mais de cache antigo, ordem de scripts
 * ou do service worker. Ele tenta abrir o wizard já carregado, injeta os scripts sob demanda
 * e, se algum asset falhar, monta uma tela mínima segura para não deixar o usuário travado.
 */
(function () {
  var DIET_WIZARD_ASSETS = [
    'src/ui/diet/diet-wizard-state.js',
    'src/ui/diet/diet-step-body.js',
    'src/ui/diet/diet-step-goal.js',
    'src/ui/diet/diet-step-health.js',
    'src/ui/diet/diet-step-food.js',
    'src/ui/diet/diet-step-training.js',
    'src/ui/diet/diet-step-metabolism.js',
    'src/ui/diet/diet-summary.js',
    'src/ui/diet/diet-wizard.js'
  ];

  var VERSION = '20260428-diet-entry-hard-fix';
  var wizardLoadPromise = null;

  function getUserId() {
    try {
      return (
        (window.currentUser && (window.currentUser.id || window.currentUser.uid)) ||
        (window.authUser && window.authUser.id) ||
        null
      );
    } catch (_) {
      return null;
    }
  }

  function toast(message, type) {
    var text = message || 'Não foi possível abrir a criação da dieta.';
    if (typeof window.showToast === 'function') return window.showToast(text, type || 'error', 3800);
    try { window.alert(text); } catch (_) {}
  }

  function hideLegacyQuestionnaire() {
    ['nutritionFlowScreen', 'dietChoiceScreen', 'dietDataScreen', 'customModal', 'configSheet', 'timerSheet'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show');
      if (id === 'nutritionFlowScreen') {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function absoluteAssetUrl(path) {
    var base = document.querySelector('base')?.href || window.location.origin + '/';
    return new URL(path, base).toString() + '?v=' + VERSION + '&t=' + Date.now();
  }

  function loadScriptOnce(path) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-kronia-diet-asset="' + path + '"]');
      if (existing && existing.dataset.loaded === '1') return resolve(true);
      if (existing) {
        existing.addEventListener('load', function () { resolve(true); }, { once: true });
        existing.addEventListener('error', function () { reject(new Error('Falha ao carregar ' + path)); }, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.src = absoluteAssetUrl(path);
      script.async = false;
      script.defer = false;
      script.dataset.kroniaDietAsset = path;
      script.onload = function () { script.dataset.loaded = '1'; resolve(true); };
      script.onerror = function () { reject(new Error('Falha ao carregar ' + path)); };
      document.head.appendChild(script);
    });
  }

  function ensureWizardLoaded() {
    if (typeof window.openDietProfileWizard === 'function') return Promise.resolve(true);
    if (!wizardLoadPromise) {
      wizardLoadPromise = DIET_WIZARD_ASSETS.reduce(function (chain, path) {
        return chain.then(function () { return loadScriptOnce(path); });
      }, Promise.resolve()).then(function () {
        return typeof window.openDietProfileWizard === 'function';
      }).catch(function (err) {
        console.error('[KroniaDiet] erro ao carregar wizard completo', err);
        return false;
      });
    }
    return wizardLoadPromise;
  }

  function createEmergencyWizard(payload) {
    var old = document.getElementById('dietEmergencyWizardScreen');
    if (old) old.remove();

    var screen = document.createElement('div');
    screen.id = 'dietEmergencyWizardScreen';
    screen.style.cssText = 'position:fixed;inset:0;z-index:13000;background:#07090f;color:#fff;display:flex;flex-direction:column;font-family:Inter,Arial,sans-serif;';
    screen.innerHTML = [
      '<div style="padding:18px 16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:12px">',
        '<button type="button" id="dietEmergencyClose" style="width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:18px">‹</button>',
        '<div style="min-width:0;flex:1">',
          '<div style="font-size:11px;letter-spacing:.12em;color:#22c55e;font-weight:800;text-transform:uppercase">Dieta</div>',
          '<div style="font-size:20px;font-weight:900;letter-spacing:-.04em">Criar plano alimentar</div>',
        '</div>',
      '</div>',
      '<div style="padding:20px 16px;overflow:auto;flex:1">',
        '<div style="border:1px solid rgba(34,197,94,.22);background:linear-gradient(180deg,rgba(34,197,94,.12),rgba(255,255,255,.035));border-radius:22px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.35)">',
          '<div style="font-size:24px;font-weight:900;line-height:1.05;margin-bottom:10px">Vamos montar sua dieta premium</div>',
          '<p style="color:rgba(255,255,255,.72);line-height:1.45;margin:0 0 16px;font-size:14px">O módulo completo não carregou pelo cache do aparelho. Esta tela segura abre a geração com os dados já disponíveis e evita travar o app.</p>',
          '<button type="button" id="dietEmergencyGenerate" style="width:100%;border:0;border-radius:16px;background:#22c55e;color:#06110a;font-weight:900;font-size:15px;padding:15px;box-shadow:0 0 28px rgba(34,197,94,.28)">Gerar dieta agora</button>',
          '<button type="button" id="dietEmergencyRetry" style="width:100%;margin-top:10px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.06);color:#fff;font-weight:800;font-size:14px;padding:14px">Tentar carregar wizard completo</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(screen);
    document.body.classList.add('diet-wizard-active');

    screen.querySelector('#dietEmergencyClose').onclick = function () {
      screen.remove();
      document.body.classList.remove('diet-wizard-active');
    };

    screen.querySelector('#dietEmergencyRetry').onclick = async function () {
      wizardLoadPromise = null;
      var ok = await ensureWizardLoaded();
      if (ok && typeof window.openDietProfileWizard === 'function') {
        screen.remove();
        document.body.classList.remove('diet-wizard-active');
        window.openDietProfileWizard(getUserId(), Object.assign({ forceNew: true, source: 'diet_emergency_retry' }, payload || {}));
      } else {
        toast('Ainda não consegui carregar o wizard completo. Vou manter o modo seguro.', 'warning');
      }
    };

    screen.querySelector('#dietEmergencyGenerate').onclick = async function () {
      screen.remove();
      document.body.classList.remove('diet-wizard-active');
      if (typeof window.openNutritionFlowFull === 'function') {
        return window.openNutritionFlowFull({ autoGenerate: true, source: 'diet_emergency_wizard', dietWizardPayload: payload || {} });
      }
      if (typeof window.openNutritionFlow === 'function') {
        return window.openNutritionFlow({ source: 'diet_emergency_wizard', returnTab: 'dieta', dietWizardPayload: payload || {} });
      }
      try {
        if (typeof window.navTo === 'function') window.navTo('dieta');
        if (typeof window.openDietDataScreen === 'function') window.openDietDataScreen();
      } catch (_) {}
    };

    return true;
  }

  async function openWizard(context) {
    var payload = Object.assign({ source: 'diet_entry_controller', forceNew: true }, context || {});
    hideLegacyQuestionnaire();

    if (typeof window.openDietProfileWizard === 'function') {
      return window.openDietProfileWizard(getUserId(), payload);
    }

    var loaded = await ensureWizardLoaded();
    if (loaded && typeof window.openDietProfileWizard === 'function') {
      return window.openDietProfileWizard(getUserId(), payload);
    }

    return createEmergencyWizard(payload);
  }

  function openManual() {
    if (typeof window.startManualDiet === 'function') return window.startManualDiet();
    if (typeof window.openManualDiet === 'function') return window.openManualDiet();
    return createEmergencyWizard({ source: 'diet_manual_unavailable' });
  }

  function isDietCreateOrRegenerateTarget(target) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest([
      '#regenerateDietPlanBtn', '#dietRegeneratePlanBtn', '#createDietPlanBtn', '#dietCreatePlanBtn',
      '[data-action="regenerate-diet"]', '[data-action="generate-diet"]', '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]', '[data-diet-action="generate"]', '[data-diet-action="create"]',
      '.regenerate-diet-plan', '.diet-regenerate-plan', '.generate-diet-plan', '.diet-generate-plan'
    ].join(','));
  }

  function ensureDietActionButtonIsTouchable(button) {
    if (!button || !button.style) return;
    button.style.pointerEvents = 'auto';
    button.style.touchAction = 'manipulation';
    if (!button.style.position) button.style.position = 'relative';
    if (!button.style.zIndex) button.style.zIndex = '30';
  }

  function bindExistingButtons() {
    document.querySelectorAll([
      '#regenerateDietPlanBtn', '#dietRegeneratePlanBtn', '#createDietPlanBtn', '#dietCreatePlanBtn',
      '[data-action="regenerate-diet"]', '[data-action="generate-diet"]', '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]', '[data-diet-action="generate"]', '[data-diet-action="create"]',
      '.regenerate-diet-plan', '.diet-regenerate-plan', '.generate-diet-plan', '.diet-generate-plan'
    ].join(',')).forEach(ensureDietActionButtonIsTouchable);
  }

  window.KroniaDiet = {
    open: function (context) { return openWizard(context || { source: 'diet_entry_open' }); },
    ai: function () { return openWizard({ source: 'diet_entry_ai' }); },
    createPlan: function () { return openWizard({ source: 'diet_entry_create_plan' }); },
    regenerate: function () { return openWizard({ source: 'diet_entry_regenerate_plan' }); },
    manual: openManual,
    bindButtons: bindExistingButtons,
    ensureWizardLoaded: ensureWizardLoaded,
    emergency: createEmergencyWizard
  };

  document.addEventListener('click', function (event) {
    var button = isDietCreateOrRegenerateTarget(event.target);
    if (!button) return;
    ensureDietActionButtonIsTouchable(button);
    event.preventDefault();
    event.stopPropagation();
    window.KroniaDiet.regenerate();
  }, true);

  document.addEventListener('DOMContentLoaded', bindExistingButtons);
  setTimeout(bindExistingButtons, 250);
  setTimeout(bindExistingButtons, 1000);
  setTimeout(bindExistingButtons, 2500);

  window.startAIDiet = function () { return window.KroniaDiet.ai(); };
  window.createDietPlan = function () { return window.KroniaDiet.createPlan(); };
  window.regenerateDiet = function () { return window.KroniaDiet.regenerate(); };
  window.regenerateDietPlan = function () { return window.KroniaDiet.regenerate(); };
  window.regeneratePlan = function () { return window.KroniaDiet.regenerate(); };
})();
