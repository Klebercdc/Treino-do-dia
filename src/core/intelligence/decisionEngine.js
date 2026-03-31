function normalizeImpact(impact) {
  const value = String(impact || '').toLowerCase();
  if (value === 'critical' || value === 'high') return 'high';
  if (value === 'medium') return 'medium';
  return 'low';
}

function priorityFromImpact(impact, frequency) {
  const normalized = normalizeImpact(impact);
  const freq = Number(frequency || 0);
  if (normalized === 'high' && freq >= 3) return 'P0';
  if (normalized === 'high') return 'P1';
  if (normalized === 'medium' && freq >= 5) return 'P1';
  if (normalized === 'medium') return 'P2';
  return 'P3';
}

export function buildOperationalBacklog(insights) {
  const safeInsights = Array.isArray(insights) ? insights : [];

  const issues = safeInsights.map((insight) => ({
    issueId: 'issue_' + String(insight.id || insight.title || 'unknown').replace(/\s+/g, '_').toLowerCase(),
    title: insight.title || 'Issue operacional',
    description: insight.description || 'Sem descrição',
    domain: insight.domain || 'system',
    impact: normalizeImpact(insight.impact),
    frequency: Number(insight.frequency || 0),
    priority: priorityFromImpact(insight.impact, insight.frequency),
    status: 'open',
  }));

  const tasks = issues.map((issue) => ({
    taskId: 'task_' + issue.issueId,
    title: '[AUTO] ' + issue.title,
    summary: issue.description,
    domain: issue.domain,
    priority: issue.priority,
    sourceIssueId: issue.issueId,
    suggestedImplementationPlan: [
      'Reproduzir cenário em ambiente de teste',
      'Corrigir causa raiz com validação de contrato/qualidade',
      'Adicionar observabilidade e teste de regressão',
    ],
  }));

  const recommendations = issues.map((issue) => ({
    recommendationId: 'rec_' + issue.issueId,
    title: 'Recomendação para ' + issue.domain,
    text: issue.description,
    area: issue.domain,
    priority: issue.priority,
  }));

  return { issues, tasks, recommendations };
}
