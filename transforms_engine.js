/* ═══════════════════════════════════════════════════════════
   KRONIA TRANSFORMS ENGINE
   Motor de inteligência defensiva — inspirado no Maltego
   Entidades, Transforms e Defensive Transforms
═══════════════════════════════════════════════════════════ */

/* ── ENTIDADES ──────────────────────────────────────────── */
const TE_ENTITIES = {
  // confidence: confiança base da entidade (0.0–1.0)
  //   1.0 = dado direto do usuário
  //   0.9 = inferido de dado direto
  //   0.75–0.85 = calculado/agregado
  //   0.5–0.7 = inferido por modelo
  Usuario:       { color: '#FF6B00', abbr: 'USR', group: 0, confidence: 1.0 },
  Treino:        { color: '#3B82F6', abbr: 'TRN', group: 1, confidence: 1.0 },
  Exercicio:     { color: '#6366F1', abbr: 'EXC', group: 1, confidence: 1.0 },
  RPE:           { color: '#F59E0B', abbr: 'RPE', group: 2, confidence: 0.9  },
  FadigaScore:   { color: '#EF4444', abbr: 'FAD', group: 2, confidence: 0.85 },
  PR:            { color: '#10B981', abbr: 'PR',  group: 3, confidence: 1.0  },
  Nutricao:      { color: '#84CC16', abbr: 'NUT', group: 3, confidence: 0.9  },
  Mesociclo:     { color: '#8B5CF6', abbr: 'MESO',group: 4, confidence: 0.75 },
  Recomendacao:  { color: '#EC4899', abbr: 'REC', group: 4, confidence: 0.75 },
  Alerta:        { color: '#F97316', abbr: 'ALT', group: 5, confidence: 0.85 },
};

/* ── TRANSFORMS ─────────────────────────────────────────── */
const TE_TRANSFORMS = [
  { from: 'Usuario',      to: 'Treino',        label: 'expandTreinos',     description: 'Busca histórico de treinos',             model: null                  },
  { from: 'Usuario',      to: 'FadigaScore',   label: 'calcFadiga',        description: 'Calcula score de fadiga acumulada',      model: 'mixtral-8x7b-32768'  },
  { from: 'Treino',       to: 'Exercicio',     label: 'expandExercicios',  description: 'Extrai exercícios do treino',             model: null                  },
  { from: 'Treino',       to: 'RPE',           label: 'extractRPE',        description: 'Extrai escala de esforço percebido',      model: null                  },
  { from: 'RPE',          to: 'FadigaScore',   label: 'computeFadiga',     description: 'Computa fadiga a partir do RPE',          model: 'mixtral-8x7b-32768'  },
  { from: 'FadigaScore',  to: 'Recomendacao',  label: 'kronosAdvise',      description: 'KRONOS gera recomendação de treino',     model: 'llama3-70b-8192'     },
  { from: 'Exercicio',    to: 'PR',            label: 'detectPR',          description: 'Detecta Personal Record',                 model: null                  },
  { from: 'PR',           to: 'Recomendacao',  label: 'projecaoEvolucao',  description: 'Projeta evolução com base nos PRs',       model: 'llama3-70b-8192'     },
  { from: 'Nutricao',     to: 'Recomendacao',  label: 'macroAjuste',       description: 'Ajusta macros com base no treino',        model: 'llama3-70b-8192'     },
  { from: 'Mesociclo',    to: 'Treino',        label: 'gerarSemana',       description: 'Gera treinos da semana do mesociclo',    model: 'llama3-70b-8192'     },
];

/* ── DEFENSIVE TRANSFORMS ──────────────────────────────── */
const TE_DEFENSIVE = [
  {
    id: 'overtraining',
    name: 'Detector de Overtraining',
    severity: 'high',
    icon: 'flame',
    trigger: d => d.fadigaScore > 8.5,
    message: d => `RPE médio ${d.fadigaScore.toFixed(1)} — risco de overtraining. Recomendo 48h de descanso.`,
    action: 'Forçar descanso no mesociclo',
  },
  {
    id: 'plateau',
    name: 'Detector de Plateau',
    severity: 'medium',
    icon: 'trending-down',
    trigger: d => d.semSemPR >= 3,
    message: d => `${d.semSemPR} semanas sem PR. Ajustar volume ou intensidade.`,
    action: 'Sugerir deload ou variação',
  },
  {
    id: 'rpe_inconsistente',
    name: 'RPE Inconsistente',
    severity: 'low',
    icon: 'alert-circle',
    trigger: d => d.rpeVariance > 3,
    message: d => `Variância de RPE alta (${d.rpeVariance.toFixed(1)}). Registros imprecisos.`,
    action: 'Recalibrar escala RPE',
  },
  {
    id: 'regressao_carga',
    name: 'Regressão de Carga',
    severity: 'medium',
    icon: 'bar-chart',
    trigger: d => d.cargaRegression < -5,
    message: d => `Carga caiu ${Math.abs(d.cargaRegression).toFixed(1)}%. Verificar recuperação.`,
    action: 'Revisar nutrição e sono',
  },
  {
    id: 'streak_risco',
    name: 'Streak em Risco',
    severity: 'low',
    icon: 'repeat',
    trigger: d => d.diasSemTreino != null && d.diasSemTreino >= 2,
    message: d => `${d.diasSemTreino} dias sem treino. Streak em risco.`,
    action: 'Retomar treino hoje',
  },
];

