/* KroniA Diet Entry Controller — rota única e segura para criação/regeneração de dieta */
(function(){
  var ASSET = 'src/ui/diet/diet-wizard-standalone.js';
  var RENDERER_ASSET = 'src/ui/diet/diet-plan-renderer.js';
  var VERSION = '20260428-diet-button-stable-v8-renderer';
  var loadingPromise = null;
  var rendererPromise = null;
  var originalOpenNutritionFlow = window.openNutritionFlow;
  var originalOpenNutritionFlowFull = window.openNutritionFlowFull;
  var opening = false;

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

  function loadStandalone(){
    if (window.__kroniaDietWizardStandaloneLoaded && typeof window.openDietProfileWizard === 'function') return Promise.resolve(true);
    if (loadingPromise) return loadingPromise;
    loadingPromise = Promise.all([
      loadRenderer(),
      loadScriptOnce(ASSET, 'diet-standalone', function(){ return typeof window.openDietProfileWizard === 'function'; })
    ]).then(function(results){ return !!results[1]; }).catch(function(){ loadingPromise = null; return false; });
    return loadingPromise;
  }

  function getUserId(){
    try { return (window.currentUser && (window.currentUser.id || window.currentUser.uid)) || (window.authUser && window.authUser.id) || null; }
    catch(_) { return null; }
  }

  function hideOldDietScreens(){
    ['nutritionFlowScreen','dietChoiceScreen','dietDataScreen','dietEmergencyWizardScreen','customModal','configSheet','timerSheet'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show');
      el.style.display = 'none';
      el.setAttribute('aria-hidden','true');
      el.style.pointerEvents = 'none';
    });
  }

  async function open(context){
    if (opening) return false;
    opening = true;
    try {
      hideOldDietScreens();
      await loadRenderer();
      var ok = await loadStandalone();
      hideOldDietScreens();
      if (ok && typeof window.openDietProfileWizard === 'function') {
        return window.openDietProfileWizard(getUserId(), Object.assign({ forceNew:true, source:'diet_entry_controller_button' }, context || {}));
      }
      if (typeof window.showToast === 'function') window.showToast('Não consegui abrir a criação de dieta. Atualize a página e tente novamente.', 'error', 3500);
      else alert('Não consegui abrir a criação de dieta. Atualize a página e tente novamente.');
      return false;
    } finally {
      setTimeout(function(){ opening = false; }, 350);
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

  function isLegacyCreateContext(args){
    var ctx = args && args[0];
    if (!ctx) return true;
    if (ctx && typeof ctx === 'object') {
      var src = String(ctx.source || ctx.from || ctx.mode || '');
      if (ctx.autoGenerate || ctx.dietWizardPayload) return false;
      return /diet|wizard|create|generate|regenerate|button|fallback|ai/i.test(src) || ctx.returnTab === 'dieta';
    }
    return true;
  }

  document.addEventListener('click', function(e){
    var btn = isDietButton(e.target);
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    open({ source:'diet_button_click' });
  }, true);

  window.KroniaDiet = Object.assign({}, window.KroniaDiet || {}, {
    open: open,
    ai: function(){ return open({ source:'diet_ai' }); },
    createPlan: function(){ return open({ source:'diet_create_plan' }); },
    regenerate: function(){ return open({ source:'diet_regenerate_plan' }); },
    viewLastPlan: async function(){ await loadRenderer(); return typeof window.openLastGeneratedDiet === 'function' ? window.openLastGeneratedDiet() : false; },
    bindButtons: makeTouchable,
    hideLegacyScreens: hideOldDietScreens,
    loadRenderer: loadRenderer
  });

  window.startAIDiet = function(){ return window.KroniaDiet.ai(); };
  window.createDietPlan = function(){ return window.KroniaDiet.createPlan(); };
  window.generateDietPlan = function(){ return window.KroniaDiet.createPlan(); };
  window.regenerateDiet = function(){ return window.KroniaDiet.regenerate(); };
  window.regenerateDietPlan = function(){ return window.KroniaDiet.regenerate(); };
  window.regeneratePlan = function(){ return window.KroniaDiet.regenerate(); };

  window.openNutritionFlow = function(){
    if (isLegacyCreateContext(arguments)) return window.KroniaDiet.createPlan();
    if (typeof originalOpenNutritionFlow === 'function') return originalOpenNutritionFlow.apply(this, arguments);
    return window.KroniaDiet.createPlan();
  };

  window.openNutritionFlowFull = function(){
    if (isLegacyCreateContext(arguments)) return window.KroniaDiet.createPlan();
    if (typeof originalOpenNutritionFlowFull === 'function') return originalOpenNutritionFlowFull.apply(this, arguments);
    if (typeof originalOpenNutritionFlow === 'function') return originalOpenNutritionFlow.apply(this, arguments);
    return window.KroniaDiet.createPlan();
  };

  function legacyWatchdog(){
    var old = document.getElementById('nutritionFlowScreen') || document.getElementById('dietDataScreen');
    if (!old) return;
    var visible = old.classList.contains('show') || old.style.display === 'block' || old.style.display === 'flex';
    if (!visible) return;
    var txt = (old.textContent || '').slice(0, 300);
    if (/Perfil base|25%|Dados base/i.test(txt)) {
      hideOldDietScreens();
      open({ source:'legacy_watchdog_profile_base' });
    }
  }

  document.addEventListener('DOMContentLoaded', function(){ makeTouchable(); loadRenderer(); });
  setInterval(legacyWatchdog, 900);
  setTimeout(makeTouchable, 250);
  setTimeout(makeTouchable, 1000);
  setTimeout(makeTouchable, 2500);
})();
