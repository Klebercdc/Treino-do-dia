/* ═══════════════════════════════════════════════════════════
   KRONOS PULSE — Inteligência Viva do App
   O cérebro que observa, pensa e antecipa tudo que o usuário faz.
   Não espera ser chamado — reage, coordena e antecipa.
═══════════════════════════════════════════════════════════ */

const _pulse = {
  state:         null,
  lastComputed:  0,
  heartbeatId:   null,
  screenContext: null,  // tela aberta no momento
};

/* ── COMPUTAR ESTADO COMPLETO DO ATLETA ─────────────────── */
function pulseCompute() {
  try {
    const hist    = (typeof safeJSON === 'function' && typeof STORAGE !== 'undefined')
                    ? safeJSON(STORAGE.historyKey, []) : [];
    const cfg     = (typeof safeJSON === 'function') ? safeJSON('titanpro_config', {}) : {};
    const streak  = (typeof calcStreak === 'function') ? calcStreak() : 0;
    const entity  = (typeof teGetEntityState === 'function') ? teGetEntityState() : null;
    const now     = new Date();
    const hour    = now.getHours();
    const dow     = now.getDay(); // 0=dom, 1=seg...

    // Dias sem treinar
    let diasSemTreino = 99;
    if (hist.length > 0) {
      const last = hist[0]; // histórico já vem do mais recente
      if (last && last.createdAt) {
        diasSemTreino = Math.floor((Date.now() - new Date(last.createdAt)) / 86400000);
      }
    }

    // Treinou hoje?
    const treinouHoje = diasSemTreino === 0;

    // FadigaScore e alertas das entidades
    const fadigaScore   = entity?.athleteData?.fadigaScore   || 0;
    const semSemPR      = entity?.athleteData?.semSemPR      || 0;
    const rpeVariance   = entity?.athleteData?.rpeVariance   || 0;
    const cargaReg      = entity?.athleteData?.cargaRegression || 0;
    const alerts        = entity?.alerts || [];

    // Volume e RPE da última sessão
    const lastSess = hist[0] || null;
    const lastVol  = lastSess ? (() => {
      let v = 0;
      ((lastSess.state?.sections) || []).forEach(sec =>
        (sec.cards || []).forEach(card =>
          (card.values || []).forEach(val => {
            v += (parseFloat(val.kg) || 0) * (parseFloat(val.reps) || 0);
          })
        )
      );
      return Math.round(v);
    })() : 0;
    const lastRPEs = lastSess ? (() => {
      const r = [];
      ((lastSess.state?.sections) || []).forEach(sec =>
        (sec.cards || []).forEach(card =>
          (card.values || []).forEach(val => {
            const rpe = parseFloat(val.rpe);
            if (rpe > 0) r.push(rpe);
          })
        )
      );
      return r;
    })() : [];
    const lastRPEmed = lastRPEs.length ? lastRPEs.reduce((a, b) => a + b, 0) / lastRPEs.length : 0;

    // Readiness score (0–10)
    let readiness = 7;
    if (fadigaScore > 8.5)      readiness -= 4;
    else if (fadigaScore > 7)   readiness -= 2;
    else if (fadigaScore > 5.5) readiness -= 1;
    if (diasSemTreino >= 2 && diasSemTreino <= 4) readiness += 2;
    else if (diasSemTreino === 1) readiness += 1;
    else if (diasSemTreino >= 5) readiness -= 1;
    if (lastRPEmed >= 9 && diasSemTreino === 1) readiness -= 2;
    readiness = Math.max(0, Math.min(10, Math.round(readiness)));

    // Próximo treino sugerido
    const draft    = (typeof safeJSON === 'function') ? safeJSON('titanpro_draftv3', null) : null;
    const sections = draft?.sections || [];
    const nextIdx  = (typeof getNextTreinoIdx === 'function') ? getNextTreinoIdx() : 0;
    const nextSec  = sections[nextIdx];
    const nextKey  = nextSec?.treinoKey || 'A';

    const state = {
      hist, cfg, streak, hour, dow,
      diasSemTreino, treinouHoje,
      fadigaScore, semSemPR, rpeVariance, cargaReg, alerts,
      lastVol, lastRPEmed, readiness,
      nextKey,
      totalSessoes: hist.length,
      nome: cfg.nome || null,
    };

    state.insight = pulseGenerateInsight(state);

    _pulse.state = state;
    _pulse.lastComputed = Date.now();
    return state;
  } catch(e) {
    return null;
  }
}

