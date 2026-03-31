(function () {
  'use strict';
  window.__KI = window.__KI || {};
  window.__KI.Types = {
    Severity: Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' }),
    Status: Object.freeze({ START: 'start', SUCCESS: 'success', ERROR: 'error', FALLBACK: 'fallback', RENDER: 'render' }),
  };
})();
