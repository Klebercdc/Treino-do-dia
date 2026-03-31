(function () {
  'use strict';
  window.__KI = window.__KI || {};

  function decide(event, context) {
    var out = [];
    var md = event.metadata || {};

    if (event.module === 'diet' && event.status === 'error') {
      out.push({ problemCode: 'diet_pipeline_failed', problemLabel: 'Falha no pipeline de dieta', module: 'diet', severity: 'HIGH', confidence: 0.88, impactType: 'reliability', likelyRootCause: 'Erro de contrato, parser ou fallback genérico.', shouldPersist: true });
    }
    if (event.action === 'contract_failure' || event.problemCode === 'INVALID_CONTRACT') {
      out.push({ problemCode: 'invalid_api_contract', problemLabel: 'Contrato de API inválido', module: event.module || 'api', severity: 'HIGH', confidence: 0.92, impactType: 'contract', likelyRootCause: 'Resposta fora do schema esperado.', shouldPersist: true });
      if (event.module === 'diet') {
        out.push({ problemCode: 'diet_contract_normalization_failed', problemLabel: 'Normalização de contrato de dieta falhou', module: 'diet', severity: 'HIGH', confidence: 0.91, impactType: 'contract', likelyRootCause: 'Node diet_result ausente/inconsistente.', shouldPersist: true });
      }
    }
    if (event.module === 'exercise' && md && (md.completenessScore < 55 || md.hasMedia === false || md.hasInstructions === false)) {
      out.push({ problemCode: 'exercise_detail_low_value_detected', problemLabel: 'Detalhe de exercício com baixo valor', module: 'exercise', severity: 'MEDIUM', confidence: 0.79, impactType: 'ux', likelyRootCause: 'Mídia/instruções insuficientes.', shouldPersist: true });
    }
    if (event.module === 'onboarding' && event.action === 'onboarding_complete' && event.status === 'error') {
      out.push({ problemCode: 'onboarding_dropoff', problemLabel: 'Abandono no onboarding', module: 'onboarding', severity: 'MEDIUM', confidence: 0.74, impactType: 'activation', likelyRootCause: 'Erro de validação/UX no fechamento.', shouldPersist: true });
    }
    if (event.module === 'monetization' && event.action === 'upgrade_attempt' && event.status === 'error') {
      out.push({ problemCode: 'premium_cta_friction', problemLabel: 'Fricção no CTA premium', module: 'monetization', severity: 'MEDIUM', confidence: 0.84, impactType: 'revenue', likelyRootCause: 'Checkout não configurado ou falha de redirecionamento.', shouldPersist: true });
    }
    if (event.durationMs && event.durationMs > 2500) {
      out.push({ problemCode: 'slow_response_cluster', problemLabel: 'Cluster de lentidão', module: event.module || 'app', severity: 'MEDIUM', confidence: 0.68, impactType: 'performance', likelyRootCause: 'Latência alta em endpoint/render.', shouldPersist: true });
    }
    if (context && context.fallbackCount >= 3) {
      out.push({ problemCode: 'unknown_fallback_loop', problemLabel: 'Loop de fallback', module: event.module || 'app', severity: 'HIGH', confidence: 0.81, impactType: 'reliability', likelyRootCause: 'Fallback repetitivo sem recuperação.', shouldPersist: true });
    }

    return out;
  }

  window.__KI.DecisionEngine = { decide: decide };
})();
