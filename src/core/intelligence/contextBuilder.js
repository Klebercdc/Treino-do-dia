(function () {
  'use strict';
  window.__KI = window.__KI || {};

  function avg(items) {
    if (!items.length) return 0;
    return Math.round(items.reduce(function (a, b) { return a + b; }, 0) / items.length);
  }

  function build(events, prev) {
    var state = prev || {};
    var history = Array.isArray(events) ? events : [];
    var lastSuccess = history.find(function (x) { return x.status === 'success'; });
    var lastFailed = history.find(function (x) { return x.status === 'error'; });
    var failures = history.filter(function (x) { return x.status === 'error'; });
    var fallbacks = history.filter(function (x) { return x.status === 'fallback' || x.action === 'fallback'; });
    var contractViolations = history.filter(function (x) { return x.action === 'contract_failure' || x.problemCode === 'INVALID_CONTRACT'; });
    var latency = history.map(function (x) { return Number(x.durationMs || 0); }).filter(function (x) { return x > 0; }).slice(0, 50);

    var friction = Math.min(100, failures.length * 10 + fallbacks.length * 8 + contractViolations.length * 10 + (avg(latency) > 2000 ? 15 : 0));

    function health(module) {
      var byModule = history.filter(function (x) { return x.module === module; });
      if (!byModule.length) return 100;
      var err = byModule.filter(function (x) { return x.status === 'error'; }).length;
      return Math.max(0, 100 - Math.round((err / byModule.length) * 100));
    }

    return Object.assign({}, state, {
      currentJourney: state.currentJourney || null,
      lastSuccessfulAction: lastSuccess ? lastSuccess.action : null,
      lastFailedAction: lastFailed ? lastFailed.action : null,
      repeatedFailures: failures.length >= 3 ? failures.length : 0,
      fallbackCount: fallbacks.length,
      contractViolationsCount: contractViolations.length,
      frictionScore: friction,
      averageLatency: avg(latency),
      suspectedProblemType: lastFailed ? (lastFailed.problemCode || 'runtime_instability') : null,
      dietHealthScore: health('diet'),
      exerciseHealthScore: health('exercise'),
      trainingHealthScore: health('training'),
      monetizationHealthScore: health('monetization'),
    });
  }

  window.__KI.ContextBuilder = { build: build };
})();
