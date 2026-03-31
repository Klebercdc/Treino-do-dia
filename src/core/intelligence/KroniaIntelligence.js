(function () {
  'use strict';

  window.__KI = window.__KI || {};

  function KroniaIntelligence() {
    this.state = {
      initialized: false,
      userId: null,
      context: {},
      events: [],
      diagnostics: [],
      recommendations: [],
      tasks: [],
      operationalContext: {},
    };
    this.diagnosticEngine = new window.__KI.DiagnosticEngine();
    this.flushTimer = null;
  }

  KroniaIntelligence.prototype.init = function (payload) {
    if (this.state.initialized) return this.getLocalState();
    this.state.initialized = true;
    this.setContext(payload || {});
    return this.getLocalState();
  };

  KroniaIntelligence.prototype.identifyUser = function (input) {
    this.state.userId = input?.userId || this.state.userId;
    this.setContext({ userId: this.state.userId, plan: input?.plan || this.state.context.plan || null });
  };

  KroniaIntelligence.prototype.setContext = function (ctx) {
    this.state.context = Object.assign({}, this.state.context, window.__KI.EventCollector.sanitize(ctx || {}, 0));
  };

  KroniaIntelligence.prototype.track = function (rawEvent) {
    var event = window.__KI.EventCollector.collect(rawEvent || {}, this.state.context || {});
    this.state.events.unshift(event);
    this.state.events = this.state.events.slice(0, 250);

    this.state.operationalContext = window.__KI.ContextBuilder.build(this.state.events, this.state.operationalContext);
    var decisions = window.__KI.DecisionEngine.decide(event, this.state.operationalContext);

    var persistedRows = [];
    for (var i = 0; i < decisions.length; i += 1) {
      var d = decisions[i];
      var rec = window.__KI.RecommendationEngine.recommend(d);
      var task = window.__KI.TaskEngine.buildTask(d);
      this.state.diagnostics.unshift(d);
      this.state.recommendations.unshift(rec);
      this.state.tasks.unshift(task);
      persistedRows.push({
        userId: event.userId,
        module: d.module || event.module,
        action: event.action,
        event: event.status,
        severity: d.severity || event.severity,
        problemCode: d.problemCode,
        problemLabel: d.problemLabel,
        analysis: { diagnostic: d, context: this.state.operationalContext, event: event },
        recommendation: rec,
        task: task,
        correlationId: event.correlationId,
        source: event.source,
        appVersion: event.metadata?.appVersion || this.state.context.appVersion || null,
      });
    }

    this.state.diagnostics = this.state.diagnostics.slice(0, 80);
    this.state.recommendations = this.state.recommendations.slice(0, 80);
    this.state.tasks = this.state.tasks.slice(0, 80);

    if (persistedRows.length) this.diagnosticEngine.enqueue(persistedRows);
    clearTimeout(this.flushTimer);
    var self = this;
    this.flushTimer = setTimeout(function () { self.flush(); }, 400);

    return event;
  };

  KroniaIntelligence.prototype.flush = async function () {
    return this.diagnosticEngine.flush(this.state.operationalContext);
  };

  KroniaIntelligence.prototype.getLocalState = function () {
    return {
      initialized: this.state.initialized,
      context: this.state.context,
      operationalContext: this.state.operationalContext,
      diagnostics: this.state.diagnostics.slice(0, 20),
    };
  };

  KroniaIntelligence.prototype.getRecommendations = function () {
    return this.state.recommendations.slice(0, 20);
  };

  KroniaIntelligence.prototype.getPendingTasks = function () {
    return this.state.tasks.slice(0, 20);
  };

  KroniaIntelligence.prototype.bridgeToAdminPanel = async function (filters) {
    return window.__KI.AdminBridge.getOverview(filters || {});
  };

  window.KroniaIntelligence = window.KroniaIntelligence || new KroniaIntelligence();
  try { window.__KI.AdminBridge.exposeAdminBridge(window.KroniaIntelligence); } catch (_) {}
})();