const TE_SEV_COLOR = { high: '#EF4444', medium: '#F59E0B', low: '#6366F1' };

/* ── SVG ICONS ──────────────────────────────────────────── */
function teIcon(name, size = 16, color = null) {
  const nameMap = {
    'bar-chart': 'bar-chart-3',
    'repeat': 'rotate-cw',
    'alert-tri': 'alert-triangle'
  };
  const ico = _ico(nameMap[name] || name, size);
  if (!color) return ico;
  return `<span style="color:${color};display:inline-flex">${ico}</span>`;
}

/* ── COMPUTE ATHLETE DATA FROM LOCALSTORAGE ─────────────── */
function teComputeAthleteData() {
  const hist = (() => {
    try { return JSON.parse(localStorage.getItem('kronia_history_v2') || '[]'); } catch { return []; }
  })();

  // Days since last workout
  let diasSemTreino = null;
  if (hist.length > 0) {
    const last = hist.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
    diasSemTreino = Math.floor((Date.now() - new Date(last.createdAt)) / 86400000);
  }

  // RPE from recent sessions (last 10)
  const recent = hist.slice(0, 10);
  const rpeValues = recent
    .flatMap(s => (s.exercicios || []).map(e => e.rpe).filter(r => r != null && r > 0));

  const fadigaScore = rpeValues.length > 0
    ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length
    : 0;

  const rpeVariance = rpeValues.length > 1
    ? Math.sqrt(rpeValues.map(r => (r - fadigaScore) ** 2).reduce((a, b) => a + b, 0) / rpeValues.length)
    : 0;

  // Weeks without PR
  const prKey = 'kronia_prs';
  let semSemPR = 0;
  try {
    const prs = JSON.parse(localStorage.getItem(prKey) || '{}');
    const allPRDates = Object.values(prs)
      .flatMap(ex => Array.isArray(ex) ? ex.map(p => p.date || p.createdAt) : [])
      .filter(Boolean)
      .map(d => new Date(d));
    if (allPRDates.length > 0) {
      const lastPR = Math.max(...allPRDates.map(d => d.getTime()));
      semSemPR = Math.floor((Date.now() - lastPR) / (7 * 86400000));
    } else if (hist.length > 0) {
      semSemPR = 4; // no PRs ever
    }
  } catch {}

  // Load regression: compare avg load last 3 sessions vs previous 3
  let cargaRegression = 0;
  if (hist.length >= 6) {
    function avgLoad(sessions) {
      const loads = sessions.flatMap(s =>
        (s.exercicios || []).flatMap(e =>
          (e.series || []).map(ser => (ser.peso || 0) * (ser.reps || 0))
        )
      ).filter(v => v > 0);
      return loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
    }
    const recent3 = avgLoad(hist.slice(0, 3));
    const prev3   = avgLoad(hist.slice(3, 6));
    if (prev3 > 0) cargaRegression = ((recent3 - prev3) / prev3) * 100;
  }

  return {
    fadigaScore: fadigaScore || 0,
    semSemPR:    semSemPR,
    rpeVariance: rpeVariance,
    cargaRegression: cargaRegression,
    diasSemTreino: diasSemTreino,
    hasData: hist.length > 0,
  };
}

/* ── SCREEN STATE ───────────────────────────────────────── */
let _teActiveTab   = 'grafo';
let _teActiveNode  = null;
let _teAlerts      = [];
let _teScanning    = false;
let _teSim         = null;
let _teDiagRecent  = [];
let _teNodeStats   = {};
let _teJourneyRows = [];

/* ── OPEN / CLOSE ───────────────────────────────────────── */
function openTransformsScreen() {
  document.getElementById('transformsScreen').classList.add('show');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('overlay-open');
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = 'none';
  const adminTab = document.getElementById('adminObservabilityTabBtn');
  if (adminTab && typeof canShowAdminFeatures === 'function' && canShowAdminFeatures()) {
    adminTab.style.display = 'inline-flex';
  } else if (adminTab) {
    adminTab.style.display = 'none';
  }
  requestAnimationFrame(() => {
    teRenderGraph();
    teRenderLegend();
    teRenderCatalog();
    teRenderDefensiveList([]);
  });
}

async function teFetchAdminDiagnostics(action, opts, extraQuery) {
  const init = Object.assign({ method: 'GET' }, opts || {});
  const qs = '/api/admin-diagnostics?action=' + encodeURIComponent(action) + (extraQuery ? '&' + extraQuery : '');
  const resp = await apiFetch(qs, init);
  if (!resp.ok) throw new Error('admin diagnostics ' + action + ' falhou');
  const payload = await resp.json();
  if (!payload || payload.success !== true) throw new Error((payload && payload.error && payload.error.message) || 'Falha de contrato API');
  return payload.data || {};
}

