var DEFAULT_THRESHOLDS = Object.freeze({
  errorRateDegraded: 0.15,
  errorRateFailing: 0.4,
  fallbackRateWarning: 0.35,
  avgLatencyWarningMs: 1800,
  avgLatencyFailingMs: 3500,
  minExecutionsForAlert: 10
});

function n(value) {
  var num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function evaluateComponentHealth(row, thresholds) {
  thresholds = thresholds || DEFAULT_THRESHOLDS;
  var total = n(row.total);
  var failures = n(row.failure_total);
  var avgLatency = n(row.avg_duration_ms);
  var fallbackRate = n(row.fallback_rate);
  var errorRate = total > 0 ? failures / total : 0;

  var status = 'healthy';
  if (total === 0) status = 'inactive';
  else if (errorRate >= thresholds.errorRateFailing || avgLatency >= thresholds.avgLatencyFailingMs) status = 'failing';
  else if (errorRate >= thresholds.errorRateDegraded || avgLatency >= thresholds.avgLatencyWarningMs) status = 'degraded';

  if (status === 'healthy' && fallbackRate >= thresholds.fallbackRateWarning) status = 'degraded';

  return {
    component: row.component,
    total: total,
    failureTotal: failures,
    successTotal: n(row.success_total),
    avgDurationMs: avgLatency,
    fallbackRate: fallbackRate,
    lastExecutionAt: row.last_execution_at || null,
    errorRate: Number(errorRate.toFixed(4)),
    status: status
  };
}

function buildAlerts(executions, thresholds) {
  thresholds = thresholds || DEFAULT_THRESHOLDS;
  executions = Array.isArray(executions) ? executions : [];
  var alerts = [];
  if (executions.length < thresholds.minExecutionsForAlert) return alerts;

  var recent = executions.slice(0, 20);
  var failed = recent.filter(function(item) { return item.success === false; });
  var fallback = recent.filter(function(item) { return item.fallback_used === true; });
  var avgLatency = recent.reduce(function(sum, item) { return sum + n(item.duration_ms); }, 0) / recent.length;

  if (failed.length >= 4) {
    alerts.push({
      severity: failed.length >= 8 ? 'critical' : 'warning',
      code: 'RECENT_FAILURE_SPIKE',
      message: 'Últimas ' + recent.length + ' execuções tiveram ' + failed.length + ' falhas.'
    });
  }

  if (fallback.length / recent.length >= thresholds.fallbackRateWarning) {
    alerts.push({
      severity: 'warning',
      code: 'FALLBACK_EXCESSIVE',
      message: 'Taxa de fallback em ' + Math.round((fallback.length / recent.length) * 100) + '% nas execuções recentes.'
    });
  }

  if (avgLatency >= thresholds.avgLatencyWarningMs) {
    alerts.push({
      severity: avgLatency >= thresholds.avgLatencyFailingMs ? 'critical' : 'warning',
      code: 'LATENCY_DEGRADED',
      message: 'Latência média recente em ' + Math.round(avgLatency) + ' ms.'
    });
  }

  return alerts;
}

module.exports = {
  DEFAULT_THRESHOLDS: DEFAULT_THRESHOLDS,
  evaluateComponentHealth: evaluateComponentHealth,
  buildAlerts: buildAlerts
};
