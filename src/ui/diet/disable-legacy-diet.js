(function () {
  function hideLegacyDietScreens() {
    ['nutritionFlowScreen','dietDataScreen','dietChoiceScreen','dietEmergencyWizardScreen'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show','active','open');
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-hidden','true');
    });
  }

  function openNewDietWizard() {
    hideLegacyDietScreens();

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
    s.src = '/src/ui/diet/diet-entry-controller.js?v=remove-legacy-' + Date.now();
    s.onload = function () {
      if (window.KroniaDiet && typeof window.KroniaDiet.createPlan === 'function') {
        window.KroniaDiet.createPlan();
      }
    };
    document.head.appendChild(s);
    return false;
  }

  window.openDieta = openNewDietWizard;
  window.openDietDataScreen = openNewDietWizard;
  window.openDietaLegacy = openNewDietWizard;
  window.openNutritionFlow = openNewDietWizard;
  window.openNutritionFlowFull = openNewDietWizard;
  window.startAIDiet = openNewDietWizard;
  window.createDietPlan = openNewDietWizard;
  window.generateDietPlan = openNewDietWizard;
  window.regenerateDiet = openNewDietWizard;
  window.regenerateDietPlan = openNewDietWizard;

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest(
      '#generateDietPlanBtn,#dietGeneratePlanBtn,#btnGenerateDiet,#createDietPlanBtn,#dietCreatePlanBtn,#regenerateDietPlanBtn,#dietRegeneratePlanBtn,[data-action="generate-diet"],[data-action="create-diet"],[data-action="regenerate-diet"],.generate-diet-plan,.create-diet-plan,.regenerate-diet-plan'
    );

    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    hideLegacyDietScreens();
    openNewDietWizard();
  }, true);

  setInterval(hideLegacyDietScreens, 500);
  document.addEventListener('DOMContentLoaded', hideLegacyDietScreens);
})();