function teFormatStatus(status) {
  const map = { healthy: '#10B981', degraded: '#F59E0B', failing: '#EF4444', inactive: '#64748B' };
  return map[status] || '#64748B';
}

async function teLoadAdminDiagnostics() {
  const overviewEl = document.getElementById('adminDiagOverview');
  const recentEl = document.getElementById('adminDiagRecent');
  const checklistEl = document.getElementById('adminDiagChecklist');
  if (!overviewEl || !recentEl) return;
  overviewEl.innerHTML = '<div style="font-size:.75rem;color:rgba(255,255,255,.5)">Carregando…</div>';
  recentEl.innerHTML = '';
  const warningMessages = [];

  const overviewResp = await teFetchAdminDiagnostics('overview').catch(e => {
    warningMessages.push('overview indisponível');
    console.error('[transforms_engine] falha parcial overview:', e);
    return {};
  });
  const recentResp = await teFetchAdminDiagnostics('recent').catch(e => {
    warningMessages.push('recent indisponível');
    console.error('[transforms_engine] falha parcial recent:', e);
    return {};
  });
  const checklistResp = await teFetchAdminDiagnostics('checklist').catch(e => {
    warningMessages.push('checklist indisponível');
    console.error('[transforms_engine] falha parcial checklist:', e);
    return {};
  });

  const partialErrors = Object.assign({},
    overviewResp && overviewResp.errors ? overviewResp.errors : {},
    recentResp && recentResp.errors ? recentResp.errors : {},
    checklistResp && checklistResp.errors ? checklistResp.errors : {}
  );
  Object.keys(partialErrors).forEach(key => {
    if (partialErrors[key]) warningMessages.push(key + ': ' + partialErrors[key]);
  });

  try {
    const items = Array.isArray(overviewResp.overview) ? overviewResp.overview : [];
    _teDiagRecent = Array.isArray(recentResp.executions)
      ? recentResp.executions
      : (Array.isArray(overviewResp.recent) ? overviewResp.recent : []);
    overviewEl.innerHTML = items.map(item => `
      <div style="padding:10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08)">
        <div style="font-size:.65rem;color:rgba(255,255,255,.45);text-transform:uppercase">${item.component}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
          <strong style="font-size:.95rem">${item.total || 0}</strong>
          <span style="font-size:.65rem;color:${teFormatStatus(item.status)}">${item.status}</span>
        </div>
        <div style="font-size:.68rem;color:rgba(255,255,255,.4);margin-top:4px">latência média ${item.avg_duration_ms || 0} ms · erro ${item.failure_total || 0}</div>
      </div>
    `).join('') || '<div style="font-size:.75rem;color:rgba(255,255,255,.5)">Sem dados recentes.</div>';

    recentEl.innerHTML = _teDiagRecent.slice(0, 20).map(exec => `
      <button onclick="teOpenExecutionDetail('${exec.execution_id}')" style="text-align:left;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px;color:inherit">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <span style="font-size:.68rem;color:rgba(255,255,255,.45)">${new Date(exec.created_at).toLocaleString()}</span>
          <span style="font-size:.66rem;color:${exec.success ? '#10B981' : '#EF4444'}">${exec.final_status}</span>
        </div>
        <div style="font-size:.78rem;margin-top:4px;font-family:monospace">${exec.execution_id}</div>
        <div style="font-size:.7rem;color:rgba(255,255,255,.45);margin-top:3px">corr ${exec.correlation_id || '—'} · trace ${exec.conversation_trace_id || '—'}</div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.6);margin-top:4px">${exec.intent_detected || '—'} · ${exec.pipeline_selected || '—'} · ${exec.duration_ms || 0}ms · quality ${exec.diagnostic_quality_score || '—'}</div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-top:2px">${exec.raw_input_summary || ''}</div>
        ${exec.conversation_trace_id ? `<div style="margin-top:6px;font-size:.68rem;color:#93c5fd;text-decoration:underline" onclick="event.stopPropagation();teLoadJourney('${exec.conversation_trace_id}')">Ver jornada</div>` : ''}
      </button>
    `).join('');
    if (checklistEl) {
      const items = Array.isArray(checklistResp.checklist)
        ? checklistResp.checklist
        : (Array.isArray(overviewResp.checklist) ? overviewResp.checklist : []);
      checklistEl.innerHTML = items.map(item => `<div style=\"padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);font-size:.73rem\"><span style=\"color:${item.ok ? '#10B981' : '#EF4444'};font-weight:700\">${item.ok ? 'OK' : 'PENDENTE'}</span> · ${item.label}</div>`).join('');
    }

    if (warningMessages.length > 0) {
      overviewEl.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:8px;padding:8px;border-radius:8px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);font-size:.72rem;color:#FCD34D">Alguns blocos estão com dados parciais: ${warningMessages.slice(0, 3).join(' · ')}</div>`);
    }
  } catch (e) {
    console.error('[transforms_engine] fallback render admin observability:', e);
    overviewEl.innerHTML = '<div style="font-size:.75rem;color:rgba(255,255,255,.6)">Observabilidade com dados indisponíveis no momento.</div>';
  }
}

