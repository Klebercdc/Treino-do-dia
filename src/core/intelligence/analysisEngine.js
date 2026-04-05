const ANALYSIS_RULES = [
  {
    id: 'diet_failure',
    match(events) {
      return events.filter((event) => event.type === 'diet_pipeline_failed').length > 3;
    },
    build(context) {
      return {
        id: 'insight_diet_failure',
        type: 'issue',
        title: 'Falha recorrente no pipeline de dieta',
        description: 'Múltiplas falhas detectadas na geração de dieta.',
        impact: 'high',
        domain: 'diet',
        suggested_action: 'Revisar normalizeDietEnvelope e validação do contrato de dieta (diet_primary/diet_failsafe).',
        frequency: context?.frequency?.diet_pipeline_failed || 0,
      };
    },
  },
  {
    id: 'exercise_low_value',
    match(events) {
      return events.filter((event) => event.type === 'exercise_detail_low_value_detected').length > 5;
    },
    build(context) {
      return {
        id: 'insight_exercise_low_value',
        type: 'issue',
        title: 'Baixo valor no módulo de exercícios',
        description: 'Exercícios sendo exibidos sem conteúdo didático suficiente.',
        impact: 'medium',
        domain: 'exercise',
        suggested_action: 'Aplicar curadoria automática e revisar catalog-curation.ts.',
        frequency: context?.frequency?.exercise_detail_low_value_detected || 0,
      };
    },
  },
  {
    id: 'contract_breaks',
    match(events) {
      return events.filter((event) => event.type === 'invalid_api_contract').length > 2;
    },
    build(context) {
      return {
        id: 'insight_contract_breaks',
        type: 'issue',
        title: 'Quebra recorrente de contrato',
        description: 'Eventos indicam inconsistências frequentes de contrato entre cliente e backend.',
        impact: 'high',
        domain: 'api',
        suggested_action: 'Adicionar validação de schema e testes de contrato no endpoint principal.',
        frequency: context?.frequency?.invalid_api_contract || 0,
      };
    },
  },
];

function normalizeEventType(event = {}) {
  if (event.problem_code) return String(event.problem_code).trim();
  if (event.problemCode) return String(event.problemCode).trim();
  if (event.action === 'contract_failure') return 'invalid_api_contract';
  return String(event.action || event.event || 'unknown').trim();
}

export function analyzeEvents(rawEvents) {
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  const normalized = events.map((event) => ({
    ...event,
    type: normalizeEventType(event),
  }));

  const frequency = normalized.reduce((acc, event) => {
    const key = event.type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const insights = [];
  for (const rule of ANALYSIS_RULES) {
    try {
      if (rule.match(normalized)) {
        insights.push({
          ...rule.build({ frequency }),
          created_at: new Date().toISOString(),
          source: 'analysis_engine',
        });
      }
    } catch (_) {}
  }

  return insights;
}

export { ANALYSIS_RULES };
