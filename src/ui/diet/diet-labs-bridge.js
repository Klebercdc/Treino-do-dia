/* KroniA Diet Labs Bridge
 *
 * Liga a área "Exames" da tela de Dieta ao pipeline real de biomarcadores.
 * - Intercepta somente CTAs de exames dentro do contexto de Dieta.
 * - Abre o modal real de Labs/Biomarcadores, sem usar a sessão visual paralela.
 * - Carrega o último exame real e salva um snapshot local para a Dieta renderizar.
 */
(function () {
  'use strict';

  if (window.__KRONIA_DIET_LABS_BRIDGE__) return;
  window.__KRONIA_DIET_LABS_BRIDGE__ = true;

  var VERSION = '20260614-diet-real-labs-v2-manual-only';
  var SNAPSHOT_KEY = 'kronia_latest_lab_context';
  var REPORTS_URL = '/api/kronia/labs/reports?limit=1';
  var lastOpenAt = 0;

  function log() {
    try { console.info.apply(console, ['[DietLabsBridge]'].concat(Array.prototype.slice.call(arguments))); } catch (_) {}
  }

  function textOf(el) {
    try { return String((el && (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || el.id || el.className)) || '').toLowerCase(); }
    catch (_) { return ''; }
  }

  function inDietContext(target) {
    if (!target || !target.closest) return false;
    if (target.closest('#labsCtaModal')) return false;
    if (target.closest('#kroniaDietPlanVisualScreen')) return true;
    if (target.closest('#dietDataScreen,#dietGeneratedScreen,#dietResultScreen,#dietChoiceScreen,#nutritionFlowScreen')) return true;
    return false;
  }

  function findDietLabsCta(target) {
    if (!target || !target.closest || !inDietContext(target)) return null;

    var explicit = target.closest(
      '[data-diet-labs-open], [data-action="diet-open-labs"], [data-diet-action="open-labs"], [data-module="diet-labs"]'
    );
    if (explicit) return explicit;

    // Segurança: não interceptar cards, refeições, notas ou DIVs genéricos da Dieta.
    // O modal de biomarcadores só deve abrir por CTA acionável e intencional.
    var interactive = target.closest('button, a, [role="button"], [onclick]');
    if (!interactive) return null;

    var text = textOf(interactive);
    var mentionsLabs = /\b(exame|exames|biomarcador|biomarcadores)\b/.test(text);
    var hasManualIntent = /(enviar|mandar|adicionar|abrir|carregar|subir|importar|anexar)\s+(o\s+|os\s+|um\s+|uma\s+|meu\s+|meus\s+)?(exame|exames|biomarcador|biomarcadores)/.test(text) ||
      /\b(exame|exames|biomarcador|biomarcadores)\b.{0,48}\b(enviar|mandar|adicionar|abrir|carregar|subir|importar|anexar)\b/.test(text) ||
      /fluxo\s+real\s+de\s+exames/.test(text);

    if (mentionsLabs && hasManualIntent) return interactive;
    return null;
  }

  async function buildHeaders() {
    var headers = { Accept: 'application/json' };
    if (typeof window.getAuthHeaders === 'function') {
      try { headers = Object.assign(headers, await window.getAuthHeaders()); } catch (_) {}
    } else if (window._sb && window._sb.auth && typeof window._sb.auth.getSession === 'function') {
      try {
        var sessionResult = await window._sb.auth.getSession();
        var token = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
        if (token) headers.Authorization = 'Bearer ' + token;
      } catch (_) {}
    }
    return headers;
  }

  function normalizeBiomarker(item) {
    item = item || {};
    var name = item.marker_name || item.biomarker_name || item.name || item.nome || item.marker || item.marker_key || 'Marcador';
    var value = item.released_value;
    if (value == null || value === '') value = item.reviewed_value_override;
    if (value == null || value === '') value = item.value_numeric;
    if (value == null || value === '') value = item.value;
    if (value == null || value === '') value = item.value_text;
    var unit = item.unit || item.unidade || '';
    var flag = item.released_flag || item.flag || item.lab_flag || item.context_flag || '';
    return { name: String(name), value: value, unit: String(unit || ''), flag: String(flag || '') };
  }

  function normalizeReport(report) {
    report = report || {};
    var normalizedPayload = report.normalizedPayload || report.normalized_payload || null;
    var aiInsights = report.aiInsights || report.ai_insights || null;
    var candidates = [];

    if (Array.isArray(report.biomarkers)) candidates = candidates.concat(report.biomarkers);
    if (normalizedPayload && Array.isArray(normalizedPayload.biomarkers)) candidates = candidates.concat(normalizedPayload.biomarkers);
    if (aiInsights && Array.isArray(aiInsights.marker_interpretations)) candidates = candidates.concat(aiInsights.marker_interpretations);

    var seen = Object.create(null);
    var biomarkers = candidates.map(normalizeBiomarker).filter(function (b) {
      var key = (b.name + '|' + b.value + '|' + b.unit).toLowerCase();
      if (!b.name || seen[key]) return false;
      seen[key] = true;
      return true;
    });

    return {
      id: report.id || null,
      source: 'kronia_labs_reports',
      createdAt: report.createdAt || report.created_at || null,
      processedAt: report.processedAt || report.processed_at || null,
      status: report.canonicalStatus || report.status || report.parseStatus || report.parse_status || null,
      biomarkers: biomarkers,
      scores: aiInsights && aiInsights.scores ? aiInsights.scores : null,
      healthProfile: aiInsights && aiInsights.health_profile ? aiInsights.health_profile : null,
      clinicalFlags: Array.isArray(report.clinicalFlags) ? report.clinicalFlags : (aiInsights && Array.isArray(aiInsights.clinical_flags) ? aiInsights.clinical_flags : []),
      criticalFlags: Array.isArray(report.criticalFlags) ? report.criticalFlags : (aiInsights && Array.isArray(aiInsights.critical_flags) ? aiInsights.critical_flags : []),
      confidence: Number(report.confidence || 0),
      aiInsights: aiInsights || null
    };
  }

  function saveSnapshot(context) {
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(context || null)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('kronia:diet:labs-context', { detail: { labContext: context || null } })); } catch (_) {}
  }

  async function loadLatestLabContext() {
    try {
      var resp = await fetch(REPORTS_URL, { credentials: 'include', headers: await buildHeaders() });
      var payload = await resp.json().catch(function () { return {}; });
      if (!resp.ok || payload.ok === false) throw new Error(payload.error || payload.message || 'labs_reports_failed');
      var reports = Array.isArray(payload.reports) ? payload.reports : Array.isArray(payload.data) ? payload.data : [];
      var context = reports.length ? normalizeReport(reports[0]) : null;
      saveSnapshot(context);
      log('latest real lab context loaded', context && context.biomarkers ? context.biomarkers.length : 0);
      return context;
    } catch (err) {
      log('latest lab context unavailable', err && err.message ? err.message : err);
      return null;
    }
  }

  function openRealLabsFromDiet(source) {
    var now = Date.now();
    if (now - lastOpenAt < 700) return null;
    lastOpenAt = now;

    if (typeof window.openLabsUploadScreen !== 'function') {
      try { alert('Módulo real de exames indisponível. Recarregue o app.'); } catch (_) {}
      return null;
    }

    var originalNavTo = window.navTo;
    var legacyOpenLabsScreen = window.openLabsScreen;
    try {
      // Evita que o modal real force navegação para Início quando vier da Dieta.
      if (typeof originalNavTo === 'function') {
        window.navTo = function (route) {
          if (String(route) === 'inicio') return null;
          return originalNavTo.apply(window, arguments);
        };
      }
      // Evita passar pelo alias legado/openLabsScreen; usa o bridge real atual.
      window.openLabsScreen = null;
      return window.openLabsUploadScreen(source || 'diet-exames-real-labs');
    } finally {
      window.navTo = originalNavTo;
      window.openLabsScreen = legacyOpenLabsScreen;
      setTimeout(loadLatestLabContext, 900);
    }
  }

  function handleDietLabsClick(ev) {
    var cta = findDietLabsCta(ev && ev.target);
    if (!cta) return;
    try {
      if (ev.preventDefault) ev.preventDefault();
      if (ev.stopPropagation) ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    } catch (_) {}
    openRealLabsFromDiet('diet-exames-cta-real-labs');
  }

  document.addEventListener('click', handleDietLabsClick, true);
  window.addEventListener('kronia:labs:loaded', function (ev) {
    var reports = ev && ev.detail && Array.isArray(ev.detail.reports) ? ev.detail.reports : [];
    saveSnapshot(reports.length ? normalizeReport(reports[0]) : null);
  });

  window.KroniaDietLabs = Object.assign({}, window.KroniaDietLabs || {}, {
    version: VERSION,
    openRealLabs: openRealLabsFromDiet,
    loadLatestContext: loadLatestLabContext,
    normalizeReport: normalizeReport
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLatestLabContext, { once: true });
  } else {
    setTimeout(loadLatestLabContext, 0);
  }
})();