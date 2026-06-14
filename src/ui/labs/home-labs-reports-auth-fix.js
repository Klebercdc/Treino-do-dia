/* Labs reports auth compatibility shim — KRONIA
 *
 * Mantém apenas o bridge atual de Exames/Biomarcadores como dono da tela.
 * Este arquivo não instala listener de clique e não cria outro layout.
 * Ele só redireciona chamadas legadas de openLabsScreen para o bridge atual.
 */
(function () {
  'use strict';

  var VERSION = '20260614-current-labs-bridge-only';

  function log() {
    try {
      console.info.apply(console, ['[LabsAuthShim]'].concat(Array.prototype.slice.call(arguments)));
    } catch (_) {}
  }

  function hasCurrentBridge() {
    return typeof window.openLabsUploadScreen === 'function' && window.openLabsUploadScreen.__kroniaLabsAuthShim !== true;
  }

  function callCurrentBridge(source) {
    if (!hasCurrentBridge()) {
      try { window.alert('Sessão de exames indisponível. Recarregue o app e tente novamente.'); } catch (_) {}
      return null;
    }

    var legacyAlias = window.openLabsScreen;
    try {
      // O bridge antigo verifica window.openLabsScreen antes de abrir.
      // Zera temporariamente para impedir recursão/conflito e forçar o layout atual.
      window.openLabsScreen = null;
      window.openLabsUploadScreen.__kroniaLabsMainBridge = true;
      return window.openLabsUploadScreen(source || 'current-labs-bridge-only');
    } finally {
      window.openLabsScreen = legacyAlias || callCurrentBridge;
    }
  }

  function installCompatibilityOnly() {
    if (hasCurrentBridge()) {
      try { window.openLabsUploadScreen.__kroniaLabsMainBridge = true; } catch (_) {}
    }

    // Mantém compatibilidade com algum botão antigo que chame openLabsScreen,
    // mas sempre direcionando para o bridge atual, sem criar segunda tela.
    window.openLabsScreen = callCurrentBridge;

    window.loadLabIndicators = window.loadLabIndicators || function () {
      try { window.dispatchEvent(new CustomEvent('kronia:labs:refresh-requested')); } catch (_) {}
    };

    try {
      window.dispatchEvent(new CustomEvent('kronia:labs:bridge-ready', {
        detail: { version: VERSION, mode: 'current-bridge-only' }
      }));
    } catch (_) {}

    log('compatibility only installed', VERSION);
  }

  installCompatibilityOnly();
  document.addEventListener('DOMContentLoaded', installCompatibilityOnly);
})();