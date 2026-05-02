/* KroniA safe legacy diet guard: passive, non-aggressive, no route override. */
(function () {
  var LEGACY_IDS = [
    'nutritionFlowScreen',
    'dietChoiceScreen',
    'dietEmergencyWizardScreen'
  ];
  var LEGACY_WIZARD_SCREEN_ID = ['diet', 'Profile', 'Wizard', 'Screen'].join('');
  var LEGACY_WIZARD_STATE_KEYS = [
    'kronia_diet_wizard_state_v1',
    'kronia_diet_wizard_state_v2',
    'kronia_diet_wizard_state_v6_standalone'
  ];

  var PROTECTED_IDS = [
    'kroniaDietPlanVisualScreen'
  ];

  function isProtected(el) {
    if (!el) return true;
    if (PROTECTED_IDS.indexOf(el.id) >= 0) return true;
    return !!(el.closest && PROTECTED_IDS.some(function (id) { return el.closest('#' + id); }));
  }

  function hide(el) {
    if (!el || isProtected(el)) return;
    el.classList && el.classList.remove('show', 'active', 'open');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-kronia-legacy-hidden', '1');
  }

  function unblockValidDietTargets() {
    document.querySelectorAll([
      '#kroniaDietPlanVisualScreen',
      '#kroniaDietPlanVisualScreen *',
      '[data-diet-action="labs"]'
    ].join(',')).forEach(function (el) {
      el.style.pointerEvents = 'auto';
      el.removeAttribute('aria-disabled');
    });
  }

  function hideLegacyScreens() {
    LEGACY_WIZARD_STATE_KEYS.forEach(function (key) {
      try { localStorage.removeItem(key); } catch (_) {}
    });
    var oldWizard = document.getElementById(LEGACY_WIZARD_SCREEN_ID);
    if (oldWizard) oldWizard.remove();
    document.body && document.body.classList.remove('diet-wizard-active', 'kdw-active');
    LEGACY_IDS.forEach(function (id) { hide(document.getElementById(id)); });
    unblockValidDietTargets();
    window.__kroniaLegacyDietRemoved = true;
  }

  window.KroniaDiet = Object.assign({}, window.KroniaDiet || {}, {
    hideLegacyScreens: hideLegacyScreens
  });
  window.__kroniaHideLegacyDietScreens = hideLegacyScreens;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideLegacyScreens, { once: true });
  } else {
    hideLegacyScreens();
  }
  try {
    var observer = new MutationObserver(function () {
      var oldWizard = document.getElementById(LEGACY_WIZARD_SCREEN_ID);
      if (oldWizard || document.body.classList.contains('diet-wizard-active') || document.body.classList.contains('kdw-active')) {
        hideLegacyScreens();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  document.addEventListener('kronia:diet:hide-legacy', hideLegacyScreens);
})();
