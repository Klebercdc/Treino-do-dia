(function () {
  'use strict';

  var STORAGE_KEY = 'kronia_intelligence_state_v1';
  var MAX_EVENTS = 200;

  function uid(prefix) { return (prefix || 'ki') + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36); }
  function nowIso() { return new Date().toISOString(); }
  function safeParse(raw, fallback) { try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }

  function sanitize(value, depth) {
    if (depth > 3) return '[truncated]';
    if (value == null) return value;
    if (typeof value === 'string') {
      return value
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
        .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted:key]')
        .replace(/eyJ[A-Za-z0-9._-]+/g, '[redacted:jwt]')
        .slice(0, 500);
    }
    if (Array.isArray(value)) return value.slice(0, 20).map(function (x) { return sanitize(x, depth + 1); });
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).slice(0, 50).forEach(function (k) {
        out[k] = /(token|secret|password|authorization|service_role|apikey|key)/i.test(k) ? '[redacted]' : sanitize(value[k], depth + 1);
      });
      return out;
    }
    return value;
  }

  function KroniaIntelligence() {
    this._state = safeParse(localStorage.getItem(STORAGE_KEY), null) || {
      initialized: false,
      events: [],
      queue: [],
      diagnostics: [],
      recommendations: [],
      tasks: [],
      context: {},
      userId: null,
      counters: { fallbackCount: 0, contractViolationsCount: 0, latencies: [] },
      operational: {},
    };
    this._flushing = false;
    this._retryInMs = 0;
    this._timer = null;
  }

  KroniaIntelligence.prototype._persist = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state)); } catch (_) {}
  };

  KroniaIntelligence.prototype.init = function (ctx) {
    if (this._state.initialized) return this.getLocalState();
    this._state.initialized = true;
    this.setContext(ctx || {});
    this._persist();
    return this.getLocalState();
  };

  KroniaIntelligence.prototype.identifyUser = function (input) {
    this._state.userId = input?.userId || this._state.userId;
    this.setContext({ userId: this._state.userId, plan: input?.plan || this._state.context.plan || null });
  };

  KroniaIntelligence.prototype.setContext = function (ctx) {
    this._state.context = Object.assign({}, this._state.context, sanitize(ctx || {}, 0));
    this._persist();
  };

  KroniaIntelligence.prototype._buildEvent = function (raw) {
    var event = sanitize(raw || {}, 0);
    return {
      eventId: event.eventId || uid('evt'),
      timestamp: event.timestamp || nowIso(),
      userId: event.userId || this._state.userId || null,
      module: event.module || 'unknown',
      action: event.action || 'unknown',
      payload: event.payload || null,
      result: event.result || null,
      status: event.status || 'info',
      durationMs: Number.isFinite(Number(event.durationMs)) ? Number(event.durationMs) : null,
      severity: (event.severity || (event.status === 'error' ? 'HIGH' : 'LOW')).toUpperCase(),
      plan: event.plan || this._state.context.plan || null,
      route: event.route || this._state.context.route || null,
      source: event.source || 'client',
      correlationId: event.correlationId || uid('corr'),
      metadata: sanitize(Object.assign({}, this._state.context, event.metadata || {}), 0),
    };
  };

  KroniaIntelligence.prototype._updateOperational = function () {
    var events = this._state.events;
    var lastSuccess = events.find(function (x) { return x.status === 'success'; });
    var lastFail = events.find(function (x) { return x.status === 'error'; });
    var fails = events.filter(function (x) { return x.status === 'error'; }).length;
    var lat = this._state.counters.latencies;
    var avg = lat.length ? Math.round(lat.reduce(function (a, b) { return a + b; }, 0) / lat.length) : 0;
    var friction = Math.min(100, fails * 10 + this._state.counters.fallbackCount * 8 + this._state.counters.contractViolationsCount * 10 + (avg > 2200 ? 15 : 0));

    function score(module, list) {
      var scoped = list.filter(function (x) { return x.module === module; });
      if (!scoped.length) return 100;
      var err = scoped.filter(function (x) { return x.status === 'error'; }).length;
      return Math.max(0, 100 - Math.round((err / scoped.length) * 100));
    }

    this._state.operational = {
      currentJourney: this._state.context.currentJourney || null,
      lastSuccessfulAction: lastSuccess ? lastSuccess.action : null,
      lastFailedAction: lastFail ? lastFail.action : null,
      repeatedFailures: fails >= 3 ? fails : 0,
      fallbackCount: this._state.counters.fallbackCount,
      contractViolationsCount: this._state.counters.contractViolationsCount,
      frictionScore: friction,
      averageLatency: avg,
      suspectedProblemType: lastFail ? (lastFail.problemCode || 'runtime_instability') : null,
      dietHealthScore: score('diet', events),
      exerciseHealthScore: score('exercise', events),
      trainingHealthScore: score('training', events),
      monetizationHealthScore: score('monetization', events),
    };
  };

  KroniaIntelligence.prototype._diagnose = function (event) {
    var out = [];
    if (event.module === 'diet' && event.status === 'error') {
      out.push({ problemCode: 'diet_pipeline_failed', problemLabel: 'Falha no pipeline de dieta', module: 'diet', severity: 'HIGH', confidence: 0.88, impactType: 'reliability', likelyRootCause: 'Fallback genérico, parser ou retorno inesperado.', shouldPersist: true });
    }
    if (event.action === 'contract_failure' || event.problemCode === 'INVALID_CONTRACT') {
      out.push({ problemCode: 'invalid_api_contract', problemLabel: 'Contrato inválido', module: event.module || 'api', severity: 'HIGH', confidence: 0.92, impactType: 'contract', likelyRootCause: 'Envelope fora do schema.', shouldPersist: true });
      if (event.module === 'diet') out.push({ problemCode: 'diet_contract_normalization_failed', problemLabel: 'Falha de normalização de contrato de dieta', module: 'diet', severity: 'HIGH', confidence: 0.9, impactType: 'contract', likelyRootCause: 'Node diet_result ausente/inválido.', shouldPersist: true });
    }
    if (event.module === 'exercise' && (event.metadata?.hasMedia === false || event.metadata?.hasInstructions === false || Number(event.metadata?.completenessScore || 0) < 55)) {
      out.push({ problemCode: 'exercise_detail_low_value_detected', problemLabel: 'Baixa qualidade no detalhe de exercício', module: 'exercise', severity: 'MEDIUM', confidence: 0.8, impactType: 'ux', likelyRootCause: 'Mídia/instruções insuficientes.', shouldPersist: true });
    }
    if (event.module === 'monetization' && event.action === 'upgrade_attempt' && event.status === 'error') {
      out.push({ problemCode: 'premium_cta_friction', problemLabel: 'Fricção de upgrade', module: 'monetization', severity: 'MEDIUM', confidence: 0.84, impactType: 'revenue', likelyRootCause: 'Checkout ausente/falho.', shouldPersist: true });
    }
    if (event.durationMs && event.durationMs > 2500) out.push({ problemCode: 'slow_response_cluster', problemLabel: 'Lentidão perceptível', module: event.module || 'app', severity: 'MEDIUM', confidence: 0.7, impactType: 'performance', likelyRootCause: 'Latência acima do alvo.', shouldPersist: true });

    return out;
  };

  KroniaIntelligence.prototype._recommend = function (d) {
    var map = {
      diet_contract_normalization_failed: 'Padronizar contrato diet_result e centralizar normalização no frontend/backend.',
      exercise_detail_low_value_detected: 'Completar mídia e instruções do catálogo para elevar qualidade de detalhe.',
      invalid_api_contract: 'Adicionar validação de schema e testes de contrato no endpoint.',
      diet_pipeline_failed: 'Reforçar fallback estruturado e observabilidade do pipeline de dieta.',
      premium_cta_friction: 'Validar URL de checkout no bootstrap e adicionar fallback de CTA.',
      slow_response_cluster: 'Monitorar p95 por rota e otimizar cache/tempo de resposta.',
    };
    return { text: map[d.problemCode] || 'Aprimorar observabilidade técnica.', area: d.module };
  };

  KroniaIntelligence.prototype._task = function (d) {
    return {
      title: '[' + d.module + '] ' + d.problemLabel,
      summary: d.likelyRootCause,
      module: d.module,
      priority: d.severity === 'HIGH' || d.severity === 'CRITICAL' ? 'P1' : 'P2',
      severity: d.severity,
      businessImpact: d.impactType,
      technicalImpact: 'reliability',
      probableFiles: d.module === 'diet' ? ['app.js', 'api/chat.js'] : d.module === 'exercise' ? ['app.js', 'src/app/api/kronia/exercises/details/route.ts'] : [],
      probableTables: ['kronia_intelligence_events'],
      acceptanceCriteria: ['Sem regressão KRONOS', 'Eventos correlacionados start/success/error', 'Diagnóstico persistido com recommendation/task'],
      suggestedImplementationPlan: ['Reproduzir', 'Corrigir causa raiz', 'Adicionar teste'],
      codexPrompt: 'Corrija ' + d.problemCode + ' no módulo ' + d.module + ' sem alterar comportamento conversacional da KRONOS.'
    };
  };

  KroniaIntelligence.prototype.track = function (raw) {
    var event = this._buildEvent(raw || {});
    this._state.events.unshift(event);
    this._state.events = this._state.events.slice(0, MAX_EVENTS);
    this._state.queue.push(event);
    this._state.queue = this._state.queue.slice(-MAX_EVENTS);

    if (event.status === 'fallback') this._state.counters.fallbackCount += 1;
    if (event.action === 'contract_failure' || event.problemCode === 'INVALID_CONTRACT') this._state.counters.contractViolationsCount += 1;
    if (event.durationMs) {
      this._state.counters.latencies.push(event.durationMs);
      this._state.counters.latencies = this._state.counters.latencies.slice(-40);
    }

    var diagnostics = this._diagnose(event);
    for (var i = 0; i < diagnostics.length; i += 1) {
      var d = diagnostics[i];
      var recommendation = this._recommend(d);
      var task = this._task(d);
      this._state.diagnostics.unshift(d);
      this._state.recommendations.unshift(recommendation);
      this._state.tasks.unshift(task);
      this._state.queue.push({
        userId: event.userId,
        module: d.module,
        action: event.action,
        event: event.status,
        severity: d.severity,
        problemCode: d.problemCode,
        problemLabel: d.problemLabel,
        analysis: { diagnostic: d, operational: this._state.operational, event: event },
        recommendation: recommendation,
        task: task,
        correlationId: event.correlationId,
        source: event.source,
        appVersion: event.metadata?.appVersion || null,
      });
    }

    this._state.diagnostics = this._state.diagnostics.slice(0, 80);
    this._state.recommendations = this._state.recommendations.slice(0, 80);
    this._state.tasks = this._state.tasks.slice(0, 80);

    this._updateOperational();
    this._persist();

    var self = this;
    clearTimeout(this._timer);
    this._timer = setTimeout(function () { self.flush(); }, 350);

    return event;
  };

  KroniaIntelligence.prototype._token = async function () {
    try {
      var sess = await window._sb?.auth?.getSession?.();
      return sess?.data?.session?.access_token || null;
    } catch (_) { return null; }
  };

  KroniaIntelligence.prototype.flush = async function () {
    if (this._flushing) return { ok: false, reason: 'busy' };
    if (!this._state.queue.length) return { ok: true, count: 0 };
    if (this._retryInMs && this._retryInMs > Date.now()) return { ok: false, reason: 'backoff' };

    this._flushing = true;
    var batch = this._state.queue.slice(0, 40);
    try {
      var token = await this._token();
      if (!token) { this._flushing = false; return { ok: false, reason: 'no_auth' }; }
      var resp = await fetch('/api/kronia/intelligence', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ events: batch, context: this._state.context }),
        keepalive: true,
      });
      if (!resp.ok) throw new Error('ingest_failed');
      this._state.queue = this._state.queue.slice(batch.length);
      this._persist();
      this._retryInMs = 0;
      this._flushing = false;
      return { ok: true, count: batch.length };
    } catch (_) {
      this._retryInMs = Date.now() + 1500;
      this._flushing = false;
      return { ok: false, reason: 'network_or_api' };
    }
  };

  KroniaIntelligence.prototype.getLocalState = function () {
    return sanitize(this._state, 0);
  };

  KroniaIntelligence.prototype.getRecommendations = function () {
    return this._state.recommendations.slice(0, 20);
  };

  KroniaIntelligence.prototype.getPendingTasks = function () {
    return this._state.tasks.slice(0, 20);
  };

  KroniaIntelligence.prototype.bridgeToAdminPanel = async function (filters) {
    try {
      var token = await this._token();
      if (!token) return { success: false, error: { code: 'UNAUTHORIZED' } };
      var qs = new URLSearchParams(filters || {});
      qs.set('action', 'overview');
      var resp = await fetch('/api/kronia/intelligence?' + qs.toString(), { headers: { authorization: 'Bearer ' + token } });
      return resp.json().catch(function () { return { success: false, error: { code: 'INVALID_RESPONSE' } }; });
    } catch (_) {
      return { success: false, error: { code: 'BRIDGE_FAILURE' } };
    }
  };

  window.KroniaIntelligence = window.KroniaIntelligence || new KroniaIntelligence();
})();
