/* KroniA Diet Wizard Compatibility
 * Não renderiza mais a anamnese antiga.
 * Este arquivo existe apenas para compatibilidade e sempre delega para o Nutrition Onboarding V3.
 */
(function(root) {
  'use strict';

  var SCREEN_ID = 'dietProfileWizardScreen';
  var V3_SRC = '/src/ui/diet/diet-wizard-standalone.js?v=20260523-v3-compat&t=';
  var loadingPromise = null;

  function cleanupLegacyOverlay() {
    ['dietProfileWizardScreen', 'kroniaForcedDietAnamnese'].forEach(function(id) {
      var screen = root.document && root.document.getElementById(id);
      if (screen && screen.parentNode) screen.parentNode.removeChild(screen);
    });

    try {
      ['kronia_diet_wizard_state_v1', 'kronia_diet_wizard_state_v2', 'kronia_diet_wizard_state_v6_standalone'].forEach(function(k) {
        root.localStorage && root.localStorage.removeItem(k);
      });
    } catch (_) {}

    if (root.document && root.document.body) {
      root.document.body.classList.remove('diet-wizard-active', 'kdw-active', 'nutrition-flow-active', 'overlay-open');
    }
  }

  function loadV3() {
    if (
      typeof root.openDietWizardStandalone === 'function' &&
      root.openDietWizardStandalone.__kroniaWizardV3 !== false
    ) {
      return Promise.resolve(true);
    }

    if (loadingPromise) return loadingPromise;

    loadingPromise = new Promise(function(resolve) {
      if (!root.document || !root.document.head) return resolve(false);

      var old = root.document.getElementById('kronia-diet-wizard-v3-compat-loader');
      if (old) old.remove();

      var script = root.document.createElement('script');
      script.id = 'kronia-diet-wizard-v3-compat-loader';
      script.src = V3_SRC + Date.now();
      script.async = false;
      script.onload = function() {
        resolve(typeof root.openDietWizardStandalone === 'function');
      };
      script.onerror = function() { resolve(false); };
      root.document.head.appendChild(script);
    });

    return loadingPromise;
  }

  function emergencyV3Unavailable(options) {
    try {
      if (typeof root.showToast === 'function') {
        root.showToast('Anamnese V3 não carregou. Atualize o app e tente novamente.', 'error', 4500);
      }
    } catch (_) {}
    console.warn('[KRONIA_DIET] Nutrition Onboarding V3 indisponível', options || {});
    return false;
  }

  function openDietProfileWizard(options) {
    cleanupLegacyOverlay();

    if (
      typeof root.openDietWizardStandalone === 'function' &&
      root.openDietWizardStandalone !== openDietProfileWizard
    ) {
      return root.openDietWizardStandalone(options || {});
    }

    loadV3().then(function(loaded) {
      if (
        loaded &&
        typeof root.openDietWizardStandalone === 'function' &&
        root.openDietWizardStandalone !== openDietProfileWizard
      ) {
        return root.openDietWizardStandalone(options || {});
      }
      return emergencyV3Unavailable(options);
    });

    return true;
  }

  root.openDietProfileWizard = openDietProfileWizard;
  root.openNutritionWizard = openDietProfileWizard;
  root.openDietWizard = openDietProfileWizard;
  root.openDietGenerationWizard = openDietProfileWizard;
  root.openDietSetupWizard = openDietProfileWizard;
  root.closeDietProfileWizard = cleanupLegacyOverlay;
  root.__kroniaDietWizardCompatibilityLoaded = true;
})(window);
