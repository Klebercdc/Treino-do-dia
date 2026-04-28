(function () {
  var LEGACY_IDS = [
    'dietChoiceScreen',
    'dietEmergencyWizardScreen',
    'dietDataScreen',
    'nutritionFlowScreen'
  ];

  function isDietPlanVisible() {
    var el = document.getElementById('kroniaDietPlanVisualScreen');
    return !!(el && getComputedStyle(el).display !== 'none');
  }

  function hasGeneratedDiet() {
    try { return !!localStorage.getItem('kronia_last_generated_diet'); } catch (_) { return false; }
  }

  function isLegacyProfileBase(el) {
    if (!el) return false;
    var txt = String(el.textContent || '').slice(0, 600);
    return /Perfil base|Dados base|25%/i.test(txt);
  }

  function hardRemoveLegacyDietScreens() {
    LEGACY_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;

      if (id === 'dietDataScreen' || id === 'nutritionFlowScreen') {
        if (!isLegacyProfileBase(el)) return;
      }

      el.classList.remove('show','active','open');
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-hidden','true');
    });
  }

  function closeProfileBaseIfItAppears() {
    var candidates = document.querySelectorAll('#dietDataScreen,#nutritionFlowScreen,.screen,.sheet,.modal,[id*="diet"],[id*="Diet"],[class*="diet"],[class*="Diet"]');
    candidates.forEach(function(el){
      if (!isLegacyProfileBase(el)) return;
      el.classList.remove('show','active','open');
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-hidden','true');
    });
  }

  async function openGeneratedDietOrNewWizard() {
    hardRemoveLegacyDietScreens();
    closeProfileBaseIfItAppears();

    if (hasGeneratedDiet() && typeof window.openLastGeneratedDiet === 'function') {
      return window.openLastGeneratedDiet();
    }

    if (window.KroniaDiet && typeof window.KroniaDiet.createPlan === 'function') {
      return window.KroniaDiet.createPlan();
    }

    if (typeof window.openDietProfileWizard === 'function') {
      return window.openDietProfileWizard(null, {
        forceNew: true,
        source: 'legacy_removed'
      });
    }

    var s = document.createElement('script');
    s.src = '/src/ui/diet/diet-entry-controller.js?v=remove-profile-base-' + Date.now();
    s.onload = function () {
      if (hasGeneratedDiet() && typeof window.openLastGeneratedDiet === 'function') {
        window.openLastGeneratedDiet();
      } else if (window.KroniaDiet && typeof window.KroniaDiet.createPlan === 'function') {
        window.KroniaDiet.createPlan();
      }
    };
    document.head.appendChild(s);
    return false;
  }

  window.openDietaLegacy = openGeneratedDietOrNewWizard;
  window.startAIDiet = openGeneratedDietOrNewWizard;
  window.createDietPlan = openGeneratedDietOrNewWizard;
  window.generateDietPlan = openGeneratedDietOrNewWizard;
  window.regenerateDiet = function(){
    try { localStorage.removeItem('kronia_last_generated_diet'); } catch (_) {}
    if (window.KroniaDiet && typeof window.KroniaDiet.createPlan === 'function') return window.KroniaDiet.createPlan();
    return openGeneratedDietOrNewWizard();
  };
  window.regenerateDietPlan = window.regenerateDiet;

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest(
      '#generateDietPlanBtn,#dietGeneratePlanBtn,#btnGenerateDiet,#createDietPlanBtn,#dietCreatePlanBtn,#regenerateDietPlanBtn,#dietRegeneratePlanBtn,[data-action="generate-diet"],[data-action="create-diet"],[data-action="regenerate-diet"],.generate-diet-plan,.create-diet-plan,.regenerate-diet-plan'
    );

    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    hardRemoveLegacyDietScreens();
    closeProfileBaseIfItAppears();
    openGeneratedDietOrNewWizard();
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    hardRemoveLegacyDietScreens();
    closeProfileBaseIfItAppears();
  });

  setInterval(function(){
    if (isDietPlanVisible()) return;
    closeProfileBaseIfItAppears();
  }, 500);
})();
