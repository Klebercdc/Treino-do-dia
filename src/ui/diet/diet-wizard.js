/* KroniA Diet Wizard Compatibility
 * Este arquivo não deve mais bloquear a criação de dieta.
 * Ele apenas redireciona chamadas antigas para a entrada única:
 * window.KroniaDiet.generate()
 */
(function(root) {
  'use strict';

  function cleanupLegacyOverlay() {
    var screen = root.document && root.document.getElementById('dietProfileWizardScreen');
    if (screen && screen.parentNode) screen.parentNode.removeChild(screen);

    try {
      [
        'kronia_diet_wizard_state_v1',
        'kronia_diet_wizard_state_v2',
        'kronia_diet_wizard_state_v6_standalone'
      ].forEach(function(key) {
        root.localStorage && root.localStorage.removeItem(key);
      });
    } catch (_) {}

    if (root.document && root.document.body) {
      root.document.body.classList.remove(
        'diet-wizard-active',
        'kdw-active',
        'nutrition-flow-active',
        'overlay-open'
      );
    }
  }

  function openGenerateDietFlow(context) {
    cleanupLegacyOverlay();

    if (root.KroniaDiet && typeof root.KroniaDiet.generate === 'function') {
      return root.KroniaDiet.generate(Object.assign({
        source: 'diet_wizard_compat'
      }, context || {}));
    }

    if (typeof root.generateDietPlan === 'function' && root.generateDietPlan !== openGenerateDietFlow) {
      return root.generateDietPlan(Object.assign({
        source: 'diet_wizard_compat_generateDietPlan'
      }, context || {}));
    }

    if (root.KroniaDiet && typeof root.KroniaDiet.open === 'function') {
      return root.KroniaDiet.open({
        source: 'diet_wizard_compat_fallback_open',
        forceNew: true
      });
    }

    try {
      if (typeof root.navTo === 'function') root.navTo('dieta');
      if (typeof root.openDietDataScreen === 'function') {
        root.openDietDataScreen();
        return true;
      }
    } catch (_) {}

    if (typeof root.showToast === 'function') {
      root.showToast('Não consegui abrir a criação da dieta. Atualize o app e tente novamente.', 'error', 3500);
    }

    return false;
  }

  root.openDietProfileWizard = openGenerateDietFlow;
  root.closeDietProfileWizard = cleanupLegacyOverlay;
  root.__kroniaDietWizardStandaloneLoaded = true;

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', cleanupLegacyOverlay, { once: true });
    } else {
      cleanupLegacyOverlay();
    }
  }
})(window);
