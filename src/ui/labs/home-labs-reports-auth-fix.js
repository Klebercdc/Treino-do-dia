/* Labs reports auth compatibility shim — KRONIA
 *
 * Mantém apenas o bridge atual de Exames/Biomarcadores como dono da tela.
 * Este arquivo não abre modal sozinho e não cria outro layout.
 * Chamadas legadas via openLabsScreen só são aceitas quando vierem de
 * uma interação real do usuário no CTA de Exames/Labs/Biomarcadores.
 */
(function () {
  'use strict';

  var VERSION = '20260614-current-labs-user-gesture-only';
  var lastLabsCtaGestureAt = 0;

  function log() {
    try {
      console.info.apply(console, ['[LabsAuthShim]'].concat(Array.prototype.slice.call(arguments)));
    } catch (_) {}
  }

  function hasCurrentBridge() {
    return typeof window.openLabsUploadScreen === 'function' && window.openLabsUploadScreen.__kroniaLabsAuthShim !== true;
  }

  function safeText(el) {
    try {
      return String(
        (el && (
          el.getAttribute('data-action') ||
          el.getAttribute('data-module') ||
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.id ||
          el.className ||
          el.innerText ||
          el.textContent
        )) || ''
      ).toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function hasLabsKeyword(text) {
    return /(^|\b)(exame|exames|biomarcador|biomarcadores|labs|lab)(\b|$)/i.test(String(text || ''));
  }

  function findExplicitLabsCta(start) {
    if (!start || !start.closest) return null;
    if (start.closest('#labsCtaModal')) return null;

    var explicit = start.closest(
      '[data-labs-open], [data-open-labs], [data-module="labs"], [data-action="open_labs"], [data-action="open_labs_upload"], [data-action="labs"], [onclick*="openLabsUploadScreen"], [onclick*="openLabsScreen"]'
    );
    if (explicit) return explicit;

    var interactive = start.closest('button, a, [role="button"]');
    if (!interactive) return null;

    var text = safeText(interactive);
    if (!hasLabsKeyword(text)) return null;

    var visibleText = String(interactive.innerText || interactive.textContent || '').trim();
    if (visibleText && visibleText.length > 120) return null;

    return interactive;
  }

  function markLabsCtaGesture(ev) {
    if (ev && ev.isTrusted === false) return;
    if (findExplicitLabsCta(ev && ev.target)) {
      lastLabsCtaGestureAt = Date.now();
      log('labs CTA gesture detected', VERSION);
    }
  }

  function hasRecentLabsCtaGesture() {
    return Date.now() - lastLabsCtaGestureAt <= 1600;
  }

  function callCurrentBridge(source) {
    if (!hasRecentLabsCtaGesture()) {
      log('blocked automatic labs open', source || 'unknown', VERSION);
      return null;
    }

    if (!hasCurrentBridge()) {
      try { window.alert('Sessão de exames indisponível. Recarregue o app e tente novamente.'); } catch (_) {}
      return null;
    }

    var legacyAlias = window.openLabsScreen;
    try {
      // O bridge atual ainda verifica window.openLabsScreen antes de abrir.
      // Zera temporariamente para impedir recursão/conflito e forçar o layout atual.
      window.openLabsScreen = null;
      window.openLabsUploadScreen.__kroniaLabsMainBridge = true;
      return window.openLabsUploadScreen(source || 'current-labs-bridge-user-cta');
    } finally {
      window.openLabsScreen = legacyAlias || callCurrentBridge;
    }
  }

  function installCompatibilityOnly() {
    if (hasCurrentBridge()) {
      try { window.openLabsUploadScreen.__kroniaLabsMainBridge = true; } catch (_) {}
    }

    // Compatibilidade com botões antigos que chamam openLabsScreen,
    // mas com trava: só abre se o usuário acabou de tocar no CTA de Exames.
    window.openLabsScreen = callCurrentBridge;

    window.loadLabIndicators = window.loadLabIndicators || function () {
      try { window.dispatchEvent(new CustomEvent('kronia:labs:refresh-requested')); } catch (_) {}
    };

    try {
      window.dispatchEvent(new CustomEvent('kronia:labs:bridge-ready', {
        detail: { version: VERSION, mode: 'current-bridge-user-gesture-only' }
      }));
    } catch (_) {}

    log('compatibility only installed', VERSION);
  }

  document.addEventListener('pointerdown', markLabsCtaGesture, true);
  document.addEventListener('touchstart', markLabsCtaGesture, true);
  document.addEventListener('click', markLabsCtaGesture, true);

  installCompatibilityOnly();
  document.addEventListener('DOMContentLoaded', installCompatibilityOnly);
})();