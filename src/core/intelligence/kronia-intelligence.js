(function () {
  'use strict';
  // Backward compatibility alias. Primary facade is KroniaIntelligence.js
  if (!window.KroniaIntelligence && window.console) {
    try { console.warn('[KRONIA_INTELLIGENCE] Facade not loaded yet. Ensure KroniaIntelligence.js is included.'); } catch (_) {}
  }
})();
