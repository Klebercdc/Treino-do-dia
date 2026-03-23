/* ═══════════════════════════════════════════════════════════════
   KRONIA TRANSFORMS — Dashboard de Fadiga, Onboarding e Push
   ─────────────────────────────────────────────────────────────
   Módulos:
     1. fetchDashboardData   → busca ACWR + sRPE da view acwr_diario
     2. renderAcwrGauge      → Velocímetro de risco (Chart.js Doughnut)
     3. renderLoadBarChart   → Carga Aguda vs Crônica (Chart.js Bar)
     4. renderRecommendation → Cartão REC com prescrição clínica
     5. initDashboard        → Orquestra tudo na tela
     6. calculate1RM         → Fórmula de Brzycki
     7. initOnboarding       → Coleta linha de base + salva PR
     8. initPushSubscription → Solicita permissão e salva no Supabase
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Zonas de risco (Gabbett 2016) ────────────────────────────
const ACWR_ZONES = {
  destreino:    { color: '#6B7280', label: 'Destreino',         hex: '#6B7280' },
  otimo:        { color: '#10B981', label: 'Zona Ótima',        hex: '#10B981' },
  atencao:      { color: '#F59E0B', label: 'Atenção',           hex: '#F59E0B' },
  perigo:       { color: '#EF4444', label: 'Risco de Lesão',    hex: '#EF4444' },
  sem_historico:{ color: '#8B5CF6', label: 'Sem histórico',     hex: '#8B5CF6' },
};

const ACWR_RECOMENDACOES = {
  destreino:     'Volume abaixo do ideal. Aumente gradualmente a frequência de treinos para reconstruir a carga crônica.',
  otimo:         'Recuperação ideal. Liberação total para progressão de carga e quebra de PR.',
  atencao:       'Fadiga central acumulada. Mantenha as cargas atuais e considere reduzir 1 série por exercício.',
  perigo:        'Risco ortopédico severo. Treino de hoje deve ser estritamente regenerativo (RPE máx: 4).',
  sem_historico: 'Histórico insuficiente. Registre pelo menos 4 semanas de treinos para calibrar o motor.',
};

// ── Referência aos gráficos (evita re-criar sobre canvas existente) ─
let _gaugeChart    = null;
let _barChart      = null;

// ══════════════════════════════════════════════════════════════
// 1. FETCH — busca ACWR do usuário logado
// ══════════════════════════════════════════════════════════════
async function fetchDashboardData() {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) return null;

  const { data, error } = await _sb
    .from('acwr_diario')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('[KRONIA Dashboard] Erro ao buscar ACWR:', error.message);
    return null;
  }
  return data;
}

// ══════════════════════════════════════════════════════════════
// 2. VELOCÍMETRO DE RISCO (Chart.js Doughnut)
// ══════════════════════════════════════════════════════════════
function renderAcwrGauge(canvasId, acwr, zona) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const zone     = ACWR_ZONES[zona] || ACWR_ZONES.sem_historico;
  const pct      = acwr ? Math.min(acwr / 2, 1) : 0;   // normaliza 0–2 para 0–100%
  const filled   = pct;
  const empty    = 1 - pct;

  if (_gaugeChart) { _gaugeChart.destroy(); _gaugeChart = null; }

  _gaugeChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data:            [filled, empty],
        backgroundColor: [zone.color, '#1f2937'],
        borderWidth:     0,
        circumference:   180,
        rotation:        -90,
      }],
    },
    options: {
      responsive: true,
      cutout: '75%',
      plugins: {
        tooltip: { enabled: false },
        legend:  { display: false },
      },
      animation: { duration: 800, easing: 'easeInOutQuart' },
    },
    plugins: [{
      id: 'acwrLabel',
      afterDraw(chart) {
        const { ctx, chartArea: { left, right, top } } = chart;
        const cx = (left + right) / 2;
        const cy = top + (right - left) / 2 + 10;
        ctx.save();
        // Valor numérico
        ctx.font        = 'bold 2rem DM Sans, sans-serif';
        ctx.fillStyle   = zone.color;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(acwr != null ? acwr.toFixed(2) : '—', cx, cy - 10);
        // Label da zona
        ctx.font      = '0.75rem DM Sans, sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(zone.label, cx, cy + 20);
        ctx.restore();
      },
    }],
  });
}

// ══════════════════════════════════════════════════════════════
// 3. GRÁFICO DE CARGA AGUDA vs CRÔNICA (Chart.js Bar)
// ══════════════════════════════════════════════════════════════
function renderLoadBarChart(canvasId, cargaAguda, cargaCronica) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_barChart) { _barChart.destroy(); _barChart = null; }

  _barChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Aguda (7d)', 'Crônica (28d)'],
      datasets: [{
        label: 'sRPE',
        data:            [cargaAguda || 0, cargaCronica || 0],
        backgroundColor: ['#3B82F6', '#6366F1'],
        borderRadius:    8,
        borderSkipped:   false,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` sRPE: ${ctx.raw?.toFixed(1) ?? 0}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 9 } } },
        y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af', font: { size: 9 }, maxTicksLimit: 3 }, beginAtZero: true },
      },
      animation: { duration: 600 },
    },
  });
}

// ══════════════════════════════════════════════════════════════
// 4. CARTÃO DE RECOMENDAÇÃO (Nó REC)
// ══════════════════════════════════════════════════════════════
function renderRecommendationCard(containerId, zona, ultimoTreino) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const zone  = ACWR_ZONES[zona]           || ACWR_ZONES.sem_historico;
  const texto = ACWR_RECOMENDACOES[zona]   || ACWR_RECOMENDACOES.sem_historico;
  const diasSemTreino = ultimoTreino
    ? Math.floor((Date.now() - new Date(ultimoTreino).getTime()) / 86400000)
    : null;

  el.innerHTML = `
    <div style="
      background: #111827;
      border: 1.5px solid ${zone.color};
      border-radius: 16px;
      padding: 20px;
      margin-top: 16px;
    ">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
        <span style="
          background: ${zone.color}22;
          color: ${zone.color};
          border-radius: 8px;
          padding: 4px 12px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: .05em;
        ">${zone.label.toUpperCase()}</span>
        ${diasSemTreino != null ? `
          <span style="color:#6b7280; font-size:0.78rem;">
            ${diasSemTreino === 0 ? 'Treino hoje' : `${diasSemTreino}d sem treino`}
          </span>` : ''}
      </div>
      <p style="color:#e5e7eb; font-size:0.95rem; line-height:1.6; margin:0;">
        ${texto}
      </p>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// 5. ORQUESTRADOR DO DASHBOARD
// ══════════════════════════════════════════════════════════════
async function initDashboard({
  gaugeCanvasId      = 'acwrGaugeCanvas',
  barCanvasId        = 'loadBarCanvas',
  recContainerId     = 'recCard',
  loadingId          = 'dashboardLoading',
  errorId            = 'dashboardError',
} = {}) {
  const loading = document.getElementById(loadingId);
  const errorEl = document.getElementById(errorId);
  if (loading)  loading.style.display  = 'flex';
  if (errorEl)  errorEl.style.display  = 'none';

  try {
    const data = await fetchDashboardData();

    if (!data) {
      if (errorEl) {
        errorEl.style.display  = 'block';
        errorEl.textContent    = 'Nenhum dado disponível. Registre seus primeiros treinos!';
      }
      return;
    }

    const { acwr, zona_risco, carga_aguda_7d, carga_cronica_28d, ultimo_treino } = data;

    renderAcwrGauge(gaugeCanvasId, acwr, zona_risco);
    renderLoadBarChart(barCanvasId, carga_aguda_7d, carga_cronica_28d);
    renderRecommendationCard(recContainerId, zona_risco, ultimo_treino);
  } catch (err) {
    console.error('[KRONIA Dashboard] Erro:', err);
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent   = 'Falha ao carregar dados. Tente novamente.';
    }
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════════
// 6. CÁLCULO 1RM — Fórmula de Brzycki (1993)
//    Válida apenas para reps ≤ 10 (acima perde precisão clínica)
// ══════════════════════════════════════════════════════════════
function calculate1RM(weightKg, reps) {
  if (!weightKg || !reps || reps <= 0 || reps > 10) return null;
  return +(weightKg / (1.0278 - 0.0278 * reps)).toFixed(2);
}

// ══════════════════════════════════════════════════════════════
// 7. ONBOARDING — Linha de Base de Força
// ══════════════════════════════════════════════════════════════
async function initOnboarding(formId = 'onboardingForm') {
  const form = document.getElementById(formId);
  if (!form) return;

  // Exercícios base disponíveis para onboarding
  const { data: exercises } = await _sb
    .from('exercises')
    .select('id, name, muscle_group')
    .order('name');

  // Preenche select dinamicamente
  const sel = form.querySelector('#obExercicio');
  if (sel && exercises) {
    sel.innerHTML = '<option value="">Selecione o exercício…</option>'
      + exercises.map(e => `<option value="${e.id}" data-group="${e.muscle_group}">${e.name}</option>`).join('');
  }

  // Validação em tempo real do campo reps (máx 10)
  const repsInput = form.querySelector('#obReps');
  if (repsInput) {
    repsInput.setAttribute('max', '10');
    repsInput.addEventListener('input', () => {
      if (parseInt(repsInput.value, 10) > 10) repsInput.value = '10';
    });
  }

  // Preview do 1RM em tempo real
  const pesoInput   = form.querySelector('#obPeso');
  const preview1rm  = form.querySelector('#ob1rmPreview');
  function atualizar1RM() {
    const w    = parseFloat(pesoInput?.value);
    const r    = parseInt(repsInput?.value, 10);
    const rm   = calculate1RM(w, r);
    if (preview1rm) {
      preview1rm.textContent = rm ? `1RM estimado: ${rm} kg` : '';
    }
  }
  if (pesoInput) pesoInput.addEventListener('input', atualizar1RM);
  if (repsInput) repsInput.addEventListener('input', atualizar1RM);

  // Submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { alert('Faça login para salvar seu perfil de força.'); return; }

    const exercicioId = sel?.value;
    const peso        = parseFloat(pesoInput?.value);
    const reps        = parseInt(repsInput?.value, 10);
    const oneRm       = calculate1RM(peso, reps);

    if (!exercicioId)         { alert('Selecione um exercício.'); return; }
    if (!peso || peso <= 0)   { alert('Informe uma carga válida (kg).'); return; }
    if (!reps || reps < 1 || reps > 10) { alert('Repetições: 1 a 10.'); return; }
    if (!oneRm)               { alert('Não foi possível calcular o 1RM.'); return; }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

    try {
      const prRow = {
        user_id:     session.user.id,
        exercise_id: exercicioId,
        weight_kg:   peso,
        reps,
        one_rm_kg:   oneRm,
        recorded_at: new Date().toISOString().split('T')[0],
        source:      'onboarding',
      };

      // Salva no Supabase
      const { error } = await _sb.from('personal_records').upsert(prRow, {
        onConflict: 'user_id, exercise_id, recorded_at',
      });
      if (error) throw error;

      // Salva no localStorage (Optimistic UI / offline)
      const lsKey = 'kronia_prs';
      const prs   = JSON.parse(localStorage.getItem(lsKey) || '{}');
      prs[exercicioId] = { oneRm, peso, reps, savedAt: Date.now() };
      localStorage.setItem(lsKey, JSON.stringify(prs));

      // Feedback visual
      if (preview1rm) {
        preview1rm.textContent = `✓ 1RM de ${oneRm} kg salvo! Seu perfil de força está pronto.`;
        preview1rm.style.color = '#10B981';
      }
      form.reset();
    } catch (err) {
      console.error('[KRONIA Onboarding] Erro ao salvar PR:', err);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Gerar Meu Perfil de Força'; }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// 8. PUSH SUBSCRIPTION — Solicita permissão e salva no Supabase
// ══════════════════════════════════════════════════════════════

// Substitua pela sua chave pública VAPID gerada via web-push
const VAPID_PUBLIC_KEY = 'SUA_VAPID_PUBLIC_KEY_AQUI';

function urlBase64ToUint8Array(base64String) {
  const padding  = '='.repeat((4 - base64String.length % 4) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function initPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[KRONIA Push] Web Push não suportado neste navegador.');
    return;
  }

  const { data: { session } } = await _sb.auth.getSession();
  if (!session) return;

  // Não pede permissão duas vezes
  const jaPermitido = localStorage.getItem('kronia_push_granted');
  if (jaPermitido === 'true' && Notification.permission === 'granted') return;

  // Aguarda o service worker ficar pronto
  const registration = await navigator.serviceWorker.ready;

  // Verifica se já tem subscription ativa
  let sub = await registration.pushManager.getSubscription();

  if (!sub) {
    // Pede permissão ao usuário
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.log('[KRONIA Push] Permissão negada pelo usuário.');
      return;
    }
    // Cria nova subscription
    sub = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Salva no Supabase
  const { error } = await _sb.from('push_subscriptions').upsert({
    user_id:           session.user.id,
    subscription_json: sub.toJSON(),
    user_agent:        navigator.userAgent,
    updated_at:        new Date().toISOString(),
  }, { onConflict: 'user_id, (subscription_json->>\'endpoint\')' });

  if (error) {
    console.error('[KRONIA Push] Erro ao salvar subscription:', error.message);
  } else {
    localStorage.setItem('kronia_push_granted', 'true');
    console.log('[KRONIA Push] Subscription registrada com sucesso.');
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORT — disponibiliza para app.js / index.html
// ══════════════════════════════════════════════════════════════
window.KroniaDashboard = {
  init:                initDashboard,
  fetchData:           fetchDashboardData,
  renderGauge:         renderAcwrGauge,
  renderBar:           renderLoadBarChart,
  renderRecommendation: renderRecommendationCard,
  calculate1RM,
  initOnboarding,
  initPushSubscription,
  ACWR_ZONES,
  ACWR_RECOMENDACOES,
};