async function teLoadJourney(traceId) {
  const detailEl = document.getElementById('adminDiagDetail');
  if (!detailEl) return;
  detailEl.style.display = 'block';
  detailEl.innerHTML = 'Carregando jornada...';
  try {
    const payload = await teFetchAdminDiagnostics('journey', null, 'conversation_trace_id=' + encodeURIComponent(traceId));
    _teJourneyRows = payload.journey || [];
    detailEl.innerHTML = `<div style="font-size:.68rem;color:rgba(255,255,255,.45);margin-bottom:8px">Jornada ${traceId}</div>` + _teJourneyRows.map(row => `<div style=\"padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:6px\"><div style=\"font-size:.72rem\">${new Date(row.created_at).toLocaleString()} · ${row.intent_detected || '-'} · ${row.pipeline_selected || '-'}</div><div style=\"font-size:.68rem;color:${row.success ? '#10B981' : '#EF4444'}\">${row.success ? 'success' : 'fail'} · fallback ${row.fallback_used ? 'sim' : 'não'} · severity ${row.severity || 'info'} · quality ${row.diagnostic_quality_score || '—'}</div></div>`).join('');
  } catch (e) {
    detailEl.innerHTML = '<span style=\"color:#EF4444\">Falha ao carregar jornada.</span>';
  }
}

