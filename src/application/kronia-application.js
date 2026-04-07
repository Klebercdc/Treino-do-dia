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

    // Análise e suplemento são verificados primeiro para não serem engolidos
    // por perguntas que mencionam treino/dieta em contexto diferente.
    var analysis = hasAny(text, [
      /\b(evolucao|progresso|funcionando|resultado|melhorei|plato|aderencia|consistencia|desempenho|carga|frequencia)\b/
    ]);

    var supplement = hasAny(text, [/\b(creatina|whey|cafeina|pre treino|beta alanina|suplement)\b/]);

    // Qualquer menção a treino ou dieta abre o CTA — sem exigir verbo de ação.
    // Perguntas de análise ficam de fora (analysis=true) para não conflitar.
    var workout = !analysis &&
      hasAny(text, [/\b(treino|ficha|programa|periodizacao|exercicio|musculacao|rotina)\b/]);

    var diet = !analysis &&
      hasAny(text, [/\b(dieta|alimentacao|plano alimentar|plano nutricional|nutricao|refeicao|cardapio|macros|calorias)\b/]);

    var labUpload = hasAny(text, [
      /\b(exame|laboratorio|laboratorial|laudo|resultado|bioquimica|hemograma|coleta)\b/,
      /\b(fazer exame|enviar exame|anexar exame)\b/,
    ]);

    if (workout) return 'workout_creation_request';
    if (diet) return 'diet_creation_request';
    if (labUpload) return 'lab_upload_request';
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

  function buildApplicationResult(overrides) {
    return Object.assign({
      status: 'success',
      data: null,
      errors: [],
      nextAction: null,
    }, overrides || {});
  }

  var APPLICATION_STATES = {
    visitor: 'visitor',
    authenticated: 'authenticated',
    onboarding_pending: 'onboarding_pending',
    onboarding_in_progress: 'onboarding_in_progress',
    onboarding_completed: 'onboarding_completed',
    plan_not_created: 'plan_not_created',
    plan_generating: 'plan_generating',
    plan_generated: 'plan_generated',
    plan_active: 'plan_active',
    plan_expired: 'plan_expired',
    blocked: 'blocked',
  };

  function resolveInitialRoute() {
    return buildApplicationResult({
      data: { route: 'chat', state: APPLICATION_STATES.visitor },
      nextAction: 'validate_access',
    });
  }

  function resolvePostLoginRoute() {
    return buildApplicationResult({
      data: { route: 'onboarding', state: APPLICATION_STATES.authenticated, fallbackState: APPLICATION_STATES.onboarding_pending },
      nextAction: 'complete_onboarding',
    });
  }

  function completeOnboarding(profile) {
    return buildApplicationResult({
      data: { profile: profile || null, state: APPLICATION_STATES.onboarding_completed },
      nextAction: 'load_dashboard',
    });
  }

  function saveUserProfile(profile) {
    return buildApplicationResult({
      data: { profile: profile || null, state: APPLICATION_STATES.onboarding_in_progress },
      nextAction: 'complete_onboarding',
    });
  }

  function generateWorkoutPlan(input) {
    return buildApplicationResult({
      data: { request: input || {}, state: APPLICATION_STATES.plan_generating, module: 'workout' },
      nextAction: 'approve_plan',
    });
  }

  function generateDietPlan(input) {
    return buildApplicationResult({
      data: { request: input || {}, state: APPLICATION_STATES.plan_generating, module: 'diet' },
      nextAction: 'approve_plan',
    });
  }

  function generateSupplementProtocol(input) {
    return buildApplicationResult({
      data: { request: input || {}, state: APPLICATION_STATES.plan_not_created, module: 'supplement', terminalState: APPLICATION_STATES.plan_expired },
      nextAction: 'process_chat_message',
    });
  }

  function classifyChatIntent(input) {
    return buildApplicationResult({
      data: { intent: classifyConversationIntent(input) },
      nextAction: 'resolve_next_action',
    });
  }

  async function processChatMessage(input) {
    var flow = await resolveConversationFlow(input || {});
    return buildApplicationResult({
      data: flow,
      nextAction: resolveNextAction(flow),
    });
  }

  function loadUserDashboard() {
    return buildApplicationResult({
      data: { route: 'dashboard', state: APPLICATION_STATES.plan_active },
      nextAction: 'update_plan',
    });
  }

  function updatePlan(input) {
    return buildApplicationResult({
      data: { request: input || {}, state: APPLICATION_STATES.plan_generated },
      nextAction: 'approve_plan',
    });
  }

  function approvePlan(input) {
    return buildApplicationResult({
      data: { plan: input || null, state: APPLICATION_STATES.plan_active },
      nextAction: 'load_dashboard',
    });
  }

  function validateAccess(context) {
    var state = context?.blocked ? APPLICATION_STATES.blocked : APPLICATION_STATES.authenticated;
    return buildApplicationResult({
      data: { granted: !context?.blocked, state: state },
      nextAction: context?.blocked ? 'handle_business_error' : 'resolve_post_login_route',
    });
  }

  function resolveNextAction(result) {
    if (result?.blockedReason) return 'handle_business_error';
    if (result?.ctaAction === 'open_training') return 'generate_workout_plan';
    if (result?.ctaAction === 'generate_diet') return 'generate_diet_plan';
    return 'process_chat_message';
  }

  function handleBusinessError(error) {
    return buildApplicationResult({
      status: 'error',
      data: null,
      errors: [{
        code: error?.code || 'BUSINESS_ERROR',
        message: error?.message || 'Nao foi possivel concluir a operacao.',
      }],
      nextAction: 'resolve_initial_route',
    });
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
      ctaAction: 'generate_diet',
      message: 'Perfeito. Posso gerar sua dieta quando voce clicar no botao abaixo.',
    });
  }

  if (intent === 'lab_upload_request') {
    return Object.assign({}, base, {
      type: 'answer_with_cta',
      targetModule: 'labs',
      ctaAction: 'open_labs_upload',
      message: 'Perfeito. Clique abaixo para abrir o módulo de upload de exames e enviar seu laudo.',
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

    if (decision.type === 'answer_with_cta' && decision.ctaAction !== 'open_labs_upload') {
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

          var unsafeRequest = !science?.ok && (science?.blockedReason === 'unsafe_request' || science?.validationStatus === 'blocked');
          if (unsafeRequest) {
            decision.type = 'answer_only';
            decision.ctaAction = null;
            decision.message = 'Não consegui validar esta solicitação com segurança. Ajuste os dados e tente novamente.';
            decision.validationStatus = science?.validationStatus || 'blocked_unsafe_request';
            decision.blockedReason = science?.blockedReason || 'unsafe_request';
          } else if (!hasEvidence) {
            decision.message = 'Vou seguir com a melhor lógica esportiva disponível no seu perfil e no contexto atual. Se houver artigos específicos recuperados, eu uso como reforço.';
            decision.validationStatus = science?.validationStatus || 'fallback_safe_protocol';
            decision.blockedReason = null;
            decision.usedFallback = true;
          }
        }
      } catch (_err) {
        decision.usedFallback = true;
        decision.validationStatus = 'science_builder_error';
        decision.blockedReason = null;
      }
    }

    var result = {
      type: decision.type,
      intent: decision.intent,
      message: decision.message,
      cta: decision.ctaAction ? {
        label: decision.ctaAction === 'open_training' ? 'Abrir treino' : (decision.ctaAction === 'generate_diet' ? 'Gerar dieta' : 'Abrir dieta'),
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
    resolveInitialRoute: resolveInitialRoute,
    resolvePostLoginRoute: resolvePostLoginRoute,
    completeOnboarding: completeOnboarding,
    saveUserProfile: saveUserProfile,
    generateWorkoutPlan: generateWorkoutPlan,
    generateDietPlan: generateDietPlan,
    generateSupplementProtocol: generateSupplementProtocol,
    classifyChatIntent: classifyChatIntent,
    processChatMessage: processChatMessage,
    loadUserDashboard: loadUserDashboard,
    updatePlan: updatePlan,
    approvePlan: approvePlan,
    validateAccess: validateAccess,
    resolveNextAction: resolveNextAction,
    handleBusinessError: handleBusinessError,
    resolveConversationFlow: resolveConversationFlow,
  };
})();
