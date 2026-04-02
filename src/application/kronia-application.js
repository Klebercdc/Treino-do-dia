(function () {
  'use strict';

  function nowISO() {
    return new Date().toISOString();
  }

  function safeTrack(payload) {
    try {
      window.KroniaIntelligence?.track?.(payload || {});
    } catch (_) {}
  }

  function normalizeText(v) {
    return String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
  }

  function hasAny(text, patterns) {
    return patterns.some(function (p) {
      return p.test(text);
    });
  }

  function classifyConversationIntent(input) {
    var text = normalizeText(input?.message);

    var workout =
      hasAny(text, [/\b(quero|preciso|criar|montar|fazer|ajustar|gerar)\b/]) &&
      hasAny(text, [/\b(treino|ficha|programa)\b/]);

    var diet =
      hasAny(text, [/\b(quero|preciso|criar|montar|fazer|ajustar|gerar)\b/]) &&
      hasAny(text, [/\b(dieta|alimentacao|plano)\b/]);

    var analysis = hasAny(text, [/\b(evolucao|progresso|funcionando|resultado|melhorei)\b/]);

    var supplement = hasAny(text, [/\b(creatina|whey|cafeina|pre treino|beta alanina)\b/]);

    if (workout) return 'workout_creation_request';
    if (diet) return 'diet_creation_request';
    if (analysis) return 'progress_analysis';
    if (supplement) return 'supplement_question';
    if (text) return 'general_question';
    return 'unknown';
  }

  function buildProgressAnalysisContext() {
    var history;
    try {
      history = JSON.parse(localStorage.getItem('kronia_history_v2') || '[]');
    } catch (_) {
      history = [];
    }

    if (!Array.isArray(history) || history.length < 2) {
      return {
        sufficientData: false,
        message: 'Ainda nao ha dados suficientes para analise.',
        sourceOfTruth: 'user_structured_data',
        usedStructuredUserData: true,
      };
    }

    return {
      sufficientData: true,
      message: 'Dados suficientes encontrados para analise.',
      sourceOfTruth: 'transform_snapshot',
      usedStructuredUserData: true,
      usedTransforms: true,
    };
  }

  function buildDecision(input) {
    var intent = classifyConversationIntent(input);

    if (intent === 'workout_creation_request') {
      return {
        type: 'answer_with_cta',
        intent: intent,
        message: 'Vou te levar para o treino.',
        cta: { label: 'Abrir treino', action: 'open_training_builder' },
      };
    }

    if (intent === 'diet_creation_request') {
      return {
        type: 'answer_with_cta',
        intent: intent,
        message: 'Vou te levar para dieta.',
        cta: { label: 'Abrir dieta', action: 'open_diet_generator' },
      };
    }

    if (intent === 'progress_analysis') {
      var analysisContext = buildProgressAnalysisContext();
      return {
        type: 'analysis_answer',
        intent: intent,
        message: analysisContext.message,
        sourceOfTruth: analysisContext.sourceOfTruth,
      };
    }

    if (intent === 'supplement_question') {
      return {
        type: 'answer_only',
        intent: intent,
        message: 'Posso te orientar sobre suplementos com base em evidencia cientifica atual.',
      };
    }

    return {
      type: 'answer_only',
      intent: intent,
      message: 'Entendi. Posso te ajudar com treino, dieta, evolucao ou suplementos.',
    };
  }

  function resolveConversationFlow(input) {
    var result = buildDecision(input);

    safeTrack({ module: 'conversation', intent: result.intent, type: result.type });

    window.KroniaIntelligence?.setAdminAuditTrace?.({
      conversation: {
        intent: result.intent,
        type: result.type,
        cta: result.cta || null,
        timestamp: nowISO(),
      },
    });

    return result;
  }

  window.KroniaApplication = window.KroniaApplication || {};
  window.KroniaApplication.application = {
    resolveConversationFlow: resolveConversationFlow,
  };
})();
