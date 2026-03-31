(function () {
  'use strict';
  window.__KI = window.__KI || {};

  function priority(sev) {
    if (sev === 'CRITICAL' || sev === 'HIGH') return 'P1';
    if (sev === 'MEDIUM') return 'P2';
    return 'P3';
  }

  function buildTask(diagnostic) {
    return {
      title: '[' + (diagnostic.module || 'app') + '] ' + diagnostic.problemLabel,
      summary: diagnostic.likelyRootCause,
      module: diagnostic.module,
      priority: priority(diagnostic.severity),
      severity: diagnostic.severity,
      businessImpact: diagnostic.impactType,
      technicalImpact: 'reliability',
      probableFiles: diagnostic.module === 'diet' ? ['app.js', 'api/chat.js'] : diagnostic.module === 'exercise' ? ['app.js', 'src/app/api/kronia/exercises/details/route.ts'] : [],
      probableTables: ['ai_diagnostics'],
      acceptanceCriteria: ['Evento start/success/error correlacionado', 'Sem regressão funcional em KRONOS', 'Diagnóstico persistido com recommendation/task'],
      suggestedImplementationPlan: ['Reproduzir cenário', 'Corrigir causa raiz', 'Adicionar teste de regressão'],
      codexPrompt: 'Corrija ' + diagnostic.problemCode + ' no módulo ' + diagnostic.module + ' mantendo compatibilidade total com KRONOS e sem alterar pipeline conversacional.'
    };
  }

  window.__KI.TaskEngine = { buildTask: buildTask };
})();