async function teOpenExecutionDetail(executionId) {
  const detailEl = document.getElementById('adminDiagDetail');
  if (!detailEl) return;
  detailEl.style.display = 'block';
  detailEl.innerHTML = '<div style="font-size:.75rem;color:rgba(255,255,255,.5)">Carregando replay…</div>';
  try {
    const payload = await teFetchAdminDiagnostics('execution', null, 'execution_id=' + encodeURIComponent(executionId));
    const exec = payload.execution || {};
    const steps = payload.steps || [];
    _teNodeStats = {};
    (payload.nodeStats || []).forEach(item => { _teNodeStats[item.node] = item; });
    detailEl.innerHTML = `
      <div style="font-size:.66rem;color:rgba(255,255,255,.45);text-transform:uppercase;margin-bottom:8px">Motivo da Decisão</div>
      <div style="font-size:.8rem;line-height:1.5;margin-bottom:10px">${exec.decision_reason || 'Sem razão registrada.'}</div>
      <div style="font-size:.66rem;color:rgba(255,255,255,.45);text-transform:uppercase;margin-bottom:8px">Antes e Depois da Decisão</div>
      <div style="font-size:.75rem;color:rgba(255,255,255,.6);margin-bottom:10px"><b>Entrada:</b> ${exec.raw_input_summary || '—'}<br><b>Normalizado:</b> ${exec.normalized_input_summary || '—'}<br><b>Resposta:</b> ${exec.response_summary || '—'}</div>
      <div style="font-size:.66rem;color:rgba(255,255,255,.45);text-transform:uppercase;margin-bottom:8px">Replay Técnico</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${steps.map(step => `<div style=\"padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02)\"><div style=\"display:flex;justify-content:space-between\"><span style=\"font-size:.74rem;font-weight:700\">${step.step_order}. ${step.step_name}</span><span style=\"font-size:.66rem;color:${step.success ? '#10B981' : '#EF4444'}\">${step.status} · ${step.duration_ms || 0}ms</span></div><div style=\"font-size:.7rem;color:rgba(255,255,255,.45)\">${step.layer || '-'} · ${step.node_key || '-'}</div><div style=\"font-size:.72rem;color:rgba(255,255,255,.6);margin-top:4px\">${step.decision_reason || step.output_summary || ''}</div></div>`).join('')}
      </div>
    `;
    _teActiveNode = null;
    teRenderGraphWithExecution(steps);
  } catch (e) {
    detailEl.innerHTML = '<div style="font-size:.75rem;color:#EF4444">Falha ao carregar detalhes da execução.</div>';
  }
}

function teRenderGraphWithExecution(steps) {
  const okNodes = {};
  const failNodes = {};
  (steps || []).forEach(step => {
    if (!step.node_key) return;
    if (step.success === false) failNodes[step.node_key] = true;
    else okNodes[step.node_key] = true;
  });
  teRenderGraph({ okNodes: okNodes, failNodes: failNodes });
}

function closeTransformsScreen() {
  document.getElementById('transformsScreen').classList.remove('show');
  document.body.style.overflow = '';
  document.body.classList.remove('overlay-open');
  if (_teSim) { _teSim.stop(); _teSim = null; }
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
}

/* ── TAB SWITCHING ──────────────────────────────────────── */
function switchTransformsTab(tab, btn) {
  _teActiveTab = tab;
  document.querySelectorAll('.transforms-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.transforms-panel').forEach(p => p.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = 'block';
  if (tab === 'grafo') teRenderGraph();
}

/* ── D3 FORCE GRAPH ─────────────────────────────────────── */
function teRenderGraph(execState) {
  if (typeof d3 === 'undefined') return;
  const svgEl = document.getElementById('transformsGraphSvg');
  if (!svgEl) return;

  if (_teSim) { _teSim.stop(); _teSim = null; }
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const W = svgEl.clientWidth || 340;
  const H = svgEl.clientHeight || 360;
  svg.attr('viewBox', `0 0 ${W} ${H}`);

  // Glow filter
  const defs = svg.append('defs');
  const filt = defs.append('filter').attr('id', 'te-glow');
  filt.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
  const fm = filt.append('feMerge');
  fm.append('feMergeNode').attr('in', 'blur');
  fm.append('feMergeNode').attr('in', 'SourceGraphic');

  // Arrow marker
  defs.append('marker')
    .attr('id', 'te-arrow').attr('viewBox', '0 -5 10 10')
    .attr('refX', 22).attr('refY', 0)
    .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', 'rgba(255,107,0,0.5)');

  const nodes = Object.keys(TE_ENTITIES).map(type => ({ id: type, type }));
  const links = TE_TRANSFORMS.map(t => ({
    source: t.from, target: t.to, label: t.label, model: t.model
  }));

  _teSim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-160))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(32));

  const link = svg.append('g').selectAll('line')
    .data(links).join('line')
    .attr('stroke', d => d.model ? 'rgba(255,107,0,0.45)' : 'rgba(255,255,255,0.12)')
    .attr('stroke-width', d => d.model ? 2 : 1)
    .attr('stroke-dasharray', d => d.model ? '5,3' : 'none')
    .attr('marker-end', 'url(#te-arrow)');

  const node = svg.append('g').selectAll('g')
    .data(nodes).join('g')
    .attr('cursor', 'pointer')
    .on('click', (ev, d) => teSelectNode(d.type))
    .call(d3.drag()
      .on('start', (ev, d) => { if (!ev.active) _teSim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on('end',   (ev, d) => { if (!ev.active) _teSim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  const okNodes = (execState && execState.okNodes) || {};
  const failNodes = (execState && execState.failNodes) || {};

  node.append('circle')
    .attr('r', d => d.type === 'Usuario' ? 24 : 17)
    .attr('fill', d => failNodes[d.type] ? 'rgba(239,68,68,.26)' : (okNodes[d.type] ? (TE_ENTITIES[d.type]?.color || '#fff') + '33' : (TE_ENTITIES[d.type]?.color || '#fff') + '12'))
    .attr('stroke', d => failNodes[d.type] ? '#EF4444' : (d.type === _teActiveNode ? '#fff' : (okNodes[d.type] ? '#22c55e' : (TE_ENTITIES[d.type]?.color || '#fff'))))
    .attr('stroke-width', d => d.type === _teActiveNode ? 3 : 1.5)
    .attr('filter', d => d.type === _teActiveNode ? 'url(#te-glow)' : 'none');

  node.append('text')
    .attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-size', d => d.type === 'Usuario' ? 9 : 7)
    .attr('fill', d => TE_ENTITIES[d.type]?.color || '#fff')
    .attr('font-weight', '700')
    .text(d => TE_ENTITIES[d.type]?.abbr || d.type.slice(0, 4));

  node.append('text')
    .attr('text-anchor', 'middle').attr('dy', '2.6em')
    .attr('font-size', 7).attr('fill', d => TE_ENTITIES[d.type]?.color || '#fff')
    .attr('font-weight', '600').text(d => d.type);

  _teSim.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

async function teRunAdminHealthCheck() {
  const el = document.getElementById('adminDiagHealth');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = 'Executando…';
  try {
    const payload = await teFetchAdminDiagnostics('health');
    const checks = payload.checks || [];
    const alerts = payload.alerts || [];
    el.innerHTML = checks.map(c => `<div style=\"padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)\"><b style=\"color:${c.status==='healthy'?'#10B981':(c.status==='warning'?'#F59E0B':'#EF4444')}\">${c.status}</b> · ${c.label}<div style=\"font-size:.72rem;color:rgba(255,255,255,.5)\">${c.message}</div></div>`).join('')
      + (alerts.length ? `<div style=\"margin-top:8px;font-size:.72rem;color:#f59e0b\">Alertas: ${alerts.map(a => a.message).join(' | ')}</div>` : '');
  } catch (e) {
    el.innerHTML = '<span style=\"color:#EF4444\">Falha ao executar health check.</span>';
  }
}

async function teRunScenario(type) {
  const map = {
    greeting: 'oi',
    workout: 'quero um treino para hipertrofia sem equipamento',
    diet: 'monte uma dieta para emagrecimento',
    no_context: 'quero ajuda mas nao tenho historico',
    ia_failure: 'simular falha de ia'
  };
  try {
    await teFetchAdminDiagnostics('simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: type, text: map[type] || 'oi', dry_run: true, simulation_mode: 'pipeline_replay' })
    });
    teLoadAdminDiagnostics();
  } catch (e) {}
}

