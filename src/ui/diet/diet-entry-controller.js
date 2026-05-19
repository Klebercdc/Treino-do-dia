/* KroniA Diet Entry Controller
 * Correção: separa abrir dieta existente de gerar nova dieta.
 */
(function() {
  'use strict';

  var RENDERER_ASSET = 'src/ui/diet/diet-plan-renderer.js';
  var VERSION = '20260518-generate-diet-flow';
  var rendererPromise = null;
  var opening = false;
  var generating = false;
  var LAST_PLAN_KEY = 'kronia_last_generated_diet';

  var LEGACY_WIZARD_SCREEN_ID = ['diet', 'Profile', 'Wizard', 'Screen'].join('');
  var LEGACY_WIZARD_STATE_KEYS = [
    'kronia_diet_wizard_state_v1',
    'kronia_diet_wizard_state_v2',
    'kronia_diet_wizard_state_v6_standalone'
  ];

  function safeToast(message, type, duration) {
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(message, type || 'info', duration || 3000);
      }
    } catch (_) {}
  }

  function loadScriptOnce(src, marker, testFn) {
    if (typeof testFn === 'function' && testFn()) return Promise.resolve(true);

    return new Promise(function(resolve) {
      var existing = document.querySelector('script[data-kronia-loader="' + marker + '"]');
      if (existing) existing.remove();

      var s = document.createElement('script');
      s.src = '/' + src + '?v=' + VERSION + '&t=' + Date.now();
      s.async = false;
      s.defer = false;
      s.dataset.kroniaLoader = marker;

      s.onload = function() {
        resolve(typeof testFn === 'function' ? !!testFn() : true);
      };

      s.onerror = function() {
        resolve(false);
      };

      document.head.appendChild(s);
    });
  }

  function loadRenderer() {
    if (window.__kroniaDietPlanRendererLoaded || typeof window.renderDietFromPlan === 'function') {
      return Promise.resolve(true);
    }

    if (rendererPromise) return rendererPromise;

    rendererPromise = loadScriptOnce(RENDERER_ASSET, 'diet-renderer', function() {
      return typeof window.renderDietFromPlan === 'function';
    });

    return rendererPromise;
  }

  function purgeLegacyWizard() {
    LEGACY_WIZARD_STATE_KEYS.forEach(function(key) {
      try { localStorage.removeItem(key); } catch (_) {}
    });

    var oldWizard = document.getElementById(LEGACY_WIZARD_SCREEN_ID);
    if (oldWizard) oldWizard.remove();

    if (document.body) {
      document.body.classList.remove('diet-wizard-active', 'kdw-active', 'overlay-open');
    }
  }

  function hideLegacyScreens() {
    purgeLegacyWizard();

    [
      'nutritionFlowScreen',
      'dietChoiceScreen',
      'dietEmergencyWizardScreen',
      'customModal',
      'configSheet',
      'timerSheet'
    ].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;

      el.classList.remove('show', 'active', 'open');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    });

    if (document.body) {
      document.body.classList.remove(
        'nutrition-flow-active',
        'diet-wizard-active',
        'kdw-active',
        'overlay-open'
      );
    }

    if (window.KroniaUI && typeof window.KroniaUI.unblockScreens === 'function') {
      window.KroniaUI.unblockScreens('diet-entry-hide-legacy');
    }
  }

  function hasLastGeneratedDiet() {
    try {
      return !!localStorage.getItem(LAST_PLAN_KEY);
    } catch (_) {
      return false;
    }
  }

  async function openPremiumDiet(context) {
    if (opening) return false;
    opening = true;

    try {
      hideLegacyScreens();
      await loadRenderer();

      if (hasLastGeneratedDiet() && typeof window.openLastGeneratedDiet === 'function') {
        var rendered = window.openLastGeneratedDiet();
        if (rendered !== false) return rendered;
      }

      if (typeof window.openDietDataScreen === 'function') {
        try {
          if (
            typeof window.readLocalActiveDietPlan === 'function' &&
            !window.readLocalActiveDietPlan() &&
            typeof window.buildFallbackActiveDietPlan === 'function' &&
            typeof window.setActiveDietPlan === 'function'
          ) {
            window.setActiveDietPlan(window.buildFallbackActiveDietPlan(), { render: false });
          }
        } catch (_) {}

        try {
          if (typeof window.navTo === 'function') window.navTo('dieta');
        } catch (_) {}

        window.openDietDataScreen();
        hideLegacyScreens();
        return true;
      }

      safeToast('Não consegui abrir a tela de dieta. Atualize a página e tente novamente.', 'error', 3500);
      return false;
    } finally {
      setTimeout(function() {
        opening = false;
      }, 250);
    }
  }

  function callFirstAvailable(functionNames, context) {
    for (var i = 0; i < functionNames.length; i++) {
      var name = functionNames[i];
      var fn = window[name];

      if (typeof fn !== 'function') continue;
      if (fn === openDietGenerationFlow) continue;
      if (fn === openDietAnamneseFirstFlow) continue;
      if (fn.__kroniaDietEntryWrapper) continue;

      try {
        return {
          called: true,
          value: fn.call(window, context || {})
        };
      } catch (err) {
        console.warn('[KroniA Diet] Falha ao chamar ' + name, err);
      }
    }

    return { called: false, value: false };
  }

  var WIZARD_ASSETS = [
    'src/ui/diet/diet-wizard-standalone.js',
    'src/ui/diet/diet-wizard.js'
  ];

  function unwrapDietProfileWizardIfNeeded() {
    try {
      if (
        typeof window.openDietProfileWizard === 'function' &&
        window.openDietProfileWizard.__kroniaDietEntryWrapper
      ) {
        delete window.openDietProfileWizard;
      }
    } catch (_) {
      try { window.openDietProfileWizard = undefined; } catch (__) {}
    }
  }

  async function loadDietWizardAssets() {
    unwrapDietProfileWizardIfNeeded();

    for (var i = 0; i < WIZARD_ASSETS.length; i++) {
      var src = WIZARD_ASSETS[i];

      await loadScriptOnce(src, 'diet-anamnese-' + i, function() {
        return (
          typeof window.openDietProfileWizard === 'function' &&
          !window.openDietProfileWizard.__kroniaDietEntryWrapper
        ) || (
          typeof window.openDietWizardStandalone === 'function' &&
          !window.openDietWizardStandalone.__kroniaDietEntryWrapper
        );
      });

      if (
        typeof window.openDietProfileWizard === 'function' &&
        !window.openDietProfileWizard.__kroniaDietEntryWrapper
      ) return true;

      if (
        typeof window.openDietWizardStandalone === 'function' &&
        !window.openDietWizardStandalone.__kroniaDietEntryWrapper
      ) return true;
    }

    return false;
  }

  async function generateDietAfterAnamnese(profileData, context) {
    safeToast('Gerando sua dieta com IA...', 'info', 2500);

    var generation = callFirstAvailable([
      'gerarDieta',
      'generateAIDiet',
      'generateDiet',
      'createAIDiet',
      'createDiet',
      'startNutritionGeneration',
      'startDietGeneration'
    ], Object.assign({
      source: 'kronia_diet_after_anamnese',
      profileData: profileData || null
    }, context || {}));

    if (generation.called) return generation.value;

    if (typeof window.openDietDataScreen === 'function') {
      window.openDietDataScreen();
      safeToast('Anamnese concluída. Motor de geração não encontrado no runtime.', 'warning', 4500);
      return true;
    }

    safeToast('Anamnese concluída, mas não encontrei o motor de geração da dieta.', 'error', 4500);
    return false;
  }

  async function openDietAnamneseFirstFlow(context) {
    if (generating) return false;
    generating = true;

    try {
      hideLegacyScreens();

      try {
        if (typeof window.navTo === 'function') window.navTo('dieta');
      } catch (_) {}

      await loadRenderer();
      await loadDietWizardAssets();

      var payload = Object.assign({
        mode: context && context.mode ? context.mode : 'regenerate',
        source: 'diet_ai_card_anamnese_first',
        forceAnamnese: true,
        skipAutoGenerate: true,
        onComplete: function(profileData) {
          return generateDietAfterAnamnese(profileData, context || {});
        },
        onFinish: function(profileData) {
          return generateDietAfterAnamnese(profileData, context || {});
        },
        onSubmit: function(profileData) {
          return generateDietAfterAnamnese(profileData, context || {});
        }
      }, context || {});

      var candidates = [
        'openDietProfileWizard',
        'openDietWizardStandalone',
        'openNutritionFlow',
        'openDietSetupWizard',
        'openDietGenerationWizard',
        'openNutritionWizard',
        'openDietWizard'
      ];

      for (var i = 0; i < candidates.length; i++) {
        var name = candidates[i];
        var fn = window[name];

        if (typeof fn !== 'function') continue;
        if (fn.__kroniaDietEntryWrapper) continue;
        if (fn === openDietAnamneseFirstFlow) continue;
        if (fn === openDietGenerationFlow) continue;

        try {
          var result = fn.call(window, payload);
          if (result !== false) return result;
        } catch (err) {
          console.warn('[KRONIA_DIET_FLOW] Falha ao abrir anamnese via ' + name, err);
        }
      }

      safeToast('Não encontrei a anamnese da dieta no runtime. Verifique diet-wizard e exports.', 'error', 5000);
      return false;
    } finally {
      setTimeout(function() {
        generating = false;
      }, 350);
    }
  }

  async function openDietGenerationFlow(context) {
    return openDietAnamneseFirstFlow(Object.assign({
      mode: 'regenerate',
      source: 'diet_generation_entry_redirected_to_anamnese'
    }, context || {}));
  }

  function isGenerateDietButton(target) {
    if (!target || typeof target.closest !== 'function') return null;

    return target.closest([
      '#regenerateDietPlanBtn',
      '#dietRegeneratePlanBtn',
      '#createDietPlanBtn',
      '#dietCreatePlanBtn',
      '#generateDietPlanBtn',
      '#dietGeneratePlanBtn',
      '#btnGenerateDiet',
      '#btnCreateDiet',
      '[data-action="regenerate-diet"]',
      '[data-action="generate-diet"]',
      '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]',
      '[data-diet-action="generate"]',
      '[data-diet-action="create"]',
      '.regenerate-diet-plan',
      '.diet-regenerate-plan',
      '.generate-diet-plan',
      '.diet-generate-plan',
      '.create-diet-plan'
    ].join(','));
  }

  function isOpenDietButton(target) {
    if (!target || typeof target.closest !== 'function') return null;

    return target.closest([
      '#openDietPlanBtn',
      '#viewDietPlanBtn',
      '#dietViewPlanBtn',
      '[data-action="open-diet"]',
      '[data-action="view-diet"]',
      '[data-diet-action="open"]',
      '[data-diet-action="view"]',
      '.open-diet-plan',
      '.view-diet-plan'
    ].join(','));
  }

  function makeTouchable() {
    document.querySelectorAll([
      '#regenerateDietPlanBtn',
      '#dietRegeneratePlanBtn',
      '#createDietPlanBtn',
      '#dietCreatePlanBtn',
      '#generateDietPlanBtn',
      '#dietGeneratePlanBtn',
      '#btnGenerateDiet',
      '#btnCreateDiet',
      '#openDietPlanBtn',
      '#viewDietPlanBtn',
      '#dietViewPlanBtn',
      '[data-action="regenerate-diet"]',
      '[data-action="generate-diet"]',
      '[data-action="create-diet"]',
      '[data-action="open-diet"]',
      '[data-action="view-diet"]',
      '[data-diet-action="regenerate"]',
      '[data-diet-action="generate"]',
      '[data-diet-action="create"]',
      '[data-diet-action="open"]',
      '[data-diet-action="view"]',
      '.regenerate-diet-plan',
      '.diet-regenerate-plan',
      '.generate-diet-plan',
      '.diet-generate-plan',
      '.create-diet-plan',
      '.open-diet-plan',
      '.view-diet-plan'
    ].join(',')).forEach(function(btn) {
      btn.style.pointerEvents = 'auto';
      btn.style.touchAction = 'manipulation';

      if (!btn.style.position) btn.style.position = 'relative';
      if (!btn.style.zIndex) btn.style.zIndex = '80';

      btn.setAttribute('aria-disabled', 'false');
    });
  }

  document.addEventListener('click', function(e) {
    var generateBtn = isGenerateDietButton(e.target);

    if (generateBtn) {
      e.preventDefault();
      e.stopPropagation();
      openDietGenerationFlow({
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
      openPremiumDiet({
        source: 'diet_open_button_click',
        id: openBtn.id || ''
      });
    }
  }, true);

  function markWrapper(fn) {
    try {
      fn.__kroniaDietEntryWrapper = true;
    } catch (_) {}
    return fn;
  }

  window.KroniaDiet = Object.assign({}, window.KroniaDiet || {}, {
    open: openPremiumDiet,
    generate: openDietAnamneseFirstFlow,
    ai: openDietAnamneseFirstFlow,
    createPlan: openDietAnamneseFirstFlow,
    regenerate: openDietAnamneseFirstFlow,
    viewLastPlan: openPremiumDiet,
    bindButtons: makeTouchable,
    hideLegacyScreens: hideLegacyScreens,
    loadRenderer: loadRenderer
  });

  window.startAIDiet = markWrapper(openDietAnamneseFirstFlow);
  window.createDietPlan = markWrapper(openDietAnamneseFirstFlow);
  window.generateDietPlan = markWrapper(openDietAnamneseFirstFlow);
  window.regenerateDiet = markWrapper(openDietAnamneseFirstFlow);
  window.regenerateDietPlan = markWrapper(openDietAnamneseFirstFlow);
  window.regeneratePlan = markWrapper(openDietAnamneseFirstFlow);

  /* Marked wrapper so loadDietWizardAssets knows it's not the real wizard form. */
  window.openDietProfileWizard = markWrapper(openDietGenerationFlow);

  /*
   * Chamadas antigas de nutrition flow só viram fallback para geração.
   * O callFirstAvailable ignora wrappers marcados para evitar recursão.
   */
  window.openNutritionFlow = markWrapper(function(context) {
    return openDietGenerationFlow(Object.assign({
      source: 'open_nutrition_flow_compat'
    }, context || {}));
  });

  window.openNutritionFlowFull = markWrapper(function(context) {
    return openDietGenerationFlow(Object.assign({
      source: 'open_nutrition_flow_full_compat'
    }, context || {}));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      makeTouchable();
      hideLegacyScreens();
      loadRenderer();
    }, { once: true });
  } else {
    makeTouchable();
    hideLegacyScreens();
    loadRenderer();
  }
})();
