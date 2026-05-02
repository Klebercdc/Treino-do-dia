/* Legacy diet profile wizard removed.
 * Keep this compatibility shim so cached imports cannot recreate the old overlay.
 */
(function(root) {
  var SCREEN_ID = 'dietProfileWizardScreen';
  var STATE_KEYS = [
    'kronia_diet_wizard_state_v1',
    'kronia_diet_wizard_state_v2',
    'kronia_diet_wizard_state_v6_standalone'
  ];

  function clearLegacyDietWizardState() {
    STATE_KEYS.forEach(function(key) {
      try { root.localStorage && root.localStorage.removeItem(key); } catch (_) {}
    });
    try { root.__kroniaDietWizardState = null; } catch (_) {}
  }

  function removeLegacyDietWizardOverlay() {
    clearLegacyDietWizardState();
    var screen = root.document && root.document.getElementById(SCREEN_ID);
    if (screen && screen.parentNode) screen.parentNode.removeChild(screen);
    if (root.document && root.document.body) {
      root.document.body.classList.remove('diet-wizard-active', 'kdw-active', 'overlay-open');
    }
    var footer = root.document && root.document.querySelector('.footer-actions');
    if (footer) footer.style.display = '';
  }

  function openPremiumDietFallback(source) {
    removeLegacyDietWizardOverlay();
    if (root.KroniaDiet && typeof root.KroniaDiet.open === 'function') {
      return root.KroniaDiet.open({ source: source || 'legacy_diet_profile_wizard_removed', forceNew: true });
    }
    if (typeof root.openDietDataScreen === 'function') {
      try { if (typeof root.navTo === 'function') root.navTo('dieta'); } catch (_) {}
      root.openDietDataScreen();
      return true;
    }
    if (typeof root.navTo === 'function') return root.navTo('dieta');
    return false;
  }

  root.openDietProfileWizard = function removedDietProfileWizard() {
    return openPremiumDietFallback('legacy_diet_profile_wizard_removed');
  };
  root.closeDietProfileWizard = removeLegacyDietWizardOverlay;
  root.__kroniaDietWizardStandaloneLoaded = false;

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', removeLegacyDietWizardOverlay, { once: true });
    } else {
      removeLegacyDietWizardOverlay();
    }
  }
})(window);
