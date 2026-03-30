(function(global){
  'use strict';
  function safeNowIso(){ try{return new Date().toISOString();}catch(_){return '';} }
  function getAccessProfile(){ return global.KroniaAccessProfile || { isAdmin:false, isAuthenticated:false }; }
  function normalizeContext(context){ return Object.assign({ ownershipColumn:'user_id', purpose:'default', targetUserId:null, allowAdminGlobalRead:true }, context||{}); }
  function resolveAccessScope(user, context){
    var access=getAccessProfile(); var ctx=normalizeContext(context); var userId=user&&user.id?String(user.id):'';
    var targetUserId=ctx.targetUserId?String(ctx.targetUserId):'';
    var simulatedUserId=(global.KroniaAdmin&&global.KroniaAdmin.state&&global.KroniaAdmin.state.simulatedUserId)?String(global.KroniaAdmin.state.simulatedUserId):'';
    var isAdmin=!!access.isAdmin; var mode='own'; var effectiveUserId=userId;
    if (isAdmin && targetUserId){ mode='user_preview'; effectiveUserId=targetUserId; }
    else if (isAdmin && simulatedUserId){ mode='user_preview'; effectiveUserId=simulatedUserId; }
    else if (isAdmin && ctx.allowAdminGlobalRead){ mode='global'; effectiveUserId=null; }
    var scope={ mode:mode, isAdmin:isAdmin, ownershipColumn:ctx.ownershipColumn, userId:userId||null, targetUserId:effectiveUserId||null, purpose:ctx.purpose, ownershipFilterApplied:mode!=='global' };
    if (global.KroniaObservability && typeof global.KroniaObservability.logAuthDecision==='function') global.KroniaObservability.logAuthDecision('resolve_scope', scope);
    else console.info('[kronia.auth.scope]', Object.assign({ts:safeNowIso()}, scope));
    return scope;
  }
  function applyScopedQuery(query, scope){ if(!query||!scope) return query; if(!scope.ownershipFilterApplied) return query; if(!scope.ownershipColumn||!scope.targetUserId) return query; return query.eq(scope.ownershipColumn, scope.targetUserId); }
  function buildCapabilities(accessProfile){ var p=accessProfile||getAccessProfile(); return { isAdmin:!!p.isAdmin, canReadGlobalData:!!p.isAdmin, canManageNotifications:!!p.isAdmin, canManagePlans:!!p.isAdmin, canSimulateUser:!!p.isAdmin, canViewDiagnostics:!!(p.canSeeAdminUI||p.isAdmin) }; }
  function getAdminDebugState(){ var st=(global.KroniaAdmin&&global.KroniaAdmin.state)||{}; return Object.assign({enabled:false,expandedView:false,simulatedUserId:null,ignoreVisualPlanGates:false,diagnosticsVerbose:false}, st); }
  function setupAdminDebug(){
    var access=getAccessProfile();
    var isLocal=/(^localhost$)|(^127\.0\.0\.1$)|(^0\.0\.0\.0$)/.test(String(location.hostname||''));
    var enabledByQuery=/(?:\?|&)admin_debug=1(?:&|$)/.test(String(location.search||''));
    var allowed=!!access.isAdmin && (isLocal||enabledByQuery);
    global.KroniaAdmin=global.KroniaAdmin||{};
    global.KroniaAdmin.state=Object.assign(getAdminDebugState(), { enabled:allowed });
    global.KroniaAdmin.setSimulationUser=function(userId){ if(!global.KroniaAdmin.state.enabled) return false; global.KroniaAdmin.state.simulatedUserId=userId?String(userId):null; return true; };
    global.KroniaAdmin.clearSimulation=function(){ if(!global.KroniaAdmin.state.enabled) return false; global.KroniaAdmin.state.simulatedUserId=null; return true; };
    return global.KroniaAdmin;
  }
  global.KroniaAccessScope={ getAccessProfile:getAccessProfile, resolveAccessScope:resolveAccessScope, applyScopedQuery:applyScopedQuery, buildCapabilities:buildCapabilities, setupAdminDebug:setupAdminDebug, getAdminDebugState:getAdminDebugState };
  global.KroniaObservability=global.KroniaObservability||{ logAuthDecision:function(event,payload){ console.info('[kronia.authz]',{ts:safeNowIso(),event:event,payload:payload||null}); } };
})(window);
