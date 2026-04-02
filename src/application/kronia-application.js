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
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function hasAny(text, patterns) {
    return patterns.some(function (pattern) {
      return pattern.test(text);
    });
  }

  function classifyConversationIntent(input) {
    var text = normalizeText(input?.message);

    var workout =
      hasAny(text, [/\b(quero|preciso|criar|montar|fazer|ajustar|gerar|monta)\b/]) &&
      hasAny(text, [/\b(treino|ficha|programa)\b/]);

    var diet =
      hasAny(text, [/\b(quero|preciso|criar|montar|fazer|ajustar|gerar|monta)\b/]) &&
      hasAny(text, [/\b(dieta|alimentacao|plano alimentar|plano nutricional|nutricao)\b/]);

    var analysis = hasAny(text, [/\b(evolucao|progresso|funcionando|resultado|melhorei|plato|aderencia|consistencia)\b/]);

    var supplement = hasAny(text, [/\b(creatina|whey|cafeina|pre treino|beta alanina|suplement)\b/]);

    if (workout) return 'workout_creation_request';
    if (diet) return 'diet_creation_request';
    if (analysis) return 'progress_analysis';
    if (supplement) return 'supplement_question';
    if (text) return 'general_question';
    return 'unknown';
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function buildProgressAnalysisContext() {
    var history = readJson('kronia_history_v2', []);
    var draft = readJson('kronia_draft_v2', null) || readJson('kronia_draft', null);
    var transforms = readJson('kronia_transforms_snapshot', null);

    var sessions = Array.isArray(history) ? history : [];
    var hasStructuredHistory = sessions.length >= 2;
    var hasDraft = !!(draft && Array.isArray(draft.sections));
    var hasTransforms = !!(transforms && typeof transforms === 'object');

    if (!hasStructuredHistory) {
      return {
        sufficientData: false,
        validationStatus: 'insufficient_data',
        blockedReason: 'history_below_minimum',
        message: 'Ainda nao ha dados suficientes para uma analise segura da sua evolucao.',
        sourceOfTruth: 'user_structured_data',
        usedStructuredUserData: true,
        usedTransforms: hasTransforms,
      };
    }

    return {
      sufficientData: true,
      validationStatus: 'validated',
      blockedReason: null,
      message: 'Analise pronta: dados estruturados suficientes para avaliar sua evolucao com seguranca.',
      sourceOfTruth: hasTransforms ? 'transform_snapshot' : 'user_structured_data',
      usedStructuredUserData: true,
      usedTransforms: hasTransforms || hasDraft,
    };
  }

  function buildDecision(input) {
    var intent = classifyConversationIntent(input);
    var base = {
      intent: intent,
      targetModule: 'chat',
      ctaAction: null,
      payload: {},
      validationStatus: 'validated',
      blockedReason: null,
      sourceOfTruth: 'conversation_input',
      usedStructuredUserData: false,
      usedTransforms: false,
      usedScientificEvidence: false,
      evidenceCount: 0,
      scienceTopicsUsed: [],
      usedFallback: false,
      timestamp: nowISO(),
    };

    if (intent === 'workout_creation_request') {
      return Object.assign({}, base, {
        type: 'answer_with_cta',
        targetModule: 'programa',
        ctaAction: 'open_training_builder',
        message: 'Perfeito. Vou te levar para montar seu treino no modulo oficial.',
      });
    }

    if (intent === 'diet_creation_request') {
      return Object.assign({}, base, {
        type: 'answer_with_cta',
        targetModule: 'dieta',
        ctaAction: 'open_diet_generator',
        message: 'Perfeito. Vou te levar para montar sua dieta no modulo oficial.',
      });
    }

    if (intent === 'progress_analysis') {
      var context = buildProgressAnalysisContext();
      return Object.assign({}, base, {
        type: 'analysis_answer',
        targetModule: 'analysis',
        message: context.message,
        sourceOfTruth: context.sourceOfTruth,
        usedStructuredUserData: !!context.usedStructuredUserData,
        usedTransforms: !!context.usedTransforms,
        validationStatus: context.validationStatus,
        blockedReason: context.blockedReason,
        payload: {
          sufficientData: context.sufficientData,
        },
      });
    }

    if (intent === 'supplement_question') {
      return Object.assign({}, base, {
        type: 'answer_only',
        targetModule: 'supplement',
        message: 'Posso te orientar sobre suplementos com base em evidencia cientifica e no seu contexto.',
      });
    }

    return Object.assign({}, base, {
      type: 'answer_only',
      message: 'Entendi. Posso te ajudar com evolucao, suplementos e direcionamento para treino ou dieta.',
      usedFallback: true,
      validationStatus: 'fallback_local',
    });
  }

  async function resolveConversationFlow(input) {
    var decision = buildDecision(input || {});

    if (decision.type === 'answer_with_cta') {
      try {
        var scienceBuilder = decision.ctaAction === 'open_training_builder'
          ? window.buildScientificConstraintsForWorkout
          : window.buildScientificConstraintsForDiet;
        if (typeof scienceBuilder === 'function') {
          var science = await scienceBuilder(input || {});
          decision.usedScientificEvidence = !!science?.usedScientificEvidence;
          decision.evidenceCount = Number(science?.evidenceCount || 0);
          decision.sourceOfTruth = science?.sourceOfTruth || decision.sourceOfTruth;
          decision.scienceTopicsUsed = Array.isArray(science?.scienceTopicsUsed) ? science.scienceTopicsUsed : [];
          decision.payload.scientificConstraints = science?.constraints || {};
          if (!science?.ok) {
            decision.type = 'answer_only';
            decision.ctaAction = null;
            decision.message = 'Ainda nao encontrei evidencia cientifica suficiente para direcionar com seguranca agora.';
            decision.validationStatus = 'blocked_missing_science';
            decision.blockedReason = science?.blockedReason || 'missing_science_evidence';
          }
        }
      } catch (_) {
        decision.usedFallback = true;
        decision.validationStatus = 'science_builder_error';
        decision.blockedReason = 'science_builder_error';
      }
    }

    var result = {
      type: decision.type,
      intent: decision.intent,
      message: decision.message,
      cta: decision.ctaAction ? {
        label: decision.ctaAction === 'open_training_builder' ? 'Abrir treino' : 'Abrir dieta',
        action: decision.ctaAction,
      } : null,
      targetModule: decision.targetModule,
      sourceOfTruth: decision.sourceOfTruth,
      evidenceCount: decision.evidenceCount,
      scienceTopicsUsed: decision.scienceTopicsUsed,
      usedScientificEvidence: decision.usedScientificEvidence,
      usedFallback: decision.usedFallback,
      usedTransforms: decision.usedTransforms,
      usedStructuredUserData: decision.usedStructuredUserData,
      validationStatus: decision.validationStatus,
      blockedReason: decision.blockedReason,
      payload: decision.payload,
      timestamp: decision.timestamp,
    };

    safeTrack({
      module: 'conversation',
      action: 'resolve_conversation_flow',
      status: 'success',
      intent: result.intent,
      type: result.type,
      source: 'kronia_application',
      metadata: {
        targetModule: result.targetModule,
        ctaAction: result.cta?.action || null,
        validationStatus: result.validationStatus,
        blockedReason: result.blockedReason,
        sourceOfTruth: result.sourceOfTruth,
        evidenceCount: result.evidenceCount,
      },
    });

    window.KroniaIntelligence?.setAdminAuditTrace?.({
      conversation: {
        intent: result.intent,
        type: result.type,
        targetModule: result.targetModule,
        ctaAction: result.cta?.action || null,
        sourceOfTruth: result.sourceOfTruth,
        usedScientificEvidence: result.usedScientificEvidence,
        evidenceCount: result.evidenceCount,
        scienceTopicsUsed: result.scienceTopicsUsed,
        usedFallback: result.usedFallback,
        usedTransforms: result.usedTransforms,
        usedStructuredUserData: result.usedStructuredUserData,
        validationStatus: result.validationStatus,
        blockedReason: result.blockedReason,
        payload: result.payload,
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
