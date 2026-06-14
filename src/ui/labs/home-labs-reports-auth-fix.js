/* Labs reports auth compatibility shim — KRONIA
 *
 * Corrige abertura do botão/card de Exames/Biomarcadores sem abrir sozinho.
 * Este shim NÃO cria outro modal. Ele só age quando o clique/toque vem
 * de um CTA explícito de Exames/Labs/Biomarcadores.
 */
(function () {
  'use strict';

  var VERSION = '20260614-labs-open-cta-only';
  var installedClickGuard = false;
  var lastOpenAt = 0;

  function log() {
    try {
      console.info.apply(console, ['[LabsAuthShim]'].concat(Array.prototype.slice.call(arguments)));
    } catch (_) {}
  }

  function isMainBridge(fn) {
    return typeof fn === 'function' && fn.__kroniaLabsAuthShim !== true;
  }

  function hasMainBridge() {
    return isMainBridge(window.openLabsUploadScreen);
  }

  async function waitForMainBridge(timeoutMs) {
    var startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (hasMainBridge()) return window.openLabsUploadScreen;
      await new Promise(function (resolve) { setTimeout(resolve, 40); });
    }
    return hasMainBridge() ? window.openLabsUploadScreen : null;
  }

  function fallbackMessage() {
    var existing = document.getElementById('labsCtaModal');
    if (existing) {
      existing.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      var state = document.getElementById('labsCtaState');
      if (state) {
        state.innerHTML = '<div style="font-weight:900;color:#fecaca;margin-bottom:6px">Sessão de exames indisponível.</div><div style="color:rgba(255,255,255,.68)">O módulo principal de exames não foi carregado. Recarregue o app e tente novamente.</div>';
      }
      return;
    }

    try {
      window.alert('Sessão de exames indisponível. Recarregue o app e tente novamente.');
    } catch (_) {}
  }

  async function openViaMainBridge(source) {
    var now = Date.now();
    if (now - lastOpenAt < 900) return null;
    lastOpenAt = now;

    var mainBridge = hasMainBridge() ? window.openLabsUploadScreen : await waitForMainBridge(1200);
    if (mainBridge && mainBridge !== openViaMainBridge) {
      var legacyOpenLabsScreen = window.openLabsScreen;
      var hadLegacyOpenLabsScreen = typeof legacyOpenLabsScreen === 'function';

      try {
        // O bridge principal antigo desvia para window.openLabsScreen quando ela existe.
        // Se essa função legada estiver vazia/quebrada, o botão parece não fazer nada.
        // Desabilitamos só durante a chamada para forçar o fallback real do bridge.
        if (hadLegacyOpenLabsScreen) window.openLabsScreen = null;
        mainBridge.__kroniaLabsMainBridge = true;
        return mainBridge(source || 'labs-auth-shim-cta');
      } finally {
        if (hadLegacyOpenLabsScreen) window.openLabsScreen = legacyOpenLabsScreen;
      }
    }

    log('main bridge unavailable', VERSION);
    fallbackMessage();
    return null;
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

    // Nunca intercepta cliques dentro do próprio modal, senão ele reabre ao usar botões internos.
    if (start.closest('#labsCtaModal')) return null;

    // Preferência: CTAs marcados diretamente no HTML/JS.
    var explicit = start.closest(
      '[data-labs-open], [data-open-labs], [data-module="labs"], [data-action="open_labs"], [data-action="open_labs_upload"], [data-action="labs"], [onclick*="openLabsUploadScreen"], [onclick*="openLabsScreen"]'
    );
    if (explicit) return explicit;

    // Fallback controlado: só considera o elemento interativo mais próximo,
    // não sobe até containers grandes da Home. Isso evita abrir sozinho quando
    // qualquer área da tela contém texto oculto/filho com "Exames".
    var interactive = start.closest('button, a, [role="button"]');
    if (!interactive) return null;

    var text = safeText(interactive);
    if (!hasLabsKeyword(text)) return null;

    // Evita capturar botões internos ou textos longos de seções inteiras.
    var visibleText = String(interactive.innerText || interactive.textContent || '').trim();
    if (visibleText && visibleText.length > 120) return null;

    return interactive;
  }

  function handleLabsClick(ev) {
    var target = ev && ev.target;
    var cta = findExplicitLabsCta(target);
    if (!cta) return;

    try {
      if (ev.preventDefault) ev.preventDefault();
      if (ev.stopPropagation) ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    } catch (_) {}

    openViaMainBridge('home-exames-biomarcadores-cta');
  }

  function installClickGuard() {
    if (installedClickGuard || !document || !document.addEventListener) return;
    installedClickGuard = true;
    document.addEventListener('click', handleLabsClick, true);
    document.addEventListener('touchend', handleLabsClick, true);
    log('click guard installed', VERSION);
  }

  function installShimOnlyIfNeeded() {
    installClickGuard();

    if (hasMainBridge()) {
      try { window.openLabsUploadScreen.__kroniaLabsMainBridge = true; } catch (_) {}
      window.loadLabIndicators = window.loadLabIndicators || function () {
        try { window.dispatchEvent(new CustomEvent('kronia:labs:refresh-requested')); } catch (_) {}
      };
      try { window.dispatchEvent(new CustomEvent('kronia:labs:bridge-ready', { detail: { version: VERSION, shim: true } })); } catch (_) {}
      log('main bridge detected; shim did not override', VERSION);
      return;
    }

    if (typeof window.openLabsUploadScreen !== 'function') {
      window.openLabsUploadScreen = openViaMainBridge;
      window.openLabsUploadScreen.__kroniaLabsAuthShim = true;
      log('temporary shim installed', VERSION);
    } else {
      log('existing openLabsUploadScreen preserved', VERSION);
    }
  }

  installShimOnlyIfNeeded();
  document.addEventListener('DOMContentLoaded', installShimOnlyIfNeeded);
  window.addEventListener('kronia:labs:bridge-ready', installShimOnlyIfNeeded);
})();