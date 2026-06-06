/* Labs reports auth compatibility shim — KRONIA
 *
 * Este arquivo existia para corrigir autenticação/carregamento dos exames,
 * mas não deve criar outro modal nem sobrescrever window.openLabsUploadScreen.
 * A implementação principal fica em home-labs-cta-bridge.js.
 */
(function () {
  'use strict';

  var VERSION = '20260604-labs-auth-shim-no-override';

  function log() {
    try {
      console.info.apply(console, ['[LabsAuthShim]'].concat(Array.prototype.slice.call(arguments)));
    } catch (_) {}
  }

  function hasMainBridge() {
    return typeof window.openLabsUploadScreen === 'function' && window.openLabsUploadScreen.__kroniaLabsMainBridge === true;
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
        state.innerHTML = '<div style="font-weight:900;color:#fecaca;margin-bottom:6px">Sessão de exames indisponível.</div><div style="color:rgba(255,255,255,.68)">O módulo principal de exames não foi carregado. Recarregue o app ou verifique a ordem dos scripts.</div>';
      }
      return;
    }

    try {
      window.alert('Sessão de exames indisponível. O módulo principal de exames não foi carregado.');
    } catch (_) {}
  }

  async function openViaMainBridge(source) {
    var mainBridge = hasMainBridge() ? window.openLabsUploadScreen : await waitForMainBridge(1200);
    if (mainBridge && mainBridge !== openViaMainBridge) {
      return mainBridge(source || 'auth-shim');
    }
    log('main bridge unavailable', VERSION);
    fallbackMessage();
    return null;
  }

  function installShimOnlyIfNeeded() {
    if (hasMainBridge()) {
      window.loadLabIndicators = window.loadLabIndicators || function () {
        try { window.dispatchEvent(new CustomEvent('kronia:labs:refresh-requested')); } catch (_) {}
      };
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
