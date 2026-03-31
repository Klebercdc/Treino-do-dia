(function () {
  'use strict';
  window.__KI = window.__KI || {};

  function uid(prefix) { return (prefix || 'ki') + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36); }
  function nowIso() { return new Date().toISOString(); }

  function sanitize(value, depth) {
    if (depth > 3) return '[truncated]';
    if (value == null) return value;
    if (typeof value === 'string') {
      return value
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
        .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted:key]')
        .slice(0, 600);
    }
    if (Array.isArray(value)) return value.slice(0, 20).map(function (x) { return sanitize(x, depth + 1); });
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).slice(0, 50).forEach(function (k) {
        out[k] = /(token|secret|password|authorization|service_role|key)/i.test(k) ? '[redacted]' : sanitize(value[k], depth + 1);
      });
      return out;
    }
    return value;
  }

  function collect(raw, globalContext) {
    var ctx = sanitize(globalContext || {}, 0);
    var event = sanitize(raw || {}, 0);
    return {
      eventId: event.eventId || uid('evt'),
      timestamp: event.timestamp || nowIso(),
      userId: event.userId || ctx.userId || null,
      module: event.module || 'unknown',
      action: event.action || 'unknown',
      payload: event.payload || null,
      result: event.result || null,
      status: event.status || 'info',
      durationMs: Number.isFinite(Number(event.durationMs)) ? Number(event.durationMs) : null,
      severity: event.severity || (event.status === 'error' ? 'HIGH' : 'LOW'),
      plan: event.plan || ctx.plan || null,
      route: event.route || ctx.route || null,
      source: event.source || 'client',
      correlationId: event.correlationId || uid('corr'),
      metadata: Object.assign({}, ctx, event.metadata || {}),
    };
  }

  window.__KI.EventCollector = { collect: collect, sanitize: sanitize };
})();
