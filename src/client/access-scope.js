(function (global) {
  'use strict';

  function nowIso() {
    try { return new Date().toISOString(); } catch (_) { return ''; }
  }

  function logAuth(event, payload) {
    var body = Object.assign({ ts: nowIso(), event: event }, payload || {});
    global.KroniaObservability = global.KroniaObservability || {};
    if (typeof global.KroniaObservability.logAuthDecision === 'function') {
      global.KroniaObservability.logAuthDecision(event, body);
      return;
    }
    console.info('[kronia.authz]', body);
  }

  function getAccessProfile() {
    return global.KroniaAccessProfile || {
      email: '',
      isAuthenticated: false,
      isAdmin: false,
      source: 'unknown'
    };
  }

  function getPlanContext() {
    return global._userPlan || {};
  }

  function buildUserCapabilities(input) {
    var accessProfile = (input && input.accessProfile) || getAccessProfile();
    var planContext = (input && input.planContext) || getPlanContext();

    var caps = {
      isAdmin: !!accessProfile.isAdmin,
      adminSource: accessProfile.source || 'unknown',
      canReadAllEntities: !!accessProfile.isAdmin,
      canManagePlans: !!accessProfile.isAdmin,
      canManageNotifications: !!accessProfile.isAdmin,
      canInspectGating: !!accessProfile.isAdmin,
      canPreviewUsers: !!accessProfile.isAdmin,
      canUseAdminDebug: !!accessProfile.isAdmin,
      shouldApplyOwnershipScope: !accessProfile.isAdmin,
      planInspectionMode: !!accessProfile.isAdmin,
      plan: planContext.plan || 'free',
      effectiveAccess: planContext.effectiveAccess || 'standard',
      canBypassQuota: !!accessProfile.canBypassQuota
    };

    global.currentUserCapabilities = caps;
    return caps;
  }

  function normalizeContext(context) {
    return Object.assign({
      ownershipColumn: 'user_id',
      purpose: 'default',
      targetUserId: null,
      allowAdminGlobalRead: true,
      reason: null,
      entity: null
    }, context || {});
  }

  function getAdminDebugState() {
    var state = global.KroniaAdmin && global.KroniaAdmin.state ? global.KroniaAdmin.state : {};
    return Object.assign({
      enabled: false,
      previewUser: null,
      visualBypassFlags: {
        showAllPlanCards: false,
        showAllNotifications: false,
        showGatingReasons: true
      },
      diagnostics: {
        verbose: false,
        lastScopeResolution: null
      }
    }, state || {});
  }

  function setupAdminDebug() {
    var access = getAccessProfile();
    var localHost = /(^localhost$)|(^127\.0\.0\.1$)|(^0\.0\.0\.0$)/.test(String(location.hostname || ''));
    var enabledByQuery = /(?:\?|&)admin_debug=1(?:&|$)/.test(String(location.search || ''));
    var secureContext = !!(global.isSecureContext || location.protocol === 'https:' || localHost);
    var enabled = !!access.isAdmin && secureContext && (localHost || enabledByQuery);

    global.KroniaAdmin = global.KroniaAdmin || {};
    global.KroniaAdmin.state = Object.assign(getAdminDebugState(), { enabled: enabled, secureContext: secureContext });
    global.KroniaAdmin.capabilities = buildUserCapabilities({ accessProfile: access });
    global.KroniaAdmin.diagnostics = global.KroniaAdmin.state.diagnostics;

    global.KroniaAdmin.setPreviewUser = function setPreviewUser(userId) {
      if (!global.KroniaAdmin.state.enabled) return false;
      global.KroniaAdmin.state.previewUser = userId ? String(userId) : null;
      logAuth('admin_debug_preview_set', {
        is_admin: !!access.isAdmin,
        debug_enabled: global.KroniaAdmin.state.enabled,
        preview_user_id: global.KroniaAdmin.state.previewUser,
        reason: 'manual_preview_selection'
      });
      return true;
    };

    global.KroniaAdmin.clearPreviewUser = function clearPreviewUser() {
      if (!global.KroniaAdmin.state.enabled) return false;
      global.KroniaAdmin.state.previewUser = null;
      return true;
    };

    global.KroniaAdmin.getStateSnapshot = function getStateSnapshot() {
      return {
        state: Object.assign({}, global.KroniaAdmin.state),
        capabilities: Object.assign({}, global.KroniaAdmin.capabilities),
        diagnostics: Object.assign({}, global.KroniaAdmin.state.diagnostics)
      };
    };

    return global.KroniaAdmin;
  }

  function resolveAccessScope(user, context) {
    var access = getAccessProfile();
    var caps = buildUserCapabilities({ accessProfile: access });
    var ctx = normalizeContext(context);
    var currentUserId = user && user.id ? String(user.id) : null;
    var adminDebugState = getAdminDebugState();
    var previewUser = adminDebugState.previewUser ? String(adminDebugState.previewUser) : null;

    var resolvedMode = 'own';
    var targetUserId = currentUserId;

    if (caps.isAdmin && ctx.targetUserId) {
      resolvedMode = 'preview_user';
      targetUserId = String(ctx.targetUserId);
    } else if (caps.isAdmin && previewUser) {
      resolvedMode = 'preview_user';
      targetUserId = previewUser;
    } else if (caps.isAdmin && ctx.allowAdminGlobalRead) {
      resolvedMode = 'global';
      targetUserId = null;
    }

    var scope = {
      mode: resolvedMode,
      isAdmin: caps.isAdmin,
      sourceOfAdminResolution: access.source || 'unknown',
      userId: currentUserId,
      targetUserId: targetUserId,
      ownershipColumn: ctx.ownershipColumn,
      ownershipFilterApplied: resolvedMode !== 'global',
      entity: ctx.entity || 'generic_entity',
      reason: ctx.reason || ctx.purpose,
      planGateResult: caps.plan,
      adminModeEnabled: !!adminDebugState.enabled,
      debugPreviewUserId: previewUser
    };

    if (global.KroniaAdmin && global.KroniaAdmin.state) {
      global.KroniaAdmin.state.diagnostics.lastScopeResolution = scope;
    }

    logAuth('resolve_scope', {
      user_id: currentUserId,
      target_entity: scope.entity,
      is_admin: scope.isAdmin,
      resolved_scope: scope.mode,
      ownership_filter_applied: scope.ownershipFilterApplied,
      source_of_admin_resolution: scope.sourceOfAdminResolution,
      plan_gate_result: scope.planGateResult,
      admin_mode_enabled: scope.adminModeEnabled,
      debug_preview_user_id: scope.debugPreviewUserId,
      reason: scope.reason
    });

    return scope;
  }

  function applyScopedQuery(query, scope) {
    if (!query || !scope) return query;
    if (!scope.ownershipFilterApplied) return query;
    if (!scope.ownershipColumn || !scope.targetUserId) return query;
    return query.eq(scope.ownershipColumn, scope.targetUserId);
  }

  function ensureAdminAwareQuery(query, user, context) {
    var scope = resolveAccessScope(user, context || {});
    return applyScopedQuery(query, scope);
  }

  async function hydrateAccessContext(session) {
    var user = session && session.user ? session.user : null;
    if (!user) return null;

    var hydrated = {
      profileLoaded: false,
      planLoaded: false
    };

    try {
      if (typeof global._sb !== 'undefined') {
        var profileResp = await global._sb
          .from('profiles')
          .select('id,is_admin,updated_at')
          .eq('id', user.id)
          .maybeSingle();

        if (profileResp && profileResp.data && typeof profileResp.data.is_admin === 'boolean') {
          global.KroniaAccessProfile = Object.assign({}, getAccessProfile(), {
            isAdmin: !!profileResp.data.is_admin,
            canSeeAdminUI: !!profileResp.data.is_admin,
            canBypassQuota: !!profileResp.data.is_admin,
            source: 'profiles_table'
          });
          hydrated.profileLoaded = true;
        }
      }
    } catch (_) {}

    buildUserCapabilities({ accessProfile: getAccessProfile(), planContext: getPlanContext() });
    setupAdminDebug();
    logAuth('access_hydration', {
      user_id: user.id,
      is_admin: !!getAccessProfile().isAdmin,
      source_of_admin_resolution: getAccessProfile().source,
      profile_loaded: hydrated.profileLoaded,
      plan_loaded: hydrated.planLoaded,
      reason: 'session_bootstrap'
    });

    return hydrated;
  }

  global.KroniaAccessScope = {
    getAccessProfile: getAccessProfile,
    buildUserCapabilities: buildUserCapabilities,
    resolveAccessScope: resolveAccessScope,
    applyScopedQuery: applyScopedQuery,
    ensureAdminAwareQuery: ensureAdminAwareQuery,
    setupAdminDebug: setupAdminDebug,
    getAdminDebugState: getAdminDebugState,
    hydrateAccessContext: hydrateAccessContext
  };

  global.KroniaObservability = global.KroniaObservability || {
    logAuthDecision: function (event, payload) {
      console.info('[kronia.authz]', { ts: nowIso(), event: event, payload: payload || null });
    }
  };
})(window);
