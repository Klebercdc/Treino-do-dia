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

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function isRegeneratePlanElement(el) {
    if (!el) return false;
    var text = normalizeText(el.innerText || el.textContent);
    var aria = normalizeText(el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title')));
    var onclick = normalizeText(el.getAttribute && el.getAttribute('onclick'));
    var value = text + ' ' + aria + ' ' + onclick;

    return (
      value.indexOf('regenerar plano') !== -1 ||
      value.indexOf('regenerar dieta') !== -1 ||
      value.indexOf('regenerate') !== -1 ||
      value.indexOf('dieta com ia') !== -1 && value.indexOf('plano alimentar inteligente') !== -1
    );
  }

  function findRegenerateTarget(start) {
    var el = start;
    for (var depth = 0; el && el !== document.body && depth < 6; depth += 1, el = el.parentElement) {
      if (isRegeneratePlanElement(el)) return el;
      if (
        el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        (el.getAttribute && el.getAttribute('role') === 'button')
      ) {
        if (isRegeneratePlanElement(el) || isRegeneratePlanElement(el.parentElement)) return el;
      }
    }
    return null;
  }

  function installRegenerateDelegation() {
    if (window.__kroniaRegenerateDelegationInstalled) return;
    window.__kroniaRegenerateDelegationInstalled = true;

    document.addEventListener(
      'click',
      function (event) {
        var target = findRegenerateTarget(event.target);
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        window.KroniaDiet.regenerate();
      },
      true
    );
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

  installRegenerateDelegation();
})();
