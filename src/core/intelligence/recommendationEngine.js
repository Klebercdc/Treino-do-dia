(function () {
  'use strict';
  window.__KI = window.__KI || {};

  function recommend(diagnostic) {
    var map = {
      diet_pipeline_failed: 'Backend: reforçar validação do payload de dieta e timeout de /api/agent.',
      diet_contract_normalization_failed: 'Frontend+Contrato: padronizar shape diet_result e normalização única.',
      invalid_api_contract: 'Contrato: adicionar schema guard central e testes de regressão de envelope.',
      exercise_detail_low_value_detected: 'Conteúdo+UX: preencher mídia/instruções faltantes no catálogo de exercícios.',
      premium_cta_friction: 'Monetização: validar checkout URLs no bootstrap e fallback de CTA.',
      slow_response_cluster: 'Performance: monitorar p95 por rota e aplicar cache de leitura.',
      onboarding_dropoff: 'UX: reduzir atrito do fluxo final de onboarding e validar estados.',
      unknown_fallback_loop: 'Confiabilidade: quebrar loop de fallback com circuit-breaker local.',
    };
    return { text: map[diagnostic.problemCode] || 'Melhorar observabilidade e proteção de contratos.', area: diagnostic.module || 'app' };
  }

  window.__KI.RecommendationEngine = { recommend: recommend };
})();
