/* Legacy standalone diet wizard removed.
 * This file remains as a no-op compatibility shim for old PWA/cache references.
 */
(function() {
  var SCREEN_ID = 'dietProfileWizardScreen';
  var STATE_KEYS = [
    'kronia_diet_wizard_state_v1',
    'kronia_diet_wizard_state_v2',
    'kronia_diet_wizard_state_v6_standalone'
  ];

  function cleanup() {
    STATE_KEYS.forEach(function(key) {
      try { localStorage.removeItem(key); } catch (_) {}
    });
    var old = document.getElementById(SCREEN_ID);
    if (old) old.remove();
    document.body && document.body.classList.remove('diet-wizard-active', 'kdw-active', 'nutrition-flow-active', 'overlay-open');
  }

  function openPremiumDiet() {
    cleanup();
    if (window.KroniaDiet && typeof window.KroniaDiet.open === 'function') {
      return window.KroniaDiet.open({ source: 'legacy_standalone_diet_wizard_removed', forceNew: true });
    }
    try { if (typeof window.navTo === 'function') window.navTo('dieta'); } catch (_) {}
    if (typeof window.openDietDataScreen === 'function') {
      window.openDietDataScreen();
      return true;
    }
    return false;
  }

  window.openDietProfileWizard = openPremiumDiet;
  window.closeDietProfileWizard = cleanup;
  window.__kroniaDietWizardStandaloneLoaded = false;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }
})();
