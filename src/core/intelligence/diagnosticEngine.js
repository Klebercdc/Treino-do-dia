(function () {
  'use strict';
  window.__KI = window.__KI || {};

  function DiagnosticEngine() {
    this.queue = [];
    this.retryAt = 0;
    this.flushing = false;
  }

  DiagnosticEngine.prototype.enqueue = function (rows) {
    var list = Array.isArray(rows) ? rows : [rows];
    this.queue = this.queue.concat(list).slice(-300);
  };

  DiagnosticEngine.prototype._token = async function () {
    try {
      var result = await window._sb?.auth?.getSession?.();
      return result?.data?.session?.access_token || null;
    } catch (_) { return null; }
  };

  DiagnosticEngine.prototype.flush = async function (context) {
    if (this.flushing) return { ok: false, reason: 'already_flushing' };
    if (!this.queue.length) return { ok: true, count: 0 };
    if (Date.now() < this.retryAt) return { ok: false, reason: 'backoff' };

    this.flushing = true;
    var batch = this.queue.slice(0, 40);
    try {
      var token = await this._token();
      if (!token) { this.flushing = false; return { ok: false, reason: 'no_auth' }; }
      var resp = await fetch('/api/kronia/intelligence/diagnostics', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ rows: batch, context: context || {} }),
        keepalive: true,
      });
      if (!resp.ok) throw new Error('flush_failed');
      this.queue = this.queue.slice(batch.length);
      this.retryAt = 0;
      this.flushing = false;
      return { ok: true, count: batch.length };
    } catch (_) {
      this.retryAt = Date.now() + 1500;
      this.flushing = false;
      return { ok: false, reason: 'network' };
    }
  };

  window.__KI.DiagnosticEngine = DiagnosticEngine;
})();
