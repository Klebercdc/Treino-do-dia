/* Labs reports auth compatibility shim — KRONIA
 *
 * Corrige abertura do botão/card de Exames/Biomarcadores na Home.
 * Este shim NÃO cria outro modal. Ele usa o bridge principal
 * home-labs-cta-bridge.js e instala um listener de segurança para
 * qualquer elemento com texto/atributo relacionado a Exames, Labs ou Biomarcadores.
 */
(function () {
  'use strict';

  var VERSION = '20260614-labs-open-click-guard';
  var installedClickGuard = false;

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
        return mainBridge(source || 'labs-auth-shim-click-guard');
      } finally {
        if (hadLegacyOpenLabsScreen) window.openLabsScreen = legacyOpenLabsScreen;
      }
    }

    log('main bridge unavailable', VERSION);
    fallbackMessage();
    return null;
  }

  function textOf(el) {
    try {
      return String(
        (el && (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-action') || el.id || el.className)) || ''
      ).toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function isLabsTarget(start) {
    var el = start;
    while (el && el !== document.body && el !== document.documentElement) {
      var txt = textOf(el);
      if (
        txt.indexOf('exames') >= 0 ||
        txt.indexOf('exame') >= 0 ||
        txt.indexOf('biomarcador') >= 0 ||
        txt.indexOf('biomarcadores') >= 0 ||
        txt.indexOf('labs') >= 0 ||
        txt.indexOf('lab') >= 0
      ) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function handleLabsClick(ev) {
    var target = ev && ev.target;
    if (!target || !isLabsTarget(target)) return;

    try {
      if (ev.preventDefault) ev.preventDefault();
      if (ev.stopPropagation) ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    } catch (_) {}

    openViaMainBridge('home-exames-biomarcadores-click');
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