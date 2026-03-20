/* ═══════════════════════════════════════════════════════════
   TITAN TRANSFORMS ENGINE
   Motor de inteligência defensiva — inspirado no Maltego
   Entidades, Transforms e Defensive Transforms
═══════════════════════════════════════════════════════════ */

/* ── ENTIDADES ──────────────────────────────────────────── */
const TE_ENTITIES = {
  Usuario:       { color: '#FF6B00', abbr: 'USR', group: 0 },
  Treino:        { color: '#3B82F6', abbr: 'TRN', group: 1 },
  Exercicio:     { color: '#6366F1', abbr: 'EXC', group: 1 },
  RPE:           { color: '#F59E0B', abbr: 'RPE', group: 2 },
  FadigaScore:   { color: '#EF4444', abbr: 'FAD', group: 2 },
  PR:            { color: '#10B981', abbr: 'PR',  group: 3 },
  Nutricao:      { color: '#84CC16', abbr: 'NUT', group: 3 },
  Mesociclo:     { color: '#8B5CF6', abbr: 'MESO',group: 4 },
  Recomendacao:  { color: '#EC4899', abbr: 'REC', group: 4 },
  Alerta:        { color: '#F97316', abbr: 'ALT', group: 5 },
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
    trigger: d => d.diasSemTreino >= 2,
    message: d => `${d.diasSemTreino} dias sem treino. Streak em risco.`,
    action: 'Retomar treino hoje',
  },
];

const TE_SEV_COLOR = { high: '#EF4444', medium: '#F59E0B', low: '#6366F1' };

/* ── SVG ICONS ──────────────────────────────────────────── */
function teIcon(name, size = 16, color = 'currentColor') {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const icons = {
    'flame':        `<svg ${s}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    'trending-down':`<svg ${s}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
    'alert-circle': `<svg ${s}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2.5"/></svg>`,
    'bar-chart':    `<svg ${s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
    'repeat':       `<svg ${s}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    'check-circle': `<svg ${s}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    'alert-tri':    `<svg ${s}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2.5"/></svg>`,
  };
  return icons[name] || '';
}

/* ── COMPUTE ATHLETE DATA FROM LOCALSTORAGE ─────────────── */
function teComputeAthleteData() {
  const hist = (() => {
    try { return JSON.parse(localStorage.getItem('titanpro_history_v2') || '[]'); } catch { return []; }
  })();

  // Days since last workout
  let diasSemTreino = 99;
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
  const prKey = 'titanpro_prs';
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

/* ── OPEN / CLOSE ───────────────────────────────────────── */
function openTransformsScreen() {
  document.getElementById('transformsScreen').classList.add('show');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    teRenderGraph();
    teRenderLegend();
    teRenderCatalog();
    teRenderDefensiveList([]);
  });
}

function closeTransformsScreen() {
  document.getElementById('transformsScreen').classList.remove('show');
  document.body.style.overflow = '';
  if (_teSim) { _teSim.stop(); _teSim = null; }
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
function teRenderGraph() {
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

  node.append('circle')
    .attr('r', d => d.type === 'Usuario' ? 24 : 17)
    .attr('fill', d => (TE_ENTITIES[d.type]?.color || '#fff') + '22')
    .attr('stroke', d => d.type === _teActiveNode ? '#fff' : (TE_ENTITIES[d.type]?.color || '#fff'))
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

/* ── NODE SELECTION ─────────────────────────────────────── */
function teSelectNode(type) {
  _teActiveNode = _teActiveNode === type ? null : type;
  teRenderGraph();

  const detail = document.getElementById('transformsNodeDetail');
  if (!_teActiveNode) { detail.style.display = 'none'; return; }

  const cfg = TE_ENTITIES[_teActiveNode];
  const related = TE_TRANSFORMS.filter(t => t.from === _teActiveNode || t.to === _teActiveNode);

  detail.style.display = 'block';
  detail.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="width:36px;height:36px;border-radius:10px;background:${cfg.color}18;border:1px solid ${cfg.color}35;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="font-size:0.75rem;font-weight:800;color:${cfg.color}">${cfg.abbr}</span>
      </div>
      <div>
        <div style="font-size:0.95rem;font-weight:800">${_teActiveNode}</div>
        <div style="font-size:0.7rem;color:rgba(255,255,255,0.35)">Entidade selecionada</div>
      </div>
    </div>
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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
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
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="animation:spin .8s linear infinite"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Analisando...`;
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

  const highAlerts = found.filter(a => a.severity === 'high');
  if (highAlerts.length > 0 || found.length > 0) {
    addLog('Enviando análise para KRONOS...');
    await teCallKronos(found, athleteData);
  } else {
    addLog('Nenhum alerta detectado. Atleta em boa forma!');
  }

  _teScanning = false;
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Executar Scan`;
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

    const userMsg = alerts.length > 0
      ? `Alertas detectados no atleta: ${alertSummary}. Dados fisiológicos: fadiga=${athleteData.fadigaScore.toFixed(1)}, semSemPR=${athleteData.semSemPR}, varianciaRPE=${athleteData.rpeVariance.toFixed(1)}, regressaoCarga=${athleteData.cargaRegression.toFixed(1)}%, diasSemTreino=${athleteData.diasSemTreino}. Dê recomendações práticas em português, máximo 2 parágrafos.`
      : `O atleta está com dados saudáveis: fadiga=${athleteData.fadigaScore.toFixed(1)}, diasSemTreino=${athleteData.diasSemTreino}. Dê um feedback positivo e dica de manutenção, máximo 2 parágrafos.`;

    let headers = { 'Content-Type': 'application/json' };
    try { headers = await getAuthHeaders(); } catch {}

    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: userMsg }],
        system: 'Você é KRONOS, coach de alta performance do TITAN PRO. Analise os alertas defensivos do atleta e dê recomendações diretas e baseadas em evidências em português brasileiro. Seja objetivo e prático. Máximo 2 parágrafos.',
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
