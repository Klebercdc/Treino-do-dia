/* KroniA Diet Entry Controller — rota única para a tela premium atual */
(function(){
  var RENDERER_ASSET = 'src/ui/diet/diet-plan-renderer.js';
  var VERSION = '20260502-fix-nav';
  var rendererPromise = null;
  var opening = false;
  var LAST_PLAN_KEY = 'kronia_last_generated_diet';
  var LEGACY_WIZARD_SCREEN_ID = ['diet', 'Profile', 'Wizard', 'Screen'].join('');
  var LEGACY_WIZARD_STATE_KEYS = [
    'kronia_diet_wizard_state_v1',
    'kronia_diet_wizard_state_v2',
    'kronia_diet_wizard_state_v6_standalone'
  ];

  function loadScriptOnce(src, marker, testFn){
    if (typeof testFn === 'function' && testFn()) return Promise.resolve(true);
    return new Promise(function(resolve){
      var existing = document.querySelector('script[data-kronia-loader="' + marker + '"]');
      if (existing) existing.remove();
      var s = document.createElement('script');
      s.src = '/' + src + '?v=' + VERSION + '&t=' + Date.now();
      s.async = false;
      s.defer = false;
      s.dataset.kroniaLoader = marker;
      s.onload = function(){ resolve(typeof testFn === 'function' ? !!testFn() : true); };
      s.onerror = function(){ resolve(false); };
      document.head.appendChild(s);
    });
  }

  function loadRenderer(){
    if (window.__kroniaDietPlanRendererLoaded || typeof window.renderDietFromPlan === 'function') return Promise.resolve(true);
    if (rendererPromise) return rendererPromise;
    rendererPromise = loadScriptOnce(RENDERER_ASSET, 'diet-renderer', function(){ return typeof window.renderDietFromPlan === 'function'; });
    return rendererPromise;
  }

  function purgeLegacyWizard(){
    LEGACY_WIZARD_STATE_KEYS.forEach(function(key){
      try { localStorage.removeItem(key); } catch (_) {}
    });
    var oldWizard = document.getElementById(LEGACY_WIZARD_SCREEN_ID);
    if (oldWizard) oldWizard.remove();
    document.body && document.body.classList.remove('diet-wizard-active', 'kdw-active');
  }

  function hideLegacyScreens(){
    purgeLegacyWizard();
    ['nutritionFlowScreen','dietChoiceScreen','dietEmergencyWizardScreen','customModal','configSheet','timerSheet'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show', 'active', 'open');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.setAttribute('aria-hidden','true');
    });
    document.body && document.body.classList.remove('nutrition-flow-active', 'diet-wizard-active', 'kdw-active', 'overlay-open');
    if (window.KroniaUI && typeof window.KroniaUI.unblockScreens === 'function') {
      window.KroniaUI.unblockScreens('diet-entry-hide-legacy');
    }
  }

  function hasLastGeneratedDiet(){
    try { return !!localStorage.getItem(LAST_PLAN_KEY); } catch(_) { return false; }
  }

  async function openPremiumDiet(context){
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
          if (typeof window.readLocalActiveDietPlan === 'function' && !window.readLocalActiveDietPlan() && typeof window.buildFallbackActiveDietPlan === 'function' && typeof window.setActiveDietPlan === 'function') {
            window.setActiveDietPlan(window.buildFallbackActiveDietPlan(), { render: false });
          }
        } catch (_) {}
        try { if (typeof window.navTo === 'function') window.navTo('dieta'); } catch (_) {}
        window.openDietDataScreen();
        hideLegacyScreens();
        return true;
      }
      if (typeof window.showToast === 'function') window.showToast('Não consegui abrir a tela de dieta. Atualize a página e tente novamente.', 'error', 3500);
      return false;
    } finally {
      setTimeout(function(){ opening = false; }, 250);
    }
  }

  function isDietButton(target){
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest([
      '#regenerateDietPlanBtn', '#dietRegeneratePlanBtn', '#createDietPlanBtn', '#dietCreatePlanBtn',
      '#generateDietPlanBtn', '#dietGeneratePlanBtn', '#btnGenerateDiet', '#btnCreateDiet',
      '[data-action="regenerate-diet"]', '[data-action="generate-diet"]', '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]', '[data-diet-action="generate"]', '[data-diet-action="create"]',
      '.regenerate-diet-plan', '.diet-regenerate-plan', '.generate-diet-plan', '.diet-generate-plan', '.create-diet-plan'
    ].join(','));
  }

  function makeTouchable(){
    document.querySelectorAll([
      '#regenerateDietPlanBtn', '#dietRegeneratePlanBtn', '#createDietPlanBtn', '#dietCreatePlanBtn',
      '#generateDietPlanBtn', '#dietGeneratePlanBtn', '#btnGenerateDiet', '#btnCreateDiet',
      '[data-action="regenerate-diet"]', '[data-action="generate-diet"]', '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]', '[data-diet-action="generate"]', '[data-diet-action="create"]',
      '.regenerate-diet-plan', '.diet-regenerate-plan', '.generate-diet-plan', '.diet-generate-plan', '.create-diet-plan'
    ].join(',')).forEach(function(btn){
      btn.style.pointerEvents = 'auto';
      btn.style.touchAction = 'manipulation';
      if (!btn.style.position) btn.style.position = 'relative';
      if (!btn.style.zIndex) btn.style.zIndex = '80';
      btn.setAttribute('aria-disabled','false');
    });
  }

  document.addEventListener('click', function(e){
    var btn = isDietButton(e.target);
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openPremiumDiet({ source:'diet_button_click' });
  }, true);

  function triggerAIDietGeneration() {
    if (typeof window.preencherDietaDosPerfil === 'function') {
      try { window.preencherDietaDosPerfil(); } catch (_) {}
    }
    try { if (typeof window.navTo === 'function') window.navTo('dieta'); } catch (_) {}
    hideLegacyScreens();
    if (typeof window.openDietDataScreen === 'function') {
      try { window.openDietDataScreen(); } catch (_) {}
    }
    if (typeof window.gerarDieta === 'function') return window.gerarDieta();
    return openPremiumDiet({ source: 'ai_diet_gerarDieta_missing' });
  }

  window.KroniaDiet = Object.assign({}, window.KroniaDiet || {}, {
    open: openPremiumDiet,
    ai: triggerAIDietGeneration,
    createPlan: triggerAIDietGeneration,
    regenerate: triggerAIDietGeneration,
    viewLastPlan: openPremiumDiet,
    bindButtons: makeTouchable,
    hideLegacyScreens: hideLegacyScreens,
    loadRenderer: loadRenderer
  });

  window.startAIDiet = triggerAIDietGeneration;
  window.createDietPlan = triggerAIDietGeneration;
  window.generateDietPlan = triggerAIDietGeneration;
  window.regenerateDiet = triggerAIDietGeneration;
  window.regenerateDietPlan = triggerAIDietGeneration;
  window.regeneratePlan = triggerAIDietGeneration;
  window.openNutritionFlow = function(){ return window.KroniaDiet.open({ source:'open_nutrition_flow_disabled' }); };
  window.openNutritionFlowFull = function(){ return window.KroniaDiet.open({ source:'open_nutrition_flow_full_disabled' }); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ makeTouchable(); hideLegacyScreens(); loadRenderer(); }, { once: true });
  } else {
    makeTouchable();
    hideLegacyScreens();
    loadRenderer();
  }

  window[['open', 'Diet', 'Profile', 'Wizard'].join('')] = function removedDietProfileWizard(){
    return openPremiumDiet({ source: 'legacy_profile_wizard_removed', forceNew: true });
  };
})();
