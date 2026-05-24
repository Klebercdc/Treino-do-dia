/* KroniA Diet Entry Controller
 * Fluxo definitivo:
 * - Abrir Dieta: se houver plano salvo, abre dashboard.
 * - Abrir Dieta: se não houver plano salvo, abre anamnese.
 * - Gerar/Regenerar/Criar: sempre abre anamnese antes da IA.
 */
(function() {
  'use strict';

  var VERSION = '20260523-anamnese-first-v2';
  var RENDERER_ASSET = 'src/ui/diet/diet-plan-renderer.js';
  var WIZARD_ASSETS = [
    'src/ui/diet/diet-wizard-standalone.js',
    'src/ui/diet/diet-wizard.js'
  ];
  var LAST_PLAN_KEY = 'kronia_last_generated_diet';
  var ACTIVE_PROFILE_KEY = 'kronia_diet_anamnese_profile';
  var rendererPromise = null;
  var wizardPromise = null;
  var busy = false;

  function safeToast(message, type, duration) {
    try {
      if (typeof window.showToast === 'function') window.showToast(message, type || 'info', duration || 3000);
    } catch (_) {}
  }

  function loadScriptOnce(src, marker, testFn) {
    if (typeof testFn === 'function' && testFn()) return Promise.resolve(true);

    return new Promise(function(resolve) {
      var existing = document.querySelector('script[data-kronia-loader="' + marker + '"]');
      if (existing) existing.remove();

      var script = document.createElement('script');
      script.src = '/' + src + '?v=' + VERSION + '&t=' + Date.now();
      script.async = false;
      script.defer = false;
      script.dataset.kroniaLoader = marker;
      script.onload = function() { resolve(typeof testFn === 'function' ? !!testFn() : true); };
      script.onerror = function() { resolve(false); };
      document.head.appendChild(script);
    });
  }

  function loadRenderer() {
    if (window.__kroniaDietPlanRendererLoaded || typeof window.renderDietFromPlan === 'function') return Promise.resolve(true);
    if (rendererPromise) return rendererPromise;
    rendererPromise = loadScriptOnce(RENDERER_ASSET, 'diet-renderer', function() {
      return typeof window.renderDietFromPlan === 'function';
    });
    return rendererPromise;
  }

  function isRealWizardFunction(fn) {
    return typeof fn === 'function' && !fn.__kroniaDietEntryWrapper;
  }

  function clearWrapper(name) {
    try {
      if (window[name] && window[name].__kroniaDietEntryWrapper) delete window[name];
    } catch (_) {
      try { window[name] = undefined; } catch (__) {}
    }
  }

  function loadWizard() {
    if (isRealWizardFunction(window.openDietProfileWizard) || isRealWizardFunction(window.openDietWizardStandalone)) {
      return Promise.resolve(true);
    }
    if (wizardPromise) return wizardPromise;

    clearWrapper('openDietProfileWizard');
    clearWrapper('openDietWizardStandalone');
    clearWrapper('openNutritionFlow');
    clearWrapper('openNutritionWizard');
    clearWrapper('openDietWizard');

    wizardPromise = WIZARD_ASSETS.reduce(function(chain, src, index) {
      return chain.then(function(done) {
        if (done) return true;
        return loadScriptOnce(src, 'diet-wizard-' + index, function() {
          return isRealWizardFunction(window.openDietProfileWizard) || isRealWizardFunction(window.openDietWizardStandalone);
        });
      });
    }, Promise.resolve(false));

    return wizardPromise;
  }

  function hideLegacyScreens() {
    [
      'nutritionFlowScreen',
      'dietChoiceScreen',
      'dietEmergencyWizardScreen',
      'customModal',
      'configSheet',
      'timerSheet',
      'bottomSheet',
      'modalBackdrop'
    ].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show', 'active', 'open');
      el.style.setProperty('pointer-events', 'none', 'important');
      if (id !== 'bottomSheet' && id !== 'modalBackdrop') {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
      }
      el.setAttribute('aria-hidden', 'true');
    });

    try {
      ['kronia_diet_wizard_state_v1', 'kronia_diet_wizard_state_v2', 'kronia_diet_wizard_state_v6_standalone'].forEach(function(key) {
        localStorage.removeItem(key);
      });
    } catch (_) {}

    if (document.body) {
      document.body.classList.remove('nutrition-flow-active', 'kdw-active');
    }

    if (window.KroniaUI && typeof window.KroniaUI.unblockScreens === 'function') {
      window.KroniaUI.unblockScreens('diet-entry-controller');
    }
  }

  function readJson(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function hasSavedPlan() {
    try {
      if (localStorage.getItem(LAST_PLAN_KEY)) return true;
      if (typeof window.readLocalActiveDietPlan === 'function' && window.readLocalActiveDietPlan()) return true;
      if (window._kroniaDietPlan) return true;
    } catch (_) {}
    return false;
  }

  function hasCompleteAnamnese() {
    var profile = readJson(ACTIVE_PROFILE_KEY) || readJson('kronia_nutrition_profile_v1');
    if (!profile) return false;
    return Boolean(profile.objetivo && profile.sexo && profile.idade && profile.peso && profile.altura && profile.nivelAtividade && profile.refeicoesPorDia);
  }

  function buildGenerationPayload(profileData, context) {
    return Object.assign({
      source: 'kronia_diet_after_anamnese',
      profileData: profileData || null,
      profile: profileData || {},
      dietWizardPayload: profileData || {},
      forcePersonalized: true
    }, context || {});
  }

  function callDietGenerator(profileData, context) {
    var payload = buildGenerationPayload(profileData, context);
    var names = ['gerarDieta', 'generateAIDiet', 'generateDiet', 'createAIDiet', 'createDiet', 'startNutritionGeneration', 'startDietGeneration'];

    for (var i = 0; i < names.length; i += 1) {
      var fn = window[names[i]];
      if (typeof fn !== 'function') continue;
      if (fn.__kroniaDietEntryWrapper) continue;
      try {
        return fn.call(window, payload);
      } catch (err) {
        console.warn('[KRONIA_DIET] generator failed:', names[i], err);
      }
    }

    if (typeof window.openDietDataScreen === 'function') {
      window.openDietDataScreen();
      safeToast('Anamnese salva. O motor de geração não respondeu no runtime.', 'warning', 4000);
      return true;
    }

    safeToast('Anamnese salva, mas não encontrei o motor de geração.', 'error', 4000);
    return false;
  }

  async function openAnamneseFirst(context) {
    if (busy) return false;
    busy = true;

    try {
      hideLegacyScreens();
      try { if (typeof window.navTo === 'function') window.navTo('dieta'); } catch (_) {}
      await loadRenderer();
      await loadWizard();

      var payload = Object.assign({
        mode: 'regenerate',
        source: 'diet_entry_anamnese_first',
        forceAnamnese: true,
        skipAutoGenerate: true,
        onComplete: function(profileData) { return callDietGenerator(profileData, context || {}); },
        onFinish: function(profileData) { return callDietGenerator(profileData, context || {}); },
        onSubmit: function(profileData) { return callDietGenerator(profileData, context || {}); }
      }, context || {});

      var fn = isRealWizardFunction(window.openDietProfileWizard)
        ? window.openDietProfileWizard
        : isRealWizardFunction(window.openDietWizardStandalone)
          ? window.openDietWizardStandalone
          : null;

      if (!fn) {
        safeToast('Não consegui carregar a anamnese. Atualize a página.', 'error', 4500);
        return false;
      }

      var result = fn.call(window, payload);
      return result !== false;
    } finally {
      setTimeout(function() { busy = false; }, 500);
    }
  }

  function purgeLegacyWizard() {
    hideLegacyScreens();
  }

  async function openDietAnamneseFirstFlow(context) {
    return openAnamneseFirst(context);
  }

  async function loadDietWizardAssets() {
    return loadWizard();
  }

  async function generateDietAfterAnamnese(profileData, context) {
    return callDietGenerator(profileData, context);
  }

  function openDietGenerationFlow(context) {
    return openDietAnamneseFirstFlow(context);
  }

  async function openDietEntry(context) {
    hideLegacyScreens();

    if (!hasSavedPlan()) {
      return openAnamneseFirst(Object.assign({ source: 'diet_open_without_saved_plan' }, context || {}));
    }

    await loadRenderer();
    try { if (typeof window.navTo === 'function') window.navTo('dieta'); } catch (_) {}

    if (typeof window.openLastGeneratedDiet === 'function') {
      var rendered = window.openLastGeneratedDiet();
      if (rendered !== false) return rendered;
    }

    if (typeof window.openDietDataScreen === 'function') {
      window.openDietDataScreen();
      return true;
    }

    return openAnamneseFirst(Object.assign({ source: 'diet_open_fallback_to_anamnese' }, context || {}));
  }

  function isGenerateDietButton(target) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest([
      '#regenerateDietPlanBtn', '#dietRegeneratePlanBtn', '#createDietPlanBtn', '#dietCreatePlanBtn',
      '#generateDietPlanBtn', '#dietGeneratePlanBtn', '#btnGenerateDiet', '#btnCreateDiet',
      '[data-action="regenerate-diet"]', '[data-action="generate-diet"]', '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]', '[data-diet-action="generate"]', '[data-diet-action="create"]',
      '.regenerate-diet-plan', '.diet-regenerate-plan', '.generate-diet-plan', '.diet-generate-plan', '.create-diet-plan'
    ].join(','));
  }

  function isOpenDietButton(target) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest([
      '#openDietPlanBtn', '#viewDietPlanBtn', '#dietViewPlanBtn', '.home-hero-dieta',
      '[data-action="open-diet"]', '[data-action="view-diet"]',
      '[data-diet-action="open"]', '[data-diet-action="view"]',
      '.open-diet-plan', '.view-diet-plan'
    ].join(','));
  }

  function makeTouchable() {
    document.querySelectorAll([
      '#regenerateDietPlanBtn', '#dietRegeneratePlanBtn', '#createDietPlanBtn', '#dietCreatePlanBtn',
      '#generateDietPlanBtn', '#dietGeneratePlanBtn', '#btnGenerateDiet', '#btnCreateDiet',
      '#openDietPlanBtn', '#viewDietPlanBtn', '#dietViewPlanBtn', '.home-hero-dieta',
      '[data-action="regenerate-diet"]', '[data-action="generate-diet"]', '[data-action="create-diet"]',
      '[data-action="open-diet"]', '[data-action="view-diet"]',
      '[data-diet-action="regenerate"]', '[data-diet-action="generate"]', '[data-diet-action="create"]',
      '[data-diet-action="open"]', '[data-diet-action="view"]',
      '.regenerate-diet-plan', '.diet-regenerate-plan', '.generate-diet-plan', '.diet-generate-plan', '.create-diet-plan',
      '.open-diet-plan', '.view-diet-plan'
    ].join(',')).forEach(function(btn) {
      btn.style.pointerEvents = 'auto';
      btn.style.touchAction = 'manipulation';
      if (!btn.style.position) btn.style.position = 'relative';
      if (!btn.style.zIndex) btn.style.zIndex = '90';
      btn.setAttribute('aria-disabled', 'false');
    });
  }

  document.addEventListener('click', function(e) {
    var generateBtn = isGenerateDietButton(e.target);
    if (generateBtn) {
      e.preventDefault();
      e.stopPropagation();
      openAnamneseFirst({
        source: 'diet_generate_button_click',
        id: generateBtn.id || '',
        action: generateBtn.getAttribute('data-action') || generateBtn.getAttribute('data-diet-action') || ''
      });
      return;
    }

    var openBtn = isOpenDietButton(e.target);
    if (openBtn) {
      e.preventDefault();
      e.stopPropagation();
      openDietEntry({ source: 'diet_open_button_click', id: openBtn.id || '' });
    }
  }, true);

  function markWrapper(fn) {
    try { fn.__kroniaDietEntryWrapper = true; } catch (_) {}
    return fn;
  }

  window.KroniaDiet = Object.assign({}, window.KroniaDiet || {}, {
    open: openDietEntry,
    generate: openAnamneseFirst,
    ai: openAnamneseFirst,
    createPlan: openAnamneseFirst,
    regenerate: openAnamneseFirst,
    viewLastPlan: openDietEntry,
    bindButtons: makeTouchable,
    hideLegacyScreens: hideLegacyScreens,
    hasCompleteAnamnese: hasCompleteAnamnese,
    loadRenderer: loadRenderer
  });

  window.openDietaSheet = markWrapper(openDietEntry);
  window.startAIDiet = markWrapper(openAnamneseFirst);
  window.createAnotherDiet = markWrapper(openAnamneseFirst);
  window.createDietPlan = markWrapper(openAnamneseFirst);
  window.generateDietPlan = markWrapper(openAnamneseFirst);
  window.regenerateDiet = markWrapper(openAnamneseFirst);
  window.regenerateDietPlan = markWrapper(openAnamneseFirst);
  window.regeneratePlan = markWrapper(openAnamneseFirst);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      makeTouchable();
      loadRenderer();
    }, { once: true });
  } else {
    makeTouchable();
    loadRenderer();
  }
})();
