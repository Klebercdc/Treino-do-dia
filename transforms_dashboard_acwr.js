/**
 * KRONIA TRANSFORMS — Dashboard de Fadiga & ACWR
 * ================================================
 * Componentes visuais para o nó FAD (Fadiga) do grafo KRONIA.
 *
 * Componentes:
 *  1. AcwrGauge         — Velocímetro de risco (Chart.js Doughnut)
 *  2. LoadBarChart      — Carga Aguda vs Crônica (Chart.js Bar)
 *  3. RecommendationCard — Prescrição clínica esportiva em texto
 *
 * Dependências (já carregadas via CDN em index.html):
 *  - Chart.js
 *  - @supabase/supabase-js (cliente global _sb)
 *
 * Uso:
 *  window.KroniaDashboard.render(userId)
 *
 * Baseado em: Gabbett (2016) — ACWR e zonas de risco ortopédico.
 */

window.KroniaDashboard = (function () {
  'use strict';

  let _gaugeChart = null;
  let _loadChart  = null;

  function isLightMode() {
    return document.body && document.body.classList.contains('light-mode');
  }

  // ── Zonas de risco (Gabbett 2016) ────────────────────────────────────────
  const ZONAS = {
    sem_historico: { label: 'Sem histórico',  cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
    destreino:     { label: 'Destreino',      cor: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
    otimo:         { label: 'Ideal',          cor: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
    atencao:       { label: 'Atenção',        cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
    perigo:        { label: 'Perigo',         cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  };

  function getZona(acwr) {
    if (acwr == null)  return ZONAS.sem_historico;
    if (acwr < 0.8)    return ZONAS.destreino;
    if (acwr <= 1.3)   return ZONAS.otimo;
    if (acwr <= 1.5)   return ZONAS.atencao;
    return ZONAS.perigo;
  }

  // ── 1. Busca dados da view acwr_diario ────────────────────────────────────
  async function fetchDashboardData(userId) {
    if (typeof _sb === 'undefined' || !userId) return null;
    try {
      let q = _sb
        .from('acwr_diario')
        .select('acwr, zona_risco, carga_aguda_7d, carga_cronica_28d, dia')
        .order('dia', { ascending: false })
        .limit(1);

      if (window.KroniaAccessScope && typeof window.KroniaAccessScope.resolveAccessScope === 'function') {
        const scope = window.KroniaAccessScope.resolveAccessScope({ id: userId }, {
          ownershipColumn: 'user_id',
          purpose: 'transforms_dashboard_acwr',
          allowAdminGlobalRead: true
        });
        q = window.KroniaAccessScope.applyScopedQuery(q, scope);
      } else {
        q = q.eq('user_id', userId);
      }

      const { data, error } = await q.maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('[KroniaDashboard] acwr_diario indisponível:', err.message);
      return null;
    }
  }

  // ── 2. AcwrGauge — Doughnut em meia-lua ──────────────────────────────────
  function renderGauge(canvasId, acwr) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (_gaugeChart) { _gaugeChart.destroy(); _gaugeChart = null; }

    const zona  = getZona(acwr);
    const valor = acwr != null ? Math.min(Math.max(acwr, 0), 2.0) : 0;
    const resto = Math.max(0, 2.0 - valor);
    const light = isLightMode();

    const ctx = canvas.getContext('2d');
    _gaugeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [valor, resto],
          backgroundColor: [zona.cor, light ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.05)'],
          borderWidth: 0,
          circumference: 270,
          rotation: -135,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 900, easing: 'easeOutQuart' },
      },
      plugins: [{
        id: 'kronia-gauge-label',
        afterDraw(chart) {
          const { ctx: c, chartArea: { top, left, width, height } } = chart;
          const cx = left + width / 2;
          const cy = top + height / 2 + 14;

          c.save();
          c.textAlign = 'center';
          c.textBaseline = 'middle';

          // Número ACWR
          c.font = 'bold 30px "Barlow Condensed", Barlow, sans-serif';
          c.fillStyle = zona.cor;
          c.fillText(acwr != null ? acwr.toFixed(2) : '--', cx, cy - 10);

          // Rótulo da zona
          c.font = '700 9px Barlow, sans-serif';
          c.fillStyle = light ? 'rgba(15,23,42,0.52)' : 'rgba(255,255,255,0.45)';
          c.fillText(zona.label.toUpperCase(), cx, cy + 16);

          c.restore();
        },
      }],
    });
  }

  // ── 3. LoadBarChart — Aguda vs Crônica ───────────────────────────────────
  function renderLoadChart(canvasId, cargaAguda, cargaCronica) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (_loadChart) { _loadChart.destroy(); _loadChart = null; }

    const light = isLightMode();
    const ctx = canvas.getContext('2d');
    _loadChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Aguda (7d)', 'Crônica (28d)'],
        datasets: [{
          data: [cargaAguda || 0, cargaCronica || 0],
          backgroundColor: ['rgba(255,107,0,0.75)', 'rgba(99,102,241,0.75)'],
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` sRPE: ${Math.round(ctx.parsed.y)}` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: light ? 'rgba(15,23,42,0.58)' : 'rgba(255,255,255,0.5)',
              font: { family: 'Barlow, sans-serif', size: 11 },
            },
          },
          y: {
            grid: { color: light ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.05)' },
            ticks: {
              color: light ? 'rgba(15,23,42,0.44)' : 'rgba(255,255,255,0.35)',
              font: { family: 'Barlow, sans-serif', size: 10 },
            },
          },
        },
        animation: { duration: 600 },
      },
    });
  }

  // ── 4. RecommendationCard — Prescrição clínica esportiva ─────────────────
  // Ícones Lucide inline (SVG) — sem dependência de emoji
  const LUCIDE_ICONS = {
    sem_historico: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    destreino:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    otimo:        `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    atencao:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.29 3.86-8.6 14.9A1 1 0 0 0 2.56 20h17.88a1 1 0 0 0 .87-1.24L12.7 3.86a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    perigo:       `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>`,
  };

  const PRESCRICOES = {
    sem_historico: {
      titulo: 'Sem histórico ainda',
      corpo: 'Registre pelo menos 4 semanas de treino para ativar o motor de recomendação KRONIA TRANSFORMS.',
    },
    destreino: {
      titulo: 'Volume abaixo do mínimo',
      corpo: 'Carga crônica baixa. Aumente progressivamente o volume para construir base de condicionamento.',
    },
    otimo: {
      titulo: 'Recuperação ideal — zona de adaptação',
      corpo: 'Liberação total para progressão de carga e quebra de PR. Janela de adaptação fisiológica ótima.',
    },
    atencao: {
      titulo: 'Fadiga central acumulada',
      corpo: 'Mantenha as cargas atuais. Considere reduzir 1 série por exercício e priorizar sono e nutrição pós-treino.',
    },
    perigo: {
      titulo: 'Risco ortopédico severo',
      corpo: 'Treino de hoje deve ser estritamente regenerativo (RPE máx: 4). Evite exercícios pesados e movimentos explosivos.',
    },
  };

  function renderRecommendationCard(containerId, acwr, zonaRisco) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const light = isLightMode();
    const zona  = getZona(acwr);
    const chave = zonaRisco || Object.keys(ZONAS).find(k => ZONAS[k].cor === zona.cor) || 'sem_historico';
    const presc = PRESCRICOES[chave] || PRESCRICOES.sem_historico;

    el.innerHTML = `
      <div style="
        background:${zona.bg};
        border:1px solid ${zona.cor}35;
        border-radius:14px;
        padding:14px 16px;
        display:flex;
        align-items:flex-start;
        gap:12px;
      ">
        <span style="display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${zona.cor};margin-top:1px">${LUCIDE_ICONS[chave] || LUCIDE_ICONS.sem_historico}</span>
        <div>
          <div style="
            font-family:'Barlow Condensed',Barlow,sans-serif;
            font-size:0.88rem;
            font-weight:800;
            color:${zona.cor};
            letter-spacing:.04em;
            text-transform:uppercase;
            margin-bottom:5px;
          ">${presc.titulo}</div>
          <div style="
            font-size:0.78rem;
            color:${light ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.68)'};
            line-height:1.5;
          ">${presc.corpo}</div>
        </div>
      </div>
    `;
  }

  // ── 5. Render completo do Dashboard ──────────────────────────────────────
  async function render(userId) {
    const data = await fetchDashboardData(userId);

    const acwr         = data?.acwr              ?? null;
    const zonaRisco    = data?.zona_risco         ?? 'sem_historico';
    const cargaAguda   = data?.carga_aguda_7d     ?? 0;
    const cargaCronica = data?.carga_cronica_28d  ?? 0;

    renderGauge('kronia-acwr-gauge', acwr);
    renderLoadChart('kronia-load-chart', cargaAguda, cargaCronica);
    renderRecommendationCard('kronia-rec-card', acwr, zonaRisco);

    // Atualiza labels de texto auxiliares se existirem
    const elAcwr = document.getElementById('kronia-acwr-value');
    if (elAcwr) elAcwr.textContent = acwr != null ? acwr.toFixed(2) : '--';

    const elAguda = document.getElementById('kronia-carga-aguda');
    if (elAguda) elAguda.textContent = Math.round(cargaAguda);

    const elCronica = document.getElementById('kronia-carga-cronica');
    if (elCronica) elCronica.textContent = Math.round(cargaCronica);
  }

  // API pública
  return { render, fetchDashboardData, getZona, renderGauge, renderLoadChart, renderRecommendationCard };

})();
