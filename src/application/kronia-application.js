(function () {
  'use strict';

  function nowISO() {
    return new Date().toISOString();
  }

  function safeTrack(payload) {
    try {
      window.KroniaIntelligence?.track?.(payload || {});
    } catch (_err) {
      return null;
    }
    return null;
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
      hasAny(text, [/\b(quero|preciso|criar|montar|fazer|ajustar|gerar|monta|elaborar)\b/]) &&
      hasAny(text, [/\b(treino|ficha|programa|periodizacao)\b/]);

    var diet =
      hasAny(text, [/\b(quero|preciso|criar|montar|fazer|ajustar|gerar|monta|elaborar)\b/]) &&
      hasAny(text, [/\b(dieta|alimentacao|plano alimentar|plano nutricional|nutricao|refeicao)\b/]);

    var analysis = hasAny(text, [
      /\b(evolucao|progresso|funcionando|resultado|melhorei|plato|aderencia|consistencia|desempenho|carga|frequencia)\b/
    ]);

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
    } catch (_err) {
      return fallback;
    }
  }

  function numberFrom(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function parseLoadFromValue(value) {
    var n = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function buildProgressAnalysisContext() {
    var history = readJson('kronia_history_v2', []);
    var draft = readJson('kronia_draft_v2', null) || readJson('kronia_draft', null);
    var transforms = readJson('kronia_transforms_snapshot', null);

    var sessions = Array.isArray(history) ? history : [];
    var recentSessions = sessions.slice(0, 12);
    var hasDraft = !!(draft && Array.isArray(draft.sections));
    var hasTransforms = !!(transforms && typeof transforms === 'object');

    var totalExercises = 0;
    var totalSeries = 0;
    var totalLoad = 0;
    var weightedLoadSamples = 0;

    recentSessions.forEach(function (session) {
      var sections = Array.isArray(session?.state?.sections) ? session.state.sections : [];
      sections.forEach(function (section) {
        var cards = Array.isArray(section?.cards) ? section.cards : [];
        totalExercises += cards.length;
        cards.forEach(function (card) {
          var values = Array.isArray(card?.values) ? card.values : [];
          totalSeries += values.length;
          values.forEach(function (v) {
            var kg = parseLoadFromValue(v?.kg);
            var reps = parseLoadFromValue(v?.reps);
            if (kg > 0 && reps > 0) {
              totalLoad += kg * reps;
              weightedLoadSamples += 1;
            }
          });
        });
      });
    });

    var averageSeriesPerSession = recentSessions.length ? (totalSeries / recentSessions.length) : 0;
    var sessionDates = recentSessions
      .map(function (s) { return s?.createdAt || s?.trained_at || null; })
      .filter(Boolean)
      .map(function (d) { return new Date(d).getTime(); })
      .filter(function (t) { return Number.isFinite(t); })
      .sort(function (a, b) { return a - b; });

    var avgIntervalDays = 0;
    if (sessionDates.length >= 2) {
      var totalGap = 0;
      for (var i = 1; i < sessionDates.length; i += 1) {
        totalGap += (sessionDates[i] - sessionDates[i - 1]) / (1000 * 60 * 60 * 24);
      }
      avgIntervalDays = totalGap / (sessionDates.length - 1);
    }

    var sufficientData = recentSessions.length >= 3 && totalSeries >= 12;
    if (!sufficientData) {
      return {
        sufficientData: false,
        validationStatus: 'insufficient_data',
        blockedReason: 'progress_history_below_minimum',
        message: 'Ainda nao ha base suficiente para uma analise robusta. Registre mais sessoes e series completas.',
        sourceOfTruth: hasTransforms ? 'transform_snapshot' : 'user_structured_data',
        usedStructuredUserData: recentSessions.length > 0,
        usedTransforms: hasTransforms || hasDraft,
        payload: {
          sessionsConsidered: recentSessions.length,
          totalSeries: totalSeries,
          hasDraft: hasDraft,
          hasTransforms: hasTransforms,
        },
      };
    }

    var consistencyLabel = avgIntervalDays > 0 && avgIntervalDays <= 3.5
      ? 'consistencia alta'
      : avgIntervalDays > 0 && avgIntervalDays <= 5.5
        ? 'consistencia moderada'
        : 'consistencia irregular';

    var averageLoadPerSet = weightedLoadSamples ? (totalLoad / weightedLoadSamples) : 0;
    var message = [
      'Diagnostico de progresso:',
      'foram analisadas ' + recentSessions.length + ' sessoes recentes, com ' + totalSeries + ' series registradas.',
      'A frequencia indica ' + consistencyLabel + (avgIntervalDays ? ' (intervalo medio de ' + avgIntervalDays.toFixed(1) + ' dias).' : '.'),
      'Volume medio aproximado de ' + averageSeriesPerSession.toFixed(1) + ' series por sessao.',
      averageLoadPerSet > 0
        ? 'Carga media por serie valida em torno de ' + averageLoadPerSet.toFixed(1) + ' kg-reps.'
        : 'Nao houve amostra de carga/repeticao suficiente para calcular tendencia de carga.'
    ].join(' ');

    return {
      sufficientData: true,
      validationStatus: 'validated',
      blockedReason: null,
      message: message,
      sourceOfTruth: hasTransforms ? 'combined_scientific_engine' : 'user_structured_data',
      usedStructuredUserData: true,
      usedTransforms: hasTransforms || hasDraft,
      payload: {
        sessionsConsidered: recentSessions.length,
        totalExercises: totalExercises,
        totalSeries: totalSeries,
        averageSeriesPerSession: Number(averageSeriesPerSession.toFixed(2)),
        averageLoadPerSet: Number(averageLoadPerSet.toFixed(2)),
        avgIntervalDays: Number(avgIntervalDays.toFixed(2)),
      },
    };
  }

  function decisionBase(intent) {
    return {
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
  }

  function buildDecision(input) {
    var intent = classifyConversationIntent(input);
    var base = decisionBase(intent);

    if (intent === 'workout_creation_request') {
      return Object.assign({}, base, {
        type: 'answer_with_cta',
        targetModule: 'programa',
        ctaAction: 'open_training_builder',
        message: 'Perfeito. Posso abrir o modulo oficial de treino quando voce clicar no botao abaixo.',
      });
    }

    if (intent === 'diet_creation_request') {
      return Object.assign({}, base, {
        type: 'answer_with_cta',
        targetModule: 'dieta',
        ctaAction: 'open_diet_generator',
        message: 'Perfeito. Posso abrir o modulo oficial de dieta quando voce clicar no botao abaixo.',
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
        payload: context.payload,
      });
    }

    if (intent === 'supplement_question') {
      return Object.assign({}, base, {
        type: 'answer_only',
        targetModule: 'supplement',
        message: 'Creatina funciona para ganho de forca e massa quando o treino e a dieta estao consistentes.',
      });
    }

    return Object.assign({}, base, {
      type: 'answer_only',
      message: 'Entendi. Posso ajudar com evolucao, suplementos e direcionamento para treino ou dieta.',
      usedFallback: true,
      validationStatus: 'fallback_local',
    });
  }

  function setAuditTrace(tracePayload) {
    try {
      window.KroniaIntelligence?.setAdminAuditTrace?.(tracePayload || {});
    } catch (_err) {
      return null;
    }
    return null;
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
          decision.payload.scienceValidation = science?.validationStatus || (science?.ok ? 'validated' : 'blocked');

          setAuditTrace({
            science: {
              sourceOfTruth: decision.sourceOfTruth,
              usedScientificEvidence: decision.usedScientificEvidence,
              evidenceCount: decision.evidenceCount,
              scienceTopicsUsed: decision.scienceTopicsUsed,
              usedFallback: !!science?.usedFallback,
              blockedReason: science?.blockedReason || null,
              validationStatus: science?.validationStatus || (science?.ok ? 'validated' : 'blocked'),
              timestamp: nowISO(),
            },
          });

          if (!science?.ok) {
            decision.type = 'answer_only';
            decision.ctaAction = null;
            decision.message = 'Ainda nao encontrei evidencia cientifica suficiente para direcionar com seguranca agora.';
            decision.validationStatus = science?.validationStatus || 'blocked_missing_science';
            decision.blockedReason = science?.blockedReason || 'missing_science_evidence';
          }
        }
      } catch (_err) {
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
      ctaAction: decision.ctaAction,
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

    setAuditTrace({
      conversation: {
        intent: result.intent,
        type: result.type,
        message: result.message,
        targetModule: result.targetModule,
        ctaRendered: false,
        ctaClicked: false,
        ctaLabel: result.cta?.label || null,
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
