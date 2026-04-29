/* KroniA safe legacy diet guard: passive, non-aggressive, no route override. */
(function () {
  var LEGACY_IDS = [
    'nutritionFlowScreen',
    'dietChoiceScreen',
    'dietDataScreen',
    'dietEmergencyWizardScreen'
  ];

  var PROTECTED_IDS = [
    'kroniaDietPlanVisualScreen',
    'dietProfileWizardScreen'
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
      '#dietProfileWizardScreen',
      '#dietProfileWizardScreen *',
      '#kroniaDietPlanVisualScreen',
      '#kroniaDietPlanVisualScreen *',
      '[data-action="open-labs"]',
      '[data-action="view-labs"]',
      '[data-diet-action="labs"]'
    ].join(',')).forEach(function (el) {
      el.style.pointerEvents = 'auto';
      el.removeAttribute('aria-disabled');
    });
  }

  function hideLegacyScreens() {
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
  document.addEventListener('kronia:diet:hide-legacy', hideLegacyScreens);
})();