/* ── NODE SELECTION ─────────────────────────────────────── */
function teSelectNode(type) {
  _teActiveNode = _teActiveNode === type ? null : type;
  teRenderGraph();

  const detail = document.getElementById('transformsNodeDetail');
  if (!_teActiveNode) { detail.style.display = 'none'; return; }

  const cfg = TE_ENTITIES[_teActiveNode];
  const related = TE_TRANSFORMS.filter(t => t.from === _teActiveNode || t.to === _teActiveNode);
  const stat = _teNodeStats[_teActiveNode] || null;

  detail.style.display = 'block';
  const confPct  = Math.round((cfg.confidence || 1) * 100);
  const confBar  = '█'.repeat(Math.round(confPct / 10)) + '░'.repeat(10 - Math.round(confPct / 10));
  detail.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="width:36px;height:36px;border-radius:10px;background:${cfg.color}18;border:1px solid ${cfg.color}35;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="font-size:0.75rem;font-weight:800;color:${cfg.color}">${cfg.abbr}</span>
      </div>
      <div>
        <div style="font-size:0.95rem;font-weight:800">${_teActiveNode}</div>
        <div style="font-size:0.65rem;color:rgba(255,255,255,0.3);font-family:monospace;margin-top:2px">
          confiança ${confBar} ${confPct}%
        </div>
      </div>
    </div>
    ${stat ? `<div style="margin:8px 0;padding:8px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);font-size:.72rem;color:rgba(255,255,255,.65)">latência média ${stat.avgDurationMs || 0} ms · sucesso ${Math.round((stat.successRate || 0) * 100)}% · falhas ${stat.failures || 0}${stat.lastError ? `<br>último erro: ${stat.lastError}` : ''}</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:6px">
      ${related.map(t => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
          <span style="font-size:0.65rem;color:${t.from===_teActiveNode?'#FF6B00':'#10B981'};font-family:monospace;font-weight:700;flex-shrink:0">${t.from===_teActiveNode?'OUT':'IN '}</span>
          <span style="font-size:0.78rem;font-weight:600">${t.label}</span>
          <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);flex:1">${t.description}</span>
          ${t.model ? `<span style="font-size:0.6rem;padding:2px 6px;border-radius:20px;background:rgba(255,107,0,0.15);color:#FF6B00;font-weight:700;flex-shrink:0">AI</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

/* ── LEGEND ──────────────────────────────────────────────── */
function teRenderLegend() {
  const el = document.getElementById('transformsLegend');
  if (!el) return;
  el.innerHTML = Object.entries(TE_ENTITIES).map(([type, cfg]) => `
    <div class="te-legend-chip" onclick="teSelectNode('${type}')" style="background:${cfg.color}15;border:1px solid ${cfg.color}40">
      <span style="color:${cfg.color};font-size:0.65rem;font-weight:700">${type}</span>
    </div>
  `).join('');
}

/* ── CATALOG ─────────────────────────────────────────────── */
function teRenderCatalog() {
  const list = document.getElementById('transformsCatalogList');
  const sub  = document.getElementById('catalogSubtitle');
  if (!list) return;

  const aiCount   = TE_TRANSFORMS.filter(t => t.model).length;
  const detCount  = TE_TRANSFORMS.filter(t => !t.model).length;
  if (sub) sub.textContent = `${aiCount} com modelo de IA · ${detCount} determinísticos`;

  list.innerHTML = TE_TRANSFORMS.map(t => {
    const fromCfg = TE_ENTITIES[t.from];
    const toCfg   = TE_ENTITIES[t.to];
    return `
      <div class="te-catalog-item">
        <div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <span style="width:8px;height:8px;border-radius:50%;background:${fromCfg?.color};flex-shrink:0"></span>
            <span style="color:${fromCfg?.color};font-size:0.7rem;font-weight:700">${t.from}</span>
            ${_ico('arrow-right', 10)}
            <span style="width:8px;height:8px;border-radius:50%;background:${toCfg?.color};flex-shrink:0"></span>
            <span style="color:${toCfg?.color};font-size:0.7rem;font-weight:700">${t.to}</span>
          </div>
          <div style="font-family:var(--mono,monospace);font-size:0.8rem;font-weight:700;color:#fff;margin-bottom:3px">${t.label}()</div>
          <div style="font-size:0.72rem;color:rgba(255,255,255,0.35)">${t.description}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          ${t.model
            ? `<div style="font-size:0.6rem;padding:2px 8px;border-radius:20px;background:rgba(255,107,0,0.15);color:#FF6B00;font-weight:700;margin-bottom:3px">AI</div>
               <div style="font-size:0.6rem;color:rgba(255,255,255,0.3);font-family:monospace">${t.model.split('-')[0]}</div>`
            : `<div style="font-size:0.6rem;padding:2px 8px;border-radius:20px;background:rgba(100,200,100,0.1);color:#7AE89E;font-weight:700">DET.</div>`
          }
        </div>
      </div>
    `;
  }).join('');
}

/* ── DEFENSIVE LIST (initial render) ───────────────────── */
function teRenderDefensiveList(alerts) {
  const list = document.getElementById('defensiveList');
  if (!list) return;

  list.innerHTML = TE_DEFENSIVE.map(dt => {
    const hit = alerts.find(a => a.id === dt.id);
    const sc  = TE_SEV_COLOR[dt.severity];
    return `
      <div class="te-defensive-item${hit ? ' hit' : ''}" style="${hit ? `border-color:${sc}45;background:${sc}10` : ''}">
        <div class="te-def-icon" style="${hit ? `background:${sc}18;border-color:${sc}35` : ''}">
          ${teIcon(dt.icon, 16, hit ? sc : 'rgba(255,255,255,0.3)')}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.82rem;font-weight:700;margin-bottom:3px">${dt.name}</div>
          <div style="font-size:0.72rem;color:${hit ? sc : 'rgba(255,255,255,0.28)'}">${hit ? hit.message : dt.action}</div>
        </div>
        <div style="flex-shrink:0">
          ${hit
            ? teIcon('alert-tri', 16, sc)
            : alerts.length > 0
              ? teIcon('check-circle', 16, '#10B981')
              : `<div style="width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.08)"></div>`
          }
        </div>
      </div>
    `;
  }).join('');
}

/* ── DEFENSIVE SCAN ─────────────────────────────────────── */
async function runDefensiveScan() {
  if (_teScanning) return;
  _teScanning = true;

  const btn = document.getElementById('btnDefensiveScan');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `${_ico('rotate-cw', 13)} Analisando...`;
  }

  const logBox   = document.getElementById('defensiveLog');
  const logLines = document.getElementById('defensiveLogLines');
  if (logBox) logBox.style.display = 'block';
  if (logLines) logLines.innerHTML = '';

  function addLog(msg) {
    if (!logLines) return;
    const line = document.createElement('div');
    line.style.cssText = 'font-size:0.72rem;color:rgba(255,255,255,0.45);font-family:monospace;margin-bottom:3px';
    line.textContent = msg;
    logLines.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  const athleteData = teComputeAthleteData();
  const found = [];

  for (const dt of TE_DEFENSIVE) {
    if (!athleteData.hasData) break;
    await new Promise(r => setTimeout(r, 280));
    addLog(`Executando: ${dt.name}...`);
    if (dt.trigger(athleteData)) {
      const hit = { ...dt, message: dt.message(athleteData) };
      found.push(hit);
      addLog(`⚠ ALERTA: ${hit.message}`);
    } else {
      addLog(`✓ OK: ${dt.name}`);
    }
  }

  _teAlerts = found;
  teRenderDefensiveList(found);

  if (!athleteData.hasData) {
    addLog('Sem dados de treino suficientes para análise.');
    addLog('Registre seus primeiros treinos e execute o scan novamente.');
  } else {
    const highAlerts = found.filter(a => a.severity === 'high');
    if (highAlerts.length > 0 || found.length > 0) {
      addLog('Enviando análise para KRONOS...');
      await teCallKronos(found, athleteData);
    } else {
      addLog('Nenhum alerta detectado. Atleta em boa forma!');
    }
  }

  _teScanning = false;
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `${_ico('shield', 13)} Executar Scan`;
  }
}

/* ── KRONOS ANALYSIS VIA API ────────────────────────────── */
async function teCallKronos(alerts, athleteData) {
  const logLines = document.getElementById('defensiveLogLines');
  const kronosBox  = document.getElementById('kronosAnalysis');
  const kronosText = document.getElementById('kronosAnalysisText');

  function addLog(msg) {
    if (!logLines) return;
    const line = document.createElement('div');
    line.style.cssText = 'font-size:0.72rem;color:rgba(255,255,255,0.45);font-family:monospace;margin-bottom:3px';
    line.textContent = msg;
    logLines.appendChild(line);
    document.getElementById('defensiveLog').scrollTop = 9999;
  }

  try {
    const alertSummary = alerts.length > 0
      ? alerts.map(a => `[${a.severity.toUpperCase()}] ${a.message}`).join(' | ')
      : 'Nenhum alerta crítico detectado.';

    const diasStr = athleteData.diasSemTreino != null ? `${athleteData.diasSemTreino} dias` : 'sem dados (usuário novo, ainda sem treinos registrados)';
    const userMsg = alerts.length > 0
      ? `Alertas detectados no atleta: ${alertSummary}. Dados fisiológicos: fadiga=${athleteData.fadigaScore.toFixed(1)}, semSemPR=${athleteData.semSemPR}, varianciaRPE=${athleteData.rpeVariance.toFixed(1)}, regressaoCarga=${athleteData.cargaRegression.toFixed(1)}%, diasSemTreino=${diasStr}. Dê recomendações práticas em português, máximo 2 parágrafos.`
      : `O atleta está com dados saudáveis: fadiga=${athleteData.fadigaScore.toFixed(1)}, diasSemTreino=${diasStr}. Dê um feedback positivo e dica de manutenção, máximo 2 parágrafos.`;

    let headers = { 'Content-Type': 'application/json' };
    try { headers = await getAuthHeaders(); } catch {}

    const resp = await fetch(location.origin + '/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: userMsg }],
        system: 'Você é KRONOS, coach de alta performance do KRONIA. Analise os alertas defensivos do atleta e dê recomendações diretas e baseadas em evidências em português brasileiro. Seja objetivo e prático. Máximo 2 parágrafos.',
      }),
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const reply = data.reply || data.text || data.content?.[0]?.text || '';

    if (reply && kronosBox && kronosText) {
      kronosText.textContent = reply;
      kronosBox.style.display = 'block';
      addLog('KRONOS respondeu!');
    }
  } catch (err) {
    addLog('Erro ao contactar KRONOS: ' + (err.message || 'conexão falhou'));
  }
}