/* ── GERAR INSIGHT CONTEXTUAL ───────────────────────────── */
function pulseGenerateInsight(s) {
  const { diasSemTreino, fadigaScore, streak, alerts, readiness,
          hour, lastRPEmed, lastVol, semSemPR, cargaReg,
          totalSessoes, treinouHoje, nextKey, dow } = s;

  // 1. OVERTRAINING CRÍTICO
  if (fadigaScore > 8.5) return {
    id: 'overtraining',
    icon: 'flame',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.3)',
    title: 'Fadiga crítica detectada',
    sub: `RPE médio ${fadigaScore.toFixed(1)}/10 — seu sistema nervoso central está sobrecarregado. Treinar hoje vai somar fadiga, não músculo. Descanse.`,
    action: null,
    urgency: 'critical',
  };

  // 2. PRIMEIRO TREINO — usuário novo
  if (totalSessoes === 0) return {
    id: 'welcome',
    icon: 'zap',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.3)',
    title: 'KRONOS online e pronto',
    sub: 'Comece seu primeiro treino. Cada dado que você registrar me alimenta — logo estarei analisando sua evolução em tempo real.',
    action: 'treino',
    actionLabel: 'Iniciar primeiro treino',
    urgency: 'low',
  };

  // 3. SEQUÊNCIA EM RISCO — treinou ontem ou antes, é tarde, ainda não treinou hoje
  if (streak > 0 && !treinouHoje && hour >= 17) return {
    id: 'streak_risk',
    icon: 'zap',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.3)',
    title: `${streak} dia${streak > 1 ? 's' : ''} seguidos em risco`,
    sub: hour >= 21
      ? `Menos de ${24 - hour}h para manter a sequência. Um treino rápido de 20 min resolve.`
      : `Você ainda não treinou hoje. Boa janela de treino agora.`,
    action: 'treino',
    actionLabel: 'Ir para o treino',
    urgency: 'high',
  };

  // 4. JANELA DE RECUPERAÇÃO COMPLETA — corpo pronto
  if (diasSemTreino >= 2 && diasSemTreino <= 4 && readiness >= 8 && fadigaScore < 6) return {
    id: 'peak_readiness',
    icon: 'battery-charging',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.3)',
    title: 'Corpo em janela ideal de treino',
    sub: `${diasSemTreino} dias descansado, fadiga baixa (${fadigaScore.toFixed(1)}/10). Hoje é o dia para puxar pesado — seu sistema nervoso está fresco.`,
    action: 'treino',
    actionLabel: `Iniciar Treino ${nextKey}`,
    urgency: 'high',
  };

  // 5. PLATÔ DETECTADO
  if (semSemPR >= 3 && alerts.some(a => a.id === 'plateau')) return {
    id: 'plateau',
    icon: 'trending-down',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.3)',
    title: `${semSemPR} semanas sem PR`,
    sub: 'Platô confirmado pelas entidades. Opções: intensidade acima do habitual, exercício variante, ou deload estratégico de 1 semana.',
    action: 'orientacao',
    actionLabel: 'Perguntar ao KRONOS',
    urgency: 'medium',
  };

  // 6. REGRESSÃO DE CARGA
  if (cargaReg < -7) return {
    id: 'load_regression',
    icon: 'alert-triangle',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
    title: `Cargas caindo ${Math.abs(Math.round(cargaReg))}%`,
    sub: 'Suas cargas estão regredindo. Sinais possíveis: déficit calórico excessivo, sono ruim ou volume acima do recuperável.',
    action: 'orientacao',
    actionLabel: 'Analisar com KRONOS',
    urgency: 'medium',
  };

  // 7. AFASTAMENTO PROLONGADO — mais de 5 dias sem treinar
  if (diasSemTreino >= 5) return {
    id: 'comeback',
    icon: 'rotate-ccw',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.3)',
    title: `${diasSemTreino} dias sem treinar`,
    sub: 'Retorno com volume 60–70% do habitual. Não tente recuperar o tempo perdido em uma sessão — risco de lesão é alto.',
    action: 'treino',
    actionLabel: 'Voltar com cautela',
    urgency: 'medium',
  };

  // 8. SESSÃO PESADA ONTEM — RPE alto, 1 dia de descanso
  if (diasSemTreino === 1 && lastRPEmed >= 8.5 && lastVol > 2000) return {
    id: 'recovery_needed',
    icon: 'moon',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.3)',
    title: 'Dia de recuperação ativa',
    sub: `Sessão de ontem foi pesada (RPE ${lastRPEmed.toFixed(1)}, ${lastVol}kg volume). Hoje: caminhada, mobilidade ou descanso — não força.`,
    action: null,
    urgency: 'low',
  };

  // 9. MANHÃ — motivação para o dia
  if (hour >= 5 && hour < 11 && !treinouHoje) return {
    id: 'morning',
    icon: 'sun',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.25)',
    title: streak > 0 ? `Dia ${streak + 1} começa agora` : 'Bom dia — treino te espera',
    sub: readiness >= 7
      ? `Readiness ${readiness}/10. Janela matinal: cortisol alto otimiza desempenho em força.`
      : `Readiness ${readiness}/10. Foque em técnica hoje — não em carga.`,
    action: 'treino',
    actionLabel: `Treino ${nextKey}`,
    urgency: readiness >= 7 ? 'medium' : 'low',
  };

  // 10. SEGUNDA-FEIRA — novo ciclo
  if (dow === 1 && !treinouHoje) return {
    id: 'monday',
    icon: 'calendar',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.25)',
    title: 'Nova semana, nova oportunidade',
    sub: `Semana começa agora. Readiness ${readiness}/10 — ${readiness >= 7 ? 'condição favorável para treino intenso.' : 'ajuste volume conforme disposição.'}`,
    action: 'treino',
    actionLabel: `Treino ${nextKey}`,
    urgency: 'medium',
  };

  // 11. JÁ TREINOU HOJE — parabéns e próximo passo
  if (treinouHoje) return {
    id: 'trained_today',
    icon: 'check-circle',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.25)',
    title: streak > 1 ? `${streak} dias seguidos` : 'Missão cumprida hoje',
    sub: lastVol > 0
      ? `${lastVol.toLocaleString('pt-BR')}kg de volume. Agora: ${lastRPEmed >= 8 ? 'priorize proteína e sono — sessão foi pesada.' : 'recuperação normal, até 2h para proteína pós-treino.'}`
      : 'Treino registrado. Foque em recuperação agora.',
    action: null,
    urgency: 'low',
  };

  // 12. PADRÃO — readiness
  return {
    id: 'default',
    icon: readiness >= 7 ? 'zap' : 'activity',
    color: readiness >= 7 ? '#f97316' : '#6366f1',
    bg: readiness >= 7 ? 'rgba(249,115,22,0.06)' : 'rgba(99,102,241,0.06)',
    border: readiness >= 7 ? 'rgba(249,115,22,0.25)' : 'rgba(99,102,241,0.25)',
    title: `Readiness ${readiness}/10`,
    sub: readiness >= 8
      ? 'Condição ótima. Priorize os exercícios compostos e progressão de carga hoje.'
      : readiness >= 6
      ? 'Condição moderada. Treine com controle — não force além do RPE 8.'
      : 'Condição baixa. Avalie se o treino hoje é produtivo ou contraproducente.',
    action: readiness >= 6 ? 'treino' : null,
    actionLabel: `Treino ${nextKey}`,
    urgency: readiness >= 8 ? 'medium' : 'low',
  };
}

