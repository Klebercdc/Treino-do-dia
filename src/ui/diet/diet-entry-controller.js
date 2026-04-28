/*
 * KroniA Diet Entry Controller
 * Arquitetura final: ponto único e estável para entrada nos fluxos de dieta.
 * - Criar plano / IA: wizard novo de 6 etapas
 * - Manual: preserva fluxo manual existente
 * - Sem captura global agressiva, sem MutationObserver, sem bind em cards genéricos
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
    createPlan: function () {
      return openWizard({ source: 'diet_entry_create_plan' });
    },
    regenerate: function () {
      // Compatibilidade com chamadas antigas: agora significa criar plano.
      return openWizard({ source: 'diet_entry_create_plan' });
    },
    manual: openManual
  };

  // Compatibilidade: chamadas antigas de IA passam a abrir o wizard novo.
  window.startAIDiet = function () {
    return window.KroniaDiet.ai();
  };

  window.createDietPlan = function () {
    return window.KroniaDiet.createPlan();
  };

  window.regenerateDiet = function () {
    return window.KroniaDiet.createPlan();
  };

  window.regenerateDietPlan = function () {
    return window.KroniaDiet.createPlan();
  };

  window.regeneratePlan = function () {
    return window.KroniaDiet.createPlan();
  };
})();
