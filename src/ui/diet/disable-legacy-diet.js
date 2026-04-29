(function () {
  var LEGACY_IDS = [
    'dietChoiceScreen',
    'dietEmergencyWizardScreen',
    'dietDataScreen',
    'nutritionFlowScreen'
  ];

  var BLOCKED_TEXT = /Perfil base|Dados base|25%/i;

  function hasGeneratedDiet() {
    try { return !!localStorage.getItem('kronia_last_generated_diet'); } catch (_) { return false; }
  }

  function isDietPlanVisible() {
    var el = document.getElementById('kroniaDietPlanVisualScreen');
    return !!(el && getComputedStyle(el).display !== 'none');
  }

  function textOf(el) {
    return String((el && el.textContent) || '').slice(0, 1200);
  }

  function isLegacyProfileBase(el) {
    if (!el) return false;
    if (el.getAttribute && el.getAttribute('data-kronia-legacy-profile-base') === '1') return true;
    return BLOCKED_TEXT.test(textOf(el));
  }

  function forceHide(el) {
    if (!el) return;
    el.setAttribute('data-kronia-legacy-profile-base', '1');
    el.classList && el.classList.remove('show', 'active', 'open');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('transform', 'translateX(-99999px)', 'important');
    el.setAttribute('aria-hidden', 'true');
  }

  function removeBadChildren(el) {
    if (!el || !isLegacyProfileBase(el)) return false;
    forceHide(el);
    return true;
  }

  function hardRemoveLegacyDietScreens() {
    LEGACY_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id === 'dietDataScreen' || id === 'nutritionFlowScreen') {
        if (!isLegacyProfileBase(el)) return;
      }
      forceHide(el);
    });
  }

  function closeProfileBaseIfItAppears() {
    var candidates = document.querySelectorAll(
      '#dietDataScreen,#nutritionFlowScreen,.screen,.sheet,.modal,.section,.app-scroll,main,section,[id*="diet"],[id*="Diet"],[class*="diet"],[class*="Diet"]'
    );
    candidates.forEach(removeBadChildren);
  }

  function clearLegacyStorage() {
    try {
      [
        'kronia_diet_wizard_state_v1',
        'kronia_diet_legacy_state',
        'kronia_nutrition_flow_state',
        'kronia_diet_data_screen_state'
      ].forEach(function(k){ localStorage.removeItem(k); });
    } catch (_) {}
  }

  function runKiller() {
    clearLegacyStorage();
    hardRemoveLegacyDietScreens();
    closeProfileBaseIfItAppears();
  }

  async function openGeneratedDietOrNewWizard() {
    runKiller();

    if (hasGeneratedDiet() && typeof window.openLastGeneratedDiet === 'function') {
      return window.openLastGeneratedDiet();
    }

    if (window.KroniaDiet && typeof window.KroniaDiet.createPlan === 'function') {
      return window.KroniaDiet.createPlan();
    }

    if (typeof window.openDietProfileWizard === 'function') {
      return window.openDietProfileWizard(null, {
        forceNew: true,
        source: 'legacy_removed_hard'
      });
    }

    var s = document.createElement('script');
    s.src = '/src/ui/diet/diet-entry-controller.js?v=remove-profile-base-hard-' + Date.now();
    s.onload = function () {
      runKiller();
      if (hasGeneratedDiet() && typeof window.openLastGeneratedDiet === 'function') {
        window.openLastGeneratedDiet();
      } else if (window.KroniaDiet && typeof window.KroniaDiet.createPlan === 'function') {
        window.KroniaDiet.createPlan();
      } else if (typeof window.openDietProfileWizard === 'function') {
        window.openDietProfileWizard(null, { forceNew: true, source: 'legacy_removed_hard_late' });
      }
    };
    document.head.appendChild(s);
    return false;
  }

  window.__kroniaKillLegacyProfileBase = runKiller;
  window.openDietaLegacy = openGeneratedDietOrNewWizard;
  window.startAIDiet = openGeneratedDietOrNewWizard;
  window.createDietPlan = openGeneratedDietOrNewWizard;
  window.generateDietPlan = openGeneratedDietOrNewWizard;
  window.regenerateDiet = function() {
    try { localStorage.removeItem('kronia_last_generated_diet'); } catch (_) {}
    runKiller();
    if (window.KroniaDiet && typeof window.KroniaDiet.createPlan === 'function') return window.KroniaDiet.createPlan();
    return openGeneratedDietOrNewWizard();
  };
  window.regenerateDietPlan = window.regenerateDiet;

  document.addEventListener('click', function(e) {
    var target = e.target;
    var navDiet = target && target.closest && target.closest('[data-tab="dieta"],[data-section="dieta"],[onclick*="dieta"],.btn-nav');
    var generateBtn = target && target.closest && target.closest(
      '#generateDietPlanBtn,#dietGeneratePlanBtn,#btnGenerateDiet,#createDietPlanBtn,#dietCreatePlanBtn,#regenerateDietPlanBtn,#dietRegeneratePlanBtn,[data-action="generate-diet"],[data-action="create-diet"],[data-action="regenerate-diet"],.generate-diet-plan,.create-diet-plan,.regenerate-diet-plan'
    );

    if (generateBtn) {
      e.preventDefault();
      e.stopPropagation();
      openGeneratedDietOrNewWizard();
      return;
    }

    if (navDiet || textOf(target).trim() === 'Dieta' || textOf(target).trim() === 'Treino') {
      setTimeout(runKiller, 0);
      setTimeout(runKiller, 80);
      setTimeout(runKiller, 250);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', runKiller, true);
  window.addEventListener('load', runKiller, true);
  window.addEventListener('pageshow', runKiller, true);

  if (window.MutationObserver) {
    new MutationObserver(function(mutations) {
      var shouldRun = false;
      mutations.forEach(function(m) {
        if (shouldRun) return;
        if (m.addedNodes && m.addedNodes.length) shouldRun = true;
        if (m.type === 'attributes') shouldRun = true;
      });
      if (shouldRun) runKiller();
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden']
    });
  }

  runKiller();
  setInterval(function() {
    if (isDietPlanVisible()) return;
    runKiller();
  }, 250);
})();
