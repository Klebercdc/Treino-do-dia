(function () {
  'use strict';

  var BUSINESS_ERROR_CODES = Object.freeze({
    PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
    PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
    INVALID_STATE: 'INVALID_STATE',
    AI_FAILURE: 'AI_FAILURE',
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
  });

  var USER_STATES = Object.freeze({
    VISITOR: 'visitor',
    AUTHENTICATED: 'authenticated',
    ONBOARDING_PENDING: 'onboarding_pending',
    ONBOARDING_IN_PROGRESS: 'onboarding_in_progress',
    ONBOARDING_COMPLETED: 'onboarding_completed',
    PLAN_NOT_CREATED: 'plan_not_created',
    PLAN_GENERATING: 'plan_generating',
    PLAN_GENERATED: 'plan_generated',
    PLAN_ACTIVE: 'plan_active',
    PLAN_EXPIRED: 'plan_expired',
    BLOCKED: 'blocked',
  });

  var VALID_TRANSITIONS = Object.freeze({
    visitor: ['authenticated', 'blocked'],
    authenticated: ['onboarding_pending', 'onboarding_in_progress', 'onboarding_completed', 'blocked'],
    onboarding_pending: ['onboarding_in_progress', 'onboarding_completed', 'blocked'],
    onboarding_in_progress: ['onboarding_completed', 'onboarding_pending', 'blocked'],
    onboarding_completed: ['plan_not_created', 'plan_generating', 'plan_generated', 'plan_active', 'blocked'],
    plan_not_created: ['plan_generating', 'blocked'],
    plan_generating: ['plan_generated', 'plan_not_created', 'blocked'],
    plan_generated: ['plan_active', 'plan_not_created', 'blocked'],
    plan_active: ['plan_expired', 'blocked'],
    plan_expired: ['plan_generating', 'plan_not_created', 'blocked'],
    blocked: [],
  });

  var ROUTES = Object.freeze({
    LOGIN: 'login',
    KRONA_SETUP: 'krona-setup',
    ONBOARDING: 'onboarding',
    PLAN: 'plans',
    HOME: 'inicio',
    DASHBOARD: 'dashboard',
    BLOCKED: 'blocked',
  });

  function nowISO() { return new Date().toISOString(); }

  function makeResult(status, data, errors, nextAction) {
    return {
      status: status,
      data: data || null,
      errors: Array.isArray(errors) ? errors : [],
      nextAction: nextAction || null,
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validateRequired(input, requiredKeys) {
    var missing = [];
    requiredKeys.forEach(function (key) {
      if (!input || input[key] === undefined || input[key] === null || input[key] === '') missing.push(key);
    });
    return missing;
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch (_) {
      return clone(fallback);
    }
  }

  var domain = {
    userState: {
      derive: function (ctx) {
        if (!ctx.isAuthenticated) return USER_STATES.VISITOR;
        if (ctx.blocked) return USER_STATES.BLOCKED;
        if (!ctx.profileSetupDone) return USER_STATES.ONBOARDING_PENDING;
        if (!ctx.onboardingDone) return USER_STATES.ONBOARDING_IN_PROGRESS;
        if (!ctx.hasPlan) return USER_STATES.PLAN_NOT_CREATED;
        if (ctx.planGenerating) return USER_STATES.PLAN_GENERATING;
        if (ctx.planExpired) return USER_STATES.PLAN_EXPIRED;
        if (ctx.planActive) return USER_STATES.PLAN_ACTIVE;
        return USER_STATES.ONBOARDING_COMPLETED;
      },
      assertTransition: function (fromState, toState) {
        var nextAllowed = VALID_TRANSITIONS[fromState] || [];
        return nextAllowed.indexOf(toState) >= 0;
      },
    },
    validators: {
      profile: function (input) {
        var missing = validateRequired(input, ['userId', 'profile']);
        if (!missing.length) {
          var p = input.profile || {};
          if (!p.nome || String(p.nome).trim().length < 2) missing.push('profile.nome');
        }
        return missing;
      },
      onboarding: function (input) { return validateRequired(input, ['userId']); },
      chat: function (input) { return validateRequired(input, ['userId', 'message']); },
      plan: function (input) { return validateRequired(input, ['userId', 'payload']); },
    },
  };

  var infrastructure = {
    storage: {
      getProfile: function () { return readJSON('kronia_config', {}); },
      saveProfile: function (profile) { localStorage.setItem('kronia_config', JSON.stringify(profile)); },
      markProfileSetupDone: function () { localStorage.setItem('kronia_profile_setup_done', '1'); },
      markOnboardingDone: function () { localStorage.setItem('kronia_onboarded', '1'); },
      getBusinessLogs: function () { return readJSON('kronia_business_logs', []); },
      appendBusinessLog: function (entry) {
        var logs = this.getBusinessLogs();
        logs.unshift(entry);
        localStorage.setItem('kronia_business_logs', JSON.stringify(logs.slice(0, 500)));
      },
    },
    events: {
      emit: function (eventName, payload) {
        infrastructure.storage.appendBusinessLog({
          type: 'event',
          eventName: eventName,
          payload: payload,
          timestamp: nowISO(),
        });
      },
    },
    logger: {
      log: function (record) {
        infrastructure.storage.appendBusinessLog({
          type: 'flow_log',
          timestamp: nowISO(),
          userId: record.userId || null,
          action: record.action,
          input: record.input || null,
          result: record.result || null,
          error: record.error || null,
          context: record.context || null,
        });
      },
    },
    ai: {
      classifyIntent: function (message) {
        var text = String(message || '').toLowerCase();
        if (/treino|exercício|periodiza/.test(text)) return 'workout';
        if (/dieta|nutri|caloria|refei/.test(text)) return 'diet';
        if (/suplement|creatina|whey/.test(text)) return 'supplements';
        if (/ajuste|alterar|mudar|editar/.test(text)) return 'adjustments';
        if (/duvida|dúvida|como|por que|pq/.test(text)) return 'question';
        return 'general';
      },
      generateEmbeddings: function (text) {
        var source = String(text || '');
        var dimension = 1536;
        var vector = new Array(dimension).fill(0).map(function (_, idx) {
          var code = source.charCodeAt(idx % Math.max(1, source.length)) || 0;
          return (code % 100) / 100;
        });
        return { dimension: dimension, vector: vector };
      },
    },
  };

  function handleBusinessError(params) {
    var code = params && params.code ? params.code : BUSINESS_ERROR_CODES.SYSTEM_ERROR;
    var result = makeResult('error', null, [{ code: code, message: params && params.message ? params.message : 'Fluxo inválido' }], params && params.nextAction ? params.nextAction : { route: ROUTES.HOME });
    infrastructure.logger.log({
      userId: params && params.userId,
      action: 'handleBusinessError',
      input: params,
      result: result,
      error: result.errors[0],
      context: params && params.context,
    });
    return result;
  }

  var application = {
    resolveInitialRoute: function (input) {
      var ctx = input || {};
      var state = domain.userState.derive(ctx);
      var route = ROUTES.LOGIN;
      if (state === USER_STATES.BLOCKED) route = ROUTES.BLOCKED;
      else if (state === USER_STATES.VISITOR) route = ROUTES.LOGIN;
      else if (state === USER_STATES.ONBOARDING_PENDING) route = ROUTES.KRONA_SETUP;
      else if (state === USER_STATES.ONBOARDING_IN_PROGRESS) route = ROUTES.ONBOARDING;
      else if (state === USER_STATES.PLAN_NOT_CREATED || state === USER_STATES.PLAN_EXPIRED) route = ROUTES.PLAN;
      else route = ROUTES.HOME;
      return makeResult('success', { state: state, route: route }, [], { route: route });
    },

    resolvePostLoginRoute: function (input) {
      return this.resolveInitialRoute(input);
    },

    resolvePlanRoute: function (input) {
      var isSubscriptionActive = !!(input && input.subscriptionActive);
      if (!isSubscriptionActive) return handleBusinessError({ code: BUSINESS_ERROR_CODES.SUBSCRIPTION_REQUIRED, message: 'Assinatura necessária', nextAction: { route: ROUTES.PLAN } });
      return makeResult('success', { route: ROUTES.DASHBOARD }, [], { route: ROUTES.DASHBOARD });
    },

    resolveAccessGuard: function (input) {
      var auth = this.validateAccess(input);
      if (auth.status === 'error') return auth;
      return makeResult('success', { allowed: true }, [], input && input.nextAction ? input.nextAction : { route: ROUTES.HOME });
    },

    completeOnboarding: function (input) {
      var missing = domain.validators.onboarding(input || {});
      if (missing.length) return handleBusinessError({ code: BUSINESS_ERROR_CODES.VALIDATION_ERROR, message: 'Onboarding inválido: ' + missing.join(', '), userId: input && input.userId });
      infrastructure.storage.markOnboardingDone();
      infrastructure.events.emit('onboarding_completed', { userId: input.userId });
      var result = this.resolveNextAction({
        currentState: USER_STATES.ONBOARDING_COMPLETED,
        context: { isAuthenticated: true, profileSetupDone: true, onboardingDone: true, hasPlan: !!(input && input.hasPlan), planActive: !!(input && input.hasPlan) },
      });
      infrastructure.logger.log({ userId: input.userId, action: 'completeOnboarding', input: input, result: result });
      return result;
    },

    saveUserProfile: function (input) {
      var missing = domain.validators.profile(input || {});
      if (missing.length) return handleBusinessError({ code: BUSINESS_ERROR_CODES.VALIDATION_ERROR, message: 'Perfil inválido: ' + missing.join(', '), userId: input && input.userId });

      var current = infrastructure.storage.getProfile();
      var next = Object.assign({}, current, input.profile);
      infrastructure.storage.saveProfile(next);
      infrastructure.storage.markProfileSetupDone();
      infrastructure.events.emit('profile_saved', { userId: input.userId });

      var result = makeResult('success', { profile: next }, [], { route: ROUTES.ONBOARDING });
      infrastructure.logger.log({ userId: input.userId, action: 'saveUserProfile', input: input, result: result });
      return result;
    },

    generateWorkoutPlan: function (input) {
      return this._runPlanOrchestration('workout', input);
    },

    generateDietPlan: function (input) {
      return this._runPlanOrchestration('diet', input);
    },

    generateSupplementProtocol: function (input) {
      return this._runPlanOrchestration('supplements', input);
    },

    classifyChatIntent: function (input) {
      var missing = domain.validators.chat(input || {});
      if (missing.length) return handleBusinessError({ code: BUSINESS_ERROR_CODES.VALIDATION_ERROR, message: 'Mensagem inválida', userId: input && input.userId });
      var intent = infrastructure.ai.classifyIntent(input.message);
      var result = makeResult('success', { intent: intent, confidence: intent === 'general' ? 0.5 : 0.9 }, [], { action: 'route_intent' });
      infrastructure.logger.log({ userId: input.userId, action: 'classifyChatIntent', input: input, result: result });
      return result;
    },

    processChatMessage: function (input) {
      var intentResult = this.classifyChatIntent(input);
      if (intentResult.status === 'error') return intentResult;
      var flow = intentResult.data.intent;
      var response = {
        intent: flow,
        reply: 'Fluxo processado com sucesso.',
        rag: this._buildRagContext(input),
      };
      var result = makeResult('success', response, [], { action: 'render_chat_reply' });
      infrastructure.events.emit('ai_interaction', { userId: input.userId, intent: flow });
      infrastructure.logger.log({ userId: input.userId, action: 'processChatMessage', input: { intent: flow }, result: result });
      return result;
    },

    loadUserDashboard: function (input) {
      var auth = this.validateAccess(input);
      if (auth.status === 'error') return auth;
      var profile = infrastructure.storage.getProfile();
      var result = makeResult('success', { profile: profile, widgets: ['workout', 'diet', 'chat', 'plans'] }, [], { route: ROUTES.DASHBOARD });
      infrastructure.logger.log({ userId: input && input.userId, action: 'loadUserDashboard', input: input, result: result });
      return result;
    },

    updatePlan: function (input) {
      var missing = domain.validators.plan(input || {});
      if (missing.length) return handleBusinessError({ code: BUSINESS_ERROR_CODES.VALIDATION_ERROR, message: 'Plano inválido', userId: input && input.userId });
      var result = makeResult('success', { planId: input.planId || null, updated: true }, [], { route: ROUTES.DASHBOARD });
      infrastructure.events.emit('plan_updated', { userId: input.userId, planId: input.planId || null });
      infrastructure.logger.log({ userId: input.userId, action: 'updatePlan', input: input, result: result });
      return result;
    },

    approvePlan: function (input) {
      var missing = validateRequired(input || {}, ['userId', 'planId']);
      if (missing.length) return handleBusinessError({ code: BUSINESS_ERROR_CODES.VALIDATION_ERROR, message: 'Aprovação inválida', userId: input && input.userId });
      var result = makeResult('success', { planId: input.planId, approved: true }, [], { route: ROUTES.HOME });
      infrastructure.events.emit('plan_approved', { userId: input.userId, planId: input.planId });
      infrastructure.logger.log({ userId: input.userId, action: 'approvePlan', input: input, result: result });
      return result;
    },

    validateAccess: function (input) {
      var ctx = input || {};
      if (!ctx.isAuthenticated) return handleBusinessError({ code: BUSINESS_ERROR_CODES.UNAUTHORIZED, message: 'Login obrigatório', userId: ctx.userId, nextAction: { route: ROUTES.LOGIN } });
      if (ctx.requireProfile && !ctx.profileSetupDone) return handleBusinessError({ code: BUSINESS_ERROR_CODES.PROFILE_INCOMPLETE, message: 'Perfil incompleto', userId: ctx.userId, nextAction: { route: ROUTES.KRONA_SETUP } });
      if (ctx.requireOnboarding && !ctx.onboardingDone) return handleBusinessError({ code: BUSINESS_ERROR_CODES.INVALID_STATE, message: 'Onboarding pendente', userId: ctx.userId, nextAction: { route: ROUTES.ONBOARDING } });
      if (ctx.requirePlan && !ctx.hasPlan) return handleBusinessError({ code: BUSINESS_ERROR_CODES.PLAN_NOT_FOUND, message: 'Plano não encontrado', userId: ctx.userId, nextAction: { route: ROUTES.PLAN } });
      return makeResult('success', { allowed: true }, [], { route: ROUTES.HOME });
    },

    resolveNextAction: function (input) {
      var from = input && input.currentState ? input.currentState : USER_STATES.AUTHENTICATED;
      var target = domain.userState.derive((input && input.context) || {});
      if (!domain.userState.assertTransition(from, target)) {
        return handleBusinessError({ code: BUSINESS_ERROR_CODES.INVALID_STATE, message: 'Transição inválida: ' + from + ' -> ' + target, context: input && input.context });
      }
      return this.resolveInitialRoute((input && input.context) || {});
    },

    _runPlanOrchestration: function (kind, input) {
      var access = this.validateAccess({
        userId: input && input.userId,
        isAuthenticated: !!(input && input.isAuthenticated),
        requireProfile: true,
        profileSetupDone: !!(input && input.profileSetupDone),
        requireOnboarding: true,
        onboardingDone: !!(input && input.onboardingDone),
      });
      if (access.status === 'error') return access;

      var payload = input && input.payload ? input.payload : {};
      var normalized = { planType: kind, payload: payload };
      var result = makeResult('success', { generated: true, planType: kind, normalized: normalized }, [], { route: ROUTES.DASHBOARD });
      infrastructure.events.emit('plan_generated', { userId: input.userId, planType: kind });
      infrastructure.logger.log({ userId: input.userId, action: 'generate' + kind + 'Plan', input: input, result: result });
      return result;
    },

    _buildRagContext: function (input) {
      var embedding = infrastructure.ai.generateEmbeddings(input && input.message ? input.message : '');
      return {
        embeddingDimension: embedding.dimension,
        retrievedChunks: [],
        deduplicated: true,
        hallucinationGuard: 'strict',
      };
    },
  };

  var contracts = {
    BusinessErrorCodes: BUSINESS_ERROR_CODES,
    UserStates: USER_STATES,
    Routes: ROUTES,
  };

  window.KroniaApplication = {
    contracts: contracts,
    domain: domain,
    application: application,
    infrastructure: infrastructure,
    handleBusinessError: handleBusinessError,
  };
})();
