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
    var transforms = readJson('kronia_transforms_snapshot', null);
    var sessions = Array.isArray(history) ? history : [];

    if (sessions.length < 2) {
      return {
        sufficientData: false,
        sourceOfTruth: 'user_structured_data',
        validationStatus: 'insufficient_data',
        blockedReason: 'history_below_minimum',
        usedStructuredUserData: true,
        usedTransforms: !!transforms,
        summary: 'Ainda não há dados suficientes para uma análise segura da sua evolução.',
      };
    }

    var recent = sessions.slice(-8);
    var totalVolume = 0;
    var totalSets = 0;
    var datedSessions = 0;
    var progressionSamples = [];

    recent.forEach(function (session) {
      var dateValue = session?.createdAt || session?.trained_at || session?.date || null;
      if (dateValue) datedSessions += 1;

      var blocks = Array.isArray(session?.exercises) ? session.exercises : [];
      if (!blocks.length) {
        var sections = Array.isArray(session?.state?.sections) ? session.state.sections : [];
        sections.forEach(function (section) {
          (Array.isArray(section?.cards) ? section.cards : []).forEach(function (card) {
            blocks.push({ sets: Array.isArray(card?.values) ? card.values.map(function (v) { return { reps: v?.reps, weight: v?.kg }; }) : [] });
          });
        });
      }

      blocks.forEach(function (exercise) {
        var sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
        sets.forEach(function (set) {
          var reps = numberFrom(set?.reps);
          var load = numberFrom(set?.weight || set?.carga || set?.kg);
          if (reps > 0 && load > 0) {
            totalVolume += reps * load;
            progressionSamples.push(load);
          }
          if (reps > 0) totalSets += 1;
        });
      });
    });

    var firstHalf = progressionSamples.slice(0, Math.floor(progressionSamples.length / 2));
    var secondHalf = progressionSamples.slice(Math.floor(progressionSamples.length / 2));
    var avg = function (arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; };
    var loadTrend = 'stable';
    var delta = avg(secondHalf) - avg(firstHalf);
    if (delta > 1.5) loadTrend = 'up';
    else if (delta < -1.5) loadTrend = 'down';

    var adherenceRatio = recent.length ? (datedSessions / recent.length) : 0;

    return {
      sufficientData: true,
      sourceOfTruth: transforms ? 'transform_snapshot' : 'user_structured_data',
      validationStatus: 'validated',
      blockedReason: null,
      usedStructuredUserData: true,
      usedTransforms: !!transforms,
      summary: 'Análise disponível com base no seu histórico recente.',
      metrics: {
        sessions: recent.length,
        totalVolume: Math.round(totalVolume),
        totalSets: totalSets,
        loadTrend: loadTrend,
        adherenceRatio: Number(adherenceRatio.toFixed(2)),
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
        ctaAction: 'open_training',
        message: 'Perfeito. Posso abrir o modulo oficial de treino quando voce clicar no botao abaixo.',
      });
    }

    if (intent === 'diet_creation_request') {
      return Object.assign({}, base, {
        type: 'answer_with_cta',
        targetModule: 'dieta',
        ctaAction: 'open_diet',
        message: 'Perfeito. Posso abrir o modulo oficial de dieta quando voce clicar no botao abaixo.',
      });
    }

    if (intent === 'progress_analysis') {
      var context = buildProgressAnalysisContext();
      return Object.assign({}, base, {
        type: 'analysis_answer',
        targetModule: 'analysis',
        message: context.summary,
        sourceOfTruth: context.sourceOfTruth,
        usedStructuredUserData: !!context.usedStructuredUserData,
        usedTransforms: !!context.usedTransforms,
        validationStatus: context.validationStatus,
        blockedReason: context.blockedReason,
        payload: context.metrics || {},
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
        var scienceBuilder = decision.ctaAction === 'open_training'
          ? window.buildScientificConstraintsForWorkout
          : window.buildScientificConstraintsForDiet;
        if (typeof scienceBuilder === 'function') {
          var science = await scienceBuilder(input || {});
          decision.evidenceCount = Number(science?.evidenceCount || 0);
          var hasEvidence = decision.evidenceCount > 0;
          decision.usedScientificEvidence = !!science?.usedScientificEvidence && hasEvidence;
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
            decision.message = 'Não consegui validar esta solicitação com segurança. Ajuste os dados e tente novamente.';
            decision.validationStatus = science?.validationStatus || 'blocked_unsafe_request';
            decision.blockedReason = science?.blockedReason || 'unsafe_request';
          } else if (!hasEvidence) {
            decision.message = 'Posso seguir com protocolo técnico conservador enquanto a base científica específica é atualizada.';
            decision.validationStatus = science?.validationStatus || 'fallback_safe_protocol';
            decision.blockedReason = null;
            decision.usedFallback = true;
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
        label: decision.ctaAction === 'open_training' ? 'Abrir treino' : 'Abrir dieta',
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