/* ── RENDERIZAR CARD DE INSIGHT NA HOME ─────────────────── */
function renderPulseInsight() {
  const el = document.getElementById('pulseInsightCard');
  if (!el) return;

  const state = (_pulse.state && Date.now() - _pulse.lastComputed < 120000)
    ? _pulse.state
    : pulseCompute();

  if (!state || !state.insight) { el.style.display = 'none'; return; }

  const ins = state.insight;
  const urgencyDot = {
    critical: '<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;margin-right:6px;box-shadow:0 0 6px #ef4444"></span>',
    high:     '<span style="width:7px;height:7px;border-radius:50%;background:#f97316;display:inline-block;margin-right:6px;animation:pulse-dot 1.5s infinite"></span>',
    medium:   '<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;margin-right:6px"></span>',
    low:      '<span style="width:7px;height:7px;border-radius:50%;background:#6b7280;display:inline-block;margin-right:6px"></span>',
  }[ins.urgency] || '';

  const actionBtn = ins.action
    ? `<button onclick="pulseAction('${ins.action}')" class="pulse-action-btn" style="margin-top:12px;width:100%;padding:10px;background:${ins.color};border:none;border-radius:10px;color:#fff;font-family:var(--font);font-size:0.83rem;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent">
        ${ins.actionLabel || 'Ver'}
       </button>`
    : '';

  el.style.display = 'block';
  el.style.background = ins.bg;
  el.style.borderColor = ins.border;
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="width:36px;height:36px;border-radius:10px;background:${ins.bg};border:1px solid ${ins.border};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i data-lucide="${ins.icon}" style="color:${ins.color};width:18px;height:18px;stroke:${ins.color};stroke-width:1.75;fill:none"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;margin-bottom:3px">
          ${urgencyDot}
          <span style="font-size:0.78rem;font-weight:700;color:${ins.color};letter-spacing:.02em">${ins.title}</span>
        </div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,0.65);line-height:1.45">${ins.sub}</div>
        ${actionBtn}
      </div>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ── EXECUTAR AÇÃO DO INSIGHT ───────────────────────────── */
