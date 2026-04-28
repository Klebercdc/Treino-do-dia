/*
 * KroniA Diet Entry Controller
 * Arquitetura final: ponto único e estável para entrada nos fluxos de dieta.
 * - Criar plano / IA: wizard novo de 6 etapas
 * - Manual: preserva fluxo manual existente
 * - Botões de gerar/regenerar dieta usam delegação segura para sobreviver a re-render
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

  function notifyUnavailable(message) {
    var text = message || 'Não foi possível abrir a criação da dieta. Atualize o app e tente novamente.';
    if (typeof window.showToast === 'function') {
      window.showToast(text, 'error', 3800);
      return;
    }
    try { window.alert(text); } catch (_) {}
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
    notifyUnavailable('Criação da dieta ainda não carregou. Atualize o app e tente novamente.');
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
    notifyUnavailable('Fluxo manual da dieta indisponível no momento.');
    return false;
  }

  function isDietCreateOrRegenerateTarget(target) {
    if (!target || typeof target.closest !== 'function') return null;

    return target.closest([
      '#regenerateDietPlanBtn',
      '#dietRegeneratePlanBtn',
      '#createDietPlanBtn',
      '#dietCreatePlanBtn',
      '[data-action="regenerate-diet"]',
      '[data-action="generate-diet"]',
      '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]',
      '[data-diet-action="generate"]',
      '[data-diet-action="create"]',
      '.regenerate-diet-plan',
      '.diet-regenerate-plan',
      '.generate-diet-plan',
      '.diet-generate-plan'
    ].join(','));
  }

  function ensureDietActionButtonIsTouchable(button) {
    if (!button || !button.style) return;
    button.style.pointerEvents = 'auto';
    button.style.touchAction = 'manipulation';
    if (!button.style.position) button.style.position = 'relative';
    if (!button.style.zIndex) button.style.zIndex = '30';
  }

  function bindExistingButtons() {
    document.querySelectorAll([
      '#regenerateDietPlanBtn',
      '#dietRegeneratePlanBtn',
      '#createDietPlanBtn',
      '#dietCreatePlanBtn',
      '[data-action="regenerate-diet"]',
      '[data-action="generate-diet"]',
      '[data-action="create-diet"]',
      '[data-diet-action="regenerate"]',
      '[data-diet-action="generate"]',
      '[data-diet-action="create"]',
      '.regenerate-diet-plan',
      '.diet-regenerate-plan',
      '.generate-diet-plan',
      '.diet-generate-plan'
    ].join(',')).forEach(ensureDietActionButtonIsTouchable);
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
      return openWizard({ source: 'diet_entry_regenerate_plan' });
    },
    manual: openManual,
    bindButtons: bindExistingButtons
  };

  // Delegação em capture: funciona mesmo quando a tela da dieta é recriada.
  document.addEventListener('click', function (event) {
    var button = isDietCreateOrRegenerateTarget(event.target);
    if (!button) return;

    ensureDietActionButtonIsTouchable(button);
    event.preventDefault();
    event.stopPropagation();

    window.KroniaDiet.regenerate();
  }, true);

  document.addEventListener('DOMContentLoaded', bindExistingButtons);
  setTimeout(bindExistingButtons, 250);
  setTimeout(bindExistingButtons, 1000);

  // Compatibilidade: chamadas antigas de IA passam a abrir o wizard novo.
  window.startAIDiet = function () {
    return window.KroniaDiet.ai();
  };

  window.createDietPlan = function () {
    return window.KroniaDiet.createPlan();
  };

  window.regenerateDiet = function () {
    return window.KroniaDiet.regenerate();
  };

  window.regenerateDietPlan = function () {
    return window.KroniaDiet.regenerate();
  };

  window.regeneratePlan = function () {
    return window.KroniaDiet.regenerate();
  };
})();
