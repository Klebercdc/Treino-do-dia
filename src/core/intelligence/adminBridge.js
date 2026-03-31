(function () {
  'use strict';
  window.__KI = window.__KI || {};

  async function token() {
    try {
      var result = await window._sb?.auth?.getSession?.();
      return result?.data?.session?.access_token || null;
    } catch (_) { return null; }
  }

  function canExposeAdmin() {
    try {
      if (typeof window.canShowAdminFeatures === 'function') return !!window.canShowAdminFeatures();
      return false;
    } catch (_) { return false; }
  }

  async function getOverview(filters) {
    var t = await token();
    if (!t) return { success: false, error: { code: 'UNAUTHORIZED' } };
    var q = new URLSearchParams(filters || {});
    var resp = await fetch('/api/kronia/intelligence/admin/overview?' + q.toString(), { headers: { authorization: 'Bearer ' + t } });
    return resp.json().catch(function () { return { success: false, error: { code: 'INVALID_RESPONSE' } }; });
  }

  async function getRecent(filters) {
    var t = await token();
    if (!t) return { success: false, error: { code: 'UNAUTHORIZED' } };
    var q = new URLSearchParams(filters || {});
    var resp = await fetch('/api/kronia/intelligence/admin/recent?' + q.toString(), { headers: { authorization: 'Bearer ' + t } });
    return resp.json().catch(function () { return { success: false, error: { code: 'INVALID_RESPONSE' } }; });
  }

  function exposeAdminBridge(publicApi) {
    if (!canExposeAdmin()) return;
    window.KroniaIntelligenceAdmin = {
      getOverview: getOverview,
      getRecent: getRecent,
      getRecommendations: function () { return publicApi.getRecommendations(); },
      getPendingTasks: function () { return publicApi.getPendingTasks(); },
      getLocalState: function () { return publicApi.getLocalState(); },
    };
  }

  window.__KI.AdminBridge = { exposeAdminBridge: exposeAdminBridge, getOverview: getOverview, getRecent: getRecent };
})();