function pulseAction(target) {
  try {
    if (target === 'treino') {
      if (typeof navTo === 'function') navTo('treino');
      if (typeof closeHome === 'function') closeHome();
    } else if (target === 'orientacao') {
      if (typeof navTo === 'function') navTo('orientacao');
      if (typeof openOrientacao === 'function') openOrientacao();
    } else if (target === 'dieta') {
      if (typeof openDietaSheet === 'function') openDietaSheet();
    }
  } catch(e) {}
}

/* ── ANTECIPAÇÃO POR TELA ───────────────────────────────── */

// Abre tela de treino → mostra readiness toast
function pulseOnOpenTreino() {
  try {
    const s = pulseCompute();
    if (!s) return;
    if (s.fadigaScore > 8.5) {
      setTimeout(() => showToast('⚠ Fadiga crítica — considere reduzir volume hoje', 'warning', 5000), 600);
    } else if (s.readiness >= 9 && !s.treinouHoje) {
      setTimeout(() => showToast(`Readiness ${s.readiness}/10 — dia ideal para progressão de carga`, 'success', 4000), 600);
    }
  } catch(e) {}
}

// Abre dieta → injeta contexto de macro para o dia
function pulseOnOpenDieta() {
  try {
    const s = pulseCompute();
    if (!s || s.totalSessoes === 0) return;
    const el = document.getElementById('dietaContextPulse');
    if (!el) return;
    const isDiasTreino = !s.treinouHoje && s.diasSemTreino < 2;
    const msg = isDiasTreino
      ? 'Dia de treino: priorize carboidratos nas refeições pré e pós-treino.'
      : s.treinouHoje
      ? 'Pós-treino: janela anabólica ativa. Proteína + carbo nas próximas 2h.'
      : 'Dia de descanso: reduza carboidratos em 20–30%, mantenha proteína.';
    el.textContent = msg;
    el.style.display = 'block';
  } catch(e) {}
}

