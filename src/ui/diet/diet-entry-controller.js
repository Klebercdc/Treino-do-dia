/* KroniA Diet Entry Controller — rota única para o wizard standalone de 6 etapas */
(function(){
  var ASSET = 'src/ui/diet/diet-wizard-standalone.js';
  var VERSION = '20260428-standalone-6-steps';
  var loadingPromise = null;

  function loadStandalone(){
    if (window.__kroniaDietWizardStandaloneLoaded && typeof window.openDietProfileWizard === 'function') {
      return Promise.resolve(true);
    }
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise(function(resolve){
      var existing = document.querySelector('script[data-kronia-diet-standalone="1"]');
      if (existing) existing.remove();
      var s = document.createElement('script');
      s.src = '/' + ASSET + '?v=' + VERSION + '&t=' + Date.now();
      s.async = false;
      s.defer = false;
      s.dataset.kroniaDietStandalone = '1';
      s.onload = function(){ resolve(typeof window.openDietProfileWizard === 'function'); };
      s.onerror = function(){ resolve(false); };
      document.head.appendChild(s);
    });
    return loadingPromise;
  }

  function getUserId(){
    try { return (window.currentUser && (window.currentUser.id || window.currentUser.uid)) || (window.authUser && window.authUser.id) || null; }
    catch(_) { return null; }
  }

  function hideOldDietScreens(){
    ['nutritionFlowScreen','dietChoiceScreen','dietDataScreen','dietEmergencyWizardScreen'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show');
      el.style.display = 'none';
      el.setAttribute('aria-hidden','true');
    });
  }

  async function open(context){
    hideOldDietScreens();
    var ok = await loadStandalone();
    if (ok && typeof window.openDietProfileWizard === 'function') {
      return window.openDietProfileWizard(getUserId(), Object.assign({ forceNew:true, source:'diet_entry_controller_6_steps' }, context || {}));
    }
    if (typeof window.showToast === 'function') window.showToast('Não consegui abrir o wizard de dieta.', 'error', 3500);
    else alert('Não consegui abrir o wizard de dieta.');
    return false;
  }

  function isDietButton(target){
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest([
      '#regenerateDietPlanBtn', '#dietRegeneratePlanBtn', '#createDietPlanBtn', '#dietCreatePlanBtn',
      '[data-action="regenerate-diet"]', '[data-action="generate-diet"]', '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]', '[data-diet-action="generate"]', '[data-diet-action="create"]',
      '.regenerate-diet-plan', '.diet-regenerate-plan', '.generate-diet-plan', '.diet-generate-plan'
    ].join(','));
  }

  function makeTouchable(){
    document.querySelectorAll([
      '#regenerateDietPlanBtn', '#dietRegeneratePlanBtn', '#createDietPlanBtn', '#dietCreatePlanBtn',
      '[data-action="regenerate-diet"]', '[data-action="generate-diet"]', '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]', '[data-diet-action="generate"]', '[data-diet-action="create"]',
      '.regenerate-diet-plan', '.diet-regenerate-plan', '.generate-diet-plan', '.diet-generate-plan'
    ].join(',')).forEach(function(btn){
      btn.style.pointerEvents = 'auto';
      btn.style.touchAction = 'manipulation';
      if (!btn.style.position) btn.style.position = 'relative';
      if (!btn.style.zIndex) btn.style.zIndex = '40';
    });
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
    bindButtons: makeTouchable
  });

  // Sobrescreve entradas antigas que levavam ao fluxo “Perfil base 25%”.
  window.startAIDiet = function(){ return window.KroniaDiet.ai(); };
  window.createDietPlan = function(){ return window.KroniaDiet.createPlan(); };
  window.regenerateDiet = function(){ return window.KroniaDiet.regenerate(); };
  window.regenerateDietPlan = function(){ return window.KroniaDiet.regenerate(); };
  window.regeneratePlan = function(){ return window.KroniaDiet.regenerate(); };
  window.openNutritionFlow = function(){ return window.KroniaDiet.createPlan(); };

  document.addEventListener('DOMContentLoaded', makeTouchable);
  setTimeout(makeTouchable, 250);
  setTimeout(makeTouchable, 1000);
  setTimeout(makeTouchable, 2500);
})();
