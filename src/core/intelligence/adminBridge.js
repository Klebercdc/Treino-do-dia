(function () {
  'use strict';

  var BRIDGE_NAME = 'KroniaIntelligenceAdmin';
  var PANEL_ID = 'kronia-intelligence-admin-panel';
  var FAB_ID = 'kronia-intelligence-admin-fab';
  var POLL_MS = 1500;

  function safeJsonParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function isAdminUser() {
    var profile = window.KroniaAccessProfile || {};
    return !!(profile.isAdmin || profile.canSeeAdminUI);
  }

  function iconBrain() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 4.5a3.5 3.5 0 0 1 6.3 2 3.3 3.3 0 0 1 2.7 3.2 3.4 3.4 0 0 1-.9 2.3 3.2 3.2 0 0 1 .9 2.2 3.4 3.4 0 0 1-3.4 3.4h-1.6v1.1a2.5 2.5 0 1 1-5 0v-1.1H7a3.4 3.4 0 0 1-3.4-3.4c0-.8.3-1.6.8-2.2a3.5 3.5 0 0 1-.8-2.3A3.4 3.4 0 0 1 6.3 6.5a3.5 3.5 0 0 1 3.2-2Zm-1 6.2h2.2v-2H9.5a1 1 0 1 0 0 2Zm4.8 0h1.2a1 1 0 1 0 0-2h-1.2v2Zm0 4.3h1.8a1 1 0 1 0 0-2h-1.8v2Zm-2.6 0v-2H8.5a1 1 0 1 0 0 2h2.2Z"/></svg>';
  }

  function ensureFab() {
    var node = document.getElementById(FAB_ID);
    if (node) return node;
    node = document.createElement('button');
    node.id = FAB_ID;
    node.type = 'button';
    node.className = 'kronia-intelligence-admin-fab';
    node.innerHTML = iconBrain() + '<span>INTELLIGENCE</span>';
    node.addEventListener('click', function () {
      window[BRIDGE_NAME] && window[BRIDGE_NAME].openPanel();
    });
    document.body.appendChild(node);
    return node;
  }

  function ensurePanel() {
    var panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.className = 'kronia-intelligence-admin-panel';
    panel.innerHTML = [
      '<div class="kronia-intelligence-admin-panel-header">',
      '  <div><h3>KRONIA INTELLIGENCE</h3><p>Painel técnico administrativo</p></div>',
      '  <button type="button" data-action="close">Fechar</button>',
      '</div>',
      '<div class="kronia-intelligence-admin-panel-body" id="kronia-intelligence-admin-content">',
      '  <div class="kronia-intelligence-admin-loading">Carregando inteligência...</div>',
      '</div>'
    ].join('');
    panel.querySelector('[data-action="close"]').addEventListener('click', function () {
      panel.classList.remove('is-open');
    });
    document.body.appendChild(panel);
    return panel;
  }

  async function getToken() {
    try {
      var session = await window._sb?.auth?.getSession?.();
      return session?.data?.session?.access_token || null;
    } catch (_) { return null; }
  }

  async function fetchIntelligence(action, filters) {
    var token = await getToken();
    if (!token) return { success: false, error: { code: 'UNAUTHORIZED' } };
    var params = new URLSearchParams(filters || {});
    if (action) params.set('action', action);
    var resp = await fetch('/api/kronia/intelligence?' + params.toString(), {
      method: 'GET',
      headers: { authorization: 'Bearer ' + token }
    });
    return resp.json().catch(function () { return { success: false, error: { code: 'INVALID_RESPONSE' } }; });
  }

  function getHealthValue(overview, module) {
    if (module === 'diet' && Number.isFinite(Number(overview.dietHealthScore))) return Number(overview.dietHealthScore);
    if (module === 'exercise' && Number.isFinite(Number(overview.exerciseHealthScore))) return Number(overview.exerciseHealthScore);
    if (module === 'training' && Number.isFinite(Number(overview.trainingHealthScore))) return Number(overview.trainingHealthScore);
    if (module === 'monetization' && Number.isFinite(Number(overview.monetizationHealthScore))) return Number(overview.monetizationHealthScore);
    var found = (overview.healthByModule || []).find(function (item) { return item.module === module; });
    return found ? Number(found.healthScore || 0) : 100;
  }

  function renderOverviewCards(overview) {
    return [
      ['Eventos Críticos', overview.totalCriticalEvents || 0],
      ['Falhas de Dieta', overview.dietFailures || 0],
      ['Falhas de Exercício', overview.exerciseFailures || 0],
      ['Contratos Inválidos', overview.invalidContracts || 0],
      ['Fricções de Monetização', overview.monetizationFriction || 0],
      ['Abandono de Onboarding', overview.onboardingDropoff || 0]
    ].map(function (item) {
      return '<div class="kronia-intelligence-admin-card"><span>' + item[0] + '</span><strong>' + item[1] + '</strong></div>';
    }).join('');
  }

  function renderList(items, mapper, emptyLabel) {
    if (!Array.isArray(items) || !items.length) return '<div class="kronia-intelligence-admin-empty">' + emptyLabel + '</div>';
    return '<div class="kronia-intelligence-admin-list">' + items.slice(0, 10).map(mapper).join('') + '</div>';
  }

  function renderInsights(insights) {
    if (!Array.isArray(insights) || !insights.length) {
      return '<div class="kronia-intelligence-admin-empty">Nenhum insight operacional identificado.</div>';
    }
    return '<div class="kronia-intelligence-admin-list">' + insights.slice(0, 10).map(function (insight) {
      var safeTitle = String(insight.title || 'Insight operacional').replace(/"/g, '&quot;');
      return [
        '<article class="kronia-intelligence-insight-card">',
        '  <strong>' + (insight.title || 'Insight operacional') + '</strong>',
        '  <span>' + (insight.description || 'Sem descrição') + '</span>',
        '  <span><b>Impacto:</b> ' + (insight.impact || 'medium') + ' · <b>Domínio:</b> ' + (insight.domain || 'sistema') + '</span>',
        '  <button type="button" data-insight-task="' + safeTitle + '">Gerar Task</button>',
        '</article>'
      ].join('');
    }).join('') + '</div>';
  }

  function renderPanel(overviewPayload, recentPayload) {
    var container = document.getElementById('kronia-intelligence-admin-content');
    if (!container) return;
    var overview = overviewPayload?.data || {};
    var recentEvents = (recentPayload?.data?.recent || overview.recentEvents || []).slice(0, 15);
    var diagnostics = recentEvents.filter(function (event) { return !!event.problem_code; });
    var recommendations = (overview.generatedRecommendations || overview.recommendations || []).filter(Boolean);
    var tasks = (overview.generatedTasks || overview.tasks || []).filter(Boolean);
    var insights = (overview.insights || recentPayload?.data?.insights || []).filter(Boolean);
    var health = {
      dietHealthScore: getHealthValue(overview, 'diet'),
      exerciseHealthScore: getHealthValue(overview, 'exercise'),
      trainingHealthScore: getHealthValue(overview, 'training'),
      monetizationHealthScore: getHealthValue(overview, 'monetization')
    };

    container.innerHTML = [
      '<section><h4>Visão Geral</h4><div class="kronia-intelligence-admin-grid">' + renderOverviewCards(overview) + '</div></section>',
      '<section><h4>Eventos Recentes</h4>' + renderList(recentEvents, function (event) {
        return '<article><strong>' + (event.module || 'módulo') + ' · ' + (event.action || '-') + '</strong><span>' + (event.event || '-') + ' · ' + (event.severity || 'LOW') + '</span></article>';
      }, 'Sem eventos recentes.') + '</section>',
      '<section><h4>Problemas Detectados</h4>' + renderList(diagnostics, function (event) {
        return '<article><strong>' + (event.problem_label || event.problem_code) + '</strong><span>' + (event.module || '-') + ' · ' + (event.severity || '-') + '</span></article>';
      }, 'Nenhum problema detectado.') + '</section>',
      '<section><h4>Recomendações</h4>' + renderList(recommendations, function (item) {
        return '<article><strong>' + (item.area || 'sistema') + '</strong><span>' + (item.text || 'Sem recomendação') + '</span></article>';
      }, 'Nenhuma recomendação disponível.') + '</section>',
      '<section><h4>Insights Operacionais</h4>' + renderInsights(insights) + '</section>',
      '<section><h4>Tarefas Geradas</h4>' + renderList(tasks, function (item) {
        return '<article><strong>' + (item.title || 'Tarefa técnica') + '</strong><span>' + (item.priority || 'P2') + ' · ' + (item.summary || 'Sem resumo') + '</span></article>';
      }, 'Nenhuma tarefa gerada.') + '</section>',
      '<section><h4>Saúde por Módulo</h4><div class="kronia-intelligence-admin-grid">',
      '<div class="kronia-intelligence-admin-card"><span>dietHealthScore</span><strong>' + health.dietHealthScore + '</strong></div>',
      '<div class="kronia-intelligence-admin-card"><span>exerciseHealthScore</span><strong>' + health.exerciseHealthScore + '</strong></div>',
      '<div class="kronia-intelligence-admin-card"><span>trainingHealthScore</span><strong>' + health.trainingHealthScore + '</strong></div>',
      '<div class="kronia-intelligence-admin-card"><span>monetizationHealthScore</span><strong>' + health.monetizationHealthScore + '</strong></div>',
      '</div></section>'
    ].join('');

    try {
      container.querySelectorAll('[data-insight-task]').forEach(function (button) {
        button.addEventListener('click', function () {
          var title = button.getAttribute('data-insight-task') || 'Insight operacional';
          generateTaskFromInsight(title);
        });
      });
    } catch (_) {}
  }

  function renderError(message) {
    var container = document.getElementById('kronia-intelligence-admin-content');
    if (!container) return;
    container.innerHTML = '<div class="kronia-intelligence-admin-empty">' + message + '</div>';
  }

  function generateTaskFromInsight(title) {
    try {
      if (window.KroniaIntelligence && typeof window.KroniaIntelligence.track === 'function') {
        window.KroniaIntelligence.track({
          module: 'intelligence',
          action: 'insight_task_generate',
          status: 'success',
          source: 'kronia_intelligence_admin_panel',
          metadata: { title: String(title || 'Sem título').slice(0, 180) }
        });
      }
    } catch (_) {}
    try { console.log('Task gerada:', title); } catch (_) {}
  }

  var bridge = {
    openPanel: async function () {
      try {
        if (!isAdminUser()) return { success: false, error: { code: 'FORBIDDEN' } };
        var panel = ensurePanel();
        panel.classList.add('is-open');
        renderError('Carregando inteligência...');
        var overview = await this.fetchOverview();
        var recent = await this.fetchRecentEvents();
        if (!overview?.success) {
          renderError('Falha ao carregar overview da inteligência.');
          return overview;
        }
        renderPanel(overview, recent);
        return { success: true, data: { overview: overview.data, recent: recent?.data || null } };
      } catch (_) {
        return { success: false, error: { code: 'OPEN_PANEL_FAILED' } };
      }
    },
    closePanel: function () {
      try {
        var panel = document.getElementById(PANEL_ID);
        if (panel) panel.classList.remove('is-open');
      } catch (_) {}
    },
    togglePanel: function () {
      try {
        var panel = ensurePanel();
        if (panel.classList.contains('is-open')) {
          this.closePanel();
          return Promise.resolve({ success: true, open: false });
        }
        return this.openPanel().then(function (res) {
          return { success: !!res?.success, open: !!res?.success, data: res?.data || null, error: res?.error || null };
        });
      } catch (_) {
        return Promise.resolve({ success: false, open: false, error: { code: 'TOGGLE_PANEL_FAILED' } });
      }
    },
    fetchOverview: function (filters) {
      try {
        return fetchIntelligence('overview', filters);
      } catch (_) {
        return Promise.resolve({ success: false, error: { code: 'OVERVIEW_FETCH_FAILED' } });
      }
    },
    fetchRecentEvents: function (filters) {
      try {
        return fetchIntelligence('recent', filters);
      } catch (_) {
        return Promise.resolve({ success: false, error: { code: 'RECENT_FETCH_FAILED' } });
      }
    },
    getIntelligenceSummary: function () {
      try {
        var local = safeJsonParse(localStorage.getItem('kronia_intelligence_state_v1'), {});
        var operational = local && local.operational ? local.operational : {};
        return {
          initialized: !!local.initialized,
          localEvents: Array.isArray(local.events) ? local.events.length : 0,
          queueSize: Array.isArray(local.queue) ? local.queue.length : 0,
          frictionScore: Number(operational.frictionScore || 0),
          dietHealthScore: Number(operational.dietHealthScore || 100),
          exerciseHealthScore: Number(operational.exerciseHealthScore || 100),
          trainingHealthScore: Number(operational.trainingHealthScore || 100),
          monetizationHealthScore: Number(operational.monetizationHealthScore || 100)
        };
      } catch (_) {
        return {
          initialized: false,
          localEvents: 0,
          queueSize: 0,
          frictionScore: 0,
          dietHealthScore: 100,
          exerciseHealthScore: 100,
          trainingHealthScore: 100,
          monetizationHealthScore: 100
        };
      }
    },
    refreshAccess: function () {
      try {
        var fab = ensureFab();
        fab.style.display = isAdminUser() ? 'inline-flex' : 'none';
        if (!isAdminUser()) this.closePanel();
      } catch (_) {}
    },
    generateTask: function (title) {
      generateTaskFromInsight(title);
      return { success: true };
    }
  };

  window[BRIDGE_NAME] = window[BRIDGE_NAME] || bridge;

  function boot() {
    bridge.refreshAccess();
    window.setInterval(function () { bridge.refreshAccess(); }, POLL_MS);
    window.generateTask = window.generateTask || function (title) {
      try { return bridge.generateTask(title); } catch (_) { return { success: false }; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
