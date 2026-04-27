/*
 * KroniA Diet Entry Controller
 * Ponto único e estável para entrada nos fluxos de dieta.
 * - IA e regenerar plano: wizard novo de 6 etapas
 * - Manual: preserva fluxo manual existente
 * - Não usa captura global de cards/DOM
 */
(function () {
  function getUserId() {
    try {
      return (
        (window.currentUser && (window.currentUser.id || window.currentUser.uid)) ||
        (window.authUser && window.authUser.id) ||
        null
      );
    } catch (_) {
      return null;
    }
  }

  function hideLegacyQuestionnaire() {
    var old = document.getElementById('nutritionFlowScreen');
    if (!old) return;
    old.classList.remove('show');
    old.style.display = 'none';
    old.setAttribute('aria-hidden', 'true');
  }

  function openWizard(context) {
    var payload = Object.assign(
      {
        source: 'diet_entry_controller',
        forceNew: true
      },
      context || {}
    );

    hideLegacyQuestionnaire();

    if (typeof window.openDietProfileWizard === 'function') {
      return window.openDietProfileWizard(getUserId(), payload);
    }

    console.error('[KroniaDiet] openDietProfileWizard indisponível.');
    return false;
  }

  function openManual() {
    if (typeof window.startManualDiet === 'function') {
      return window.startManualDiet();
    }
    if (typeof window.openManualDiet === 'function') {
      return window.openManualDiet();
    }
    console.error('[KroniaDiet] fluxo manual indisponível.');
    return false;
  }

  window.KroniaDiet = {
    open: function (context) {
      return openWizard(context || { source: 'diet_entry_open' });
    },
    ai: function () {
      return openWizard({ source: 'diet_entry_ai' });
    },
    regenerate: function () {
      return openWizard({ source: 'diet_entry_regenerate' });
    },
    manual: openManual
  };

  // Compatibilidade: chamadas antigas de IA passam a abrir o wizard novo.
  window.startAIDiet = function () {
    return window.KroniaDiet.ai();
  };
})();
