/* KroniA Diet Runtime — Single Source of Truth
 * Garante inicialização única, bloqueia dupla inicialização,
 * protege contra race condition e expõe runtime global.
 */
(function () {
  'use strict';

  if (window.__KRONIA_DIET_RUNTIME__) {
    console.log('[KroniaDiet] runtime already mounted — skip');
    return;
  }
  window.__KRONIA_DIET_RUNTIME__ = true;

  var VERSION = '20260608-login-diet-entry-fix-v1';

  function log(msg) {
    console.log('[KroniaDiet] ' + msg);
  }

  log('runtime mounted');

  /* ── Garante que o controller está funcional ─────────────────────── */
  function ensureController() {
    if (window.KroniaDiet && typeof window.KroniaDiet.open === 'function' && !window.KroniaDiet.open.__kroniaDietEntryWrapper) {
      return Promise.resolve(true);
    }
    log('controller not found — loading diet-entry-controller.js');
    return new Promise(function (resolve) {
      var existing = document.querySelector('script[data-kronia-runtime-loader="controller"]');
      if (existing) existing.remove();
      var s = document.createElement('script');
      s.src = '/src/ui/diet/diet-entry-controller.js?v=' + VERSION + '&t=' + Date.now();
      s.async = false;
      s.dataset.kroniaRuntimeLoader = 'controller';
      s.onload = function () {
        log('diet-entry-controller.js loaded');
        resolve(true);
      };
      s.onerror = function () {
        console.warn('[KroniaDiet] failed to load diet-entry-controller.js');
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  /* ── Auto-heal: desmonta e remonta se o wizard falhar ────────────── */
  function healDietRuntime() {
    log('auto-heal triggered');
    var overlay = document.getElementById('dietProfileWizardScreen');
    if (overlay) overlay.remove();
    if (document.body) {
      document.body.classList.remove('diet-wizard-active', 'overlay-open', 'kdw-active');
    }
    ensureController().then(function () {
      if (window.KroniaDiet && typeof window.KroniaDiet.generate === 'function') {
        log('auto-heal: remounting wizard');
        window.KroniaDiet.generate({ source: 'auto_heal' });
      }
    });
  }

  /* ── Expõe heal globalmente para uso externo ─────────────────────── */
  window.KroniaDiet = Object.assign({}, window.KroniaDiet || {}, {
    heal: healDietRuntime,
    version: VERSION
  });

  /* ── Garante controller no DOMContentLoaded se não estiver pronto ── */
  function onReady() {
    ensureController().then(function (ok) {
      if (!ok) {
        console.warn('[KroniaDiet] controller unavailable after load attempt');
        return;
      }

      log('runtime ready — KroniaDiet.open: ' + (typeof (window.KroniaDiet && window.KroniaDiet.open)));

      /* Assegura que todas as funções globais de dieta apontam para o controller */
      var ctrl = window.KroniaDiet;
      if (!ctrl || typeof ctrl.open !== 'function') return;

      var aliases = [
        ['startAIDiet', 'generate'],
        ['startManualDiet', 'generate'],
        ['createAnotherDiet', 'generate'],
        ['createDietPlan', 'generate'],
        ['generateDietPlan', 'generate'],
        ['regenerateDiet', 'generate'],
        ['regenerateDietPlan', 'generate'],
        ['regeneratePlan', 'generate'],
        ['openDietaEntry', 'open'],
        ['openDietEntry', 'open'],
        ['openDietaSheet', 'open'],
        ['openDietChoiceScreen', 'open'],
        ['openNutritionFlow', 'generate'],
        ['openNutritionFlowFull', 'generate']
      ];

      aliases.forEach(function (pair) {
        var globalName = pair[0];
        var method = pair[1];
        var existing = window[globalName];
        /* Só substitui wrappers ausentes/legados ou funções marcadas como wrapper */
        if (typeof existing !== 'function' || existing.__kroniaDietEntryWrapper || existing.__kroniaForcedAnamnese) {
          window[globalName] = function (ctx) {
            var payload = Object.assign({ source: globalName + '_global_alias' }, ctx || {});
            return ctrl[method](payload);
          };
          window[globalName].__kroniaDietRuntimeAlias = true;
          log('alias set: window.' + globalName + ' → KroniaDiet.' + method);
        }
      });

      /* Torna botões clicáveis se pointer-events estiver bloqueado */
      if (typeof ctrl.bindButtons === 'function') ctrl.bindButtons();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }

  log('runtime init complete');
})();