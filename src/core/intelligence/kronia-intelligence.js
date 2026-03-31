(function () {
  'use strict';

  var STORAGE_KEY = 'kronia_intelligence_state_v1';
  var MAX_EVENTS = 180;
  var MAX_DIAGNOSTICS = 60;
  var MAX_TASKS = 60;

  function nowIso() { return new Date().toISOString(); }
  function safeJsonParse(raw, fallback) { try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function uid(prefix) { return (prefix || 'ki') + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36); }

  function readState() {
    try {
      return safeJsonParse(localStorage.getItem(STORAGE_KEY), null) || {
        initialized: false,
        queue: [],
        events: [],
        diagnostics: [],
        recommendations: [],
        tasks: [],
        context: {},
        userId: null,
        sessionId: uid('sess'),
        counters: {
          fallbackCount: 0,
          contractViolationsCount: 0,
          repeatedFailures: 0,
          latencySamples: [],
        },
      };
    } catch (_) {
      return { initialized: false, queue: [], events: [], diagnostics: [], recommendations: [], tasks: [], context: {}, userId: null, sessionId: uid('sess'), counters: { fallbackCount: 0, contractViolationsCount: 0, repeatedFailures: 0, latencySamples: [] } };
    }
  }

  function sanitizeValue(value, depth) {
    if (depth > 3) return '[truncated]';
    if (value == null) return value;
    if (typeof value === 'string') {
      var redacted = value
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
        .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted:key]')
        .replace(/eyJ[A-Za-z0-9._-]+/g, '[redacted:jwt]');
      return redacted.length > 400 ? redacted.slice(0, 399) + '…' : redacted;
    }
    if (Array.isArray(value)) return value.slice(0, 20).map(function (item) { return sanitizeValue(item, depth + 1); });
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).slice(0, 40).forEach(function (key) {
        var low = String(key || '').toLowerCase();
        if (/(token|secret|password|authorization|service_role|apikey|credential)/.test(low)) out[key] = '[redacted]';
        else out[key] = sanitizeValue(value[key], depth + 1);
      });
      return out;
    }
    return value;
  }

  function KroniaIntelligence() {
    this._state = readState();
    this._initDone = false;
    this._flushTimer = null;
    this._flushing = false;
    this._retryAt = 0;
  }

  KroniaIntelligence.prototype._persist = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state)); } catch (_) {}
  };

  KroniaIntelligence.prototype.init = function (payload) {
    if (this._initDone) return this.getLocalState();
    this._initDone = true;
    this._state.initialized = true;
    this.setContext(payload || {});
    this._persist();
    return this.getLocalState();
  };

  KroniaIntelligence.prototype.identifyUser = function (user) {
    this._state.userId = user && user.userId ? String(user.userId) : this._state.userId;
    if (user && user.sessionId) this._state.sessionId = String(user.sessionId);
    if (user && user.plan) this._state.context.plan = String(user.plan);
    this._persist();
  };

  KroniaIntelligence.prototype.setContext = function (context) {
    var safe = sanitizeValue(context || {}, 0);
    this._state.context = Object.assign({}, this._state.context || {}, safe);
    this._persist();
  };

  KroniaIntelligence.prototype._enrichEvent = function (event) {
    var enriched = Object.assign({}, sanitizeValue(event || {}, 0));
    enriched.eventId = enriched.eventId || uid('evt');
    enriched.timestamp = enriched.timestamp || nowIso();
    enriched.userId = enriched.userId || this._state.userId || null;
    enriched.sessionId = enriched.sessionId || this._state.sessionId || null;
    enriched.module = enriched.module || 'unknown';
    enriched.action = enriched.action || 'unknown';
    enriched.status = enriched.status || 'info';
    enriched.durationMs = Number.isFinite(Number(enriched.durationMs)) ? Number(enriched.durationMs) : null;
    enriched.severity = enriched.severity || (enriched.status === 'error' ? 'high' : 'low');
    enriched.correlationId = enriched.correlationId || uid('corr');
    enriched.route = enriched.route || this._state.context.route || null;
    enriched.source = enriched.source || 'client';
    enriched.metadata = sanitizeValue(Object.assign({}, this._state.context, enriched.metadata || {}), 0);
    return enriched;
  };

  KroniaIntelligence.prototype._addDiagnostic = function (diag) {
    this._state.diagnostics.unshift(diag);
    this._state.diagnostics = this._state.diagnostics.slice(0, MAX_DIAGNOSTICS);
    if (diag.recommendation) {
      this._state.recommendations.unshift(diag.recommendation);
      this._state.recommendations = this._state.recommendations.slice(0, MAX_DIAGNOSTICS);
    }
    if (diag.task) {
      this._state.tasks.unshift(diag.task);
      this._state.tasks = this._state.tasks.slice(0, MAX_TASKS);
    }
  };

  KroniaIntelligence.prototype._updateHealth = function () {
    var events = this._state.events || [];
    var lastSuccess = events.find(function (x) { return x.status === 'success'; });
    var lastFail = events.find(function (x) { return x.status === 'error'; });
    var failures = events.filter(function (x) { return x.status === 'error'; }).length;
    this._state.counters.repeatedFailures = failures >= 3 ? failures : 0;

    var lat = (this._state.counters.latencySamples || []).filter(function (x) { return Number.isFinite(Number(x)); });
    var avg = lat.length ? Math.round(lat.reduce(function (a, b) { return a + b; }, 0) / lat.length) : 0;
    var friction = Math.min(100, failures * 12 + this._state.counters.fallbackCount * 6 + this._state.counters.contractViolationsCount * 9 + (avg > 2000 ? 15 : 0));
    this._state.context.operational = {
      currentJourney: this._state.context.currentJourney || null,
      lastSuccessfulAction: lastSuccess ? lastSuccess.action : null,
      lastFailedAction: lastFail ? lastFail.action : null,
      repeatedFailures: this._state.counters.repeatedFailures,
      fallbackCount: this._state.counters.fallbackCount,
      contractViolationsCount: this._state.counters.contractViolationsCount,
      frictionScore: friction,
      averageLatency: avg,
      healthScoreByModule: {
        app: Math.max(0, 100 - friction),
      },
      suspectedProblemType: lastFail ? String(lastFail.problemCode || 'runtime_instability') : null,
    };
  };

  KroniaIntelligence.prototype._detectDiagnostics = function (event) {
    var md = event.metadata || {};
    var diagnostics = [];

    if (event.action === 'diet_generation' && event.status === 'error') {
      diagnostics.push({
        problemCode: 'DIET_GENERATION_FAILURE',
        label: 'Falha em geração de dieta',
        severity: 'high',
        explanation: 'A geração de dieta falhou no fluxo principal.',
        evidence: { action: event.action, status: event.status, route: event.route },
        rootCauseHypothesis: 'Instabilidade no endpoint /api/agent ou payload inválido.',
        recommendation: 'Priorizar validação de contrato do payload de dieta e timeouts de API.',
        task: {
          title: 'Corrigir falha recorrente de dieta',
          impact: 'alto',
          severity: 'high',
          module: 'chat/diet',
          rootCauseHypothesis: 'Contrato inconsistente em dieta.',
          probableFiles: ['app.js', 'api/chat.js'],
          shortPlan: 'Adicionar validações defensivas e monitorar taxa de erro por status.',
          executionSuggestion: 'Reproduzir erro em staging e validar retorno do endpoint.',
        },
      });
    }

    if (event.problemCode === 'INVALID_CONTRACT' || event.action === 'contract_failure') {
      diagnostics.push({
        problemCode: 'CONTRACT_VIOLATION',
        label: 'Contrato inválido detectado',
        severity: 'high',
        explanation: 'Formato de payload não respeitou o contrato esperado.',
        evidence: { code: event.problemCode, metadata: md },
        rootCauseHypothesis: 'Resposta fora do schema combinado.',
        recommendation: 'Aplicar schema validation centralizada antes de consumir payload.',
        task: {
          title: 'Endurecer validação de contrato', impact: 'alto', severity: 'high', module: 'api-contract',
          rootCauseHypothesis: 'Payload fora do schema.', probableFiles: ['app.js', 'src/server/apihelpers/_response.js'],
          shortPlan: 'Bloquear payload inválido com fallback seguro e log estruturado.', executionSuggestion: 'Criar teste unitário para contrato quebrado.',
        },
      });
    }

    if (event.durationMs && event.durationMs > 2500) {
      diagnostics.push({
        problemCode: 'PERCEIVED_SLOWNESS_CLUSTER',
        label: 'Lentidão perceptível',
        severity: 'medium',
        explanation: 'Operação acima do tempo alvo de UX.',
        evidence: { durationMs: event.durationMs, action: event.action },
        rootCauseHypothesis: 'Latência de endpoint e/ou renderização lenta.',
        recommendation: 'Instrumentar p95 por rota e aplicar cache de respostas frequentes.',
      });
    }

    if ((event.action === 'upgrade_attempt' || event.action === 'trial_start') && event.status === 'error') {
      diagnostics.push({
        problemCode: 'UPGRADE_FRICTION',
        label: 'Fricção em upgrade/trial',
        severity: 'medium',
        explanation: 'Usuário encontrou erro no fluxo de monetização.',
        evidence: { action: event.action, metadata: md },
        rootCauseHypothesis: 'Falha na abertura de checkout ou configuração ausente.',
        recommendation: 'Validar URLs de checkout no bootstrap e exibir fallback proativo.',
      });
    }

    for (var i = 0; i < diagnostics.length; i += 1) {
      diagnostics[i].id = uid('diag');
      diagnostics[i].createdAt = nowIso();
      diagnostics[i].module = event.module;
      diagnostics[i].correlationId = event.correlationId;
      this._addDiagnostic(diagnostics[i]);
    }
  };

  KroniaIntelligence.prototype.track = function (event) {
    var enriched = this._enrichEvent(event || {});
    this._state.events.unshift(enriched);
    this._state.events = this._state.events.slice(0, MAX_EVENTS);
    this._state.queue.push(enriched);
    if (this._state.queue.length > MAX_EVENTS) this._state.queue = this._state.queue.slice(-MAX_EVENTS);

    if (enriched.problemCode === 'INVALID_CONTRACT') this._state.counters.contractViolationsCount += 1;
    if (enriched.problemCode === 'FALLBACK_USED' || enriched.action === 'fallback') this._state.counters.fallbackCount += 1;
    if (Number.isFinite(Number(enriched.durationMs))) {
      this._state.counters.latencySamples.push(Number(enriched.durationMs));
      this._state.counters.latencySamples = this._state.counters.latencySamples.slice(-40);
    }

    this._detectDiagnostics(enriched);
    this._updateHealth();
    this._persist();

    var self = this;
    clearTimeout(this._flushTimer);
    this._flushTimer = setTimeout(function () { self.flush(); }, 350);
    return enriched;
  };

  KroniaIntelligence.prototype._getAccessToken = async function () {
    try {
      if (window._sb && window._sb.auth && typeof window._sb.auth.getSession === 'function') {
        var sessionResult = await window._sb.auth.getSession();
        return sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
      }
    } catch (_) {}
    return null;
  };

  KroniaIntelligence.prototype.flush = async function () {
    if (this._flushing) return { flushed: false, reason: 'already_flushing' };
    if (!this._state.queue.length) return { flushed: true, count: 0 };
    if (Date.now() < this._retryAt) return { flushed: false, reason: 'backoff' };

    this._flushing = true;
    var batch = this._state.queue.slice(0, 40);
    try {
      var token = await this._getAccessToken();
      if (!token) {
        this._flushing = false;
        return { flushed: false, reason: 'no_auth' };
      }

      var resp = await fetch('/api/kronia/intelligence', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ events: batch, context: this._state.context || {} }),
        keepalive: true,
      });

      if (!resp.ok) throw new Error('flush_failed_' + resp.status);
      this._state.queue = this._state.queue.slice(batch.length);
      this._retryAt = 0;
      this._persist();
      this._flushing = false;
      return { flushed: true, count: batch.length };
    } catch (_) {
      this._retryAt = Date.now() + 1500;
      this._flushing = false;
      return { flushed: false, reason: 'network_or_api_failure' };
    }
  };

  KroniaIntelligence.prototype.getLocalState = function () {
    return sanitizeValue(this._state, 0);
  };

  KroniaIntelligence.prototype.getRecommendations = function () {
    return (this._state.recommendations || []).slice(0, 12);
  };

  KroniaIntelligence.prototype.getPendingTasks = function () {
    return (this._state.tasks || []).slice(0, 12);
  };

  KroniaIntelligence.prototype.bridgeToAdminPanel = async function (filters) {
    try {
      var token = await this._getAccessToken();
      if (!token) return { success: false, code: 'UNAUTHORIZED' };
      var query = new URLSearchParams();
      var safeFilters = filters || {};
      if (safeFilters.severity) query.set('severity', String(safeFilters.severity));
      if (safeFilters.module) query.set('module', String(safeFilters.module));
      if (safeFilters.route) query.set('route', String(safeFilters.route));
      if (safeFilters.correlationId) query.set('correlationId', String(safeFilters.correlationId));
      query.set('action', 'summary');
      var resp = await fetch('/api/kronia/intelligence?' + query.toString(), {
        headers: { authorization: 'Bearer ' + token },
      });
      var json = await resp.json().catch(function () { return null; });
      return json || { success: false, code: 'INVALID_RESPONSE' };
    } catch (_) {
      return { success: false, code: 'BRIDGE_FAILURE' };
    }
  };

  window.KroniaIntelligence = window.KroniaIntelligence || new KroniaIntelligence();
})();