// Abre histórico → mostra tendência de volume (toast rápido)
function pulseOnOpenHistorico() {
  try {
    const s = _pulse.state || pulseCompute();
    if (!s || s.totalSessoes < 5) return;
    const entity = typeof teGetEntityState === 'function' ? teGetEntityState() : null;
    if (!entity) return;
    const d = entity.athleteData;
    if (d.cargaRegression < -7) {
      setTimeout(() => showToast(`Cargas caíram ${Math.abs(Math.round(d.cargaRegression))}% nas últimas sessões`, 'warning', 5000), 400);
    } else if (d.semSemPR >= 3) {
      setTimeout(() => showToast(`${d.semSemPR} semanas sem PR — hora de mudar o estímulo`, 'info', 5000), 400);
    }
  } catch(e) {}
}

// Abre perfil → mostra insight de persona
function pulseOnOpenPerfil() {
  try {
    const s = _pulse.state || pulseCompute();
    if (!s || s.totalSessoes < 3) return;
    const hist = s.hist;
    const d30  = hist.filter(h => (Date.now() - new Date(h.createdAt)) < 30 * 86400000).length;
    if (d30 >= 8) {
      setTimeout(() => showToast(`${d30} treinos em 30 dias — consistência de atleta`, 'success', 4000), 600);
    }
  } catch(e) {}
}

/* ── HOOK EM TEMPO REAL: SET REGISTRADO ─────────────────── */
// Chamado quando usuário registra uma série com RPE
function pulseOnSetLogged(rpe) {
  try {
    if (!rpe || rpe < 9.5) return;
    // RPE próximo à falha — avisa uma vez por sessão
    const key = 'pulse_rpe_warn_' + new Date().toDateString();
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    setTimeout(() => showToast('RPE 9.5+ detectado — cuide da técnica nas próximas séries', 'warning', 5000), 300);
  } catch(e) {}
}

/* ── HEARTBEAT — O PULSO DO SISTEMA ─────────────────────── */
function startKronosPulse() {
  // Compute imediatamente
  pulseCompute();

  // Renderiza home se estiver aberta
  const homeVisible = document.getElementById('homeScreen')?.classList.contains('show');
  if (homeVisible) renderPulseInsight();

  // Verifica cache das entidades — se expirado, roda scan silencioso
  const entityCache = typeof teGetEntityState === 'function' ? teGetEntityState() : null;
  if (!entityCache && typeof teSilentScan === 'function') {
    setTimeout(() => teSilentScan().then(() => {
      pulseCompute();
      if (document.getElementById('homeScreen')?.classList.contains('show')) renderPulseInsight();
    }).catch(() => {}), 500);
  }

  // Pulso a cada 90 segundos
  _pulse.heartbeatId = setInterval(() => {
    try {
      pulseCompute();
      if (document.getElementById('homeScreen')?.classList.contains('show')) {
        renderPulseInsight();
      }
      // Alerta de sequência em risco: 20h e ainda não treinou
      const s = _pulse.state;
      if (s && !s.treinouHoje && s.streak > 0 && new Date().getHours() === 20) {
        const key = 'pulse_streak_toast_' + new Date().toDateString();
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          showToast(`Sequência de ${s.streak} dia${s.streak > 1 ? 's' : ''} — você ainda não treinou hoje`, 'warning', 6000);
        }
      }
    } catch(e) {}
  }, 90000);
}