/* ── ENTITY STATE CACHE KEY ─────────────────────────────── */
const TE_CACHE_KEY = 'te_scan_cache_v1';

/* ── GET CACHED ENTITY STATE ────────────────────────────── */
function teGetEntityState() {
  try {
    const raw = localStorage.getItem(TE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Invalidate cache older than 4 hours
    if (Date.now() - (parsed.ts || 0) > 4 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

/* ── SILENT SCAN — roda sem abrir a tela ───────────────── */
async function teSilentScan() {
  if (!teComputeAthleteData) return;
  const athleteData = teComputeAthleteData();
  if (!athleteData.hasData) return;

  const found = [];
  for (const dt of TE_DEFENSIVE) {
    try {
      if (dt.trigger(athleteData)) {
        found.push({ id: dt.id, name: dt.name, severity: dt.severity, icon: dt.icon, message: dt.message(athleteData) });
      }
    } catch(e) {}
  }

  // Compute active entity states
  const entities = {
    Usuario:     { active: true },
    Treino:      { active: athleteData.hasData },
    FadigaScore: { active: athleteData.fadigaScore > 0, value: athleteData.fadigaScore.toFixed(1) },
    RPE:         { active: athleteData.fadigaScore > 0 },
    Alerta:      { active: found.length > 0, count: found.length },
    PR:          { active: athleteData.semSemPR < 4 },
    Mesociclo:   { active: athleteData.hasData },
    Recomendacao:{ active: false },
  };

  const cache = { ts: Date.now(), alerts: found, entities, athleteData };
  try { localStorage.setItem(TE_CACHE_KEY, JSON.stringify(cache)); } catch(e) {}

  // Update badge on KRONIA TRANSFORMS home card
  teUpdateHomeBadge(found);

  return cache;
}

/* ── UPDATE HOME CARD BADGE ─────────────────────────────── */
function teUpdateHomeBadge(alerts) {
  const badge = document.getElementById('teScanBadge');
  if (!badge) return;
  if (alerts && alerts.length > 0) {
    const hasHigh = alerts.some(a => a.severity === 'high');
    badge.textContent = hasHigh ? `⚠ ${alerts.length} ALERTA${alerts.length > 1 ? 'S' : ''}` : `${alerts.length} aviso${alerts.length > 1 ? 's' : ''}`;
    badge.style.color = hasHigh ? '#ef4444' : '#f97316';
    badge.style.borderColor = hasHigh ? 'rgba(239,68,68,0.5)' : 'rgba(249,115,22,0.4)';
  } else {
    badge.textContent = 'ATIVO';
    badge.style.color = '#10B981';
    badge.style.borderColor = 'rgba(16,185,129,0.4)';
  }
}

/* ── MACHINES CATALOG (integração com machine_engine.js) ─── */

/**
 * Renderiza o catálogo de machines no painel de tab "machines".
 * Chamado por switchTransformsTab quando a aba "machines" é ativada.
 */
function teRenderMachinesTab() {
  if (typeof kmRenderMachinesCatalog === 'function') {
    kmRenderMachinesCatalog('machinesCatalogList');
  } else {
    const el = document.getElementById('machinesCatalogList');
    if (el) el.innerHTML = '<div style="font-size:0.75rem;color:rgba(255,255,255,0.3);padding:12px">machine_engine.js não carregado.</div>';
  }
}

/**
 * Executa a machine de análise completa e integra com o fluxo
 * defensivo existente. Fallback para o scan clássico se o
 * machine_engine.js não estiver carregado.
 */
async function teRunFullAnalysis() {
  if (typeof kmRunMachineUI !== 'function') {
    return runDefensiveScan();
  }
  const uid = await _sb.auth.getSession()
    .then(r => r.data?.session?.user?.id)
    .catch(() => 'local') || 'local';
  await kmRunMachineUI('kronia.full_analysis', uid);
}
