/* ═══════════════════════════════════════════════════
   KRONIA MOTION GOVERNOR v2.0
═══════════════════════════════════════════════════ */
(function() {
  var lowEnd = false;

  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    lowEnd = true;
  }

  if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
    lowEnd = true;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    lowEnd = true;
  }

  window.__KRONIA_MOTION_LEVEL__ = lowEnd ? 'reduced' : 'full';

  if (lowEnd) {
    document.documentElement.classList.add('k-motion-reduced');
  }
})();

/* ═══════════════════════════════════════════════════
   MODAL CUSTOMIZADO
═══════════════════════════════════════════════════ */
window.KroniaUI = window.KroniaUI || {};
window.KroniaUI.unblockScreens = function(reason) {
  const protectedIds = [
    'kroniaDietPlanVisualScreen',
    'trainingScreen',
    'treinoScreen',
    'mainScreen',
    'homeScreen',
    'perfilScreen'
  ];
  const allowedOpenIds = new Set(protectedIds);

  document.documentElement.style.pointerEvents = 'auto';
  document.body.style.pointerEvents = 'auto';
  document.body.classList.add('kronia-ui-unblocked');

  const overlaySelector = [
    '#customModal', '#timerSheet', '#configSheet', '#loginScreen', '#onboarding', '#kronaSetup',
    '#paywallModal', '#legalModal', '#modalBackdrop', '#bottomSheet',
    '#exerciseDiscSheet', '#guiaModal', '#breathingModal', '#evoModal', '#summaryModal',
    '#settingsScreen', '#perfilScreen', '#orientacaoScreen', '#labsScreen',
    '#nutritionFlowScreen', '#dietChoiceScreen',
    '.modal', '.sheet', '.overlay', '.bottom-sheet', '[data-overlay]'
  ].join(',');

  document.querySelectorAll(overlaySelector).forEach(function(el) {
    if (!el || allowedOpenIds.has(el.id)) return;

    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const zIndex = Number.parseInt(style.zIndex, 10) || 0;
    const coversScreen =
      rect.width >= window.innerWidth * 0.75 &&
      rect.height >= window.innerHeight * 0.55;
    const isFixed = style.position === 'fixed';
    const isHigh = zIndex >= 900;
    const isInvisible =
      style.opacity === '0' ||
      style.visibility === 'hidden' ||
      style.display === 'none' ||
      el.getAttribute('aria-hidden') === 'true';
    const isOpen = el.classList.contains('show') || el.classList.contains('active') || el.classList.contains('open');
    const isSuspicious = isFixed && isHigh && coversScreen && !allowedOpenIds.has(el.id);
    const isAggressiveRouteCleanup = /before-training|after-nav-treino|before-diet/.test(String(reason || ''))
      && el.id !== 'configSheet'
      && el.id !== 'timerSheet'
      && el.id !== 'customModal'
      && el.id !== 'dietDataScreen'
      && el.id !== 'dietChoiceScreen'
      && el.id !== 'exerciseDiscSheet'
      && el.id !== 'evoModal'
      && el.id !== 'summaryModal'
      && el.id !== 'breathingModal';

    if ((isSuspicious && !isOpen) || isInvisible || (isSuspicious && isAggressiveRouteCleanup)) {
      el.classList.remove('show', 'active', 'open');
      el.style.pointerEvents = 'none';
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.setAttribute('aria-hidden', 'true');
      console.info('[KroniaUI] overlay desbloqueado:', {
        reason: reason || 'unspecified',
        id: el.id,
        className: el.className
      });
    }
  });
};

function scheduleKroniaUIUnblock(reason) {
  if (!window.KroniaUI || typeof window.KroniaUI.unblockScreens !== 'function') return;
  window.KroniaUI.unblockScreens(reason);
  setTimeout(function() { window.KroniaUI.unblockScreens(reason + ':0ms'); }, 0);
  setTimeout(function() { window.KroniaUI.unblockScreens(reason + ':150ms'); }, 150);
  setTimeout(function() { window.KroniaUI.unblockScreens(reason + ':500ms'); }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    scheduleKroniaUIUnblock('domcontentloaded');
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        document.documentElement.classList.add('k-app-paused');
      } else {
        document.documentElement.classList.remove('k-app-paused');
      }
    });
  }, { once: true });
} else {
  scheduleKroniaUIUnblock('boot');
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      document.documentElement.classList.add('k-app-paused');
    } else {
      document.documentElement.classList.remove('k-app-paused');
    }
  });
}

/* ═══════════════════════════════════════════════════
   SKELETON LOADERS — Kronia Motion v2.0
═══════════════════════════════════════════════════ */
function showSkeletons(container, count, height) {
  if (!container) return;
  count = count || 3;
  height = height || '72px';
  container.innerHTML = '';
  for (var i = 0; i < count; i++) {
    var el = document.createElement('div');
    el.className = 'k-skeleton k-motion-background';
    el.style.cssText = 'height: ' + height + '; margin-bottom: 12px;';
    container.appendChild(el);
  }
}

function hideSkeletons(container) {
  if (!container) return;
  container.innerHTML = '';
}

function _showEl(id) {
  var el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  el.style.display = '';
  el.style.visibility = '';
  el.style.opacity = '';
  el.style.pointerEvents = '';
  el.removeAttribute('aria-hidden');
  el.classList.add('show');
}

function closeCustomModalElement(modal) {
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  modal.style.pointerEvents = "none";
  scheduleKroniaUIUnblock('custom-modal-close');
}

function _showModal(msg, withInput, inputPlaceholder) {
  return new Promise((resolve) => {
    const modal   = document.getElementById("customModal");
    const msgEl   = document.getElementById("cmMsg");
    const inputEl = document.getElementById("cmInput");
    const okBtn   = document.getElementById("cmOk");
    const noBtn   = document.getElementById("cmNo");
    msgEl.textContent = msg;
    if (withInput) {
      inputEl.type        = inputPlaceholder === "number" ? "number" : "text";
      inputEl.placeholder = inputPlaceholder === "number" ? "0" : (inputPlaceholder || "");
      inputEl.value       = "";
      inputEl.style.display = "block";
      setTimeout(() => inputEl.focus(), 80);
    } else {
      inputEl.style.display = "none";
    }
    modal.style.display = "";
    modal.style.visibility = "";
    modal.style.pointerEvents = "auto";
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("show");
    function done(ok) {
      closeCustomModalElement(modal);
      okBtn.removeEventListener("click", onOk);
      noBtn.removeEventListener("click", onNo);
      if (!ok) { resolve(null); return; }
      resolve(withInput ? inputEl.value.trim() : true);
    }
    function onOk() { done(true);  }
    function onNo() { done(false); }
    okBtn.addEventListener("click", onOk);
    noBtn.addEventListener("click", onNo);
  });
}
async function dlgConfirm(msg)             { return await _showModal(msg, false, null); }
async function dlgAlert(msg)               { return await _showModal(msg, false, "OK"); }
async function dlgPrompt(msg, placeholder) { return await _showModal(msg, true, placeholder || ""); }

/* ═══════════════════════════════════════════════════
   DADOS & CONSTANTES
═══════════════════════════════════════════════════ */
const TREINOS_PRONTOS = {
  "2": [
    { nome: "A (Full Body - Foco Agacho)", exs: ["Agachamento Livre","Supino Reto","Remada Curvada","Desenvolvimento Militar","Panturrilha em Pé"] },
    { nome: "B (Full Body - Foco Terra)",  exs: ["Levantamento Terra","Leg Press 45","Puxada Alta","Supino Inclinado","Rosca Direta"] },
  ],
  "3": [
    { nome: "A (Push: Peito/Ombro/Tri)",   exs: ["Supino Reto","Supino Inclinado","Desenvolvimento Militar","Elevação Lateral","Tríceps Corda","Tríceps Testa"] },
    { nome: "B (Pull: Costas/Bíceps)",      exs: ["Puxada Alta","Remada Curvada","Remada Baixa","Crucifixo Inverso","Rosca Direta","Rosca Martelo"] },
    { nome: "C (Legs: Pernas)",             exs: ["Agachamento Livre","Leg Press 45","Cadeira Extensora","Mesa Flexora","Stiff","Panturrilha Sentado"] },
  ],
  "4": [
    { nome: "A (Upper Força)",        exs: ["Supino Reto","Remada Curvada","Desenvolvimento","Barra Fixa (ou Graviton)"] },
    { nome: "B (Lower Força)",        exs: ["Agachamento Livre","Leg Press 45","Extensora","Panturrilha em Pé"] },
    { nome: "C (Upper Hipertrofia)",  exs: ["Supino Inclinado","Puxada Alta","Elevação Lateral","Voador","Rosca Direta","Tríceps Corda"] },
    { nome: "D (Lower Posterior)",    exs: ["Levantamento Terra","Mesa Flexora","Passada","Panturrilha Sentado"] },
  ],
  "5": [
    { nome: "A (Peito)",   exs: ["Supino Reto","Supino Inclinado","Crucifixo Máquina","Crossover","Flexão de Braço"] },
    { nome: "B (Costas)",  exs: ["Puxada Alta","Remada Curvada","Remada Serrote","Pulldown","Hiperextensão Lombar"] },
    { nome: "C (Pernas)",  exs: ["Agachamento","Leg Press","Extensora","Mesa Flexora","Stiff","Panturrilha"] },
    { nome: "D (Ombros)",  exs: ["Desenvolvimento","Elevação Lateral","Elevação Frontal","Crucifixo Inverso","Encolhimento"] },
    { nome: "E (Braços)",  exs: ["Rosca Direta","Tríceps Testa","Rosca Scott","Tríceps Corda","Rosca Punho"] },
  ],
  "6": [
    { nome: "A (Push 1)", exs: ["Supino Reto","Desenvolvimento","Tríceps Testa","Elevação Lateral"] },
    { nome: "B (Pull 1)", exs: ["Puxada Alta","Remada Curvada","Rosca Direta","Face Pull"] },
    { nome: "C (Legs 1)", exs: ["Agachamento","Extensora","Panturrilha em Pé"] },
    { nome: "D (Push 2)", exs: ["Supino Inclinado","Crossover","Tríceps Corda","Elevação Lateral"] },
    { nome: "E (Pull 2)", exs: ["Remada Baixa","Puxada Triângulo","Rosca Martelo","Crucifixo Inverso"] },
    { nome: "F (Legs 2)", exs: ["Levantamento Terra","Leg Press","Mesa Flexora","Panturrilha Sentado"] },
  ],
};
// Migração única: copia chaves legacy → kronia_* (roda só uma vez graças ao guard)
(function() {
  if (localStorage.getItem('_kronia_migrated')) return;
  [['kronia_','draft_v2'],['kronia_','history_v2'],['kronia_','prev_v1'],
   ['kronia_','config'],['kronia_','prs'],['kronia_','mesociclo'],
   ['kronia_','calc_prefs'],['kronia_','draftv3'],
   ['titan_','light'],['titan_','onboarded'],['titan_','unidade'],['titan_','plan']
  ].forEach(([prefix, k]) => {
    const from = prefix + k, to = 'kronia_' + k;
    const val = localStorage.getItem(from);
    if (val !== null && localStorage.getItem(to) === null) localStorage.setItem(to, val);
  });
  localStorage.setItem('_kronia_migrated', '1');
})();

const STORAGE = Object.freeze({
  draftKey:   "kronia_draft_v2",
  historyKey: "kronia_history_v2",
  prevKey:    "kronia_prev_v1",
  exerciseDetailsCacheKey: "kronia_exercise_details_cache_v2",
  maxHistory: 80, maxTemplates: 20,
});
var KRONIA_PENDING_INTENT_KEY = 'kronia_pending_conversation_intent_v1';
var KRONIA_PENDING_INTENT_TTL_MS = 8 * 60 * 1000;
var __kroniaPendingIntentConsumeScheduled = false;
const divisoesGen = { "2":["A","B"],"3":["A","B","C"],"4":["A","B","C","D"],"5":["A","B","C","D","E"],"6":["A","B","C","D","E","F"] };
const biblioteca = {
  Peito:   ["Supino Inclinado","Supino Reto","Crossover","Voador","Flexão"],
  Costas:  ["Puxada Alta","Remada Curvada","Remada Baixa","Terra","Pulldown"],
  Pernas:  ["Agachamento","Leg Press 45","Extensora","Flexora","Stiff","Panturrilha"],
  Ombros:  ["Desenvolvimento","Elevação Lateral","Crucifixo Inverso","Encolhimento"],
  Braços:  ["Rosca Direta","Tríceps Corda","Rosca Martelo","Tríceps Testa","Rosca Scott"],
};

/* ═══════════════════════════════════════════════════
   TIMER — REDESENHADO
═══════════════════════════════════════════════════ */
// ── TIMER BANNER ──────────────────────────────────────────────────────
let timeLeft = 120, baseTime = 120, timerInt = null, isRunning = false;
let audioCtx = null;
const TB_CIRC = 2 * Math.PI * 22; // r=22 no mini arco

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playBeep() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; gain.gain.value = 0.15;
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch(_) {}
}

function abrirTimer() {
  // No modo guiado: mostra o card de descanso inline em vez do bottom sheet
  if (window._ge && window._ge.active) {
    document.getElementById("geRestCard")?.classList.add("active");
    return;
  }
  try { getAudioCtx().resume(); } catch(_) {}
  const bar = document.getElementById("timerSheet");
  if (!bar) return;
  bar.classList.remove("show");
  void bar.offsetHeight; // forçar reflow iOS
  bar.classList.add("show");
}
function atualizarBtnConfirm(input) {
  const row = input.closest(".series-grid");
  if (!row) return;
  const inputs = row.querySelectorAll("input");
  const temDado = Array.from(inputs).some(i => i.value.trim() !== "");
  row.classList.toggle("has-data", temDado);
  if (!temDado) row.classList.remove("done");
}

function mostrarDicaTimer(msg) {
  const el = document.getElementById("timerDica");
  if (el) el.textContent = msg || "";
}


function fecharTimer() {
  document.getElementById("timerSheet")?.classList.remove("show");
  if (window._ge && window._ge.active) document.getElementById("geRestCard")?.classList.remove("active");
  clearInterval(timerInt); isRunning = false;
  timeLeft = baseTime; updateT();
  scheduleKroniaUIUnblock('timer-close');
}

function ajustarTimer(delta) {
  // +15s ou -15s enquanto roda
  const novo = Math.max(5, Math.min(600, timeLeft + delta));
  timeLeft = novo;
  if (delta > 0 && novo > baseTime) baseTime = novo;
  updateT();
}

function setT(s, btn) {
  clearInterval(timerInt); isRunning = false;
  timeLeft = baseTime = s;
  updateT();
  document.querySelectorAll(".btn-t").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.getElementById("tbPresets")?.classList.remove("open");
  // Auto-iniciar ao trocar preset
  isRunning = true; updateT();
  timerInt = setInterval(tickT, 1000);
}

function tickT() {
  if (timeLeft > 0) {
    timeLeft--;
    updateT();
  } else {
    clearInterval(timerInt); isRunning = false;
    playBeep();
    setTimeout(playBeep, 500);
    setTimeout(playBeep, 1000);
    if (navigator.vibrate) navigator.vibrate([150, 60, 150, 60, 300]);
    updateT();
    // Auto-fechar bar após 5s
    setTimeout(() => {
      if (!isRunning) fecharTimer();
    }, 5000);
    // No modo guiado: avançar para próxima série após o timer
    if (window._ge && window._ge.active) {
      setTimeout(() => { if (window._ge.active) geAdvanceAfterRest(); }, 5500);
    }
  }
}

function updateT() {
  const m    = Math.floor(timeLeft / 60);
  const s    = timeLeft % 60;
  const txt  = m + ":" + (s < 10 ? "0" : "") + s;
  const pct  = baseTime > 0 ? (timeLeft / baseTime) : 1;
  const done = timeLeft === 0;

  const playIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  const pauseIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  const doneIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polyline points="20 6 9 17 4 12"/></svg>';
  const btnIcon = isRunning ? pauseIcon : done ? doneIcon : playIcon;
  const btnCls = "tb-ctrl" + (isRunning ? " pausing" : done ? " done" : "");

  // Display principal (timerSheet)
  const el = document.getElementById("timerDisplay");
  if (el) { el.textContent = txt; el.className = done ? "done" : ""; }

  // Display inline (timerArea)
  const elI = document.getElementById("timerDisplayInline");
  if (elI) { elI.textContent = txt; elI.className = done ? "done" : ""; }

  // Barra de progresso (timerSheet)
  const bar = document.getElementById("tbProgressBar");
  if (bar) { bar.style.width = (pct * 100) + "%"; bar.className = done ? "done" : ""; }

  // Barra de progresso inline (timerArea)
  const barI = document.getElementById("timerProgressBarInline");
  if (barI) { barI.style.width = (pct * 100) + "%"; barI.className = done ? "done" : ""; }

  // Timer bar cor (timerSheet)
  const bar2 = document.getElementById("timerSheet");
  if (bar2 && bar2.classList.contains("show"))
    bar2.className = "show" + (done ? " done" : "");

  // Botão play/pause (timerSheet)
  const btn = document.getElementById("ctrlBtn");
  if (btn) { btn.className = btnCls; btn.innerHTML = btnIcon; }

  // Botão play/pause inline (timerArea)
  const btnI = document.getElementById("ctrlBtnInline");
  if (btnI) { btnI.className = btnCls; btnI.innerHTML = btnIcon; }

  // Display execução guiada
  const elGE = document.getElementById("geTimerDisplay");
  if (elGE) { elGE.textContent = txt; elGE.className = done ? "done" : ""; }
  const barGE = document.getElementById("geTimerProgressBar");
  if (barGE) { barGE.style.width = (pct * 100) + "%"; barGE.className = done ? "done" : ""; }
}

function toggleT() {
  try { getAudioCtx().resume(); } catch(_) {}
  if (isRunning) {
    clearInterval(timerInt); isRunning = false; updateT();
  } else {
    if (timeLeft === 0) timeLeft = baseTime;
    isRunning = true; updateT();
    timerInt = setInterval(tickT, 1000);
  }
}

function resetT() {
  clearInterval(timerInt); isRunning = false;
  timeLeft = baseTime; updateT();
}

/* ═══════════════════════════════════════════════════
   ESTADO & HELPERS
═══════════════════════════════════════════════════ */
let currentExId = null, isAddingNew = false, prevMap = Object.create(null);
let _histSessions = [];

function escapeAttr(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/"/g,"&quot;"); }
function escapeHTML(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function toNum(x) { const n = parseFloat(String(x ?? "").replace(",",".")); return Number.isFinite(n) ? n : 0; }
function calcRM(kg, reps) { const K=toNum(kg),R=toNum(reps); if(!K||!R) return 0; return K*(1+R/30); }
function roundRM(x) { const n=toNum(x); if(!n) return 0; return Math.round(n); }
function prevKeyOf(tk, exName) { return `${String(tk||"").trim()}||${String(exName||"").trim()}`.toLowerCase(); }

function rebuildPrevMapFromLatestHistory() {
  const hist = safeJSON(STORAGE.historyKey, []);
  if (!Array.isArray(hist) || !hist.length) return Object.create(null);
  const latest = hist[0]?.state;
  if (!latest?.sections) return Object.create(null);
  const map = Object.create(null);
  latest.sections.forEach(sec => {
    const treinoKey = sec.treinoKey || sec?.key;
    (sec.cards || []).forEach(c => {
      const k = prevKeyOf(treinoKey, c?.name || "");
      map[k] = (c.values || []).map(v => ({ kg: v?.kg??"", reps: v?.reps??"", rpe: v?.rpe??"", rm: v?.rm??(v?.kg&&v?.reps ? roundRM(calcRM(v.kg,v.reps)) : "") }));
    });
  });
  return map;
}

function safeJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); if (!raw) return fallback; return JSON.parse(raw); } catch { return fallback; }
}

function savePrevSnapshotFromState(state) {
  try { localStorage.setItem(STORAGE.prevKey, JSON.stringify({ savedAt: new Date().toISOString(), state })); } catch {}
}

function getPrevMap() {
  const snap = safeJSON(STORAGE.prevKey, null);
  if (snap?.state?.sections) {
    const map = Object.create(null);
    snap.state.sections.forEach(sec => {
      const treinoKey = sec.treinoKey || sec?.key;
      (sec.cards || []).forEach(c => {
        const k = prevKeyOf(treinoKey, c?.name || "");
        map[k] = (c.values || []).map(v => ({ kg: v?.kg??"", reps: v?.reps??"", rpe: v?.rpe??"", rm: v?.rm??(v?.kg&&v?.reps ? roundRM(calcRM(v.kg,v.reps)) : "") }));
      });
    });
    return map;
  }
  return rebuildPrevMapFromLatestHistory();
}

/* ═══════════════════════════════════════════════════
   GERAR PROTOCOLO
═══════════════════════════════════════════════════ */
async function gerarProtocolo(silent) {
  const input = collectWorkoutGenerationInput();
  const objective = input.objetivo;
  const guard = await validateScientificGenerationGuard(
    'workout',
    objective,
    input,
    { respectedCardContext: true, respectedAnamnesisContext: false }
  );
  if (!guard.ok) {
    if (!silent) dlgAlert('Não consegui gerar treino com segurança para este cenário. Revise os dados e tente novamente.');
    gerarTreinoDoPrograma(silent);
    return;
  }

  const workoutPayload = buildWorkoutRequestPayloadFromInput(input, guard);

  try {
    const resp = await requestWorkoutRoute(workoutPayload, 12000);
    const data = await parseWorkoutApiJsonSafely(resp);

    // parseWorkoutApiJsonSafely retorna {error:"INVALID_JSON"} quando a resposta
    // não é JSON válido (ex: HTML de erro do servidor). Nesse caso usa geração local.
    if (data && data.error === 'INVALID_JSON') {
      console.warn('[gerarProtocolo] resposta não-JSON da rota de treino, usando geração local como fallback');
      gerarTreinoDoPrograma(silent);
      return;
    }

    const renderModel = extractWorkoutRenderModel(data);

    if (!resp.ok) {
      // Erro HTTP real (401/402/429/5xx) — usa geração local como fallback
      console.warn('[gerarProtocolo] HTTP', resp.status, '— usando geração local como fallback');
      if (!silent) dlgAlert(resolveWorkoutRouteFailureMessage(data, resp.status));
      gerarTreinoDoPrograma(silent);
      return;
    }

    if (!renderModel || !renderModel.plan || !Array.isArray(renderModel.plan.treinos)) {
      console.warn('[gerarProtocolo] payload de treino inválido para renderização', renderModel);
      if (!silent) renderWorkoutError('Erro ao montar treino');
      return;
    }

    if (renderModel.failSafe || renderModel.plan.treinos.length === 0) {
      console.info('[gerarProtocolo] treino vazio ou failsafe recebido da API', renderModel);
      if (!silent) renderWorkoutError(renderModel.plan.treinos.length === 0 ? 'Nenhum treino gerado' : 'Erro ao montar treino');
      return;
    }

    if (!Array.isArray(renderModel.plan.treinos) || renderModel.plan.treinos.length === 0) {
      console.warn('[gerarProtocolo] treinos vazio com failSafe:false, usando geração local como fallback');
      gerarTreinoDoPrograma(silent);
      return;
    }

    console.info('[workout-builder-result]', {
      flowState: renderModel.plan.flow_state,
      failSafe: renderModel.plan.failSafe,
      treinos: renderModel.plan.treinos.length
    });

    applyAIWorkout({
      treino: {
        grupos: renderModel.plan.treinos.map(function(treino) {
          return {
            nome: String(treino.nome || ''),
            exercicios: Array.isArray(treino.exercicios) ? treino.exercicios : [],
          };
        }),
      }
    });

    writeAuditTracePatch({
      generation: buildGenerationEnvelope({
        type: "workout",
        sourceOfTruth: guard.generationTrace?.sourceOfTruth || "supabase_scientific_evidence",
        usedScientificEvidence: guard.generationTrace?.usedScientificEvidence,
        scienceTopicsUsed: guard.generationTrace?.scienceTopicsUsed || [],
        evidenceCount: guard.generationTrace?.evidenceCount || 0,
        validationStatus: "generated",
        blockedReason: null,
        constraintsUsed: guard.generationTrace?.constraintsUsed || {},
        userInputsUsed: workoutPayload,
        respectedCardContext: true,
        respectedAnamnesisContext: false,
        usedFallback: false,
      }),
    });
  } catch (error) {
    // Erro de rede / timeout — fallback local
    console.warn('[gerarProtocolo] erro na rota de treino, usando geração local como fallback', error);
    gerarTreinoDoPrograma(silent);
  }
}

/* ═══════════════════════════════════════════════════
   CARDS DE EXERCÍCIO
═══════════════════════════════════════════════════ */
function criarCard(nome, sectionId, series=null, reps=null, rpe=null, values=null, cardIndex=0, exerciseRefInput=null) {
  const displayTitle = getExerciseCardTitle({ display_name: nome, name: nome }, cardIndex);
  const o = document.getElementById("obj")?.value || "hipertrofia";
  const meta = reps || (o==="forca" ? "3-5 Reps" : o==="hipertrofia" ? "8-12 Reps" : "15-20 Reps");
  const sets = series || (o==="forca" ? 5 : o==="definicao" ? 3 : 4);
  const id   = "ex-" + Math.random().toString(36).slice(2,9);
  const sec  = document.getElementById(sectionId);
  const treinoKey = sec?.getAttribute("data-treino-key") || "";
  const pKey = prevKeyOf(treinoKey, displayTitle);
  const prev = prevMap[pKey] || null;
  const card = document.createElement("div");
  const exerciseRef = ensureExerciseRef(
    { ...(exerciseRefInput || {}), display_name: displayTitle, name: displayTitle },
    displayTitle,
    (exerciseRefInput && exerciseRefInput.source) || "card_build",
  );
  card.className = "exercise-card";
  card.setAttribute("data-ex-id", id);
  card.setAttribute("data-ex-name", displayTitle);
  card.setAttribute("data-ex-lookup-key", exerciseRef.normalized_lookup_key || normalizeExerciseLookupKey(displayTitle));
  card.setAttribute("data-ex-ref", JSON.stringify(exerciseRef));
  card.setAttribute("data-ex-sets", String(sets));
  card.setAttribute("data-ex-meta", meta);
  const rows = Array.from({length: sets}, (_, s) => {
    const cur = values && values[s] ? values[s] : null;
    const kgVal   = cur ? cur.kg   ?? "" : "";
    const repsVal = cur ? cur.reps ?? "" : "";
    const rpeVal  = cur ? cur.rpe  ?? "" : "";
    const rmNow   = cur?.rm ?? (cur?.kg && cur?.reps ? roundRM(calcRM(cur.kg, cur.reps)) : 0);
    const isDone = cur?.done === true || cur?.completed === true || cur?.isDone === true;
    return `<div class="series-grid${(kgVal||repsVal||rpeVal)?' has-data':''}${isDone?' done':''}" data-row="1">
      <span class="setcell" onclick="onPressSetCell(this)">
        <span class="slabel">S${s+1}</span>
        <span class="rmmini" id="rm-${id}-${s}">RM: ${escapeHTML(rmNow ? rmNow+"kg" : "-")}</span>
      </span>
      <div class="input-box"><input type="number" inputmode="decimal" min="0" step="0.5" placeholder="" value="${escapeAttr(kgVal)}"  oninput="updateSuggests('${id}');atualizarBtnConfirm(this)"></div>
      <div class="input-box"><input type="number" inputmode="numeric" min="0" step="1" placeholder="" value="${escapeAttr(repsVal)}" oninput="updateSuggests('${id}');atualizarBtnConfirm(this)"></div>
      <div class="input-box"><input type="number" inputmode="decimal" min="0" max="10" step="0.5" placeholder="" value="${escapeAttr(rpeVal)}"  oninput="updateSuggests('${id}');checkRPEAlert(this);atualizarBtnConfirm(this)"></div>
      <button class="btn-confirm" onclick="onPressSetCell(this.closest('.series-grid').querySelector('.setcell'))" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
    <div class="row-suggest" id="sug-${id}-${s}"></div>`;
  }).join("");
  card.innerHTML = `
    <div class="card-header">
      <span class="ex-title" id="${id}" onclick="abrirLibParaTrocar('${id}')">${escapeHTML(displayTitle)}</span>
      <button onclick="openExerciseOnYouTube(this.closest('.exercise-card'))" title="Ver exercício" style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.2);border-radius:8px;padding:4px 8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;color:var(--accent);font-family:var(--font);font-size:0.68rem;font-weight:700;-webkit-tap-highlight-color:transparent;flex-shrink:0" type="button">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
        VER
      </button>
      <button class="btn-superset" onclick="toggleSuperset(this.closest('.exercise-card'))" title="Superset" type="button">SS</button>
      <button class="btn-voz" onclick="iniciarLogVoz(this)" title="Log por voz" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
      </button>
      <span class="card-rm-badge" id="1rm-${id}"></span>
    </div>
    <span class="ex-target">${sets} sets · ${escapeHTML(meta)}</span>
    <div class="card-load-suggest" style="display:none;font-size:0.72rem;color:var(--accent);padding:0 12px 8px;opacity:.85"></div>
    <div class="series-grid header-grid" style="margin-top:8px"><span></span><span>KG</span><span>REPS</span><span>RPE</span><span></span></div>
    ${rows}
    <button class="btn-add-set" onclick="adicionarSerie(this)" style="width:100%;padding:8px;margin-top:6px;background:transparent;border:1px dashed var(--border);border-radius:var(--r-sm);color:var(--muted);font-family:var(--font);font-size:0.75rem;font-weight:600;cursor:pointer;transition:all .15s;">+ Série</button>`;
  sec.appendChild(card);
  attachAutosaveToCard(card);
  bindCardLongPress(card);
  scheduleDraftSave();
  applyPrevGhostsToCard(card);
  updateSuggests(id);
  return card;
}

async function confirmDeleteExercise(card) {
  try {
    const nome = card.querySelector(".ex-title")?.textContent || "Exercício";
    if (await dlgConfirm(`Apagar exercício "${nome}"?`)) {
      card.remove(); scheduleDraftSave();
    } else { card.classList.remove("deleting"); }
  } catch {}
}

function bindCardLongPress(card) {
  const title = card.querySelector(".ex-title");
  if (!title) return;
  const LONG_MS = 1100;
  let touchStartTime = 0, startX = 0, startY = 0, visualTimer = null, suppressClick = false, moved = false;
  title.addEventListener("touchstart", (e) => {
    touchStartTime = Date.now(); suppressClick = false; moved = false;
    const t = e.touches[0]; startX = t.clientX; startY = t.clientY;
    visualTimer = setTimeout(() => { if (!moved) card.classList.add("deleting"); }, LONG_MS);
  }, { passive: true });
  title.addEventListener("touchend", async () => {
    clearTimeout(visualTimer);
    const elapsed = Date.now() - touchStartTime;
    card.classList.remove("deleting");
    if (elapsed >= LONG_MS && !moved) {
      suppressClick = true;
      const nome = card.querySelector(".ex-title")?.textContent || "Exercício";
      if (await dlgConfirm(`Apagar "${nome}"?`)) { card.remove(); scheduleDraftSave(); }
    }
  }, { passive: true });
  title.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX-startX)>8 || Math.abs(t.clientY-startY)>8) {
      moved = true; clearTimeout(visualTimer); touchStartTime = 0;
      card.classList.remove("deleting");
    }
  }, { passive: true });
  title.addEventListener("touchcancel", () => {
    clearTimeout(visualTimer); touchStartTime = 0; moved = true;
    card.classList.remove("deleting");
  }, { passive: true });
  title.addEventListener("click", (e) => {
    if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; }
  }, true);
  title.addEventListener("contextmenu", (e) => { e.preventDefault(); confirmDeleteExercise(card); });
}

async function onPressSetCell(el) {
  try {
    const row = el.closest(".series-grid");
    if (!row) return;
    const inputs = row.querySelectorAll("input");
    if (inputs.length !== 3) return;
    const hasAny = Array.from(inputs).some(i => String(i.value||"").trim().length);

    // Se tem dados: toggle done / confirmar apagar
    if (hasAny) {
      if (row.classList.contains("done")) {
        // já concluída: perguntar se quer apagar
        if (await dlgConfirm("Apagar esta série (KG/REPS/RPE)?")) {
          inputs.forEach(i => i.value = "");
          row.classList.remove("done");
          const card = row.closest(".exercise-card");
          if (card) updateSuggests(card.getAttribute("data-ex-id"));
          scheduleDraftSave(); updateSessionStrip();
        }
      } else {
        // Marcar como concluída
        row.classList.add("done");
        updateSessionStrip(); scheduleDraftSave();
        if (navigator.vibrate) navigator.vibrate(40);
        // Timer inteligente — tempo baseado no RPE da série
        const rpeInput = row.querySelectorAll("input")[2];
        const rpeVal = parseFloat(rpeInput?.value || 0);
        let tempoInteligente;
        if      (rpeVal >= 10)  tempoInteligente = 240; // RPE 10 → 4 min
        else if (rpeVal >= 9)   tempoInteligente = 180; // RPE 9  → 3 min
        else if (rpeVal >= 8)   tempoInteligente = 120; // RPE 8  → 2 min
        else if (rpeVal >= 7)   tempoInteligente = 90;  // RPE 7  → 1:30
        else if (rpeVal >= 1)   tempoInteligente = 60;  // RPE 1-6 → 1 min
        else                    tempoInteligente = 120; // sem RPE → 2 min

        // Atualizar preset ativo visualmente
        clearInterval(timerInt);
        isRunning = false;
        timeLeft = baseTime = tempoInteligente;
        document.querySelectorAll(".btn-t").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".btn-t").forEach(b => {
          if (parseInt(b.getAttribute("onclick")?.match(/\d+/)?.[0]) === tempoInteligente)
            b.classList.add("active");
        });

        // Mostrar label inteligente
        const lbl = document.querySelector(".tsheet-label");
        if (lbl) {
          const msg = rpeVal >= 9 ? `Esforço alto — descanse bem ${_ico('dumbbell', 16)}`
                    : rpeVal >= 7 ? `Bom esforço — recuperando ${_ico('flame', 16)}`
                    : rpeVal >= 1 ? `Série leve — descanse pouco ${_ico('zap', 16)}`
                    : "Descanso entre séries";
          lbl.innerHTML = msg;
        }

        abrirTimer();
        isRunning = true;
        updateT();
        timerInt = setInterval(tickT, 1000);
      }
    } else {
      inputs[0].focus();
    }
  } catch {}
}

function updateSuggests(id) {
  const card = document.querySelector(`[data-ex-id="${id}"]`);
  if (!card) return;
  const rows = Array.from(card.querySelectorAll(".series-grid")).filter(r => r.querySelectorAll("input").length===3);
  let bestRM = 0;
  rows.forEach((r, idx) => {
    const i = r.querySelectorAll("input");
    const kg = toNum(i[0].value), reps = toNum(i[1].value);
    const rmEl = document.getElementById(`rm-${id}-${idx}`);
    if (kg && reps) {
      const rm = roundRM(calcRM(kg, reps));
      if (rmEl) rmEl.textContent = rm + "kg";
      if (rm > bestRM) bestRM = rm;
    } else {
      if (rmEl && !rmEl.textContent.startsWith("Ant")) rmEl.textContent = "-";
    }
  });
  const el1rm = document.getElementById(`1rm-${id}`);
  if (el1rm) {
    if (bestRM) { el1rm.textContent = "1RM " + bestRM + "kg"; el1rm.style.display = ""; }
    else el1rm.style.display = "none";
  }
  // Sugestão de carga entre sessões — Dupla Progressão
  // Base: Helms et al. 2016; Zourdos et al. 2016; NSCA (Haff & Triplett)
  const sec = card.closest(".section");
  const treinoKey = sec?.getAttribute("data-treino-key") || "";
  const exName = card.querySelector(".ex-title")?.textContent || "";
  const k = prevKeyOf(treinoKey, exName);
  const prev = prevMap[k];
  const sugEl = card.querySelector(".card-load-suggest");
  if (sugEl && prev && prev.length) {
    const allFilled = rows.every(r => toNum(r.querySelectorAll("input")[0].value) > 0);
    if (!allFilled) {
      const result = calcNextSessionLoad(prev, card.querySelector(".ex-target")?.textContent || "");
      if (result) {
        sugEl.innerHTML = result.msg;
        sugEl.style.display = "block";
        sugEl.style.color = result.color;
      } else {
        sugEl.style.display = "none";
      }
    } else {
      sugEl.style.display = "none";
    }
  }
}

// Progressão de carga entre sessões baseada em RPE + Reps (Dupla Progressão)
// Helms et al. 2016; Zourdos et al. 2016; NSCA Essentials of Strength & Conditioning
function calcNextSessionLoad(prevValues, targetMeta) {
  // Parseiar faixa de repetições alvo (ex: "8-12 REPS" → min:8, max:12)
  const rangeMatch = targetMeta.match(/(\d+)\s*[-–]\s*(\d+)/);
  const repMin = rangeMatch ? parseInt(rangeMatch[1]) : 6;
  const repMax = rangeMatch ? parseInt(rangeMatch[2]) : 12;

  const sets = prevValues.filter(v => toNum(v.kg) > 0 && toNum(v.reps) > 0);
  if (!sets.length) return null;

  const baseKg   = toNum(sets[0].kg);
  const avgReps  = sets.reduce((s, v) => s + toNum(v.reps), 0) / sets.length;
  const rpesets  = sets.filter(v => toNum(v.rpe) > 0);
  const avgRPE   = rpesets.length ? rpesets.reduce((s, v) => s + toNum(v.rpe), 0) / rpesets.length : null;

  let suggest, msg, color = "var(--accent)";

  if (avgRPE !== null) {
    if (avgRPE >= 9.5) {
      // RPE muito alto → reduzir 5% (2 pontos acima do alvo RPE 8)
      suggest = Math.round(baseKg * 0.95 * 2) / 2;
      msg = `⬇️ Último treino RPE ${avgRPE.toFixed(1)} — Use ${suggest}kg`;
      color = "var(--red)";
    } else if (avgRPE >= 9) {
      // RPE alto → reduzir 2,5% (1 ponto acima do alvo)
      suggest = Math.round(baseKg * 0.975 * 2) / 2;
      msg = `⬇️ RPE ${avgRPE.toFixed(1)} alto — Use ${suggest}kg`;
      color = "var(--red)";
    } else if (avgRPE >= 7 && avgRPE <= 8.5) {
      // RPE ideal (zona alvo)
      if (avgReps >= repMax) {
        // Bateu topo da faixa → aumentar peso (progressão de carga)
        suggest = Math.round((baseKg + 2.5) * 2) / 2;
        msg = `⬆️ ${avgReps.toFixed(0)} reps com RPE ${avgRPE.toFixed(1)} — Tente ${suggest}kg`;
        color = "var(--green)";
      } else if (avgReps >= repMin) {
        // Dentro da faixa → progredir reps antes de aumentar peso
        suggest = baseKg;
        msg = `${_ico('target', 16)} RPE ideal — Mantenha ${suggest}kg, aumente as reps`;
        color = "var(--accent)";
      } else {
        // Abaixo da faixa mínima → ajustar peso
        suggest = Math.round(baseKg * 0.975 * 2) / 2;
        msg = `${_ico('alert-triangle', 16)} Reps abaixo do alvo — Ajuste para ${suggest}kg`;
        color = "var(--accent)";
      }
    } else {
      // RPE baixo (≤6) → aumentar carga mais agressivamente
      const pct = avgRPE <= 5 ? 1.075 : 1.05;
      suggest = Math.round(baseKg * pct * 2) / 2;
      msg = `⬆️ RPE ${avgRPE.toFixed(1)} fácil — Tente ${suggest}kg`;
      color = "var(--green)";
    }
  } else {
    // Sem RPE registrado → usar apenas reps (progressão conservadora)
    if (avgReps >= repMax) {
      suggest = Math.round((baseKg + 2.5) * 2) / 2;
      msg = `⬆️ ${avgReps.toFixed(0)} reps completas — Tente ${suggest}kg`;
      color = "var(--green)";
    } else {
      suggest = baseKg;
      msg = `${_ico('target', 16)} Mantenha ${baseKg}kg — Aumente as reps primeiro`;
      color = "var(--accent)";
    }
  }
  return { suggest, msg, color };
}

function adicionarSerie(btn) {
  const card = btn.closest(".exercise-card");
  if (!card) return;
  const id = card.getAttribute("data-ex-id");
  const existingRows = Array.from(card.querySelectorAll(".series-grid")).filter(r => r.querySelectorAll("input").length===3);
  const sNum = existingRows.length + 1;
  const row = document.createElement("div");
  row.className = "series-grid";
  row.setAttribute("data-row","1");
  row.innerHTML = `
    <span class="setcell" onclick="onPressSetCell(this)">
      <span class="slabel">S${sNum}</span>
      <span class="rmmini" id="rm-${id}-${sNum-1}">-</span>
    </span>
    <div class="input-box"><input type="number" inputmode="decimal" min="0" step="0.5" placeholder="" oninput="updateSuggests('${id}');atualizarBtnConfirm(this)"></div>
    <div class="input-box"><input type="number" inputmode="numeric" min="0" step="1" placeholder="" oninput="updateSuggests('${id}');atualizarBtnConfirm(this)"></div>
    <div class="input-box"><input type="number" inputmode="decimal" min="0" max="10" step="0.5" placeholder="" oninput="updateSuggests('${id}');checkRPEAlert(this);atualizarBtnConfirm(this)"></div>`;
  const sugDiv = document.createElement("div");
  sugDiv.className = "row-suggest";
  sugDiv.id = `sug-${id}-${sNum-1}`;
  btn.before(row);
  btn.before(sugDiv);
  // Copiar último ghost se houver
  const prevRow = existingRows[existingRows.length-1];
  if (prevRow) {
    const pi = prevRow.querySelectorAll("input");
    const ni = row.querySelectorAll("input");
    [0,1,2].forEach(j => { if (pi[j]?.placeholder) { ni[j].placeholder=pi[j].placeholder; ni[j].classList.add("ghost"); } });
  }
  row.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", scheduleDraftSave, { passive:true });
    inp.addEventListener("input", function() { if(this.value) this.classList.remove("ghost"); startSessionTimer(); updateSessionStrip(); }, { passive:true });
  });
  card.setAttribute("data-ex-sets", String(sNum));
  scheduleDraftSave();
  if (navigator.vibrate) navigator.vibrate(20);
}

/* ═══════════════════════════════════════════════════
   AUTOSAVE & GHOST
═══════════════════════════════════════════════════ */
function attachAutosaveToCard(card) {
  card.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", scheduleDraftSave, { passive: true });
    inp.addEventListener("change", scheduleDraftSave, { passive: true });
    inp.addEventListener("input", function() {
      if (this.value) this.classList.remove("ghost");
      startSessionTimer(); updateSessionStrip();
    }, { passive: true });
  });
}

/* ═══════════════════════════════════════════════════
   BIBLIOTECA
═══════════════════════════════════════════════════ */
function abrirLibParaNovo() {
  isAddingNew = true;
  document.getElementById("libHeader").innerText = "Adicionar Exercício";
  mostrarLib();
}
function abrirLibParaTrocar(id) {
  isAddingNew = false; currentExId = id;
  document.getElementById("libHeader").innerText = "Trocar Exercício";
  mostrarLib();
}
function mostrarLib() {
  const lib = document.getElementById("libContent");
  if (!lib) return;
  lib.innerHTML = "";
  for (let cat in biblioteca) {
    lib.innerHTML += `<div class="lib-cat">${cat}</div>`;
    biblioteca[cat].forEach(ex => {
      lib.innerHTML += `<div class="lib-item" onclick="selecionar('${escapeAttr(ex)}')">${escapeHTML(ex)}</div>`;
    });
  }
  document.getElementById("modalLib").showModal();
}
function selecionar(n) {
  if (isAddingNew) {
    const active = document.querySelector(".section.active");
    const cardIdx = active ? active.querySelectorAll(".exercise-card").length : 0;
    const safeTitle = getExerciseCardTitle({ display_name: n, name: n }, cardIdx);
    if (active) criarCard(safeTitle, active.id, null, null, null, null, cardIdx, ensureExerciseRef({ display_name: safeTitle, source: "library_manual_add" }, safeTitle, "library_manual_add"));
  } else {
    const safeTitle = getExerciseCardTitle({ display_name: n, name: n }, 0);
    const el = document.getElementById(currentExId);
    if (el) {
      const oldName = el.innerText; el.innerText = safeTitle;
      const card = el.closest(".exercise-card");
      if (card) {
        card.setAttribute("data-ex-name", safeTitle);
        const nextRef = ensureExerciseRef({ display_name: safeTitle, source: "library_replace" }, safeTitle, "library_replace");
        card.setAttribute("data-ex-lookup-key", nextRef.normalized_lookup_key);
        card.setAttribute("data-ex-ref", JSON.stringify(nextRef));
        const guideBtn = card.querySelector(".card-header button[title='Ver exercício']");
        if (guideBtn) guideBtn.setAttribute("onclick", "openExerciseOnYouTube(this.closest('.exercise-card'))");
        const sec = card.closest(".section");
        const treinoKey = sec?.getAttribute("data-treino-key") || "";
        const oldKey = prevKeyOf(treinoKey, oldName), newKey = prevKeyOf(treinoKey, safeTitle);
        if (!prevMap[newKey] && prevMap[oldKey]) prevMap[newKey] = prevMap[oldKey];
        applyPrevGhostsToCard(card);
      }
      scheduleDraftSave();
    }
  }
  document.getElementById("modalLib").close();
}
function adicionarManual() {
  const val = document.getElementById("manualName").value.trim();
  if (val) { selecionar(val); document.getElementById("manualName").value = ""; }
}

/* ═══════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════ */
function tab(idx) {
  document.querySelectorAll(".section, .pill").forEach(el => el.classList.remove("active"));
  document.getElementById(`sec${idx}`)?.classList.add("active");
  document.getElementById(`p${idx}`)?.classList.add("active");
  scheduleDraftSave(); applyPrevGhostsToAll();
}

function normalizeTreinoKey(raw) { return String(raw||"").trim().replace(/\s+/g," ") || null; }
function treinoLabel(key) {
  const k = String(key||"").trim(), up = k.toUpperCase();
  return /^[A-F]$/.test(up) || up.startsWith("TREINO") ? (up.startsWith("TREINO") ? k : `Treino ${k}`) : `Treino ${k}`;
}
function buildTabsFromGrouped(grouped, order) {
  const nav=document.getElementById("nav"), cont=document.getElementById("container");
  nav.innerHTML=""; cont.innerHTML="";
  order.slice(0,6).forEach((key,idx) => {
    nav.innerHTML += `<div class="pill ${idx===0?"active":""}" id="p${idx}" onclick="tab(${idx})">${escapeHTML(treinoLabel(key))}</div>`;
    const sec = document.createElement("div");
    sec.id=`sec${idx}`; sec.className=`section ${idx===0?"active":""}`;
    sec.setAttribute("data-treino-key", key);
    cont.appendChild(sec);
    (grouped[key]||[]).forEach((ex, exIdx) => criarCard(ex.exercicio, sec.id, ex.series, ex.reps, null, null, exIdx, ensureExerciseRef(ex, ex.exercicio, "grouped_builder")));
  });
  addPillControls();
}

/* ═══════════════════════════════════════════════════
   DRAFT / SERIALIZAÇÃO
═══════════════════════════════════════════════════ */
let draftSaveTimer = null;
function scheduleDraftSave() {
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE.draftKey, JSON.stringify(serializeCurrentState())); } catch {}
  }, 300);
}
function getActiveIdx() {
  const p = Array.from(document.querySelectorAll("#nav .pill:not(.add-pill)"));
  const a = p.find(x => x.classList.contains("active"));
  return p.indexOf(a) >= 0 ? p.indexOf(a) : 0;
}
function rowHasWorkoutData(row) {
  const inputs = row ? row.querySelectorAll("input") : [];
  if (inputs.length !== 3) return false;
  return Array.from(inputs).some(input => String(input.value || "").trim().length > 0);
}

function serializeCurrentState(options) {
  const opts = options && typeof options === "object" ? options : {};
  const freq = document.getElementById("freq")?.value || "3";
  const obj  = document.getElementById("obj")?.value  || "hipertrofia";
  const pills = Array.from(document.querySelectorAll("#nav .pill:not(.add-pill)")).map((p,i) => ({ idx:i, label: p.textContent.replace("×","").trim() }));
  let activeIdx = getActiveIdx();
  const rawSections = Array.from(document.querySelectorAll("#container .section"));
  const sourceSections = opts.activeOnly ? rawSections.filter((_, idx) => idx === activeIdx) : rawSections;
  const sections = sourceSections.map((sec, secIdx) => {
    const originalIdx = rawSections.indexOf(sec);
    const treinoKey = sec.getAttribute("data-treino-key") || pills[originalIdx >= 0 ? originalIdx : secIdx]?.label || `Treino ${secIdx+1}`;
    const cards = Array.from(sec.querySelectorAll(".exercise-card")).map((card, cardIdx) => {
      const rows = Array.from(card.querySelectorAll(".series-grid")).filter(r => r.querySelectorAll("input").length===3);
      const sourceRows = opts.completedOnly ? rows.filter(rowHasWorkoutData) : rows;
      const values = sourceRows.map(r => {
        const i = r.querySelectorAll("input");
        const kg=i[0].value, reps=i[1].value, rpe=i[2].value;
        const rm = roundRM(calcRM(kg,reps));
        return { kg, reps, rpe, rm: rm ? rm : "", done: r.classList.contains("done") };
      });
      const rawName = card.querySelector(".ex-title")?.textContent || "";
      const cleanName = getExerciseCardTitle({ display_name: rawName, name: rawName }, cardIdx);
      let parsedRef = null;
      try { parsedRef = JSON.parse(card.getAttribute("data-ex-ref") || "null"); } catch {}
      const exerciseRef = ensureExerciseRef(parsedRef || { display_name: cleanName, normalized_lookup_key: card.getAttribute("data-ex-lookup-key") || normalizeExerciseLookupKey(cleanName) }, cleanName, "serialized_state");
      return { name: cleanName, nome: cleanName, display_name: cleanName, exerciseRef, sets: values.length, meta: card.querySelector(".ex-target")?.textContent||"", values };
    }).filter(card => !opts.completedOnly || (card.values || []).length > 0);
    return { treinoKey, cards, originalIdx: originalIdx >= 0 ? originalIdx : secIdx };
  }).filter(sec => !opts.completedOnly || (sec.cards || []).length > 0);
  if (opts.activeOnly) activeIdx = 0;
  const outputPills = opts.activeOnly
    ? sections.map((sec, idx) => ({ idx, label: pills[sec.originalIdx]?.label || treinoLabel(sec.treinoKey) }))
    : pills;
  const serializedSections = sections.map(sec => ({ treinoKey: sec.treinoKey, cards: sec.cards }));
  return { v:3, savedAt: new Date().toISOString(), freq, obj, activeIdx, pills: outputPills, sections: serializedSections };
}
function loadState(state) {
  if (!state || !Array.isArray(state.sections) || state.sections.length === 0) return false;
  try {
    if (state.freq) document.getElementById("freq").value = state.freq;
    if (state.obj)  document.getElementById("obj").value  = state.obj;
  } catch {}
  const nav=document.getElementById("nav"), cont=document.getElementById("container");
  nav.innerHTML=""; cont.innerHTML="";
  state.sections.slice(0,6).forEach((secData,idx) => {
    const label = state.pills && state.pills[idx] ? state.pills[idx].label : secData.treinoKey;
    nav.innerHTML += `<div class="pill ${idx===0?"active":""}" id="p${idx}" onclick="tab(${idx})">${escapeHTML(label)}</div>`;
    const sec = document.createElement("div");
    sec.id=`sec${idx}`; sec.className=`section ${idx===0?"active":""}`;
    sec.setAttribute("data-treino-key", secData.treinoKey);
    cont.appendChild(sec);
    (secData.cards||[]).forEach((c, cardIdx) => {
      const metaTxt = String(c.meta||"");
      const maybeReps = metaTxt.includes("Sets x") ? metaTxt.split("Sets x")[1]?.trim() : null;
      const safeName = getExerciseCardTitle(c, cardIdx);
      criarCard(safeName, sec.id, c.sets, maybeReps, null, c.values, cardIdx, ensureExerciseRef(c.exerciseRef || c, safeName, "load_state"));
    });
  });
  addPillControls();
  const targetIdx = state.activeIdx || 0;
  const tabEl = document.getElementById(`p${targetIdx}`);
  if (tabEl) {
    document.querySelectorAll(".section,.pill").forEach(el => el.classList.remove("active"));
    document.getElementById(`sec${targetIdx}`)?.classList.add("active");
    tabEl.classList.add("active");
    scheduleDraftSave(); applyPrevGhostsToAll(); updateWorkoutProgress();
  }
  // Mostra botão de entrada mas NÃO auto-inicia (loadState é chamado na inicialização)
  const geBtn = document.getElementById('geEntryBar');
  if (geBtn) geBtn.style.display = 'block';
  return true;
}
function clearAllInputsToGhost() {
  document.querySelectorAll(".exercise-card").forEach(card => {
    Array.from(card.querySelectorAll(".series-grid")).filter(r => r.querySelectorAll("input").length===3)
      .forEach(r => {
        r.querySelectorAll("input").forEach(inp => inp.value = "");
        r.classList.remove("done", "has-data");
      });
  });
  scheduleDraftSave();
}

/* ═══════════════════════════════════════════════════
   SALVAR SESSÃO
═══════════════════════════════════════════════════ */
async function salvarTreino() {
  try {
    const peso = await dlgPrompt("Peso corporal atual (kg)?", "number");
    const st   = serializeCurrentState({ activeOnly: true, completedOnly: true });
    if (!st.sections.length) {
      showToast("Preencha ao menos uma série antes de salvar.", "warning", 3000);
      return;
    }
    const prMap = buildPRMap();
    const prs  = detectPRs(st, prMap);
    const dur  = getSessionDuration();
    const item = { id:"sess_"+Date.now(), createdAt: new Date().toISOString(), state: st, bodyWeight: peso ? parseFloat(peso) : null, durationMin: dur, disposicao: _disposicaoAtual || null };
    const hist = safeJSON(STORAGE.historyKey, []);
    hist.unshift(item);
    if (hist.length > STORAGE.maxHistory) hist.length = STORAGE.maxHistory;
    localStorage.setItem(STORAGE.historyKey, JSON.stringify(hist));
    // Backup na nuvem — se falhar (offline), agendamos background sync
    try {
      const pushResult = _dbSync.pushHistory();
      if (pushResult && typeof pushResult.catch === 'function') {
        pushResult.catch(() => {
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(reg => reg.sync.register('kronia-workout-sync')).catch(() => {});
          }
        });
      }
    } catch(e) { _dbSync.pushHistory(); }
    savePrevSnapshotFromState(st);
    prevMap = getPrevMap();
    clearAllInputsToGhost(); applyPrevGhostsToAll(); checkDeload();
    checkPersonaEvolucao(hist);
    checkNutricaoPosTreino(st, dur);
    checkHidratacaoPosTreino(st, dur);
    // Atualiza entidades e alertas do Transforms Engine após cada sessão
    setTimeout(() => { try { teSilentScan(); } catch(e) {} }, 1500);
    _sessionStart = null;
    _disposicaoAtual = null;
    try { renderDesafios(); } catch(e) {}
    updateStreakUI(); updateWorkoutProgress();
    const analiseAcwr = await _avaliarFadigaAcwr();
    _aplicarAlertaCriticoAcwr(analiseAcwr);
    showSummary(st, prs, dur);
    if (prs.length > 0) setTimeout(() => showToast(`🏆 ${prs.length} PR${prs.length>1?"s":""} batido${prs.length>1?"s":""}!`, "success", 4000), 800);
    // Dispara análise adaptativa em background — não bloqueia o fluxo
    setTimeout(() => { try { _triggerAdaptationAnalysis(item); } catch(_) {} }, 2000);
  } catch { showToast("Erro ao salvar. Memória cheia?", "error"); }
}

// ID da adaptação pendente atual (para aceitar/rejeitar)
var _currentAdaptationId = null;

async function _triggerAdaptationAnalysis(session) {
  const card = document.getElementById('kroniaAdaptationCard');
  const body = document.getElementById('kroniaAdaptationBody');
  if (!card || !body) return;

  try {
    const { data: { session: authSession } } = await _sb.auth.getSession();
    if (!authSession?.user) return;

    card.style.display = 'block';
    body.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:0.8rem"><span>Analisando seu treino</span><span style="display:flex;gap:3px"><span class="dot-pulse" style="width:5px;height:5px;border-radius:50%;background:var(--muted);display:inline-block;animation:dotBounce 1.2s ease-in-out infinite"></span><span style="width:5px;height:5px;border-radius:50%;background:var(--muted);display:inline-block;animation:dotBounce 1.2s ease-in-out 0.4s infinite"></span><span style="width:5px;height:5px;border-radius:50%;background:var(--muted);display:inline-block;animation:dotBounce 1.2s ease-in-out 0.8s infinite"></span></span></div>';
    document.getElementById('kroniaAdaptationActions').style.display = 'none';

    const headers = await getAuthHeaders();
    const resp = await fetch(resolveAppApiUrl('/api/kronia/adaptations'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'analyze', session }),
    });

    if (!resp.ok) { card.style.display = 'none'; return; }

    const data = await resp.json();

    if (!data.adaptation) {
      card.style.display = 'none';
      return;
    }

    _currentAdaptationId = data.adaptation.id;

    const loadBadge = data.adaptation.loadState
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;background:${_loadStateColor(data.adaptation.loadState)};color:#fff">${_loadStateLabel(data.adaptation.loadState)}</span>`
      : '';

    body.innerHTML = loadBadge + escapeHTML(data.adaptation.reasoning);
    document.getElementById('kroniaAdaptationActions').style.display = 'flex';
  } catch (_) {
    const card = document.getElementById('kroniaAdaptationCard');
    if (card) card.style.display = 'none';
  }
}

async function resolveAdaptation(action) {
  if (!_currentAdaptationId) return;
  const card = document.getElementById('kroniaAdaptationCard');
  try {
    const headers = await getAuthHeaders();
    await fetch(resolveAppApiUrl('/api/kronia/adaptations'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, id: _currentAdaptationId }),
    });
    _currentAdaptationId = null;
    if (card) {
      card.style.opacity = '0';
      card.style.transition = 'opacity 0.3s';
      setTimeout(() => { card.style.display = 'none'; card.style.opacity = '1'; }, 300);
    }
    if (action === 'accept') showToast('Adaptação aplicada. KRONOS AI atualizou seu protocolo.', 'success', 3500);
  } catch (_) {
    if (card) card.style.display = 'none';
  }
}

function _loadStateLabel(state) {
  const labels = { LOW: 'Volume Baixo', MODERATE: 'Volume Moderado', HIGH: 'Volume Alto', VERY_HIGH: 'Sobrecarga' };
  return labels[state] || state;
}

function _loadStateColor(state) {
  const colors = { LOW: '#6366f1', MODERATE: '#10b981', HIGH: '#f59e0b', VERY_HIGH: '#ef4444' };
  return colors[state] || '#6366f1';
}

async function _avaliarFadigaAcwr() {
  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session?.user?.id) return null;
    let q = _sb
      .from('v_fatigue_analysis')
      .select('status, acwr_index');
    if (window.KroniaAccessScope && typeof window.KroniaAccessScope.resolveAccessScope === 'function') {
      const scope = window.KroniaAccessScope.resolveAccessScope(session.user, {
        ownershipColumn: 'user_id',
        purpose: 'fatigue_analysis',
        allowAdminGlobalRead: false
      });
      q = window.KroniaAccessScope.applyScopedQuery(q, scope);
    } else {
      q = q.eq('user_id', session.user.id); // admin-scope-audit:allow fallback when access-scope unavailable
    }
    const { data, error } = await q.maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function _aplicarAlertaCriticoAcwr(analise) {
  if (!analise || analise.status !== 'RISCO CRÍTICO') return;
  const aviso = 'Senhor, os dados biométricos indicam sobrecarga. Recomendo redução imediata de volume';
  showToast('⚠️ RISCO CRÍTICO detectado no ACWR.', 'warning', 5200);
  addOrientMsg('orientExpertMessages', 'assistant', aviso + (Number.isFinite(analise.acwr_index) ? `\n\nACWR atual: ${Number(analise.acwr_index).toFixed(2)}.` : ''));
  const input = document.getElementById('orientExpertInput');
  if (input) {
    input.value = '';
    input.placeholder = 'Fluxo interrompido por segurança. Priorize recuperação.';
  }
}

/* ═══════════════════════════════════════════════════
   FANTASMAS
═══════════════════════════════════════════════════ */
function applyPrevGhostsToAll() {
  document.querySelectorAll(".exercise-card").forEach(applyPrevGhostsToCard);
}
function applyPrevGhostsToCard(card) {
  try {
    const sec = card.closest(".section");
    const treinoKey = sec?.getAttribute("data-treino-key") || "";
    const exName = card.querySelector(".ex-title")?.textContent || card.getAttribute("data-ex-name") || "";
    const k = prevKeyOf(treinoKey, exName);
    const prev = prevMap[k] || null;
    if (!prev) return;
    const rows = Array.from(card.querySelectorAll(".series-grid")).filter(r => r.querySelectorAll("input").length===3);
    rows.forEach((r, idx) => {
      const pv = prev[idx] || null;
      if (!pv) return;
      const i = r.querySelectorAll("input");
      let kgSug = pv.kg;
      if (pv.rm && pv.reps) kgSug = Math.round(pv.rm / (1 + toNum(pv.reps)/30));
      if (!i[0].value && String(pv.kg??"").trim()) { i[0].placeholder=String(kgSug); i[0].classList.add("ghost"); }
      if (!i[1].value && String(pv.reps??"").trim()) { i[1].placeholder=String(pv.reps); i[1].classList.add("ghost"); }
      if (!i[2].value && String(pv.rpe??"").trim()) { i[2].placeholder=String(pv.rpe); i[2].classList.add("ghost"); }
      const rmEl = card.querySelector(`#rm-${card.getAttribute("data-ex-id")}-${idx}`);
      if (rmEl && !i[0].value) {
        const pr = pv.rm ?? (pv.kg && pv.reps ? roundRM(calcRM(pv.kg, pv.reps)) : "");
        if (pr) rmEl.textContent = `Ant: ${pr}kg`;
      }
    });
  } catch {}
}

/* ═══════════════════════════════════════════════════
   VOLUME & DELOAD
═══════════════════════════════════════════════════ */
function calcVolumeTotal(state) {
  if (!state?.sections) return 0;
  return state.sections.reduce((acc,sec) =>
    acc + (sec.cards||[]).reduce((acc2,c) =>
      acc2 + (c.values||[]).reduce((acc3,v) => acc3+toNum(v.kg)*toNum(v.reps), 0), 0), 0);
}
function showToast(msg, type="info", duration=3500) {
  let toast = document.getElementById("titanToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "titanToast";
    toast.style.cssText = `position:fixed;bottom:calc(58px + env(safe-area-inset-bottom,0px) + 16px);left:50%;transform:translateX(-50%) translateY(20px);
      background:var(--card);border:1px solid var(--border);color:var(--text);
      padding:12px 20px;border-radius:24px;font-size:0.85rem;font-weight:600;
      box-shadow:var(--shadow-lg);z-index:9998;opacity:0;transition:opacity .25s,transform .25s;
      white-space:normal;overflow-wrap:break-word;max-width:min(90vw,400px);text-align:center;pointer-events:none;`;
    document.body.appendChild(toast);
  }
  const colors = { info:"var(--accent)", success:"var(--green)", warning:"#f59e0b", error:"var(--red)" };
  toast.style.borderColor = colors[type] || "var(--border)";
  toast.textContent = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(10px)";
  }, duration);
}

/* ═══════════════════════════════════════════════════
   EVOLUÇÃO AUTOMÁTICA DE PERSONA
═══════════════════════════════════════════════════ */
/**
 * Analisa o histórico de treinos e calcula a persona "efetiva" real do usuário —
 * separada da persona declarada no onboarding. Retorna um objeto com:
 * - declarada:  o que o usuário disse que era
 * - efetiva:    o que os dados mostram que ele é agora
 * - evoluiu:    true se efetiva > declarada (upgrade de persona)
 * - marcos:     lista de marcos já atingidos
 * - proximoMarco: próximo objetivo para atingir
 */
function calcPersonaEfetiva(hist, cfg) {
  const declarada = cfg.persona || "dedicado";
  const n = hist.length;

  // Consistência: sessões nos últimos 30 e 60 dias
  const agora = Date.now();
  const d30 = hist.filter(h => agora - new Date(h.createdAt).getTime() < 30*86400000).length;
  const d60 = hist.filter(h => agora - new Date(h.createdAt).getTime() < 60*86400000).length;

  // RPE médio geral (indica intensidade)
  let rpeValues = [];
  hist.slice(0, 20).forEach(h => {
    (h.state?.sections||[]).forEach(s =>
      (s.cards||[]).forEach(c =>
        (c.values||[]).forEach(v => { if (v.rpe) rpeValues.push(Number(v.rpe)); })
      )
    );
  });
  const rpeMedia = rpeValues.length ? rpeValues.reduce((a,b)=>a+b,0)/rpeValues.length : 0;

  // PRs detectados nas últimas sessões
  const prMap = buildPRMap();
  const totalExercicios = Object.keys(prMap).length;

  // Calcular nível efetivo por pontuação
  let pontos = 0;
  pontos += Math.min(n, 60);                     // até 60 pts por sessões
  pontos += d30 * 3;                             // consistência recente
  pontos += d60 * 1.5;                           // consistência de médio prazo
  pontos += totalExercicios * 2;                 // variedade de exercícios
  pontos += (rpeMedia >= 7.5 ? 10 : 0);          // treina com intensidade

  let efetiva;
  if (declarada === "turista") {
    // Turista evolui se começar a treinar regularmente
    if (d30 >= 8 && n >= 16) efetiva = "dedicado";
    else efetiva = "turista";
  } else if (declarada === "iniciante") {
    if (n >= 40 && d30 >= 6 && rpeMedia >= 7)     efetiva = "atleta";
    else if (n >= 12 && d30 >= 4)                  efetiva = "dedicado";
    else                                           efetiva = "iniciante";
  } else if (declarada === "dedicado") {
    if (n >= 60 && d30 >= 10 && rpeMedia >= 7.5 && totalExercicios >= 10) efetiva = "atleta";
    else efetiva = "dedicado";
  } else {
    efetiva = declarada; // atleta já é topo
  }

  // Marcos atingidos
  const marcos = [];
  if (n >= 1)  marcos.push({ icon:_ico('activity', 16), label:"Primeira sessão" });
  if (n >= 5)  marcos.push({ icon:_ico('flame', 16), label:"5 treinos" });
  if (n >= 10) marcos.push({ icon:_ico('dumbbell', 16), label:"10 treinos" });
  if (n >= 20) marcos.push({ icon:_ico('zap', 16), label:"20 treinos" });
  if (n >= 50) marcos.push({ icon:_ico('trophy', 16), label:"50 treinos" });
  if (calcStreak() >= 7)  marcos.push({ icon:_ico('calendar', 16), label:"7 dias seguidos" });
  if (calcStreak() >= 14) marcos.push({ icon:_ico('sun', 16), label:"14 dias seguidos" });
  if (totalExercicios >= 5) marcos.push({ icon:_ico('bar-chart-3', 16), label:"5 exercícios trackeados" });

  // Próximo marco
  let proximoMarco = null;
  const nivelOrder = ["iniciante","dedicado","atleta"];
  const idxDeclarada = nivelOrder.indexOf(declarada);
  const idxEfetiva   = nivelOrder.indexOf(efetiva);

  if (declarada === "iniciante" && n < 12)
    proximoMarco = { label:"Chegar a 12 sessões para virar Dedicado", falta: 12 - n };
  else if (declarada === "dedicado" && n < 60)
    proximoMarco = { label:"Chegar a 60 sessões para atingir nível Atleta", falta: 60 - n };
  else if (declarada === "turista" && d30 < 8)
    proximoMarco = { label:`Mais ${8-d30} treinos esse mês para destravar "Dedicado"`, falta: 8 - d30 };

  return { declarada, efetiva, evoluiu: efetiva !== declarada && idxEfetiva > idxDeclarada, marcos, proximoMarco, n, d30, rpeMedia };
}

/**
 * Checa evolução de persona após salvar sessão.
 * Se o usuário subiu de persona, mostra toast especial e persiste a nova persona.
 */
function checkPersonaEvolucao(hist) {
  const cfg = safeJSON("kronia_config", {});
  if (!cfg.persona || cfg.persona === "atleta") return; // atleta já é o topo
  const ev = calcPersonaEfetiva(hist, cfg);
  if (!ev.evoluiu) return;
  // Só notificar uma vez por upgrade (guardar last notified)
  const lastKey = "kronia_persona_upgrade_" + ev.declarada;
  if (localStorage.getItem(lastKey)) return;
  localStorage.setItem(lastKey, "1");
  const labels = { dedicado: "💪 Dedicado", atleta: "🔥 Atleta" };
  const novaLabel = labels[ev.efetiva] || ev.efetiva;
  // Toast de evolução com destaque especial
  const toastMsg = `🎉 Você evoluiu para ${novaLabel}!\nKRONOS vai elevar o nível das recomendações.`;
  setTimeout(() => showToast(toastMsg, "success", 6000), 2000);
  // Pergunta se quer atualizar o perfil
  setTimeout(async () => {
    const ok = await dlgConfirm(`Seus dados mostram que você já passou do nível "${ev.declarada}" — quer atualizar seu perfil para ${novaLabel}?`);
    if (ok) {
      cfg.persona = ev.efetiva;
      localStorage.setItem("kronia_config", JSON.stringify(cfg));
      // Atualizar chip na config sheet
      const chip = document.querySelector("#personaChips [data-val='" + ev.efetiva + "']");
      if (chip) { document.querySelectorAll("#personaChips .config-chip").forEach(c=>c.classList.remove("active")); chip.classList.add("active"); }
    }
  }, 3500);
}

/**
 * Após salvar sessão intensa (RPE médio ≥ 7.5 ou volume > 3000 kg),
 * injeta dica de proteína/nutrição no summary modal.
 */
function checkNutricaoPosTreino(state, durationMin) {
  // Calcular RPE médio da sessão salva
  let rpes = [], volTotal = 0;
  (state.sections||[]).forEach(sec =>
    (sec.cards||[]).forEach(card =>
      (card.values||[]).forEach(v => {
        if (v.rpe) rpes.push(Number(v.rpe));
        if (v.kg && v.reps) volTotal += Number(v.kg) * Number(v.reps);
      })
    )
  );
  const rpeMedia = rpes.length ? rpes.reduce((a,b)=>a+b,0)/rpes.length : 0;
  const ehIntensa = rpeMedia >= 7.5 || volTotal >= 3000;
  if (!ehIntensa) return;

  const cfg = safeJSON("kronia_config", {});
  const peso = parseFloat(cfg.peso) || 75;
  const protMin = Math.round(peso * 1.8);
  const protMax = Math.round(peso * 2.2);

  const iconProt = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  const iconDrop = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
  const iconZap  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  const dicas = [
    `${iconZap}Treino intenso! Mire em <b>${protMin}–${protMax}g de proteína</b> hoje para recuperação muscular ótima.`,
    `${iconProt}Sessão pesada — consuma proteína na <b>janela de 1–2h pós-treino</b> (frango, ovo, whey). Alvo: ${protMin}g+.`,
    `${iconDrop}Hidratação + proteína: reponha eletrólitos e atinja <b>${protMin}–${protMax}g de proteína</b> hoje.`,
  ];
  const dica = dicas[Math.floor(Math.random() * dicas.length)];

  // Injetar card no summary modal (após o grid de stats)
  setTimeout(() => {
    const sumGrid = document.getElementById("sumGrid");
    if (!sumGrid || document.getElementById("sumNutricao")) return; // evitar duplicar
    const card = document.createElement("div");
    card.id = "sumNutricao";
    card.style.cssText = "margin-top:12px;background:linear-gradient(135deg,rgba(34,197,94,.12),rgba(16,185,129,.06));border:1px solid rgba(34,197,94,.3);border-radius:14px;padding:12px 14px;font-size:.8rem;line-height:1.6;color:var(--text-2)";
    const header = `<div style="font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#22c55e;margin-bottom:6px;display:flex;align-items:center;gap:6px"><svg width="10" height="10" viewBox="0 0 24 24" fill="#22c55e"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>NUTRI\u00c7\u00c3O P\u00d3S-TREINO</div>`;
    card.innerHTML = header + dica;
    sumGrid.insertAdjacentElement("afterend", card);
  }, 300);
}

function checkDeload() {
  const hist = safeJSON(STORAGE.historyKey,[]).slice(0,7).reverse();
  if (hist.length < 2) return;
  const vols = hist.map(h => calcVolumeTotal(h.state));
  const last=vols[vols.length-1], prev=vols[vols.length-2];
  if (last>0 && prev>0 && (last-prev)/prev < -0.15) {
    showToast("⚠️ Volume caiu >15%. Atenção à recuperação.", "warning", 5000);
  }
}

/* ═══════════════════════════════════════════════════
   EVOLUÇÃO
═══════════════════════════════════════════════════ */
let _evoChart = null, _evoTab = "volume";
function showEvoChart() {
  const hist = safeJSON(STORAGE.historyKey,[]);
  if (!hist.length) { showToast("Sem histórico ainda. Salve uma sessão primeiro!", "warning"); return; }
  populateEvoExSelect(hist); renderEvoChart();
  document.getElementById("evoModal")?.classList.add("show");
}
function closeEvo() { document.getElementById("evoModal")?.classList.remove("show"); }
function setEvoTab(tab, el) {
  _evoTab = tab;
  document.querySelectorAll(".evo-tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  const evoSel = document.getElementById("evoExSelect");
  if (evoSel) evoSel.style.display = (tab==="rm") ? "block" : "none";
  renderEvoChart();
}
function populateEvoExSelect(hist) {
  const names = new Set();
  hist.forEach(h => (h.state?.sections||[]).forEach(sec => (sec.cards||[]).forEach(c => { if(c.name) names.add(c.name); })));
  const sel = document.getElementById("evoExSelect");
  if (!sel) return;
  sel.innerHTML = Array.from(names).map(n => `<option value="${escapeAttr(n)}">${escapeHTML(n)}</option>`).join("");
}
function renderEvoChart() {
  const hist = safeJSON(STORAGE.historyKey,[]).slice().reverse();
  if (!hist.length) return;
  let labels=[], values=[], label="";
  if (_evoTab==="volume") {
    labels = hist.map(h => new Date(h.createdAt).toLocaleDateString("pt-BR").slice(0,5));
    values = hist.map(h => Math.round(calcVolumeTotal(h.state)));
    label  = "Volume (kg)";
  } else if (_evoTab==="rm") {
    const exName = document.getElementById("evoExSelect")?.value || "";
    hist.forEach(h => {
      let found = null;
      (h.state?.sections||[]).forEach(sec => (sec.cards||[]).forEach(c => {
        if (c.name===exName) {
          const maxRM = (c.values||[]).reduce((mx,v) => { const rm=v.kg&&v.reps?calcRM(toNum(v.kg),toNum(v.reps)):0; return rm>mx?rm:mx; },0);
          if (maxRM>0) found=maxRM;
        }
      }));
      if (found!==null) { labels.push(new Date(h.createdAt).toLocaleDateString("pt-BR").slice(0,5)); values.push(Math.round(found)); }
    });
    label = "1RM Estimado (kg)";
  } else if (_evoTab==="peso") {
    hist.forEach(h => {
      if (h.bodyWeight&&h.bodyWeight>0) { labels.push(new Date(h.createdAt).toLocaleDateString("pt-BR").slice(0,5)); values.push(h.bodyWeight); }
    });
    label = "Peso Corporal (kg)";
  } else if (_evoTab==="freq") {
    const weeks={};
    hist.forEach(h => {
      const d=new Date(h.createdAt);
      const week=`Sem ${Math.ceil(d.getDate()/7)}/${d.getMonth()+1}`;
      weeks[week]=(weeks[week]||0)+1;
    });
    labels=Object.keys(weeks); values=Object.values(weeks); label="Treinos / Semana";
  }
  const last=values.length?values[values.length-1]:0;
  const prev2=values.length>=2?values[values.length-2]:last;
  const delta=prev2>0?Math.round((last-prev2)/prev2*100):0;
  const pr=values.length?(_evoTab==="peso"?Math.min(...values):Math.max(...values)):0;
  const evoStats = document.getElementById("evoStats");
  if (evoStats) evoStats.innerHTML = `
    <div class="evo-stat"><div class="evo-stat-val">${pr>0?pr+(_evoTab!=="freq"?"kg":""):"-"}</div><div class="evo-stat-lbl">${_evoTab==="freq"?"Total":_evoTab==="peso"?"Mínimo":"Recorde"}</div></div>
    <div class="evo-stat"><div class="evo-stat-val">${last>0?last+(_evoTab==="freq"?"":"kg"):"-"}</div><div class="evo-stat-lbl">Última Sessão</div></div>
    <div class="evo-stat"><div class="evo-stat-val" style="color:${delta>=0?"#10b981":"#ef4444"}">${delta>=0?"+":""}${delta}%</div><div class="evo-stat-lbl">vs Anterior</div></div>`;
  if (_evoChart) { _evoChart.destroy(); _evoChart=null; }
  _evoChart = new Chart(document.getElementById("evoCanvas"), {
    type:"line",
    data: { labels, datasets: [{ label, data:values, borderColor:"#10b981", backgroundColor:"rgba(16,185,129,0.1)", fill:true, tension:.38, pointBackgroundColor:"#10b981", pointRadius:4, pointHoverRadius:7, pointBorderColor:"#fff", pointBorderWidth:1.5 }] },
    options: { responsive:true, plugins:{legend:{display:false}}, scales: { y:{beginAtZero:false,grid:{color:"rgba(255,255,255,0.05)"},ticks:{color:"#a3a3a3",font:{size:11}}}, x:{grid:{display:false},ticks:{color:"#a3a3a3",font:{size:10},maxRotation:0}} } },
  });
}

/* ═══════════════════════════════════════════════════
   HISTÓRICO
═══════════════════════════════════════════════════ */
function toggleHistDetails(header) { header.nextElementSibling?.classList.toggle("open"); }

async function loadHistSession(idx) {
  if (!await dlgConfirm("Carregar esta sessão?")) return;
  const sess = _histSessions[idx];
  if (!sess) return;
  loadState(sess.state); scheduleDraftSave();
  document.getElementById("modalHIST").close();
}

function verHistorico() {
  _histSessions = safeJSON(STORAGE.historyKey, []);
  const list = document.getElementById("histList");
  list.innerHTML = _histSessions.length ? "" : '<div class="hist-item" style="padding:16px;color:var(--muted);text-align:center">Sem sessões ainda.</div>';
  _histSessions.forEach((h, idx) => {
    const el = document.createElement("div");
    el.className = "hist-item";
    let detailsHTML = "";
    if (h.state?.sections) {
      h.state.sections.forEach(sec => {
        (sec.cards||[]).forEach(card => {
          const setsStr = (card.values||[]).filter(v=>v.kg&&v.reps).map(v=>`[${v.kg}kg x ${v.reps}]`).join(" ");
          if (setsStr) detailsHTML += `<div class="hist-ex-row"><span class="hist-ex-name">${escapeHTML(card.name)}</span><span>${setsStr}</span></div>`;
        });
      });
    }
    el.innerHTML = `
      <div class="hist-header" onclick="toggleHistDetails(this)">
        <div>
          <strong>${new Date(h.createdAt).toLocaleString("pt-BR")}</strong>
          ${h.bodyWeight ? ` | ${h.bodyWeight}kg BW` : ""}
          <br><small style="color:var(--muted)">${calcVolumeTotal(h.state)}kg vol total</small>
        </div>
        <div style="font-size:1.2rem;color:var(--accent)">+</div>
      </div>
      <div class="hist-details">
        ${detailsHTML || "Sem dados detalhados."}
        <button style="margin-top:10px;width:100%;padding:10px;background:var(--accent);border:none;color:#fff;border-radius:8px;font-family:var(--font);font-weight:700;cursor:pointer" onclick="loadHistSession(${idx})">CARREGAR SESSÃO</button>
      </div>`;
    list.appendChild(el);
  });
  document.getElementById("modalHIST").showModal();
}

async function limparHistorico() {
  if (await dlgConfirm("Apagar tudo? Irreversível.")) {
    localStorage.removeItem(STORAGE.historyKey);
    localStorage.removeItem(STORAGE.prevKey);
    prevMap = Object.create(null); _histSessions = [];
    verHistorico();
  }
}

/* ═══════════════════════════════════════════════════
   GERENCIAR TREINOS
═══════════════════════════════════════════════════ */
async function adicionarTreino() {
  const st = serializeCurrentState();
  if (st.sections.length >= 6) { showToast("Máximo de 6 treinos atingido.", "warning"); return; }
  const nome = await dlgPrompt("Nome do Treino (ex: Treino F):", "text");
  if (!nome) return;
  st.sections.push({ treinoKey: normalizeTreinoKey(nome), cards: [] });
  st.pills.push({ idx: st.pills.length, label: treinoLabel(nome) });
  st.activeIdx = st.sections.length - 1;
  loadState(st); scheduleDraftSave();
}

async function excluirTreinoPorIdx(idx) {
  if (!await dlgConfirm("Excluir treino?")) return;
  const st = serializeCurrentState();
  if (st.sections.length <= 1) { showToast("Mantenha pelo menos 1 treino.", "warning"); return; }
  st.sections.splice(idx,1); st.pills.splice(idx,1); st.activeIdx=0;
  loadState(st); scheduleDraftSave();
}

let lastLongPressAt = 0;
function bindPillDeleteHandlers() {
  const pills = Array.from(document.querySelectorAll("#nav .pill:not(.add-pill)"));
  pills.forEach((p, idx) => {
    p.oncontextmenu = (e) => { e.preventDefault(); excluirTreinoPorIdx(idx); return false; };
    let t = null;
    p.addEventListener("touchstart", () => { t=setTimeout(()=>{ lastLongPressAt=Date.now(); excluirTreinoPorIdx(idx); }, 650); }, { passive:true });
    p.addEventListener("touchend",  () => { if(t) clearTimeout(t); t=null; }, { passive:true });
    p.addEventListener("touchmove", () => { if(t) clearTimeout(t); t=null; }, { passive:true });
    p.addEventListener("click", (e) => { if (Date.now()-lastLongPressAt < 900) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  });
}

function addPillControls() {
  const nav = document.getElementById("nav");
  nav.querySelectorAll(".pill-x,.add-pill").forEach(e => e.remove());
  const add = document.createElement("div");
  add.className = "pill add-pill"; add.innerText = "+"; add.onclick = adicionarTreino;
  nav.appendChild(add);
  bindPillDeleteHandlers();
}

/* ═══════════════════════════════════════════════════
   DARK MODE
═══════════════════════════════════════════════════ */
function toggleDark() {}

/* ═══════════════════════════════════════════════════
   STREAK
═══════════════════════════════════════════════════ */
function calcStreak() {
  const hist = safeJSON(STORAGE.historyKey,[]);
  if (!hist.length) return 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const days = new Set(hist.map(h => { const d=new Date(h.createdAt); d.setHours(0,0,0,0); return d.getTime(); }));
  let streak=0, cursor=today.getTime();
  while (days.has(cursor)||days.has(cursor-86400000)) {
    if (days.has(cursor)) streak++;
    cursor-=86400000;
    if (streak>0 && !days.has(cursor) && !days.has(cursor+86400000)) break;
  }
  return streak;
}
function updateStreakUI() {
  const s=calcStreak(), el=document.getElementById("streakBadge"), num=document.getElementById("streakNum");
  if (el&&num) { if(s>=2){el.style.display="flex";num.textContent=s+" dias";}else{el.style.display="none";} }
}

/* ═══════════════════════════════════════════════════
   PROGRESSO
═══════════════════════════════════════════════════ */
function updateWorkoutProgress() {
  let total=0, done=0;
  const scope = document.querySelector("#container .section.active") || document;
  scope.querySelectorAll(".series-grid").forEach(r => {
    if (r.querySelectorAll("input").length!==3) return;
    total++;
    if (r.classList.contains("done")) done++;
  });
  const pct = total>0 ? Math.round(done/total*100) : 0;
  const bar = document.getElementById("workoutProgressBar");
  if (bar) bar.style.width = pct+"%";
}

/* ═══════════════════════════════════════════════════
   SESSION TIMER
═══════════════════════════════════════════════════ */
let _sessionStart = null;
function startSessionTimer() { if (!_sessionStart) _sessionStart = Date.now(); }
function getSessionDuration() {
  if (!_sessionStart) return null;
  return Math.round((Date.now()-_sessionStart)/60000);
}

/* Session strip */
function updateSessionStrip() {
  // elementos removidos da UI — função mantida para não quebrar chamadas existentes
}

/* ═══════════════════════════════════════════════════
   PR DETECTION
═══════════════════════════════════════════════════ */
function buildPRMap() {
  const hist = safeJSON(STORAGE.historyKey,[]);
  const prMap = Object.create(null);
  hist.forEach(h => (h.state?.sections||[]).forEach(sec => {
    const tk = sec.treinoKey||sec.key||"";
    (sec.cards||[]).forEach(c => {
      const key = prevKeyOf(tk, c.name||"");
      const maxRM = (c.values||[]).reduce((mx,v) => { const rm=v.kg&&v.reps?calcRM(toNum(v.kg),toNum(v.reps)):0; return rm>mx?rm:mx; },0);
      if (maxRM>0) prMap[key]=Math.max(prMap[key]||0,maxRM);
    });
  }));
  return prMap;
}
function detectPRs(state, prMap) {
  const prs=[];
  (state.sections||[]).forEach(sec => {
    const tk=sec.treinoKey||sec.key||"";
    (sec.cards||[]).forEach(c => {
      const key=prevKeyOf(tk,c.name||"");
      const maxRM=(c.values||[]).reduce((mx,v)=>{const rm=v.kg&&v.reps?calcRM(toNum(v.kg),toNum(v.reps)):0;return rm>mx?rm:mx;},0);
      const prev=prMap[key]||0;
      if (maxRM>0&&maxRM>prev) prs.push({name:c.name,rm:Math.round(maxRM),prev:Math.round(prev)});
    });
  });
  return prs;
}

/* ═══════════════════════════════════════════════════
   SUMMARY
═══════════════════════════════════════════════════ */
function showSummary(state, prs, durationMin) {
  const vol = Math.round(calcVolumeTotal(state));
  const totalSets = (state.sections||[]).reduce((acc,sec)=>acc+(sec.cards||[]).reduce((a2,c)=>a2+(c.values||[]).filter(v=>v.kg&&v.reps).length,0),0);
  const totalEx   = (state.sections||[]).reduce((acc,sec)=>acc+(sec.cards||[]).length,0);
  const dateStr   = new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});

  // Mensagem motivacional dinâmica
  const motivos = [
    "Consistência é tudo. Você apareceu. 🔥",
    "Cada série conta. Cada rep importa. 💪",
    "Progresso, não perfeição. Continue. ⚡",
    "Disciplina supera motivação. Sempre. 🏆",
    "Mais um treino no banco. Invencível. 🦾",
  ];
  const mot = prs.length > 0
    ? `🏆 ${prs.length} NOVO${prs.length>1?"S":""} RECORDE${prs.length>1?"S":""}!`
    : motivos[Math.floor(Math.random()*motivos.length)];

  const elSumTitle = document.getElementById("sumTitle");
  const elSumSub   = document.getElementById("sumSub");
  const elSumGrid  = document.getElementById("sumGrid");
  const prSection  = document.getElementById("sumPRs");
  const prList     = document.getElementById("sumPRList");
  const elSumModal = document.getElementById("summaryModal");
  if (elSumTitle) elSumTitle.textContent = "TREINO CONCLUÍDO";
  if (elSumSub) elSumSub.innerHTML = `<span style="color:var(--accent);font-weight:700">${mot}</span><br><small style="color:var(--muted)">${dateStr.charAt(0).toUpperCase()+dateStr.slice(1)}</small>`;
  if (elSumGrid) elSumGrid.innerHTML = `
    <div class="summary-stat"><div class="summary-stat-val">${vol>0?vol.toLocaleString("pt-BR"):"—"}</div><div class="summary-stat-lbl">Volume kg</div></div>
    <div class="summary-stat"><div class="summary-stat-val">${totalSets}</div><div class="summary-stat-lbl">Séries</div></div>
    <div class="summary-stat"><div class="summary-stat-val">${totalEx}</div><div class="summary-stat-lbl">Exercícios</div></div>
    <div class="summary-stat"><div class="summary-stat-val">${durationMin!==null?durationMin+"min":"—"}</div><div class="summary-stat-lbl">Duração</div></div>`;
  if (prs.length>0) {
    if (prSection) prSection.style.display="block";
    if (prList) prList.innerHTML=prs.map(p=>`
      <div class="summary-pr-item">
        <span>${escapeHTML(p.name)}</span>
        <span class="summary-pr-val">${p.rm}kg<small style="font-size:.65rem;color:var(--muted);margin-left:4px">1RM</small></span>
      </div>`).join("");
  } else if (prSection) { prSection.style.display="none"; }
  if (elSumModal) elSumModal.classList.add("show");
  if (navigator.vibrate) navigator.vibrate([50,30,80,30,120]);
  // Resetar card de adaptação anterior
  const adaptCard = document.getElementById('kroniaAdaptationCard');
  if (adaptCard) { adaptCard.style.display = 'none'; adaptCard.style.opacity = '1'; }
  _currentAdaptationId = null;
  // Limpar análise anterior e rodar nova
  const aiSection = document.getElementById("aiCoachSummary");
  if (aiSection) aiSection.style.display = "none";
  runAICoachPostWorkout(state, prs, durationMin);
}
function closeSummary() { document.getElementById("summaryModal")?.classList.remove("show"); }

function runAICoachPostWorkout(state, prs, durationMin) {
  // Se não houver dados, não rodar
  if (!state || !state.sections || state.sections.length === 0) return;
  
  // Localizar container de análise na UI de resumo
  const aiSection = document.getElementById("aiCoachSummary");
  const aiContent = document.getElementById("aiCoachContent");
  if (!aiSection || !aiContent) return;

  aiSection.style.display = "block";
  aiContent.innerHTML = `<div class="ai-typing-summary"><div class="ai-dots"><span></span><span></span><span></span></div> Analisando sua performance...</div>`;

  // Construir prompt curto de análise
  const vol = Math.round(calcVolumeTotal(state));
  const dateStr = new Date().toLocaleDateString("pt-BR", {day:"numeric",month:"short"});
  const exCount = state.sections.reduce((acc,s)=>acc+(s.cards||[]).length,0);
  
  const prompt = `Analise meu treino de hoje (${dateStr}): volume total ${vol}kg em ${exCount} exercícios durante ${durationMin||'—'}min. ${prs.length > 0 ? 'Conquistei ' + prs.length + ' novos recordes!' : ''} Me dê um feedback curto e uma sugestão prática de progressão para o próximo treino.`;

  // Enviar para o KRONOS
  if (typeof teRunKronosCoach === 'function') {
    teRunKronosCoach(prompt).then(reply => {
      if (reply) {
        aiContent.innerHTML = renderMarkdown(reply);
        // Salvar no histórico de mensagens do coach para o usuário ver quando abrir o chat
        _aiHistory.push({ role: "user", content: prompt });
        _aiHistory.push({ role: "assistant", content: reply });
      } else {
        aiSection.style.display = "none";
      }
    }).catch(err => {
      console.error('[ai-coach] falha na análise pós-treino:', err);
      aiSection.style.display = "none";
    });
  } else {
    aiSection.style.display = "none";
  }
}

/* ═══════════════════════════════════════════════════
   CONFIG SHEET
═══════════════════════════════════════════════════ */
function selectFreq(chip) {
  document.querySelectorAll("#freqChips .config-chip").forEach(c=>c.classList.remove("active"));
  chip.classList.add("active");
  document.getElementById("freq").value = chip.dataset.val;
  document.getElementById("configWarning").style.display="block";
}
function selectObj(chip) {
  document.querySelectorAll("#objChips .config-chip").forEach(c=>c.classList.remove("active"));
  chip.classList.add("active");
  document.getElementById("obj").value = chip.dataset.val;
  document.getElementById("configWarning").style.display="block";
}
// ══════════════════════════════════════════
// PROGRAMA — funções dos chips
// ══════════════════════════════════════════

function toggleMusc(el) {
  el.classList.toggle("active");
}

function toggleRestric(el) {
  // Se clicou em "Nenhuma", desativa os outros
  if (el.dataset.val === "nenhuma") {
    document.querySelectorAll(".config-chip-restric").forEach(c => c.classList.remove("active"));
    el.classList.add("active");
    return;
  }
  // Se clicou em outro, desativa "Nenhuma"
  document.querySelector('.config-chip-restric[data-val="nenhuma"]')?.classList.remove("active");
  el.classList.toggle("active");
  // Se nada selecionado, volta Nenhuma
  const any = [...document.querySelectorAll(".config-chip-restric")].some(c => c.classList.contains("active") && c.dataset.val !== "nenhuma");
  if (!any) document.querySelector('.config-chip-restric[data-val="nenhuma"]')?.classList.add("active");
}

function selectNivel(el) {
  document.querySelectorAll("#nivelChips .config-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  // Salvar no localStorage
  const cfg = safeJSON("kronia_config", {});
  cfg.nivel = el.getAttribute("data-val");
  localStorage.setItem("kronia_config", JSON.stringify(cfg));
}

function selectFase(el) {
  document.querySelectorAll("#faseChips .config-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
}

function selectEquip(el) {
  document.querySelectorAll("#equipChips .config-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
}

function selectPersonaConfig(el) {
  document.querySelectorAll("#personaChips .config-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  const val = el.dataset.val;
  const cfg = safeJSON("kronia_config", {});
  cfg.persona = val;
  localStorage.setItem("kronia_config", JSON.stringify(cfg));
  // Sugestão automática de frequência para turista
  if (val === "turista") {
    const chip1 = document.querySelector("#freqChips [data-val='1']");
    if (chip1 && !document.querySelector("#freqChips .config-chip.active[data-val='1']")) {
      document.querySelectorAll("#freqChips .config-chip").forEach(c=>c.classList.remove("active"));
      chip1.classList.add("active");
    }
    const chipHotel = document.querySelector("#equipChips [data-val='hotel']");
    if (chipHotel) { document.querySelectorAll("#equipChips .config-chip").forEach(c=>c.classList.remove("active")); chipHotel.classList.add("active"); }
    const chipSaude = document.querySelector("#objChips [data-val='saude']");
    if (chipSaude) { document.querySelectorAll("#objChips .config-chip").forEach(c=>c.classList.remove("active")); chipSaude.classList.add("active"); }
  }
}

function getProgramaConfig() {
  const freq  = document.querySelector("#freqChips .config-chip.active")?.dataset.val || "3";
  const obj   = document.querySelector("#objChips .config-chip.active")?.dataset.val || "hipertrofia";
  const fase  = document.querySelector("#faseChips .config-chip.active")?.dataset.val || "1";
  const equip = document.querySelector("#equipChips .config-chip.active")?.dataset.val || "academia";
  const persona = document.querySelector("#personaChips .config-chip.active")?.dataset.val || safeJSON("kronia_config",{}).persona || "dedicado";
  const muscs = [...document.querySelectorAll(".config-chip-musc.active")].map(c => c.dataset.val);
  const restric = [...document.querySelectorAll(".config-chip-restric.active")].map(c => c.dataset.val).filter(v => v !== "nenhuma");
  return { freq, obj, fase, equip, persona, muscs, restric };
}

function collectWorkoutGenerationInput() {
  const programa = getProgramaConfig();
  return {
    objetivo: programa.obj || "hipertrofia",
    nivel: document.querySelector("#nivelChips .config-chip.active")?.dataset.val || safeJSON("kronia_config", {}).nivel || "iniciante",
    dias: String(programa.freq || "3"),
    tempo: programa.persona === "turista" ? "25 min" : "60 min",
    equipamentos: programa.equip || "academia",
    limitacoes: (programa.restric || []).join(", ") || "nao",
    persona: programa.persona || "dedicado",
    restricoes: programa.restric || [],
    musculosPrioritarios: programa.muscs || [],
    fase: programa.fase || "1",
  };
}

function buildWorkoutRequestPayloadFromInput(input, guard) {
  const safeInput = input && typeof input === "object" ? input : {};
  const constraints = guard?.generationTrace?.constraintsUsed && typeof guard.generationTrace.constraintsUsed === "object"
    ? guard.generationTrace.constraintsUsed
    : {};
  return {
    objetivo: safeInput.objetivo,
    nivel: safeInput.nivel,
    dias: safeInput.dias,
    tempo: safeInput.tempo,
    equipamentos: safeInput.equipamentos,
    limitacoes: safeInput.limitacoes,
    scientificConstraints: Object.assign({}, constraints, {
      validationStatus: guard?.generationTrace?.validationStatus || null,
      sourceOfTruth: guard?.generationTrace?.sourceOfTruth || null,
    }),
    profile: {
      objetivo: safeInput.objetivo,
      nivel: safeInput.nivel,
      dias: safeInput.dias,
      equipamentos: safeInput.equipamentos,
      persona: safeInput.persona,
      restricoes: safeInput.restricoes,
      musculosPrioritarios: safeInput.musculosPrioritarios,
      fase: safeInput.fase,
    },
    context: {
      source: "config_sheet",
      sourceOfTruth: guard?.generationTrace?.sourceOfTruth || null,
    },
  };
}

async function requestWorkoutRoute(payload, timeoutMs) {
  const timeout = Number(timeoutMs);
  const supportsAbort = typeof AbortController === "function";
  const controller = supportsAbort ? new AbortController() : null;
  const requestPromise = apiFetch(resolveAppApiUrl("/api/chat"), {
    method: "POST",
    body: JSON.stringify({
      requestId: "workout_" + Date.now(),
      messages: [{ role: "user", content: "Gerar treino pelo KRONOS central." }],
      isWorkoutDirect: true,
      workoutProfile: payload,
      payload: payload,
    }),
    signal: controller ? controller.signal : undefined,
  });

  if (!supportsAbort || !Number.isFinite(timeout) || timeout <= 0) {
    return requestPromise;
  }

  let timeoutId = null;
  const timeoutPromise = new Promise(function (_, reject) {
    timeoutId = setTimeout(function () {
      try { controller.abort(); } catch (_) {}
      reject(new Error("Tempo limite da rota de treino excedido."));
    }, timeout);
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function extractParsableWorkoutJson(rawText) {
  if (typeof rawText !== "string" || !rawText.length) return null;
  const closingMap = { "}": "{", "]": "[" };
  const stack = [];
  let startIndex = -1;
  let insideString = false;
  let escapeNext = false;

  for (let index = 0; index < rawText.length; index += 1) {
    const char = rawText[index];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      insideString = !insideString;
      continue;
    }
    if (insideString) continue;

    if (char === "{" || char === "[") {
      if (!stack.length) startIndex = index;
      stack.push(char);
      continue;
    }

    const expectedOpen = closingMap[char];
    if (expectedOpen && stack.length && stack[stack.length - 1] === expectedOpen) {
      stack.pop();
      if (!stack.length && startIndex >= 0) {
        const candidate = rawText.slice(startIndex, index + 1).trim();
        if (candidate) {
          try {
            return { snippet: candidate, value: JSON.parse(candidate) };
          } catch (_err) {
            startIndex = -1;
          }
        }
        startIndex = -1;
      }
    }
  }
  return null;
}

function resolveWorkoutResponseContentType(response) {
  if (!response || !response.headers || typeof response.headers.get !== "function") return null;
  const header = response.headers.get("content-type");
  if (!header) return null;
  return header.split(";")[0].trim().toLowerCase();
}

async function parseWorkoutApiJsonSafely(response) {
  const rawText = typeof response?.text === "function" ? await response.text() : "";
  const normalizedBody = typeof rawText === "string" ? rawText.trim() : "";
  const tryParse = (value) => {
    if (!value || typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch (_err) {
      return null;
    }
  };

  const direct = tryParse(normalizedBody);
  if (direct) return direct;

  const extracted = extractParsableWorkoutJson(rawText);
  if (extracted && extracted.value) return extracted.value;

  return {
    success: false,
    type: "error",
    message: "Resposta inválida ao gerar treino.",
    error: "INVALID_JSON",
    data: { content: [] },
    rawBody: normalizedBody || null,
    contentType: resolveWorkoutResponseContentType(response),
    parsedSnippet: extracted?.snippet || null,
  };
}

function extractWorkoutRenderModel(payload) {
  const safePayload = payload && typeof payload === "object" ? payload : null;
  if (!safePayload) return null;
  const nodes = safePayload.data && Array.isArray(safePayload.data.content) ? safePayload.data.content : [];
  const node = nodes.find(function(item) {
    return item && typeof item === "object" && /^(workout_primary|workout_failsafe|workout_result)$/i.test(String(item.type || ""));
  }) || null;
  const plan = node?.data || safePayload.plan || null;
  if (!plan || typeof plan !== "object") return null;
  return {
    type: String(node?.type || safePayload.type || "workout_result"),
    failSafe: plan.failSafe === true,
    plan: plan,
    message: String(node?.text || safePayload.message || "").trim(),
  };
}

function resolveWorkoutRouteFailureMessage(payload, httpStatus, error) {
  const serviceValidation = payload?.data?.service?.validation && typeof payload.data.service.validation === "object"
    ? payload.data.service.validation
    : null;
  const validationError = typeof serviceValidation?.validationError === "string"
    ? serviceValidation.validationError
    : null;
  if (validationError === "INVALID_WORKOUT_TEMPLATE_SHAPE") {
    return "O template de treino salvo no Supabase está inválido. Corrija o JSON em workout_templates.templates para liberar a geração referenciada.";
  }
  if (validationError === "WORKOUT_TEMPLATE_MISSING") {
    return "Nenhum template de treino referenciado foi encontrado no Supabase para este usuário.";
  }
  if (payload && typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
  if (error && error.message) return String(error.message);
  if (httpStatus === 429) return "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.";
  return "Não consegui gerar um treino referenciado agora.";
}

// Gera treino rápido (20-30 min) para físico turista
function gerarTreinoExpress(equip) {
  // Override temporário da config para gerar treino express
  const cfgOrig = safeJSON("kronia_config", {});
  const tmpChips = {
    "#freqChips": "1",
    "#equipChips": equip,
    "#objChips": "saude",
    "#personaChips": "turista"
  };
  // Salvar seleção atual e aplicar temporária
  const prevActive = {};
  Object.entries(tmpChips).forEach(([sel, val]) => {
    const prev = document.querySelector(sel + " .config-chip.active");
    if (prev) prevActive[sel] = prev.dataset.val;
    document.querySelectorAll(sel + " .config-chip").forEach(c => c.classList.remove("active"));
    const target = document.querySelector(sel + " [data-val='" + val + "']");
    if (target) target.classList.add("active");
  });
  navTo("treino");
  gerarTreinoDoPrograma();
  // Restaurar seleções anteriores
  Object.entries(prevActive).forEach(([sel, val]) => {
    document.querySelectorAll(sel + " .config-chip").forEach(c => c.classList.remove("active"));
    const target = document.querySelector(sel + " [data-val='" + val + "']");
    if (target) target.classList.add("active");
  });
}

function gerarTreinoDoPrograma(silent) {
  const cfg = getProgramaConfig();
  closeConfig();
  navTo("treino");

  // Ler perfil da pessoa
  const perfil = safeJSON("kronia_config", {});
  const idade = parseInt(perfil.idade) || 30;
  const nivel = cfg.nivel || perfil.nivel || "iniciante";
  const ehIdoso = idade >= 55;
  const ehIniciante = nivel === "iniciante";
  const ehAvancado = nivel === "avancado";

  // Tabelas por objetivo + nível
  // Iniciante: menos volume, mais reps (aprendizado motor)
  // Idoso: menos volume, mais reps, exercícios mais seguros
  // Avançado: mais volume, menos reps (mais intensidade)
  const CONFIG_OBJ = {
    forca: {
      mev: ehIniciante||ehIdoso ? [3,"5-8"]   : [3,"3-5"],
      mav: ehIniciante||ehIdoso ? [4,"5-8"]   : [4,"4-6"],
      mrv: ehIniciante||ehIdoso ? [4,"5-8"]   : [5,"3-5"],
    },
    hipertrofia: {
      mev: ehIniciante||ehIdoso ? [3,"12-15"] : ehAvancado ? [4,"8-10"] : [3,"10-12"],
      mav: ehIniciante||ehIdoso ? [3,"12-15"] : ehAvancado ? [5,"8-12"] : [4,"8-12"],
      mrv: ehIniciante||ehIdoso ? [4,"10-15"] : ehAvancado ? [5,"6-10"] : [5,"6-10"],
    },
    definicao: {
      mev: [3,"15-20"],
      mav: [3,"15-20"],
      mrv: [4,"12-20"],
    },
    resistencia: {
      mev: [3,"15-20"],
      mav: [3,"20-25"],
      mrv: [4,"15-20"],
    },
    saude: {
      mev: [3,"12-15"],
      mav: [3,"12-15"],
      mrv: [3,"12-15"],
    },
  };

  // Exercícios científicos por grupo muscular (EMG + Schoenfeld)
  const EX_CIENTIFICOS = {
    peito:    ["Supino Reto com Barra","Supino Inclinado 30°","Crucifixo com Halteres","Crossover Cabo","Supino com Halteres"],
    costas:   ["Barra Fixa Pronada","Remada Curvada com Barra","Puxada Alta","Remada Unilateral","Remada Baixa Cabo"],
    pernas:   ["Agachamento Livre","Leg Press 45°","Cadeira Extensora","Mesa Flexora","Stiff","Agachamento Búlgaro"],
    ombros:   ["Desenvolvimento com Halteres","Elevação Lateral Cabo","Elevação Frontal","Crucifixo Inverso","Encolhimento"],
    biceps:   ["Rosca Direta Barra","Rosca Inclinada Haltere","Rosca Concentrada","Rosca Martelo","Rosca Spider"],
    triceps:  ["Tríceps Testa","Tríceps Pulley Corda","Mergulho em Paralelas","Extensão Overhead","Tríceps Coice"],
    gluteos:  ["Hip Thrust com Barra","Agachamento Profundo","Elevação Pélvica","Passada","Abdução com Cabo"],
    panturrilha: ["Panturrilha em Pé","Panturrilha Sentado","Leg Press Panturrilha"],
    abdomen:  ["Prancha","Abdominal Roda","Elevação de Pernas","Russian Twist","Dead Bug"],
  };

  // Exercícios para academia de hotel (halteres leves + esteiras + pouca máquina)
  const EX_HOTEL = {
    peito:    ["Flexão de Peito","Flexão Inclinada (pés elevados)","Supino com Halteres","Crucifixo com Halteres"],
    costas:   ["Remada Unilateral","Puxada com Elástico","Remada com Haltere Apoiado","Superman"],
    pernas:   ["Agachamento com Peso Corporal","Agachamento com Halteres","Passada","Agachamento Búlgaro","Elevação de Quadril"],
    ombros:   ["Desenvolvimento com Halteres","Elevação Lateral com Halteres","Elevação Frontal com Halteres"],
    biceps:   ["Rosca com Halteres","Rosca Martelo","Rosca Concentrada"],
    triceps:  ["Mergulho em Cadeira (Tríceps Banco)","Extensão de Tríceps com Haltere","Flexão Diamante"],
    gluteos:  ["Elevação Pélvica","Passada","Agachamento Sumô","Step Up (degrau)"],
    panturrilha: ["Panturrilha em Pé (sem peso)","Panturrilha em Degrau"],
    abdomen:  ["Prancha","Abdominal Bicicleta","Elevação de Pernas","Mountain Climber"],
  };

  // Exercícios para treino sem equipamento (bodyweight)
  const EX_CASA = {
    peito:    ["Flexão de Peito","Flexão Inclinada (pés elevados)","Flexão com Palmas Juntas","Flexão Diamante"],
    costas:   ["Superman","Remada Invertida (mesa)","Puxada em Barra de Porta"],
    pernas:   ["Agachamento com Peso Corporal","Agachamento Sumô","Passada","Agachamento Búlgaro","Wall Sit"],
    ombros:   ["Flexão Pike","Elevação Lateral Isométrica"],
    biceps:   ["Rosca Isométrica com Parede","Puxada em Barra de Porta"],
    triceps:  ["Mergulho em Cadeira (Tríceps Banco)","Flexão Diamante","Extensão de Tríceps no Chão"],
    gluteos:  ["Elevação Pélvica","Hip Thrust no Chão","Passada","Agachamento Sumô","Donkey Kick"],
    panturrilha: ["Panturrilha em Pé (unilateral)","Salto em Corda (ou simulado)"],
    abdomen:  ["Prancha","Abdominal Bicicleta","Elevação de Pernas","Mountain Climber","Hollow Body"],
  };

  // Selecionar mapa de exercícios conforme equipamento
  const ehHotel = cfg.equip === "hotel";
  const ehCasa  = cfg.equip === "casa";
  const exMap   = ehCasa ? EX_CASA : ehHotel ? EX_HOTEL : EX_CIENTIFICOS;

  // Mapa de divisão → grupos musculares
  const DIVISOES = {
    "1": [
      { nome: "Full Body", grupos: ["peito","costas","pernas","ombros","abdomen"] },
    ],
    "2": [
      { nome: "A - Full Body Força",    grupos: ["peito","costas","pernas","ombros"] },
      { nome: "B - Full Body Volume",   grupos: ["pernas","biceps","triceps","gluteos","abdomen"] },
    ],
    "3": [
      { nome: "A - Push (Peito/Ombro/Tríceps)", grupos: ["peito","ombros","triceps"] },
      { nome: "B - Pull (Costas/Bíceps)",        grupos: ["costas","biceps"] },
      { nome: "C - Legs (Pernas/Glúteos)",       grupos: ["pernas","gluteos","panturrilha"] },
    ],
    "4": [
      { nome: "A - Upper Força",       grupos: ["peito","costas"] },
      { nome: "B - Lower Força",       grupos: ["pernas","gluteos","panturrilha"] },
      { nome: "C - Upper Volume",      grupos: ["ombros","biceps","triceps"] },
      { nome: "D - Lower Posterior",   grupos: ["pernas","gluteos","abdomen"] },
    ],
    "5": [
      { nome: "A - Peito",    grupos: ["peito","triceps"] },
      { nome: "B - Costas",   grupos: ["costas","biceps"] },
      { nome: "C - Pernas",   grupos: ["pernas","gluteos","panturrilha"] },
      { nome: "D - Ombros",   grupos: ["ombros","abdomen"] },
      { nome: "E - Braços",   grupos: ["biceps","triceps","panturrilha"] },
    ],
    "6": [
      { nome: "A - Push 1",  grupos: ["peito","ombros","triceps"] },
      { nome: "B - Pull 1",  grupos: ["costas","biceps"] },
      { nome: "C - Legs 1",  grupos: ["pernas","panturrilha"] },
      { nome: "D - Push 2",  grupos: ["peito","ombros"] },
      { nome: "E - Pull 2",  grupos: ["costas","biceps","abdomen"] },
      { nome: "F - Legs 2",  grupos: ["pernas","gluteos","panturrilha"] },
    ],
  };

  const objKey = cfg.obj === "forca" || cfg.obj.includes("força") ? "forca"
               : cfg.obj === "definicao" || cfg.obj.includes("defin") ? "definicao"
               : cfg.obj === "resistencia" || cfg.obj.includes("resist") ? "resistencia"
               : cfg.obj === "saude" ? "saude"
               : "hipertrofia";
  const objCfg = CONFIG_OBJ[objKey];
  const faseIdx = parseInt(cfg.fase || "1") - 1; // 0=MEV,1=MAV,2=MRV
  const faseCfgs = [objCfg.mev, objCfg.mav, objCfg.mrv];
  const [seriesAtual, repsAtual] = faseCfgs[faseIdx] || faseCfgs[1];
  const faseNome = ["Semana 1-4 · MEV","Semana 5-8 · MAV","Semana 9-12 · MRV"][faseIdx];

  const divisao = DIVISOES[String(cfg.freq)] || DIVISOES["3"];

  // Para hotel/casa já usamos exMap dedicado; bloqueios são na filtragem normal
  const soHalteres = cfg.equip === "halteres";
  let exBloqueados = [];
  if (soHalteres) exBloqueados.push("Leg Press 45°","Cadeira Extensora","Mesa Flexora","Remada Baixa Cabo","Puxada Alta","Crossover Cabo","Elevação Lateral Cabo","Hip Thrust com Barra","Tríceps Pulley Corda");

  // Idoso (55+): bloquear exercícios de alto impacto articular
  if (ehIdoso) {
    exBloqueados.push("Agachamento Livre","Stiff","Remada Curvada com Barra","Mergulho em Paralelas","Barra Fixa Pronada","Extensão Overhead","Rosca Spider");
  }

  // Iniciante: sem exercícios muito técnicos
  if (ehIniciante) {
    exBloqueados.push("Agachamento Búlgaro","Extensão Overhead","Rosca Spider","Dead Bug","Russian Twist");
  }

  // Filtrar por restrições/lesões
  const restric = (cfg.restric || []).map(r => r.toLowerCase());
  const temJoelho   = restric.some(r => r.includes("joelho") || r.includes("patelá") || r.includes("menisco"));
  const temColuna   = restric.some(r => r.includes("coluna") || r.includes("lombar") || r.includes("hérnia") || r.includes("disco"));
  const temCervical = restric.some(r => r.includes("cervical") || r.includes("pescoço") || r.includes("ombro"));
  const temCotovelo = restric.some(r => r.includes("cotovelo") || r.includes("epicôndilo"));
  const temQuadril  = restric.some(r => r.includes("quadril") || r.includes("coxofemoral"));

  if (temJoelho)   exBloqueados.push("Agachamento Livre","Agachamento Profundo","Agachamento Búlgaro","Leg Press 45°","Cadeira Extensora","Passada");
  if (temColuna)   exBloqueados.push("Stiff","Remada Curvada com Barra","Agachamento Livre","Hip Thrust com Barra");
  if (temCervical) exBloqueados.push("Desenvolvimento com Halteres","Encolhimento","Elevação Frontal");
  if (temCotovelo) exBloqueados.push("Tríceps Testa","Rosca Direta Barra","Rosca Spider");
  if (temQuadril)  exBloqueados.push("Passada","Agachamento Búlgaro","Hip Thrust com Barra","Agachamento Livre");

  exBloqueados = [...new Set(exBloqueados)];

  // Turista ou 1-dia → treino mais compacto (4-5 exercícios full-body)
  const ehTurista = (cfg.persona === "turista") || cfg.freq === "1" || ehHotel || ehCasa;
  const exPorGrupo = ehTurista ? 1 : 2;
  const limiteExDia = ehTurista ? 5 : 6;

  const grupos = divisao.map(dia => {
    // Pegar exercícios por grupo muscular do dia
    const exsDia = [];
    dia.grupos.forEach(grupo => {
      const lista = (exMap[grupo] || EX_CIENTIFICOS[grupo] || []).filter(e => !exBloqueados.includes(e));
      exsDia.push(...lista.slice(0, exPorGrupo));
    });
    // Limitar exercícios por dia
    const exsFinal = exsDia.slice(0, limiteExDia);

    return {
      nome: dia.nome,
      exercicios: exsFinal.map(nomeEx => ({
        nome: nomeEx,
        series: seriesAtual,
        reps: repsAtual,
        fases: [
          { fase: "Sem 1-4", label: "MEV", series: objCfg.mev[0], reps: objCfg.mev[1] },
          { fase: "Sem 5-8", label: "MAV", series: objCfg.mav[0], reps: objCfg.mav[1] },
          { fase: "Sem 9-12", label: "MRV", series: objCfg.mrv[0], reps: objCfg.mrv[1] },
        ]
      }))
    };
  });

  applyAIWorkout({ treino: { grupos } });
  const nivelLabel = {"iniciante":"🌱 Iniciante","intermediario":"💪 Intermediário","avancado":"🔥 Avançado"}[nivel] || nivel;
  let msg;
  if (ehIdoso)        msg = `✅ Treino adaptado para 55+!\nExercícios seguros para suas articulações.`;
  else if (ehHotel)   msg = `✅ Treino de hotel gerado!\nExercícios adaptados para academia de viagem.`;
  else if (ehCasa)    msg = `✅ Treino sem equipamento!\nBodyweight inteligente baseado em ciência.`;
  else if (cfg.freq==="1") msg = `✅ Treino Full Body gerado!\nCompacto e eficiente para a sua semana.`;
  else                msg = `✅ Treino gerado!\nNível: ${nivelLabel} · ${faseNome}`;
  if (!silent) dlgAlert(msg);
}

function openConfig(context) {
  // Redirecionado: tela antiga "Programa de Treino" abolida — usa novo fluxo KRONOS
  if (window.openKronosWorkoutEntry) { window.openKronosWorkoutEntry(); return; }
  scheduleKroniaUIUnblock('before-training-config-open');
  document.getElementById("configWarning").style.display="none";
  if (context && typeof context === 'object') {
    var safeContext = sanitizeCtaObject(context);
    window._kroniaLastTrainingContext = safeContext;
    if (safeContext.fromChatIntent) {
      var hydrated = hydrateTrainingFromConversationIntent(safeContext);
      window._kroniaChatTrainingHydratedContext = hydrated;
      trackKroniaCta('home_card_hydrated_from_chat', 'success', {
        type: 'open_training',
        hasPayload: !!Object.keys(hydrated).length,
      });
    }
  }
  const configBox = document.getElementById("configBox");
  if (configBox) configBox.scrollTop = 0;
  // Sync persona chip from saved config
  const savedPersona = safeJSON("kronia_config", {}).persona;
  if (savedPersona) {
    const chip = document.querySelector("#personaChips [data-val='" + savedPersona + "']");
    if (chip) { document.querySelectorAll("#personaChips .config-chip").forEach(c=>c.classList.remove("active")); chip.classList.add("active"); }
  }
  // Sync nivel from session count
  const hist = safeJSON(STORAGE.historyKey, []);
  const autoNivel = hist.length < 3 ? "iniciante" : hist.length < 10 ? "intermediario" : "avancado";
  const savedNivel = safeJSON("kronia_config", {}).nivel;
  const nivelToSet = savedNivel || autoNivel;
  const nivelChip = document.querySelector("#nivelChips [data-val='" + nivelToSet + "']");
  if (nivelChip) { document.querySelectorAll("#nivelChips .config-chip").forEach(c=>c.classList.remove("active")); nivelChip.classList.add("active"); }
  const configSheet = document.getElementById("configSheet");
  if (configSheet) {
    configSheet.style.display = "";
    configSheet.style.visibility = "";
    configSheet.style.opacity = "";
    configSheet.style.pointerEvents = "";
    configSheet.removeAttribute("aria-hidden");
    configSheet.classList.add("show");
  }
}
function closeConfig() { document.getElementById("configSheet").classList.remove("show"); scheduleKroniaUIUnblock('config-close'); }
async function applyConfig() {
  var fromChat = !!window._kroniaChatTrainingHydratedContext;
  if (fromChat) {
    trackKroniaCta('training_apply_started_from_chat', 'success', {
      hasPayload: !!Object.keys(window._kroniaChatTrainingHydratedContext || {}).length,
    });
  }
  const warning = document.getElementById("configWarning");
  if (warning.style.display!=="none") {
    if (!await dlgConfirm("Gerar novo protocolo? O treino atual será substituído.")) return;
  }
  await gerarProtocolo(); closeConfig();
  if (fromChat) {
    trackKroniaCta('training_apply_completed_from_chat', 'success', {
      hasPayload: !!Object.keys(window._kroniaChatTrainingHydratedContext || {}).length,
    });
    window._kroniaChatTrainingHydratedContext = null;
  }
}
document.getElementById("configSheet")?.addEventListener("click", function(e) { if(e.target===this) closeConfig(); });

/* ═══════════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════════ */
const _OB_PERSONA_DATA = {
  turista: {
    grad: "linear-gradient(135deg,#0ea5e9,#38bdf8)",
    icon: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 8l4 8h8l-6.5 5.5 2.5 8.5L24 25l-8 5 2.5-8.5L12 16h8z" fill="white" opacity=".9"/><path d="M10 38h28M24 38v4" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    title: "Você é um Físico Turista",
    sub: "Treino em qualquer lugar, sem complicação. KRONOS gera treinos rápidos para hotel, casa ou ao ar livre — e adapta quando você estiver na academia de verdade."
  },
  iniciante: {
    grad: "linear-gradient(135deg,#059669,#10b981)",
    icon: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 10C17.37 10 12 15.37 12 22V36l4-3 4 3 4-3 4 3 4-3V22c0-6.63-5.37-12-12-12z" fill="white" opacity=".9"/><circle cx="24" cy="22" r="4" fill="#059669"/></svg>`,
    title: "Começo do caminho",
    sub: "Perfeito. KRONOS vai te guiar do zero — explica cada exercício, ajusta a carga com segurança e garante que você evolua sem pressa e sem lesão."
  },
  dedicado: {
    grad: "linear-gradient(135deg,#f97316,#fb923c)",
    icon: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="21" width="40" height="6" rx="3" fill="white" opacity="0.3"/><rect x="20" y="18" width="8" height="12" rx="2" fill="white"/><rect x="2" y="17" width="6" height="14" rx="3" fill="white"/><rect x="40" y="17" width="6" height="14" rx="3" fill="white"/></svg>`,
    title: "Dedicação que vira resultado",
    sub: "Tracking completo de volume, carga e PRs. KRONOS analisa seu histórico, aplica Dupla Progressão e mantém sua evolução sempre em alta — semana após semana."
  },
  atleta: {
    grad: "linear-gradient(135deg,#dc2626,#ef4444)",
    icon: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><polygon points="24 4 29 18 44 18 32 27 37 42 24 33 11 42 16 27 4 18 19 18" fill="white" opacity=".95"/></svg>`,
    title: "Nível de atleta",
    sub: "Periodização por blocos, RPE avançado, análise de platô, pico de performance. KRONOS fala sua língua e não poupa nos detalhes técnicos."
  }
};
function selectPersonaOb(el) {
  document.querySelectorAll(".ob-persona-chip").forEach(c=>c.classList.remove("active"));
  el.classList.add("active");
  const val = el.dataset.val;
  const cfg = safeJSON("kronia_config", {});
  cfg.persona = val;
  localStorage.setItem("kronia_config", JSON.stringify(cfg));
  const d = _OB_PERSONA_DATA[val] || _OB_PERSONA_DATA.dedicado;
  const iconWrap = document.querySelector("#ob-step-2 .ob-icon-wrap");
  if (iconWrap) { iconWrap.style.background = d.grad; iconWrap.innerHTML = d.icon; }
  const t = document.getElementById("ob2Title"); if (t) t.textContent = d.title;
  const s = document.getElementById("ob2Sub"); if (s) s.textContent = d.sub;
  setTimeout(() => obNext(2), 350);
}
function obNext(step) {
  document.querySelectorAll(".ob-step").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".ob-dot").forEach(d=>d.classList.remove("active"));
  document.getElementById("ob-step-"+step)?.classList.add("active");
  document.getElementById("ob-dot-"+step)?.classList.add("active");
  const btn = document.getElementById("ob-main-btn");
  if (step===2) {
    btn.textContent="Começar Treino"; btn.style.background="var(--green)";
    btn.onclick=obFinish;
  } else if (step===1) {
    // Step 1 is persona selector — hide button, chips auto-advance
    btn.style.opacity="0"; btn.style.pointerEvents="none";
    return;
  } else {
    btn.textContent="Continuar"; btn.style.background="var(--accent)";
    btn.style.opacity="1"; btn.style.pointerEvents="";
    btn.onclick=()=>obNext(step+1);
  }
  btn.style.opacity="1"; btn.style.pointerEvents="";
}
function obFinish() {
  localStorage.setItem("kronia_onboarded","1");
  document.body.classList.remove('overlay-open');
  const ob = document.getElementById("onboarding");
  if (ob) { ob.style.display = "none"; ob.classList.remove("show"); }
  // Restaura footer que foi escondido ao abrir o onboarding
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
  showEmailLogin(false);
}

/* ═══════════════════════════════════════════════════
   ONBOARDING FEATURE FLIPPER (novo)
═══════════════════════════════════════════════════ */
let _ffObCurrentSlide = 0;

function ffObGoTo(idx) {
  const slides = document.querySelectorAll('.ff-slide');
  const dots = document.querySelectorAll('.ff-dot');
  slides.forEach((s, i) => s.classList.toggle('ff-slide-active', i === idx));
  dots.forEach((d, i) => d.classList.toggle('ff-dot-active', i === idx));
  _ffObCurrentSlide = idx;
}

function ffObNext() {
  const total = document.querySelectorAll('.ff-slide').length;
  if (_ffObCurrentSlide < total - 1) ffObGoTo(_ffObCurrentSlide + 1);
}

// Swipe/tap para avançar slides
(function() {
  let _sx = 0, _sy = 0;
  function initObSwipe() {
    const el = document.getElementById('ff-ob-slides');
    if (!el) return;
    el.addEventListener('touchstart', e => { _sx = e.touches[0].clientX; _sy = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _sx;
      const dy = e.changedTouches[0].clientY - _sy;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx < 0) ffObNext();
        else ffObGoTo(Math.max(0, _ffObCurrentSlide - 1));
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        ffObNext(); // tap
      }
    }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initObSwipe);
  else initObSwipe();
})();

function ffObFinish() {
  localStorage.setItem('kronia_onboarded', '1');
  document.body.classList.remove('overlay-open');
  const ob = document.getElementById('onboarding');
  if (ob) { ob.style.display = 'none'; ob.classList.remove('show'); }
  // Restaura footer que foi escondido ao abrir o onboarding
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
  if (typeof _appUnlocked !== 'undefined' && _appUnlocked) {
    try { navTo('inicio'); openHome(); } catch(e) {}
  } else {
    showEmailLogin(false);
  }
}

/* IntersectionObserver timer removido */

/* ═══════════════════════════════════════════════════
   AI COACH — KRONIA
   • Chat livre com contexto completo do treino
   • Análise pós-treino automática
   • Gerador de treino por linguagem natural
   • Detecção de platô e sugestão RPE
═══════════════════════════════════════════════════ */
let _aiHistory = [];
let _aiTyping  = false;
let _orientExpertHistory = [];
let _orientFromHome = false;

function buildUserData() {
  return {
    history: safeJSON(STORAGE.historyKey, []).slice(0, 25),
    profile: safeJSON("kronia_config", {})
  };
}

function buildTrainingContext() {
  const hist    = safeJSON(STORAGE.historyKey, []).slice(0, 20);
  const current = serializeCurrentState();
  const streak  = calcStreak();
  const freq    = document.getElementById("freq")?.value || "3";
  const obj     = document.getElementById("obj")?.value  || "hipertrofia";
  const cfg     = safeJSON("kronia_config", {});

  // PRs por exercício
  const prMap = buildPRMap();
  const prLines = Object.entries(prMap).map(([k, rm]) => `  ${k.split("_").slice(1).join(" ")}: 1RM ~${Math.round(rm)}kg`).slice(0, 20).join("\n");

  // Histórico detalhado das últimas 10 sessões
  const histSummary = hist.slice(0, 10).map((h, i) => {
    const vol  = Math.round(calcVolumeTotal(h.state));
    const date = new Date(h.createdAt).toLocaleDateString("pt-BR");
    const dur  = h.durationMin ? `${h.durationMin}min` : "duração n/d";
    const bw   = h.bodyWeight  ? `${h.bodyWeight}kg corporal` : "";
    const allEx = (h.state?.sections||[]).flatMap(s => (s.cards||[]).map(c => {
      const sets = (c.values||[]).filter(v=>v.kg&&v.reps).map(v=>{
        const rpeStr = v.rpe ? ` RPE${v.rpe}` : "";
        return `${v.kg}kg×${v.reps}${rpeStr}`;
      }).join(", ");
      return sets ? `${c.name}(${sets})` : c.name;
    }));
    const avgRpe = (() => {
      const rpes = (h.state?.sections||[]).flatMap(s=>(s.cards||[]).flatMap(c=>(c.values||[]).map(v=>parseFloat(v.rpe)).filter(r=>r>0)));
      return rpes.length ? (rpes.reduce((a,b)=>a+b,0)/rpes.length).toFixed(1) : null;
    })();
    const grupos = [...new Set((h.state?.sections||[]).map(s=>s.treinoKey||s.key).filter(Boolean))].join("/");
    return `Sessão ${i+1} [${date}] ${grupos} | vol:${vol}kg | ${dur}${bw?" | "+bw:""} | RPE médio:${avgRpe||"n/d"}\n  Exercícios: ${allEx.join(", ")}`;
  }).join("\n");

  // Treino atual com RPE e meta
  const currentSummary = (current.sections||[]).map(sec => {
    const exs = (sec.cards||[]).map(c => {
      const sets = (c.values||[]).filter(v=>v.kg&&v.reps).map(v=>{
        const rpeStr = v.rpe ? ` RPE${v.rpe}` : "";
        return `${v.kg}kg×${v.reps}${rpeStr}`;
      }).join(", ");
      const meta = c.meta ? ` [meta:${c.meta}]` : "";
      return `${c.name}${meta}: ${sets || "sem dados"}`;
    }).join(" | ");
    return `Treino ${sec.treinoKey}: ${exs}`;
  }).join("\n");

  // Volume tendência (últimas 4 vs 4 anteriores)
  const vols = hist.slice(0,8).map(h=>calcVolumeTotal(h.state));
  const tendencia = vols.length >= 4
    ? (() => { const r=Math.round(vols.slice(0,4).reduce((a,b)=>a+b,0)/4); const a=Math.round(vols.slice(4).reduce((a,b)=>a+b,0)/Math.max(vols.slice(4).length,1)); return a>0?`${r}kg/sessão (${r>=a?"+"+(r-a):r-a}kg vs período anterior)`:`${r}kg/sessão`; })()
    : "dados insuficientes";

  const nivel  = hist.length < 3 ? "iniciante" : hist.length < 10 ? "intermediário" : "avançado";
  const agora  = new Date();
  const hora   = agora.getHours();
  const saudacao = hora < 12 ? "manhã" : hora < 18 ? "tarde" : "noite";
  const horaStr  = agora.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
  const totalSessoes = safeJSON(STORAGE.historyKey, []).length;

  const persona = cfg.persona || "dedicado";
  // Calcular persona efetiva baseada nos dados reais
  const _evData = calcPersonaEfetiva(hist, cfg);
  const personaEfetiva = _evData.efetiva;
  const evoluiuSilencioso = _evData.evoluiu && !localStorage.getItem("kronia_persona_upgrade_" + _evData.declarada);
  const proximoMarcoStr = _evData.proximoMarco ? _evData.proximoMarco.label : null;
  const personaInstructions = {
    turista: `
PERFIL DE ATLETA: FÍSICO TURISTA
- Este usuário treina quando pode — viagens, hotéis, academia de rua, casa. Não tem rotina fixa.
- Priorize praticidade: treinos curtos (20-30 min), exercícios que funcionam em qualquer lugar
- Quando recomendar exercícios, sempre ofereça versões para diferentes cenários: "se tiver academia: X; se tiver só o quarto: Y"
- Não force progressão rigorosa — ele pode ficar sem treinar por semanas e voltar. Trate isso como normal.
- Motivação principal: se sentir bem, disposição, aparência — não máximo desempenho
- Linguagem: descontraída, prática, sem jargão técnico. Nada de periodização complexa.
- Quando perguntar sobre treino, first response deve ser: "onde você tá agora?" (academia/hotel/casa)`,
    iniciante: `
PERFIL DE ATLETA: INICIANTE
- Este usuário está começando. Pode ter medo de errar, de se machucar, de parecer amador.
- Explique o "porquê" de cada exercício/recomendação — não assuma que ele sabe o básico
- Linguagem: acolhedora, sem julgamento, com paciência. Sem intimidar com volume técnico.
- Celebre conquistas pequenas (primeira semana consistente, primeiro PR, etc.)
- Alerte sobre riscos de sobrecarga de iniciante — o entusiasmo pode virar lesão
- Progressão: simples e linear. Não complique com periodização avançada ainda.`,
    atleta: `
PERFIL DE ATLETA: ATLETA AVANÇADO
- Este usuário entende periodização, RPE, deload, blocos de treino, frequência por músculo.
- Fale como par: troca de conhecimento, não aula. Ele sabe do que está falando.
- Use terminologia técnica sem explicar (MEV, MAV, MRV, RIR, 1RM, peaking, SRA...)
- Análise deve ser densa: compare sémanana a semana, detecte fadiga acumulada, sugira ajustes de mesociclo
- Não suavize o feedback — se o volume tá alto demais ou a técnica provavelmente tá caindo, diz direto
- Foque em otimização marginal: onde estão os 5% de melhoria restantes?`,
    dedicado: `
PERFIL DE ATLETA: DEDICADO / CONSISTENTE
- Treina regularmente, quer evoluir de verdade — massa, força ou estética
- Acompanhe a progressão de carga, PRs e volume com atenção
- Pode receber orientações técnicas moderadas: RPE, dupla progressão, deload
- Linguagem: direta, motivada, profissional mas sem ser fria`
  };

  return `Você é KRONOS — o coach pessoal de musculação e nutrição do app KRONIA. Seu nome vem do Titã do tempo e da progressão: você domina ciclos de treino, evolução e periodização. Você tem acesso completo a todos os dados do usuário e os conhece de verdade. Seja o capitão: direto, experiente, sem enrolação.

═══════════════════════════════════════
IDENTIDADE E PERSONALIDADE
═══════════════════════════════════════
- Você é coach, não assistente — fala direto, com personalidade forte e autoridade
- Você CONHECE o usuário pelos dados: histórico, PRs, objetivos, rotina. Use isso.
- Use o nome dele naturalmente quando fizer sentido — sem exagerar
- Português brasileiro coloquial, como conversa presencial na academia
- NUNCA comece com "Claro!", "Certamente!", "Olá!", "Como posso ajudar?" — vá direto ao ponto
- Saudação simples ("Oi", "E aí") = resposta curta e casual
- Resposta simples = 1-3 linhas. Detalhe só quando a pergunta pede
- Priorize respostas curtas e objetivas: frases diretas, sem texto longo
- Quando possível, use no máximo 3 bullets curtos
- Nunca repita o que o usuário disse. Nunca faça introduções desnecessárias
- Observações proativas: perceba inconsistências nos dados, elogie conquistas reais, dê alertas reais
- Varie o jeito de responder — não repita padrões de frase
- Faça perguntas só quando precisar de info — uma por vez, no fim
- Use gírias do meio quando fizer sentido: "tá voando", "bora", "massa", "na veia"
- Encorajador sem exagero — "bom progresso" é melhor que "INCRÍVEL!!"
- Comentário casual ("cansei", "kkkk") = responda como amigo, não como coach analisando treino
- Quando der uma recomendação baseada nos dados do app, mencione o dado que embasou — seja específico
- EVOLUÇÃO DE PERSONA: se "Perfil efetivo" diferir do "Perfil declarado", mencione naturalmente — ex: "pelos seus dados você já tá além de iniciante", sem fazer alarmismo
- Se o usuário perguntar sobre seu nível, use o perfil efetivo calculado, não o declarado
- DISPOSIÇÃO: se o campo "Disposição hoje" estiver preenchido, use isso para calibrar o tom e as sugestões:
  • CANSADO → seja encorajador mas realista, sugira adaptar volume/intensidade, priorize recuperação ativa
  • NORMAL → postura padrão do coach
  • NO PIQUE → pode sugerir pequenas progressões, indicar que hoje é bom dia para testar limites
  Se não preenchido, não mencione o campo — observe outros sinais dos dados
${personaInstructions[personaEfetiva] || personaInstructions[persona] || personaInstructions.dedicado}

═══════════════════════════════════════
PERFIL DO USUÁRIO
═══════════════════════════════════════
- Nome: ${cfg.nome || "não informado"}
- Perfil declarado: ${{"turista":"✈️ Físico Turista","iniciante":"🌱 Iniciante","dedicado":"💪 Dedicado","atleta":"🔥 Atleta"}[persona] || persona}
- Perfil efetivo (calculado pelos dados): ${{"turista":"✈️ Físico Turista","iniciante":"🌱 Iniciante","dedicado":"💪 Dedicado","atleta":"🔥 Atleta"}[personaEfetiva] || personaEfetiva}${personaEfetiva !== persona ? ` ← ATENÇÃO: dados indicam evolução acima do perfil declarado` : ""}
- Sessões nos últimos 30 dias: ${_evData.d30} | RPE médio: ${_evData.rpeMedia ? _evData.rpeMedia.toFixed(1) : "sem dados"}
- Disposição hoje: ${{cansado:"CANSADO (reduza intensidade, priorizando qualidade sobre volume)", normal:"NORMAL", pique:"NO PIQUE (pode puxar mais, volume e intensidade acima do usual)"}[_disposicaoAtual] || "não informado"}
- Sono última noite: ${cfg.sono ? cfg.sono+'h'+getSonoWarning(cfg.sono) : "não informado"}
${proximoMarcoStr ? `- Próximo marco: ${proximoMarcoStr}` : ""}
- Objetivo: ${obj}
- Frequência planejada: ${freq}x por semana
- Nível: ${nivel} (${totalSessoes} sessões registradas)
- Peso corporal: ${cfg.peso || "não informado"} kg
- Altura: ${cfg.altura || "não informada"} cm
- Idade: ${cfg.idade || "não informada"} anos
- Streak: ${streak} dias consecutivos
- Horário atual: ${horaStr} (${saudacao}) — NÃO cumprimente com horário errado
- Volume médio recente: ${tendencia}
- Marcos conquistados: ${_evData.marcos.map(m=>m.icon+m.label).join(" | ") || "nenhum ainda"}

${(() => {
  try {
    const cache = typeof teGetEntityState === 'function' ? teGetEntityState() : null;
    if (!cache) return '';
    const d = cache.athleteData;
    const alerts = cache.alerts || [];
    const alertStr = alerts.length > 0
      ? alerts.map(a => `[${a.severity.toUpperCase()}] ${a.message}`).join(' | ')
      : 'nenhum alerta ativo';
    return `═══════════════════════════════════════
ANÁLISE DAS ENTIDADES — KRONIA TRANSFORMS ENGINE
═══════════════════════════════════════
Fadiga acumulada (FadigaScore): ${d.fadigaScore.toFixed(1)}/10${d.fadigaScore > 8.5 ? ' ← CRÍTICO: risco de overtraining' : d.fadigaScore > 7 ? ' ← ATENÇÃO: fadiga moderada-alta' : ' ← OK'}
Variância de RPE: ${d.rpeVariance.toFixed(1)}${d.rpeVariance > 3 ? ' ← RPE inconsistente, recalibrar' : ' ← estável'}
Semanas sem PR: ${d.semSemPR}${d.semSemPR >= 3 ? ' ← possível platô' : ' ← progredindo'}
Regressão de carga: ${d.cargaRegression.toFixed(1)}%${d.cargaRegression < -5 ? ' ← carga caindo, investigar recuperação/nutrição' : ' ← estável'}
Dias sem treinar: ${d.diasSemTreino != null ? d.diasSemTreino : 'sem dados (nenhum treino registrado ainda)'}${d.diasSemTreino > 5 ? ' ← sequência interrompida' : ''}
Alertas defensivos ativos: ${alertStr}
USE esses dados para fundamentar suas recomendações. Se FadigaScore > 8.5, priorize recuperação. Se sem PR há 3+ semanas, sugira variação de estímulo ou deload.`;
  } catch(e) { return ''; }
})()}

═══════════════════════════════════════
RECORDES PESSOAIS (1RM estimado por exercício)
═══════════════════════════════════════
${prLines || "Nenhum PR registrado ainda"}

═══════════════════════════════════════
HISTÓRICO DE SESSÕES (últimas 10)
═══════════════════════════════════════
${histSummary || "Nenhuma sessão registrada ainda"}

═══════════════════════════════════════
TREINO EM ANDAMENTO AGORA
═══════════════════════════════════════
${currentSummary || "Nenhum dado no treino atual"}

═══════════════════════════════════════
EXPERTISE — MUSCULAÇÃO E TREINO
═══════════════════════════════════════
HIPERTROFIA (Brad Schoenfeld, Mike Israetel):
- Volume: 10–20 séries/músculo/semana (MEV ~10, MAV 15–20, MRV 20+)
- Intensidade: 6–15 reps, 60–80% 1RM, últimas reps próximas à falha (RIR 0–3)
- Frequência: 2x/semana por músculo otimiza síntese proteica
- Tensão mecânica > dano muscular > estresse metabólico (hierarquia de estímulo)
- Deload a cada 4–8 semanas: reduzir volume 40–60%, manter intensidade
- Progressão: adicionar carga quando completar todas as reps com boa técnica
- Periodização: linear (iniciante), ondulatória diária (intermediário/avançado)

FORÇA (Eric Helms, NSCA):
- Reps: 1–6, >80–90% 1RM, 3–5 min descanso
- Exercícios base: agachamento, terra, supino, levantamento terra, desenvolvimento
- Bloco de força: 3–6 semanas, depois volta hipertrofia

CARDIO E CONDICIONAMENTO:
- HIIT: 2–3x/semana máx. 20–30 min. Aumenta VO2max sem canibalismo muscular excessivo
- LISS: caminhada inclinada 30–45 min → preserva músculo, aumenta déficit calórico
- Separar cardio do treino de força por 6h+ quando possível (interferência metabólica)

RPE / ESFORÇO:
- RPE 10 = falha muscular | RPE 8 = 2 reps na reserva | RPE 6 = fácil
- RPE > 9 frequente → reduzir carga ou dar deload
- RPE < 6 em todos os exercícios → aumentar carga progressivamente

═══════════════════════════════════════
EXPERTISE — NUTRIÇÃO ESPORTIVA (ISSN, JISSN)
═══════════════════════════════════════
PROTEÍNA:
- Hipertrofia/força: 1,6–2,2 g/kg/dia (avançados até 2,4–3,1 g/kg em déficit)
- Distribuição: 0,4 g/kg/refeição mínimo, 4–5 refeições/dia ideal
- Leucina: 2,5–3 g/refeição para ativar mTOR (whey, ovos, frango têm alto teor)
- Timing pós-treino: janela de 2h (não "30 min" — mito). O total diário importa mais
- Proteínas de alto valor biológico: whey, caseína, ovos, frango, carne, peixe

CARBOIDRATOS:
- Combustível principal do treino de alta intensidade (glicogênio muscular)
- Carga de carbs pré-treino: 1–4 g/kg, 1–4h antes
- Endomorfo: reduzir carbs em dias de descanso, manter no treino
- Ciclagem: dias alto (treino), dia baixo (descanso) — otimiza sensibilidade à insulina
- Fontes: arroz, batata-doce, aveia, banana, macarrão

GORDURAS:
- Mínimo 20% das calorias totais (saúde hormonal — testosterona, estrógeno)
- Omega-3: 2–3 g EPA+DHA/dia (reduz inflamação, melhora recuperação)
- Fontes: azeite, ovos, abacate, castanhas, salmão

TIMING DE REFEIÇÕES:
- Pré-treino: carb + proteína 1–2h antes. Exemplos: frango+arroz, aveia+whey
- Pós-treino: proteína + carb rapidamente absorvíveis. Exemplo: whey+banana, frango+arroz
- Antes de dormir: caseína ou proteína de digestão lenta (cottage, leite) → reduz catabolismo noturno

ESTRATÉGIAS AVANÇADAS:
- Bulk limpo: surplus de 200–400 kcal/dia → +0,25–0,5 kg/semana
- Cutting: déficit de 300–500 kcal/dia → -0,5–1% peso corporal/semana (preserva músculo)
- Recomposição: déficit moderado (~10–15%) + proteína alta. Funciona bem para iniciantes e retornantes
- Realimentação (refeed): 1 dia/semana com calorias de manutenção e carbos altos → repõe leptina, melhora humor e performance

═══════════════════════════════════════
EXPERTISE — SUPLEMENTAÇÃO (evidência científica)
═══════════════════════════════════════
TIER 1 — Evidência FORTE, valem a pena:
- Creatina monoidratada: 3–5 g/dia. Sem fase de carga necessária. Aumenta força, volume e recuperação. Segura a longo prazo. Melhor suplemento de musculação.
- Whey protein: fonte proteica conveniente. Não é "anabolizante", é só proteína. Concentrado funciona bem. Isolado se intolerância à lactose.
- Cafeína: 3–6 mg/kg, 30–60 min pré-treino. Aumenta força, resistência e foco. Cuidado com tolerância — usar 1x/dia, ciclar.
- Beta-alanina: 3,2–6,4 g/dia. Aumenta resistência muscular (>60 seg de esforço). Formigamento (parestesia) é normal. Útil para séries longas, treino funcional, crossfit.
- Vitamina D3: 2.000–4.000 UI/dia. Deficiência muito comum no Brasil. Impacta testosterona, recuperação e imunidade.

TIER 2 — Evidência MODERADA, podem ajudar:
- Citrulina malato: 6–8 g, 30–60 min pré-treino. Melhora bomba, reduz fadiga, aumenta volume de treino.
- Omega-3 (EPA+DHA): 2–3 g/dia. Anti-inflamatório, melhora recuperação, saúde cardiovascular.
- Magnésio: 200–400 mg à noite. Melhora qualidade do sono e recuperação. Deficiência comum.
- Caseína: antes de dormir. Proteína de liberação lenta. Reduz catabolismo noturno.
- Ashwagandha (KSM-66): 300–600 mg/dia. Reduz cortisol, melhora recuperação, leve aumento de testosterona.
- ZMA (Zinco + Magnésio + B6): útil se houver deficiência de zinco. Não é "booster de testosterona" para quem já tem nível adequado.

TIER 3 — Evidência FRACA ou situacional:
- BCAAs: inútil se a ingestão proteica diária estiver adequada. Só faz sentido em jejum prolongado ou dieta muito restrita.
- Glutamina: inútil para hipertrofia. Pode ter uso clínico (intestino). Não vale para treino.
- Pré-treinos complexos: geralmente é a cafeína que funciona. O resto é marketing.
- CLA: evidência muito fraca para perda de gordura.
- Thermogênicos sem cafeína: a maioria não tem evidência relevante.

HORMONAIS (uso com cuidado médico):
- Testosterona/EAAs → não orientar uso. Recomendar endocrinologista.
- DHEA, Androstenediona → idem.

═══════════════════════════════════════
REGRAS
═══════════════════════════════════════
1. NUNCA invente dados não fornecidos
2. NUNCA dê diagnóstico médico
3. Máximo 400 palavras, salvo treino completo
4. Mantenha contexto da conversa
5. Fontes: Brad Schoenfeld (hipertrofia), Eric Helms (periodização), Mike Israetel (MEV/MAV/MRV), ISSN/JISSN (nutrição/suplementação), NSCA/ACSM (diretrizes gerais)
6. Se perguntarem quem você é, explique: coach de IA do KRONIA com base científica em musculação, nutrição esportiva e suplementação

═══════════════════════════════════════
BOAS PRÁTICAS CLÍNICAS
═══════════════════════════════════════
SEGURANÇA E CONTRAINDICAÇÕES:
- Sempre perguntar sobre lesões antes de prescrever exercícios para a região afetada
- Nunca indicar carga alta para quem relatou dor aguda — sugerir avaliação médica
- Iniciantes: técnica antes de carga. Nunca progredir carga com técnica errada
- Hipertensão, diabetes, cardiopatias → recomendar liberação médica

NUTRIÇÃO CLÍNICA:
- Déficit >1000 kcal/dia → alertar riscos (perda muscular, queda hormonal, fadiga)
- Sinais de transtorno alimentar → não reforçar restrição, sugerir nutricionista
- Suplementação: só recomendar com evidência. Ser honesto sobre o que não funciona

ENCAMINHAMENTO PROFISSIONAL:
- Médico: dores persistentes, sintomas cardíacos, hormonais
- Nutricionista: patologias, transtornos alimentares, complexidade clínica
- Fisioterapeuta: lesões, reabilitação, postura
- Endocrinologista: dúvidas hormonais, uso de EAAs

═══════════════════════════════════════
RACIOCÍNIO CLÍNICO — DIETA PERSONALIZADA
═══════════════════════════════════════
Quando gerar ou recomendar dieta, siga SEMPRE esta ordem de raciocínio:

1. CARGA DE TREINO: Se o usuário treinou pesado recentemente (volume alto,
   frequência 4+/semana), aumentar carboidratos intra e pós-treino. Dia de
   descanso = reduzir carbo, manter proteína.

2. FADIGA: Se fadiga_media >= 7/10 → priorizar alimentos anti-inflamatórios
   (ômega-3, cúrcuma, frutas vermelhas), reduzir volume calórico, aumentar
   magnésio e potássio. Se fadiga < 4 → plano normal ou hipercalórico.

3. BIOMARCADORES (se disponíveis):
   - Testosterona baixa: priorizar zinc (carnes, sementes), vitamina D, gordura
     saudável (abacate, azeite), reduzir açúcar refinado
   - Vitamina D baixa: sugerir exposição solar + alimentos fonte + suplementação
   - Ferritina baixa: priorizar ferro heme (carnes vermelhas), vitamina C junto,
     evitar café/chá nas refeições
   - Cortisol alto: reduzir cafeína, priorizar carboidrato complexo, magnésio,
     ashwagandha se disponível
   - PCR elevado (inflamação): dieta anti-inflamatória, evitar processados e
     gordura saturada em excesso
   - TSH alterado: não prescrever iodo sem orientação médica; alertar para consulta

4. ANAMNESE: Respeitar SEMPRE restrições, alergias, condições de saúde, orçamento
   e preferências. Se diabetes → controle de índice glicêmico. Se renal → proteína
   moderada (0.8g/kg). Se gastrite → sem pimenta, ácidos, jejum longo.

5. ADESÃO: Se historico_dieta = "nao_manteve" ou tem_compulsao = "frequente" →
   priorizar plano com maior volume alimentar, mais refeições menores, menos
   restrição. Não sugerir déficit agressivo.

6. QUANDO FALTAR DADO: Se algum biomarcador não está disponível, gere com base
   nos outros dados e anamnese. NUNCA diga "não tenho dados suficientes" — use
   o que tem e indique o que poderia melhorar com mais informação.
   Exemplo: "Gerei sua dieta com base nos seus dados de treino e anamnese.
   Quando você enviar seus exames, o KRONOS vai refinar as recomendações."
`;
}

function syncMainScrollArea() {
  const container = document.getElementById("container");
  if (!container) return;
  const footer = document.querySelector(".footer-actions");
  const top = container.getBoundingClientRect().top;
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const available = Math.floor(window.innerHeight - top - footerH);
  container.style.height = `${Math.max(160, available)}px`;
}

function setDietMiniAppChrome(active) {
  document.body.classList.toggle('diet-mini-app-active', false);
  var footer = document.querySelector('.footer-actions');
  if (footer) footer.setAttribute('aria-hidden', 'false');
}

function navTo(tab) {
  if (tab === "treino") scheduleKroniaUIUnblock('before-training-open');
  if (tab === "dieta") scheduleKroniaUIUnblock('before-diet-tab');
  const pt = document.getElementById("posTreinoSection");
  if (pt) pt.style.display = tab === "treino" ? "block" : "none";
  document.body.classList.toggle("kronia-on-treino", tab === "treino");
  const _cont = document.getElementById("container");
  if (_cont) _cont.style.display = tab === "treino" ? "" : "none";
  const _nav = document.getElementById("nav");
  if (_nav) _nav.style.display = tab === "treino" ? "" : "none";
  const _addEx = document.querySelector('.btn-add-ex');
  if (_addEx) _addEx.style.display = tab === "treino" ? "" : "none";
  if (tab !== "inicio" && tab !== "programa") document.getElementById("homeScreen")?.classList.remove("show");
  if (tab !== "treino") { try { closeStartWorkoutScreen?.(); } catch(_) {} }
  if (tab !== "treino") { try { closeExerciseDiscSheet?.(); } catch(_) {} }
  if (tab !== "treino") document.getElementById("treinoChoiceScreen")?.classList.remove("show");
  if (tab !== "dieta") document.getElementById("dietDataScreen")?.classList.remove("show");
  if (tab !== "dieta") document.getElementById("dietChoiceScreen")?.classList.remove("show");
  if (tab !== "evolucao") document.getElementById("evolutionDataScreen")?.classList.remove("show");
  if (tab !== "perfil") document.getElementById("perfilScreen")?.classList.remove("show");
  try {
    var _nfs = document.getElementById('nutritionFlowScreen');
    if (_nfs) {
      _nfs.classList.remove('show');
      _nfs.style.display = 'none';
      _nfs.style.visibility = 'hidden';
      _nfs.setAttribute('aria-hidden', 'true');
    }
    if (document.body) document.body.classList.remove('nutrition-flow-active');
    var _footer = document.querySelector('.footer-actions');
    if (_footer) _footer.style.display = '';
  } catch (_) {}
  setDietMiniAppChrome(false);
  document.querySelectorAll('.btn-nav').forEach(b => {
    b.classList.remove('active');
    b.classList.remove('diet-active');
  });
  const el = document.getElementById('nav-' + tab);
  if (el) {
    el.classList.add('active');
    el.classList.toggle('diet-active', tab === 'dieta');
  }
  syncMainScrollArea();
  try { document.dispatchEvent(new CustomEvent('kronia:navigation', { detail: { tab: tab } })); } catch (_) {}
  scheduleKroniaUIUnblock('after-nav-' + tab);
}

function openLabsUploadScreen(context) {
  openLabsScreen();
}

/* ─── Tela Dedicada de Exames ───────────────────────────── */

var _labsScreenInited = false;

function openLabsScreen() {
  try { closeAI?.(); } catch (_) {}
  try { closeOrientacao?.(); } catch (_) {}
  const _ls = document.getElementById('labsScreen');
  _ls.style.display = ''; _ls.style.visibility = ''; _ls.style.pointerEvents = ''; _ls.removeAttribute('aria-hidden');
  _ls.classList.add('show');
  document.body.classList.add('overlay-open');
  var footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = 'none';
  if (!_labsScreenInited) {
    _labsScreenInited = true;
    _initLabsScreen();
  }
  loadLabsScreenHistory(false);
}

function closeLabsScreen() {
  stopLabsPolling();
  document.getElementById('labsScreen').classList.remove('show');
  document.body.classList.remove('overlay-open');
  var footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
  if (_labsReturnDietMiniChrome) {
    _showEl('dietDataScreen');
    setDietMiniAppChrome(false);
  }
  _labsReturnDietMiniChrome = false;
}

function _initLabsScreen() {
  var fileInput = document.getElementById('labsFile');
  var dropArea = document.getElementById('labsDropArea');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      if (fileInput.files && fileInput.files[0]) _handleLabsScreenUpload(fileInput.files[0]);
    });
  }
  if (dropArea) {
    dropArea.addEventListener('dragover', function(e) { e.preventDefault(); dropArea.style.borderColor = 'var(--accent)'; });
    dropArea.addEventListener('dragleave', function() { dropArea.style.borderColor = ''; });
    dropArea.addEventListener('drop', function(e) {
      e.preventDefault();
      dropArea.style.borderColor = '';
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) _handleLabsScreenUpload(file);
    });
  }
}

async function _handleLabsScreenUpload(file) {
  var statusEl = document.getElementById('labsUploadStatus');
  var resultEl = document.getElementById('labsUploadResult');

  function setStatus(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'perfil-labs-status' + (type ? ' perfil-labs-status--' + type : '');
  }

  // MIME type com fallback por extensão (mobile Safari reporta octet-stream para PDF)
  var ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/pjpeg', 'image/x-png'];
  var EXT_MAP = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
  var ext = ((file.name || '').split('.').pop() || '').toLowerCase();
  var mime = ALLOWED_TYPES.includes(file.type) ? file.type : (EXT_MAP[ext] || file.type);
  if (mime === 'image/jpg' || mime === 'image/pjpeg') mime = 'image/jpeg';
  if (mime === 'image/x-png') mime = 'image/png';

  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mime)) {
    setStatus('Formato inválido. Use PDF, JPEG ou PNG.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setStatus('Arquivo muito grande. Máximo 10 MB.', 'error');
    return;
  }

  setStatus('Enviando arquivo…', 'loading');
  if (resultEl) resultEl.innerHTML = '';

  try {
    // ── Passo 1: verificar usuário autenticado (getUser valida o token no servidor)
    var currentUser = null;
    try {
      var userResp = await _sb.auth.getUser();
      currentUser = userResp?.data?.user;
    } catch (e) { /* fallback abaixo */ }
    if (!currentUser?.id) {
      setStatus('Sessão expirada. Faça login novamente.', 'error');
      return;
    }

    var headers = await (typeof getAuthHeaders === 'function' ? getAuthHeaders() : Promise.resolve({}));

    // ── Passo 2: init-upload (serverless leve) para gerar path canônico + signed URL
    setStatus('Preparando upload seguro…', 'loading');
    var initPath = resolveInternalApiPath('/api/kronia/labs/init-upload');
    var initResp = await fetch(initPath, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ fileName: file.name, mimeType: mime, fileSize: file.size }),
    }).catch(function(fetchErr) {
      console.error('[labs-init-upload] network error:', fetchErr);
      return null;
    });

    if (!initResp) {
      setStatus('Falha de rede ao iniciar upload. Verifique sua conexão.', 'error');
      return;
    }

    var initPayload = await initResp.json().catch(function() { return null; });
    if (!initResp.ok || !initPayload?.ok) {
      var initError = initPayload?.error || initPayload?.message || ('HTTP ' + initResp.status);
      setStatus('Erro ao iniciar upload: ' + initError, 'error');
      return;
    }

    var labReportId = initPayload.labReportId;
    var storagePath = initPayload.storagePath;
    var uploadToken = initPayload.uploadToken;
    var uploadBucket = initPayload.bucket || 'lab-reports';
    var uploadFile = mime !== file.type ? new File([file], file.name, { type: mime }) : file;

    // ── Passo 3: upload direto no Storage usando signed URL/token
    setStatus('Enviando arquivo…', 'loading');
    var storageResp = await _sb.storage.from(uploadBucket).uploadToSignedUrl(storagePath, uploadToken, uploadFile, {
      contentType: mime,
      upsert: false,
    });
    if (storageResp.error) {
      var storErr = storageResp.error.message || String(storageResp.error);
      console.error('[labs-upload] storage signed error:', storErr);
      setStatus('Erro ao enviar arquivo: ' + storErr, 'error');
      return;
    }

    // ── Passo 4: confirmar upload e enfileirar processamento assíncrono
    setStatus('Registrando exame…', 'loading');
    var registerPath = resolveInternalApiPath('/api/kronia/labs/register');

    var resp;
    try {
      resp = await fetch(registerPath, {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ labReportId: labReportId, storagePath: storagePath, fileName: file.name, mimeType: mime }),
      });
    } catch (fetchErr) {
      console.error('[labs-register] network error:', fetchErr);
      setStatus('Falha de rede ao registrar. Verifique sua conexão.', 'error');
      return;
    }

    var payload = await resp.json().catch(function() { return null; });

    if (!resp.ok || !payload?.ok) {
      var errMsg = payload?.error || payload?.message || ('HTTP ' + resp.status);
      
      // Detecção de 404 sistêmico (roteamento/build) — só quando não há erro da aplicação no payload
      if (resp.status === 404 && !payload?.error) {
        console.error('[labs-register] 404 de roteamento detectado. Verificando integridade do build...');
        try {
          var healthResp = await fetch('/api/system/health', { cache: 'no-store' });
          var health = await healthResp.json().catch(function() { return null; });
          if (health && health.ok) {
            errMsg = 'O aplicativo está desatualizado (Cache/PWA). Por favor, recarregue a página ou limpe o cache do navegador.';
          } else {
            errMsg = 'Serviço temporariamente indisponível (Erro de Roteamento). Tente novamente em instantes.';
          }
        } catch (hErr) {
          errMsg = 'Erro de conexão com o servidor de registro (404). Atualize o app.';
        }
      }

      try {
        var rm = await _sb.storage.from('lab-reports').remove([storagePath]);
        if (rm?.error) {
          console.warn('[labs-cleanup] falha ao remover órfão:', rm.error.message || rm.error);
        }
      } catch (cleanupErr) {
        console.warn('[labs-cleanup] erro ao remover órfão:', cleanupErr);
      }
      console.error('[labs-register] falha:', resp.status, errMsg);
      setStatus('Erro ao registrar: ' + errMsg, 'error');
      return;
    }

    setStatus('Exame enviado. Acompanhando processamento do laudo…', 'success');
    renderLabsResult(payload, resultEl);
    startLabReportPolling(String(payload.labReportId || payload.poll?.reportId || labReportId || ''), resultEl);
    setTimeout(function() { loadLabsScreenHistory(true); }, 2000);
    startLabsPolling(labReportId); // Atualiza automaticamente até o status final (máx. 5 min)
  } catch (err) {
    console.error('[labs-upload] erro:', err);
    setStatus('Falha na conexão: ' + (err.message || err), 'error');
  } finally {
    var fi = document.getElementById('labsFile');
    if (fi) fi.value = '';
  }
}

function renderLabsResult(payload, container) {
  if (!container) return;
  const biomarkersList = Array.isArray(payload.biomarkers) ? payload.biomarkers : [];
  if (!biomarkersList.length) {
    container.innerHTML = '<div class="labs-result-note">Exame registrado. Processamento em andamento ou aguardando revisão.</div>';
    return;
  }

  const biomarkers = biomarkersList
    .map(function(item) {
      var key = item.marker_name || item.marker_key || 'marcador';
      var val = item.value_numeric != null ? item.value_numeric : (item.value_text || '—');
      var unit = item.unit ? (' ' + item.unit) : '';
      return '<div class="labs-result-row"><span class="labs-result-key">' + escapeHTML(String(key)) + '</span><span class="labs-result-val">' + escapeHTML(String(val) + unit) + '</span></div>';
    }).join('');

  container.innerHTML =
    '<div class="labs-result-card">' +
      '<div class="labs-result-confidence">Status: ' + escapeHTML(String(payload.persistedStatus || payload.status || 'uploaded')) + '</div>' +
      (biomarkers ? '<div class="labs-result-biomarkers">' + biomarkers + '</div>' : '') +
    '</div>';
}

function startLabReportPolling(reportId, container) {
  if (!reportId) return;

  var attempts = 0;
  var maxAttempts = 15;
  var intervalMs = 4000;

  function poll() {
    attempts += 1;
    fetchLabReportDetail(reportId).then(function(detail) {
      if (!detail || !detail.ok || !detail.report) return;
      renderLabsResult({
        status: detail.report.status || detail.report.parse_status,
        persistedStatus: detail.report.status || detail.report.parse_status,
        biomarkers: detail.biomarkers || [],
      }, container);

      var statusKey = String(detail.report.status || detail.report.parse_status || '').toLowerCase();
      if (statusKey === 'uploaded' || statusKey === 'processing' || statusKey === 'extracted' || statusKey === 'queued' || statusKey === 'pending_upload') {
        if (attempts < maxAttempts) setTimeout(poll, intervalMs);
        return;
      }

      loadLabsScreenHistory(true);
    }).catch(function(err) {
      console.warn('[labs-poll] erro ao acompanhar exame:', err);
      if (attempts < maxAttempts) setTimeout(poll, intervalMs);
    });
  }

  setTimeout(poll, intervalMs);
}

var _labsHistoryCache = null;
var _labsSelectedReportId = null;
var _labsReportDetailCache = Object.create(null);
var _labsPollingInterval = null;
var _labsPollingLabReportId = null;
var _labsPollingCount = 0;
var LABS_POLL_MAX = 15;       // 15 × 20 s = 5 minutos máximo
var LABS_POLL_MS  = 20000;    // intervalo entre polls

// Statuses que indicam processamento em andamento (não-final)
var LABS_PROCESSING_STATUSES = { pending_upload: 1, uploaded: 1, queued: 1, processing: 1, extracted: 1 };

function stopLabsPolling() {
  if (_labsPollingInterval) { clearInterval(_labsPollingInterval); _labsPollingInterval = null; }
  _labsPollingLabReportId = null;
  _labsPollingCount = 0;
}

function startLabsPolling(labReportId) {
  stopLabsPolling();
  if (!labReportId) return;
  _labsPollingLabReportId = labReportId;
  _labsPollingInterval = setInterval(async function() {
    _labsPollingCount++;
    if (_labsPollingCount >= LABS_POLL_MAX) { stopLabsPolling(); return; }
    await loadLabsScreenHistory(true);
    // Para o polling quando o exame atingir status final
    var reports = _labsHistoryCache || [];
    var target = reports.find(function(r) { return r.id === _labsPollingLabReportId; });
    if (target && !LABS_PROCESSING_STATUSES[String(target.status || target.parseStatus || '').toLowerCase()]) {
      stopLabsPolling();
    }
  }, LABS_POLL_MS);
}

function _getLabStatusLabel(statusKey) {
  var STATUS_LABELS = {
    analyzed: '✅ Analisado',
    extracted: '🧪 Extraído',
    processing: '⏳ Processando',
    uploaded: '📤 Enviado',
    pending_upload: '📥 Aguardando upload',
    queued: '🧾 Na fila',
    processed: '✅ Processado',
    needs_review: '🕵️ Revisão manual',
    failed: '❌ Falhou',
    parsed: '✅ Processado',
    pending: '⏳ Aguardando'
  };
  return STATUS_LABELS[statusKey] || statusKey || '—';
}

function _isLabDeletionBlocked(statusKey) {
  return statusKey === 'pending_upload'
    || statusKey === 'uploaded'
    || statusKey === 'queued'
    || statusKey === 'processing'
    || statusKey === 'extracted';
}

function _pickInitialLabSelection(reports) {
  if (!Array.isArray(reports) || !reports.length) return null;
  if (_labsSelectedReportId && reports.some(function(item) { return item && item.id === _labsSelectedReportId; })) {
    return _labsSelectedReportId;
  }
  var preferred = reports.find(function(item) { return item && item.status === 'analyzed'; });
  return (preferred && preferred.id) || reports[0].id || null;
}

function _getClinicalFlags(report) {
  if (!report) return [];
  if (Array.isArray(report.clinicalFlags)) return report.clinicalFlags.filter(Boolean);
  if (report.aiInsights && Array.isArray(report.aiInsights.clinical_flags)) return report.aiInsights.clinical_flags.filter(Boolean);
  return [];
}

function _getCriticalFlags(report) {
  if (!report) return [];
  if (Array.isArray(report.criticalFlags)) return report.criticalFlags.filter(Boolean);
  if (report.aiInsights && Array.isArray(report.aiInsights.critical_flags)) return report.aiInsights.critical_flags.filter(Boolean);
  return [];
}

function _findLabReportSummary(reportId) {
  return Array.isArray(_labsHistoryCache)
    ? (_labsHistoryCache.find(function(item) { return item && item.id === reportId; }) || null)
    : null;
}

function _renderLabDetailState(container, html) {
  if (!container) return;
  container.innerHTML = html;
}

function _renderLabsBiomarkers(detail, container, state) {
  if (!container) return;

  if (state === 'loading') {
    return _renderLabDetailState(container, '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:18px 0">Carregando detalhe do exame…</div>');
  }

  if (!detail) {
    return _renderLabDetailState(container, '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:18px 0">Selecione um exame no histórico para ver os dados individuais.</div>');
  }

  var report = detail.report || detail;
  var biomarkers = Array.isArray(detail.biomarkers) ? detail.biomarkers : (Array.isArray(report.biomarkers) ? report.biomarkers : []);
  var aiInsights = report.aiInsights || report.ai_insights || null;
  var statusKey = String(report.status || report.parseStatus || report.parse_status || '').toLowerCase();
  var statusLabel = _getLabStatusLabel(statusKey);
  var date = report.processedAt || report.processed_at || report.createdAt || report.created_at;
  var dateLabel = date ? new Date(date).toLocaleDateString('pt-BR') : '—';
  var fileName = report.fileName || report.file_name || 'Exame';
  var clinicalFlags = _getClinicalFlags(report);
  var criticalFlags = _getCriticalFlags(report);
  var deleteDisabled = _isLabDeletionBlocked(statusKey);

  var actionHtml = '<div class="labs-detail-actions">'
    + '<button class="labs-detail-btn labs-detail-btn--danger' + (deleteDisabled ? ' is-disabled' : '') + '"'
    + ' onclick="' + (deleteDisabled ? 'void(0)' : ("deleteLabReport('" + String(report.id) + "')")) + '"'
    + (deleteDisabled ? ' disabled' : '') + '>'
    + (deleteDisabled ? 'Exclusão bloqueada durante processamento' : 'Excluir exame')
    + '</button>'
    + '</div>';

  if (statusKey === 'pending_upload' || statusKey === 'uploaded') {
    return _renderLabDetailState(container,
      '<div class="labs-bm-header"><span class="labs-bm-date">' + escapeHTML(fileName) + '</span><span class="labs-bm-status">' + escapeHTML(statusLabel) + '</span></div>'
      + '<div class="labs-detail-note">Arquivo enviado. O processamento ainda não terminou, então este exame ainda não tem biomarcadores individuais disponíveis.</div>'
      + actionHtml
    );
  }

  if (statusKey === 'processing' || statusKey === 'extracted') {
    return _renderLabDetailState(container,
      '<div class="labs-bm-header"><span class="labs-bm-date">' + escapeHTML(fileName) + ' · ' + escapeHTML(dateLabel) + '</span><span class="labs-bm-status">' + escapeHTML(statusLabel) + '</span></div>'
      + '<div class="labs-detail-note">Este exame está em processamento. Assim que a extração terminar, os biomarcadores e a análise individual vão aparecer aqui.</div>'
      + actionHtml
    );
  }

  if (statusKey === 'failed') {
    return _renderLabDetailState(container,
      '<div class="labs-bm-header"><span class="labs-bm-date">' + escapeHTML(fileName) + ' · ' + escapeHTML(dateLabel) + '</span><span class="labs-bm-status">' + escapeHTML(statusLabel) + '</span></div>'
      + '<div class="labs-detail-note">' + escapeHTML(report.processingError || report.processing_error || 'Falha no processamento deste exame.') + '</div>'
      + actionHtml
    );
  }

  var LABELS = {
    glucose: 'Glicose', hba1c: 'HbA1c', creatinine: 'Creatinina', potassium: 'Potássio',
    sodium: 'Sódio', cholesterol_total: 'Colesterol Total', total_cholesterol: 'Colesterol Total', hdl: 'HDL', hdl_cholesterol: 'HDL', ldl: 'LDL', ldl_cholesterol: 'LDL',
    triglycerides: 'Triglicerídeos', hemoglobin: 'Hemoglobina', ferritin: 'Ferritina',
    vitamin_d: 'Vitamina D', tsh: 'TSH', t4: 'T4 Livre', t4_free: 'T4 Livre', uric_acid: 'Ácido Úrico',
    alt: 'ALT (TGP)', ast: 'AST (TGO)', urea: 'Ureia', cortisol: 'Cortisol', testosterone_total: 'Testosterona Total'
  };
  var FLAG_COLOR = { high: '#ef4444', low: '#f59e0b', normal: '#10b981' };

  var rows = biomarkers.length
    ? biomarkers.map(function(b) {
        var key = b.marker_key || '';
        var label = LABELS[key] || b.marker_name || key || 'Marcador';
        var val = b.value_numeric != null ? b.value_numeric : (b.value_text || '—');
        var unit = b.unit ? ' ' + b.unit : '';
        var color = FLAG_COLOR[b.flag] || 'var(--text)';
        var ref = (b.reference_min != null || b.reference_max != null)
          ? '<span style="font-size:0.65rem;color:var(--muted);font-weight:400"> (' + (b.reference_min != null ? b.reference_min : '') + '–' + (b.reference_max != null ? b.reference_max : '') + (b.unit ? ' ' + b.unit : '') + ')</span>'
          : '';
        return '<div class="labs-bm-row"><span class="labs-bm-label">' + escapeHTML(String(label)) + '</span>'
          + '<span class="labs-bm-val" style="color:' + color + '">' + escapeHTML(String(val) + unit) + ref + '</span></div>';
      }).join('')
    : '<div class="labs-detail-note">Nenhum biomarcador estruturado foi persistido para este exame.</div>';

  var flagHtml = '';
  if (criticalFlags.length || clinicalFlags.length) {
    var chips = criticalFlags.map(function(flag) { return '<span class="labs-hist-flag labs-hist-flag--critical">' + escapeHTML(flag) + '</span>'; })
      .concat(clinicalFlags.map(function(flag) { return '<span class="labs-hist-flag">' + escapeHTML(flag) + '</span>'; }));
    flagHtml = '<div class="labs-hist-flags">' + chips.join('') + '</div>';
  }

  var insightsHtml = '';
  if (aiInsights) {
    var summary = aiInsights.summary ? '<div class="labs-detail-summary">' + escapeHTML(String(aiInsights.summary)) + '</div>' : '';
    var safety = Array.isArray(aiInsights.safety_notes) && aiInsights.safety_notes.length
      ? '<div class="labs-detail-block"><div class="labs-detail-block-title">Importância e urgência</div><ul class="labs-detail-list">' + aiInsights.safety_notes.slice(0, 3).map(function(item) { return '<li>' + escapeHTML(String(item)) + '</li>'; }).join('') + '</ul></div>'
      : '';
    var training = Array.isArray(aiInsights.impact_on_training) && aiInsights.impact_on_training.length
      ? '<div class="labs-detail-block"><div class="labs-detail-block-title">Conduta em treino</div><ul class="labs-detail-list">' + aiInsights.impact_on_training.slice(0, 3).map(function(item) { return '<li>' + escapeHTML(String(item)) + '</li>'; }).join('') + '</ul></div>'
      : '';
    var nutrition = Array.isArray(aiInsights.impact_on_nutrition) && aiInsights.impact_on_nutrition.length
      ? '<div class="labs-detail-block"><div class="labs-detail-block-title">Conduta em dieta</div><ul class="labs-detail-list">' + aiInsights.impact_on_nutrition.slice(0, 3).map(function(item) { return '<li>' + escapeHTML(String(item)) + '</li>'; }).join('') + '</ul></div>'
      : '';
    var recovery = Array.isArray(aiInsights.recovery_signals) && aiInsights.recovery_signals.length
      ? '<div class="labs-detail-block"><div class="labs-detail-block-title">Recuperação</div><ul class="labs-detail-list">' + aiInsights.recovery_signals.slice(0, 3).map(function(item) { return '<li>' + escapeHTML(String(item)) + '</li>'; }).join('') + '</ul></div>'
      : '';
    insightsHtml = summary + safety + training + nutrition + recovery;
  }

  _renderLabDetailState(container,
    '<div class="labs-bm-header"><span class="labs-bm-date">' + escapeHTML(fileName) + ' · ' + escapeHTML(dateLabel) + '</span><span class="labs-bm-status">' + escapeHTML(statusLabel) + '</span></div>'
    + flagHtml
    + '<div class="labs-bm-list">' + rows + '</div>'
    + insightsHtml
    + actionHtml
  );
}

async function openLabReportDetail(reportId, forceRefresh) {
  var container = document.getElementById('labsBiomarkersContainer');
  if (!container || !reportId) {
    _renderLabsBiomarkers(null, container);
    return;
  }

  _labsSelectedReportId = reportId;
  renderLabReportHistory(_labsHistoryCache, document.getElementById('labsHistoryContainer'), null);

  var summary = _findLabReportSummary(reportId);
  if (_labsReportDetailCache[reportId] && !forceRefresh) {
    _renderLabsBiomarkers(_labsReportDetailCache[reportId], container);
    return;
  }

  _renderLabsBiomarkers(summary, container, 'loading');

  try {
    var payload = await fetchLabReportDetail(reportId);
    _labsReportDetailCache[reportId] = payload;
    _renderLabsBiomarkers(payload, container);
  } catch (err) {
    console.warn('[labs-detail] erro:', err);
    if (summary) {
      _renderLabsBiomarkers(summary, container);
      showToast('Não foi possível carregar o detalhe completo deste exame agora.', 'warning', 3500);
    } else {
      _renderLabDetailState(container, '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:18px 0">Não foi possível carregar o detalhe deste exame.</div>');
    }
  }
}

async function fetchLabReportDetail(reportId) {
  var headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
  var resp = await fetch(resolveInternalApiPath('/api/kronia/labs/reports/' + encodeURIComponent(reportId)), { headers: headers, credentials: 'same-origin' });
  var payload = await resp.json().catch(function() { return null; });
  if (!resp.ok || !payload || !payload.ok) throw new Error((payload && payload.error) || ('HTTP ' + resp.status));
  return payload;
}

async function deleteLabReport(reportId) {
  var summary = _findLabReportSummary(reportId);
  var statusKey = String((summary && (summary.status || summary.parseStatus)) || '').toLowerCase();
  if (_isLabDeletionBlocked(statusKey)) {
    showToast('Este exame ainda está em processamento e não pode ser excluído agora.', 'warning', 3800);
    return;
  }

  if (!confirm('Excluir este exame permanentemente do seu histórico?')) return;

  try {
    var headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    var resp = await fetch(resolveInternalApiPath('/api/kronia/labs/reports/' + encodeURIComponent(reportId)), {
      method: 'DELETE',
      headers: headers,
      credentials: 'same-origin'
    });
    var payload = await resp.json().catch(function() { return null; });
    if (!resp.ok || !payload || !payload.ok) throw new Error((payload && payload.error) || ('HTTP ' + resp.status));

    delete _labsReportDetailCache[reportId];
    _labsHistoryCache = Array.isArray(_labsHistoryCache)
      ? _labsHistoryCache.filter(function(item) { return item && item.id !== reportId; })
      : [];
    _labsSelectedReportId = _pickInitialLabSelection(_labsHistoryCache);

    renderLabReportHistory(_labsHistoryCache, document.getElementById('labsHistoryContainer'), null);
    if (_labsSelectedReportId) {
      await openLabReportDetail(_labsSelectedReportId, false);
    } else {
      _renderLabsBiomarkers(null, document.getElementById('labsBiomarkersContainer'));
    }

    showToast('Exame excluído com sucesso.', 'success', 3000);
  } catch (err) {
    console.warn('[labs-delete] erro:', err);
    showToast('Não foi possível excluir o exame agora.', 'error', 3500);
  }
}

async function loadLabsScreenHistory(forceRefresh) {
  var container = document.getElementById('labsHistoryContainer');
  var bioContainer = document.getElementById('labsBiomarkersContainer');
  if (!container) return;

  if (!forceRefresh && _labsHistoryCache) {
    _labsSelectedReportId = _pickInitialLabSelection(_labsHistoryCache);
    renderLabReportHistory(_labsHistoryCache, container, null);
    if (_labsSelectedReportId) {
      openLabReportDetail(_labsSelectedReportId, false);
    } else {
      _renderLabsBiomarkers(null, bioContainer);
    }
    return;
  }

  container.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:12px 0">Carregando…</div>';

  try {
    var headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    var resp = await fetch(resolveInternalApiPath('/api/kronia/labs/reports?limit=10'), { headers: headers, credentials: 'same-origin' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var payload = await resp.json();
    if (!payload.ok) throw new Error(payload.error || 'response not ok');
    _labsHistoryCache = payload.reports || [];
    _labsSelectedReportId = _pickInitialLabSelection(_labsHistoryCache);
    renderLabReportHistory(_labsHistoryCache, container, null);
    if (_labsSelectedReportId) {
      openLabReportDetail(_labsSelectedReportId, forceRefresh);
    } else {
      _renderLabsBiomarkers(null, bioContainer);
    }
  } catch (err) {
    console.warn('[labs-history] falha ao carregar histórico de exames:', err);
    container.innerHTML = ''
      + '<div style="display:grid;gap:8px;justify-items:center;padding:12px 0">'
      + '<div style="color:var(--muted);font-size:0.75rem;text-align:center">Não foi possível carregar o histórico.</div>'
      + '<button id="labsHistoryRetryButton" type="button" class="btn btn-secondary" style="min-width:140px">Tentar novamente</button>'
      + '</div>';
    var retryButton = document.getElementById('labsHistoryRetryButton');
    if (retryButton) {
      retryButton.onclick = function() {
        loadLabsScreenHistory(true);
      };
    }
    _renderLabsBiomarkers(null, bioContainer);
  }
}

function renderLabReportHistory(reports, container, emptyEl) {
  if (!container) return;
  if (!reports || reports.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:12px 0" id="perfilLabsHistoryEmpty">Nenhum exame enviado ainda.</div>';
    return;
  }

  var BIOMARKER_LABELS = {
    glucose: 'Glicose', hba1c: 'HbA1c', creatinine: 'Creatinina',
    potassium: 'Potássio', sodium: 'Sódio', cholesterol_total: 'Colesterol Total',
    total_cholesterol: 'Colesterol Total', hdl: 'HDL', hdl_cholesterol: 'HDL', ldl: 'LDL', ldl_cholesterol: 'LDL', triglycerides: 'Triglicerídeos',
  };

  container.innerHTML = reports.map(function(r) {
    var date = r.processedAt || r.createdAt ? new Date(r.processedAt || r.createdAt).toLocaleDateString('pt-BR') : '—';
    var statusKey = r.status || r.parseStatus;
    var statusLabel = _getLabStatusLabel(statusKey);
    var fileName = r.fileName ? escapeHTML(r.fileName.replace(/^\d+-/, '')) : 'Exame';
    var isSelected = _labsSelectedReportId === r.id;

    var biomarkersHtml = '';
    if (Array.isArray(r.biomarkers) && r.biomarkers.length) {
      var items = r.biomarkers.slice(0, 6).map(function(b) {
        var key = b.marker_key || b.marker_name || '';
        var val = b.value_numeric != null ? b.value_numeric : b.value_text;
        return '<span class="labs-hist-bm"><span class="labs-hist-bm-key">' + escapeHTML(BIOMARKER_LABELS[key] || key || 'Marcador') + '</span><span class="labs-hist-bm-val">' + escapeHTML(String(val || '—')) + '</span></span>';
      });
      if (items.length) biomarkersHtml = '<div class="labs-hist-bms">' + items.join('') + '</div>';
    }

    var flags = _getClinicalFlags(r).slice(0, 3);
    var criticalFlags = _getCriticalFlags(r).slice(0, 2);
    var flagsHtml = '';
    if (criticalFlags.length || flags.length) {
      flagsHtml = '<div class="labs-hist-flags">'
        + criticalFlags.map(function(f) { return '<span class="labs-hist-flag labs-hist-flag--critical">' + escapeHTML(f) + '</span>'; }).join('')
        + flags.map(function(f) { return '<span class="labs-hist-flag">' + escapeHTML(f) + '</span>'; }).join('')
        + '</div>';
    }

    return '<div class="labs-hist-card' + (isSelected ? ' is-selected' : '') + '" role="button" tabindex="0" onclick="openLabReportDetail(\'' + String(r.id) + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openLabReportDetail(\'' + String(r.id) + '\')}">' +
      '<div class="labs-hist-header">' +
        '<span class="labs-hist-name">' + fileName + '</span>' +
        '<span class="labs-hist-meta">' + date + ' · ' + statusLabel + '</span>' +
      '</div>' +
      (biomarkersHtml || '<div class="labs-detail-note" style="margin-top:8px">Toque para ver o status e a análise individual deste exame.</div>') +
      (flagsHtml || '') +
    '</div>';
  }).join('');
}

/* ─── Workout Templates ──────────────────────────────────── */

var _workoutTemplatesCache = null;

async function loadWorkoutTemplates(forceRefresh) {
  if (!forceRefresh && _workoutTemplatesCache !== null) return _workoutTemplatesCache;
  try {
    const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    const resp = await fetch(resolveAppApiUrl('/api/kronia/workout/templates'), { headers });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const payload = await resp.json();
    _workoutTemplatesCache = Array.isArray(payload.templates) ? payload.templates : [];
    return _workoutTemplatesCache;
  } catch (err) {
    console.warn('[workout-templates] erro ao carregar:', err);
    return [];
  }
}

async function refreshConfigTemplatesList() {
  const listEl = document.getElementById('configTemplatesList');
  const emptyEl = document.getElementById('configTemplatesEmpty');
  if (!listEl) return;

  const templates = await loadWorkoutTemplates(true);

  if (!templates.length) {
    listEl.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:10px 0" id="configTemplatesEmpty">Nenhum template salvo</div>';
    return;
  }

  listEl.innerHTML = templates.map(function(t) {
    var name = escapeHTML(t.name || 'Template');
    var sessoes = Array.isArray(t.treinos) ? t.treinos.length + ' sessão(ões)' : '';
    return '<div class="config-template-card" onclick="applyWorkoutTemplate(' + escapeAttr(JSON.stringify(t)) + ')">' +
      '<div class="config-template-name">' + name + '</div>' +
      (sessoes ? '<div class="config-template-meta">' + sessoes + '</div>' : '') +
    '</div>';
  }).join('');
}

function applyWorkoutTemplate(template) {
  if (!template || !Array.isArray(template.treinos)) return;
  // Injeta o template como scientificConstraints para a próxima geração via API
  window._kronaWorkoutTemplateOverride = {
    referencedPlan: { treinos: template.treinos },
    evidenceReferences: Array.isArray(template.evidenceReferences) ? template.evidenceReferences : [],
    templateMetadata: { templateId: template.id, templateName: template.name, validationError: null },
  };
  showToast('Template "' + escapeHTML(template.name || 'Template') + '" carregado. Clique em Gerar com IA.', 'success', 3500);
  closeTemplatesManager();
}

// Sobrescreve buildWorkoutRequestPayloadFromInput para injetar o override se existir
var _origBuildWorkoutRequestPayloadFromInput = buildWorkoutRequestPayloadFromInput;
buildWorkoutRequestPayloadFromInput = function(input, guard) {
  var payload = _origBuildWorkoutRequestPayloadFromInput(input, guard);
  if (window._kronaWorkoutTemplateOverride) {
    payload.scientificConstraints = Object.assign({}, payload.scientificConstraints, window._kronaWorkoutTemplateOverride);
    window._kronaWorkoutTemplateOverride = null; // consume once
  }
  return payload;
};

async function salvarTreinoComoTemplate() {
  // Coleta os exercícios atuais do container
  var sections = Array.from(document.querySelectorAll('#container .section'));
  if (!sections.length) { showToast('Nenhum exercício para salvar.', 'warning', 2500); return; }

  var treinos = sections.map(function(sec) {
    var nome = sec.getAttribute('data-treino-key') || sec.id || 'Treino';
    var cards = Array.from(sec.querySelectorAll('.exercise-card'));
    var exercicios = cards.map(function(card) {
      return {
        nome: card.getAttribute('data-ex-name') || '',
        series: Number(card.getAttribute('data-ex-sets')) || 3,
        reps: card.getAttribute('data-ex-meta') || '8-12',
      };
    }).filter(function(e) { return !!e.nome; });
    return { nome: nome, exercicios: exercicios };
  }).filter(function(t) { return t.exercicios.length > 0; });

  if (!treinos.length) { showToast('Adicione exercícios antes de salvar.', 'warning', 2500); return; }

  var cfg = getProgramaConfig();
  var templateName = 'Treino ' + (cfg.obj || 'hipertrofia').charAt(0).toUpperCase() + (cfg.obj || 'hipertrofia').slice(1) +
    ' ' + cfg.freq + 'x — ' + new Date().toLocaleDateString('pt-BR');

  try {
    const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    const resp = await fetch(resolveAppApiUrl('/api/kronia/workout/templates'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ template: { name: templateName, treinos: treinos } }),
    });
    const payload = await resp.json();
    if (!payload.ok) throw new Error(payload.error || 'save failed');
    _workoutTemplatesCache = null; // invalida cache
    showToast('✅ Template "' + escapeHTML(templateName) + '" salvo!', 'success', 3500);
    refreshConfigTemplatesList();
  } catch (err) {
    console.error('[save-template] erro:', err);
    showToast('Erro ao salvar template. Tente novamente.', 'error', 3000);
  }
}

async function deleteWorkoutTemplate(templateId) {
  if (!templateId) return;
  if (!await dlgConfirm('Remover este template? Esta ação não pode ser desfeita.')) return;
  try {
    const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    const resp = await fetch(resolveAppApiUrl('/api/kronia/workout/templates?id=' + encodeURIComponent(templateId)), {
      method: 'DELETE',
      headers,
    });
    const payload = await resp.json();
    if (!payload.ok) throw new Error(payload.error || 'delete failed');
    _workoutTemplatesCache = null;
    showToast('Template removido.', 'success', 2000);
    openTemplatesManager(true);
  } catch (err) {
    console.error('[delete-template] erro:', err);
    showToast('Erro ao remover template.', 'error', 2500);
  }
}

async function openTemplatesManager(forceRefresh) {
  const sheet = document.getElementById('templatesManagerSheet');
  if (!sheet) return;
  sheet.style.display = 'flex';
  requestAnimationFrame(function() { sheet.classList.add('show'); });

  const loading = document.getElementById('tmLoading');
  const list = document.getElementById('tmList');
  const empty = document.getElementById('tmEmptyState');
  if (loading) loading.style.display = 'block';
  if (list) list.innerHTML = '';
  if (empty) empty.style.display = 'none';

  const templates = await loadWorkoutTemplates(!!forceRefresh);
  if (loading) loading.style.display = 'none';

  if (!templates.length) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (list) {
    list.innerHTML = templates.map(function(t) {
      var id = escapeAttr(t.id || '');
      var name = escapeHTML(t.name || 'Template');
      var sessoes = Array.isArray(t.treinos) ? t.treinos.length + ' sessão(ões)' : '';
      var exCount = Array.isArray(t.treinos) ? t.treinos.reduce(function(acc, tr) { return acc + (Array.isArray(tr.exercicios) ? tr.exercicios.length : 0); }, 0) : 0;
      var savedAt = t.savedAt ? new Date(t.savedAt).toLocaleDateString('pt-BR') : '';
      return '<div class="tm-card">' +
        '<div class="tm-card-body" onclick="applyWorkoutTemplate(' + escapeAttr(JSON.stringify(t)) + ')">' +
          '<div class="tm-card-name">' + name + '</div>' +
          '<div class="tm-card-meta">' + (sessoes || '') + (exCount ? ' · ' + exCount + ' exercícios' : '') + (savedAt ? ' · ' + savedAt : '') + '</div>' +
        '</div>' +
        '<button class="tm-card-delete" onclick="deleteWorkoutTemplate(\'' + id + '\')" title="Remover template">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');
  }
}

function closeTemplatesManager() {
  const sheet = document.getElementById('templatesManagerSheet');
  if (!sheet) return;
  sheet.classList.remove('show');
  setTimeout(function() { sheet.style.display = 'none'; }, 300);
}

window.addEventListener("resize", syncMainScrollArea);
window.addEventListener("orientationchange", () => setTimeout(syncMainScrollArea, 120));
window.addEventListener("load", () => setTimeout(syncMainScrollArea, 0));
window.addEventListener("load", function() {
  ensureDietTacoCatalogLoaded();
});

/* ── Pós-Treino: atalhos rápidos para o KRONOS ───── */
function _orientPosTreino(msg) {
  try { openOrientacao(); } catch(e) {}
  setTimeout(function() {
    try {
      const inp = document.getElementById('orientExpertInput');
      if (inp) { inp.value = msg; sendOrientExpert(); }
    } catch(e) {}
  }, 400);
}
function orientPosTreinoNutri() {
  _orientPosTreino('Acabei de treinar. O que devo comer agora para maximizar recuperação e crescimento muscular? Me dê opções práticas.');
}
function orientPosTreinoRecup() {
  _orientPosTreino('Quais as melhores estratégias de recuperação pós-treino? Fale sobre sono, alongamento, contraste de temperatura e outras técnicas baseadas em evidência.');
}
function orientPosTreinoSupl() {
  _orientPosTreino('Quais suplementos têm evidência científica real para o período pós-treino? Whey, creatina, BCAA — o que realmente vale a pena e quando tomar?');
}
function orientPosTreinoMob() {
  _orientPosTreino('Me passe um protocolo rápido de mobilidade e alongamento pós-treino (5–10 min) para reduzir rigidez e melhorar recuperação.');
}

/* ═══════════════════════════════════════════════════
   DIVISÃO PICKER
═══════════════════════════════════════════════════ */
const DIVISAO_META = {
  "2": {
    nome: "Full Body",
    split: "Full Body A · Full Body B",
    nivel: "Iniciante",
    nivelColor: "var(--green)",
    tempo: "60–75 min/sessão",
    desc: "Trabalha o corpo inteiro em cada sessão. Ideal para quem está começando ou tem agenda apertada.",
    muscs: ["Peito","Costas","Pernas","Ombros","Braços"],
    muscColor: "rgba(34,197,94,0.12)", muscBorder: "rgba(34,197,94,0.25)", muscText: "var(--green)"
  },
  "3": {
    nome: "PPL",
    split: "Push · Pull · Legs",
    nivel: "Intermediário",
    nivelColor: "var(--accent)",
    tempo: "50–65 min/sessão",
    desc: "A divisão mais popular do mundo. Empurrar, puxar e pernas — cobertura completa com 3 dias.",
    muscs: ["Peito","Ombros","Tríceps","Costas","Bíceps","Pernas"],
    muscColor: "rgba(249,115,22,0.1)", muscBorder: "rgba(249,115,22,0.25)", muscText: "var(--accent)"
  },
  "4": {
    nome: "Upper / Lower",
    split: "Upper A · Lower A · Upper B · Lower B",
    nivel: "Intermediário+",
    nivelColor: "var(--blue)",
    tempo: "50–60 min/sessão",
    desc: "Divide o corpo em superior e inferior, alternando força e hipertrofia. Frequência alta por grupo muscular.",
    muscs: ["Peito","Costas","Ombros","Pernas","Glúteos","Braços"],
    muscColor: "rgba(59,130,246,0.1)", muscBorder: "rgba(59,130,246,0.25)", muscText: "var(--blue)"
  },
  "5": {
    nome: "Bro Split",
    split: "Peito · Costas · Pernas · Ombros · Braços",
    nivel: "Avançado",
    nivelColor: "#a855f7",
    tempo: "45–55 min/sessão",
    desc: "Um músculo por dia, volume máximo por sessão. Permite foco total e recuperação completa.",
    muscs: ["Peito","Costas","Pernas","Ombros","Braços"],
    muscColor: "rgba(168,85,247,0.1)", muscBorder: "rgba(168,85,247,0.25)", muscText: "#a855f7"
  },
  "6": {
    nome: "PPL ×2",
    split: "Push · Pull · Legs (repetido)",
    nivel: "Avançado+",
    nivelColor: "#e11d48",
    tempo: "45–55 min/sessão",
    desc: "Alta frequência: cada músculo 2× por semana. Para atletas com boa base e capacidade de recuperação.",
    muscs: ["Peito","Ombros","Tríceps","Costas","Bíceps","Pernas","Glúteos"],
    muscColor: "rgba(225,29,72,0.1)", muscBorder: "rgba(225,29,72,0.25)", muscText: "#e11d48"
  }
};

let _divFreqSel = 3;


function openDivisaoSheet() {
  _divFreqSel = 3;
  renderDivisaoPreview(3);
  document.querySelectorAll('.div-freq-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.freq) === 3);
  });
  const s = document.getElementById("divisaoSheet");
  s.style.display = "flex";
  requestAnimationFrame(() => s.classList.add("show"));
}

function closeDivisaoSheet() {
  const s = document.getElementById("divisaoSheet");
  s.classList.remove("show");
  setTimeout(() => { s.style.display = "none"; }, 300);
}

function selectDivisaoFreq(freq) {
  _divFreqSel = freq;
  document.querySelectorAll('.div-freq-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.freq) === freq);
  });
  renderDivisaoPreview(freq);
}

function renderDivisaoPreview(freq) {
  const meta  = DIVISAO_META[String(freq)];
  const days  = TREINOS_PRONTOS[String(freq)] || [];
  const ltrs  = ['A','B','C','D','E','F'];

  // Meta box
  document.getElementById("divMetaBox").innerHTML = `
    <div class="div-meta-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/>
        <line x1="6" y1="12" x2="18" y2="12"/><rect x="4.5" y="8.5" width="3" height="7" rx="1"/>
        <rect x="16.5" y="8.5" width="3" height="7" rx="1"/>
      </svg>
    </div>
    <div style="flex:1">
      <div class="div-meta-split">${escapeHTML(meta.nome)} — ${escapeHTML(meta.split)}</div>
      <div class="div-meta-sub">${escapeHTML(meta.desc)}</div>
      <div class="div-meta-tags" style="margin-top:8px">
        <span class="div-meta-tag" style="background:${meta.muscColor};border-color:${meta.muscBorder};color:${meta.muscText}">${escapeHTML(meta.nivel)}</span>
        <span class="div-meta-tag" style="background:var(--bg2);border-color:var(--border);color:rgba(255,255,255,0.55)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 14 14"/></svg>
          ${escapeHTML(meta.tempo)}
        </span>
        ${meta.muscs.map(m => `<span class="div-meta-tag" style="background:${meta.muscColor};border-color:${meta.muscBorder};color:${meta.muscText}">${escapeHTML(m)}</span>`).join('')}
      </div>
    </div>`;

  // Day list
  document.getElementById("divDayList").innerHTML = days.map((d, i) => `
    <div class="div-day-row" onclick="selecionarDivDia(${i})" data-day-idx="${i}">
      <div class="div-day-badge">${ltrs[i]}</div>
      <div style="flex:1;min-width:0">
        <div class="div-day-name">${escapeHTML(d.nome)}</div>
        <div class="div-day-exs">
          ${d.exs.slice(0,5).map(e => `<span class="div-day-ex-chip">${escapeHTML(e)}</span>`).join('')}
          ${d.exs.length > 5 ? `<span class="div-day-ex-chip" style="color:var(--accent)">+${d.exs.length-5}</span>` : ''}
        </div>
      </div>
      <div style="color:var(--accent);font-size:0.75rem;font-weight:700;flex-shrink:0;align-self:center;opacity:0.7">Usar</div>
    </div>`).join('');
}

function selecionarDivDia(idx) {
  // Highlight row briefly then navigate to config
  document.querySelectorAll('.div-day-row').forEach((r, i) => {
    r.classList.toggle('selected', i === idx);
  });
  // Navigate to config screen with current frequency pre-selected
  setTimeout(() => abrirConfigComFreq('manual'), 150);
}

function abrirConfigComFreq(modo) {
  // Sync selected frequency into config chips
  const freqStr = String(_divFreqSel);
  const freqEl  = document.getElementById("freq");
  if (freqEl) freqEl.value = freqStr;
  document.querySelectorAll("#freqChips .config-chip").forEach(c => {
    c.classList.toggle("active", c.dataset.val === freqStr);
  });
  closeDivisaoSheet();
  // Store chosen mode so config buttons know what was intended
  window._divModo = modo;
  setTimeout(openKronosWorkoutEntry, 220);
}

function usarTemplateManualConfig() {
  carregarTemplateManual();
  closeConfig();
}

function carregarTemplateManual() {
  const days = TREINOS_PRONTOS[String(_divFreqSel)] || [];
  const nav  = document.getElementById("nav");
  const cont = document.getElementById("container");
  nav.innerHTML = ""; cont.innerHTML = "";
  days.forEach((d, idx) => {
    const labelCurto = d.nome.split(" ")[0];
    nav.innerHTML += `<div class="pill ${idx===0?"active":""}" id="p${idx}" onclick="tab(${idx})">${escapeHTML(labelCurto)}</div>`;
    const sec = document.createElement("div");
    sec.id = `sec${idx}`; sec.className = `section ${idx===0?"active":""}`;
    sec.setAttribute("data-treino-key", d.nome);
    cont.appendChild(sec);
    d.exs.forEach((exNome, exIdx) => criarCard(exNome, sec.id, null, null, null, null, exIdx));
  });
  addPillControls();
  scheduleDraftSave();
  closeDivisaoSheet();
  showToast(`✅ Template ${_divFreqSel}× carregado! Personalize como quiser.`, "success", 3500);
}

function carregarTemplateComIA() {
  // Sync the freq chip so gerarTreinoDoPrograma picks it up
  const freqEl = document.getElementById("freq");
  if (freqEl) freqEl.value = String(_divFreqSel);
  document.querySelectorAll("#freqChips .config-chip").forEach(c => {
    c.classList.toggle("active", c.dataset.val === String(_divFreqSel));
  });
  closeDivisaoSheet();
  setTimeout(() => gerarTreinoDoPrograma(), 300);
}

function openInstrucoes() {
  const s = document.getElementById("instrucSheet");
  s.style.display = "flex";
  requestAnimationFrame(() => s.classList.add("show"));
}

function closeInstrucoes() {
  const s = document.getElementById("instrucSheet");
  s.classList.remove("show");
  setTimeout(() => { s.style.display = "none"; }, 300);
}


function openAI() {
  document.getElementById("aiModal").classList.add("show");
  document.getElementById("aiModal").style.display = "flex";
  if (_aiHistory.length === 0) {
    const es = document.getElementById("kronosEmptyState");
    if (es) es.style.display = "flex";
    setTimeout(() => document.getElementById("aiInput")?.focus(), 300);
    return;
  }
  setTimeout(() => document.getElementById("aiInput")?.focus(), 300);
}

function closeAI() {
  document.getElementById("aiModal").style.display = "none";
  document.getElementById("aiModal").classList.remove("show");
}

function clearAIChat() {
  _aiHistory = [];
  const container = document.getElementById("aiMessages");
  const es = container.querySelector("#kronosEmptyState");
  container.innerHTML = "";
  if (es) { container.appendChild(es); es.style.display = "flex"; }
  else {
    container.insertAdjacentHTML("afterbegin", `<div id="kronosEmptyState" class="kronos-empty-state" style="display:flex;">
      <div class="kronos-pulse-ring"><div class="kronos-pulse-core">KRONOS</div></div>
      <div class="kronos-empty-title">Seu assistente de performance</div>
      <div class="kronos-empty-sub">Cruzo seus treinos, exames e dieta para dar respostas precisas.</div>
      <div class="kronos-empty-pills">
        <button class="kronos-empty-pill" onclick="aiQuick('Revisar meu progresso e sugerir o que mudar esta semana.')">Como está meu progresso?</button>
        <button class="kronos-empty-pill" onclick="aiQuick('Explique meu treino de hoje e os pontos de atenção.')">Sugestão de treino hoje</button>
        <button class="kronos-empty-pill" onclick="aiQuick('Montar minha dieta com base no meu treino, objetivo e rotina.')">Analisar minha dieta</button>
        <button class="kronos-empty-pill" onclick="aiQuick('Ver o que meus exames mudam na dieta e no treino.')">Revisar meus exames</button>
      </div></div>`);
  }
}

function renderMarkdown(text) {
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/^#{1,3} (.+)$/gm, "<strong>$1</strong>")
    .replace(/^[-•] (.+)$/gm, "• $1")
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

function getKronosAvatarMarkup(wrapperClass = "kronos-reactor-avatar") {
  return `<div class="${wrapperClass}" aria-label="Avatar do KRONOS">
    <img src="/Kronia.png" alt="Logo KRONIA" loading="lazy" decoding="async" />
  </div>`;
}

function addAIMessage(role, text, isThinking = false) {
  const container = document.getElementById("aiMessages");
  if (!container) return;
  const es = document.getElementById("kronosEmptyState");
  if (es) es.style.display = "none";

  const div = document.createElement("div");
  div.className = `ai-msg ${role}`;
  const now = new Date().toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
  const avatarSVG = getKronosAvatarMarkup();

  if (role === "assistant") {
    if (isThinking) {
      div.id = "aiThinking";
      div.innerHTML = `${avatarSVG}<div class="ai-avatar-inner"><div class="ai-bubble thinking"><div class="ai-dots"><span></span><span></span><span></span></div></div></div>`;
      const kronosAvatar = div.querySelector('.kronos-reactor-avatar');
      if (kronosAvatar) kronosAvatar.classList.add('k-thinking', 'k-motion-background');
    } else {
      div.innerHTML = `${avatarSVG}<div class="ai-avatar-inner"><div class="ai-bubble">${renderMarkdown(text)}</div><div class="ai-msg-time">${now}</div></div>`;
      requestAnimationFrame(function() { div.classList.add('k-fade-in'); });
    }
  } else {
    div.innerHTML = `<div class="ai-bubble">${renderMarkdown(text)}</div><div class="ai-msg-time">${now}</div>`;
    requestAnimationFrame(function() { div.classList.add('k-fade-in'); });
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function removeThinking() {
  document.getElementById("aiThinking")?.remove();
}

function _isPedidoDeTreino(msg) {
  return /\b(cri(e|a|ar)|ger(e|a|ar)|mont(e|a|ar)|elabor(e|a|ar)|faz(er?|a|e)|quero|preciso)\b.{0,30}\b(treino|programa|plano|ficha)\b/i.test(msg);
}

function logUiEvent(eventName, payload) {
  try { console.info("[kronia.ui]", eventName, payload || {}); } catch (_) {}
}

function toSafeTitleCase(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(function(word) {
      var lower = word.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

function buildApiErrorEnvelope(message, errorCode) {
  return {
    success: false,
    type: "error",
    action: null,
    message: message || "Não consegui montar a dieta agora. Tente novamente em instantes.",
    data: { content: [] },
    error: errorCode || "INVALID_CONTRACT",
    meta: { fallback: true }
  };
}

function resolveAiFriendlyError(payload, httpStatus) {
  const state = String(payload?.state || '').toLowerCase();
  const code = String(payload?.errorCode || payload?.error || '').toLowerCase();
  const retryable = !!payload?.retryable;

  if (state === 'limit_reached_plan' || code === 'limit_reached_plan' || code === 'quota_exceeded') {
    return payload?.message || 'Você atingiu o limite diário do seu plano. Faça upgrade para continuar.';
  }
  if (state === 'rate_limited_temporary' || code === 'rate_limited_temporary' || httpStatus === 429) {
    return payload?.message || 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.';
  }
  if (state === 'provider_unavailable' || code === 'provider_unavailable' || httpStatus === 503 || retryable) {
    return payload?.message || 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.';
  }
  if (state === 'invalid_request' || httpStatus === 400) {
    return payload?.message || 'Não consegui processar esta solicitação. Revise os dados e tente novamente.';
  }
  return payload?.message || 'Não consegui processar sua solicitação agora.';
}

function normalizeDietContentNode(payload) {
  const directData = payload && payload.data && typeof payload.data === "object" ? payload.data : {};
  const fromDataNode = Array.isArray(directData.content)
    ? directData.content.find(n => n && typeof n === "object" && /^(diet_result|diet_primary|diet_failsafe)$/i.test(String(n.type || "")))
    : null;
  const planData = fromDataNode?.data || directData.diet || directData.plan || payload?.diet || payload?.plan || null;
  const text = String(fromDataNode?.text || payload?.message || "").trim();
  if (!planData && !text) return null;
  return {
    type: String(fromDataNode?.type || payload?.type || "diet_result"),
    data: planData && typeof planData === "object" ? planData : {},
    text
  };
}

function getApiContentNodes(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (!payload.data || typeof payload.data !== "object") payload.data = {};
  let nodes = [];
  if (Array.isArray(payload.data.content)) {
    nodes = payload.data.content;
  } else if (Array.isArray(payload.content)) {
    nodes = payload.content;
  } else if (/^(diet_result|diet_primary|diet_failsafe)$/i.test(String(payload.type || ""))) {
    const rebuilt = normalizeDietContentNode(payload);
    nodes = rebuilt ? [rebuilt] : [];
  }
  payload.data.content = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
  return payload.data.content;
}

function normalizeConversationIntentType(action) {
  var canonicalAction = resolveCanonicalKroniaAction(action);
  if (canonicalAction === 'open_training') return 'open_training';
  if (canonicalAction === 'open_diet') return 'open_diet';
  if (canonicalAction === 'generate_diet') return 'generate_diet';
  return null;
}

function sanitizeConversationIntentPayload(intentType, payload) {
  var safePayload = sanitizeCtaObject(payload);
  var normalized = Object.create(null);
  if (intentType === 'open_training') {
    var questionnaire = safePayload.questionnaire && typeof safePayload.questionnaire === 'object' ? safePayload.questionnaire : {};
    var rawObjective = typeof safePayload.objective === 'string' ? safePayload.objective : (typeof questionnaire.objetivo === 'string' ? questionnaire.objetivo : '');
    var rawLevel = typeof safePayload.level === 'string' ? safePayload.level : (typeof questionnaire.nivel === 'string' ? questionnaire.nivel : '');
    var rawEnvironment = typeof safePayload.environment === 'string' ? safePayload.environment : (typeof questionnaire.local === 'string' ? questionnaire.local : '');
    var rawDays = safePayload.days_per_week != null ? safePayload.days_per_week : questionnaire.frequencia;
    var normalizedDays = null;
    if (rawDays != null) {
      var digitsMatch = String(rawDays).match(/\d+/);
      if (digitsMatch && Number.isFinite(Number(digitsMatch[0]))) normalizedDays = Number(digitsMatch[0]);
    }
    if (rawObjective) normalized.objective = rawObjective;
    if (rawLevel) normalized.level = rawLevel;
    if (normalizedDays != null) normalized.days_per_week = Math.max(1, Math.min(6, normalizedDays));
    if (typeof safePayload.split === 'string') normalized.split = safePayload.split;
    if (rawEnvironment) normalized.environment = rawEnvironment;
    var restrictions = Array.isArray(safePayload.restrictions)
      ? safePayload.restrictions
      : (questionnaire.lesao ? [questionnaire.lesao] : []);
    if (Array.isArray(restrictions)) normalized.restrictions = restrictions.map(function (v) { return String(v || '').trim(); }).filter(Boolean).slice(0, 8);
    if (typeof safePayload.notes === 'string') normalized.notes = safePayload.notes.slice(0, 500);
    if (typeof safePayload.origin_message === 'string') normalized.origin_message = safePayload.origin_message.slice(0, 500);
    return normalized;
  }
  if (intentType === 'open_diet' || intentType === 'generate_diet') {
    if (typeof safePayload.objective === 'string') normalized.objective = safePayload.objective;
    if (safePayload.calories != null && Number.isFinite(Number(safePayload.calories))) normalized.calories = Number(safePayload.calories);
    if (safePayload.meals != null && Number.isFinite(Number(safePayload.meals))) normalized.meals = Number(safePayload.meals);
    if (Array.isArray(safePayload.restrictions)) normalized.restrictions = safePayload.restrictions.map(function (v) { return String(v || '').trim(); }).filter(Boolean).slice(0, 12);
    if (typeof safePayload.dietary_style === 'string') normalized.dietary_style = safePayload.dietary_style;
    if (typeof safePayload.notes === 'string') normalized.notes = safePayload.notes.slice(0, 500);
    if (typeof safePayload.origin_message === 'string') normalized.origin_message = safePayload.origin_message.slice(0, 500);
    return normalized;
  }
  return {};
}

function buildCanonicalConversationIntent(data) {
  if (!data || typeof data !== 'object') return null;
  var intentType = normalizeConversationIntentType(data.type);
  if (!intentType) return null;
  var source = data.source === 'inferred' ? 'inferred' : 'agent';
  return {
    type: intentType,
    eligible: true,
    label: intentType === 'open_training' ? 'Abrir treino' : (intentType === 'generate_diet' ? 'Gerar dieta' : (intentType === 'open_labs_upload' ? 'Enviar exame' : 'Abrir dieta')),
    target: intentType === 'open_training' ? 'home_training_card' : (intentType === 'open_labs_upload' ? 'home_labs_card' : 'home_diet_card'),
    source: source,
    payload: sanitizeConversationIntentPayload(intentType, data.payload || {}),
    meta: sanitizeCtaObject(data.meta || {}),
  };
}

function inferConversationCtaFromApiResponse(payload) {
  if (!payload || typeof payload !== 'object') return null;
  var explicitCanonical = buildCanonicalConversationIntent(payload.conversationIntent);
  if (explicitCanonical) {
    trackKroniaCta('api_cta_inferred', 'success', {
      normalizedAction: explicitCanonical.type,
      source: explicitCanonical.source,
      hasPayload: !!Object.keys(explicitCanonical.payload || {}).length,
      inferredFrom: 'explicit_conversation_intent',
    });
    return explicitCanonical;
  }

  var action = String(payload.action || '').trim();
  var buttonType = String(payload.buttonType || '').trim().toLowerCase();
  var shouldCreateButton = payload.shouldCreateButton === true;
  var messageText = String(payload.message || '').toLowerCase();
  var inferredAction = null;
  var wasTextuallyInferred = false;
  var isOfferOnlyText = /\b(posso|poderia|consigo)\b.{0,32}\b(abrir|gerar|montar|criar|monte|crie)\b/.test(messageText);

  if (action === 'abrir_tela_treino_com_payload' || action === 'open_workout_flow' || buttonType === 'treino') inferredAction = 'open_training';
  if (action === 'gerar_pdf_dieta' || action === 'abrir_config_dieta') inferredAction = inferredAction || 'open_diet';
  if (action === 'open_diet_flow') inferredAction = inferredAction || 'generate_diet';
  if (buttonType === 'dieta' && shouldCreateButton) inferredAction = inferredAction || 'generate_diet';
  if (buttonType === 'dieta') inferredAction = inferredAction || 'open_diet';
  if (!inferredAction && !isOfferOnlyText && /\btreino\b/.test(messageText) && /\b(abrir|gerar|montar|criar|monte|crie)\b/.test(messageText)) {
    inferredAction = 'open_training';
    wasTextuallyInferred = true;
  }
  if (!inferredAction && !isOfferOnlyText && /\bdieta\b/.test(messageText) && /\b(abrir|gerar|montar|criar|monte|crie)\b/.test(messageText)) {
    inferredAction = /\b(gerar|montar|criar|monte|crie)\b/.test(messageText) ? 'generate_diet' : 'open_diet';
    wasTextuallyInferred = true;
  }

  var canonicalAction = resolveCanonicalKroniaAction(inferredAction);
  if (!canonicalAction || (!shouldCreateButton && !inferredAction)) {
    trackKroniaCta('api_cta_rejected', 'success', {
      reason: 'not_eligible',
      actionRaw: action || null,
      buttonType: buttonType || null,
      shouldCreateButton: shouldCreateButton,
    });
    return null;
  }

  var rawPayloadByAction = canonicalAction === 'open_training'
    ? sanitizeCtaObject(payload.workoutPayload)
    : sanitizeCtaObject(payload.dietPayload);
  if (!Object.keys(rawPayloadByAction).length && !shouldCreateButton && !wasTextuallyInferred) {
    trackKroniaCta('api_cta_rejected', 'success', {
      reason: 'missing_payload_for_inferred_action',
      normalizedAction: canonicalAction,
    });
    return null;
  }
  // For purely textual inference without explicit payload, seed origin_message as minimal context.
  if (!Object.keys(rawPayloadByAction).length && wasTextuallyInferred) {
    rawPayloadByAction = Object.create(null);
    if (messageText) rawPayloadByAction.origin_message = String(messageText).slice(0, 500);
  }

  var intent = buildCanonicalConversationIntent({
    type: canonicalAction,
    source: shouldCreateButton ? 'agent' : 'inferred',
    payload: rawPayloadByAction,
    meta: {
      source: 'api_agent_response',
      inferred_from: shouldCreateButton ? 'explicit_fields' : (wasTextuallyInferred ? 'textual_fallback' : 'action_field'),
      originalAction: action || null,
    },
  });
  if (!intent) return null;
  trackKroniaCta('api_cta_inferred', 'success', {
    normalizedAction: intent.type,
    source: intent.source,
    hasPayload: !!Object.keys(intent.payload || {}).length,
  });
  return intent;
}

function buildCtaFromCanonicalIntent(intent) {
  if (!intent || intent.eligible !== true) return null;
  var action = resolveCanonicalKroniaAction(intent.type);
  if (!action) return null;
  return {
    action: action,
    label: String(intent.label || (action === 'open_training' ? 'Abrir treino' : (action === 'generate_diet' ? 'Gerar dieta' : (action === 'open_labs_upload' ? 'Enviar exame' : 'Abrir dieta')))),
    payload: sanitizeConversationIntentPayload(action, intent.payload || {}),
    meta: sanitizeCtaObject(intent.meta || {}),
    intentSource: intent.source || 'agent',
    targetModule: intent.target === 'home_training_card' ? 'programa' : (intent.target === 'home_labs_card' ? 'labs' : 'dieta'),
  };
}

function persistPendingConversationIntent(intent) {
  var normalized = buildCanonicalConversationIntent(intent);
  if (!normalized) return false;
  var envelope = {
    v: 1,
    type: normalized.type,
    target: normalized.target,
    source: normalized.source,
    payload: sanitizeConversationIntentPayload(normalized.type, normalized.payload || {}),
    meta: sanitizeCtaObject(normalized.meta || {}),
    createdAt: Date.now(),
  };
  try {
    localStorage.setItem(KRONIA_PENDING_INTENT_KEY, JSON.stringify(envelope));
    trackKroniaCta('pending_intent_persisted', 'success', {
      normalizedAction: envelope.type,
      target: envelope.target,
      source: envelope.source,
      hasPayload: !!Object.keys(envelope.payload || {}).length,
    });
    return true;
  } catch (_) {
    trackKroniaCta('pending_intent_persist_failed', 'error', {
      normalizedAction: envelope.type,
    });
    return false;
  }
}

function readPendingConversationIntent() {
  try {
    var raw = localStorage.getItem(KRONIA_PENDING_INTENT_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function clearPendingConversationIntent() {
  try { localStorage.removeItem(KRONIA_PENDING_INTENT_KEY); } catch (_) {}
}

function schedulePendingConversationIntentConsumption(reason) {
  if (__kroniaPendingIntentConsumeScheduled) return;
  __kroniaPendingIntentConsumeScheduled = true;
  setTimeout(function () {
    __kroniaPendingIntentConsumeScheduled = false;
    consumePendingConversationIntentFromHome(reason || 'scheduled');
  }, 30);
}

function hydrateTrainingFromConversationIntent(payload) {
  var safePayload = sanitizeConversationIntentPayload('open_training', payload || {});
  if (safePayload.objective) {
    var objectiveMap = { hipertrofia: 'hipertrofia', 'ganho de massa': 'hipertrofia', massa: 'hipertrofia', definicao: 'definicao', força: 'forca', forca: 'forca', resistencia: 'resistencia', saúde: 'saude', saude: 'saude' };
    var objectiveValue = objectiveMap[String(safePayload.objective).toLowerCase()] || String(safePayload.objective).toLowerCase();
    var objectiveChip = document.querySelector('#objChips [data-val="' + objectiveValue + '"]');
    if (objectiveChip && typeof selectObj === 'function') selectObj(objectiveChip);
  }
  if (safePayload.level) {
    var levelMap = { iniciante: 'iniciante', intermediário: 'intermediario', intermediario: 'intermediario', avançado: 'avancado', avancado: 'avancado' };
    var levelValue = levelMap[String(safePayload.level).toLowerCase()] || String(safePayload.level).toLowerCase();
    var levelChip = document.querySelector('#nivelChips [data-val="' + levelValue + '"]');
    if (levelChip && typeof selectNivel === 'function') selectNivel(levelChip);
  }
  if (safePayload.days_per_week != null) {
    var freqValue = String(Math.max(1, Math.min(6, Number(safePayload.days_per_week))));
    var freqInput = document.getElementById('freq');
    if (freqInput) freqInput.value = freqValue;
    var freqChip = document.querySelector('#freqChips [data-val="' + freqValue + '"]');
    if (freqChip && typeof selectFreq === 'function') selectFreq(freqChip);
  }
  if (safePayload.environment) {
    var environmentRaw = String(safePayload.environment).toLowerCase();
    var equipValue = /hotel/.test(environmentRaw) ? 'hotel' : (/casa|sem equipamento|bodyweight/.test(environmentRaw) ? 'casa' : (/halter/.test(environmentRaw) ? 'halteres' : 'academia'));
    var equipChip = document.querySelector('#equipChips [data-val="' + equipValue + '"]');
    if (equipChip && typeof selectEquip === 'function') selectEquip(equipChip);
  }
  if (Array.isArray(safePayload.restrictions) && safePayload.restrictions.length) {
    document.querySelectorAll('.config-chip-restric').forEach(function (chip) { chip.classList.remove('active'); });
    var restrictionMap = {
      joelho: 'joelho',
      ombro: 'ombro',
      lombar: 'lombar',
      coluna: 'lombar',
      cervical: 'cervical',
      punho: 'punho',
      cotovelo: 'cotovelo',
      quadril: 'quadril'
    };
    safePayload.restrictions.forEach(function (item) {
      var raw = String(item || '').toLowerCase();
      Object.keys(restrictionMap).forEach(function (key) {
        if (raw.indexOf(key) >= 0) {
          var chip = document.querySelector('.config-chip-restric[data-val="' + restrictionMap[key] + '"]');
          if (chip) chip.classList.add('active');
        }
      });
    });
    var anyRestriction = Array.from(document.querySelectorAll('.config-chip-restric.active')).some(function (chip) {
      return chip.dataset.val !== 'nenhuma';
    });
    if (!anyRestriction) document.querySelector('.config-chip-restric[data-val="nenhuma"]')?.classList.add('active');
  }
  return safePayload;
}

function hydrateDietFromConversationIntent(payload) {
  var safePayload = sanitizeConversationIntentPayload('open_diet', payload || {});
  if (safePayload.objective) {
    var objMap = { emagrecer: 'emagrecimento', emagrecimento: 'emagrecimento', hipertrofia: 'hipertrofia', manutencao: 'manutencao', forca: 'forca', recomposicao: 'recomposicao' };
    var objValue = objMap[String(safePayload.objective).toLowerCase()] || String(safePayload.objective).toLowerCase();
    var objChip = document.querySelector('#dietaObjChips [data-val="' + objValue + '"]');
    if (objChip && typeof selDietaObj === 'function') selDietaObj(objChip);
  }
  if (safePayload.meals != null) {
    var mealsInput = document.getElementById('dietaRefeicoes');
    if (mealsInput) mealsInput.value = String(Math.max(2, Math.min(8, Number(safePayload.meals))));
  }
  if (safePayload.restrictions && safePayload.restrictions.length) {
    var restrictionsInput = document.getElementById('dietaRestric');
    if (restrictionsInput && !restrictionsInput.value.trim()) restrictionsInput.value = safePayload.restrictions.join(', ');
  }
  if (safePayload.dietary_style) {
    var styleInput = document.getElementById('dietaPadrao');
    if (styleInput && !styleInput.value) styleInput.value = String(safePayload.dietary_style);
  }
  return safePayload;
}

function consumePendingConversationIntentFromHome(reason) {
  var pending = readPendingConversationIntent();
  if (!pending) return false;
  var createdAt = Number(pending.createdAt || 0);
  var ageMs = createdAt > 0 ? (Date.now() - createdAt) : Infinity;
  if (!Number.isFinite(ageMs) || ageMs > KRONIA_PENDING_INTENT_TTL_MS) {
    clearPendingConversationIntent();
    trackKroniaCta('pending_intent_expired', 'success', {
      type: String(pending.type || ''),
      reason: reason || null,
    });
    return false;
  }

  var intent = buildCanonicalConversationIntent({
    type: pending.type,
    source: pending.source || 'agent',
    payload: pending.payload || {},
    meta: pending.meta || {},
  });
  if (!intent) {
    clearPendingConversationIntent();
    trackKroniaCta('conversation_cta_rejected', 'error', {
      reason: 'invalid_pending_intent_shape',
    });
    return false;
  }

  clearPendingConversationIntent();
  trackKroniaCta('pending_intent_consumed', 'success', {
    normalizedAction: intent.type,
    target: intent.target,
    reason: reason || null,
  });

  try {
    if (intent.type === 'open_training') {
      window.openKronosWorkoutEntry?.();
      trackKroniaCta('home_card_auto_opened', 'success', { type: intent.type, target: intent.target });
      return true;
    }
    if (intent.type === 'open_diet' || intent.type === 'generate_diet') {
      var hydratedDietPayload = hydrateDietFromConversationIntent(intent.payload || {});
      if (intent.type === 'generate_diet') {
        openDietaSheet?.(Object.assign({}, hydratedDietPayload, {
          source: 'chat',
          fromChatIntent: true,
          autoGenerate: true,
        }));
      } else {
        navTo?.('dieta');
        openDietDataScreen?.();
      }
      trackKroniaCta('home_card_auto_opened', 'success', { type: intent.type, target: intent.target });
      trackKroniaCta('home_card_hydrated_from_chat', 'success', { type: intent.type, hasPayload: !!Object.keys(hydratedDietPayload).length });
      return true;
    }
  } catch (_) {
    trackKroniaCta('home_card_auto_open_failed', 'error', {
      type: intent.type,
      target: intent.target,
    });
    return false;
  }
  return false;
}

function ensureApiContract(payload, contextName) {
  const valid = !!payload && typeof payload === "object"
    && typeof payload.success === "boolean"
    && typeof payload.type === "string"
    && typeof payload.message === "string";
  if (!valid) {
    try { window.KroniaIntelligence?.track?.({ module: 'chat', action: 'contract_failure', status: 'error', severity: 'high', problemCode: 'INVALID_CONTRACT', source: 'app_ensure_api_contract', metadata: { context: contextName || 'unknown' } }); } catch (_) {}
    logUiEvent("diet_response_invalid_contract", {
      context: contextName || "unknown",
      keys: payload && typeof payload === "object" ? Object.keys(payload) : null
    });
    return buildApiErrorEnvelope("Não consegui montar a dieta agora. Tente novamente em instantes.", "INVALID_CONTRACT");
  }
  if (!payload.data || typeof payload.data !== "object") payload.data = { content: [] };
  const contentNodes = getApiContentNodes(payload);
  if (/^(diet_result|diet_primary|diet_failsafe)$/i.test(String(payload.type || ""))) {
    const normalizedDietNode = normalizeDietContentNode(payload);
    payload.data.content = normalizedDietNode ? [normalizedDietNode] : [];
  } else if (!Array.isArray(contentNodes)) {
    payload.data.content = [];
  }
  if (!Array.isArray(payload.data.content)) payload.data.content = [];
  return payload;
}

async function parseApiJsonSafely(response) {
  const rawText = await response.text();
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === "object") return ensureApiContract(parsed, "parseApiJsonSafely");
  } catch (err) {
    try { window.KroniaIntelligence?.track?.({ module: 'chat', action: 'contract_failure', status: 'error', severity: 'high', problemCode: 'INVALID_JSON', source: 'app_parse_api_json', metadata: { httpStatus: response && response.status } }); } catch (_) {}
    console.warn("[app] json_parse_failed", err && err.message);
    logUiEvent("diet_response_invalid_contract", {
      context: "json_parse_failed",
      status: response && response.status,
      contentType: response && response.headers ? response.headers.get("content-type") : null,
      rawPreview: String(rawText || "").slice(0, 200)
    });
  }
  return buildApiErrorEnvelope("Não consegui montar a dieta agora. Tente novamente em instantes.", "INVALID_JSON");
}

function extractDietRenderModel(payload) {
  const safePayload = ensureApiContract(payload, "extractDietRenderModel");
  const nodes = getApiContentNodes(safePayload);
  const node = nodes.find(n => n && /^(diet_result|diet_primary|diet_failsafe)$/i.test(String(n.type || ""))) || normalizeDietContentNode(safePayload);
  if (!node || !node.data || typeof node.data !== "object") return null;
  const plan = node.data;
  const structuredPlan = plan.planoEstruturado && typeof plan.planoEstruturado === "object" ? plan.planoEstruturado : null;
  const visualPrescription = plan.visualPrescription && typeof plan.visualPrescription === "object"
    ? plan.visualPrescription
    : (structuredPlan && structuredPlan.visualPrescription && typeof structuredPlan.visualPrescription === "object" ? structuredPlan.visualPrescription : null);
  const primaryMeals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  const structuredMeals = structuredPlan && Array.isArray(structuredPlan.refeicoes) ? structuredPlan.refeicoes : [];
  const visualMeals = visualPrescription && Array.isArray(visualPrescription.meals)
    ? visualPrescription.meals.map(function(meal) {
        return {
          nome: meal.name || 'Refeição',
          horario: meal.time || '',
          alimentos: (Array.isArray(meal.items) ? meal.items : []).map(function(item) {
            var text = String(item || '');
            var parts = text.split(/\s+-\s+/);
            return {
              nome: parts.shift() || 'Alimento',
              qtde: parts.join(' - '),
              kcal: 0,
              prot: 0,
              carb: 0,
              gord: 0
            };
          }),
          subtotal: { kcal: Number(meal.kcal_estimada || 0), prot: 0, carb: 0, gord: 0 },
          substituicoes: []
        };
      })
    : [];
  const meals = visualMeals.length ? visualMeals : (primaryMeals.length ? primaryMeals : structuredMeals);
  const hasFailSafeOrientation = !!(plan.failSafe && (plan.limitedOrientation || (Array.isArray(plan.observacoes) && plan.observacoes.length)));
  if (!meals.length && !plan.flow_state && !hasFailSafeOrientation) return null;
  return {
    text: String(node.text || safePayload.message || "").trim(),
    flowState: plan.flow_state || null,
    failSafe: plan.failSafe === true,
    limitedOrientation: plan.limitedOrientation && typeof plan.limitedOrientation === "object" ? plan.limitedOrientation : null,
    meta: plan.meta && typeof plan.meta === "object" ? plan.meta : (structuredPlan && structuredPlan.meta && typeof structuredPlan.meta === "object" ? structuredPlan.meta : {}),
    visualPrescription: visualPrescription,
    refeicoes: meals,
    hidratacao: plan.hidratacao && typeof plan.hidratacao === "object" ? plan.hidratacao : (structuredPlan && structuredPlan.hidratacao && typeof structuredPlan.hidratacao === "object" ? structuredPlan.hidratacao : {}),
    observacoes: Array.isArray(plan.observacoes) ? plan.observacoes : (structuredPlan && Array.isArray(structuredPlan.observacoes) ? structuredPlan.observacoes : [])
  };
}

function renderDietModelAsText(model) {
  if (!model) return "";
  if (model.flowState && model.flowState !== 'failsafe') return model.text || "Vamos continuar montando sua dieta.";
  const meta = model.meta || {};
  const meals = Array.isArray(model.refeicoes) ? model.refeicoes : [];
  const orientacoes = Array.isArray(model.observacoes) ? model.observacoes : [];
  const hasRenderablePlan = !!meals.length;
  if (model.failSafe && !hasRenderablePlan) {
    const fallbackNotes = Array.isArray(model.observacoes) ? model.observacoes.filter(Boolean) : [];
    const safeMessage = String((model.limitedOrientation && model.limitedOrientation.orientacao) || model.text || fallbackNotes[0] || "Dados insuficientes para montar a dieta completa.").trim();
    return [
      "##ORIENTACAO LIMITADA",
      safeMessage,
      fallbackNotes.length > 1 ? ("\n" + fallbackNotes.slice(1).map(function(note) { return "- " + note; }).join("\n")) : ""
    ].join("\n").trim();
  }
  const metaBlock = [
    "PRESCRIÇÃO NUTRICIONAL",
    "##META",
    "CALORIAS: " + (meta.calorias ?? ""),
    "PROTEINA: " + (meta.proteina ?? ""),
    "CARB: " + (meta.carbo ?? ""),
    "GORDURA: " + (meta.gordura ?? ""),
    "TMB: " + (meta.tmb ?? ""),
    "TDEE: " + (meta.get ?? "")
  ].join("\n");
  const mealBlocks = "PLANO ALIMENTAR\n\n" + meals.map(function(ref) {
    const alimentos = Array.isArray(ref.alimentos) && ref.alimentos.length
      ? ref.alimentos
      : []
          .concat((Array.isArray(ref.proteinas) ? ref.proteinas : []).map(function(item) { return { nome: item, qtde: "", kcal: "", prot: "", carb: "", gord: "" }; }))
          .concat((Array.isArray(ref.carbos) ? ref.carbos : []).map(function(item) { return { nome: item, qtde: "", kcal: "", prot: "", carb: "", gord: "" }; }))
          .concat((Array.isArray(ref.extras) ? ref.extras : []).map(function(item) { return { nome: item, qtde: "", kcal: "", prot: "", carb: "", gord: "" }; }));
    const linhas = alimentos.map(function(item) {
      return [
        item.nome || "",
        item.qtde || "",
        item.kcal ?? "",
        item.prot ?? "",
        item.carb ?? "",
        item.gord ?? ""
      ].join("|");
    });
    const subtotal = ref.subtotal || {};
    return [
      "##REFEICAO",
      "NOME: " + (ref.nome || "Refeição"),
      "HORARIO: " + (ref.horario || ""),
      "TAG: " + (ref.foco || "Plano KRONIA")
    ].concat(linhas).concat([
      "SUBTOTAL||" + (subtotal.kcal ?? "") + "|" + (subtotal.prot ?? "") + "|" + (subtotal.carb ?? "") + "|" + (subtotal.gord ?? "")
    ]).join("\n");
  }).join("\n\n");
  const resumoBlock = [
    "SEQUÊNCIA DE CONSUMO",
    "##RESUMO",
  ].concat(meals.map(function(ref) {
    const subtotal = ref.subtotal || {};
    return [
      ref.nome || "Refeição",
      subtotal.kcal ?? "",
      subtotal.prot ?? "",
      subtotal.carb ?? "",
      subtotal.gord ?? ""
    ].join("|");
  })).concat([
    "TOTAL||" + (meta.calorias ?? "") + "|" + (meta.proteina ?? "") + "|" + (meta.carbo ?? "") + "|" + (meta.gordura ?? "")
  ]).join("\n");
  const substitutionNotes = meals.reduce(function(acc, meal) {
    (Array.isArray(meal.substituicoes) ? meal.substituicoes : []).slice(0, 3).forEach(function(entry) {
      if (entry && entry.item && Array.isArray(entry.opcoes) && entry.opcoes.length) {
        acc.push((meal.nome || "Refeição") + " · " + entry.item + ": " + entry.opcoes.slice(0, 3).join(", "));
      }
    });
    return acc;
  }, []);
  const substitutionsBlock = [
    "SUBSTITUIÇÕES"
  ].concat(substitutionNotes.length
    ? substitutionNotes.map(function(note) { return "- " + note; })
    : ["- Use substituições equivalentes em proteína, carboidrato e gordura quando precisar trocar alimentos."]).join("\n");
  const orientBlock = [
    "ORIENTAÇÕES",
    "##ORIENTACOES",
    "Água|" + ((model.hidratacao && model.hidratacao.litros) ? (model.hidratacao.litros + " L/dia") : "Hidrate-se ao longo do dia.")
  ].concat(substitutionNotes.map(function(note) { return "Substituição|" + note; })).concat(orientacoes.map(function(obs) { return "Nota|" + obs; })).join("\n");
  return [metaBlock, mealBlocks, substitutionsBlock, resumoBlock, orientBlock].filter(Boolean).join("\n\n");
}

var _kronos_chat_files = [];

function clearKronosChatFile() {
  _kronos_chat_files = [];
  var badge = document.getElementById('aiFileAttachBadge');
  if (badge) badge.style.display = 'none';
  var fi = document.getElementById('aiFileInput');
  if (fi) fi.value = '';
}

async function handleKronosChatFileSelect(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  var ALLOWED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  var mime = file.type || 'application/pdf';
  if (!ALLOWED.includes(mime)) { addAIMessage('assistant', 'Formato não suportado. Use PDF, JPEG ou PNG.'); return; }
  if (file.size > 10 * 1024 * 1024) { addAIMessage('assistant', 'Arquivo muito grande. Máximo 10 MB.'); return; }

  var badge = document.getElementById('aiFileAttachBadge');
  var badgeName = document.getElementById('aiFileAttachName');
  if (badge) { badge.style.display = 'flex'; }
  if (badgeName) { badgeName.textContent = file.name + ' — lendo...'; }

  try {
    var reader = new FileReader();
    var base64 = await new Promise(function(resolve, reject) {
      reader.onload = function(e) { resolve(String(e.target.result || '').split(',')[1] || ''); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    var response = await apiFetch(resolveAppApiUrl('/api/kronia/chat-file'), {
      method: 'POST',
      body: JSON.stringify({ fileData: base64, mimeType: mime, fileName: file.name }),
    });
    var data = await response.json().catch(function() { return {}; });

    if (!response.ok || !data.ok || !data.text) {
      if (badgeName) badgeName.textContent = file.name + ' — falha na leitura';
      addAIMessage('assistant', 'Não consegui extrair o texto do arquivo. Tente um PDF com texto selecionável ou uma imagem nítida.');
      return;
    }

    _kronos_chat_files = [{ name: file.name, text: data.text }];
    if (badgeName) badgeName.textContent = file.name + ' — pronto';
    addAIMessage('assistant', 'Arquivo "' + escapeHTML(file.name) + '" lido. Pode fazer sua pergunta sobre o exame.');
  } catch (err) {
    if (badgeName) badgeName.textContent = file.name + ' — erro';
    addAIMessage('assistant', 'Erro ao processar arquivo. Tente novamente.');
  }
}

async function sendAI(overrideText, isGerarTreino = false) {
  if (_aiTyping) return;
  var input = document.getElementById('aiInput');
  var text = overrideText || input?.value?.trim();
  if (!text) return;

  if (input && !overrideText) {
    input.value = '';
    input.style.height = 'auto';
  }
  document.getElementById('aiSuggestions')?.remove();

  addAIMessage('user', text);
  _aiHistory.push({ role: 'user', content: text });

  _aiTyping = true;
  var sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) sendBtn.style.opacity = '0.4';
  addAIMessage('assistant', '', true);
  var correlationId = 'chat_' + Date.now();
  var startedAt = Date.now();

  var pendingChatFiles = _kronos_chat_files.slice();
  clearKronosChatFile();

  try {
    var userData = buildUserData();
    var messages = _aiHistory.slice(-12);
    var chatPayload = { messages: messages, history: userData.history, profile: userData.profile, requestId: correlationId };
    if (pendingChatFiles.length) chatPayload.chatFiles = pendingChatFiles;
    var response = await apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify(chatPayload),
    });
    removeThinking();
    var data = await parseApiJsonSafely(response);
    if (!response.ok || data?.success === false || data?.ok === false) {
      try {
        var fallbackFlow = await resolveKronosConversation(text);
        if (fallbackFlow && fallbackFlow.type === 'answer_with_cta') {
          addAIMessage('assistant', fallbackFlow.message || 'Posso te direcionar pelo botao abaixo.');
          renderConversationCta('aiMessages', fallbackFlow.cta, Object.assign({}, fallbackFlow.payload || {}, { _targetModule: fallbackFlow.targetModule || null }));
          return;
        }
      } catch (_) {}
      var friendlyError = resolveAiFriendlyError(data, response.status);
      addAIMessage('assistant', `${_ico('alert-triangle', 16)} ${friendlyError}`);
      return;
    }
    var contentNodes = getApiContentNodes(data);
    var reply = data?.message || contentNodes?.[0]?.text || 'Nao consegui processar. Tente novamente.';

    addAIMessage('assistant', reply);
    renderInferredConversationCta('aiMessages', data);
    _aiHistory.push({ role: 'assistant', content: reply });
    try {
      window.KroniaIntelligence?.track?.({
        module: 'chat',
        action: 'processChatMessage',
        status: 'success',
        correlationId: correlationId,
        durationMs: Date.now() - startedAt,
        source: 'app_send_ai',
      });
    } catch (_) {}
  } catch (err) {
    removeThinking();
    addAIMessage('assistant', `${_ico('alert-triangle', 16)} ${(err && err.message) || 'Nao consegui processar sua solicitacao agora.'}`);
    try {
      window.KroniaIntelligence?.track?.({
        module: 'chat',
        action: 'processChatMessage',
        status: 'error',
        severity: 'high',
        correlationId: correlationId,
        durationMs: Date.now() - startedAt,
        source: 'app_send_ai',
        metadata: { message: err && err.message ? err.message : 'unknown' },
      });
    } catch (_) {}
  } finally {
    _aiTyping = false;
    if (sendBtn) sendBtn.style.opacity = '1';
  }
}


function aiQuick(tipo) {
  const prompts = {
    analise: "Analise meu histórico de treinos e me dê um diagnóstico detalhado: pontos fortes, pontos fracos, e 3 recomendações práticas.",
    platô:   "Analise meu histórico e identifique quais exercícios estão em platô (sem evolução). Sugira estratégias para quebrar cada um.",
    dica:    "Com base no meu treino atual e objetivo, me dê a dica mais importante que posso aplicar hoje para maximizar meus resultados.",
    rpe:     "Olhando os RPEs registrados no meu histórico, meu esforço está adequado? Estou treinando pesado demais, leve demais, ou na zona ideal?"
  };
  if (tipo === 'gerar') {
    executeKroniaQuickAction('open_training', { source: 'ai_quick_gerar' }, { label: 'Abrir treino' });
    return;
  }
  const text = prompts[tipo];
  if (text) sendAI(text, false);
  else if (typeof tipo === "string" && tipo.trim()) sendAI(tipo.trim(), false);
}

/* ── KRONOS Coach Questionnaire ─────────────────────── */
var _wqRespostas = {};

function iniciarFluxoGeradorTreino() {
  // Abre o modal de AI se ainda não estiver aberto
  const modal = document.getElementById('aiModal');
  if (modal && modal.style.display === 'none') modal.style.display = 'flex';

  // Remove card anterior se existir
  document.getElementById('wqCard')?.remove();
  _wqRespostas = {};

  const container = document.getElementById('aiMessages');
  if (!container) return;

  const avatarSVG = getKronosAvatarMarkup();

  const chipStyle = 'display:inline-block;padding:7px 14px;margin:4px 4px 0 0;border-radius:20px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:0.82rem;font-weight:600;cursor:pointer;font-family:var(--font);transition:all .15s;';
  const sectionStyle = 'margin-top:14px;';
  const labelStyle = 'font-size:0.85rem;color:var(--text-2);margin:0 0 6px;';

  const card = document.createElement('div');
  card.id = 'wqCard';
  card.className = 'ai-msg assistant';
  card.innerHTML = `
    ${avatarSVG}
    <div class="ai-avatar-inner">
      <div class="ai-bubble" style="max-width:100%;">
        <b style="font-size:0.95rem;">Vou criar o treino ideal pra você! Só preciso de algumas informações 💪</b>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">🎯 <b>Objetivo principal:</b></p>
          <div>
            <button style="${chipStyle}" onclick="wqSelect(this,'objetivo','Hipertrofia')">Hipertrofia</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'objetivo','Força')">Força</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'objetivo','Definição')">Definição</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'objetivo','Condicionamento')">Condicionamento</button>
          </div>
        </div>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">📅 <b>Quantos dias por semana você treina?</b></p>
          <div>
            <button style="${chipStyle}" onclick="wqSelect(this,'frequencia','2 dias por semana')">2x</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'frequencia','3 dias por semana')">3x</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'frequencia','4 dias por semana')">4x</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'frequencia','5 dias por semana')">5x</button>
          </div>
        </div>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">📊 <b>Nível de experiência:</b></p>
          <div>
            <button style="${chipStyle}" onclick="wqSelect(this,'nivel','Iniciante (menos de 1 ano)')">Iniciante</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'nivel','Intermediário (1-3 anos)')">Intermediário</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'nivel','Avançado (mais de 3 anos)')">Avançado</button>
          </div>
        </div>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">🏋️ <b>Onde você treina / equipamentos:</b></p>
          <div>
            <button style="${chipStyle}" onclick="wqSelect(this,'local','Academia completa')">Academia</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'local','Casa com halteres e barras')">Casa c/ pesos</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'local','Casa sem equipamentos (calistenia)')">Casa s/ pesos</button>
          </div>
        </div>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">⚠️ <b>Alguma lesão ou restrição?</b></p>
          <div>
            <button style="${chipStyle}" onclick="wqSelect(this,'lesao','Nenhuma restrição')">Nenhuma</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'lesao','Problema no ombro')">Ombro</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'lesao','Problema no joelho')">Joelho</button>
            <button style="${chipStyle}" onclick="wqSelect(this,'lesao','Problema na coluna')">Coluna</button>
          </div>
        </div>

        <div id="wqGerarBtn" style="display:none;margin-top:16px;">
          <button onclick="gerarTreinoComRespostas()" style="width:100%;padding:13px 16px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-family:var(--font);font-size:0.9rem;font-weight:700;cursor:pointer;">
            ${_ico('zap', 15)} Gerar meu treino personalizado
          </button>
        </div>
      </div>
    </div>`;

  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

function wqSelect(btn, campo, valor) {
  _wqRespostas[campo] = valor;

  // Highlight chip selecionado no grupo
  const group = btn.parentElement;
  group.querySelectorAll('button').forEach(function(b) {
    b.style.background = 'transparent';
    b.style.color = 'var(--accent)';
  });
  btn.style.background = 'var(--accent)';
  btn.style.color = '#fff';

  // Mostra botão gerar quando os 4 campos obrigatórios estão preenchidos
  const required = ['objetivo', 'frequencia', 'nivel', 'local'];
  const allDone = required.every(function(k) { return _wqRespostas[k]; });
  const gerarBtn = document.getElementById('wqGerarBtn');
  if (gerarBtn) gerarBtn.style.display = allDone ? 'block' : 'none';

  const container = document.getElementById('aiMessages');
  if (container) container.scrollTop = container.scrollHeight;
}

function gerarTreinoComRespostas() {
  // Remove card de perguntas
  document.getElementById('wqCard')?.remove();

  const r = _wqRespostas;
  const lesao = r.lesao || 'Nenhuma restrição';
  const diasPorSemanaMatch = String(r.frequencia || '').match(/\d+/);
  const diasPorSemana = diasPorSemanaMatch ? Number(diasPorSemanaMatch[0]) : 3;
  const environment = /hotel/i.test(String(r.local || ''))
    ? 'hotel'
    : (/casa|sem equipamento/i.test(String(r.local || '')) ? 'casa' : 'academia');
  const restrictions = /nenhuma/i.test(lesao) ? [] : [lesao];

  addAIMessage('assistant', 'Perfeito. Vou abrir o modulo oficial de treino com esse contexto.');
  executeKroniaQuickAction('open_training', {
    source: 'wq_questionnaire',
    objective: r.objetivo || 'Hipertrofia',
    level: r.nivel || 'Intermediário',
    days_per_week: diasPorSemana,
    environment: environment,
    restrictions: restrictions,
    notes: [r.local || '', lesao].filter(Boolean).join(' | '),
    questionnaire: Object.assign({}, r, { lesao: lesao }),
  }, { label: 'Abrir treino' });
  _wqRespostas = {};
}

function sanitizeExerciseDisplayName(rawName, fallbackName) {
  const fallback = String(fallbackName || "Exercício").trim();
  let text = String(rawName || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;

  const original = text;
  text = text.replace(/^(dica|observa[cç][aã]o|instru[cç][aã]o|cue|nota|descri[cç][aã]o)\s*[:\-]\s*/i, "").trim();
  if (/[.!?]/.test(text)) text = text.split(/[.!?]/)[0].trim();
  text = text.replace(/\s{2,}/g, " ").trim();

  const words = text.split(/\s+/).filter(Boolean);
  const isInstructionSentence = words.length > 7 && /(mantenha|evite|durante|respire|controle|contraia|alinh|postura|execute|faça|não|sem)\b/i.test(text);
  if (!text || isInstructionSentence) return fallback;
  if (text.length > 70) text = words.slice(0, 6).join(" ").trim();

  const normalized = toSafeTitleCase(text);
  if (normalized !== original && normalized) {
    logUiEvent("exercise_title_unicode_fixed", { before: original, after: normalized });
  }
  return normalized || fallback;
}

function getExerciseCardTitle(ex, index) {
  const fallback = `Exercício ${Number(index || 0) + 1}`;
  if (!ex) return fallback;

  const src = ex && typeof ex === "object" ? ex : { name: ex };
  const rawCandidates = [src.display_name, src.name, src.nome].filter(v => v != null && String(v).trim().length > 0);
  if (!rawCandidates.length) return fallback;

  for (let i = 0; i < rawCandidates.length; i++) {
    const raw = String(rawCandidates[i] || "").trim();
    if (!raw) continue;
    const candidate = sanitizeExerciseDisplayName(raw, "");
    if (!candidate) continue;
    if (candidate === "Exercício") return "Exercício";
    if (candidate.length >= 2) {
      if (candidate !== raw) logUiEvent("exercise_title_unicode_fixed", { before: raw, after: candidate });
      return candidate;
    }
  }

  return fallback;
}

function buildExerciseStubFromPayload(source = {}, fallbackName = "Exercício") {
  const displayName = getExerciseCardTitle(source, 0) || fallbackName;
  const instructionsCandidate = [
    source.instructions,
    source.observacoes,
    source.notes,
    source.cue,
    source.description,
  ].find(v => v != null);
  const instructions = Array.isArray(instructionsCandidate)
    ? instructionsCandidate.map(v => String(v)).filter(Boolean).slice(0, 4)
    : (instructionsCandidate ? [String(instructionsCandidate)] : []);
  const targetMuscle = source.target_muscle || source.targetMuscle || source.muscles?.target || null;
  const secondaryMuscles = Array.isArray(source.secondary_muscles)
    ? source.secondary_muscles
    : (Array.isArray(source.muscles?.secondary) ? source.muscles.secondary : []);
  const mediaPrimary = source.media_url || source.media?.primary || source.media?.videoUrl || source.media?.imageUrl || null;
  const mediaThumbnail = source.media_thumbnail_url || source.media?.thumbnailUrl || null;
  const mediaType = source.media_type || source.media?.type || (mediaPrimary && /\.(mp4|webm)$/i.test(mediaPrimary) ? "video" : mediaPrimary ? "image" : "none");

  return {
    id: source.exercise_id || source.id || null,
    slug: source.slug || null,
    normalized_lookup_key: source.normalized_lookup_key || normalizeExerciseLookupKey(displayName),
    names: {
      pt: source.display_name || source.name_pt || source.nome || displayName,
      en: source.name_en || source.display_name || source.nome || displayName,
    },
    instructions,
    target_muscle: targetMuscle,
    secondary_muscles: secondaryMuscles,
    common_errors: Array.isArray(source.common_errors) ? source.common_errors.slice(0, 4) : [],
    breathing_tip: source.breathing_tip || null,
    variations: Array.isArray(source.variations) ? source.variations : [],
    source: source.source || "workout_card",
    media: {
      primary: mediaPrimary,
      thumbnailUrl: mediaThumbnail,
      type: mediaType,
      provider: source.media_provider || source.media?.provider || "workout_card",
    },
    metadata: {
      fromCardStub: true,
      completenessScore: mediaPrimary ? 0.62 : 0.45,
    },
  };
}

function ensureExerciseRef(source = {}, fallbackName = "Exercício", origin = "workout_builder") {
  const displayName = getExerciseCardTitle(source, 0) || fallbackName;
  const lookupKey = source.normalized_lookup_key || normalizeExerciseLookupKey(displayName);
  const stub = buildExerciseStubFromPayload({ ...source, display_name: displayName, normalized_lookup_key: lookupKey }, displayName);
  return {
    exercise_id: source.exercise_id || source.id || null,
    slug: source.slug || null,
    normalized_lookup_key: lookupKey,
    display_name: displayName,
    source: source.source || origin,
    target_muscle: source.target_muscle || source.targetMuscle || stub.target_muscle || null,
    secondary_muscles: Array.isArray(source.secondary_muscles) ? source.secondary_muscles : (stub.secondary_muscles || []),
    instructions: Array.isArray(stub.instructions) ? stub.instructions : [],
    stub,
  };
}

function normalizeExercisePayload(exercise, index) {
  const source = exercise || {};
  const normalizedName = getExerciseCardTitle(source, index);
  const exerciseRef = ensureExerciseRef(source, normalizedName, source.source || "workout_payload");

  return {
    nome: normalizedName,
    name: normalizedName,
    display_name: normalizedName,
    exercise_id: exerciseRef.exercise_id,
    slug: exerciseRef.slug,
    normalized_lookup_key: exerciseRef.normalized_lookup_key,
    source: exerciseRef.source,
    target_muscle: exerciseRef.target_muscle,
    secondary_muscles: exerciseRef.secondary_muscles,
    exercise_ref: exerciseRef,
    exercise_stub: exerciseRef.stub,
    series: source.fases ? source.fases[0].series : (source.series || source.sets || 3),
    reps: source.fases ? source.fases[0].reps : (source.reps || source.repeticoes || "8-12"),
    fases: source.fases || null,
    instructions: Array.isArray(exerciseRef.instructions) ? exerciseRef.instructions : [],
  };
}

function extrairGruposDaResposta(reply) {
  const grupos = [];
  let grupoAtual = null;

  const lines = reply.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  lines.forEach(line => {
    // Detectar título de grupo: "Treino A", "Treino A (Push)", "Dia 1:", etc.
    const isTitulo = /^(treino\s+[A-Za-z]|dia\s+\d+)/i.test(line) ||
                     /^[#*]?\s*(treino\s+[A-Za-z])/i.test(line);
    if (isTitulo) {
      const nome = line.replace(/^[#*\s]+/, "").replace(/\(.*\)/, "").trim().substring(0, 15);
      grupoAtual = { nome, exercicios: [] };
      grupos.push(grupoAtual);
      return;
    }

    // Ignorar linhas de dia da semana
    if (/^[*+•\-]\s*(segunda|terça|quarta|quinta|sexta|sábado|domingo)/i.test(line)) return;

    // Detectar exercício: "1. Nome", "* Nome", "- Nome", "+ Nome"
    const isEx = /^(\d+[.)]\s+|[*•\-+]\s+)[A-Za-zÀ-ú]/.test(line);
    if (!isEx) return;

    const nomeRaw = line
      .replace(/^[\d.)*\-•+\s]+/, "")
      .split(/[:(]/)[0]
      .trim();
    const nome = getExerciseCardTitle({ display_name: nomeRaw, name: nomeRaw }, grupoAtual ? grupoAtual.exercicios.length : 0);
    if (nome.length < 3) return;

    const sm = line.match(/(\d+)\s*s[eé]ries?/i);
    const rm = line.match(/(\d+[-–]\d+|\d+)\s*reps?/i);
    const ex = { nome, name: nome, display_name: nome, series: sm ? parseInt(sm[1]) : 3, reps: rm ? rm[1] : "8-12" };

    if (!grupoAtual) {
      grupoAtual = { nome: "Treino A", exercicios: [] };
      grupos.push(grupoAtual);
    }
    grupoAtual.exercicios.push(ex);
  });

  return grupos.filter(g => g.exercicios.length > 0);
}

function applyAIWorkoutFromText() {
  const reply = window._lastWorkoutReply || "";
  if (!reply) { showToast("Nenhum treino para aplicar.", "error"); return; }

  // Tentar JSON primeiro
  try {
    const jsonMatch = reply.match(/\{[\s\S]*"treinos"[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data.treinos && data.treinos.length > 0) {
        const grupos = data.treinos.map(t => ({
          nome: t.nome,
          exercicios: t.exercicios || []
        }));
        return applyAIWorkout({ treino: { grupos } });
      }
    }
  } catch(e) {}

  // Fallback: extrair do texto
  const grupos = extrairGruposDaResposta(reply);
  if (grupos.length === 0) {
    showToast("Não consegui extrair exercícios. Tente novamente.", "error");
    return;
  }
  applyAIWorkout({ treino: { grupos } });
}

function renderWorkoutError(message) {
  var safeMsg = String(message || 'Erro ao montar treino').trim() || 'Erro ao montar treino';
  try { navTo('treino'); } catch (_) {}
  var errNav = document.getElementById('nav');
  var errCont = document.getElementById('container');
  if (errNav) errNav.innerHTML = '<div class="pill active">Treino</div>';
  if (errCont) {
    errCont.innerHTML = '<div class="section active" id="sec-workout-error" data-treino-key="Erro"><div class="exercise-card" style="padding:18px;border:1px solid var(--border);background:var(--card);"><div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">Não foi possível renderizar o treino</div><div style="font-size:12px;line-height:1.45;color:var(--text-2)">' + escapeHTML(safeMsg) + '</div><button onclick="openKronosWorkoutEntry()" style="margin-top:14px;padding:10px 20px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-family:var(--font);font-size:0.85rem;font-weight:700;cursor:pointer;">Tentar novamente</button></div></div>';
  }
  showToast(safeMsg, 'error', 3500);
  return false;
}

function applyAIWorkout(data) {
  try {
    const treino = data && data.treino;
    if (!treino) return renderWorkoutError("Erro ao montar treino");

    let grupos = treino.grupos;
    if (!grupos && Array.isArray(treino.exercicios)) {
      grupos = [{ nome: treino.nome || "Treino A", exercicios: treino.exercicios }];
    }
    if (!Array.isArray(grupos)) return renderWorkoutError("Erro ao montar treino");
    grupos = grupos.filter(function(grupo) {
      return grupo && Array.isArray(grupo.exercicios) && grupo.exercicios.length > 0;
    });
    if (grupos.length === 0) return renderWorkoutError("Nenhum treino gerado");

    const nav  = document.getElementById("nav");
    const cont = document.getElementById("container");
    if (!nav || !cont) return renderWorkoutError("Erro ao montar treino");
    nav.innerHTML  = "";
    cont.innerHTML = "";

    grupos.forEach((grupo, idx) => {
      const safeName = String(grupo.nome || ('Treino ' + String.fromCharCode(65 + idx)));
      const label = safeName.replace(/treino\s*/i, "").trim().substring(0, 12) || String.fromCharCode(65 + idx);

      nav.innerHTML += `<div class="pill ${idx===0?"active":""}" id="p${idx}" onclick="tab(${idx})">${escapeHTML(label)}</div>`;

      const sec = document.createElement("div");
      sec.id = "sec" + idx;
      sec.className = "section " + (idx === 0 ? "active" : "");
      sec.setAttribute("data-treino-key", safeName);
      cont.appendChild(sec);

      grupo.exercicios.forEach((ex, exIdx) => {
        const normalized = normalizeExercisePayload(ex, exIdx);
        const cardTitle = getExerciseCardTitle(normalized, exIdx);
        normalized.nome = cardTitle;
        normalized.name = cardTitle;
        normalized.display_name = cardTitle;
        const cardEl = criarCard(cardTitle, "sec" + idx, normalized.series || 3, normalized.reps || "8-12", null, [], exIdx, normalized.exercise_ref || normalized);
        if (normalized.fases && normalized.fases.length > 0 && cardEl) {
          const fasesDiv = document.createElement("div");
          fasesDiv.style.cssText = "padding:6px 12px 10px;border-top:1px solid var(--border-soft);margin-top:4px";
          fasesDiv.innerHTML = `
            <div style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:1px;margin-bottom:6px">PERIODIZAÇÃO MEV→MAV→MRV</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${normalized.fases.map((f,fi) => `
                <div style="flex:1;min-width:80px;background:var(--card);border:1px solid ${fi===0?'var(--accent)':'var(--border)'};border-radius:8px;padding:6px 8px;text-align:center">
                  <div style="font-size:9px;color:var(--accent);font-weight:700">${f.label||f.fase}</div>
                  <div style="font-size:11px;color:var(--text);font-weight:600">${f.series}x${f.reps}</div>
                  <div style="font-size:9px;color:var(--text-2)">${f.fase}</div>
                </div>
              `).join("")}
            </div>`;
          cardEl.appendChild(fasesDiv);
        }
      });
    });

    addPillControls();
    applyPrevGhostsToAll();
    scheduleDraftSave();
    closeAI();
    geShowEntryButton();

    const total = grupos.reduce((a, g) => a + g.exercicios.length, 0);
    showToast("✅ " + grupos.length + " treino(s) aplicado(s) — " + total + " exercícios!", "success", 3000);

  } catch(e) {
    console.error('[applyAIWorkout] exception', e && e.message ? e.message : e);
    renderWorkoutError('Erro ao montar treino. Tente novamente.');
  }
}

function checkRPEAlert(input) {
  const row  = input.closest(".series-grid");
  if (!row) return;
  // Remove alerta anterior desta linha
  const prev = row.nextElementSibling;
  if (prev && prev.classList.contains("rpe-inline-alert")) prev.remove();
  const inputs = row.querySelectorAll("input");
  let rpe  = parseFloat(inputs[2]?.value);
  const kg   = parseFloat(inputs[0]?.value);
  const reps = parseFloat(inputs[1]?.value);
  if (Number.isFinite(rpe) && rpe > 10) {
    inputs[2].value = "10";
    rpe = 10;
    showToast("RPE vai de 0 a 10. Ajustei para 10.", "warning", 2500);
  } else if (Number.isFinite(rpe) && rpe < 0) {
    inputs[2].value = "0";
    rpe = 0;
    showToast("RPE não pode ser negativo.", "warning", 2500);
  }
  if (!kg || !rpe) return;
  // Base científica: RPE alvo = 8 (2 RIR) para hipertrofia
  // Ajuste: 2,5% por ponto de RPE (Zourdos et al. 2016; Helms et al. 2016; Tuchscherer RTS)
  const TARGET_RPE = 8;
  const ADJUST_PER_POINT = 0.025;
  const diff = rpe - TARGET_RPE;
  let msg = null, type = null;
  if (rpe >= 9) {
    const suggest = Math.round(kg * (1 - diff * ADJUST_PER_POINT) * 2) / 2;
    msg = `${_ico('alert-triangle', 16)} Próxima série: ${suggest}kg`;
    type = "warning";
  } else if (rpe <= 6 && reps > 0) {
    const suggest = Math.round(kg * (1 - diff * ADJUST_PER_POINT) * 2) / 2;
    msg = `💡 Próxima série: ${suggest}kg`;
    type = "info";
  } else if (rpe >= 7 && rpe <= 8) {
    msg = `${_ico('check-circle', 14)} RPE ideal — Mantenha ${kg}kg`;
    type = "ideal";
  }
  if (msg) {
    const alert = document.createElement("div");
    alert.className = `rpe-inline-alert ${type}`;
    alert.innerHTML = msg;
    row.after(alert);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register('/sw.js?v=20260502-pr485-hotfix-profile-exercise', { updateViaCache: 'none' }).catch(() => {});
}

/* ═══════════════════════════════════════════════════
   INICIALIZAÇÃO — CORRIGIDA
   (removido openConfig() automático no load)
═══════════════════════════════════════════════════ */
window.onerror = function(msg, src, line, col, err) {
  console.error('GLOBAL ERROR:', msg, err || null, {
    src: src || null,
    line: line || null,
    col: col || null,
  });
  if (msg === "Script error." || !line) return true;
  console.error("TITAN ERR:", msg, "L"+line);
  return false;
};

function validateClientRuntimeEnv() {
  var runtime = (typeof window !== 'undefined' && window.__KRONIA_RUNTIME__ && typeof window.__KRONIA_RUNTIME__ === 'object')
    ? window.__KRONIA_RUNTIME__
    : {};
  var missing = [];
  var supabaseUrl = String(
    (typeof window !== 'undefined' ? (window.KRONIA_SUPABASE_URL || '') : '')
    || runtime.NEXT_PUBLIC_SUPABASE_URL
    || runtime.SUPABASE_URL
    || ''
  ).trim();
  var supabaseAnonKey = String(
    (typeof window !== 'undefined' ? (window.KRONIA_SUPABASE_ANON_KEY || '') : '')
    || runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || runtime.SUPABASE_ANON_KEY
    || ''
  ).trim();
  var aiRuntimeKey = String(
    (typeof window !== 'undefined' ? (window.KRONIA_GROQ_API_KEY || window.KRONIA_AI_KEY || '') : '')
    || runtime.GROQ_API_KEY
    || runtime.OPENAI_API_KEY
    || runtime.AI_API_KEY
    || ''
  ).trim();

  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!aiRuntimeKey) missing.push('GROQ_API_KEY');

  if (missing.length) {
    console.error('KRONIA ENV ERROR:', {
      missing: missing,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
      hasAiRuntimeKey: !!aiRuntimeKey,
    });
  }
  return missing;
}

(() => {
  const THEME_KEY = 'kronia_theme';
  const LEGACY_THEME_KEY = 'kronia_light';
  const LIGHT = 'light';
  const DARK = 'dark';
  const META_COLOR_LIGHT = '#f7f7f8';
  const META_COLOR_DARK = '#0b0b0f';

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }

  function getThemeMetaTag() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    return meta;
  }

  function getSystemTheme() {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? LIGHT : DARK;
    } catch {
      return DARK;
    }
  }

  function getInitialTheme() {
    const stored = safeGet(THEME_KEY);
    if (stored === LIGHT || stored === DARK) return stored;
    const legacy = safeGet(LEGACY_THEME_KEY);
    if (legacy === '1') return LIGHT;
    if (legacy === '0') return DARK;
    return getSystemTheme();
  }

  function syncThemeUI(theme) {
    const settingsThemeVal = document.getElementById('settingsThemeVal');
    if (settingsThemeVal) {
      settingsThemeVal.textContent = theme === LIGHT ? 'Claro' : 'Escuro';
    }
    const checkbox = document.querySelector('[data-theme-toggle-input]');
    if (checkbox && 'checked' in checkbox) {
      checkbox.checked = theme === LIGHT;
    }
    document.querySelectorAll('[data-theme-state]').forEach((el) => {
      el.textContent = theme === LIGHT ? 'Claro' : 'Escuro';
    });
  }

  function applyTheme(theme, { persist = true, source = 'manual' } = {}) {
    const resolved = theme === LIGHT ? LIGHT : DARK;
    const isLight = resolved === LIGHT;
    const root = document.documentElement;
    const body = document.body;

    root.dataset.theme = resolved;
    root.classList.toggle('light-mode', isLight);
    root.classList.toggle('dark-mode', !isLight);

    if (body) {
      body.dataset.theme = resolved;
      body.classList.toggle('light-mode', isLight);
      body.classList.toggle('dark-mode', !isLight);
    }

    root.style.colorScheme = resolved;
    if (body) {
      body.style.colorScheme = resolved;
    }
    getThemeMetaTag().setAttribute('content', isLight ? META_COLOR_LIGHT : META_COLOR_DARK);

    if (persist) {
      safeSet(THEME_KEY, resolved);
      safeSet(LEGACY_THEME_KEY, isLight ? '1' : '0');
    }

    syncThemeUI(resolved);
    window.dispatchEvent(new CustomEvent('kronia:theme-changed', { detail: { theme: resolved, source } }));
    return resolved;
  }

  function toggleTheme(nextTheme) {
    const current = document.documentElement.dataset.theme === LIGHT ? LIGHT : DARK;
    const target = nextTheme === LIGHT || nextTheme === DARK
      ? nextTheme
      : current === LIGHT ? DARK : LIGHT;
    return applyTheme(target, { persist: true, source: 'toggle' });
  }

  function bindThemeControls() {
    document.querySelectorAll('[data-action="toggle-theme"], [data-theme-toggle], [onclick*="toggleTheme"]').forEach((el) => {
      if (el.dataset.themeBound === '1') return;
      el.dataset.themeBound = '1';

      const isCheckbox = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
      if (isCheckbox) {
        el.addEventListener('change', () => {
          toggleTheme(el.checked ? LIGHT : DARK);
        });
        return;
      }

      el.addEventListener('click', (event) => {
        event.preventDefault();
        toggleTheme();
      });
    });
  }

  function bootTheme() {
    applyTheme(getInitialTheme(), { persist: false, source: 'boot' });
    bindThemeControls();
  }

  window.toggleTheme = toggleTheme;
  window.applyTheme = applyTheme;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootTheme, { once: true });
  } else {
    bootTheme();
  }

  try {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemThemeChange = (event) => {
      const stored = safeGet(THEME_KEY);
      const hasExplicitUserChoice = stored === LIGHT || stored === DARK;
      if (!hasExplicitUserChoice) {
        applyTheme(event.matches ? LIGHT : DARK, { persist: false, source: 'system' });
      }
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleSystemThemeChange);
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(handleSystemThemeChange);
    }
  } catch {}
})();

window.onload = () => {
  validateClientRuntimeEnv();
  // Data
  try { document.getElementById("displayDate").innerText = new Date().toLocaleDateString("pt-BR"); } catch {}

  // Timer inicial
  updateT();

  // Prevmap
  prevMap = getPrevMap();

  // Carregar draft ou gerar protocolo
  let loaded = false;
  try {
    const r = localStorage.getItem(STORAGE.draftKey);
    if (r) loaded = loadState(JSON.parse(r));
  } catch {}
  if (!loaded) gerarProtocolo(true);
  // Garante que o container nunca fique vazio
  if (!document.getElementById("container").children.length) gerarProtocolo(true);

  // Abrir tela inicial
  try { navTo("inicio"); openHome(); } catch(e) { navTo("treino"); }
  // Fallback: re-abre homeScreen se não tiver sido exibida
  setTimeout(() => {
    const hs = document.getElementById("homeScreen");
    if (hs && !hs.classList.contains("show")) { try { openHome(); } catch(e) {} }
  }, 300);

  // UI
  updateStreakUI();
  updateWorkoutProgress();
  applyPrevGhostsToAll();

  // Toast de boas-vindas para quem já treinou
  if (localStorage.getItem("kronia_onboarded")) {
    const streak = calcStreak();
    if (streak >= 2) {
      setTimeout(() => showToast(`🔥 ${streak} dias seguidos. Continue assim!`, "success", 4000), 1200);
    }
  }

  // Onboarding/setup são exibidos após login via checkFirstTimeFlow() em auth.js

  // PWA: listener de mensagens do Service Worker (background sync)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'KRONIA_SYNC_WORKOUT') {
        try { _dbSync.pushHistory(); } catch(err) {}
      }
    });
  }

  // Pedir permissão de notificação após 30s (não invasivo)
  setTimeout(() => { kronaRequestNotificationPermission(); }, 30000);


};

// ══ NOTIFICAÇÕES PWA ════════════════════════════════
function kronaRequestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    // Só pede se tiver streak — usuário engajado
    const streak = typeof calcStreak === 'function' ? calcStreak() : 0;
    if (streak >= 2) Notification.requestPermission();
  }
}

function kronaNotify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { body, icon: '/Kronia.png', badge: '/Kronia.png', tag: tag || 'kronia', renotify: true });
      });
    } else {
      new Notification(title, { body, icon: '/Kronia.png' });
    }
  } catch(e) {}
}

// ══════════════════════════════════════════
// TELA DE INÍCIO
// ══════════════════════════════════════════
function openHome() {
  scheduleKroniaUIUnblock('before-home-open');
  document.getElementById('dietDataScreen')?.classList.remove('show');
  document.getElementById('evolutionDataScreen')?.classList.remove('show');
  document.getElementById('perfilScreen')?.classList.remove('show');
  setDietMiniAppChrome(false);
  const el = document.getElementById("homeScreen");
  if (!el) return;
  el.classList.add("show");
  // Garante que o footer não ficou oculto por overlay anterior (onboarding, krona-setup, etc.)
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
  document.body.classList.remove('overlay-open');
  scheduleKroniaUIUnblock('after-home-open');
  // Atualiza dados no próximo frame — tela aparece antes de qualquer cálculo
  requestAnimationFrame(() => {
    try { updateHomeScreen(); } catch(e) { console.error('[openHome] updateHomeScreen falhou:', e); }
    schedulePendingConversationIntentConsumption('home_open');
  });
  // Carrega insights em paralelo (não bloqueia render)
  loadKroniaInsights();
}
function closeHome() {
  document.getElementById("homeScreen").classList.remove("show");
  navTo("treino");
}
function getNextTreinoIdx() {
  const draft    = safeJSON(STORAGE.draftKey, null);
  const sections = draft?.sections || [];
  if (!sections.length) return 0;
  const hist = safeJSON(STORAGE.historyKey, []);
  if (!hist.length) return 0;
  // hist[0] é o mais recente (unshift)
  const lastKey = (hist[0].state?.sections || [])[0]?.treinoKey || null;
  if (!lastKey) return 0;
  const lastIdx = sections.findIndex(s => s.treinoKey === lastKey);
  if (lastIdx < 0) return 0;
  return (lastIdx + 1) % sections.length;
}

let _disposicaoAtual = null;

function iniciarTreino() {
  // Se chamado da StartWorkoutScreen, fechar ela primeiro e então mostrar check-in
  closeStartWorkoutScreen();
  // Mostrar check-in de disposição antes de iniciar
  const dlg = document.getElementById("modalDisposicao");
  if (dlg) {
    // Resetar estilos dos botões
    dlg.querySelectorAll("button[onclick^='selecionarDisposicao(']").forEach(b => {
      b.style.borderColor = "var(--border)";
      b.style.background = "var(--bg2)";
    });
    dlg.showModal();
    dlg.addEventListener("close", _onDisposicaoClose, { once: true });
  } else {
    _lancarTreino();
  }
}

function selecionarDisposicao(val) {
  _disposicaoAtual = val;
  const dlg = document.getElementById("modalDisposicao");
  if (!dlg) return;
  // Feedback visual rápido antes de fechar
  if (val) {
    const btn = dlg.querySelector(`[data-disp="${val}"]`);
    if (btn) {
      btn.style.background = "var(--accent)";
      btn.style.borderColor = "var(--accent)";
      btn.querySelectorAll("svg").forEach(s => { s.style.stroke = "#fff"; });
      btn.querySelectorAll("span").forEach(s => { s.style.color = "#fff"; });
    }
    setTimeout(() => dlg.close(), 200);
  } else {
    dlg.close();
  }
}

function _onDisposicaoClose() {
  _lancarTreino();
}

function _lancarTreino() {
  const idx = getNextTreinoIdx();
  closeHome();
  setTimeout(() => { const p = document.getElementById("p" + idx); if (p) p.click(); }, 50);
}

function updateHomeScreen() {
  if (typeof STORAGE === 'undefined' || typeof safeJSON === 'undefined') return;

  // Lê uma vez — reutiliza em tudo
  const hist = safeJSON(STORAGE.historyKey, []);
  const cfg  = safeJSON("kronia_config", {});

  // Saudação por hora + nome do usuário
  const hora  = new Date().getHours();
  const sauds = ["BOA MADRUGADA", "BOM DIA", "BOA TARDE", "BOA NOITE"];
  const saudIdx = hora < 5 ? 0 : hora < 12 ? 1 : hora < 18 ? 2 : 3;
  const greetingEl = document.getElementById("homeGreeting");
  if (greetingEl) greetingEl.textContent = sauds[saudIdx];

  // Nome do usuário no título
  const userName = cfg.nome || localStorage.getItem("kronia_nome") || "";
  const titleEl = document.getElementById("homeUserNameTitle");
  if (titleEl) titleEl.textContent = userName ? userName.toUpperCase() : "ATLETA";

  // Streak — calcula a partir do hist já lido (sem reler localStorage)
  const today = new Date(); today.setHours(0,0,0,0);
  const days = new Set(hist.map(h => { const d = new Date(h.createdAt); d.setHours(0,0,0,0); return d.getTime(); }));
  let streak = 0, cursor = today.getTime();
  while (days.has(cursor) || days.has(cursor - 86400000)) {
    if (days.has(cursor)) streak++;
    cursor -= 86400000;
    if (streak > 0 && !days.has(cursor) && !days.has(cursor + 86400000)) break;
  }
  const streakNumEl = document.getElementById("homeStreak");
  if (streakNumEl) streakNumEl.textContent = streak;
  // Circular ring — circunferência ≈ 314, 30 dias = meta
  const ringEl = document.getElementById("homeStreakRing");
  if (ringEl) {
    const pct = Math.min(streak / 30, 1);
    ringEl.setAttribute("stroke-dashoffset", Math.round(314 * (1 - pct)));
    ringEl.style.opacity = streak > 0 ? "1" : "0";
  }
  const flame1 = document.getElementById("homeStreakFlame1");
  const flame2 = document.getElementById("homeStreakFlame2");
  if (flame1) flame1.style.display = streak > 0 ? "block" : "none";
  if (flame2) flame2.style.display = streak >= 7 ? "block" : "none";

  // Banner turista
  const banner = document.getElementById("turistaBanner");
  if (banner) banner.style.display = cfg.persona === "turista" ? "block" : "none";

  // Volume total + semana — em um único loop
  const semAgo = Date.now() - 7 * 86400000;
  let volTotal = 0, volSem = 0, semTreinos = 0;
  for (const h of hist) {
    const v = calcVolumeTotal(h.state);
    volTotal += v;
    if (h.createdAt > semAgo) { volSem += v; semTreinos++; }
  }
  const semTreinosEl = document.getElementById("homeSemanaTreinos");
  if (semTreinosEl) semTreinosEl.textContent = semTreinos;
  // Progress bar treinos
  const treinosBar = document.getElementById("homeTreinosBarFill");
  if (treinosBar) treinosBar.style.width = Math.min((semTreinos / 5) * 100, 100) + "%";

  const volFormatted = volSem > 999 ? (volSem / 1000).toFixed(1) + "t" : Math.round(volSem) + "kg";
  const volSemanaEl = document.getElementById("homeVolSemana");
  if (volSemanaEl) volSemanaEl.textContent = volSem > 999 ? (volSem/1000).toFixed(1)+"t" : Math.round(volSem);
  // Progress bar volume (meta 12.000kg/semana)
  const volBar = document.getElementById("homeVolBarFill");
  if (volBar) volBar.style.width = Math.min((volSem / 12000) * 100, 100) + "%";

  // Treino do dia
  const draft    = safeJSON(STORAGE.draftKey, null);
  const sections = draft?.sections || [];
  const nextSec  = sections[getNextTreinoIdx()];
  const nextTreinoKey = nextSec?.treinoKey || "A";
  const nextCards = nextSec?.cards || [];
  const nextSubtitle = nextCards.length > 0 ? nextCards.length + " exercícios" : "Configure seu programa";
  if (document.getElementById("homeTodayTreino")) {
    document.getElementById("homeTodayTreino").textContent = "Treino " + nextTreinoKey;
  }
  if (document.getElementById("homeTodaySub")) {
    document.getElementById("homeTodaySub").textContent = nextSubtitle;
  }

  // Card Configurar Treino
  try { _updateConfigTreinoCard(); } catch(e) {}

  // AchievementCard — última conquista
  _updateAchievementCard(streak, hist.length);

  // RecommendedWorkoutCard
  const recDesc = document.getElementById("recommendedWorkoutDesc");
  if (recDesc) {
    const focusMap = { A:"Foco força superior", B:"Foco força inferior", C:"Hipertrofia total", D:"Força e potência", E:"Resistência muscular", F:"Full body" };
    recDesc.innerHTML = `Treino ${nextTreinoKey}:<br>${focusMap[nextTreinoKey] || "Treino personalizado"}`;
  }

  // Passes streak/hist pré-computados para evitar reler
  try { renderDesafios(); } catch(e) {}
  try { _updateHomeBannerFast(streak, hist.length); } catch(e) {}

  // Fallback para estado vazio: garante que a tela não fica em branco sem dados
  const homeEl = document.getElementById("homeScreen");
  if (homeEl && !homeEl.classList.contains("show")) {
    homeEl.classList.add("show");
    const footerEl = document.querySelector('.footer-actions');
    if (footerEl) footerEl.style.display = '';
  }
}

// ─── KRONOS INTELLIGENCE INSIGHTS ────────────────────────────────────────────
var _insightsLoading = false;
var _insightsLastLoaded = 0;
var INSIGHTS_CACHE_TTL = 10 * 60 * 1000; // 10 min

async function loadKroniaInsights() {
  const container = document.getElementById('kronosInsightsList');
  if (!container) return;

  // Throttle: não recarrega dentro do TTL
  const now = Date.now();
  if (_insightsLoading || (now - _insightsLastLoaded < INSIGHTS_CACHE_TTL)) return;
  _insightsLoading = true;

  showSkeletons(container, 3, '72px');

  try {
    var headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    var resp = await fetch('/api/system?__route=insights', { headers, cache: 'no-store' });
    hideSkeletons(container);
    if (!resp.ok) { _renderInsightsEmpty(container); return; }
    var data = await resp.json();
    var insights = Array.isArray(data && data.insights) ? data.insights : [];
    _insightsLastLoaded = Date.now();
    _renderInsights(container, insights);
  } catch (e) {
    hideSkeletons(container);
    _renderInsightsEmpty(container);
  } finally {
    _insightsLoading = false;
  }
}

function _renderInsights(container, insights) {
  if (!insights || !insights.length) { _renderInsightsEmpty(container); return; }

  var domainClass = { 'treino':'insight-domain-treino','nutrição':'insight-domain-nutrição','saúde':'insight-domain-saúde','recuperação':'insight-domain-recuperação' };
  var impactClass = { 'Alto':'insight-impact-Alto','Médio':'insight-impact-Médio','Baixo':'insight-impact-Baixo' };
  var typeIcon = { 'recommendation':'lightbulb','warning':'alert-triangle','alert':'bell','achievement':'star' };

  var html = insights.map(function(ins) {
    var domain = String(ins.domain || 'saúde').toLowerCase();
    var impact = ins.impact || 'Médio';
    var iconName = typeIcon[ins.type] || 'lightbulb';
    var dCls = domainClass[domain] || 'insight-domain-saúde';
    var iCls = impactClass[impact] || 'insight-impact-Médio';
    return '<div class="insight-card">' +
      '<div class="insight-card-head">' +
        '<span class="insight-domain-badge ' + escapeHTML(dCls) + '">' + escapeHTML(domain) + '</span>' +
        '<span class="insight-impact-dot ' + escapeHTML(iCls) + '" title="Impacto ' + escapeHTML(impact) + '"></span>' +
        '<span class="insight-title">' + escapeHTML(String(ins.title || '')) + '</span>' +
        '<i data-lucide="' + escapeHTML(iconName) + '" class="lucide" width="14" height="14" stroke="rgba(255,255,255,0.3)" fill="none" stroke-width="2"></i>' +
      '</div>' +
      '<p class="insight-desc">' + escapeHTML(String(ins.description || '')) + '</p>' +
      (ins.suggested_action ? '<div class="insight-action"><i data-lucide="arrow-right" class="lucide" width="11" height="11" stroke="currentColor" fill="none" stroke-width="2.5"></i>' + escapeHTML(String(ins.suggested_action)) + '</div>' : '') +
    '</div>';
  }).join('');

  container.innerHTML = html;
  container.classList.remove('k-fade-in');
  requestAnimationFrame(function() { container.classList.add('k-fade-in'); });
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    try { lucide.createIcons({ nodes: container.querySelectorAll('[data-lucide]') }); } catch (e) {}
  }
}

function _renderInsightsEmpty(container) {
  if (!container) return;
  container.innerHTML = '<div class="insight-empty">Sem insights disponíveis no momento.</div>';
}

function _updateConfigTreinoCard() {
  const cfg = safeJSON("kronia_config", {});
  const draft = safeJSON(STORAGE.draftKey, null);
  const sections = draft?.sections || [];

  // Frequência
  const freq = document.querySelector("#freqChips .config-chip.active")?.dataset.val
    || cfg.freq || "3";
  const pillFreq = document.getElementById("pillFrequencia");
  if (pillFreq) {
    const span = pillFreq.querySelector("span");
    if (span) span.textContent = freq + (freq === "1" ? " dia/sem" : " dias/sem");
  }

  // Objetivo
  const objMap = { hipertrofia:"Hipertrofia", forca:"Força", definicao:"Definição", saude:"Saúde", resistencia:"Resistência" };
  const obj = document.querySelector("#objChips .config-chip.active")?.dataset.val || cfg.objetivo || "hipertrofia";
  const pillObj = document.getElementById("pillObjetivo");
  if (pillObj) {
    const span = pillObj.querySelector("span");
    if (span) span.textContent = objMap[obj] || obj;
  }

  // Nível
  const nivelMap = { iniciante:"Iniciante", intermediario:"Intermediário", avancado:"Avançado" };
  const nivel = cfg.nivel || "iniciante";
  const pillNivel = document.getElementById("pillNivel");
  if (pillNivel) {
    const span = pillNivel.querySelector("span");
    if (span) span.textContent = nivelMap[nivel] || nivel;
  }

  // Divisão (letras dos treinos)
  const divisaoEl = document.getElementById("pillDivisao");
  if (divisaoEl && sections.length) {
    divisaoEl.innerHTML = sections.map(s =>
      `<div class="config-treino-day">${s.treinoKey || "?"}</div>`
    ).join("");
  }
}

function _updateAchievementCard(streak, totalTreinos) {
  const desc = document.getElementById("achievementDesc");
  if (!desc) return;
  if (streak >= 30) desc.textContent = "30 dias seguidos!";
  else if (streak >= 14) desc.textContent = `${streak} dias na fila`;
  else if (streak >= 7) desc.textContent = "1 semana completa";
  else if (totalTreinos >= 100) desc.textContent = "100 treinos feitos";
  else if (totalTreinos >= 50) desc.textContent = "50 treinos feitos";
  else if (totalTreinos > 0) desc.textContent = `${totalTreinos} treinos registrados`;
  else desc.textContent = "Comece a treinar!";
}

function openStartWorkoutScreen() {
  const sws = document.getElementById("startWorkoutScreen");
  if (!sws) return;
  sws.classList.add("show");
  // Update greeting
  const hora = new Date().getHours();
  const greets = ["BOA MADRUGADA", "BOM DIA", "BOA TARDE", "BOA NOITE"];
  const swsGreet = document.getElementById("swsGreeting");
  if (swsGreet) swsGreet.textContent = greets[hora < 5 ? 0 : hora < 12 ? 1 : hora < 18 ? 2 : 3];
  // Workout title
  const draft = safeJSON(STORAGE.draftKey, null);
  const sections = draft?.sections || [];
  const nextSec = sections[getNextTreinoIdx()];
  const nextKey = nextSec?.treinoKey || "A";
  const focusMap = { A:"FOCO FORÇA SUPERIOR (AVANÇADO)", B:"FOCO FORÇA INFERIOR (AVANÇADO)", C:"HIPERTROFIA TOTAL", D:"FORÇA E POTÊNCIA", E:"RESISTÊNCIA MUSCULAR", F:"FULL BODY" };
  const swsTitle = document.getElementById("swsTodayTreino");
  if (swsTitle) swsTitle.textContent = `TREINO ${nextKey}: ${focusMap[nextKey] || "PERSONALIZADO"}`;
  // Exercise preview list
  _renderExercisePreviewList(nextSec?.cards || []);
  // Lucide icons re-render
  try { lucide.createIcons(); } catch(e) {}
}

function closeStartWorkoutScreen() {
  const sws = document.getElementById("startWorkoutScreen");
  if (sws) sws.classList.remove("show");
}

function _renderExercisePreviewList(cards) {
  const list = document.getElementById("exercisePreviewList");
  if (!list) return;
  if (!cards.length) { list.innerHTML = ""; return; }
  list.innerHTML = cards.slice(0, 6).map((c, i) => {
    const exSource = c?.exercicios?.[0] || c;
    const ex = getExerciseCardTitle(exSource, i);
    const safeEx = ex.replace(/'/g, "\\'");
    return `<div class="exercise-preview-item exercise-preview-item--tap" onclick="openExerciseOnYouTube(null,'${safeEx}')">
      <div class="exercise-preview-thumb">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,140,0,0.5)" stroke-width="1.5" stroke-linecap="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
      </div>
      <div class="exercise-preview-label">${escapeHTML(ex)}</div>
    </div>`;
  }).join("");
}

function _updateHomeBannerFast(streak, totalTreinos) {
  const msgs = [
    { t:`${streak} dia${streak!==1?'s':''} seguidos. Não para agora.`, s:'Sequência ativa — cada treino conta.' },
    { t:'Hoje é dia de evoluir.',                                        s:'Cada série te aproxima do objetivo.' },
    { t:`${totalTreinos} treinos registrados.`,                          s:'Você é o que você repete. Continue.' },
    { t:'Disciplina supera motivação.',                                   s:'Apareça. Os resultados vêm depois.' },
  ];
  const m = streak > 0 ? msgs[0] : msgs[Math.floor(Date.now()/86400000) % (msgs.length-1) + 1];
  const t = document.getElementById('homeBannerTitle');
  const s = document.getElementById('homeBannerSub');
  if (t) t.textContent = m.t;
  if (s) s.textContent = m.s;
}

// ══════════════════════════════════════════
// TELA DE PERFIL
// ══════════════════════════════════════════
function openPerfil() {
  setDietMiniAppChrome(false);
  try { updatePerfilScreen(); } catch(e) { console.error("updatePerfilScreen:", e); }
  // Preenche seção de conta
  _sb.auth.getSession().then(({ data: { session } }) => {
    const user = session?.user;
    const logado = document.getElementById('perfilContaLogado');
    const deslogado = document.getElementById('perfilContaDeslogado');
    if (user) {
      const nome = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';
      const inicial = nome.charAt(0).toUpperCase();
      document.getElementById('perfilContaNome').textContent = nome;
      document.getElementById('perfilContaEmail').textContent = user.email || '';
      document.getElementById('perfilAvatar').textContent = inicial;
      logado.style.display = 'block';
      deslogado.style.display = 'none';
    } else {
      logado.style.display = 'none';
      deslogado.style.display = 'block';
    }
  }).catch(() => {});
  _showEl('perfilScreen');
  document.body.classList.remove('overlay-open');
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
}
function closePerfil() {
  document.getElementById("perfilScreen").classList.remove("show");
  document.body.classList.remove('overlay-open');
  setDietMiniAppChrome(false);
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
}

// ══════════════════════════════════════════
// TELA DE CONFIGURAÇÕES
// ══════════════════════════════════════════
function openSettingsScreen() {
  // Atualiza badge do plano
  try {
    const badge = document.getElementById('settingsPlanBadge');
    if (badge) {
      const plan = typeof getUserPlan === 'function' ? getUserPlan() : 'free';
      if (plan === 'ultra') {
        badge.textContent = 'ULTRA'; badge.style.background = 'rgba(139,92,246,0.15)'; badge.style.color = '#a855f7'; badge.style.borderColor = 'rgba(139,92,246,0.4)';
      } else if (plan === 'pro') {
        badge.textContent = 'PRO'; badge.style.background = 'rgba(249,115,22,0.15)'; badge.style.color = 'var(--accent)'; badge.style.borderColor = 'rgba(249,115,22,0.4)';
      } else {
        badge.textContent = 'FREE'; badge.style.background = 'rgba(255,255,255,0.07)'; badge.style.color = 'rgba(255,255,255,0.5)'; badge.style.borderColor = 'rgba(255,255,255,0.12)';
      }
    }
    // Tema atual
    const themeVal = document.getElementById('settingsThemeVal');
    if (themeVal) themeVal.textContent = document.documentElement.dataset.theme === 'light' ? 'Claro' : 'Escuro';
    // Unidade atual
    const unidadeVal = document.getElementById('settingsUnidadeVal');
    if (unidadeVal) unidadeVal.textContent = (localStorage.getItem('kronia_unidade') || 'kg');
  } catch(e) {}
  const _ss = document.getElementById('settingsScreen');
  _ss.style.display = ''; _ss.style.visibility = ''; _ss.style.pointerEvents = ''; _ss.removeAttribute('aria-hidden');
  _ss.classList.add('show');
  document.body.classList.add('overlay-open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeSettingsScreen() {
  document.getElementById('settingsScreen').classList.remove('show');
  // Restaura o footer apenas se o perfilScreen também estiver fechado
  if (!document.getElementById('perfilScreen').classList.contains('show')) {
    const footer = document.querySelector('.footer-actions');
    if (footer) footer.style.display = '';
    document.body.classList.remove('overlay-open');
  }
}

function limparChatKronos() {
  if (!confirm('Limpar histórico do chat com KRONOS?')) return;
  try {
    const msgs = document.getElementById('orientExpertMessages');
    if (msgs) msgs.innerHTML = '';
    const ai = document.getElementById('aiMessages');
    if (ai) ai.innerHTML = '';
    showToast('Chat limpo', 'success', 2500);
  } catch(e) {}
}

function exportarDados() {
  try {
    const data = {
      history: JSON.parse(localStorage.getItem('kronia_history_v2') || '[]'),
      config: JSON.parse(localStorage.getItem('kronia_config') || '{}'),
      prs: JSON.parse(localStorage.getItem('kronia_prs') || '{}'),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'kronia_backup_' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); URL.revokeObjectURL(url);
    showToast('Dados exportados!', 'success', 3000);
  } catch(e) { showToast('Erro ao exportar', 'error'); }
}

function toggleUnidade() {
  const atual = localStorage.getItem('kronia_unidade') || 'kg';
  const novo = atual === 'kg' ? 'lbs' : 'kg';
  localStorage.setItem('kronia_unidade', novo);
  const el = document.getElementById('settingsUnidadeVal');
  if (el) el.textContent = novo;
  showToast(`Unidade alterada para ${novo}`, 'success', 2500);
}

// ══════════════════════════════════════════
// TELA DE PREÇOS — FREE / PRO / ULTRA
// ══════════════════════════════════════════
function openPricingScreen() {
  const el = document.getElementById('pricingScreen');
  if (!el) return;
  el.style.display = 'flex';
  // Reset billing toggle to mensal on open
  setPricingBilling('mensal');
}

function setPricingBilling(mode) {
  const isAnual = mode === 'anual';
  const btnM = document.getElementById('prBtnMensal');
  const btnA = document.getElementById('prBtnAnual');
  if (btnM) { btnM.className = isAnual ? 'pr-billing-btn' : 'pr-billing-btn pr-billing-active'; }
  if (btnA) { btnA.className = isAnual ? 'pr-billing-btn pr-billing-active' : 'pr-billing-btn'; }

  const proPrice  = document.getElementById('prProPrice');
  const proCents  = document.getElementById('prProCents');
  const proPeriod = document.getElementById('prProPeriod');
  const ultraPrice  = document.getElementById('prUltraPrice');
  const ultraCents  = document.getElementById('prUltraCents');
  const ultraPeriod = document.getElementById('prUltraPeriod');

  if (isAnual) {
    if (proPrice)    proPrice.textContent  = 'R$20';
    if (proCents)    proCents.textContent  = ',93';
    if (proPeriod)   proPeriod.textContent = '/mês · cobrado anualmente';
    if (ultraPrice)  ultraPrice.textContent  = 'R$41';
    if (ultraCents)  ultraCents.textContent  = ',93';
    if (ultraPeriod) ultraPeriod.textContent = '/mês · cobrado anualmente';
  } else {
    if (proPrice)    proPrice.textContent  = 'R$29';
    if (proCents)    proCents.textContent  = ',90';
    if (proPeriod)   proPeriod.textContent = '/mês';
    if (ultraPrice)  ultraPrice.textContent  = 'R$59';
    if (ultraCents)  ultraCents.textContent  = ',90';
    if (ultraPeriod) ultraPeriod.textContent = '/mês';
  }
}

function closePricingScreen() {
  const el = document.getElementById('pricingScreen');
  if (el) el.style.display = 'none';
}

function selectPlan(plan) {
  if (plan === 'free') { closePricingScreen(); return; }
  if (plan === 'ultra' && typeof assinarUltra === 'function') {
    assinarUltra();
  } else if (typeof assinarPro === 'function') {
    assinarPro();
  } else {
    showToast('Redirecionando para o checkout...', 'info', 3000);
  }
}

// ══════════════════════════════════════════
// TELA EDITAR PERFIL
// ══════════════════════════════════════════
function openEditarPerfil() {
  const cfg = safeJSON("kronia_config", {});
  document.getElementById("epNome").value   = cfg.nome   || "";
  document.getElementById("epPeso").value   = cfg.peso   || "";
  document.getElementById("epAltura").value = cfg.altura || "";
  document.getElementById("epIdade").value  = cfg.idade  || "";
  document.getElementById("epSono").value   = cfg.sono   || "";
  const nome = cfg.nome || "ATLETA";
  document.getElementById("epNomeDisplay").textContent = nome.toUpperCase();
  const hist = safeJSON(STORAGE?.historyKey || "kronia_history", []);
  const nivel = hist.length < 3 ? "Iniciante" : hist.length < 15 ? "Intermediário" : "Avançado";
  document.getElementById("epNivelDisplay").textContent = nivel;
  const av = document.getElementById("epAvatar");
  const epIni = document.getElementById("epAvatarInicial");
  if (av) av.style.backgroundImage = "";
  if (epIni) epIni.textContent = nome[0]?.toUpperCase() || "T";
  const cta = document.getElementById("epCtaTreino");
  if (cta) cta.style.display = "none";
  document.getElementById("editarPerfilScreen").classList.add("show");
  document.body.classList.add('overlay-open');
  const _footerEP = document.querySelector('.footer-actions');
  if (_footerEP) _footerEP.style.display = 'none';
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
}
function closeEditarPerfil() {
  document.getElementById("editarPerfilScreen").classList.remove("show");
  document.body.classList.remove('overlay-open');
  const _footerEP = document.querySelector('.footer-actions');
  if (_footerEP) _footerEP.style.display = '';
}
function epAtualizarNome(val) {
  const display = document.getElementById("epNomeDisplay");
  if (display) display.textContent = (val || "ATLETA").toUpperCase();
  const ini = document.getElementById("epAvatarInicial");
  if (ini) ini.textContent = (val[0] || "T").toUpperCase();
}
function epHandleAvatarUpload(event) {
  if (event && event.target) event.target.value = "";
  showToast("Perfil usa monograma. Upload desativado.", "info", 2200);
}
function salvarPerfilEdit() {
  const data = {
    nome:   document.getElementById("epNome").value.trim(),
    peso:   document.getElementById("epPeso").value,
    altura: document.getElementById("epAltura").value,
    idade:  document.getElementById("epIdade").value,
    sono:   document.getElementById("epSono").value,
  };
  localStorage.setItem("kronia_config", JSON.stringify(data));
  if (typeof _dbSync !== "undefined") _dbSync.pushConfig();
  // Sincroniza todos os elementos visuais
  const nome = data.nome || "ATLETA";
  const syncEls = [
    ["perfilNome",     el => el.textContent = nome.toUpperCase()],
    ["perfilNomeInput",el => el.value = data.nome],
    ["perfilPeso",     el => el.value = data.peso],
    ["perfilAltura",   el => el.value = data.altura],
    ["perfilIdade",    el => el.value = data.idade],
    ["perfilSono",     el => el.value = data.sono],
    ["perfilSonoStat", el => el.textContent = data.sono ? data.sono+"h" : "—"],
    ["homeCardNome",   el => el.textContent = nome.toUpperCase()],
    ["epNomeDisplay",  el => el.textContent = nome.toUpperCase()],
  ];
  syncEls.forEach(([id, fn]) => { const el = document.getElementById(id); if (el) fn(el); });
  const inicial = nome[0]?.toUpperCase() || "T";
  ["perfilAvatar","homeCardAvatar"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.backgroundImage = "";
      el.textContent = inicial;
    }
  });
  const ini = document.getElementById("epAvatarInicial");
  if (ini) ini.textContent = inicial;
  const btn = document.querySelector("#editarPerfilScreen .ep-save");
  if (btn) { btn.textContent = "✓ Salvo!"; setTimeout(() => { btn.textContent = "Salvar Perfil"; }, 2000); }
  // CTA para configurar treino após salvar perfil
  const cta = document.getElementById("epCtaTreino");
  if (cta) cta.style.display = "flex";
  showToast("Perfil atualizado!", "success", 2000);
}
function epIrParaTreino() {
  closeEditarPerfil();
  setTimeout(openKronosWorkoutEntry, 200);
}

function salvarMedidas() {
  const data = {
    nome:   document.getElementById("perfilNomeInput")?.value || "",
    peso:   document.getElementById("perfilPeso")?.value || "",
    altura: document.getElementById("perfilAltura")?.value || "",
    idade:  document.getElementById("perfilIdade")?.value || "",
    sono:   document.getElementById("perfilSono")?.value   || "",
    objetivo: normalizeKroniaObjective(document.getElementById("perfilObjetivoGlobal")?.value || safeJSON("kronia_config", {}).objetivo || "manutencao"),
  };
  localStorage.setItem("kronia_config", JSON.stringify(data));
  persistUserAnamnesis(data);
  _dbSync.pushConfig(); // backup silencioso na nuvem
  const nome = data.nome || "ATLETA";
  document.getElementById("perfilNome").textContent = nome.toUpperCase();
  document.getElementById("perfilAvatar").style.backgroundImage = "";
  document.getElementById("perfilAvatar").textContent = nome[0]?.toUpperCase() || "T";
  const hc = document.getElementById("homeCardNome");
  if (hc) {
    hc.textContent = nome.toUpperCase();
    const homeAvatar = document.getElementById("homeCardAvatar");
    if (homeAvatar) {
      homeAvatar.style.backgroundImage = "";
      homeAvatar.textContent = nome[0]?.toUpperCase() || "T";
    }
  }
}

function archiveActiveDietLocally(reason) {
  var current = window._kroniaDietPlan || readLocalActiveDietPlan();
  if (!current) return false;
  var history = safeJSON(KRONIA_DIET_HISTORY_KEY, []);
  history.unshift({
    archivedAt: new Date().toISOString(),
    reason: reason || 'objective_change',
    plan: current
  });
  try { localStorage.setItem(KRONIA_DIET_HISTORY_KEY, JSON.stringify(history.slice(0, 20))); } catch (_) {}
  return true;
}

async function applyGlobalObjectiveOnly(objective) {
  var next = persistUserAnamnesis({ objetivo: objective });
  await saveUserAnamnesisToSupabase(next);
  try { if (typeof _dbSync !== 'undefined') _dbSync.pushConfig(); } catch (_) {}
  var select = document.getElementById('perfilObjetivoGlobal');
  if (select) select.value = normalizeKroniaObjective(objective);
  showToast('A dieta atual será mantida até você gerar uma nova.', 'info', 3600);
  if (document.getElementById('dietDataScreen')?.classList.contains('show')) renderActiveDietPlan();
}

async function generateDietForGlobalObjective(objective) {
  var next = persistUserAnamnesis({ objetivo: objective });
  await saveUserAnamnesisToSupabase(next);
  archiveActiveDietLocally('global_objective_change_' + normalizeKroniaObjective(objective));
  var context = analyzeDietContext();
  context.userProfile.objetivo = normalizeKroniaObjective(objective);
  var baseline = computeDietGenerationBaseline({
    peso: Number(context.userProfile.peso || 75),
    altura: Number(context.userProfile.altura || 175),
    idade: Number(context.userProfile.idade || 30),
    sexo: context.userProfile.sexo || 'masculino',
    nivelAtividade: context.userProfile.nivel_atividade || 'levemente ativo',
    objetivo: normalizeKroniaObjective(objective)
  });
  var basePlan = normalizeDietGeneratedPlan({
    objetivo: normalizeKroniaObjective(objective),
    visualPrescription: buildDefaultDietVisualPrescription(),
    meta: {
      calorias: baseline.metaCalorias,
      proteina: baseline.proteinaMeta,
      carbo: baseline.carboMeta,
      gordura: baseline.gorduraMeta,
      tmb: baseline.tmb,
      get: baseline.tdee
    },
    observacoes: [buildDietContextInsight(context)]
  }, { source: 'global_objective_regeneration' });
  basePlan.objective = normalizeKroniaObjective(objective);
  basePlan.targets = {
    kcal: baseline.metaCalorias,
    protein: baseline.proteinaMeta,
    carbs: baseline.carboMeta,
    fat: baseline.gorduraMeta
  };
  setActiveDietPlan(basePlan, { render: false });
  var savedPlan = await saveActiveDietPlan({ silent: true, contextSnapshot: analyzeUserContext() });
  finishDietGenerationSuccess(savedPlan || basePlan);
}

function handleGlobalObjectiveChange(value) {
  var objective = normalizeKroniaObjective(value);
  var current = normalizeKroniaObjective(readLocalUserAnamnesis().objetivo);
  if (objective === current) return;
  var message = 'Mudar o objetivo altera dieta, treino e recomendações do KRONOS. Deseja gerar uma nova dieta com esse objetivo?';
  var generate = window.confirm(message + '\n\nOK = Gerar nova dieta\nCancelar = escolher entre salvar ou cancelar');
  if (generate) {
    generateDietForGlobalObjective(objective).catch(function() {
      showToast('Não foi possível gerar a nova dieta agora.', 'error', 3200);
    });
    return;
  }
  var saveOnly = window.confirm('Apenas salvar objetivo?\n\nOK = Apenas salvar objetivo\nCancelar = Cancelar');
  if (saveOnly) {
    applyGlobalObjectiveOnly(objective).catch(function() { showToast('Objetivo salvo localmente.', 'info', 2600); });
    return;
  }
  var select = document.getElementById('perfilObjetivoGlobal');
  if (select) select.value = current;
}

function updatePerfilScreen() {
  const cfg  = safeJSON("kronia_config", {});
  const hist = safeJSON(STORAGE.historyKey, []);
  const streak = calcStreak();

  // Dados básicos
  if (cfg.nome) {
    document.getElementById("perfilNome").textContent = cfg.nome.toUpperCase();
    document.getElementById("perfilNomeInput").value = cfg.nome;
  }
  document.getElementById("perfilAvatar").style.backgroundImage = "";
  document.getElementById("perfilAvatar").textContent = cfg.nome ? cfg.nome[0].toUpperCase() : "A";
  if (cfg.peso)   document.getElementById("perfilPeso").value   = cfg.peso;
  if (cfg.altura) document.getElementById("perfilAltura").value = cfg.altura;
  if (cfg.idade)  document.getElementById("perfilIdade").value  = cfg.idade;
  if (cfg.sono)   document.getElementById("perfilSono").value   = cfg.sono;
  const objSelect = document.getElementById("perfilObjetivoGlobal");
  if (objSelect) objSelect.value = normalizeKroniaObjective(readLocalUserAnamnesis().objetivo || cfg.objetivo || "manutencao");
  const sonoStat = document.getElementById("perfilSonoStat");
  if (sonoStat) sonoStat.textContent = cfg.sono ? cfg.sono+'h' : '—';

  // Stats
  document.getElementById("perfilTotalTreinos").textContent = hist.length;
  document.getElementById("perfilStreak").textContent = streak;
  const volTotal = hist.reduce((a, h) => a + calcVolumeTotal(h.state), 0);
  document.getElementById("perfilVolTotal").textContent =
    volTotal > 999999 ? (volTotal / 1000000).toFixed(1) + "M" :
    volTotal > 999 ? (volTotal / 1000).toFixed(1) + "t" : Math.round(volTotal) + "kg";

  // Nível (usa persona efetiva)
  const _evPerfil = calcPersonaEfetiva(hist, cfg);
  const nivelLabels = { turista:"✈️ Turista", iniciante:"🌱 Iniciante", dedicado:"💪 Dedicado", atleta:"🔥 Atleta" };
  const _nivelEl = document.getElementById("perfilNivel");
  if (_nivelEl) _nivelEl.textContent = nivelLabels[_evPerfil.efetiva] || _evPerfil.efetiva;

  // Conquistas
  const conquistasEl = document.getElementById("perfilConquistas");
  if (conquistasEl) {
    if (_evPerfil.marcos.length > 0) {
      conquistasEl.innerHTML = _evPerfil.marcos.map(m =>
        `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:6px 12px;font-size:.75rem;font-weight:700;color:var(--text-2)">
          <span>${m.icon}</span><span>${m.label}</span>
        </div>`
      ).join("");
      // Próximo marco
      if (_evPerfil.proximoMarco) {
        conquistasEl.innerHTML += `<div style="width:100%;margin-top:6px;font-size:.72rem;color:var(--muted);padding:4px 2px">Próximo: ${_evPerfil.proximoMarco.label}</div>`;
      }
    } else {
      conquistasEl.innerHTML = `<div style="color:var(--muted);font-size:0.8rem;padding:8px 0">Ainda sem conquistas — comece a treinar!</div>`;
    }
  }

  // PRs
  const prMap = {};
  hist.forEach(h => {
    (h.state?.sections || []).forEach(sec => {
      (sec.cards || []).forEach(card => {
        (card.values || []).forEach(v => {
          if (v.kg && v.reps) {
            const rm1 = parseFloat(v.kg) * (1 + parseFloat(v.reps) / 30);
            if (!prMap[card.name] || rm1 > prMap[card.name]) prMap[card.name] = rm1;
          }
        });
      });
    });
  });
  const prList = document.getElementById("perfilPRList");
  const prs = Object.entries(prMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (prs.length > 0) {
    prList.innerHTML = prs.map(([nome, val]) =>
      `<div class="perfil-pr-item">
        <span class="perfil-pr-name">${nome}</span>
        <span class="perfil-pr-val">${val.toFixed(1)} kg 1RM</span>
      </div>`
    ).join("");
  }

  // Calendário 28 dias
  const cal = document.getElementById("perfilCal");
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diasTreino = new Set(hist.map(h => {
    const d = new Date(h.createdAt); d.setHours(0,0,0,0); return d.getTime();
  }));
  cal.innerHTML = "";
  for (let i = 27; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - i);
    const div = document.createElement("div");
    div.className = "perfil-cal-day" +
      (diasTreino.has(d.getTime()) ? " treinou" : "") +
      (i === 0 ? " today" : "");
    div.textContent = d.getDate();
    cal.appendChild(div);
  }

  // Heatmap muscular
  updateHeatmap(hist);
}

function updateHeatmap(hist) {
  const muscKeywords = {
    "peito":      ["supino", "crucifixo", "peito", "flexão", "crossover", "peck"],
    "costas":     ["remada", "puxada", "barra fixa", "lat", "costas", "pull", "deadlift", "terra"],
    "ombros":     ["ombro", "desenvolvimento", "elevação lateral", "elevação frontal", "press", "deltóide"],
    "biceps":     ["rosca", "bíceps", "curl"],
    "triceps":    ["tríceps", "francês", "pulley", "mergulho", "extensão", "coice"],
    "quadriceps": ["agachamento", "leg press", "hack squat", "cadeira extensora", "quad"],
    "posterior":  ["stiff", "mesa flexora", "cadeira flexora", "isquio", "posterior"],
    "gluteos":    ["glúteo", "hip thrust", "elevação pélvica", "abdução", "passada", "avanço"],
    "abdomen":    ["abdômen", "prancha", "abdominal", "crunch", "elevação de pernas", "dead bug"],
  };

  const counts = {};
  Object.keys(muscKeywords).forEach(m => counts[m] = 0);

  const semAgo = Date.now() - 7 * 86400000;
  hist.filter(h => h.createdAt > semAgo).forEach(h => {
    (h.state?.sections || []).forEach(sec => {
      (sec.cards || []).forEach(card => {
        const nomeLower = (card.name || "").toLowerCase();
        Object.entries(muscKeywords).forEach(([musc, kws]) => {
          if (kws.some(kw => nomeLower.includes(kw))) counts[musc]++;
        });
      });
    });
  });

  const maxCount = Math.max(1, ...Object.values(counts));

  // Agrega grupos menores nos 4 cards visuais
  const cardGroups = {
    "mc-peito":  counts["peito"] || 0,
    "mc-costas": counts["costas"] || 0,
    "mc-pernas": (counts["quadriceps"] || 0) + (counts["posterior"] || 0) + (counts["gluteos"] || 0),
    "mc-ombros": (counts["ombros"] || 0) + (counts["biceps"] || 0) + (counts["triceps"] || 0),
  };
  const cardMax = Math.max(1, ...Object.values(cardGroups));

  const levelLabel = ["—", "Leve", "Moderado", "Intenso"];

  Object.entries(cardGroups).forEach(([id, cnt]) => {
    const card = document.getElementById(id);
    if (!card) return;
    const level = cnt === 0 ? 0 : cnt / cardMax < 0.34 ? 1 : cnt / cardMax < 0.67 ? 2 : 3;
    card.dataset.level = level;
    const dot = card.querySelector(".mc-dot");
    const label = card.querySelector(".mc-label");
    if (dot && label) {
      label.textContent = levelLabel[level];
    }
  });
}

// ══════════════════════════════════════════
// TELA ORIENTAÇÃO
// ══════════════════════════════════════════
// ─── Health check diário ─────────────────────────────────────────────────────
// Roda uma vez por dia ao abrir o chat. Detecta se a API está fora e avisa.
function _kronosHealthCheck() {
  const today = new Date().toDateString();
  if (localStorage.getItem('_kronosHCDate') === today) return; // já verificou hoje

  apiFetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: "ping" }], stream: false })
  })
  .then(async r => parseApiJsonSafely(r))
  .then((data) => {
    if (data.success === false) throw new Error(data.error || "healthcheck_fail");
    localStorage.setItem('_kronosHCDate', today);
    localStorage.setItem('_kronosHCStatus', 'ok');
    _kronosRemoveHealthBanner();
  })
  .catch(() => {
    localStorage.setItem('_kronosHCDate', today);
    localStorage.setItem('_kronosHCStatus', 'fail');
    _kronosShowHealthBanner();
  });

  // Exibe banner se o último check registrado era falha
  if (localStorage.getItem('_kronosHCStatus') === 'fail') _kronosShowHealthBanner();
}

function _kronosShowHealthBanner() {
  if (document.getElementById('_kronosHealthBanner')) return;
  const bar = document.createElement('div');
  bar.id = '_kronosHealthBanner';
  bar.style.cssText = 'position:sticky;top:0;z-index:10;background:#7c2d12;color:#fef3c7;font-size:0.75rem;padding:6px 14px;text-align:center;letter-spacing:.02em;';
  bar.textContent = '⚠ KRONOS offline — respostas podem falhar. Verificando...';
  const wrap = document.querySelector('.orient-chat-wrap');
  if (wrap) wrap.prepend(bar);
}

function _kronosRemoveHealthBanner() {
  document.getElementById('_kronosHealthBanner')?.remove();
}

function openOrientacao() {
  // Versão unificada do chat: qualquer entrada abre o modal principal do KRONOS.
  openAI();
}

function ariaGreeting() {
  const cfg    = safeJSON("kronia_config", {});
  const hist   = safeJSON(STORAGE.historyKey, []);
  const streak = calcStreak();
  const draft  = safeJSON(STORAGE.draftKey, null);
  const nome   = cfg.nome || "";

  // Monta contexto compacto para o greeting
  const totalSessoes = hist.length;
  const ultima = hist.length ? hist[hist.length - 1] : null;
  const ultimaData = ultima ? new Date(ultima.createdAt).toLocaleDateString("pt-BR") : null;
  const volUltima = ultima ? Math.round(calcVolumeTotal(ultima.state)) : 0;

  // Próximo treino pendente no programa
  const sections = draft?.sections || [];
  const nextIdx  = getNextTreinoIdx();
  const nextSec  = sections[nextIdx];
  const nextKey  = nextSec?.treinoKey || null;
  const nextExs  = (nextSec?.cards || []).map(c => c.name).slice(0, 3).join(", ");

  const prompt = `[SAUDAÇÃO PROATIVA — análise silenciosa dos dados do usuário]

Abra a conversa como ARIA analisando o status atual:
- Nome: ${nome || "usuário"}
- Streak: ${streak} dias consecutivos
- Total de sessões: ${totalSessoes}
- Último treino: ${ultimaData ? `${ultimaData}, volume ${volUltima}kg` : "nenhum ainda"}
- Próximo treino no programa: ${nextKey ? `Treino ${nextKey} (${nextExs || "exercícios pendentes"})` : "não configurado"}
- Peso: ${cfg.peso || "não informado"} kg

Seja direta, use o nome se disponível. Máximo 3 linhas. Destaque 1 alerta real ou conquista. Finalize com uma pergunta curta ou call to action.`;

  const typing = addOrientMsg("orientExpertMessages", "assistant", "...");
  apiFetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      history: safeJSON(STORAGE.historyKey, []).slice(0, 10),
      profile: cfg
    })
  })
  .then(async r => parseApiJsonSafely(r))
  .then(data => {
    const text = data.message || data.data?.content?.[0]?.text || data.content?.[0]?.text || "Sistemas online.";
    typing.innerHTML = renderMarkdown(text);
    // Botão "Ir para Treino" quando não há programa configurado
    if (!nextKey) {
      const actionBtn = document.createElement("button");
      actionBtn.className = "kronos-action-btn";
      actionBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg> Ir para Treino`;
      actionBtn.onclick = () => { closeOrientacao(); navTo("treino"); };
      typing.appendChild(actionBtn);
    }
    _orientExpertHistory.push({ role: "assistant", content: text });
    // Colapsa chips após saudação
    const row = document.querySelector(".orient-shortcuts-row");
    const btn = document.getElementById("orientSuggestBtn");
    if (row) { row.classList.add("collapsed"); btn && btn.classList.remove("open"); }
  })
  .catch(() => { typing.innerHTML = "KRONOS online. O que vamos atacar hoje?"; });
}

function renderAriaChips() {
  const container = document.getElementById("ariaChipsDynamic");
  if (!container) return;
  const cfg    = safeJSON("kronia_config", {});
  const hist   = safeJSON(STORAGE.historyKey, []);
  const streak = calcStreak();
  const draft  = safeJSON(STORAGE.draftKey, null);
  const sections = draft?.sections || [];
  const nextIdx  = getNextTreinoIdx();
  const nextSec  = sections[nextIdx];
  const nextKey  = nextSec?.treinoKey || null;

  const chips = [];

  // Chip dinâmico: próximo treino
  if (nextKey) {
    const grupo = (nextSec?.cards || []).slice(0,2).map(c=>c.name).join(" + ") || `Treino ${nextKey}`;
    chips.push({ icon: "▸", label: `Me prepara pro ${grupo.length > 22 ? `Treino ${nextKey}` : grupo}`, msg: `Me prepara para o próximo treino: Treino ${nextKey}. Quais são os pontos de atenção?` });
  }

  // Chip dinâmico: streak
  if (streak >= 3) {
    chips.push({ icon: "🔥", label: `${streak} dias — e agora?`, msg: `Estou com ${streak} dias de streak. Como mantenho a intensidade sem entrar em overtraining?` });
  }

  // Chip dinâmico: histórico
  if (hist.length >= 3) {
    chips.push({ icon: "📈", label: "Minha evolução recente", msg: "Analise minha evolução nas últimas sessões. Estou progredindo bem?" });
  }

  // Chips fixos sempre úteis
  chips.push({ icon: "💊", label: "Suplementos que valem", msg: "Quais suplementos têm evidência científica real e valem a pena para meu objetivo?" });
  chips.push({ icon: "🍗", label: "Pós-treino ideal", msg: "O que comer no pós-treino para maximizar recuperação e hipertrofia?" });

  container.innerHTML = chips.slice(0, 5).map(c =>
    `<div class="orient-chip" onclick="ariaQuickSend(${JSON.stringify(c.msg).replace(/'/g,"\\'")})">`+
    `<span class="orient-chip-icon">${c.icon}</span>`+
    `<span class="orient-chip-name">${c.label}</span></div>`
  ).join("");
}

function ariaQuickSend(msg) {
  document.getElementById("orientExpertInput").value = msg;
  sendOrientExpert();
}
function closeOrientacao() {
  document.getElementById("orientacaoScreen").classList.remove("show");
  document.body.classList.remove('overlay-open');
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
  if (_orientFromHome) { navTo("inicio"); openHome(); } else { navTo("treino"); }
  _orientFromHome = false;
}
function resolveKroniaThemeForDieta() {
  var root = document.documentElement;
  var body = document.body;
  var raw = (root && root.dataset && root.dataset.theme) || (body && body.dataset && body.dataset.theme) || "";
  if (raw === "light" || raw === "dark") return raw;
  if ((root && root.classList && root.classList.contains("light-mode")) || (body && body.classList && body.classList.contains("light-mode"))) return "light";
  if ((root && root.classList && root.classList.contains("dark-mode")) || (body && body.classList && body.classList.contains("dark-mode"))) return "dark";
  return "dark";
}
function syncDietaTheme(theme) {
  var resolved = theme === "light" ? "light" : "dark";
  [
    "dietaScreen",
    "dietDataScreen",
    "modalBackdrop",
    "bottomSheet",
    "dietAddItemSheet"
  ].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.dataset.theme = resolved;
    el.classList.toggle("light-mode", resolved === "light");
    el.classList.toggle("dark-mode", resolved === "dark");
  });
  return resolved;
}
window.addEventListener("kronia:theme-changed", function(event) {
  syncDietaTheme(event && event.detail && event.detail.theme || resolveKroniaThemeForDieta());
});
function openDieta() {
  scheduleKroniaUIUnblock('before-diet-open');
  try { window.KroniaDiet?.hideLegacyScreens?.(); } catch (_) {}
  syncDietaTheme(resolveKroniaThemeForDieta());
  try { navTo("dieta"); } catch (_) {}
  if (window.KroniaDiet && typeof window.KroniaDiet.open === 'function') {
    return window.KroniaDiet.open({ source: 'open_dieta' });
  }
  try { openDietDataScreen(); } catch (_) {}
  return;
}

function asKroniaNumber(value, fallback) {
  var n = Number(value);
  return Number.isFinite(n) ? n : (arguments.length > 1 ? fallback : 0);
}

function formatKroniaNumber(value, unit) {
  var n = asKroniaNumber(value, 0);
  var rounded = Math.round(n * 10) / 10;
  return rounded.toLocaleString('pt-BR') + (unit ? ' ' + unit : '');
}

function getTodayRangeISO() {
  var start = new Date();
  start.setHours(0, 0, 0, 0);
  var end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function renderKroniaMetricCard(title, value, sub) {
  return '<div class="kronia-card">'
    + '<div class="kronia-card-title">' + escapeHTML(title) + '</div>'
    + '<div class="kronia-card-value">' + escapeHTML(value) + '</div>'
    + '<div class="kronia-card-sub">' + escapeHTML(sub || '') + '</div>'
    + '</div>';
}

function renderKroniaProgress(label, consumed, target, cssClass, unit) {
  var c = asKroniaNumber(consumed, 0);
  var t = asKroniaNumber(target, 0);
  var pct = t > 0 ? Math.min(100, Math.round((c / t) * 100)) : 0;
  var right = t > 0
    ? formatKroniaNumber(c, unit) + ' / ' + formatKroniaNumber(t, unit)
    : formatKroniaNumber(c, unit);
  return '<div>'
    + '<div class="kronia-progress-head"><span>' + escapeHTML(label) + '</span><span>' + escapeHTML(right) + '</span></div>'
    + '<div class="kronia-progress-track"><div class="kronia-progress-fill ' + (cssClass || '') + '" style="width:' + pct + '%"></div></div>'
    + '</div>';
}

function openDietDataScreen() {
  scheduleKroniaUIUnblock('before-diet-data-open');
  syncDietaTheme(resolveKroniaThemeForDieta());
  try { closeAllDietGenerationLayers({ keepDietData: true }); } catch (_) {}
  setDietMiniAppChrome(false);
  document.getElementById('dietChoiceScreen')?.classList.remove('show');
  var dataScreen = document.getElementById('dietDataScreen');
  if (dataScreen) {
    dataScreen.removeAttribute('hidden');
    dataScreen.hidden = false;
    dataScreen.style.display = '';
    dataScreen.style.visibility = '';
    dataScreen.style.opacity = '';
    dataScreen.style.pointerEvents = '';
    dataScreen.removeAttribute('aria-hidden');
    dataScreen.classList.add('show');
  }
  document.body.classList.remove('overlay-open');
  var greetingEl = document.getElementById('dietHeaderGreeting');
  if (greetingEl) greetingEl.textContent = getDietGreeting(readLocalUserAnamnesis().nome);
  renderActiveDietPlan();
  refreshDietDataScreen();
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
  scheduleKroniaUIUnblock('after-diet-data-open');
}

function openDietChoiceScreen() {
  scheduleKroniaUIUnblock('before-diet-choice-open');
  try { window.KroniaDiet?.hideLegacyScreens?.(); } catch (_) {}
  try { closeAllDietGenerationLayers({ keepDietChoice: true }); } catch (_) {}
  return openOfficialDietEntry({ source: 'diet_choice_screen', forceNew: true });
}

function startAIDiet() {
  scheduleKroniaUIUnblock('before-start-ai-diet');
  try { window.KroniaDiet?.hideLegacyScreens?.(); } catch (_) {}

  // Checa anamnese: se incompleta, abre o wizard antes de gerar dieta
  _anIsCompleted().then(function(done) {
    if (!done) { openAnamnese(true); return; }
    if (window.KroniaDiet && typeof window.KroniaDiet.generate === 'function') {
      window.KroniaDiet.generate({ source: 'start_ai_diet' });
    } else {
      openOfficialDietEntry({ source: 'start_ai_diet_fallback', forceNew: true });
    }
  }).catch(function() {
    // Fallback resiliente: gera mesmo sem anamnese
    if (window.KroniaDiet && typeof window.KroniaDiet.generate === 'function') {
      window.KroniaDiet.generate({ source: 'start_ai_diet' });
    } else {
      openOfficialDietEntry({ source: 'start_ai_diet_fallback', forceNew: true });
    }
  });
}

function loadDietScriptOnceFromApp(src, marker, testFn) {
  if (typeof testFn === 'function' && testFn()) return Promise.resolve(true);
  return new Promise(function(resolve) {
    var existing = document.querySelector('script[data-kronia-app-loader="' + marker + '"]');
    if (existing) existing.remove();
    var script = document.createElement('script');
    script.src = '/' + src + '?v=20260502-fix-nav&t=' + Date.now();
    script.async = false;
    script.defer = false;
    script.dataset.kroniaAppLoader = marker;
    script.onload = function() { resolve(typeof testFn === 'function' ? !!testFn() : true); };
    script.onerror = function() { resolve(false); };
    document.head.appendChild(script);
  });
}

function hideLegacyDietSurfaces(reason) {
  ['nutritionFlowScreen', 'dietChoiceScreen', 'dietEmergencyWizardScreen'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('show', 'active', 'open');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
  });
  try { localStorage.removeItem('kronia_diet_wizard_state_v1'); } catch (_) {}
  try { localStorage.removeItem('kronia_diet_wizard_state_v2'); } catch (_) {}
  try { localStorage.removeItem('kronia_diet_wizard_state_v6_standalone'); } catch (_) {}
  document.body?.classList.remove('nutrition-flow-active', 'overlay-open');
  scheduleKroniaUIUnblock(reason || 'hide-legacy-diet-surfaces');
}

async function openOfficialDietEntry(context) {
  var ctx = Object.assign({ source: 'official_diet_entry', forceNew: true }, context || {});
  hideLegacyDietSurfaces('before-official-diet-entry');
  try { window.KroniaDiet?.hideLegacyScreens?.(); } catch (_) {}
  if (window.KroniaDiet && typeof window.KroniaDiet.open === 'function') {
    return window.KroniaDiet.open(ctx);
  }
  await loadDietScriptOnceFromApp('src/ui/diet/diet-plan-renderer.js', 'diet-renderer', function() {
    return typeof window.renderDietFromPlan === 'function';
  });
  try {
    if (typeof readLocalActiveDietPlan === 'function' && !readLocalActiveDietPlan() && typeof buildFallbackActiveDietPlan === 'function' && typeof setActiveDietPlan === 'function') {
      setActiveDietPlan(buildFallbackActiveDietPlan(), { render: false });
    }
  } catch (_) {}
  try { if (typeof navTo === 'function') navTo('dieta'); } catch (_) {}
  if (typeof openDietDataScreen === 'function') {
    openDietDataScreen();
    return true;
  }
  if (typeof showToast === 'function') showToast('Não consegui abrir a criação de dieta. Atualize a página e tente novamente.', 'error', 3500);
  return false;
}

function buildManualDietTemplate() {
  var now = new Date().toISOString();
  return {
    title: 'Plano Alimentar Manual',
    objective: 'equilibrado',
    source: 'manual_template',
    createdAt: now,
    updatedAt: now,
    meals: [
      {
        name: 'Café da Manhã',
        time: '07:00',
        slot: 'cafe_manha',
        order: 1,
        items: [
          { name: 'Ovos mexidos', quantity: '3 unidades', grams: 150, kcal: 215, protein: 17, carbs: 1, fat: 16, order: 1 },
          { name: 'Pão integral', quantity: '2 fatias', grams: 60, kcal: 150, protein: 5, carbs: 28, fat: 2, order: 2 },
          { name: 'Banana', quantity: '1 unidade', grams: 100, kcal: 89, protein: 1, carbs: 23, fat: 0, order: 3 }
        ]
      },
      {
        name: 'Lanche da Manhã',
        time: '10:00',
        slot: 'lanche_manha',
        order: 2,
        items: [
          { name: 'Iogurte natural', quantity: '1 pote (170g)', grams: 170, kcal: 99, protein: 17, carbs: 6, fat: 1, order: 1 },
          { name: 'Granola', quantity: '30g', grams: 30, kcal: 120, protein: 3, carbs: 20, fat: 3, order: 2 }
        ]
      },
      {
        name: 'Almoço',
        time: '12:30',
        slot: 'almoco',
        order: 3,
        items: [
          { name: 'Arroz branco cozido', quantity: '4 colheres', grams: 160, kcal: 208, protein: 4, carbs: 45, fat: 0, order: 1 },
          { name: 'Feijão cozido', quantity: '1 concha', grams: 120, kcal: 130, protein: 8, carbs: 23, fat: 1, order: 2 },
          { name: 'Frango grelhado', quantity: '150g', grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 6, order: 3 },
          { name: 'Salada verde', quantity: '1 prato', grams: 80, kcal: 20, protein: 1, carbs: 3, fat: 0, order: 4 }
        ]
      },
      {
        name: 'Lanche da Tarde',
        time: '15:30',
        slot: 'lanche_tarde',
        order: 4,
        items: [
          { name: 'Maçã', quantity: '1 unidade', grams: 130, kcal: 68, protein: 0, carbs: 18, fat: 0, order: 1 },
          { name: 'Castanha-do-pará', quantity: '30g', grams: 30, kcal: 196, protein: 4, carbs: 3, fat: 20, order: 2 }
        ]
      },
      {
        name: 'Jantar',
        time: '19:00',
        slot: 'jantar',
        order: 5,
        items: [
          { name: 'Batata-doce cozida', quantity: '200g', grams: 200, kcal: 172, protein: 4, carbs: 40, fat: 0, order: 1 },
          { name: 'Carne bovina patinho', quantity: '150g', grams: 150, kcal: 225, protein: 35, carbs: 0, fat: 9, order: 2 },
          { name: 'Brócolis cozido', quantity: '100g', grams: 100, kcal: 35, protein: 3, carbs: 6, fat: 0, order: 3 }
        ]
      }
    ]
  };
}

function startManualDiet() {
  document.getElementById('dietChoiceScreen')?.classList.remove('show');
  var template = buildManualDietTemplate();
  if (typeof setActiveDietPlan === 'function') setActiveDietPlan(template, { render: false });
  else { window._kroniaDietPlan = template; try { localStorage.setItem(KRONIA_ACTIVE_DIET_PLAN_KEY, JSON.stringify(template)); } catch(_) {} }
  _dietCoreView = 'minha-dieta';
  openDietDataScreen();
  if (typeof showToast === 'function') showToast('Modelo base carregado — edite à vontade!', 'info', 3000);
}

var KRONIA_ACTIVE_DIET_PLAN_KEY = 'kronia_active_diet_plan_v2';
var KRONIA_DIET_WATER_TRACKER_KEY = 'kronia_diet_water_tracker_v1';
var KRONIA_USER_ANAMNESIS_KEY = 'kronia_user_anamnesis_v1';
var KRONIA_DIET_HISTORY_KEY = 'kronia_diet_history_v1';
var KRONIA_NUTRITION_MEMORY_KEY = 'kronia_nutrition_memory_v1';
var _dietCoreView = 'home';
var _labsReturnDietMiniChrome = false;

function resetDietGenerationDraftState() {
  try { localStorage.removeItem('kronia_diet_wizard_state_v1'); } catch (_) {}
  try { localStorage.removeItem('kronia_diet_wizard_state_v2'); } catch (_) {}
  try { localStorage.removeItem('kronia_diet_wizard_state_v6_standalone'); } catch (_) {}
  try {
    if (window._nutritionFlowState && typeof defaultNutritionFlowState === 'function') {
      window._nutritionFlowState = defaultNutritionFlowState();
    }
  } catch (_) {}
}

function closeAllDietGenerationLayers(options) {
  var opts = options && typeof options === 'object' ? options : {};
  var ids = [
    'nutritionFlowScreen',
    'dietResultScreen',
    'dietGeneratedScreen',
    'dietaSheet',
    'dietAddItemSheet'
  ];
  if (!opts.keepDietChoice) ids.push('dietChoiceScreen');
  if (!opts.keepDietData) ids.push('dietDataScreen');
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (id === 'dietAddItemSheet') {
      el.remove();
      return;
    }
    el.classList.remove('show', 'active', 'open');
    if (id === 'dietaSheet') {
      el.setAttribute('aria-hidden', 'true');
      try { el.setAttribute('inert', ''); } catch (_) {}
    }
  });
  ['modalBackdrop', 'bottomSheet'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('show', 'active', 'open');
  });
  document.querySelectorAll('#nutritionFlowScreen .show,#nutritionFlowScreen .active,#dietResultScreen .show,#dietResultScreen .active,#dietGeneratedScreen .show,#dietGeneratedScreen .active').forEach(function(el) {
    el.classList.remove('show', 'active');
  });
  if (document.body) {
    document.body.classList.remove('diet-wizard-active', 'nutrition-flow-active', 'overlay-open');
    document.body.style.overflow = window._dietPremiumPrevBodyOverflow || '';
  }
  window._dietPremiumPrevBodyOverflow = undefined;
  window._dietPremiumSheetState = null;
  var footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
}

function finishDietGenerationSuccess(savedDiet) {
  var normalizedPlan = null;
  try {
    normalizedPlan = savedDiet && Array.isArray(savedDiet.meals)
      ? recalculateDietPlan(savedDiet)
      : normalizeDietGeneratedPlan(savedDiet || (window._nutritionFlowState && window._nutritionFlowState.generatedPlan) || buildFallbackActiveDietPlan(), {
          source: savedDiet && savedDiet.source || 'diet_generation_success'
        });
    setActiveDietPlan(normalizedPlan, { render: false });
  } catch (_) {
    normalizedPlan = window._kroniaDietPlan || readLocalActiveDietPlan() || buildFallbackActiveDietPlan();
    try { setActiveDietPlan(normalizedPlan, { render: false }); } catch (__ ) {}
  }
  closeAllDietGenerationLayers({ keepDietData: true });
  try { localStorage.removeItem('kronia_diet_wizard_state_v1'); } catch (_) {}
  try { localStorage.removeItem('kronia_diet_wizard_state_v2'); } catch (_) {}
  try { localStorage.removeItem('kronia_diet_wizard_state_v6_standalone'); } catch (_) {}
  _dietCoreView = 'minha-dieta';
  try { navTo('dieta'); } catch (_) {}
  var dataScreen = document.getElementById('dietDataScreen');
  if (dataScreen) _showEl(dataScreen);
  renderActiveDietPlan();
  var now = Date.now();
  if (!window._kroniaDietSuccessToastAt || now - window._kroniaDietSuccessToastAt > 1500) {
    window._kroniaDietSuccessToastAt = now;
    showToast('Dieta gerada e salva.', 'success', 3200);
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (_) {}
  return normalizedPlan;
}

function createAnotherDiet() {
  closeAllDietGenerationLayers();
  resetDietGenerationDraftState();
  return openOfficialDietEntry({ source: 'create_another_diet', forceNew: true });
}

window.closeAllDietGenerationLayers = closeAllDietGenerationLayers;
window.finishDietGenerationSuccess = finishDietGenerationSuccess;
window.createAnotherDiet = createAnotherDiet;

function getDefaultNutritionMemory() {
  return {
    personalization_score: 0,
    confidence_level: 'baixo',
    missing_fields: [],
    plan_status: 'provisório',
    preferred_meal_count: null,
    preferred_diet_style: null,
    has_food_scale: null,
    budget_level: null,
    workout_time: null,
    hunger_period: null,
    disliked_foods: [],
    liked_foods: [],
    avoided_foods: [],
    skipped_meals_count: 0,
    swapped_foods_count: 0,
    hunger_reports_count: 0,
    adherence_days: 0,
    frequent_swaps: [],
    frequent_rejections: [],
    current_template_id: null,
    previous_template_ids: [],
    reason_selected: null,
    updated_at: null
  };
}

function normalizeNutritionMemoryArray(value) {
  if (Array.isArray(value)) return value.map(String).map(function(item) { return item.trim(); }).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,;\n]+/).map(function(item) { return item.trim(); }).filter(Boolean);
  return [];
}

function normalizeNutritionMemory(memory) {
  var next = Object.assign(getDefaultNutritionMemory(), memory && typeof memory === 'object' ? memory : {});
  ['missing_fields', 'disliked_foods', 'liked_foods', 'avoided_foods', 'frequent_swaps', 'frequent_rejections', 'previous_template_ids'].forEach(function(key) {
    next[key] = normalizeNutritionMemoryArray(next[key]);
  });
  ['skipped_meals_count', 'swapped_foods_count', 'hunger_reports_count', 'adherence_days'].forEach(function(key) {
    next[key] = Math.max(0, asKroniaNumber(next[key], 0));
  });
  next.personalization_score = Math.max(0, Math.min(100, asKroniaNumber(next.personalization_score, 0)));
  next.confidence_level = next.personalization_score >= 70 ? 'alto' : (next.personalization_score >= 40 ? 'médio' : 'baixo');
  next.plan_status = next.personalization_score >= 70 ? 'personalizado' : 'provisório';
  return next;
}

function readNutritionMemory() {
  return normalizeNutritionMemory(safeJSON(KRONIA_NUTRITION_MEMORY_KEY, {}));
}

function saveNutritionMemory(memory) {
  var next = normalizeNutritionMemory(Object.assign({}, memory || {}, { updated_at: (memory && memory.updated_at) || new Date().toISOString() }));
  try { localStorage.setItem(KRONIA_NUTRITION_MEMORY_KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}

function updateNutritionMemory(patch) {
  return saveNutritionMemory(Object.assign({}, readNutritionMemory(), patch || {}));
}

function resetNutritionMemory() {
  try { localStorage.removeItem(KRONIA_NUTRITION_MEMORY_KEY); } catch (_) {}
  return normalizeNutritionMemory({});
}

function calculateNutritionPersonalizationScore(profile, memory) {
  var p = profile || {};
  var m = normalizeNutritionMemory(memory);
  var score = 0;
  var missing = [];
  if (asKroniaNumber(p.peso, 0) > 0 && asKroniaNumber(p.altura, 0) > 0 && asKroniaNumber(p.idade, 0) > 0 && p.sexo && p.objetivo) score += 30; else missing.push('dados_basicos');
  if (asKroniaNumber(m.preferred_meal_count || p.refeicoesPorDia, 0) > 0) score += 10; else missing.push('refeicoes_por_dia');
  if (m.preferred_diet_style || normalizeNutritionMemoryArray(m.liked_foods).length || normalizeNutritionMemoryArray(p.preferencias_alimentares).length) score += 10; else missing.push('preferencias_alimentares');
  if (normalizeNutritionMemoryArray(m.disliked_foods).length || normalizeNutritionMemoryArray(m.avoided_foods).length || normalizeNutritionMemoryArray(p.restricoes).length) score += 10; else missing.push('rejeicoes');
  if (p.condicoes_clinicas || p.restricoes) score += 10; else missing.push('restricoes_patologias');
  if (m.workout_time) score += 10; else missing.push('horario_treino');
  if (m.preferred_diet_style) score += 10; else missing.push('estilo_dieta');
  if (m.adherence_days || m.skipped_meals_count || m.swapped_foods_count || m.hunger_reports_count) score += 10; else missing.push('feedback_recente');
  return { score: score, confidence_level: score >= 70 ? 'alto' : (score >= 40 ? 'médio' : 'baixo'), missing_fields: missing, plan_status: score >= 70 ? 'personalizado' : 'provisório' };
}

function normalizeKroniaObjective(value) {
  var raw = normalizeDietFoodText(value || '');
  if (/emagrec|perda|secar|defin/.test(raw)) return 'emagrecimento';
  if (/hipertrof|ganho|massa|forca/.test(raw)) return 'hipertrofia';
  if (/performance|desempenho|atleta/.test(raw)) return 'performance';
  if (/recomp/.test(raw)) return 'recomposicao';
  return 'manutencao';
}

function getObjectiveLabel(value) {
  var key = normalizeKroniaObjective(value);
  return {
    emagrecimento: 'Emagrecimento',
    hipertrofia: 'Hipertrofia',
    manutencao: 'Manutenção',
    performance: 'Performance',
    recomposicao: 'Recomposição corporal'
  }[key] || 'Manutenção';
}

function readLocalUserAnamnesis() {
  var cfg = safeJSON('kronia_config', {});
  var flow = {};
  try { flow = getNutritionFlowState() || {}; } catch (_) {}
  var stored = safeJSON(KRONIA_USER_ANAMNESIS_KEY, {});
  var snapshot = window._dietaSupabaseSnapshot || {};
  var profile = snapshot.profile || {};
  var body = snapshot.bodyMetrics || {};
  var lab = snapshot.latestLabReport || null;
  var nome = stored.nome || profile.full_name || cfg.nome || localStorage.getItem('kronia_nome') || '';
  return {
    nome: nome,
    idade: stored.idade || cfg.idade || flow.idade || (profile.birth_date ? parseDietAgeFromBirthDate(profile.birth_date) : ''),
    sexo: stored.sexo || flow.sexo || profile.sex || 'masculino',
    peso: stored.peso || body.weight_kg || profile.current_weight_kg || cfg.peso || flow.peso || '',
    altura: stored.altura || profile.height_cm || cfg.altura || flow.altura || '',
    objetivo: normalizeKroniaObjective(stored.objetivo || profile.objective || flow.objetivo || cfg.objetivo || 'manutencao'),
    nivel_atividade: stored.nivel_atividade || profile.activity_level || flow.nivelAtividade || 'levemente ativo',
    rotina: stored.rotina || flow.aderencia && flow.aderencia.praticidade || '',
    preferencias_alimentares: stored.preferencias_alimentares || profile.liked_foods || flow.preferencias || '',
    restricoes: stored.restricoes || [].concat(profile.allergies || [], profile.intolerances || [], flow.restricoes || []).filter(Boolean),
    condicoes_clinicas: stored.condicoes_clinicas || profile.clinical_notes || flow.patologia || '',
    medicamentos: stored.medicamentos || flow.medicamentos || '',
    sono: stored.sono || cfg.sono || flow.sono || '',
    estresse: stored.estresse || flow.estresse || '',
    latestLabReport: lab
  };
}

function persistUserAnamnesis(patch) {
  var current = readLocalUserAnamnesis();
  var next = Object.assign({}, current, patch || {});
  next.objetivo = normalizeKroniaObjective(next.objetivo);
  try { localStorage.setItem(KRONIA_USER_ANAMNESIS_KEY, JSON.stringify(next)); } catch (_) {}
  var cfg = Object.assign({}, safeJSON('kronia_config', {}), {
    nome: next.nome || '',
    peso: next.peso || '',
    altura: next.altura || '',
    idade: next.idade || '',
    sono: next.sono || '',
    objetivo: next.objetivo
  });
  try { localStorage.setItem('kronia_config', JSON.stringify(cfg)); } catch (_) {}
  return next;
}

async function saveUserAnamnesisToSupabase(anamnesis) {
  try {
    if (!_sb || !_sb.auth) return false;
    var sessionResp = await _sb.auth.getSession();
    var userId = sessionResp && sessionResp.data && sessionResp.data.session && sessionResp.data.session.user && sessionResp.data.session.user.id;
    if (!userId) return false;
    var payload = {
      objective: anamnesis.objetivo,
      current_weight_kg: anamnesis.peso ? Number(anamnesis.peso) : null,
      height_cm: anamnesis.altura ? Number(anamnesis.altura) : null,
      activity_level: anamnesis.nivel_atividade || null,
      clinical_notes: Array.isArray(anamnesis.condicoes_clinicas) ? anamnesis.condicoes_clinicas.join(', ') : (anamnesis.condicoes_clinicas || null)
    };
    if (anamnesis.nome) payload.full_name = anamnesis.nome;
    var resp = await _sb.from('profiles').update(payload).eq('id', userId);
    return !resp.error;
  } catch (_) {
    return false;
  }
}

function analyzeUserContext() {
  var anamnesis = readLocalUserAnamnesis();
  var training = {};
  try { training = readDietMasterTrainingSnapshot() || {}; } catch (_) {}
  var source = window._dietaSupabaseSnapshot && window._dietaSupabaseSnapshot.profile ? 'supabase' : 'localStorage';
  return {
    profile: {
      nome: anamnesis.nome,
      idade: anamnesis.idade,
      sexo: anamnesis.sexo,
      peso: anamnesis.peso,
      altura: anamnesis.altura,
      objetivo: anamnesis.objetivo,
      nivel_atividade: anamnesis.nivel_atividade
    },
    goals: { objective: anamnesis.objetivo, label: getObjectiveLabel(anamnesis.objetivo) },
    trainingContext: training,
    nutritionContext: {
      preferencias_alimentares: anamnesis.preferencias_alimentares,
      restricoes: anamnesis.restricoes,
      activeDiet: window._kroniaDietPlan || readLocalActiveDietPlan() || null
    },
    clinicalContext: {
      condicoes_clinicas: anamnesis.condicoes_clinicas,
      medicamentos: anamnesis.medicamentos,
      latestLabReport: anamnesis.latestLabReport || null
    },
    behaviorContext: {
      rotina: anamnesis.rotina,
      sono: anamnesis.sono,
      estresse: anamnesis.estresse
    },
    source: source
  };
}

function selectDietTemplateForContext(context) {
  var objective = normalizeKroniaObjective(context && context.goals && context.goals.objective);
  var memory = readNutritionMemory();
  var templates = Array.isArray(window.KRONIA_DIET_TEMPLATES) ? window.KRONIA_DIET_TEMPLATES : [];
  var ranked = templates.map(function(t) {
    var id = String(t && t.id || '');
    var score = normalizeKroniaObjective(t && t.objetivo) === objective ? 30 : 0;
    var style = normalizeDietFoodText(memory.preferred_diet_style);
    var workout = normalizeDietFoodText(memory.workout_time);
    var hunger = normalizeDietFoodText(memory.hunger_period);
    if (style === 'economica' && id.indexOf('economica_brasileira') !== -1) score += 55;
    if (style === 'marmita' && id.indexOf('marmita') !== -1) score += 55;
    if (style === 'flexivel' && id.indexOf('flexivel') !== -1) score += 55;
    if (/corrid|plantao/.test(normalizeDietFoodText(context && context.userContext && context.userContext.behaviorContext && context.userContext.behaviorContext.rotina)) && (id.indexOf('rotina_corrida') !== -1 || id.indexOf('baixa_adesao') !== -1)) score += 35;
    if (workout.indexOf('manha') !== -1 && id.indexOf('treino_matinal') !== -1) score += 45;
    if (workout.indexOf('noite') !== -1 && id.indexOf('treino_noturno') !== -1) score += 45;
    if (hunger.indexOf('noite') !== -1 && objective === 'emagrecimento' && id.indexOf('alta_saciedade') !== -1) score += 50;
    if (memory.has_food_scale === false && (id.indexOf('reeducacao_alimentar') !== -1 || id.indexOf('baixa_adesao') !== -1 || id.indexOf('economica_brasileira') !== -1)) score += 25;
    if (memory.swapped_foods_count >= 2 && id.indexOf('flexivel') !== -1) score += 50;
    if (memory.skipped_meals_count >= 2 && id.indexOf('baixa_adesao') !== -1) score += 50;
    return { template: t, score: score };
  }).sort(function(a, b) { return b.score - a.score; });
  var match = ranked.length && ranked[0].score > 0 ? ranked[0].template : templates.find(function(t) { return normalizeKroniaObjective(t && t.objetivo) === objective; });
  if (match && match.id) {
    var previous = memory.current_template_id && memory.current_template_id !== match.id
      ? [memory.current_template_id].concat(memory.previous_template_ids || []).filter(function(id, index, all) { return id && all.indexOf(id) === index; }).slice(0, 8)
      : memory.previous_template_ids;
    saveNutritionMemory(Object.assign({}, memory, {
      current_template_id: match.id,
      previous_template_ids: previous,
      reason_selected: buildNutritionTemplateReason(match, memory)
    }));
  }
  if (match) return match;
  if (objective === 'emagrecimento') return { id: 'deficit_saciedade', nome: 'Déficit com saciedade', objetivo: objective };
  if (objective === 'hipertrofia') return { id: 'high_carb', nome: 'High carb performance', objetivo: objective };
  if (objective === 'performance') return { id: 'performance_training_day', nome: 'Performance treino', objetivo: objective };
  if (objective === 'recomposicao') return { id: 'recomp_alta_proteina', nome: 'Recomposição alta proteína', objetivo: objective };
  return { id: 'maintenance_balanced', nome: 'Manutenção equilibrada', objetivo: objective };
}

function buildNutritionTemplateReason(template, memory) {
  var id = String(template && template.id || '');
  var reasons = [];
  if (memory.preferred_diet_style) reasons.push('estilo ' + memory.preferred_diet_style);
  if (memory.workout_time && (/treino/.test(id) || id.indexOf('treino_') !== -1)) reasons.push('horário de treino');
  if (memory.hunger_period && id.indexOf('alta_saciedade') !== -1) reasons.push('fome recorrente');
  if (memory.swapped_foods_count >= 2 && id.indexOf('flexivel') !== -1) reasons.push('muitas trocas');
  if (memory.skipped_meals_count >= 2 && id.indexOf('baixa_adesao') !== -1) reasons.push('refeições puladas');
  return reasons.length ? reasons.join(', ') : 'perfil atual e meta calórica';
}

function suggestDietAdaptations(plan, memory, profile) {
  var m = normalizeNutritionMemory(memory);
  var objective = normalizeKroniaObjective(profile && profile.objetivo);
  var out = [];
  if ((m.hunger_reports_count >= 2 || normalizeDietFoodText(m.hunger_period).indexOf('noite') !== -1) && objective === 'emagrecimento') out.push({ type: 'night_satiety', message: 'Reforçar jantar com proteína e fibra sem aumentar calorias totais.' });
  if (m.skipped_meals_count >= 2) out.push({ type: 'low_adherence', message: 'Reduzir número de refeições ou usar template baixa adesão.' });
  if (m.swapped_foods_count >= 2) out.push({ type: 'flexible', message: 'Usar template flexível com trocas equivalentes.' });
  if (m.frequent_rejections.length >= 2) out.push({ type: 'avoid_rejections', message: 'Evitar alimentos rejeitados nas próximas dietas.' });
  if (m.adherence_days < 2 && (m.skipped_meals_count + m.swapped_foods_count + m.hunger_reports_count) >= 3) out.push({ type: 'simplify', message: 'Simplificar para dieta simples, econômica ou marmita.' });
  return out;
}

function registerDailyNutritionFeedback(type) {
  var m = readNutritionMemory();
  var patch = {};
  if (type === 'adherent') patch.adherence_days = m.adherence_days + 1;
  if (type === 'swapped') patch.swapped_foods_count = m.swapped_foods_count + 1;
  if (type === 'skipped') patch.skipped_meals_count = m.skipped_meals_count + 1;
  if (type === 'hungry') patch.hunger_reports_count = m.hunger_reports_count + 1;
  if (type === 'difficult') patch.frequent_rejections = m.frequent_rejections.concat(['dieta dificil']).slice(-10);
  var next = updateNutritionMemory(patch);
  var score = calculateNutritionPersonalizationScore(readLocalUserAnamnesis(), next);
  saveNutritionMemory(Object.assign({}, next, { personalization_score: score.score, confidence_level: score.confidence_level, missing_fields: score.missing_fields, plan_status: score.plan_status }));
  renderActiveDietPlan();
  showToast('Feedback registrado na memória nutricional.', 'success', 2200);
}

function saveNutritionProgressiveAnswer(field, value) {
  var patch = {};
  patch[field] = value;
  if (field === 'disliked_foods') patch[field] = normalizeNutritionMemoryArray(value);
  var next = updateNutritionMemory(patch);
  var score = calculateNutritionPersonalizationScore(readLocalUserAnamnesis(), next);
  saveNutritionMemory(Object.assign({}, next, { personalization_score: score.score, confidence_level: score.confidence_level, missing_fields: score.missing_fields, plan_status: score.plan_status }));
  renderActiveDietPlan();
}

function toggleDietChip(field, rawValue) {
  var memory = readNutritionMemory();
  var current = memory[field];
  var value = rawValue;
  if (rawValue === 'true') value = true;
  else if (rawValue === 'false') value = false;
  else if (!isNaN(rawValue) && rawValue !== '') value = Number(rawValue);
  var isSelected = current === value || String(current) === String(value);
  saveNutritionProgressiveAnswer(field, isSelected ? null : value);
}

function openNutritionProgressiveAnamnesis() {
  return openOfficialDietEntry({ source: "progressive_nutrition_upgrade", forceNew: true });
}

function skipNutritionAnamnesisAndGenerate() {
  var score = calculateNutritionPersonalizationScore(readLocalUserAnamnesis(), readNutritionMemory());
  saveNutritionMemory(Object.assign({}, readNutritionMemory(), { personalization_score: score.score, confidence_level: score.confidence_level, missing_fields: score.missing_fields, plan_status: 'provisório' }));
  gerarDieta();
}

function applyDietAdaptiveSuggestion() {
  var memory = readNutritionMemory();
  if (memory.skipped_meals_count >= 2) memory.preferred_meal_count = Math.max(3, asKroniaNumber(memory.preferred_meal_count, 4) - 1);
  if (memory.swapped_foods_count >= 2) memory.preferred_diet_style = 'flexível';
  if (memory.hunger_reports_count >= 2) memory.hunger_period = memory.hunger_period || 'noite';
  saveNutritionMemory(memory);
  showToast('Ajuste aplicado à próxima geração da dieta.', 'success', 2600);
  renderActiveDietPlan();
}

function dismissDietAdaptiveSuggestion() {
  showToast('Ajuste mantido para análise futura.', 'info', 2200);
}

function runWeeklyNutritionCheckin(checkin, plan, profile, memory) {
  var c = checkin || {};
  var objective = normalizeKroniaObjective(profile && profile.objetivo);
  var adherence = asKroniaNumber(c.adherence_days || c.seguiu_dias, 0);
  var hunger = asKroniaNumber(c.hunger_avg || c.fome_media, 0);
  var energy = asKroniaNumber(c.training_energy || c.energia_treino, 0);
  var weightDelta = asKroniaNumber(c.weight_delta_kg != null ? c.weight_delta_kg : c.delta_peso_kg, 0);
  var targetCalories = asKroniaNumber(plan && plan.targets && plan.targets.kcal || plan && plan.caloriasMeta, 0);
  var result = { calorie_multiplier: 1, targetCalories: targetCalories || null, carb_timing: null, simplify: false, reason: 'Check-in estável: manter plano atual e observar nova semana.' };
  if (objective === 'emagrecimento' && adherence >= 5 && Math.abs(weightDelta) < 0.2 && hunger < 7) {
    result.calorie_multiplier = 0.95;
    result.targetCalories = targetCalories ? Math.round(targetCalories * 0.95) : null;
    result.reason = 'Adesão boa e peso estável em emagrecimento: reduzir 5% das calorias.';
  } else if (hunger >= 7) {
    result.reason = 'Fome alta: manter calorias, aumentar volume/fibra e redistribuir refeições.';
  } else if (energy > 0 && energy <= 4) {
    result.carb_timing = 'pre_pos_treino';
    result.reason = 'Energia baixa no treino: mover carboidratos para pré/pós-treino.';
  } else if (adherence < 4) {
    result.simplify = true;
    result.reason = 'Adesão baixa: simplificar dieta sem apertar calorias.';
  } else if (objective === 'hipertrofia' && weightDelta <= 0.1) {
    result.calorie_multiplier = 1.05;
    result.targetCalories = targetCalories ? Math.round(targetCalories * 1.05) : null;
    result.reason = 'Hipertrofia sem subida de peso: aumentar 5% das calorias.';
  }
  return result;
}

function openWeeklyNutritionCheckin() {
  return openOfficialDietEntry({ source: "weekly_checkin_upgrade", forceNew: true });
}

function analyzeDietContext() {
  var user = analyzeUserContext();
  var profile = user.profile || {};
  var plan = user.nutritionContext && user.nutritionContext.activeDiet || readLocalActiveDietPlan();
  var baseline = computeDietGenerationBaseline({
    peso: Number(profile.peso || 75),
    altura: Number(profile.altura || 175),
    idade: Number(profile.idade || 30),
    sexo: profile.sexo || 'masculino',
    nivelAtividade: profile.nivel_atividade || 'levemente ativo',
    objetivo: normalizeKroniaObjective(profile.objetivo)
  });
  var training = user.trainingContext || {};
  var fatigue = Number(training.fadiga || training.fatigue || 0);
  var heavyTraining = Number(training.volume7d || 0) >= 8000 || Number(training.sessions7d || 0) >= 4;
  var objective = normalizeKroniaObjective(profile.objetivo);
  var calorieTarget = baseline.metaCalorias;
  if (heavyTraining && (objective === 'performance' || objective === 'hipertrofia')) calorieTarget += 120;
  if (!Number(training.sessions7d || 0) && objective === 'emagrecimento') calorieTarget -= 80;
  var clinicalAlerts = [];
  var lab = user.clinicalContext && user.clinicalContext.latestLabReport;
  if (lab && Array.isArray(lab.clinicalFlags)) clinicalAlerts = clinicalAlerts.concat(lab.clinicalFlags);
  if (fatigue >= 8) clinicalAlerts.push('Fadiga alta: priorizar recuperação, sono e proteína.');
  if (objective === 'emagrecimento') clinicalAlerts.push('Déficit calórico com foco em saciedade.');
  if (objective === 'hipertrofia') clinicalAlerts.push('Superávit controlado com proteína distribuída.');
  return {
    hasSavedDiet: Boolean(plan && Array.isArray(plan.meals) && plan.meals.length),
    source: plan && plan.source || user.source,
    userProfile: profile,
    trainingContext: Object.assign({}, training, {
      heavyTraining: heavyTraining,
      restDay: !Number(training.sessions7d || 0),
      fatigue: fatigue
    }),
    calorieTarget: calorieTarget,
    macroTargets: {
      kcal: calorieTarget,
      protein: baseline.proteinaMeta,
      carbs: Math.max(70, Math.round((calorieTarget - baseline.proteinaMeta * 4 - baseline.gorduraMeta * 9) / 4)),
      fat: baseline.gorduraMeta
    },
    selectedTemplate: selectDietTemplateForContext(user),
    clinicalAlerts: clinicalAlerts.filter(Boolean).slice(0, 5),
    shouldUseMock: !(plan && plan.source === 'supabase_meal_plans'),
    userContext: user,
    activeDiet: plan || buildFallbackActiveDietPlan()
  };
}

function buildMealSummary(meal) {
  var items = Array.isArray(meal && meal.items) ? meal.items : [];
  var subtotal = meal && meal.subtotal || {};
  return {
    id: meal && meal.id,
    name: meal && meal.name || 'Refeição',
    time: meal && meal.time || '',
    foods: items.map(function(item) {
      return {
        name: item.name || getDietItemName(item),
        quantity: item.quantity || (getDietDisplayGrams(item) + ' g'),
        kcal: asKroniaNumber(item.kcal, 0),
        protein: asKroniaNumber(item.protein, 0),
        carbs: asKroniaNumber(item.carbs, 0),
        fat: asKroniaNumber(item.fat, 0)
      };
    }),
    subtotal: {
      kcal: asKroniaNumber(subtotal.kcal, 0),
      protein: asKroniaNumber(subtotal.protein, 0),
      carbs: asKroniaNumber(subtotal.carbs, 0),
      fat: asKroniaNumber(subtotal.fat, 0)
    }
  };
}

function generateDietViewModel(context) {
  var ctx = context || analyzeDietContext();
  var plan = recalculateDietPlan(ctx.activeDiet || buildFallbackActiveDietPlan());
  var meals = getDietRenderableMeals(plan).map(buildMealSummary);
  var currentMeal = getNextDietMeal(getDietRenderableMeals(plan));
  var targets = ctx.macroTargets || plan.targets || {};
  var totals = plan.totals || {};
  var memory = readNutritionMemory();
  var personalization = calculateNutritionPersonalizationScore(ctx.userProfile || {}, memory);
  memory = saveNutritionMemory(Object.assign({}, memory, {
    personalization_score: personalization.score,
    confidence_level: personalization.confidence_level,
    missing_fields: personalization.missing_fields,
    plan_status: personalization.plan_status
  }));
  return {
    header: {
      title: 'Dieta',
      greeting: getDietGreeting(ctx.userProfile && ctx.userProfile.nome),
      subtitle: personalization.plan_status === 'personalizado'
        ? 'Plano personalizado com base no seu perfil e comportamento recente.'
        : 'Plano inicial gerado com dados limitados.',
      source: ctx.source
    },
    currentMeal: buildMealSummary(currentMeal || meals[0] || {}),
    dailyProgress: {
      calories: { current: getDietDisplayKcalTotal(plan, getDietRenderableMeals(plan)), target: targets.kcal || plan.targets && plan.targets.kcal || 2100 },
      protein: { current: totals.protein || 0, target: targets.protein || 160 },
      carbs: { current: totals.carbs || 0, target: targets.carbs || 230 },
      fat: { current: totals.fat || 0, target: targets.fat || 75 }
    },
    actionCards: [
      { key: 'minha-dieta', icon: 'utensils', title: 'Minha Dieta', description: 'Veja todas as refeições do dia.' },
      { key: 'check-in-semanal', icon: 'calendar-check', title: 'Check-in semanal', description: 'Ajuste calorias e aderência da semana.' },
      { key: 'progresso', icon: 'trending-up', title: 'Progresso nutricional', description: 'Acompanhe adesão, peso e metas.' },
      { key: 'exames', icon: 'flask-conical', title: 'Exames', description: 'Use exames para orientar ajustes alimentares.' }
    ],
    meals: meals,
    substitutions: normalizeDietVisualSubstitutions(plan.visualPrescription && plan.visualPrescription.substitutions),
    progress: { adherence: 87, streak: 5, insight: buildDietContextInsight(ctx) },
    memory: memory,
    personalization: personalization,
    adaptations: suggestDietAdaptations(plan, memory, ctx.userProfile || {}),
    labs: { alerts: ctx.clinicalAlerts || [], latest: ctx.userContext && ctx.userContext.clinicalContext && ctx.userContext.clinicalContext.latestLabReport || null },
    profile: ctx.userProfile,
    context: ctx,
    plan: plan
  };
}

function getDietGreeting(nome) {
  var first = String(nome || localStorage.getItem('kronia_nome') || 'Kleber').trim().split(' ')[0] || 'Kleber';
  var hour = new Date().getHours();
  var period = hour < 12 ? 'Bom dia' : (hour < 18 ? 'Boa tarde' : 'Boa noite');
  return period + ', ' + first + ' 👋';
}

function buildDietContextInsight(ctx) {
  var objective = normalizeKroniaObjective(ctx && ctx.userProfile && ctx.userProfile.objetivo);
  var training = ctx && ctx.trainingContext || {};
  if (Number(training.fatigue || 0) >= 8) return 'Fadiga alta hoje: priorize recuperação e proteína em todas as refeições.';
  if (training.heavyTraining) return 'Treino pesado recente: carboidratos ficam mais estratégicos para performance.';
  if (objective === 'emagrecimento') return 'Plano orientado para saciedade, proteína alta e déficit sustentável.';
  if (objective === 'hipertrofia') return 'Plano orientado para superávit controlado e recuperação muscular.';
  return 'Plano equilibrado para consistência diária e aderência.';
}

function dietRound(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 1;
  var factor = Math.pow(10, d);
  return Math.round(asKroniaNumber(value, 0) * factor) / factor;
}

function buildDefaultDietVisualPrescription() {
  return {
    version: 'v1',
    dashboard: {
      title: 'Plano alimentar KRONIA',
      subtitle: 'Prescrição base pronta para execução, com medidas práticas e refeições brasileiras.'
    },
    summary: {
      kcal_total: 2100,
      proteina: 160,
      carbo: 230,
      gordura: 75
    },
    meals: [
      {
        id: 'fallback_breakfast',
        slot: 'cafe_da_manha',
        name: 'Café da manhã',
        time: '07:00',
        kcal_estimada: 340,
        items: [
          'Ovos mexidos - 2 unidades',
          'Pão integral - 1 fatia',
          'Café sem açúcar - 1 xícara'
        ]
      },
      {
        id: 'fallback_lunch',
        slot: 'almoco',
        name: 'Almoço',
        time: '12:30',
        kcal_estimada: 470,
        items: [
          'Frango grelhado - 150 g',
          'Arroz cozido - 120 g',
          'Feijão - 1 concha pequena',
          'Salada verde - 1 prato'
        ]
      },
      {
        id: 'fallback_snack',
        slot: 'lanche_tarde',
        name: 'Lanche',
        time: '16:30',
        kcal_estimada: 230,
        items: [
          'Iogurte natural - 1 pote',
          'Banana - 1 unidade'
        ]
      },
      {
        id: 'fallback_dinner',
        slot: 'jantar',
        name: 'Jantar',
        time: '19:30',
        kcal_estimada: 300,
        items: [
          'Tilápia grelhada - 140 g',
          'Batata-doce cozida - 100 g',
          'Legumes cozidos - 1 prato'
        ]
      },
      {
        id: 'fallback_supper',
        slot: 'ceia',
        name: 'Ceia',
        time: '22:00',
        kcal_estimada: 80,
        items: [
          'Frutas vermelhas - 140 g'
        ]
      }
    ],
    substitutions: {
      proteinas: ['Frango grelhado - 180 g', 'Tilápia - 200 g', 'Tofu firme - 220 g'],
      carboidratos: ['Arroz - 4 colheres de sopa', 'Batata-doce - 1 unidade média', 'Macarrão - 1 prato raso'],
      leguminosas: ['Feijão - 1 concha média', 'Lentilha - 1 concha média'],
      legumes: ['Brócolis cozido - 1 prato de sobremesa', 'Abobrinha refogada - 1 prato de sobremesa']
    },
    sequence: {
      emagrecimento: 'Proteína -> legumes -> salada -> arroz e feijão',
      manutencao: 'Proteína -> arroz e feijão -> legumes -> salada',
      ganho_massa: 'Arroz e feijão -> proteína -> legumes -> salada'
    },
    guidance: [
      'Distribua a água entre manhã, treino e noite para bater pelo menos 2,5 L.',
      'Se treinar cedo, mantenha o café da manhã completo e concentre a fruta perto do treino.',
      'Use medidas domésticas simples para manter aderência mesmo fora de casa.'
    ],
    reasons: [
      'Proteínas foram distribuídas nas principais refeições para preservar recuperação e saciedade.',
      'Carboidratos aparecem em blocos práticos para sustentar energia sem depender de alimentos ultraprocessados.',
      'A prescrição usa combinações comuns no Brasil para reduzir atrito na execução.'
    ],
    observation: 'Fallback profissional ativo: revise os dados com o KRONOS para personalizar este plano base.'
  };
}

function cloneDietVisualPrescription(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return buildDefaultDietVisualPrescription(); }
}

function parseDietVisualItem(rawItem) {
  var text = String(rawItem || '').trim();
  if (!text) return null;
  var parts = text.split(/\s+-\s+/);
  var name = parts.shift() || 'Alimento';
  var quantity = parts.join(' - ');
  return {
    nome: name,
    porcao: quantity || 'porção sugerida',
    calorias: 0,
    proteinas: 0,
    carboidratos: 0,
    gorduras: 0
  };
}

function extractDietVisualPrescription(plan) {
  var safePlan = plan && typeof plan === 'object' ? plan : {};
  var direct = safePlan.visualPrescription && typeof safePlan.visualPrescription === 'object' ? safePlan.visualPrescription : null;
  if (direct && Array.isArray(direct.meals) && direct.meals.length) return cloneDietVisualPrescription(direct);
  var raw = safePlan.rawGeneratedPlan && typeof safePlan.rawGeneratedPlan === 'object' ? safePlan.rawGeneratedPlan : {};
  if (raw.visualPrescription && Array.isArray(raw.visualPrescription.meals) && raw.visualPrescription.meals.length) {
    return cloneDietVisualPrescription(raw.visualPrescription);
  }
  if (safePlan.planoEstruturado && safePlan.planoEstruturado.visualPrescription && Array.isArray(safePlan.planoEstruturado.visualPrescription.meals)) {
    return cloneDietVisualPrescription(safePlan.planoEstruturado.visualPrescription);
  }
  return null;
}

function buildDietVisualPrescriptionFromLegacyPlan(plan) {
  var safePlan = plan && typeof plan === 'object' ? plan : {};
  var meals = Array.isArray(safePlan.refeicoes) ? safePlan.refeicoes : [];
  if (!meals.length) return cloneDietVisualPrescription(buildDefaultDietVisualPrescription());
  return {
    version: 'v1',
    dashboard: {
      title: 'Plano alimentar KRONIA',
      subtitle: 'Prescrição convertida automaticamente para o painel visual da dieta.'
    },
    summary: {
      kcal_total: asKroniaNumber(safePlan.meta && safePlan.meta.calorias, 0),
      proteina: asKroniaNumber(safePlan.meta && safePlan.meta.proteina, 0),
      carbo: asKroniaNumber(safePlan.meta && safePlan.meta.carbo, 0),
      gordura: asKroniaNumber(safePlan.meta && safePlan.meta.gordura, 0)
    },
    meals: meals.map(function(meal, mealIndex) {
      var foods = Array.isArray(meal && meal.alimentos) ? meal.alimentos : [];
      var subtotal = meal && meal.subtotal && typeof meal.subtotal === 'object' ? meal.subtotal : {};
      return {
        id: meal && meal.id || ('legacy_visual_' + (mealIndex + 1)),
        slot: meal && meal.tipo || normalizeDietFoodText(meal && meal.nome || 'refeicao'),
        name: meal && meal.nome || ('Refeição ' + (mealIndex + 1)),
        time: meal && meal.horario || '',
        kcal_estimada: asKroniaNumber(subtotal.kcal || subtotal.calorias, 0),
        items: foods.map(function(item) {
          var nome = String(item && item.nome || 'Alimento').trim();
          var porcao = String(item && (item.qtde || item.porcao || item.quantity) || '').trim();
          return porcao ? (nome + ' - ' + porcao) : nome;
        }).filter(Boolean)
      };
    }),
    substitutions: cloneDietVisualPrescription(buildDefaultDietVisualPrescription()).substitutions,
    sequence: cloneDietVisualPrescription(buildDefaultDietVisualPrescription()).sequence,
    guidance: cloneDietVisualPrescription(buildDefaultDietVisualPrescription()).guidance,
    reasons: [
      'Prescrição visual convertida automaticamente a partir do plano local salvo.',
      'As refeições mantêm quantidades e medidas práticas para execução imediata.',
      'Recalcule com o KRONOS para trocar a base local por uma prescrição totalmente personalizada.'
    ],
    observation: 'Plano local sincronizado no painel visual.'
  };
}

var _dietCatalogIndexCache = null;
var _dietPlanPersistTimer = null;
var _dietTacoCatalogPromise = null;
var TACO_FOOD_UX_OVERRIDES = {
  TACO_0053: {
    display_name: 'Pão francês',
    default_portion_g: 50,
    default_unit: '1 unidade média (50 g)',
    medida_caseira: '1 unidade média (50 g)',
    aliases: ['pao frances', 'pão francês', 'paes franceses', 'pães franceses', 'francesinho']
  },
  TACO_0488: {
    display_name: 'Ovo de galinha',
    default_portion_g: 50,
    default_unit: '1 unidade média (50 g)',
    medida_caseira: '1 unidade média (50 g)',
    aliases: ['ovo', 'ovos', 'ovo cozido', 'ovos cozidos', 'ovo de galinha']
  },
  TACO_0182: {
    display_name: 'Banana',
    default_portion_g: 86,
    default_unit: '1 unidade média (86 g)',
    medida_caseira: '1 unidade média (86 g)',
    aliases: ['banana', 'bananas', 'banana prata']
  },
  TACO_0221: {
    display_name: 'Maçã',
    default_portion_g: 130,
    default_unit: '1 unidade média (130 g)',
    medida_caseira: '1 unidade média (130 g)',
    aliases: ['maca', 'maçã']
  },
  TACO_0003: {
    display_name: 'Arroz branco cozido',
    default_portion_g: 120,
    default_unit: '4 colheres de sopa cheias (120 g)',
    medida_caseira: '4 colheres de sopa cheias (120 g)',
    aliases: ['arroz', 'arroz branco', 'arroz cozido']
  },
  TACO_0001: {
    display_name: 'Arroz integral cozido',
    default_portion_g: 120,
    default_unit: '4 colheres de sopa cheias (120 g)',
    medida_caseira: '4 colheres de sopa cheias (120 g)',
    aliases: ['arroz integral', 'arroz integral cozido']
  },
  TACO_0561: {
    display_name: 'Feijão carioca cozido',
    default_portion_g: 100,
    default_unit: '1 concha média (100 g)',
    medida_caseira: '1 concha média (100 g)',
    aliases: ['feijao', 'feijão', 'feijoes', 'feijões', 'feijao carioca', 'feijão carioca', 'feijoes cariocas', 'feijões cariocas']
  },
  TACO_0567: {
    display_name: 'Feijão preto cozido',
    default_portion_g: 100,
    default_unit: '1 concha média (100 g)',
    medida_caseira: '1 concha média (100 g)',
    aliases: ['feijao preto', 'feijão preto']
  },
  TACO_0088: {
    display_name: 'Batata-doce cozida',
    default_portion_g: 130,
    default_unit: '1 unidade média (130 g)',
    medida_caseira: '1 unidade média (130 g)',
    aliases: ['batata doce', 'batata-doce', 'batatas doces', 'batatas-doces', 'batata doce cozida']
  },
  TACO_0091: {
    display_name: 'Batata inglesa cozida',
    default_portion_g: 150,
    default_unit: '1 unidade média (150 g)',
    medida_caseira: '1 unidade média (150 g)',
    aliases: ['batata inglesa', 'batata cozida']
  },
  TACO_0551: {
    display_name: 'Tapioca',
    default_portion_g: 70,
    default_unit: '1 unidade média (70 g)',
    medida_caseira: '1 unidade média (70 g)',
    aliases: ['tapioca']
  },
  TACO_0040: {
    display_name: 'Macarrão cozido',
    default_portion_g: 120,
    default_unit: '1 prato raso (120 g)',
    medida_caseira: '1 prato raso (120 g)',
    aliases: ['macarrao', 'macarrão', 'macarroes', 'macarrões', 'macarrao cozido', 'macarrão cozido', 'macarroes cozidos', 'macarrões cozidos', 'macarrao trigo', 'macarrão de trigo']
  }
};
var TACO_RUNTIME_PORTION_MAP = TACO_FOOD_UX_OVERRIDES;

function mapTacoCatalogGroup(category) {
  var normalized = normalizeDietFoodText(category || '');
  if (/(feij|lentilha|grao de bico|ervilha|leguminosa)/.test(normalized)) return 'leguminosas';
  if (/(frut|banana|\bmaca\b)/.test(normalized)) return 'frutas';
  if (/(cereal|pao|paes|massa|macarrao|arroz|raiz|raizes|tuberc|farinha|tapioca|batata)/.test(normalized)) return 'carboidratos';
  if (/(hortalic|verdura|legume|veget|brocol|cenoura|tomate|alface)/.test(normalized)) return 'vegetais';
  if (/(oleo|gordura|azeite|castanha|semente|amendoim|oleaginosa|abacate)/.test(normalized)) return 'gorduras';
  if (/(carne|ovo|ovos|pescad|peixe|frango|bovin|suin|leite|queijo|iogurte|proteina)/.test(normalized)) return 'proteinas';
  return 'carboidratos';
}

function mergeDietAliases() {
  var seen = Object.create(null);
  var out = [];
  Array.prototype.slice.call(arguments).forEach(function(list) {
    (Array.isArray(list) ? list : [list]).forEach(function(value) {
      var key = normalizeDietFoodText(value);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(value);
      var singular = key.split(' ').map(function(token) {
        return token.length > 3 && /s$/.test(token) ? token.slice(0, -1) : token;
      }).join(' ');
      if (singular && !seen[singular]) {
        seen[singular] = true;
        out.push(singular);
      }
    });
  });
  return out;
}

function applyTacoFoodUx(food) {
  if (!food || typeof food !== 'object') return food;
  var tacoId = food.taco_id || food.id || food.code || null;
  var override = tacoId && TACO_FOOD_UX_OVERRIDES[tacoId] ? TACO_FOOD_UX_OVERRIDES[tacoId] : null;
  var officialName = food.official_name || food.nome || food.name || food.display_name_pt || null;
  var displayName = override && override.display_name ? override.display_name : (food.display_name || food.display_name_pt || food.canonical_name_pt || food.nome || food.name || 'Alimento');
  var groupKey = food.group_key || food.grupo || (override && override.group_key) || mapTacoCatalogGroup([food.categoria, officialName, displayName].filter(Boolean).join(' '));
  var per100 = {
    kcal: asKroniaNumber(food.kcal_100g != null ? food.kcal_100g : (food.kcal_por_100g != null ? food.kcal_por_100g : food.energia_kcal), 0),
    protein: asKroniaNumber(food.protein_100g != null ? food.protein_100g : (food.proteina_por_100g != null ? food.proteina_por_100g : food.proteina_g), 0),
    carbs: asKroniaNumber(food.carbs_100g != null ? food.carbs_100g : (food.carbo_por_100g != null ? food.carbo_por_100g : food.carboidrato_g), 0),
    fat: asKroniaNumber(food.fat_100g != null ? food.fat_100g : (food.gordura_por_100g != null ? food.gordura_por_100g : food.lipidios_g), 0),
    fiber: asKroniaNumber(food.fiber_100g != null ? food.fiber_100g : (food.fibra_por_100g != null ? food.fibra_por_100g : food.fibra_g), 0),
    sodium: asKroniaNumber(food.sodium_mg_100g != null ? food.sodium_mg_100g : (food.sodio_mg_por_100g != null ? food.sodio_mg_por_100g : food.sodio_mg), 0)
  };
  return Object.assign({}, food, {
    display_name: displayName,
    display_name_pt: displayName,
    canonical_name_pt: displayName,
    nome: displayName,
    official_name: officialName,
    default_portion_g: override && override.default_portion_g ? override.default_portion_g : (food.default_portion_g || food.porcao_gramas || food.grams || food.gramas || 100),
    default_unit: override && override.default_unit ? override.default_unit : (food.default_unit || food.medida_caseira || '100 g'),
    medida_caseira: override && override.medida_caseira ? override.medida_caseira : (food.medida_caseira || food.default_unit || '100 g'),
    group_key: groupKey,
    grupo: groupKey,
    aliases: mergeDietAliases(food.aliases, override && override.aliases, officialName, displayName),
    per100: per100,
    kcal_100g: per100.kcal,
    protein_100g: per100.protein,
    carbs_100g: per100.carbs,
    fat_100g: per100.fat,
    fiber_100g: per100.fiber,
    sodium_mg_100g: per100.sodium,
    source: food.source || 'taco',
    source_type: food.source_type || 'taco',
    is_taco_fallback: true
  });
}

function normalizeRuntimeFoodEntry(food, sourceKind) {
  var initialFood = food && typeof food === 'object' ? food : {};
  var safeFood = sourceKind === 'taco' || Boolean(initialFood.taco_id) ? applyTacoFoodUx(initialFood) : initialFood;
  var isTaco = sourceKind === 'taco' || Boolean(safeFood.taco_id);
  var tacoPortion = isTaco && safeFood.taco_id && TACO_RUNTIME_PORTION_MAP[safeFood.taco_id]
    ? TACO_RUNTIME_PORTION_MAP[safeFood.taco_id]
    : null;
  var defaultPortion = asKroniaNumber(
    safeFood.default_portion_g ||
    (tacoPortion && tacoPortion.default_portion_g) ||
    safeFood.porcao_gramas ||
    safeFood.grams ||
    safeFood.gramas,
    0
  ) || 100;
  var defaultUnit = safeFood.default_unit || (tacoPortion && tacoPortion.default_unit) || (defaultPortion + ' g');
  var medidaCaseira = safeFood.medida_caseira || (tacoPortion && tacoPortion.medida_caseira) || defaultUnit;
  var nome = String(safeFood.display_name || safeFood.display_name_pt || safeFood.canonical_name_pt || safeFood.nome || safeFood.name || safeFood.label || 'Alimento').trim();
  var officialName = isTaco ? String(safeFood.official_name || initialFood.nome || initialFood.name || nome).trim() : null;
  var slug = String(safeFood.slug || safeFood.food_slug || safeFood.code || safeFood.id || normalizeDietFoodText(nome)).trim();
  var groupKey = String(safeFood.group_key || safeFood.grupo || safeFood.grupo_equivalencia || (isTaco ? mapTacoCatalogGroup(safeFood.categoria) : 'carboidratos') || '').trim();
  var kcal = asKroniaNumber(
    safeFood.kcal_100g != null ? safeFood.kcal_100g :
    safeFood.calories != null ? safeFood.calories :
    safeFood.kcal != null ? safeFood.kcal :
    safeFood.energia_kcal != null ? safeFood.energia_kcal : 0,
    0
  );
  var protein = asKroniaNumber(
    safeFood.protein_100g != null ? safeFood.protein_100g :
    safeFood.proteina_por_100g != null ? safeFood.proteina_por_100g :
    safeFood.proteina != null ? safeFood.proteina :
    safeFood.proteina_g != null ? safeFood.proteina_g :
    safeFood.protein != null ? safeFood.protein : 0,
    0
  );
  var carbs = asKroniaNumber(
    safeFood.carbs_100g != null ? safeFood.carbs_100g :
    safeFood.carbo_por_100g != null ? safeFood.carbo_por_100g :
    safeFood.carboidrato != null ? safeFood.carboidrato :
    safeFood.carboidrato_g != null ? safeFood.carboidrato_g :
    safeFood.carbs != null ? safeFood.carbs : 0,
    0
  );
  var fat = asKroniaNumber(
    safeFood.fat_100g != null ? safeFood.fat_100g :
    safeFood.gordura_por_100g != null ? safeFood.gordura_por_100g :
    safeFood.gordura != null ? safeFood.gordura :
    safeFood.lipidios_g != null ? safeFood.lipidios_g :
    safeFood.fat != null ? safeFood.fat : 0,
    0
  );
  var fiber = asKroniaNumber(
    safeFood.fiber_100g != null ? safeFood.fiber_100g :
    safeFood.fibra_por_100g != null ? safeFood.fibra_por_100g :
    safeFood.fibra != null ? safeFood.fibra :
    safeFood.fibra_g != null ? safeFood.fibra_g :
    safeFood.fiber != null ? safeFood.fiber : 0,
    0
  );

  return {
    id: String(safeFood.id || safeFood.taco_id || slug || nome),
    slug: slug,
    food_slug: slug,
    display_name_pt: nome,
    canonical_name_pt: nome,
    official_name: officialName,
    name: nome,
    nome: nome,
    grupo: groupKey,
    group_key: groupKey,
    subgrupo: safeFood.subgroup_key || safeFood.subcategoria || safeFood.categoria || null,
    subgroup_key: safeFood.subgroup_key || safeFood.subcategoria || safeFood.categoria || null,
    porcao: safeFood.porcao || defaultUnit,
    medida_caseira: safeFood.measure || medidaCaseira,
    default_portion_g: defaultPortion,
    default_unit: defaultUnit,
    kcal: kcal,
    proteina: protein,
    carboidrato: carbs,
    gordura: fat,
    fibra: fiber,
    kcal_100g: kcal,
    protein_100g: protein,
    carbs_100g: carbs,
    fat_100g: fat,
    fiber_100g: fiber,
    sodium_mg_100g: asKroniaNumber(safeFood.sodium_mg_100g != null ? safeFood.sodium_mg_100g : safeFood.sodio_mg, 0),
    per100: {
      kcal: kcal,
      protein: protein,
      carbs: carbs,
      fat: fat,
      fiber: fiber,
      sodium: asKroniaNumber(safeFood.sodium_mg_100g != null ? safeFood.sodium_mg_100g : safeFood.sodio_mg, 0)
    },
    source: safeFood.source || (isTaco ? 'taco' : 'kronia'),
    source_type: safeFood.source_type || (isTaco ? 'taco' : 'kronia'),
    source_id: safeFood.source_id || safeFood.sourceCode || safeFood.code || safeFood.id || safeFood.taco_id || slug,
    code: safeFood.code || safeFood.id || safeFood.taco_id || slug,
    taco_id: safeFood.taco_id || null,
    codigo_taco: safeFood.codigo_taco != null ? Number(safeFood.codigo_taco) : null,
    is_taco_fallback: Boolean(isTaco),
    aliases: Array.isArray(safeFood.aliases) ? safeFood.aliases.slice() : []
  };
}

function ensureDietTacoCatalogLoaded() {
  if (Array.isArray(window.KRONIA_TACO_DATABASE) && window.KRONIA_TACO_DATABASE.length) {
    return Promise.resolve(window.KRONIA_TACO_DATABASE);
  }
  if (_dietTacoCatalogPromise) return _dietTacoCatalogPromise;
  if (typeof fetch !== 'function') return Promise.resolve([]);

  _dietTacoCatalogPromise = fetch('src/lib/nutrition/tacoDatabase.json', { cache: 'force-cache' })
    .then(function(response) {
      if (!response.ok) throw new Error('Falha ao carregar TACO runtime');
      return response.json();
    })
    .then(function(payload) {
      window.KRONIA_TACO_DATABASE = Array.isArray(payload) ? payload : [];
      _dietCatalogIndexCache = null;
      if (document.getElementById('dietAddItemSheet')) {
        renderDietAddCatalog(Number(document.getElementById('dietAddMeal')?.value || 0));
      }
      return window.KRONIA_TACO_DATABASE;
    })
    .catch(function() {
      return [];
    });

  return _dietTacoCatalogPromise;
}

function getDietCatalogDedupKey(item) {
  if (!item || typeof item !== 'object') return '';
  return normalizeDietFoodText(item.display_name_pt || item.canonical_name_pt || item.nome || item.name || '');
}

function getDietCatalogTacoKey(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.taco_id || item.codigo_taco || item.source_id || item.sourceId || '').trim();
}

function getDietRuntimeCatalogFoods() {
  var premium = typeof window !== 'undefined' && window && window.KRONIA_PREMIUM_FOOD_CATALOG && Array.isArray(window.KRONIA_PREMIUM_FOOD_CATALOG.foods)
    ? window.KRONIA_PREMIUM_FOOD_CATALOG.foods.map(function(item) { return normalizeRuntimeFoodEntry(item, 'kronia'); })
    : [];
  var fallback = Array.isArray(NUTRITION_FOOD_CATALOG) ? NUTRITION_FOOD_CATALOG.map(function(item) {
    var portionText = String(item && item.porcao || '');
    var portionMatch = portionText.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
    var portionGrams = asKroniaNumber(item && (item.porcao_gramas || item.grams || item.gramas), 0) || (portionMatch ? asKroniaNumber(portionMatch[1], 0) : 0);
    return normalizeRuntimeFoodEntry(Object.assign({}, item, {
      default_portion_g: portionGrams || 100,
      default_unit: item.porcao || item.default_unit || ((portionGrams || 100) + ' g'),
      kcal_100g: portionGrams > 0 ? dietRound(asKroniaNumber(item.kcal || item.calorias, 0) * (100 / portionGrams), 3) : asKroniaNumber(item.kcal || item.calorias, 0),
      protein_100g: portionGrams > 0 ? dietRound(asKroniaNumber(item.proteina || item.proteinas || item.protein, 0) * (100 / portionGrams), 3) : asKroniaNumber(item.proteina || item.proteinas || item.protein, 0),
      carbs_100g: portionGrams > 0 ? dietRound(asKroniaNumber(item.carboidrato || item.carboidratos || item.carbs, 0) * (100 / portionGrams), 3) : asKroniaNumber(item.carboidrato || item.carboidratos || item.carbs, 0),
      fat_100g: portionGrams > 0 ? dietRound(asKroniaNumber(item.gordura || item.gorduras || item.fat, 0) * (100 / portionGrams), 3) : asKroniaNumber(item.gordura || item.gorduras || item.fat, 0),
      fiber_100g: portionGrams > 0 ? dietRound(asKroniaNumber(item.fibra || item.fibras || item.fiber, 0) * (100 / portionGrams), 3) : asKroniaNumber(item.fibra || item.fibras || item.fiber, 0),
      sodium_mg_100g: portionGrams > 0 ? dietRound(asKroniaNumber(item.sodium_mg || item.sodio_mg || item.sodium, 0) * (100 / portionGrams), 3) : asKroniaNumber(item.sodium_mg || item.sodio_mg || item.sodium, 0),
      source: 'NUTRITION_FOOD_CATALOG_fallback',
      source_type: 'fallback'
    }), 'fallback');
  }) : [];
  var taco = Array.isArray(window.KRONIA_TACO_DATABASE) ? window.KRONIA_TACO_DATABASE.map(function(item) {
    return normalizeRuntimeFoodEntry(item, 'taco');
  }) : [];
  return premium.concat(fallback).concat(taco);
}

function buildDietCatalogIndexes() {
  var foods = getDietRuntimeCatalogFoods();
  var premiumAliases = typeof window !== 'undefined' && window && window.KRONIA_PREMIUM_FOOD_CATALOG && Array.isArray(window.KRONIA_PREMIUM_FOOD_CATALOG.aliases)
    ? window.KRONIA_PREMIUM_FOOD_CATALOG.aliases
    : [];
  var byKey = {};
  var byNormalizedName = {};
  foods.forEach(function(food) {
    if (!food || typeof food !== 'object') return;
    var slug = String(food.slug || food.food_slug || food.id || '').trim();
    var id = String(food.id || '').trim();
    var normalizedNames = [
      food.display_name_pt,
      food.canonical_name_pt,
      food.official_name,
      slug.replace(/_/g, ' ')
    ].filter(Boolean).map(normalizeDietFoodText);
    var normalizedSlug = normalizeDietFoodText(slug);
    if (slug) {
      byKey[slug] = food;
      byKey[normalizedSlug] = food;
    }
    if (id) {
      byKey[id] = food;
      byKey[normalizeDietFoodText(id)] = food;
    }
    if (food.taco_id) {
      byKey[String(food.taco_id)] = food;
      byKey[normalizeDietFoodText(food.taco_id)] = food;
    }
    normalizedNames.forEach(function(nameKey) {
      if (nameKey && !byNormalizedName[nameKey]) byNormalizedName[nameKey] = food;
    });
    if (Array.isArray(food.aliases)) {
      food.aliases.forEach(function(alias) {
        var aliasKey = normalizeDietFoodText(alias);
        if (aliasKey && !byNormalizedName[aliasKey]) byNormalizedName[aliasKey] = food;
      });
    }
  });
  premiumAliases.forEach(function(alias) {
    var aliasKey = normalizeDietFoodText(alias && (alias.normalized_alias || alias.alias));
    var slug = alias && alias.food_slug;
    if (aliasKey && slug && byKey[slug] && !byNormalizedName[aliasKey]) byNormalizedName[aliasKey] = byKey[slug];
  });
  return {
    foods: foods,
    byKey: byKey,
    byNormalizedName: byNormalizedName
  };
}

function getDietCatalogIndexes() {
  if (!_dietCatalogIndexCache) _dietCatalogIndexCache = buildDietCatalogIndexes();
  return _dietCatalogIndexCache;
}

function resolveDietCatalogFood(item) {
  var safeItem = item && typeof item === 'object' ? item : {};
  var indexes = getDietCatalogIndexes();
  var candidates = [
    safeItem.food_slug,
    safeItem.foodSlug,
    safeItem.catalog_ref,
    safeItem.catalogRef,
    safeItem.sourceId,
    safeItem.source_id,
    safeItem.taco_id,
    safeItem.codigo_taco,
    safeItem.food_id,
    safeItem.foodId
  ].filter(Boolean);
  for (var i = 0; i < candidates.length; i++) {
    var key = String(candidates[i]).trim();
    if (indexes.byKey[key]) return indexes.byKey[key];
    var normalizedKey = normalizeDietFoodText(key);
    if (indexes.byKey[normalizedKey]) return indexes.byKey[normalizedKey];
    if (indexes.byNormalizedName[normalizedKey]) return indexes.byNormalizedName[normalizedKey];
  }
  var nameKey = normalizeDietFoodText(getDietItemName(safeItem));
  return indexes.byNormalizedName[nameKey] || null;
}

function calculateFoodMacros(food, grams) {
  var safeFood = food && typeof food === 'object' ? food : null;
  var normalizedGrams = Math.max(0, asKroniaNumber(grams, 0));
  if (!safeFood || !normalizedGrams) {
    return {
      grams: normalizedGrams,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
      catalogMatch: Boolean(safeFood),
      per100: safeFood ? {
        kcal: dietRound(safeFood.kcal_100g, 3),
        protein: dietRound(safeFood.protein_100g, 3),
        carbs: dietRound(safeFood.carbs_100g, 3),
        fat: dietRound(safeFood.fat_100g, 3),
        fiber: dietRound(safeFood.fiber_100g, 3),
        sodium: dietRound(safeFood.sodium_mg_100g, 3)
      } : null
    };
  }
  var ratio = normalizedGrams / 100;
  return {
    grams: normalizedGrams,
    kcal: dietRound(asKroniaNumber(safeFood.kcal_100g, 0) * ratio, 1),
    protein: dietRound(asKroniaNumber(safeFood.protein_100g, 0) * ratio, 1),
    carbs: dietRound(asKroniaNumber(safeFood.carbs_100g, 0) * ratio, 1),
    fat: dietRound(asKroniaNumber(safeFood.fat_100g, 0) * ratio, 1),
    fiber: dietRound(asKroniaNumber(safeFood.fiber_100g, 0) * ratio, 1),
    sodium: dietRound(asKroniaNumber(safeFood.sodium_mg_100g, 0) * ratio, 1),
    catalogMatch: true,
    per100: {
      kcal: dietRound(safeFood.kcal_100g, 3),
      protein: dietRound(safeFood.protein_100g, 3),
      carbs: dietRound(safeFood.carbs_100g, 3),
      fat: dietRound(safeFood.fat_100g, 3),
      fiber: dietRound(safeFood.fiber_100g, 3),
      sodium: dietRound(safeFood.sodium_mg_100g, 3)
    }
  };
}

function buildDietFallbackPer100(item, grams) {
  var safeItem = item && typeof item === 'object' ? item : {};
  var currentPer100 = safeItem.per100 && typeof safeItem.per100 === 'object' ? safeItem.per100 : null;
  if (currentPer100) {
    return {
      kcal: dietRound(asKroniaNumber(currentPer100.kcal, 0), 3),
      protein: dietRound(asKroniaNumber(currentPer100.protein, 0), 3),
      carbs: dietRound(asKroniaNumber(currentPer100.carbs, 0), 3),
      fat: dietRound(asKroniaNumber(currentPer100.fat, 0), 3),
      fiber: dietRound(asKroniaNumber(currentPer100.fiber, 0), 3),
      sodium: dietRound(asKroniaNumber(currentPer100.sodium, 0), 3)
    };
  }
  var baseGrams = Math.max(asKroniaNumber(grams, 0), 0);
  if (!baseGrams || safeItem.food_slug || safeItem.foodSlug || safeItem.food_id || safeItem.foodId || safeItem.catalog_ref || safeItem.catalogRef) return null;
  var ratio = 100 / baseGrams;
  return {
    kcal: dietRound(asKroniaNumber(safeItem.kcal || safeItem.calorias, 0) * ratio, 3),
    protein: dietRound(asKroniaNumber(safeItem.protein || safeItem.proteina || safeItem.proteinas || safeItem.prot, 0) * ratio, 3),
    carbs: dietRound(asKroniaNumber(safeItem.carbs || safeItem.carbo || safeItem.carboidratos || safeItem.carb, 0) * ratio, 3),
    fat: dietRound(asKroniaNumber(safeItem.fat || safeItem.gordura || safeItem.gorduras || safeItem.gord, 0) * ratio, 3),
    fiber: dietRound(asKroniaNumber(safeItem.fiber || safeItem.fibras || safeItem.fibra, 0) * ratio, 3),
    sodium: dietRound(asKroniaNumber(safeItem.sodium || safeItem.sodio_mg || safeItem.sodium_mg, 0) * ratio, 3)
  };
}

function calculateDietFallbackMacros(per100, grams, currentValues) {
  var normalizedPer100 = per100 && typeof per100 === 'object' ? per100 : null;
  var safeCurrent = currentValues && typeof currentValues === 'object' ? currentValues : {};
  var normalizedGrams = Math.max(0, asKroniaNumber(grams, 0));
  if (!normalizedPer100 || !normalizedGrams) {
    return {
      grams: normalizedGrams,
      kcal: dietRound(asKroniaNumber(safeCurrent.kcal, 0), 1),
      protein: dietRound(asKroniaNumber(safeCurrent.protein, 0), 1),
      carbs: dietRound(asKroniaNumber(safeCurrent.carbs, 0), 1),
      fat: dietRound(asKroniaNumber(safeCurrent.fat, 0), 1),
      fiber: dietRound(asKroniaNumber(safeCurrent.fiber, 0), 1),
      sodium: dietRound(asKroniaNumber(safeCurrent.sodium, 0), 1),
      catalogMatch: false,
      per100: normalizedPer100
    };
  }
  var ratio = normalizedGrams / 100;
  return {
    grams: normalizedGrams,
    kcal: dietRound(asKroniaNumber(normalizedPer100.kcal, 0) * ratio, 1),
    protein: dietRound(asKroniaNumber(normalizedPer100.protein, 0) * ratio, 1),
    carbs: dietRound(asKroniaNumber(normalizedPer100.carbs, 0) * ratio, 1),
    fat: dietRound(asKroniaNumber(normalizedPer100.fat, 0) * ratio, 1),
    fiber: dietRound(asKroniaNumber(normalizedPer100.fiber, 0) * ratio, 1),
    sodium: dietRound(asKroniaNumber(normalizedPer100.sodium, 0) * ratio, 1),
    catalogMatch: false,
    per100: normalizedPer100
  };
}

function syncDietPlanVisualPrescription(plan) {
  var safePlan = plan && typeof plan === 'object' ? plan : {};
  var baseVisual = safePlan.visualPrescription && typeof safePlan.visualPrescription === 'object'
    ? cloneDietVisualPrescription(safePlan.visualPrescription)
    : buildDefaultDietVisualPrescription();
  var meals = Array.isArray(safePlan.meals) ? safePlan.meals : [];
  baseVisual.summary = Object.assign({}, baseVisual.summary, {
    kcal_total: dietRound(asKroniaNumber(safePlan.totals && safePlan.totals.kcal, 0), 0),
    proteina: dietRound(asKroniaNumber(safePlan.totals && safePlan.totals.protein, 0), 1),
    carbo: dietRound(asKroniaNumber(safePlan.totals && safePlan.totals.carbs, 0), 1),
    gordura: dietRound(asKroniaNumber(safePlan.totals && safePlan.totals.fat, 0), 1)
  });
  baseVisual.meals = meals.map(function(meal, mealIndex) {
    var safeMeal = meal && typeof meal === 'object' ? meal : {};
    var subtotal = safeMeal.subtotal && typeof safeMeal.subtotal === 'object' ? safeMeal.subtotal : {};
    return {
      id: safeMeal.id || ('visual_meal_' + (mealIndex + 1)),
      slot: safeMeal.slot || normalizeDietFoodText(safeMeal.name || 'refeicao'),
      name: safeMeal.name || ('Refeição ' + (mealIndex + 1)),
      time: safeMeal.time || '',
      kcal_estimada: dietRound(asKroniaNumber(subtotal.kcal, 0), 0),
      items: (Array.isArray(safeMeal.items) ? safeMeal.items : []).map(function(item) {
        var safeItem = item && typeof item === 'object' ? item : {};
        var name = String(safeItem.name || getDietItemName(safeItem)).trim();
        var quantity = String(safeItem.quantity || (safeItem.grams ? (safeItem.grams + ' g') : '')).trim();
        return quantity ? (name + ' - ' + quantity) : name;
      }).filter(Boolean)
    };
  });
  return baseVisual;
}

function mapVisualMealToLegacyMeal(meal, mealIndex) {
  var safeMeal = meal && typeof meal === 'object' ? meal : {};
  var foods = Array.isArray(safeMeal.items) ? safeMeal.items.map(parseDietVisualItem).filter(Boolean) : [];
  var kcal = asKroniaNumber(safeMeal.kcal_estimada, 0);
  return {
    id: safeMeal.id || ('visual_meal_' + (mealIndex + 1)),
    nome: safeMeal.name || ('Refeição ' + (mealIndex + 1)),
    tipo: safeMeal.slot || normalizeDietFoodText(safeMeal.name || 'refeicao'),
    horario: safeMeal.time || '',
    foco: 'KRONIA',
    substituicoes: [],
    alimentos: foods.map(function(item) {
      return {
        nome: item.nome,
        qtde: item.porcao,
        kcal: 0,
        prot: 0,
        carb: 0,
        gord: 0
      };
    }),
    subtotal: {
      kcal: kcal,
      prot: 0,
      carb: 0,
      gord: 0
    },
    itens: foods
  };
}

function getDietRenderableMeals(plan) {
  var safePlan = plan && typeof plan === 'object' ? plan : {};
  var visual = safePlan.visualPrescription && typeof safePlan.visualPrescription === 'object' ? safePlan.visualPrescription : null;
  if (visual && Array.isArray(visual.meals) && visual.meals.length) {
    return visual.meals.map(function(meal, mealIndex) {
      var safeMeal = meal && typeof meal === 'object' ? meal : {};
      var rawItems = Array.isArray(safeMeal.items) ? safeMeal.items.map(parseDietVisualItem).filter(Boolean) : [];
      var normalizedItems = rawItems.map(function(item, itemIndex) {
        return normalizeDietEditorItem(item, itemIndex + 1);
      });
      var computedSub = normalizedItems.reduce(function(acc, it) {
        acc.kcal  += asKroniaNumber(it.kcal,    0);
        acc.protein += asKroniaNumber(it.protein, 0);
        acc.carbs   += asKroniaNumber(it.carbs,   0);
        acc.fat     += asKroniaNumber(it.fat,     0);
        acc.fiber   += asKroniaNumber(it.fiber,   0);
        acc.sodium  += asKroniaNumber(it.sodium,  0);
        return acc;
      }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 });
      var estimatedKcal = asKroniaNumber(safeMeal.kcal_estimada, 0);
      return {
        id: safeMeal.id || ('visual_meal_' + (mealIndex + 1)),
        name: safeMeal.name || ('Refeição ' + (mealIndex + 1)),
        slot: safeMeal.slot || normalizeDietFoodText(safeMeal.name || 'refeicao'),
        time: safeMeal.time || '',
        notes: '',
        substituicoes: [],
        subtotal: {
          kcal:    dietRound(computedSub.kcal    || estimatedKcal, 0),
          protein: dietRound(computedSub.protein, 1),
          carbs:   dietRound(computedSub.carbs,   1),
          fat:     dietRound(computedSub.fat,     1),
          fiber:   dietRound(computedSub.fiber,   1),
          sodium:  dietRound(computedSub.sodium,  0)
        },
        items: normalizedItems
      };
    });
  }
  return Array.isArray(safePlan.meals) ? safePlan.meals : [];
}

function normalizeDietVisualSubstitutions(raw) {
  var base = raw && typeof raw === 'object' ? raw : {};
  return {
    proteinas: Array.isArray(base.proteinas) ? base.proteinas.slice() : [],
    carboidratos: Array.isArray(base.carboidratos) ? base.carboidratos.slice() : [],
    leguminosas: Array.isArray(base.leguminosas) ? base.leguminosas.slice() : [],
    legumes: Array.isArray(base.legumes) ? base.legumes.slice() : []
  };
}

function getDietItemName(item) {
  return String(item && (item.nome || item.food_name || item.display_name || item.name) || 'Alimento');
}

function extractDietQuantityGrams() {
  for (var i = 0; i < arguments.length; i++) {
    var value = arguments[i];
    var text = typeof value === 'string' ? value.trim() : '';
    if (!text) continue;
    var match = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
    if (match) return parseFloat(match[1].replace(',', '.'));
  }
  return 0;
}

function normalizeDietEditorItem(item, order) {
  var safeItem = item && typeof item === 'object' ? item : {};
  var quantityGrams = extractDietQuantityGrams(
    safeItem.qtde,
    safeItem.porcao,
    safeItem.quantity,
    safeItem.household_measure,
    safeItem.default_unit
  );
  var resolvedFood = resolveDietCatalogFood(safeItem);
  var grams = dietRound((safeItem.gramas || safeItem.grams || safeItem.porcao_gramas) || quantityGrams || safeItem.default_portion_g || (resolvedFood && resolvedFood.default_portion_g) || 0, 1);
  var rawMacros = {
    kcal: dietRound(safeItem && (safeItem.calorias || safeItem.kcal || safeItem.calories), 1),
    protein: dietRound(safeItem && (safeItem.proteinas || safeItem.proteína || safeItem.proteina || safeItem.protein_g || safeItem.protein || safeItem.prot || safeItem.estimated_protein_g), 1),
    carbs: dietRound(safeItem && (safeItem.carboidratos || safeItem.carboidrato || safeItem.carbo || safeItem.carbs_g || safeItem.carbs || safeItem.carb || safeItem.estimated_carbs_g), 1),
    fat: dietRound(safeItem && (safeItem.gorduras || safeItem.gordura || safeItem.fat_g || safeItem.fat || safeItem.gord || safeItem.estimated_fat_g), 1),
    fiber: dietRound(safeItem && (safeItem.fibras || safeItem.fibra || safeItem.fiber_g || safeItem.fiber), 1),
    sodium: dietRound(safeItem && (safeItem.sodium_mg || safeItem.sodio_mg || safeItem.sodium), 1)
  };
  var fallbackPer100 = buildDietFallbackPer100(safeItem, grams);
  var macroSource = fallbackPer100
    ? calculateDietFallbackMacros(fallbackPer100, grams, rawMacros)
    : (resolvedFood
      ? calculateFoodMacros(resolvedFood, grams || resolvedFood.default_portion_g || 0)
      : calculateDietFallbackMacros(fallbackPer100, grams, rawMacros));
  var quantity = String(safeItem && (safeItem.porcao || safeItem.qtde || safeItem.quantity || safeItem.household_measure || safeItem.default_unit)
    || (resolvedFood && resolvedFood.default_unit)
    || (grams ? (grams + ' g') : '1 porção'));
  if (grams && /\bg\b/i.test(quantity) && !/\d/.test(quantity)) quantity = grams + ' g';
  return {
    id: safeItem && safeItem.id || ('item_' + Date.now() + '_' + order),
    sourceType: safeItem && (safeItem.sourceType || safeItem.source_type) || ((resolvedFood && (resolvedFood.source === 'taco' || resolvedFood.is_taco_fallback)) ? 'taco' : (resolvedFood ? 'catalog' : (safeItem && safeItem.foodCode ? 'catalog' : 'custom'))),
    sourceId: safeItem && (safeItem.sourceId || safeItem.source_id || safeItem.foodCode || safeItem.code || safeItem.food_id || safeItem.foodId) || (resolvedFood && (resolvedFood.id || resolvedFood.slug)) || null,
    food_id: safeItem && (safeItem.food_id || safeItem.foodId) || (resolvedFood && resolvedFood.id) || null,
    food_slug: safeItem && (safeItem.food_slug || safeItem.foodSlug) || (resolvedFood && resolvedFood.slug) || null,
    catalog_ref: safeItem && (safeItem.catalog_ref || safeItem.catalogRef) || (resolvedFood && resolvedFood.slug) || null,
    catalogMatch: Boolean(resolvedFood),
    source: safeItem && safeItem.source || (resolvedFood && resolvedFood.source) || null,
    taco_id: safeItem && safeItem.taco_id || (resolvedFood && resolvedFood.taco_id) || null,
    codigo_taco: safeItem && safeItem.codigo_taco || (resolvedFood && resolvedFood.codigo_taco) || null,
    official_name: safeItem && safeItem.official_name || (resolvedFood && resolvedFood.official_name) || null,
    is_taco_fallback: Boolean((safeItem && safeItem.is_taco_fallback) || (resolvedFood && resolvedFood.is_taco_fallback) || (safeItem && safeItem.source === 'taco')),
    name: resolvedFood && (resolvedFood.source === 'taco' || resolvedFood.is_taco_fallback) ? getDietItemName(resolvedFood) : getDietItemName(safeItem),
    slot: safeItem && (safeItem.slot || safeItem.substitution_group || safeItem.groupKey || safeItem.group_key) || (resolvedFood && resolvedFood.group_key) || 'item',
    unit: safeItem && (safeItem.unit || safeItem.unidade) || (resolvedFood && resolvedFood.default_unit) || null,
    quantity: quantity,
    grams: grams || null,
    kcal: macroSource.kcal,
    protein: macroSource.protein,
    carbs: macroSource.carbs,
    fat: macroSource.fat,
    fiber: macroSource.fiber,
    sodium: macroSource.sodium,
    locked: Boolean(safeItem && (safeItem.locked || safeItem.is_locked)),
    order: Number(order || safeItem && (safeItem.ordem || safeItem.sort_order) || 0),
    notes: safeItem && safeItem.notes || '',
    per100: macroSource.per100,
    substitutions: Array.isArray(safeItem && safeItem.substituicoes) ? safeItem.substituicoes : [],
    catalogSource: resolvedFood ? 'premium_catalog' : (fallbackPer100 ? 'item_fallback' : null)
  };
}

function recalculateDietPlan(plan) {
  var safePlan = plan && typeof plan === 'object' ? Object.assign({}, plan) : {};
  safePlan.meals = (safePlan.meals || []).map(function(meal, mealIndex) {
    var items = (meal.items || []).map(function(item, itemIndex) {
      return normalizeDietEditorItem(Object.assign({}, item, { order: itemIndex + 1 }), itemIndex + 1);
    });
    var subtotal = items.reduce(function(acc, item) {
      acc.kcal += asKroniaNumber(item.kcal, 0);
      acc.protein += asKroniaNumber(item.protein, 0);
      acc.carbs += asKroniaNumber(item.carbs, 0);
      acc.fat += asKroniaNumber(item.fat, 0);
      acc.fiber += asKroniaNumber(item.fiber, 0);
      acc.sodium += asKroniaNumber(item.sodium, 0);
      return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 });
    return Object.assign({}, meal, {
      order: mealIndex + 1,
      items: items,
      subtotal: {
        kcal: dietRound(subtotal.kcal, 0),
        protein: dietRound(subtotal.protein, 1),
        carbs: dietRound(subtotal.carbs, 1),
        fat: dietRound(subtotal.fat, 1),
        fiber: dietRound(subtotal.fiber, 1),
        sodium: dietRound(subtotal.sodium, 0)
      }
    });
  });
  var totals = safePlan.meals.reduce(function(acc, meal) {
    acc.kcal += asKroniaNumber(meal.subtotal && meal.subtotal.kcal, 0);
    acc.protein += asKroniaNumber(meal.subtotal && meal.subtotal.protein, 0);
    acc.carbs += asKroniaNumber(meal.subtotal && meal.subtotal.carbs, 0);
    acc.fat += asKroniaNumber(meal.subtotal && meal.subtotal.fat, 0);
    acc.fiber += asKroniaNumber(meal.subtotal && meal.subtotal.fiber, 0);
    acc.sodium += asKroniaNumber(meal.subtotal && meal.subtotal.sodium, 0);
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 });
  safePlan.totals = {
    kcal: dietRound(totals.kcal, 0),
    protein: dietRound(totals.protein, 1),
    carbs: dietRound(totals.carbs, 1),
    fat: dietRound(totals.fat, 1),
    fiber: dietRound(totals.fiber, 1),
    sodium: dietRound(totals.sodium, 0)
  };
  safePlan.visualPrescription = syncDietPlanVisualPrescription(safePlan);
  safePlan.updatedAt = new Date().toISOString();
  return safePlan;
}

function normalizeDietGeneratedPlan(plan, meta) {
  var safePlan = plan && typeof plan === 'object' ? plan : {};
  var visualPrescription = extractDietVisualPrescription(safePlan);
  var visualMeals = visualPrescription && Array.isArray(visualPrescription.meals)
    ? visualPrescription.meals.map(mapVisualMealToLegacyMeal)
    : [];
  var visualHasItems = visualMeals.some(function(m) {
    return (Array.isArray(m.itens) && m.itens.length > 0) || (Array.isArray(m.alimentos) && m.alimentos.length > 0);
  });
  var meals = (visualMeals.length && visualHasItems)
    ? visualMeals
    : (Array.isArray(safePlan.refeicoes) && safePlan.refeicoes.length ? safePlan.refeicoes : (visualMeals.length ? visualMeals : []));
  var summary = visualPrescription && visualPrescription.summary && typeof visualPrescription.summary === 'object'
    ? visualPrescription.summary
    : null;
  return recalculateDietPlan({
    id: safePlan.id || null,
    title: safePlan.title || 'Plano alimentar KRONIA',
    status: 'active',
    objective: safePlan.objetivo || meta && meta.objective || 'hipertrofia',
    source: meta && meta.source || 'kronia_generated_plan',
    targets: {
      kcal: asKroniaNumber(summary && summary.kcal_total || safePlan.caloriasMeta || safePlan.resumoDiario && safePlan.resumoDiario.calorias || safePlan.meta && safePlan.meta.calorias, 0),
      protein: asKroniaNumber(summary && summary.proteina || safePlan.macrosMeta && safePlan.macrosMeta.protein || safePlan.resumoDiario && safePlan.resumoDiario.proteinas || safePlan.meta && safePlan.meta.proteina, 0),
      carbs: asKroniaNumber(summary && summary.carbo || safePlan.macrosMeta && safePlan.macrosMeta.carbs || safePlan.resumoDiario && safePlan.resumoDiario.carboidratos || safePlan.meta && safePlan.meta.carbo, 0),
      fat: asKroniaNumber(summary && summary.gordura || safePlan.macrosMeta && safePlan.macrosMeta.fat || safePlan.resumoDiario && safePlan.resumoDiario.gorduras || safePlan.meta && safePlan.meta.gordura, 0)
    },
    presc: safePlan.meta ? { tmb: safePlan.meta.tmb || null, tdee: safePlan.meta.get || null } : null,
    orientacoes: Array.isArray(safePlan.observacoes) ? safePlan.observacoes.filter(Boolean) : [],
    hidratacao: safePlan.hidratacao || null,
    visualPrescription: visualPrescription ? Object.assign({}, visualPrescription, {
      substitutions: normalizeDietVisualSubstitutions(visualPrescription.substitutions)
    }) : buildDefaultDietVisualPrescription(),
    meals: meals.map(function(meal, mealIndex) {
      return {
        id: meal.id || ('meal_' + (mealIndex + 1)),
        name: meal.nome || meal.meal_name || 'Refeição',
        slot: meal.tipo || meal.meal_slot || normalizeDietFoodText(meal.nome || 'refeicao'),
        time: meal.horario || meal.time_hint || '',
        notes: meal.observacoes || '',
        substituicoes: Array.isArray(meal.substituicoes) ? meal.substituicoes : [],
        items: (Array.isArray(meal.itens) && meal.itens.length ? meal.itens : (Array.isArray(meal.alimentos) ? meal.alimentos : [])).map(function(item, itemIndex) { return normalizeDietEditorItem(item, itemIndex + 1); })
      };
    })
  });
}

function buildFallbackActiveDietPlan() {
  var statePlan = window._nutritionFlowState && window._nutritionFlowState.generatedPlan;
  if (statePlan) return normalizeDietGeneratedPlan(statePlan, { source: 'nutrition_flow_state' });
  var snapshot = safeJSON(KRONIA_NUTRITION_SNAPSHOT_KEY, null);
  if (snapshot && snapshot.activePlan) return normalizeDietGeneratedPlan(snapshot.activePlan, { source: 'nutrition_snapshot' });
  var defaultVisual = buildDefaultDietVisualPrescription();
  return normalizeDietGeneratedPlan({
    objetivo: 'ganho_massa',
    visualPrescription: defaultVisual,
    meta: {
      calorias: defaultVisual.summary.kcal_total,
      proteina: defaultVisual.summary.proteina,
      carbo: defaultVisual.summary.carbo,
      gordura: defaultVisual.summary.gordura
    },
    observacoes: [defaultVisual.observation]
  }, { source: 'visual_prescription_default' });
}

function readLocalActiveDietPlan() {
  var plan = safeJSON(KRONIA_ACTIVE_DIET_PLAN_KEY, null);
  return plan && plan.meals ? recalculateDietPlan(plan) : null;
}

function setActiveDietPlan(plan, options) {
  window._kroniaDietPlan = recalculateDietPlan(plan);
  try { localStorage.setItem(KRONIA_ACTIVE_DIET_PLAN_KEY, JSON.stringify(window._kroniaDietPlan)); } catch (_) {}
  if (!options || options.render !== false) renderActiveDietPlan();
  return window._kroniaDietPlan;
}

function schedulePersistActiveDietPlan() {
  if (_dietPlanPersistTimer) clearTimeout(_dietPlanPersistTimer);
  _dietPlanPersistTimer = setTimeout(function() {
    _dietPlanPersistTimer = null;
    try { saveActiveDietPlan({ silent: true }); } catch (_) {}
  }, 250);
}

async function loadActiveDietPlanFromSupabase() {
  try {
    if (!_sb || !_sb.auth) return null;
    var sessionResp = await _sb.auth.getSession();
    var userId = sessionResp && sessionResp.data && sessionResp.data.session && sessionResp.data.session.user && sessionResp.data.session.user.id;
    if (!userId) return null;
    var planResp = await _sb.from('meal_plans')
      .select('id,title,description,status,created_at,updated_at,plan_data,context_snapshot')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (planResp.error && /plan_data|context_snapshot/i.test(String(planResp.error.message || ''))) {
      planResp = await _sb.from('meal_plans')
        .select('id,title,description,status,created_at,updated_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }
    if (planResp.error || !planResp.data) return null;
    if (planResp.data.plan_data && typeof planResp.data.plan_data === 'object' && Array.isArray(planResp.data.plan_data.meals)) {
      return recalculateDietPlan(Object.assign({}, planResp.data.plan_data, {
        id: planResp.data.id,
        source: 'supabase_meal_plans',
        contextSnapshot: planResp.data.context_snapshot || planResp.data.plan_data.contextSnapshot || null
      }));
    }
    // Formato antigo: plan_data tem refeicoes (não meals)
    if (planResp.data.plan_data && typeof planResp.data.plan_data === 'object' && Array.isArray(planResp.data.plan_data.refeicoes) && planResp.data.plan_data.refeicoes.length) {
      var legacyConverted = normalizeDietGeneratedPlan(Object.assign({}, planResp.data.plan_data, {
        id: planResp.data.id,
        source: 'supabase_meal_plans'
      }), { source: 'supabase_meal_plans' });
      if (legacyConverted && Array.isArray(legacyConverted.meals) && legacyConverted.meals.some(function(m) { return Array.isArray(m.items) && m.items.length > 0; })) {
        return legacyConverted;
      }
    }
    var itemsResp = await _sb.from('meal_plan_items')
      .select('id,meal_name,time_hint,food_name,quantity,unit,calories,protein_g,carbs_g,fat_g,notes,sort_order')
      .eq('meal_plan_id', planResp.data.id)
      .order('sort_order', { ascending: true });
    if (itemsResp.error) return null;
    var grouped = {};
    (itemsResp.data || []).forEach(function(row, idx) {
      var key = row.meal_name || 'Refeição';
      if (!grouped[key]) grouped[key] = { name: key, time: row.time_hint || '', slot: normalizeDietFoodText(key), items: [] };
      grouped[key].items.push(normalizeDietEditorItem({
        id: row.id,
        nome: row.food_name,
        quantity: [row.quantity, row.unit].filter(Boolean).join(' '),
        calorias: row.calories,
        proteinas: row.protein_g,
        carboidratos: row.carbs_g,
        gorduras: row.fat_g,
        notes: row.notes,
        sourceType: 'saved'
      }, idx + 1));
    });
    return recalculateDietPlan({
      id: planResp.data.id,
      title: planResp.data.title || 'Plano alimentar ativo',
      status: 'active',
      source: 'supabase_meal_plans',
      meals: Object.keys(grouped).map(function(key, idx) { return Object.assign({ id: 'meal_' + (idx + 1) }, grouped[key]); })
    });
  } catch (_) {
    return null;
  }
}

async function saveActiveDietPlan(options) {
  var opts = options && typeof options === 'object' ? options : {};
  var plan = recalculateDietPlan(window._kroniaDietPlan || readLocalActiveDietPlan() || buildFallbackActiveDietPlan());
  if (opts.contextSnapshot) plan.contextSnapshot = opts.contextSnapshot;
  if (opts.generatedPlan) plan.rawGeneratedPlan = opts.generatedPlan;
  setActiveDietPlan(plan, { render: false });
  var savedRemote = false;
  try {
    var sessionResp = await _sb.auth.getSession();
    var userId = sessionResp && sessionResp.data && sessionResp.data.session && sessionResp.data.session.user && sessionResp.data.session.user.id;
    if (userId) {
      await _sb.from('meal_plans').update({ status: 'archived' }).eq('user_id', userId).eq('status', 'active');
      var planPayload = {
        user_id: userId,
        title: plan.title || 'Plano alimentar KRONIA',
        description: 'Plano editável salvo pelo editor de dieta KRONIA',
        status: 'active',
        plan_data: plan,
        context_snapshot: opts.contextSnapshot || plan.contextSnapshot || null
      };
      var planInsert = await _sb.from('meal_plans').insert(planPayload).select('id').single();
      if (planInsert.error && /plan_data|context_snapshot/i.test(String(planInsert.error.message || ''))) {
        delete planPayload.plan_data;
        delete planPayload.context_snapshot;
        planInsert = await _sb.from('meal_plans').insert(planPayload).select('id').single();
      }
      if (!planInsert.error && planInsert.data) {
        var rows = [];
        plan.meals.forEach(function(meal, mealIndex) {
          (meal.items || []).forEach(function(item, itemIndex) {
            rows.push({
              meal_plan_id: planInsert.data.id,
              meal_name: meal.name,
              time_hint: meal.time || null,
              food_name: item.name,
              quantity: item.quantity || (item.grams ? String(item.grams) : null),
              unit: item.grams ? 'g' : null,
              calories: item.kcal,
              protein_g: item.protein,
              carbs_g: item.carbs,
              fat_g: item.fat,
              notes: item.notes || null,
              sort_order: (mealIndex + 1) * 100 + itemIndex
            });
          });
        });
        if (rows.length) await _sb.from('meal_plan_items').insert(rows);
        plan.id = planInsert.data.id;
        savedRemote = true;
      }
    }
  } catch (_) {}
  setActiveDietPlan(Object.assign({}, plan, { source: savedRemote ? 'supabase_meal_plans' : 'local_storage' }));
  if (!opts.silent) showToast(savedRemote ? 'Dieta salva como versão ativa.' : 'Dieta salva localmente. Entre na conta para sincronizar.', savedRemote ? 'success' : 'info', 3200);
  return Object.assign({}, plan, { source: savedRemote ? 'supabase_meal_plans' : 'local_storage' });
}

function getDietFoodEmoji(item) {
  var name = normalizeDietFoodText(item && item.name || "");
  if (/ovo|omelete|mexido/.test(name)) return "🍳";
  if (/pao|torrada|aveia|granola/.test(name)) return "🍞";
  if (/frango|carne|patinho|peixe|atum/.test(name)) return "🍗";
  if (/arroz|feijao|batata|mandioca|macarrao/.test(name)) return "🍚";
  if (/banana|maca|fruta|mamao|laranja/.test(name)) return "🍌";
  if (/salada|brocolis|cenoura|tomate|vegetal/.test(name)) return "🥗";
  if (/iogurte|leite|queijo|whey/.test(name)) return "🥛";
  return "🍽️";
}

function getDietDisplayGrams(item) {
  if (item && asKroniaNumber(item.grams, 0) > 0) return asKroniaNumber(item.grams, 100);
  var quantity = String(item && item.quantity || '');
  var match = quantity.match(/(\d+(?:[.,]\d+)?)\s*(g|gramas)\b/i);
  return match ? asKroniaNumber(match[1], 100) : 100;
}

function getDietPlanSequenceText(plan) {
  var visual = plan && plan.visualPrescription && typeof plan.visualPrescription === 'object' ? plan.visualPrescription : null;
  var map = visual && visual.sequence && typeof visual.sequence === 'object' ? visual.sequence : {};
  var objective = normalizeDietFoodText(plan && plan.objective || '');
  if (/emagrec|defin|cut/.test(objective)) return map.emagrecimento || 'Proteína -> legumes -> salada -> arroz e feijão';
  if (/hipertrof|massa|ganho|forca/.test(objective)) return map.ganho_massa || 'Arroz e feijão -> proteína -> legumes -> salada';
  return map.manutencao || 'Proteína -> arroz e feijão -> legumes -> salada';
}

function getDietMacroTarget(plan, key, fallback) {
  var targets = plan && plan.targets && typeof plan.targets === 'object' ? plan.targets : {};
  return asKroniaNumber(targets[key], fallback || 0);
}

function getDietDisplayKcalTotal(plan, renderableMeals) {
  var visualTotal = (renderableMeals || []).reduce(function(acc, meal) {
    return acc + asKroniaNumber(meal && meal.subtotal && meal.subtotal.kcal, 0);
  }, 0);
  if (visualTotal > 0) return dietRound(visualTotal, 0);
  return dietRound(plan && plan.totals && plan.totals.kcal, 0);
}

function renderPremiumMacroBar(label, current, target, className) {
  var c = asKroniaNumber(current, 0);
  var t = Math.max(asKroniaNumber(target, 1), 1);
  var pct = Math.max(0, Math.min(100, Math.round((c / t) * 100)));
  return '<div class="tp-premium-macro-bar ' + escapeHTML(className || '') + '">'
    + '<div class="tp-premium-macro-line"><span>' + escapeHTML(label) + '</span><strong>' + escapeHTML(formatKroniaNumber(c, 'g')) + ' / ' + escapeHTML(formatKroniaNumber(t, 'g')) + '</strong></div>'
    + '<div class="tp-premium-macro-track"><div style="width:' + pct + '%"></div></div>'
    + '</div>';
}

function renderPremiumCalorieCard(plan, renderableMeals, targets) {
  var kcalTarget = Math.max(asKroniaNumber(targets.kcal, 2100), 1);
  var consumed = getDietDisplayKcalTotal(plan, renderableMeals);
  var remaining = Math.max(0, kcalTarget - consumed);
  var pct = Math.max(0, Math.min(100, Math.round((consumed / kcalTarget) * 100)));
  var circumference = 2 * Math.PI * 42;
  var dash = dietRound((pct / 100) * circumference, 1);
  var isMockPlan = plan.source !== 'supabase_meal_plans';
  var proteinCurrent = isMockPlan ? 125 : (plan.totals && plan.totals.protein > 0 ? plan.totals.protein : Math.round(targets.protein * pct / 100));
  var carbsCurrent = isMockPlan ? 180 : (plan.totals && plan.totals.carbs > 0 ? plan.totals.carbs : Math.round(targets.carbs * pct / 100));
  var fatCurrent = isMockPlan ? 55 : (plan.totals && plan.totals.fat > 0 ? plan.totals.fat : Math.round(targets.fat * pct / 100));

  return '<div class="tp-premium-cal-card">'
    + '<div class="tp-premium-cal-head">'
    + '<div><span class="tp-summary-kicker">PAINEL CALÓRICO</span><h2>Meta diária</h2></div>'
    + '<span class="tp-premium-source">' + escapeHTML(plan.source === 'supabase_meal_plans' ? 'Supabase' : 'Mock seguro') + '</span>'
    + '</div>'
    + '<div class="tp-premium-cal-main">'
    + '<div class="tp-premium-ring" aria-label="' + pct + '% da meta">'
    + '<svg viewBox="0 0 100 100" role="img" aria-hidden="true">'
    + '<circle cx="50" cy="50" r="42" class="tp-ring-bg"></circle>'
    + '<circle cx="50" cy="50" r="42" class="tp-ring-fill" stroke-dasharray="' + dash + ' ' + circumference + '"></circle>'
    + '</svg>'
    + '<div><strong>' + pct + '%</strong><span>da meta</span></div>'
    + '</div>'
    + '<div class="tp-premium-cal-stats">'
    + '<div><span>Meta</span><strong>' + escapeHTML(formatKroniaNumber(kcalTarget, 'kcal')) + '</strong></div>'
    + '<div><span>Consumido</span><strong>' + escapeHTML(formatKroniaNumber(consumed, 'kcal')) + '</strong></div>'
    + '<div><span>Restante</span><strong>' + escapeHTML(formatKroniaNumber(remaining, 'kcal')) + '</strong></div>'
    + '</div>'
    + '</div>'
    + '<div class="tp-premium-macro-bars">'
    + renderPremiumMacroBar('Proteína', proteinCurrent, targets.protein, 'tp-premium-macro--protein')
    + renderPremiumMacroBar('Carboidratos', carbsCurrent, targets.carbs, 'tp-premium-macro--carbs')
    + renderPremiumMacroBar('Gorduras', fatCurrent, targets.fat, 'tp-premium-macro--fat')
    + '</div>'
    + '<button type="button" class="tp-rebalancear-btn tp-rebalancear-btn--compact" onclick="recalculateDietWithKronos()">'
    + '<i data-lucide="refresh-cw" width="18" height="18" stroke-width="2"></i>Rebalancear automaticamente'
    + '</button>'
    + '</div>';
}

function switchDietMiniAppView(view) {
  openDietCorePanel(view === 'plano' ? 'minha-dieta' : view);
}

function openDietCorePanel(view) {
  var target = view || 'home';
  var already = _dietCoreView === target;
  _dietCoreView = target;
  if (!already) renderActiveDietPlan();
}

function dietDataBackNav() {
  if (_dietCoreView && _dietCoreView !== 'home') {
    openDietCorePanel('home');
  } else {
    try { navTo('inicio'); openHome(); } catch(_) {}
  }
}

function openDietMiniLabsScreen() {
  _labsReturnDietMiniChrome = document.getElementById('dietDataScreen')?.classList.contains('show') || false;
  setDietMiniAppChrome(false);
  openLabsUploadScreen('diet_core_panel');
}

function getNextDietMeal(renderableMeals) {
  var now = new Date();
  var currentMinutes = now.getHours() * 60 + now.getMinutes();
  var meals = (renderableMeals || []).slice();
  var next = meals.find(function(meal) {
    var match = String(meal.time || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) return false;
    return Number(match[1]) * 60 + Number(match[2]) >= currentMinutes;
  });
  return next || meals[0] || null;
}

function renderDietBackHeader(title) {
  return '';
}

function renderDietNowCard(vm) {
  var meal = vm.currentMeal || {};
  var foods = (meal.foods || []).slice(0, 3);
  var subtotal = meal.subtotal || {};
  return '<section class="diet-now-card">'
    + '<div class="diet-now-head"><span class="tp-summary-kicker">O que comer agora</span><strong>' + escapeHTML(meal.time || 'Hoje') + '</strong></div>'
    + '<h2>' + escapeHTML(meal.name || 'Próxima refeição') + '</h2>'
    + '<div class="diet-now-foods diet-now-foods--list">' + (foods.length ? foods.map(function(food) {
      return '<span>' + escapeHTML(food.name) + '<strong>' + escapeHTML(food.quantity || '') + '</strong></span>';
    }).join('') : '<span>Plano pronto para ser gerado <strong>KRONOS</strong></span>') + '</div>'
    + '<div class="diet-now-macros"><span>P ' + escapeHTML(formatKroniaNumber(subtotal.protein || 0, 'g')) + '</span><span>C ' + escapeHTML(formatKroniaNumber(subtotal.carbs || 0, 'g')) + '</span><span>G ' + escapeHTML(formatKroniaNumber(subtotal.fat || 0, 'g')) + '</span></div>'
    + '<div class="diet-mini-actions"><button type="button" onclick="openDietCorePanel(\'minha-dieta\')"><i data-lucide="eye" width="16" height="16"></i>Ver refeição</button></div>'
    + '</section>';
}

function renderDietProgressCard(vm) {
  var p = vm.dailyProgress || {};
  var cal = p.calories || {};
  var pct = Math.max(0, Math.min(100, Math.round(asKroniaNumber(cal.current, 0) / Math.max(asKroniaNumber(cal.target, 1), 1) * 100)));
  var circumference = 2 * Math.PI * 42;
  var dash = dietRound((pct / 100) * circumference, 1);
  return '<section class="diet-resumo-card">'
    + '<span class="tp-summary-kicker diet-resumo-kicker">RESUMO DO DIA</span>'
    + '<div class="diet-resumo-kcal-row">'
    + '<div class="diet-resumo-kcal-col"><span class="diet-resumo-kcal-label">Consumido</span><strong class="diet-resumo-kcal-value">' + escapeHTML(formatKroniaNumber(cal.current, 'kcal')) + '</strong></div>'
    + '<div class="diet-resumo-kcal-col"><span class="diet-resumo-kcal-label">Meta</span><strong class="diet-resumo-kcal-value">' + escapeHTML(formatKroniaNumber(cal.target, 'kcal')) + '</strong></div>'
    + '</div>'
    + '<div class="diet-resumo-main">'
    + '<div class="tp-premium-ring diet-resumo-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" class="tp-ring-bg"></circle><circle cx="50" cy="50" r="42" class="tp-ring-fill" stroke-dasharray="' + dash + ' ' + circumference + '"></circle></svg><div><strong>' + pct + '%</strong><span>da meta</span></div></div>'
    + '<div class="diet-resumo-macros">'
    + renderResumoDiaMacroBar('Proteína', 'dumbbell', p.protein && p.protein.current, p.protein && p.protein.target, 'tp-premium-macro--protein')
    + renderResumoDiaMacroBar('Carboidratos', 'wheat', p.carbs && p.carbs.current, p.carbs && p.carbs.target, 'tp-premium-macro--carbs')
    + renderResumoDiaMacroBar('Gorduras', 'droplets', p.fat && p.fat.current, p.fat && p.fat.target, 'tp-premium-macro--fat')
    + '</div>'
    + '</div>'
    + '<button type="button" class="tp-rebalancear-btn tp-rebalancear-btn--compact" onclick="recalculateDietWithKronos()"><i data-lucide="refresh-cw" width="16" height="16"></i>Rebalancear automaticamente<i data-lucide="chevron-right" width="16" height="16" style="margin-left:auto"></i></button>'
    + '</section>';
}

function renderResumoDiaMacroBar(label, icon, current, target, className) {
  var c = asKroniaNumber(current, 0);
  var t = Math.max(asKroniaNumber(target, 1), 1);
  var pct = Math.max(0, Math.min(100, Math.round((c / t) * 100)));
  return '<div class="diet-resumo-macro-item ' + escapeHTML(className || '') + '">'
    + '<div class="diet-resumo-macro-head">'
    + '<span class="diet-resumo-macro-icon-wrap"><i data-lucide="' + escapeHTML(icon) + '" width="14" height="14"></i></span>'
    + '<span class="diet-resumo-macro-name">' + escapeHTML(label) + '</span>'
    + '<span class="diet-resumo-macro-vals">' + escapeHTML(formatKroniaNumber(c, 'g')) + ' / ' + escapeHTML(formatKroniaNumber(t, 'g')) + '</span>'
    + '</div>'
    + '<div class="tp-premium-macro-track"><div style="width:' + pct + '%"></div></div>'
    + '</div>';
}

function renderDietActionCards(vm) {
  return '<section class="diet-action-grid">' + vm.actionCards.map(function(card) {
    return '<button type="button" class="diet-action-card" onclick="openDietCorePanel(\'' + escapeAttr(card.key) + '\')"><div><i data-lucide="' + escapeAttr(card.icon) + '" width="22" height="22"></i></div><span><strong>' + escapeHTML(card.title) + '</strong><small>' + escapeHTML(card.description) + '</small></span><i data-lucide="chevron-right" width="18" height="18"></i></button>';
  }).join('') + '</section>';
}

function renderDietCompactChoiceCards() {
  var existingPlan = typeof readLocalActiveDietPlan === 'function' ? readLocalActiveDietPlan() : null;
  var hasPlan = existingPlan && Array.isArray(existingPlan.meals) && existingPlan.meals.length > 0;
  var iaLabel = hasPlan ? 'Regerar plano' : 'Gerar agora';
  var manualLabel = hasPlan ? 'Editar dieta' : 'Criar dieta';
  var iaIcon = hasPlan ? 'refresh-cw' : 'sparkles';
  return '<div class="diet-compact-choice-row">'
    + '<div class="diet-compact-choice-card diet-compact-choice-card--green" onclick="startAIDiet()">'
    + '<div class="diet-compact-choice-icon diet-compact-choice-icon--green">'
    + '<i data-lucide="brain-circuit" width="28" height="28" stroke="#22C55E" fill="none" stroke-width="1.5"></i>'
    + '</div>'
    + '<div class="diet-compact-choice-text">'
    + '<strong>Dieta com IA</strong>'
    + '<span>Plano alimentar inteligente e automático</span>'
    + '</div>'
    + '<button type="button" class="diet-compact-action-btn diet-compact-action-btn--green" onclick="event.stopPropagation();startAIDiet()">'
    + '<i data-lucide="' + iaIcon + '" width="12" height="12"></i> ' + iaLabel + ' <i data-lucide="chevron-right" width="12" height="12"></i>'
    + '</button>'
    + '</div>'
    + '<div class="diet-compact-choice-card diet-compact-choice-card--orange" onclick="startManualDiet()">'
    + '<div class="diet-compact-choice-icon diet-compact-choice-icon--orange">'
    + '<i data-lucide="clipboard-edit" width="28" height="28" stroke="#F97316" fill="none" stroke-width="1.5"></i>'
    + '</div>'
    + '<div class="diet-compact-choice-text">'
    + '<strong>Montar Manualmente</strong>'
    + '<span>Monte sua dieta do seu jeito</span>'
    + '</div>'
    + '<button type="button" class="diet-compact-action-btn diet-compact-action-btn--orange" onclick="event.stopPropagation();startManualDiet()">'
    + '<i data-lucide="pencil" width="12" height="12"></i> ' + manualLabel + ' <i data-lucide="chevron-right" width="12" height="12"></i>'
    + '</button>'
    + '</div>'
    + '</div>';
}

function renderDietMealPreviewsSection(vm) {
  var meals = vm.meals || [];
  if (!meals.length) {
    return '<section class="diet-refeicoes-section">'
      + '<div class="diet-section-row-head">'
      + '<span class="tp-summary-kicker">REFEIÇÕES DE HOJE</span>'
      + '</div>'
      + '<div class="diet-meals-empty">'
      + '<i data-lucide="utensils-crossed" width="32" height="32" stroke="rgba(148,163,184,.35)"></i>'
      + '<p>Nenhuma refeição ainda.<br>Gere um plano com IA ou monte manualmente.</p>'
      + '<button type="button" class="diet-responder-btn" onclick="startAIDiet()"><i data-lucide="sparkles" width="14" height="14"></i> Gerar plano agora</button>'
      + '</div>'
      + '</section>';
  }
  var mealCards = meals.slice(0, 5).map(function(meal) {
    var p = dietRound(asKroniaNumber(meal.subtotal && meal.subtotal.protein, 0), 1);
    var c = dietRound(asKroniaNumber(meal.subtotal && meal.subtotal.carbs, 0), 1);
    var g = dietRound(asKroniaNumber(meal.subtotal && meal.subtotal.fat, 0), 1);
    var kcal = asKroniaNumber(meal.subtotal && meal.subtotal.kcal, 0);
    return '<div class="diet-meal-preview-card" onclick="openDietCorePanel(\'minha-dieta\')">'
      + '<div class="diet-meal-preview-main">'
      + '<div class="diet-meal-preview-info">'
      + '<h4 class="diet-meal-preview-name">' + escapeHTML(meal.name || 'Refeição') + '</h4>'
      + (meal.time ? '<span class="diet-meal-preview-time">' + escapeHTML(meal.time) + '</span>' : '')
      + '</div>'
      + '<div class="diet-meal-preview-right">'
      + '<span class="diet-meal-preview-kcal">' + (kcal > 0 ? escapeHTML(formatKroniaNumber(kcal, 'kcal')) : '—') + '</span>'
      + '<i data-lucide="chevron-right" width="16" height="16" stroke="rgba(148,163,184,.5)"></i>'
      + '</div>'
      + '</div>'
      + '<div class="diet-meal-preview-macros">'
      + '<span class="diet-macro-dot diet-macro-dot--blue"></span>'
      + '<span class="diet-macro-label">P: ' + escapeHTML(formatKroniaNumber(p, 'g')) + '</span>'
      + '<span class="diet-macro-dot diet-macro-dot--green"></span>'
      + '<span class="diet-macro-label">C: ' + escapeHTML(formatKroniaNumber(c, 'g')) + '</span>'
      + '<span class="diet-macro-dot diet-macro-dot--yellow"></span>'
      + '<span class="diet-macro-label">G: ' + escapeHTML(formatKroniaNumber(g, 'g')) + '</span>'
      + '</div>'
      + '</div>';
  }).join('');
  return '<section class="diet-refeicoes-section">'
    + '<div class="diet-section-row-head">'
    + '<span class="tp-summary-kicker">REFEIÇÕES DE HOJE</span>'
    + '<button type="button" class="diet-ver-horarios-btn" onclick="openDietCorePanel(\'minha-dieta\')">'
    + '<i data-lucide="calendar" width="13" height="13"></i>Ver por horários</button>'
    + '</div>'
    + '<div class="k-stagger">' + mealCards + '</div>'
    + '</section>';
}

function renderDietHome(vm) {
  return '<div class="diet-core-view">'
    + renderDietCompactChoiceCards()
    + renderDietProgressCard(vm)
    + renderDietMealPreviewsSection(vm)
    + renderDietAdaptationCard(vm)
    + renderDietActionCards(vm)
    + '</div>';
}

function renderDietAdaptiveStatusCard(vm) {
  var memory = vm.memory || readNutritionMemory();
  var score = asKroniaNumber(memory.personalization_score, 0);
  var statusText = memory.plan_status === 'personalizado'
    ? 'Plano personalizado com base no seu perfil e comportamento recente.'
    : 'Plano inicial gerado com dados limitados.';
  return '<section class="diet-adaptive-card diet-adaptive-card--status">'
    + '<div class="diet-adaptive-card-head"><span>Personalização atual</span><strong>' + score + '%</strong></div>'
    + '<div class="diet-adaptive-progress"><div style="width:' + Math.max(0, Math.min(100, score)) + '%"></div></div>'
    + '<p>' + escapeHTML(statusText) + ' Complete sua anamnese para melhorar precisão e adesão.</p>'
    + '<div class="diet-adaptive-tags"><span>' + escapeHTML(memory.plan_status === 'personalizado' ? 'Personalizado' : 'Provisório') + '</span><span>' + escapeHTML(memory.confidence_level || 'baixo') + '</span></div>'
    + '</section>';
}

function renderDietChipGroup(title, chips, memory) {
  return '<div class="diet-chip-group">'
    + '<span class="diet-chip-group-title">' + escapeHTML(title) + '</span>'
    + '<div class="diet-chip-group-chips">'
    + chips.map(function(chip) {
        var selected = memory && chip.isSelected ? chip.isSelected(memory) : false;
        return '<button type="button" class="diet-chip' + (selected ? ' selected' : '') + '" onclick="' + chip.action + '">' + escapeHTML(chip.label) + '</button>';
      }).join('')
    + '</div>'
    + '</div>';
}

function renderDietProgressiveAnamnesisCard(vm) {
  var memory = vm.memory || readNutritionMemory();
  var missing = (memory.missing_fields || []).length;
  var score = memory.personalization_score || 0;

  if (score >= 80 && missing === 0) {
    return '<section class="diet-adaptive-card diet-complete-card diet-profile-done">'
      + '<div class="diet-adaptive-card-head">'
      + '<span class="tp-summary-kicker">PERFIL DA DIETA</span>'
      + '<strong class="diet-profile-done-badge"><i data-lucide="check-circle" width="13" height="13"></i> Completo</strong>'
      + '</div>'
      + '<p class="diet-profile-done-text">Personalização em ' + escapeHTML(String(score)) + '%. Seu perfil alimentar está completo — a IA usa seus dados para ajustes automáticos.</p>'
      + '<button type="button" class="diet-pular-btn" style="margin-top:8px" onclick="openNutritionProgressiveAnamnesis()">Editar preferências</button>'
      + '</section>';
  }

  return '<section class="diet-adaptive-card diet-complete-card">'
    + '<div class="diet-adaptive-card-head">'
    + '<span class="tp-summary-kicker">COMPLETE SUA DIETA</span>'
    + '<strong class="diet-pendencias-badge">' + escapeHTML(String(missing || 7)) + ' pendências</strong>'
    + '</div>'
    + '<p>Personalização atual: ' + escapeHTML(String(score)) + '%. Responda perguntas rápidas sem formulário grande.</p>'
    + renderDietChipGroup('QUANTIDADE DE REFEIÇÕES', [
        { label: '3 refeições', action: "toggleDietChip('preferred_meal_count','3')", isSelected: function(m) { return Number(m.preferred_meal_count) === 3; } },
        { label: '4 refeições', action: "toggleDietChip('preferred_meal_count','4')", isSelected: function(m) { return Number(m.preferred_meal_count) === 4; } },
        { label: '5 refeições', action: "toggleDietChip('preferred_meal_count','5')", isSelected: function(m) { return Number(m.preferred_meal_count) === 5; } }
      ], memory)
    + renderDietChipGroup('EQUIPAMENTOS', [
        { label: 'Tenho balança', action: "toggleDietChip('has_food_scale','true')", isSelected: function(m) { return m.has_food_scale === true; } },
        { label: 'Sem balança',   action: "toggleDietChip('has_food_scale','false')", isSelected: function(m) { return m.has_food_scale === false; } }
      ], memory)
    + renderDietChipGroup('ESTILO DA DIETA', [
        { label: 'Simples',      action: "toggleDietChip('preferred_diet_style','simples')",   isSelected: function(m) { return m.preferred_diet_style === 'simples'; } },
        { label: 'Econômica',   action: "toggleDietChip('preferred_diet_style','econômica')", isSelected: function(m) { return m.preferred_diet_style === 'econômica'; } },
        { label: 'Variada',     action: "toggleDietChip('preferred_diet_style','variada')",   isSelected: function(m) { return m.preferred_diet_style === 'variada'; } },
        { label: 'Marmita',     action: "toggleDietChip('preferred_diet_style','marmita')",   isSelected: function(m) { return m.preferred_diet_style === 'marmita'; } },
        { label: 'Flexível',    action: "toggleDietChip('preferred_diet_style','flexível')",  isSelected: function(m) { return m.preferred_diet_style === 'flexível'; } },
        { label: 'Treino manhã', action: "toggleDietChip('workout_time','manhã')",            isSelected: function(m) { return m.workout_time === 'manhã'; } },
        { label: 'Treino noite', action: "toggleDietChip('workout_time','noite')",            isSelected: function(m) { return m.workout_time === 'noite'; } },
        { label: 'Fome à noite', action: "toggleDietChip('hunger_period','noite')",           isSelected: function(m) { return m.hunger_period === 'noite'; } }
      ], memory)
    + '<button type="button" class="diet-ver-mais-btn" onclick="this.style.display=\'none\'">'
    + '<i data-lucide="plus-circle" width="14" height="14"></i> Ver mais opções'
    + '</button>'
    + '<div class="diet-complete-actions">'
    + '<button type="button" class="diet-responder-btn" onclick="openNutritionProgressiveAnamnesis()">Responder agora</button>'
    + '<button type="button" class="diet-pular-btn" onclick="skipNutritionAnamnesisAndGenerate()">Pular por enquanto</button>'
    + '</div>'
    + '</section>';
}

function renderDietDailyFeedbackCard() {
  return '<section class="diet-adaptive-card diet-feedback-card">'
    + '<div class="diet-adaptive-card-head">'
    + '<span class="tp-summary-kicker">COMO FOI SUA DIETA HOJE?</span>'
    + '<strong class="diet-feedback-label">Feedback</strong>'
    + '</div>'
    + '<button type="button" class="diet-feedback-primary" onclick="registerDailyNutritionFeedback(\'adherent\')">'
    + '<span class="diet-feedback-check"><i data-lucide="check-circle" width="22" height="22" stroke="#22C55E" fill="none" stroke-width="2"></i></span>'
    + 'Comi conforme o plano'
    + '</button>'
    + '<div class="diet-feedback-secondary-grid">'
    + '<button type="button" class="diet-feedback-secondary" onclick="registerDailyNutritionFeedback(\'swapped\')">'
    + '<i data-lucide="arrow-right-left" width="16" height="16" stroke="#F97316"></i> Troquei alimentos'
    + '</button>'
    + '<button type="button" class="diet-feedback-secondary" onclick="registerDailyNutritionFeedback(\'skipped\')">'
    + '<i data-lucide="clock" width="16" height="16" stroke="#818CF8"></i> Pulei refeição'
    + '</button>'
    + '</div>'
    + '<button type="button" class="diet-feedback-other" onclick="registerDailyNutritionFeedback(\'hungry\')">'
    + '<i data-lucide="badge-alert" width="17" height="17" stroke="#FBBF24"></i> Ainda fiquei com fome'
    + '</button>'
    + '<button type="button" class="diet-feedback-other" onclick="registerDailyNutritionFeedback(\'difficult\')">'
    + '<i data-lucide="frown" width="17" height="17" stroke="#F87171"></i> Muito difícil de seguir'
    + '</button>'
    + '</section>';
}

function renderDietAdaptationCard(vm) {
  var adaptations = Array.isArray(vm.adaptations) ? vm.adaptations : [];
  if (!adaptations.length) return '';
  return '<section class="diet-adaptive-card diet-adaptive-card--pattern">'
    + '<div class="diet-adaptive-card-head"><span>KroniA percebeu um padrão</span><strong>' + adaptations.length + '</strong></div>'
    + '<p>' + escapeHTML(adaptations[0].message) + '</p>'
    + '<div class="diet-adaptive-actions"><button onclick="applyDietAdaptiveSuggestion()">Aplicar ajuste</button><button onclick="dismissDietAdaptiveSuggestion()">Não agora</button></div>'
    + '</section>';
}

function renderDietPlanPanel(vm) {
  return '<div class="diet-core-view diet-core-view--plan">' + renderDietBackHeader('Minha Dieta')
    + vm.meals.map(function(meal, index) { return renderDietMealCard(vm.plan.meals[index] || meal, index); }).join('')
    + '<button type="button" class="tp-rebalancear-btn tp-rebalancear-btn--compact" onclick="recalculateDietWithKronos()"><i data-lucide="refresh-cw" width="16" height="16"></i>Rebalancear automaticamente<i data-lucide="chevron-right" width="16" height="16" style="margin-left:auto"></i></button></div>';
}

function renderDietSubstitutionPanel(vm) {
  var firstMeal = vm.plan.meals && vm.plan.meals[0];
  var firstItem = firstMeal && firstMeal.items && firstMeal.items[0];
  var options = getDietSubstitutionOptions(firstItem || {});
  return '<div class="diet-core-view">' + renderDietBackHeader('Trocar alimento')
    + '<section class="diet-mini-title-card"><p>Busque ou escolha uma troca equivalente. O motor preserva os macros da refeição.</p><input class="diet-search-input" placeholder="Buscar alimento" aria-label="Buscar alimento"></section>'
    + '<div class="diet-sub-options">' + options.map(function(opt, index) {
      return '<button type="button" class="diet-sub-option" onclick="selectDietMiniSubstitutionCandidate(' + index + ')"><span>' + escapeHTML(opt.name) + '</span><small class="diet-sub-quantity-line">' + escapeHTML(formatFoodQuantityLine(opt)) + '</small>' + renderFoodMacrosLineHtml(opt, 'diet-sub-macro-line') + '<strong>Compatibilidade ' + (index === 0 ? '94' : '88') + '%</strong></button>';
    }).join('') + '</div><button type="button" class="tp-rebalancear-btn" onclick="applyDietMiniSubstitution()"><i data-lucide="check" width="18" height="18"></i>Aplicar troca</button></div>';
}

function selectDietMiniSubstitutionCandidate(index) {
  if (!window._dietSubstState) window._dietSubstState = { mealIndex: 0, itemIndex: 0, selectedOption: null };
  window._dietSubstState.selectedOption = index;
  document.querySelectorAll('#dietDataScreen .diet-sub-option').forEach(function(btn, i) { btn.classList.toggle('selected', i === index); });
}

function renderDietProgressPanel(vm) {
  return '<div class="diet-core-view">' + renderDietBackHeader('Progresso nutricional')
    + '<section class="diet-mini-card diet-adherence-card"><div class="tp-premium-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" class="tp-ring-bg"></circle><circle cx="50" cy="50" r="42" class="tp-ring-fill" stroke-dasharray="230 264"></circle></svg><div><strong>' + escapeHTML(String(vm.progress.adherence)) + '%</strong><span>adesão</span></div></div><div>' + renderPremiumMacroBar('Calorias', vm.dailyProgress.calories.current, vm.dailyProgress.calories.target, 'tp-premium-macro--carbs') + renderPremiumMacroBar('Proteína', vm.dailyProgress.protein.current, vm.dailyProgress.protein.target, 'tp-premium-macro--protein') + '</div></section>'
    + '<section class="diet-mini-card"><div class="diet-mini-card-head"><span>Peso</span><strong>' + escapeHTML(vm.profile && vm.profile.peso ? vm.profile.peso + 'kg' : '--') + '</strong></div><svg class="diet-line-chart" viewBox="0 0 240 80"><polyline points="8,20 60,28 112,42 164,38 232,48" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 20 L60 28 L112 42 L164 38 L232 48 L232 80 L8 80 Z" fill="rgba(34,197,94,.14)"/></svg><p class="diet-mini-muted">' + escapeHTML(vm.progress.insight) + '</p></section>'
    + '<section class="diet-mini-card"><div class="diet-mini-card-head"><span>Streak</span><strong>' + escapeHTML(String(vm.progress.streak)) + ' dias</strong></div><p class="diet-mini-muted">Sequência nutricional ativa.</p></section></div>';
}

function renderDietLabsPanel(vm) {
  var alerts = vm.labs.alerts || [];
  return '<div class="diet-core-view">' + renderDietBackHeader('Exames')
    + '<section class="diet-mini-title-card"><p>Fluxo real de exames do KroniA. Upload, análise e alertas nutricionais usam a vertical existente.</p><button type="button" class="tp-rebalancear-btn" onclick="openDietMiniLabsScreen()"><i data-lucide="upload-cloud" width="18" height="18"></i>Enviar exame</button></section>'
    + (alerts.length ? alerts.map(function(alert) { return '<section class="diet-mini-card"><div class="diet-mini-card-head"><span>Alerta nutricional</span><strong>Atenção</strong></div><p class="diet-mini-muted">' + escapeHTML(alert) + '</p></section>'; }).join('') : '<section class="diet-mini-card"><div class="diet-mini-card-head"><span>Exames</span><strong>Sem alerta</strong></div><p class="diet-mini-muted">Nenhum alerta nutricional crítico disponível para o plano atual.</p></section>')
    + '</div>';
}

function renderDietProfilePanel(vm) {
  var profile = vm.profile || {};
  return '<div class="diet-core-view">' + renderDietBackHeader('Perfil alimentar')
    + '<section class="diet-mini-card"><div class="diet-mini-card-head"><span>' + escapeHTML(profile.nome || 'Atleta') + '</span><strong>' + escapeHTML(getObjectiveLabel(profile.objetivo)) + '</strong></div><div class="diet-profile-grid">'
    + '<div><span>Peso</span><strong>' + escapeHTML(profile.peso ? profile.peso + 'kg' : '--') + '</strong></div>'
    + '<div><span>Altura</span><strong>' + escapeHTML(profile.altura ? profile.altura + 'cm' : '--') + '</strong></div>'
    + '<div><span>Meta calórica</span><strong>' + escapeHTML(formatKroniaNumber(vm.dailyProgress.calories.target, 'kcal')) + '</strong></div>'
    + '<div><span>Fonte</span><strong>' + escapeHTML(vm.context && vm.context.source || 'local') + '</strong></div></div></section>'
    + '<section class="diet-mini-card"><div class="diet-mini-card-head"><span>Preferências e restrições</span><button type="button" onclick="navTo(\'perfil\');openPerfil()">Alterar objetivo</button></div><p class="diet-mini-muted">' + escapeHTML([].concat(profile.preferencias_alimentares || [], profile.restricoes || []).filter(Boolean).join(', ') || 'Sem restrições registradas.') + '</p></section></div>';
}

function renderDietCoreContent(view, vm) {
  if (view === 'minha-dieta' || view === 'plano') return renderDietPlanPanel(vm);
  if (view === 'trocar-alimento' || view === 'substituir') return renderDietSubstitutionPanel(vm);
  if (view === 'check-in-semanal') return '<div class="diet-core-view">' + renderDietBackHeader('Check-in semanal') + '<section class="diet-adaptive-card"><div class="diet-adaptive-card-head"><span>Check-in da semana</span><strong>5 perguntas</strong></div><p>Peso atual, dias de adesão, fome média, energia no treino e direção do ajuste.</p><div class="diet-adaptive-actions"><button onclick="openWeeklyNutritionCheckin()">Responder check-in</button></div></section></div>';
  if (view === 'progresso') return renderDietProgressPanel(vm);
  if (view === 'exames') return renderDietLabsPanel(vm);
  if (view === 'perfil') return renderDietProfilePanel(vm);
  return renderDietHome(vm);
}

function getDietVisualReasons(plan) {
  var visual = plan && plan.visualPrescription && typeof plan.visualPrescription === 'object' ? plan.visualPrescription : null;
  var reasons = visual && Array.isArray(visual.reasons) ? visual.reasons.filter(Boolean) : [];
  if (reasons.length) return reasons.slice(0, 3);
  return [
    'Proteínas aparecem ao longo do dia para sustentar recuperação e saciedade.',
    'Carboidratos foram organizados perto das refeições mais estratégicas.',
    'O plano usa alimentos simples para aumentar constância.'
  ];
}

function getDietVisualGuidance(plan) {
  var visual = plan && plan.visualPrescription && typeof plan.visualPrescription === 'object' ? plan.visualPrescription : null;
  var guidance = visual && Array.isArray(visual.guidance) ? visual.guidance.filter(Boolean) : [];
  return guidance.length ? guidance.slice(0, 5) : buildDefaultDietVisualPrescription().guidance.slice();
}

function openDietVisualSubstitutions() {
  var plan = window._kroniaDietPlan || readLocalActiveDietPlan() || buildFallbackActiveDietPlan();
  var visual = plan && plan.visualPrescription && typeof plan.visualPrescription === 'object' ? plan.visualPrescription : buildDefaultDietVisualPrescription();
  var groups = normalizeDietVisualSubstitutions(visual.substitutions);
  var hasAnyGroup = Object.keys(groups).some(function(key) { return groups[key].length; });
  if (!hasAnyGroup) {
    showToast('As substituições aparecem quando o motor gerar equivalências para a dieta ativa.', 'info', 3000);
    return;
  }
  var existing = document.getElementById('dietSubstitutionsSheet');
  if (existing) existing.remove();
  var sheet = document.createElement('div');
  sheet.id = 'dietSubstitutionsSheet';
  sheet.className = 'bottom-sheet show diet-add-item-sheet';
  sheet.dataset.theme = resolveKroniaThemeForDieta();
  sheet.onclick = function(event) { if (event.target === sheet) sheet.remove(); };
  sheet.innerHTML = '<div class="bs-box" style="max-height:88vh;overflow-y:auto"><div class="bs-handle"></div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div><div class="bs-title">Substituições</div><div class="bs-sub">Trocas equivalentes por grupo alimentar.</div></div><button class="bs-close" onclick="document.getElementById(&quot;dietSubstitutionsSheet&quot;)?.remove()">×</button></div>'
    + Object.keys(groups).map(function(key) {
      var label = key === 'proteinas' ? 'Proteínas' : key === 'carboidratos' ? 'Carboidratos' : key === 'leguminosas' ? 'Leguminosas' : 'Legumes';
      return '<section class="diet-section-block"><h3 class="diet-section-title">' + escapeHTML(label) + '</h3>'
        + groups[key].map(function(item) { return '<div class="diet-section-row"><span>' + escapeHTML(item) + '</span></div>'; }).join('')
        + '</section>';
    }).join('')
    + '</div>';
  document.body.appendChild(sheet);
}

function registerDietWater() {
  var tracker = safeJSON(KRONIA_DIET_WATER_TRACKER_KEY, {});
  var today = new Date().toISOString().slice(0, 10);
  var next = Math.min(6, Number(tracker[today] || 0) + 1);
  tracker[today] = next;
  try { localStorage.setItem(KRONIA_DIET_WATER_TRACKER_KEY, JSON.stringify(tracker)); } catch (_) {}
  showToast('Água registrada: ' + next + ' copo(s) hoje.', 'success', 2200);
}

async function openDietShoppingList() {
  var plan = window._kroniaDietPlan || readLocalActiveDietPlan() || buildFallbackActiveDietPlan();
  var lines = [];
  (plan.meals || []).forEach(function(meal) {
    (meal.items || []).forEach(function(item) {
      var label = [item.name, item.quantity].filter(Boolean).join(' - ');
      if (label && lines.indexOf(label) === -1) lines.push(label);
    });
  });
  if (!lines.length) {
    showToast('Nenhum alimento disponível para lista de compras.', 'info', 2600);
    return;
  }
  var text = ['Lista de compras - KRONIA'].concat(lines.map(function(item) { return '- ' + item; })).join('\n');
  try { if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text); } catch (_) {}
  await dlgAlert(text);
}

function getDietItemMacroCategory(item) {
  var group = normalizeDietFoodText(item && (item.groupKey || item.group_key || item.category || item.categoria || ''));
  if (/prote/.test(group)) return 'protein';
  if (/carbo|fruta|leguminosa/.test(group)) return 'carbs';
  if (/gord|fat|oleo|azeite|castanha|abacate/.test(group)) return 'fat';
  var p = asKroniaNumber(item && item.protein, 0);
  var c = asKroniaNumber(item && item.carbs, 0);
  var f = asKroniaNumber(item && item.fat, 0);
  if (p >= c && p >= f) return 'protein';
  if (c >= f) return 'carbs';
  return 'fat';
}

function scaleDietItemByMacro(item, macro, factor) {
  var grams = Math.max(20, Math.min(500, Math.round(getDietDisplayGrams(item) * factor)));
  return normalizeDietEditorItem(Object.assign({}, item, {
    grams: grams,
    gramas: grams,
    quantity: grams + ' g',
    porcao: grams + ' g'
  }), item && item.order || 1);
}

function applyDietRebalanceEngine(plan) {
  var next = recalculateDietPlan(plan || buildFallbackActiveDietPlan());
  var changed = false;
  var targets = next.targets || {};
  var mealCount = Math.max((next.meals || []).length, 1);
  var macroTargets = {
    protein: asKroniaNumber(targets.protein, next.totals && next.totals.protein || 160) / mealCount,
    carbs: asKroniaNumber(targets.carbs, next.totals && next.totals.carbs || 210) / mealCount,
    fat: asKroniaNumber(targets.fat, next.totals && next.totals.fat || 62) / mealCount
  };

  next.meals = (next.meals || []).map(function(meal) {
    var balanced = Object.assign({}, meal, { items: (meal.items || []).slice() });
    ['protein', 'carbs', 'fat'].forEach(function(macro) {
      var subtotal = balanced.items.reduce(function(sum, item) {
        return sum + asKroniaNumber(item && item[macro], 0);
      }, 0);
      var target = macroTargets[macro];
      var tolerance = macro === 'carbs' ? 8 : 4;
      if (!subtotal || !target || Math.abs(target - subtotal) <= tolerance) return;
      var index = balanced.items.findIndex(function(item) {
        return getDietItemMacroCategory(item) === macro && asKroniaNumber(item && item[macro], 0) > 0;
      });
      if (index < 0) return;
      var factor = Math.max(0.65, Math.min(1.45, target / subtotal));
      balanced.items[index] = scaleDietItemByMacro(balanced.items[index], macro, factor);
      changed = true;
    });
    return balanced;
  });

  return { plan: recalculateDietPlan(next), changed: changed };
}

function recalculateDietWithKronos() {
  var result = applyDietRebalanceEngine(window._kroniaDietPlan || readLocalActiveDietPlan() || buildFallbackActiveDietPlan());
  setActiveDietPlan(result.plan);
  schedulePersistActiveDietPlan();
  showToast(result.changed ? 'Dieta rebalanceada pelo motor de macros.' : 'Dieta já estava dentro da margem segura.', result.changed ? 'success' : 'info', 2800);
}

function _tpMealSlotIcon(slot) {
  var s = String(slot || '').toLowerCase();
  if (s.includes('cafe') || s.includes('manha') || s.includes('breakfast')) return 'sun';
  if (s.includes('almoco') || s.includes('lunch') || s.includes('pre_treino') || s.includes('pre-treino')) return 'utensils';
  if (s.includes('lanche') || s.includes('snack') || s.includes('coffee')) return 'coffee';
  if (s.includes('jantar') || s.includes('dinner') || s.includes('ceia') || s.includes('supper')) return 'moon';
  return 'utensils';
}

function _tpMealSlotColorClass(slot) {
  var s = String(slot || '').toLowerCase();
  if (s.includes('jantar') || s.includes('ceia') || s.includes('dinner') || s.includes('supper') || s.includes('lanche') || s.includes('snack')) return 'tp-meal-icon--purple';
  return 'tp-meal-icon--orange';
}

function _tpMealStatusBadge(mealTime) {
  if (!mealTime) return '<span class="tp-badge tp-badge--pending">Pendente</span>';
  var now = new Date();
  var cur = now.getHours() * 60 + now.getMinutes();
  var m = String(mealTime).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '<span class="tp-badge tp-badge--pending">Pendente</span>';
  var mt = parseInt(m[1]) * 60 + parseInt(m[2]);
  if (cur > mt + 60) return '<span class="tp-badge tp-badge--done">Concluído</span>';
  if (cur >= mt - 90 && cur <= mt + 60) return '<span class="tp-badge tp-badge--next">Próxima</span>';
  return '<span class="tp-badge tp-badge--pending">Pendente</span>';
}

function toggleTpMealBody(idx) {
  var el = document.getElementById('tpMealBody_' + idx);
  if (!el) return;
  var card = el.previousElementSibling;
  var row = el.closest ? el.closest('.tp-meal-row') : el.parentElement;
  var isOpen = el.classList.toggle('tp-meal-body--open');
  if (card) card.classList.toggle('tp-meal-header-card--open', isOpen);
  if (row) row.classList.toggle('tp-meal-row--open', isOpen);
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(_) {}
}

function expandAllTpMeals() {
  var idx = 0;
  while (true) {
    var el = document.getElementById('tpMealBody_' + idx);
    if (!el) break;
    el.classList.add('tp-meal-body--open');
    var card = el.previousElementSibling;
    if (card) card.classList.add('tp-meal-header-card--open');
    var row = el.closest ? el.closest('.tp-meal-row') : el.parentElement;
    if (row) row.classList.add('tp-meal-row--open');
    idx++;
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(_) {}
}

function getDietMacroValue(source, keys) {
  var safeSource = source && typeof source === 'object' ? source : {};
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (safeSource[key] == null || safeSource[key] === '') continue;
    var value = asKroniaNumber(safeSource[key], NaN);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function getDietKcalValue(source) {
  return getDietMacroValue(source, ['kcal', 'calories', 'calorias']);
}

function getDietProteinValue(source) {
  return getDietMacroValue(source, ['protein', 'proteinas', 'proteína', 'prot', 'protein_g']);
}

function getDietCarbsValue(source) {
  return getDietMacroValue(source, ['carbs', 'carboidratos', 'carbo', 'carb', 'carbs_g']);
}

function getDietFatValue(source) {
  return getDietMacroValue(source, ['fat', 'gorduras', 'gordura', 'gord', 'fat_g']);
}

function getDietFiberValue(source) {
  return getDietMacroValue(source, ['fiber', 'fibra', 'fibras', 'fiber_g']);
}

function formatFoodDisplayNumber(value) {
  var rounded = Math.round(asKroniaNumber(value, 0) * 10) / 10;
  return rounded.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function normalizeFoodQuantityText(quantity) {
  var text = String(quantity == null || quantity === '' ? '0 g' : quantity).trim();
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|ml|l|unid\.?|unidade(?:s)?|un)\b/gi, function(_, value, unit) {
    return formatFoodDisplayNumber(String(value).replace(',', '.')) + ' ' + unit;
  });
  return text.replace(/\s+/g, ' ').trim() || '0 g';
}

function getFoodDisplayQuantity(item) {
  var safeItem = item && typeof item === 'object' ? item : {};
  var quantity = safeItem.quantity || safeItem.qtde || safeItem.porcao || safeItem.household_measure || safeItem.default_unit || safeItem.medida || '';
  if (!quantity && asKroniaNumber(safeItem.grams || safeItem.gramas || safeItem.default_portion_g || safeItem.porcao_gramas, 0) > 0) {
    quantity = formatFoodDisplayNumber(safeItem.grams || safeItem.gramas || safeItem.default_portion_g || safeItem.porcao_gramas) + ' g';
  }
  return normalizeFoodQuantityText(quantity);
}

function getFoodDisplayValue(item, keys) {
  var safeItem = item && typeof item === 'object' ? item : {};
  var value = getDietMacroValue(safeItem, keys);
  return Number.isFinite(value) ? value : 0;
}

function formatFoodQuantityLine(item) {
  var kcal = getFoodDisplayValue(item, ['kcal', 'calories', 'calorias', 'energia_kcal', 'kcal_100g', 'kcal_por_100g']);
  return getFoodDisplayQuantity(item) + ' · ' + formatFoodDisplayNumber(kcal) + ' kcal';
}

function formatFoodMacrosLine(item) {
  var carbs = getFoodDisplayValue(item, ['carbs', 'carboidratos', 'carboidrato', 'carbo', 'carb', 'carbs_g', 'carbs_100g', 'carbo_por_100g']);
  var protein = getFoodDisplayValue(item, ['protein', 'proteinas', 'proteína', 'proteina', 'prot', 'protein_g', 'protein_100g', 'proteina_por_100g']);
  var fat = getFoodDisplayValue(item, ['fat', 'gorduras', 'gordura', 'gord', 'fat_g', 'fat_100g', 'gordura_por_100g']);
  return 'C: ' + formatFoodDisplayNumber(carbs) + ' g  P: ' + formatFoodDisplayNumber(protein) + ' g  G: ' + formatFoodDisplayNumber(fat) + ' g';
}

function renderFoodMacrosLineHtml(item, className) {
  var parts = formatFoodMacrosLine(item).split('  ');
  return '<p class="' + escapeAttr(className || 'diet-food-macro-line') + '">'
    + parts.map(function(part) { return '<span>' + escapeHTML(part) + '</span>'; }).join('  ')
    + '</p>';
}

function formatDietPdfMacro(value, suffix) {
  return asKroniaNumber(value, 0) > 0 ? formatKroniaNumber(value, suffix || 'g') : '0 ' + (suffix || 'g');
}

function renderDietMacroSummaryCard(plan, targets) {
  var safeTargets = targets || {};
  var totals = plan && plan.totals || {};
  var kcal = asKroniaNumber(totals.kcal, 0) || asKroniaNumber(safeTargets.kcal, 0);
  var protein = asKroniaNumber(totals.protein, 0) || asKroniaNumber(safeTargets.protein, 0);
  var carbs = asKroniaNumber(totals.carbs, 0) || asKroniaNumber(safeTargets.carbs, 0);
  var fat = asKroniaNumber(totals.fat, 0) || asKroniaNumber(safeTargets.fat, 0);
  var macroCalories = Math.max((protein * 4) + (carbs * 4) + (fat * 9), 1);
  function percent(value, factor) {
    return Math.round((Math.max(asKroniaNumber(value, 0), 0) * factor / macroCalories) * 100);
  }
  var fiber = asKroniaNumber(totals.fiber, 0) || asKroniaNumber(safeTargets.fiber, 0);
  return '<section class="diet-macro-summary-card" aria-label="Resumo de macros da dieta">'
    + '<div class="diet-macro-kcal"><strong>' + escapeHTML(formatKroniaNumber(kcal, 'kcal')) + '</strong><span>Total do plano</span></div>'
    + '<div class="diet-macro-summary-list">'
    + '<div><span>Proteína</span><strong>' + escapeHTML(formatKroniaNumber(protein, 'g')) + '</strong><em>' + percent(protein, 4) + '%</em></div>'
    + '<div><span>Carboidrato</span><strong>' + escapeHTML(formatKroniaNumber(carbs, 'g')) + '</strong><em>' + percent(carbs, 4) + '%</em></div>'
    + '<div><span>Gordura</span><strong>' + escapeHTML(formatKroniaNumber(fat, 'g')) + '</strong><em>' + percent(fat, 9) + '%</em></div>'
    + '<div><span>Fibra</span><strong>' + escapeHTML(formatKroniaNumber(fiber, 'g')) + '</strong></div>'
    + '</div>'
    + '</section>';
}

function buildDietItemSubtitle(item) {
  return formatFoodQuantityLine(item);
}

function renderDietMealCard(meal, mealIndex) {
  var subtotal = meal.subtotal || {};
  var items = (meal.items || []).map(function(item, itemIndex) {
    var subtitle = buildDietItemSubtitle(item);
    var grams = getDietDisplayGrams(item);
    var bsArgs = mealIndex + ',' + itemIndex + ',' + escapeAttr(JSON.stringify(item.name || 'Alimento')) + ',' + escapeAttr(JSON.stringify(subtitle)) + ',' + escapeAttr(JSON.stringify(String(Math.round(grams))));
    return '<div class="tp-food-row">'
      + '<button type="button" class="tp-food-main" onclick="abrirBottomSheet(' + bsArgs + ')">'
      + '<div class="tp-food-info">'
      + '<p class="diet-premium-food-name">' + escapeHTML(item.name || getDietItemName(item)) + '</p>'
      + '<p class="diet-premium-food-qty">' + escapeHTML(formatFoodQuantityLine(item)) + '</p>'
      + renderFoodMacrosLineHtml(item, 'tp-food-macros')
      + '</div>'
      + '</button>'
      + '<div class="tp-food-actions">'
      + '<button type="button" class="tp-food-edit-btn" onclick="abrirBottomSheet(' + bsArgs + ')" title="Editar">Editar</button>'
      + '<button type="button" class="tp-food-remove-btn" onclick="removeDietItemDirect(' + mealIndex + ',' + itemIndex + ')" title="Remover">−</button>'
      + '</div>'
      + '</div>';
  }).join('');
  var itemCount = (meal.items || []).length;
  var statusBadge = _tpMealStatusBadge(meal.time);
  var kcalText = asKroniaNumber(subtotal.kcal, 0) > 0 ? formatKroniaNumber(subtotal.kcal, 'kcal') : '— kcal';
  var mealP = dietRound(asKroniaNumber(subtotal.protein, 0), 1);
  var mealC = dietRound(asKroniaNumber(subtotal.carbs,   0), 1);
  var mealG = dietRound(asKroniaNumber(subtotal.fat,     0), 1);
  var mealMacros = (mealP > 0 || mealC > 0 || mealG > 0)
    ? '<p class="tp-meal-macros">' + escapeHTML(formatFoodMacrosLine({ carbs: mealC, protein: mealP, fat: mealG })) + '</p>'
    : '';
  var loadingState = meal._loading
    ? '<div class="tp-meal-loading"><div class="tp-meal-loading-spinner"></div>IA recalculando ' + escapeHTML(meal.name || 'refeição') + '...</div>'
    : '';
  return '<div class="tp-meal-row">'
    + '<div class="tp-meal-header-card" onclick="toggleTpMealBody(' + mealIndex + ')">'
    + '<div class="tp-meal-header-left">'
    + '<div class="tp-meal-info">'
    + (meal.time ? '<span class="tp-meal-time">' + escapeHTML(meal.time) + '</span>' : '')
    + '<h3 class="tp-meal-name">' + escapeHTML(meal.name || 'Refeição') + '</h3>'
    + '<p class="tp-meal-meta">' + escapeHTML(kcalText) + ' · ' + itemCount + (itemCount === 1 ? ' item' : ' itens') + '</p>'
    + mealMacros
    + '</div>'
    + '</div>'
    + '<div class="tp-meal-header-right">'
    + statusBadge
    + '</div>'
    + '</div>'
    + '<div id="tpMealBody_' + mealIndex + '" class="tp-meal-body">'
    + (loadingState || '')
    + '<div class="tp-meal-foods">' + (items || '<div class="diet-premium-empty"><p>Nenhum item adicionado.</p></div>') + '</div>'
    + '<div class="tp-meal-footer-row">'
    + '<button type="button" class="diet-premium-add" style="flex:1" onclick="openDietAddItemSheet(' + mealIndex + ')">Adicionar alimento</button>'
    + '<button type="button" class="tp-meal-ai-btn" onclick="openKronosFromDieta(\'Ajustar esta refeição mantendo os macros do plano salvo.\')">KRONOS</button>'
    + '</div>'
    + '</div>'
    + '</div>';
}

function renderActiveDietPlan() {
  var plan = recalculateDietPlan(window._kroniaDietPlan || readLocalActiveDietPlan() || buildFallbackActiveDietPlan());
  window._kroniaDietPlan = plan;
  var visual = plan.visualPrescription && typeof plan.visualPrescription === 'object' ? plan.visualPrescription : buildDefaultDietVisualPrescription();
  var renderableMeals = getDietRenderableMeals(plan);
  var summary = document.getElementById('dietDataSummary');
  var progress = document.getElementById('dietDataProgress');
  var meals = document.getElementById('dietDataMeals');
  var target = plan.targets || {};
  var kcalTarget = target.kcal || plan.totals.kcal || 2200;
  var proteinTarget = target.protein || Math.max(plan.totals.protein, 1);
  var carbsTarget = target.carbs || Math.max(plan.totals.carbs, 1);
  var fatTarget = target.fat || Math.max(plan.totals.fat, 1);
  // For plans without prescription data (old saved plans), compute fresh baseline from current profile
  var freshPresc = null;
  if (!plan.presc || !plan.presc.tmb) {
    try {
      var _flowState = getNutritionFlowState();
      if (_flowState && Number(_flowState.peso || 0) > 0) {
        var _fb = computeDietGenerationBaseline({
          peso: Number(_flowState.peso), altura: Number(_flowState.altura || 175),
          idade: Number(_flowState.idade || 25), sexo: _flowState.sexo || 'masculino',
          gorduraCorporal: Number(_flowState.gorduraCorporal || 0),
          nivelAtividade: _flowState.nivelAtividade || 'levemente ativo',
          objetivo: plan.objective || _flowState.objetivo || 'hipertrofia'
        });
        if (_fb && _fb.metaCalorias > 0) {
          freshPresc = { tmb: _fb.tmb, tdee: _fb.tdee };
          kcalTarget = _fb.metaCalorias;
          proteinTarget = _fb.proteinaMeta;
          carbsTarget = _fb.carboMeta;
          fatTarget = _fb.gorduraMeta;
        }
      }
    } catch (_) {}
  }
  if (plan.source !== 'supabase_meal_plans') {
    kcalTarget = 2100;
    proteinTarget = 160;
    carbsTarget = 230;
    fatTarget = 75;
  }
  function pct(current, expected) {
    return Math.max(0, Math.min(100, Math.round(asKroniaNumber(current, 0) / Math.max(asKroniaNumber(expected, 1), 1) * 100)));
  }
  // AI-generated plans store per-item macros as 0 (text-only items); fall back to targets
  var displayProtein = plan.totals.protein > 0 ? plan.totals.protein : proteinTarget;
  var displayCarbs   = plan.totals.carbs   > 0 ? plan.totals.carbs   : carbsTarget;
  var displayFat     = plan.totals.fat     > 0 ? plan.totals.fat     : fatTarget;
  var premiumTargets = {
    kcal: kcalTarget,
    protein: proteinTarget,
    carbs: carbsTarget,
    fat: fatTarget
  };
  var hasCoreViewModel = typeof analyzeDietContext === 'function' && typeof generateDietViewModel === 'function' && typeof renderDietCoreContent === 'function';
  var viewModel = null;
  if (hasCoreViewModel) {
    var dietContext = analyzeDietContext();
    dietContext.activeDiet = Object.assign({}, plan, { targets: premiumTargets });
    dietContext.macroTargets = premiumTargets;
    viewModel = generateDietViewModel(dietContext);
  }
  if (summary) {
    var activeViewForSummary = typeof _dietCoreView !== 'undefined' ? _dietCoreView : 'home';
    summary.innerHTML = activeViewForSummary === 'minha-dieta' || activeViewForSummary === 'plano'
      ? renderDietMacroSummaryCard(plan, Object.assign({}, premiumTargets, { fiber: plan.totals && plan.totals.fiber || 0 }))
      : '';
  }
  if (meals) {
    meals.innerHTML = hasCoreViewModel
      ? renderDietCoreContent(_dietCoreView, viewModel)
      : renderableMeals.map(function(meal, index) { return renderDietMealCard(meal, index); }).join('');
  }
  var presc = plan.presc || freshPresc || {};
  if (progress) {
    var activeCoreView = typeof _dietCoreView !== 'undefined' ? _dietCoreView : 'home';
    var reasonRows = getDietVisualReasons(plan).map(function(reason) {
      return '<li>' + escapeHTML(reason) + '</li>';
    }).join('');
    var guidanceRows = getDietVisualGuidance(plan).slice(0, 3).map(function(note) {
      return '<li>' + escapeHTML(note) + '</li>';
    }).join('');
    progress.innerHTML = activeCoreView === 'home' ? '<div class="tp-why-card">'
      + '<div class="tp-why-header">'
      + '<div class="tp-why-icon"><i data-lucide="brain" width="24" height="24" stroke-width="1.5"></i></div>'
      + '<div><span class="tp-summary-kicker">POR QUE SUA DIETA ESTÁ ASSIM?</span>'
      + '<button type="button" class="tp-summary-details-btn" onclick="openKronosFromDieta()">Entenda mais</button></div>'
      + '</div>'
      + '<ul class="tp-why-list">' + (reasonRows || '<li>' + escapeHTML(visual.dashboard && visual.dashboard.subtitle || 'Plano personalizado para seu perfil.') + '</li>') + '</ul>'
      + (guidanceRows ? '<ul class="tp-why-list tp-why-list--guidance">' + guidanceRows + '</ul>' : '')
      + '</div>' : '';
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
}

async function refreshDietDataScreen() {
  var remotePlan = await loadActiveDietPlanFromSupabase();
  if (!remotePlan) return;
  var local = window._kroniaDietPlan;
  var sameId = local && remotePlan.id && local.id === remotePlan.id;
  if (!sameId) setActiveDietPlan(remotePlan);
}

function getDietSheetState() {
  return window._dietPremiumSheetState || null;
}

function setDietSheetWeight(grams) {
  var weight = document.getElementById('bs-peso');
  var nextGrams = Math.max(1, Math.round(asKroniaNumber(grams, 100)));
  if (weight) weight.innerText = String(nextGrams);
  if (window._dietPremiumSheetState) window._dietPremiumSheetState.grams = nextGrams;
  return nextGrams;
}

function adjustDietSheetWeight(delta) {
  var state = getDietSheetState() || {};
  setDietSheetWeight(asKroniaNumber(state.grams, 100) + delta);
}

function saveDietSheetItem() {
  var state = getDietSheetState();
  if (!state) return fecharBottomSheet();
  updateDietPlanItem(state.mealIndex, state.itemIndex, 'grams', state.grams);
  fecharBottomSheet();
}

function removeDietSheetItem() {
  var state = getDietSheetState();
  if (!state) return fecharBottomSheet();
  removeDietPlanItem(state.mealIndex, state.itemIndex);
  fecharBottomSheet();
}

function removeDietItemDirect(mealIndex, itemIndex) {
  removeDietPlanItem(mealIndex, itemIndex);
}

function openDietSubstituirScreen(mealIndex, itemIndex) {
  fecharBottomSheet();
  var plan = window._kroniaDietPlan || buildFallbackActiveDietPlan();
  var meal = plan.meals && plan.meals[mealIndex];
  var item = meal && meal.items && meal.items[itemIndex];
  if (!item) return;
  window._dietSubstState = { mealIndex: mealIndex, itemIndex: itemIndex, selectedOption: null };

  var titleEl = document.getElementById('dsSubstituirTitle');
  var nameEl  = document.getElementById('dsSubstituirItemName');
  if (titleEl) titleEl.textContent = getDietSubstitutionGroupLabel(item);
  if (nameEl)  nameEl.textContent  = item.name || getDietItemName(item);

  var alternatives = getDietSubstitutionOptions(item);
  var listEl = document.getElementById('dsOptionsList');
  if (listEl) {
    if (!alternatives.length) {
      listEl.innerHTML = '<p class="ds-empty">Nenhuma alternativa disponível para este alimento.</p>';
    } else {
      listEl.innerHTML = alternatives.map(function(opt, i) {
        return '<div class="ds-option-card" onclick="selectDietSubstitutionOption(' + i + ')" id="dsOpt_' + i + '">'
          + '<div class="ds-option-emoji">' + getDietFoodEmoji(opt) + '</div>'
          + '<div class="ds-option-info">'
          + '<p class="ds-option-name">' + escapeHTML(opt.name) + '</p>'
          + '<p class="ds-option-meta">' + escapeHTML(formatFoodQuantityLine(opt)) + '</p>'
          + renderFoodMacrosLineHtml(opt, 'ds-option-macros')
          + '</div>'
          + '</div>';
      }).join('');
    }
  }
  var screen = document.getElementById('dietSubstituirScreen');
  if (screen) _showEl(screen);
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
}

function selectDietSubstitutionOption(optionIndex) {
  if (!window._dietSubstState) return;
  window._dietSubstState.selectedOption = optionIndex;
  var cards = document.querySelectorAll('#dsOptionsList .ds-option-card');
  cards.forEach(function(c, i) { c.classList.toggle('selected', i === optionIndex); });
}

function closeDietSubstituirScreen() {
  var screen = document.getElementById('dietSubstituirScreen');
  if (screen) screen.classList.remove('show');
  window._dietSubstState = null;
}

var _DS_GROUPS = {
  proteina: {
    label: 'Substituir proteína',
    options: [
      { name: 'Frango grelhado',       quantity: '130g',           kcal: 143, protein: 30, carbs: 0,  fat: 3  },
      { name: 'Patinho grelhado',      quantity: '120g',           kcal: 168, protein: 29, carbs: 0,  fat: 8  },
      { name: 'Alcatra grelhada',      quantity: '120g',           kcal: 192, protein: 26, carbs: 0,  fat: 10 },
      { name: 'Tilápia grelhada',      quantity: '150g',           kcal: 165, protein: 35, carbs: 0,  fat: 4  },
      { name: 'Salmão grelhado',       quantity: '100g',           kcal: 180, protein: 25, carbs: 0,  fat: 10 },
      { name: 'Atum em água',          quantity: '120g',           kcal: 132, protein: 29, carbs: 0,  fat: 1  },
      { name: 'Sardinha em água',      quantity: '100g',           kcal: 140, protein: 24, carbs: 0,  fat: 5  },
      { name: 'Camarão grelhado',      quantity: '150g',           kcal: 150, protein: 30, carbs: 2,  fat: 2  },
      { name: 'Peito de peru',         quantity: '120g',           kcal: 108, protein: 24, carbs: 0,  fat: 1  },
      { name: 'Ovo cozido',            quantity: '3 unidades',     kcal: 222, protein: 18, carbs: 1,  fat: 15 },
      { name: 'Clara de ovo',          quantity: '5 unidades',     kcal: 85,  protein: 18, carbs: 1,  fat: 0  },
      { name: 'Tofu firme grelhado',   quantity: '150g',           kcal: 114, protein: 12, carbs: 3,  fat: 6  },
      { name: 'Frango desfiado',       quantity: '100g',           kcal: 110, protein: 23, carbs: 0,  fat: 3  }
    ]
  },
  carboidrato: {
    label: 'Substituir carboidrato',
    options: [
      { name: 'Arroz branco cozido',   quantity: '120g',           kcal: 156, protein: 3,  carbs: 34, fat: 0  },
      { name: 'Arroz integral cozido', quantity: '120g',           kcal: 157, protein: 3,  carbs: 33, fat: 1  },
      { name: 'Batata-doce cozida',    quantity: '150g',           kcal: 155, protein: 2,  carbs: 36, fat: 0  },
      { name: 'Batata inglesa cozida', quantity: '150g',           kcal: 117, protein: 3,  carbs: 27, fat: 0  },
      { name: 'Mandioca cozida',       quantity: '150g',           kcal: 195, protein: 2,  carbs: 47, fat: 0  },
      { name: 'Inhame cozido',         quantity: '150g',           kcal: 177, protein: 2,  carbs: 42, fat: 0  },
      { name: 'Macarrão integral',     quantity: '80g',            kcal: 280, protein: 10, carbs: 54, fat: 2  },
      { name: 'Tapioca',               quantity: '70g',            kcal: 238, protein: 0,  carbs: 59, fat: 0  },
      { name: 'Pão integral',          quantity: '2 fatias (50g)', kcal: 130, protein: 5,  carbs: 24, fat: 2  },
      { name: 'Pão francês',           quantity: '1 unidade (50g)',kcal: 150, protein: 4,  carbs: 30, fat: 1  },
      { name: 'Aveia em flocos',       quantity: '40g',            kcal: 158, protein: 6,  carbs: 26, fat: 3  },
      { name: 'Quinoa cozida',         quantity: '120g',           kcal: 144, protein: 5,  carbs: 25, fat: 2  },
      { name: 'Cuscuz de milho',       quantity: '120g',           kcal: 144, protein: 3,  carbs: 30, fat: 1  }
    ]
  },
  gordura: {
    label: 'Substituir gordura',
    options: [
      { name: 'Azeite de oliva',       quantity: '10g',            kcal: 88,  protein: 0,  carbs: 0,  fat: 10 },
      { name: 'Azeite de coco',        quantity: '10g',            kcal: 88,  protein: 0,  carbs: 0,  fat: 10 },
      { name: 'Manteiga sem sal',      quantity: '10g',            kcal: 72,  protein: 0,  carbs: 0,  fat: 8  },
      { name: 'Abacate',               quantity: '60g',            kcal: 96,  protein: 1,  carbs: 1,  fat: 10 },
      { name: 'Castanha-do-pará',      quantity: '20g',            kcal: 132, protein: 3,  carbs: 1,  fat: 13 },
      { name: 'Castanha de caju',      quantity: '25g',            kcal: 142, protein: 4,  carbs: 7,  fat: 12 },
      { name: 'Amêndoas',              quantity: '25g',            kcal: 144, protein: 5,  carbs: 3,  fat: 13 },
      { name: 'Nozes',                 quantity: '20g',            kcal: 130, protein: 3,  carbs: 2,  fat: 13 },
      { name: 'Amendoim torrado',      quantity: '30g',            kcal: 173, protein: 7,  carbs: 5,  fat: 14 },
      { name: 'Pasta de amendoim',     quantity: '20g',            kcal: 118, protein: 5,  carbs: 4,  fat: 10 }
    ]
  },
  vegetal: {
    label: 'Substituir vegetal',
    options: [
      { name: 'Brócolis cozido',       quantity: '100g',           kcal: 34,  protein: 3,  carbs: 5,  fat: 0  },
      { name: 'Abobrinha grelhada',    quantity: '150g',           kcal: 27,  protein: 2,  carbs: 5,  fat: 0  },
      { name: 'Aspargos grelhados',    quantity: '100g',           kcal: 20,  protein: 2,  carbs: 4,  fat: 0  },
      { name: 'Cenoura cozida',        quantity: '100g',           kcal: 41,  protein: 1,  carbs: 9,  fat: 0  },
      { name: 'Couve-flor cozida',     quantity: '100g',           kcal: 25,  protein: 2,  carbs: 5,  fat: 0  },
      { name: 'Vagem cozida',          quantity: '100g',           kcal: 35,  protein: 2,  carbs: 6,  fat: 0  },
      { name: 'Chuchu cozido',         quantity: '100g',           kcal: 19,  protein: 1,  carbs: 4,  fat: 0  },
      { name: 'Espinafre cozido',      quantity: '100g',           kcal: 23,  protein: 3,  carbs: 3,  fat: 0  },
      { name: 'Alface crua',           quantity: '100g',           kcal: 13,  protein: 1,  carbs: 2,  fat: 0  },
      { name: 'Tomate cru',            quantity: '100g',           kcal: 18,  protein: 1,  carbs: 4,  fat: 0  }
    ]
  },
  fruta: {
    label: 'Substituir fruta',
    options: [
      { name: 'Banana-prata',          quantity: '1 unid. (80g)',  kcal: 73,  protein: 1,  carbs: 19, fat: 0  },
      { name: 'Maçã',                  quantity: '1 unid. (130g)', kcal: 67,  protein: 0,  carbs: 17, fat: 0  },
      { name: 'Mamão formosa',         quantity: '150g',           kcal: 54,  protein: 1,  carbs: 13, fat: 0  },
      { name: 'Laranja',               quantity: '1 unid. (140g)', kcal: 65,  protein: 1,  carbs: 16, fat: 0  },
      { name: 'Morango',               quantity: '100g',           kcal: 32,  protein: 1,  carbs: 7,  fat: 0  },
      { name: 'Uva',                   quantity: '100g',           kcal: 69,  protein: 1,  carbs: 18, fat: 0  },
      { name: 'Manga',                 quantity: '100g',           kcal: 65,  protein: 1,  carbs: 17, fat: 0  },
      { name: 'Abacaxi',               quantity: '100g',           kcal: 48,  protein: 0,  carbs: 12, fat: 0  },
      { name: 'Melão',                 quantity: '200g',           kcal: 66,  protein: 1,  carbs: 16, fat: 0  }
    ]
  },
  leguminosa: {
    label: 'Substituir leguminosa',
    options: [
      { name: 'Feijão carioca cozido', quantity: '100g',           kcal: 76,  protein: 5,  carbs: 14, fat: 1  },
      { name: 'Feijão preto cozido',   quantity: '100g',           kcal: 80,  protein: 5,  carbs: 15, fat: 1  },
      { name: 'Lentilha cozida',       quantity: '100g',           kcal: 116, protein: 9,  carbs: 20, fat: 0  },
      { name: 'Grão-de-bico cozido',   quantity: '100g',           kcal: 164, protein: 9,  carbs: 27, fat: 3  },
      { name: 'Ervilha cozida',        quantity: '100g',           kcal: 81,  protein: 5,  carbs: 14, fat: 0  },
      { name: 'Soja cozida',           quantity: '100g',           kcal: 141, protein: 14, carbs: 9,  fat: 6  }
    ]
  },
  laticinios: {
    label: 'Substituir laticínio',
    options: [
      { name: 'Iogurte grego natural', quantity: '150g',           kcal: 88,  protein: 11, carbs: 5,  fat: 3  },
      { name: 'Cottage desnatado',     quantity: '100g',           kcal: 72,  protein: 12, carbs: 2,  fat: 1  },
      { name: 'Ricota fresca',         quantity: '80g',            kcal: 100, protein: 9,  carbs: 2,  fat: 6  },
      { name: 'Queijo minas frescal',  quantity: '50g',            kcal: 76,  protein: 7,  carbs: 1,  fat: 5  },
      { name: 'Leite desnatado',       quantity: '200ml',          kcal: 74,  protein: 7,  carbs: 10, fat: 0  }
    ]
  }
};

function classifyFoodGroup(item) {
  var name = normalizeDietFoodText(item && item.name || '');
  var protein = asKroniaNumber(item && item.protein, 0);
  var carbs   = asKroniaNumber(item && item.carbs,   0);
  var fat     = asKroniaNumber(item && item.fat,     0);
  var kcal    = asKroniaNumber(item && item.kcal,    0);

  if (/frango|patinho|alcatra|contra.?file|carne\b|bife|boi\b|suin|porco|peixe|tilapia|tilap|pescad|merluza|atum|sardinha|salmao|camarao|peru|ovo|clara|whey|proteina\b|tofu|frango.?desfiad/.test(name)) return 'proteina';
  if (/arroz|batata.?doce|batata\s*inglesa|batata\b|mandioca|macarrao|tapioca|pao\b|paes\b|aveia|granola|farelo|quinoa|cuscuz|inhame/.test(name)) return 'carboidrato';
  if (/azeite|oleo\b|manteiga|abacate|castanha|amendoim|pasta.?amendoim|amendo|nozes|amendoa/.test(name)) return 'gordura';
  if (/salada|alface|rucula|espinafre|brocolis|couve\b|tomate|pepino|abobrinha|cenoura|aspargo|vagem|chuchu|repolho|pepino|vegetal|legume/.test(name)) return 'vegetal';
  if (/banana|maca\b|laranja|mamao|manga\b|morango|uva\b|abacaxi|fruta\b|melon|melao|kiwi|caju\b/.test(name)) return 'fruta';
  if (/feijao|lentilha|grao.?de.?bico|ervilha|soja\b|leguminosa/.test(name)) return 'leguminosa';
  if (/iogurte|queijo|cottage|leite\b|ricota|laticinios/.test(name)) return 'laticinios';

  // fallback: classify by macro profile
  if (protein >= 15 || (protein > carbs && protein > fat && protein > 8)) return 'proteina';
  if (fat >= 8 && fat > carbs && fat > protein) return 'gordura';
  if (carbs >= 15 && carbs > protein * 2) return 'carboidrato';
  if (kcal < 60 && carbs < 12 && protein < 5) return 'vegetal';
  return 'proteina';
}

function getDietSubstitutionOptions(item) {
  var group = classifyFoodGroup(item);
  var groupData = _DS_GROUPS[group] || _DS_GROUPS.proteina;
  var currentName = normalizeDietFoodText(item && item.name || '');
  return groupData.options.filter(function(opt) {
    return normalizeDietFoodText(opt.name) !== currentName;
  });
}

function getDietSubstitutionGroupLabel(item) {
  var group = classifyFoodGroup(item);
  return (_DS_GROUPS[group] || _DS_GROUPS.proteina).label;
}

function applyDietSubstitution() {
  var state = window._dietSubstState;
  if (!state || state.selectedOption === null) {
    showToast('Selecione uma alternativa para substituir.', 'warn'); return;
  }
  var plan = window._kroniaDietPlan || buildFallbackActiveDietPlan();
  var meal = plan.meals && plan.meals[state.mealIndex];
  if (!meal || !meal.items || !meal.items[state.itemIndex]) {
    showToast('Item não encontrado.', 'warn'); return;
  }
  var options = getDietSubstitutionOptions(meal.items[state.itemIndex]);
  var chosenOpt = options[state.selectedOption];
  if (!chosenOpt) return;
  meal.items[state.itemIndex] = Object.assign({}, meal.items[state.itemIndex], chosenOpt);
  setActiveDietPlan(plan);
  schedulePersistActiveDietPlan();
  closeDietSubstituirScreen();
  showToast('Alimento substituído com sucesso!', 'success');
}

function applyDietMiniSubstitution() {
  var state = window._dietSubstState;
  if (state && state.selectedOption !== null) {
    applyDietSubstitution();
    return;
  }
  showToast('Troca aplicada mantendo categoria equivalente.', 'success', 2600);
  switchDietMiniAppView('plano');
}

function replaceDietSheetItem() {
  var state = getDietSheetState();
  if (state) {
    openDietSubstituirScreen(state.mealIndex, state.itemIndex);
  } else {
    fecharBottomSheet();
  }
}

function showDietSheetDetails() {
  var state = getDietSheetState();
  if (!state) return;
  showToast(state.title + ' · ' + state.subtitle, 'info', 3600);
}

function abrirBottomSheet(mealIndex, itemIndex, nome, subtitulo, peso) {
  syncDietaTheme(resolveKroniaThemeForDieta());
  var backdrop = document.getElementById('modalBackdrop');
  var bottomSheet = document.getElementById('bottomSheet');
  var title = document.getElementById('bs-title');
  var subtitle = document.getElementById('bs-subtitle');
  if (title) title.innerText = nome || 'Nome';
  if (subtitle) subtitle.innerText = subtitulo || 'Macros';
  window._dietPremiumSheetState = {
    mealIndex: Number(mealIndex) || 0,
    itemIndex: Number(itemIndex) || 0,
    title: nome || 'Alimento',
    subtitle: subtitulo || 'Macros',
    grams: Math.max(1, Math.round(asKroniaNumber(peso, 100)))
  };
  setDietSheetWeight(window._dietPremiumSheetState.grams);
  if (backdrop) backdrop.classList.add('open');
  if (bottomSheet) bottomSheet.classList.add('open');
  if (window._dietPremiumPrevBodyOverflow === undefined) window._dietPremiumPrevBodyOverflow = document.body.style.overflow || '';
  document.body.style.overflow = 'hidden';
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
}

function fecharBottomSheet() {
  var backdrop = document.getElementById('modalBackdrop');
  var bottomSheet = document.getElementById('bottomSheet');
  if (backdrop) backdrop.classList.remove('open');
  if (bottomSheet) bottomSheet.classList.remove('open');
  document.body.style.overflow = window._dietPremiumPrevBodyOverflow || '';
  window._dietPremiumPrevBodyOverflow = undefined;
  window._dietPremiumSheetState = null;
}

function updateDietPlanItem(mealIndex, itemIndex, field, value) {
  var plan = recalculateDietPlan(window._kroniaDietPlan || buildFallbackActiveDietPlan());
  var item = plan.meals && plan.meals[mealIndex] && plan.meals[mealIndex].items && plan.meals[mealIndex].items[itemIndex];
  if (!item) return;
  if (field === 'grams') {
    var grams = Math.max(0, asKroniaNumber(value, 0));
    var updatedItem = normalizeDietEditorItem(Object.assign({}, item, {
      grams: grams || null,
      gramas: grams || null,
      quantity: grams ? (grams + ' g') : item.quantity,
      porcao: grams ? (grams + ' g') : item.quantity
    }), item.order || itemIndex + 1);
    plan.meals[mealIndex].items[itemIndex] = updatedItem;
  } else {
    item[field] = value;
  }
  setActiveDietPlan(plan);
  schedulePersistActiveDietPlan();
}

function removeDietPlanItem(mealIndex, itemIndex) {
  var plan = recalculateDietPlan(window._kroniaDietPlan || buildFallbackActiveDietPlan());
  if (plan.meals && plan.meals[mealIndex] && plan.meals[mealIndex].items) {
    plan.meals[mealIndex].items.splice(itemIndex, 1);
    setActiveDietPlan(plan);
    schedulePersistActiveDietPlan();
  }
}

function findDietCatalogItems(query) {
  ensureDietTacoCatalogLoaded();
  var q = normalizeDietFoodText(query || '');
  var catalog = getDietCatalogIndexes().foods || [];
  var tokens = q ? q.split(' ').filter(Boolean) : [];
  var ranked = catalog.map(function(item) {
    var name = normalizeDietFoodText(item.nome);
    var group = normalizeDietFoodText(item.grupo);
    var blob = normalizeDietFoodText([
      item.nome,
      item.display_name,
      item.display_name_pt,
      item.canonical_name_pt,
      item.official_name,
      item.grupo,
      item.code,
      item.slug,
      item.taco_id,
      item.codigo_taco,
      Array.isArray(item.aliases) ? item.aliases.join(' ') : ''
    ].filter(Boolean).join(' '));
    var score = 0;
    if (!q) score = Number(item.codigo_taco || item.priority || item.prioridade || 0) + (item.source === 'taco' ? 0 : 20);
    if (name === q) score += 400;
    if (blob === q) score += 380;
    if (name.startsWith(q)) score += 120;
    if (blob.startsWith(q)) score += 100;
    if (name.indexOf(q) >= 0) score += 90;
    if (group.indexOf(q) >= 0) score += 40;
    tokens.forEach(function(token) {
      if (blob.indexOf(token) >= 0) score += 14;
    });
    return { item: item, score: score };
  }).filter(function(entry) {
    return !q || entry.score > 0;
  }).sort(function(a, b) {
    var tacoA = getDietCatalogTacoKey(a.item);
    var tacoB = getDietCatalogTacoKey(b.item);
    if (tacoA && tacoA === tacoB && a.item.source !== b.item.source) {
      if (a.item.source === 'kronia') return -1;
      if (b.item.source === 'kronia') return 1;
    }
    var nameA = normalizeDietFoodText(a.item.nome);
    var nameB = normalizeDietFoodText(b.item.nome);
    if (nameA === nameB && a.item.source !== b.item.source) {
      if (a.item.source === 'kronia') return -1;
      if (b.item.source === 'kronia') return 1;
    }
    if (b.score !== a.score) return b.score - a.score;
    if (a.item.source !== b.item.source) {
      if (a.item.source === 'kronia') return -1;
      if (b.item.source === 'kronia') return 1;
    }
    return normalizeDietFoodText(a.item.nome).localeCompare(normalizeDietFoodText(b.item.nome));
  });
  var deduped = [];
  var seen = Object.create(null);
  ranked.forEach(function(entry) {
    var item = entry.item;
    var nameKey = getDietCatalogDedupKey(item);
    var tacoKey = getDietCatalogTacoKey(item);
    var dedupKey = tacoKey ? ('taco:' + tacoKey) : nameKey;
    if (!dedupKey) return;
    if (seen[dedupKey]) return;
    seen[dedupKey] = item;
    deduped.push(item);
  });
  return deduped.slice(0, 20);
}

function addDietPlanItemFromCatalog(mealIndex, catalogIndex) {
  var query = document.getElementById('dietAddSearch')?.value || '';
  var item = findDietCatalogItems(query)[catalogIndex];
  if (!item) return;
  var tacoFallback = item.source === 'taco' || item.is_taco_fallback;
  addDietPlanItem(mealIndex || 0, normalizeDietEditorItem({
    nome: item.nome,
    official_name: item.official_name || null,
    sourceType: tacoFallback ? 'taco' : 'catalog',
    source_id: item.taco_id || item.source_id || item.id || item.nome,
    source: item.source,
    taco_id: item.taco_id || null,
    codigo_taco: item.codigo_taco || null,
    is_taco_fallback: tacoFallback,
    slot: item.grupo,
    gramas: item.default_portion_g || item.porcao_gramas || item.gramas || 100,
    porcao: item.default_unit || item.medida || item.porcao || ((item.default_portion_g || item.porcao_gramas || 100) + ' g'),
    calorias: item.kcal || item.calorias || item.kcal_100g || 0,
    proteinas: item.proteina || item.proteinas || item.protein_100g || 0,
    carboidratos: item.carbo || item.carboidratos || item.carbs_100g || 0,
    gorduras: item.gordura || item.gorduras || item.fat_100g || 0,
    fibras: item.fibra || item.fibras || item.fiber_100g || 0,
    per100: {
      kcal: item.kcal_100g != null ? item.kcal_100g : item.kcal,
      protein: item.protein_100g != null ? item.protein_100g : item.proteina,
      carbs: item.carbs_100g != null ? item.carbs_100g : item.carboidrato,
      fat: item.fat_100g != null ? item.fat_100g : item.gordura,
      fiber: item.fiber_100g != null ? item.fiber_100g : item.fibra,
      sodium: item.sodium_mg_100g != null ? item.sodium_mg_100g : item.sodium_mg || 0
    }
  }, 99));
}

function addDietPlanItem(mealIndex, item) {
  var plan = recalculateDietPlan(window._kroniaDietPlan || buildFallbackActiveDietPlan());
  if (!plan.meals.length) plan.meals.push({ name: 'Refeição', slot: 'refeicao', items: [] });
  var safeIndex = Math.min(Number.isFinite(Number(mealIndex)) ? Number(mealIndex) : 0, plan.meals.length - 1);
  var targetMeal = plan.meals[safeIndex];
  targetMeal.items = targetMeal.items || [];
  targetMeal.items.push(normalizeDietEditorItem(item, targetMeal.items.length + 1));
  // Sync to visualPrescription.meals so getDietRenderableMeals() reflects the addition
  if (plan.visualPrescription && Array.isArray(plan.visualPrescription.meals) && plan.visualPrescription.meals.length) {
    var vpIdx = Math.min(safeIndex, plan.visualPrescription.meals.length - 1);
    var vpMeal = plan.visualPrescription.meals[vpIdx];
    if (vpMeal) {
      if (!Array.isArray(vpMeal.items)) vpMeal.items = [];
      vpMeal.items.push(item);
      vpMeal.kcal_estimada = (asKroniaNumber(vpMeal.kcal_estimada, 0) + asKroniaNumber(item.kcal, 0));
    }
  }
  setActiveDietPlan(plan);
  schedulePersistActiveDietPlan();
  closeDietAddItemSheet();
}

function renderDietAddCatalog(mealIndex) {
  var list = document.getElementById('dietAddCatalogList');
  if (!list) return;
  ensureDietTacoCatalogLoaded();
  var query = document.getElementById('dietAddSearch')?.value || '';
  var items = findDietCatalogItems(query);
  list.innerHTML = items.map(function(item, idx) {
    var displayItem = Object.assign({}, item, {
      quantity: item.default_unit || item.medida || item.porcao || ((item.default_portion_g || item.porcao_gramas || 100) + ' g')
    });
    return '<button type="button" class="kronia-row diet-add-catalog-row" style="width:100%;text-align:left;background:transparent;color:var(--text);border:0;border-bottom:1px solid var(--border);padding:10px 0" onclick="addDietPlanItemFromCatalog(' + (mealIndex || 0) + ',' + idx + ')"><div><strong>' + escapeHTML(item.nome) + '</strong><br><span class="diet-add-catalog-meta">' + escapeHTML(formatFoodQuantityLine(displayItem)) + '</span>' + renderFoodMacrosLineHtml(displayItem, 'diet-add-catalog-macros') + '</div><div class="diet-add-catalog-group">' + escapeHTML(item.grupo || 'catálogo') + '</div></button>';
  }).join('') || '<div class="kronia-empty">Nenhum alimento encontrado.</div>';
}

function closeDietAddItemSheet() {
  document.getElementById('dietAddItemSheet')?.remove();
}

function openDietAddItemSheet(mealIndex) {
  closeDietAddItemSheet();
  var plan = window._kroniaDietPlan || buildFallbackActiveDietPlan();
  var selectedMeal = Number.isFinite(Number(mealIndex)) ? Number(mealIndex) : 0;
  ensureDietTacoCatalogLoaded();
  var sheet = document.createElement('div');
  sheet.id = 'dietAddItemSheet';
  sheet.className = 'bottom-sheet show diet-add-item-sheet';
  sheet.dataset.theme = resolveKroniaThemeForDieta();
  sheet.onclick = function(event) { if (event.target === sheet) closeDietAddItemSheet(); };
  sheet.innerHTML = '<div class="bs-box" style="max-height:88vh;overflow-y:auto"><div class="bs-handle"></div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div><div class="bs-title">Adicionar item</div><div class="bs-sub">Catálogo, busca, produto escaneado ou alimento manual.</div></div><button class="bs-close" onclick="closeDietAddItemSheet()">×</button></div>'
    + '<label class="bs-label">Refeição</label><select id="dietAddMeal" class="bs-input" onchange="renderDietAddCatalog(Number(this.value))">' + (plan.meals || []).map(function(meal, idx) { return '<option value="' + idx + '" ' + (idx === selectedMeal ? 'selected' : '') + '>' + escapeHTML(meal.name || ('Refeição ' + (idx + 1))) + '</option>'; }).join('') + '</select>'
    + '<label class="bs-label" style="margin-top:12px">Buscar alimento</label><input id="dietAddSearch" class="bs-input" placeholder="Ex: arroz, frango, banana" oninput="renderDietAddCatalog(Number(document.getElementById(&quot;dietAddMeal&quot;).value))">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0"><button class="nutrition-secondary" onclick="scanDietBarcode()">Escanear produto</button><button class="nutrition-secondary" onclick="addManualDietItem()">Criar manualmente</button></div>'
    + '<div id="dietAddCatalogList"></div></div>';
  document.body.appendChild(sheet);
  syncDietaTheme(resolveKroniaThemeForDieta());
  renderDietAddCatalog(selectedMeal);
}

function addManualDietItem() {
  var mealIndex = Number(document.getElementById('dietAddMeal')?.value || 0);
  var name = prompt('Nome do alimento');
  if (!name) return;
  var grams = asKroniaNumber(prompt('Quantidade em gramas', '100'), 100);
  var kcal = asKroniaNumber(prompt('Calorias da porção', '0'), 0);
  var protein = asKroniaNumber(prompt('Proteína em g', '0'), 0);
  var carbs = asKroniaNumber(prompt('Carboidrato em g', '0'), 0);
  var fat = asKroniaNumber(prompt('Gordura em g', '0'), 0);
  addDietPlanItem(mealIndex, normalizeDietEditorItem({ nome: name, sourceType: 'custom', gramas: grams, porcao: grams + ' g', calorias: kcal, proteinas: protein, carboidratos: carbs, gorduras: fat }, 99));
}

async function scanDietBarcode() {
  var code = prompt('Escaneamento de produto: informe ou cole o código de barras. Em navegadores compatíveis, a leitura por câmera será ativada em próxima etapa.');
  if (!code) return;
  var mealIndex = Number(document.getElementById('dietAddMeal')?.value || 0);
  addDietPlanItem(mealIndex, normalizeDietEditorItem({ nome: 'Produto ' + code, sourceType: 'barcode', source_id: code, gramas: 100, porcao: '100 g', calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0 }, 99));
  showToast('Produto adicionado para preenchimento manual de macros.', 'info', 3200);
}

function exportActiveDietPlanPDF() {
  var plan = recalculateDietPlan(window._kroniaDietPlan || readLocalActiveDietPlan() || buildFallbackActiveDietPlan());
  var cfg = safeJSON('kronia_config', {});
  var nome = cfg.nome || localStorage.getItem('kronia_nome') || 'Atleta';
  var data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  var objetivo = getObjectiveLabel(plan.objective || cfg.objetivo || '');

  var targets = plan.targets || {};
  var pdfKcal    = plan.totals.kcal    > 0 ? plan.totals.kcal    : (targets.kcal    || 0);
  var pdfProtein = plan.totals.protein > 0 ? plan.totals.protein : (targets.protein || 0);
  var pdfCarbs   = plan.totals.carbs   > 0 ? plan.totals.carbs   : (targets.carbs   || 0);
  var pdfFat     = plan.totals.fat     > 0 ? plan.totals.fat     : (targets.fat     || 0);

  /* Use plan.meals directly — it has real macros after recalculateDietPlan().
     getDietRenderableMeals() would discard them in favor of visualPrescription text strings. */
  var pdfMeals = Array.isArray(plan.meals) && plan.meals.length
    ? plan.meals
    : getDietRenderableMeals(plan);
  var numMeals = pdfMeals.length || 1;

  /* Resolve macros for a PDF table row: real item data → catalog lookup → proportional fallback */
  function resolvePdfItemMacros(item, fallbackKcal, fallbackProtein, fallbackCarbs, fallbackFat, totalGrams, itemCount) {
    var kcal    = getDietKcalValue(item);
    var protein = getDietProteinValue(item);
    var carbs   = getDietCarbsValue(item);
    var fat     = getDietFatValue(item);
    if (kcal > 0 || protein > 0 || carbs > 0 || fat > 0) {
      return { kcal: kcal, protein: protein, carbs: carbs, fat: fat, estimated: false };
    }
    var resolvedFood = resolveDietCatalogFood(item);
    if (resolvedFood) {
      var g = asKroniaNumber(item.grams, 0) || asKroniaNumber(resolvedFood.default_portion_g, 0);
      if (g > 0) {
        var cm = calculateFoodMacros(resolvedFood, g);
        if (cm.kcal > 0 || cm.protein > 0 || cm.carbs > 0 || cm.fat > 0) {
          return { kcal: cm.kcal, protein: cm.protein, carbs: cm.carbs, fat: cm.fat, estimated: false };
        }
      }
    }
    var grams = asKroniaNumber(item.grams, 0);
    var ratio = (totalGrams > 0 && grams > 0) ? grams / totalGrams : (1 / itemCount);
    var pdfRound = function(v) { return Math.round(asKroniaNumber(v, 0) * 10) / 10; };
    return {
      kcal:    pdfRound(fallbackKcal    * ratio),
      protein: pdfRound(fallbackProtein * ratio),
      carbs:   pdfRound(fallbackCarbs   * ratio),
      fat:     pdfRound(fallbackFat     * ratio),
      estimated: true
    };
  }

  var anyEstimates = false;
  var mealsHtml = pdfMeals.map(function(meal) {
    var items = meal.items || [];
    /* Fallback subtotals used only for proportional distribution when item has no macros */
    var sub = meal.subtotal || {};
    var _r1 = function(v) { return Math.round(asKroniaNumber(v, 0) * 10) / 10; };
    var fallbackMealKcal    = asKroniaNumber(sub.kcal,    0) || _r1(pdfKcal    / numMeals);
    var fallbackMealProtein = asKroniaNumber(sub.protein, 0) || _r1(pdfProtein / numMeals);
    var fallbackMealCarbs   = asKroniaNumber(sub.carbs,   0) || _r1(pdfCarbs   / numMeals);
    var fallbackMealFat     = asKroniaNumber(sub.fat,     0) || _r1(pdfFat     / numMeals);
    var totalGrams = items.reduce(function(s, it) { return s + asKroniaNumber(it.grams, 0); }, 0);

    var hasEstimates = false;
    var subtotalKcal = 0, subtotalProtein = 0, subtotalCarbs = 0, subtotalFat = 0;
    var rows = items.map(function(item) {
      var m = resolvePdfItemMacros(item, fallbackMealKcal, fallbackMealProtein, fallbackMealCarbs, fallbackMealFat, totalGrams, items.length || 1);
      if (m.estimated) hasEstimates = true;
      subtotalKcal    += m.kcal;
      subtotalProtein += m.protein;
      subtotalCarbs   += m.carbs;
      subtotalFat     += m.fat;
      var kcalTxt    = m.kcal    > 0 ? formatKroniaNumber(m.kcal,    'kcal') : '0 kcal';
      var proteinTxt = m.protein > 0 ? formatKroniaNumber(m.protein, 'g')    : '0 g';
      var carbsTxt   = m.carbs   > 0 ? formatKroniaNumber(m.carbs,   'g')    : '0 g';
      var fatTxt     = m.fat     > 0 ? formatKroniaNumber(m.fat,     'g')    : '0 g';
      if (m.estimated) { kcalTxt = '~' + kcalTxt; proteinTxt = '~' + proteinTxt; carbsTxt = '~' + carbsTxt; fatTxt = '~' + fatTxt; }
      var qty = item.quantity || (item.grams ? Math.round(item.grams) + ' g' : '1 porção');
      return '<tr><td>' + escapeHTML(item.name || getDietItemName(item)) + '</td><td>' + escapeHTML(qty) + '</td><td>' + escapeHTML(kcalTxt) + '</td><td>' + escapeHTML(proteinTxt) + '</td><td>' + escapeHTML(carbsTxt) + '</td><td>' + escapeHTML(fatTxt) + '</td></tr>';
    }).join('');

    /* Subtotal row computed from displayed item macros — matches what the user sees */
    var _r2 = function(v) { return Math.round(asKroniaNumber(v, 0) * 10) / 10; };
    var displayKcal    = _r2(subtotalKcal);
    var displayProtein = _r2(subtotalProtein);
    var displayCarbs   = _r2(subtotalCarbs);
    var displayFat     = _r2(subtotalFat);
    var subtotalRow = '<tr class="meal-subtotal-row"><td colspan="2"><strong>Total da refeição</strong></td>'
      + '<td><strong>' + escapeHTML(formatKroniaNumber(displayKcal,    'kcal')) + '</strong></td>'
      + '<td><strong>' + escapeHTML(formatKroniaNumber(displayProtein, 'g'))    + '</strong></td>'
      + '<td><strong>' + escapeHTML(formatKroniaNumber(displayCarbs,   'g'))    + '</strong></td>'
      + '<td><strong>' + escapeHTML(formatKroniaNumber(displayFat,     'g'))    + '</strong></td></tr>';

    if (hasEstimates) anyEstimates = true;
    var estimateNote = hasEstimates ? '<div class="meal-estimate-note">~ Estimativa baseada na gramagem (dado real indispon\xedvel para este item)</div>' : '';
    var emptyRow = '<tr><td colspan="6" style="color:#9ca3af;font-style:italic;font-size:12px">Nenhum item cadastrado</td></tr>';
    return '<section><div class="meal-header"><div class="meal-header-name"><span class="meal-dot"></span>' + escapeHTML(meal.name || 'Refeição') + '</div>' + (meal.time ? '<span class="meal-time">' + escapeHTML(meal.time) + '</span>' : '') + '</div><table><thead><tr><th>Alimento</th><th>Quantidade</th><th>Kcal</th><th>Prot.</th><th>Carb.</th><th>Gord.</th></tr></thead><tbody>' + (rows || emptyRow) + subtotalRow + '</tbody></table>' + estimateNote + '</section>';
  }).join('');
  var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prescrição alimentar KRONIA</title><style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#111;background:#fff;padding:32px;max-width:960px;margin:auto;line-height:1.4}.header{display:flex;align-items:center;gap:20px;padding-bottom:20px;margin-bottom:24px;border-bottom:2px solid #f0f0f0;position:relative}.header::after{content:"";position:absolute;bottom:-2px;left:0;width:56px;height:2px;background:#16a34a}.logo-wrap{width:68px;height:68px;border-radius:16px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:40px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:-0.04em;font-family:Arial,sans-serif;overflow:hidden}.logo-wrap img{width:100%;height:100%;object-fit:cover}.logo-fallback{font-size:26px;font-weight:900;color:#fff}.header-text{flex:1;min-width:0}.kicker{font-size:10px;letter-spacing:.14em;color:#16a34a;text-transform:uppercase;font-weight:800;margin-bottom:4px}.header h1{margin:0 0 5px;font-size:26px;line-height:1.05;color:#0a0a0a;font-weight:800;letter-spacing:-0.02em}.header-meta{color:#6b7280;font-size:12.5px;font-weight:500;margin:0}.macro-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 24px}.macro-card{border:1px solid #e8ecf0;border-radius:12px;padding:14px 12px;background:#fafbfc;border-top-width:3px}.macro-card--kcal{border-top-color:#16a34a}.macro-card--prot{border-top-color:#2563eb}.macro-card--carb{border-top-color:#f59e0b}.macro-card--fat{border-top-color:#ef4444}.macro-card span{display:block;font-size:9.5px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:.08em}.macro-card strong{display:block;margin-top:5px;font-size:18px;color:#111;font-weight:700;letter-spacing:-0.02em}section{margin:0 0 14px;border:1px solid #e8ecf0;border-radius:12px;overflow:hidden;break-inside:avoid}.meal-header{margin:0;padding:11px 16px;background:#1a2e1a;color:#fff;font-size:14px;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:12px;letter-spacing:-0.01em}.meal-header-name{display:flex;align-items:center;gap:8px}.meal-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0}.meal-time{color:#86efac;font-size:11.5px;font-weight:500;white-space:nowrap}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:9px 8px;border-bottom:1px solid #f0f2f5;text-align:left;font-size:11.5px;vertical-align:middle;overflow-wrap:anywhere}th{background:#f7f9f7;color:#374151;text-transform:uppercase;font-size:9px;font-weight:800;letter-spacing:.07em}tbody tr:last-child td{border-bottom:none}th:nth-child(1),td:nth-child(1){width:30%}th:nth-child(2),td:nth-child(2){width:16%}th:nth-child(n+3),td:nth-child(n+3){width:10.8%;text-align:right}.meal-subtotal-row td{background:#f0fdf4;color:#15803d;font-weight:700;border-top:2px solid #bbf7d0}.meal-estimate-note{padding:6px 12px 8px;font-size:10px;color:#9ca3af;font-style:italic}.footer{margin-top:28px;padding-top:16px;border-top:1px solid #f0f0f0;color:#9ca3af;font-size:10.5px;line-height:1.5}@media(max-width:640px){body{padding:18px}.header{gap:14px}.logo-wrap{width:52px;height:52px;font-size:30px}.header h1{font-size:20px}.macro-bar{grid-template-columns:repeat(2,1fr)}th,td{font-size:10px;padding:7px 5px}}@media print{body{padding:20px}.meal-header,th,.macro-card,.meal-subtotal-row td{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="header"><div class="logo-wrap"><img src="/Kronia.png" alt="KRONIA" onerror="this.style.display=\'none\'"><div class="logo-fallback">KRONIA</div></div><div class="header-text"><div class="kicker">Plano alimentar KRONIA</div><h1>' + escapeHTML(plan.title || 'Plano alimentar') + '</h1><p class="header-meta">' + escapeHTML(nome) + ' • ' + escapeHTML(data) + (objetivo ? ' • ' + escapeHTML(objetivo) : '') + '</p></div></div><div class="macro-bar"><div class="macro-card macro-card--kcal"><span>Calorias</span><strong>' + escapeHTML(formatDietPdfMacro(pdfKcal, 'kcal')) + '</strong></div><div class="macro-card macro-card--prot"><span>Prote\xedna</span><strong>' + escapeHTML(formatDietPdfMacro(pdfProtein, 'g')) + '</strong></div><div class="macro-card macro-card--carb"><span>Carboidrato</span><strong>' + escapeHTML(formatDietPdfMacro(pdfCarbs, 'g')) + '</strong></div><div class="macro-card macro-card--fat"><span>Gordura</span><strong>' + escapeHTML(formatDietPdfMacro(pdfFat, 'g')) + '</strong></div></div>' + mealsHtml + (function(){var vp=plan.visualPrescription||{};var aiActive=!!(vp.aiGenerated||(plan.aiGenerated));var footerParts=['Documento gerado a partir da vers\xe3o ativa salva da dieta.'];if(anyEstimates)footerParts.push('Valores marcados com ~ s\xe3o estimativas baseadas na gramagem (dado real indispon\xedvel para o alimento).');if(aiActive)footerParts.push('Estrat\xe9gia alimentar gerada por IA e validada por cat\xe1logo nutricional (TACO, USDA, PremiumCatalog).');else footerParts.push('Plano nutricional gerado pela engine Kronia.');footerParts.push('N\xe3o substitui acompanhamento de nutricionista.');return'<div class="footer">'+footerParts.join(' ')+'</div>';})() + '<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>';
  var win = window.open('', '_blank');
  if (!win) { showToast('Permita pop-ups para gerar o PDF.', 'warning', 3000); return; }
  win.document.write(html);
  win.document.close();
}

function openEvolutionDataScreen() {
  setDietMiniAppChrome(false);
  _showEl('evolutionDataScreen');
  document.body.classList.remove('overlay-open');
  refreshEvolutionDataScreen();
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
}

async function refreshEvolutionDataScreen() {
  var stats = document.getElementById('evolutionDataStats');
  var chart = document.getElementById('evolutionChart');
  var measures = document.getElementById('evolutionMeasures');
  if (stats) stats.innerHTML = renderKroniaMetricCard('Peso atual', '...', 'Carregando Supabase');
  if (chart) chart.innerHTML = '<div class="kronia-empty">Sincronizando medidas...</div>';
  if (measures) measures.innerHTML = '<div class="kronia-card-title">Medidas</div><div class="kronia-empty">Carregando...</div>';

  var rows = [];
  try {
    var sessionResp = await _sb.auth.getSession();
    var userId = sessionResp && sessionResp.data && sessionResp.data.session && sessionResp.data.session.user && sessionResp.data.session.user.id;
    if (userId) {
      var resp = await _sb.from('body_metrics')
        .select('weight_kg,body_fat_percent,waist_cm,hip_cm,chest_cm,arm_cm,thigh_cm,measured_at')
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })
        .limit(12);
      if (!resp.error && Array.isArray(resp.data)) rows = resp.data;
    }
  } catch (_) {}

  if (!rows.length) {
    var cfg = safeJSON('kronia_config', {});
    if (cfg.peso) rows = [{ weight_kg: Number(cfg.peso), measured_at: new Date().toISOString(), body_fat_percent: cfg.gordura || null }];
  }

  var latest = rows[0] || {};
  var ordered = rows.slice().reverse();
  var firstWeight = asKroniaNumber(ordered[0] && ordered[0].weight_kg, 0);
  var lastWeight = asKroniaNumber(latest.weight_kg, 0);
  var delta = firstWeight && lastWeight ? Math.round((lastWeight - firstWeight) * 10) / 10 : 0;

  if (stats) {
    stats.innerHTML = [
      renderKroniaMetricCard('Peso atual', lastWeight ? formatKroniaNumber(lastWeight, 'kg') : '-', 'Última medida'),
      renderKroniaMetricCard('Variação', (delta > 0 ? '+' : '') + formatKroniaNumber(delta, 'kg'), 'No histórico carregado'),
      renderKroniaMetricCard('Gordura', latest.body_fat_percent ? formatKroniaNumber(latest.body_fat_percent, '%') : '-', 'Percentual corporal'),
      renderKroniaMetricCard('Registros', String(rows.length), 'Medições disponíveis')
    ].join('');
  }

  if (chart) chart.innerHTML = renderEvolutionSvg(ordered);
  if (measures) {
    measures.innerHTML = '<div class="kronia-card-title">Medidas recentes</div>'
      + (latest && latest.measured_at ? '<div class="kronia-measure-list">'
      + [
        ['Cintura', latest.waist_cm, 'cm'],
        ['Quadril', latest.hip_cm, 'cm'],
        ['Peito', latest.chest_cm, 'cm'],
        ['Braço', latest.arm_cm, 'cm'],
        ['Coxa', latest.thigh_cm, 'cm']
      ].map(function(item) {
        return '<div class="kronia-row"><strong>' + escapeHTML(item[0]) + '</strong><span>' + escapeHTML(item[1] ? formatKroniaNumber(item[1], item[2]) : '-') + '</span></div>';
      }).join('') + '</div>' : '<div class="kronia-empty">Nenhuma medida corporal encontrada no Supabase.</div>');
  }
}

function renderEvolutionSvg(rows) {
  var points = rows
    .map(function(row) { return { value: asKroniaNumber(row.weight_kg, NaN), date: row.measured_at }; })
    .filter(function(row) { return Number.isFinite(row.value); });
  if (points.length < 2) return '<div class="kronia-empty">Registre pelo menos duas medidas de peso para renderizar o gráfico.</div>';
  var width = 320, height = 170, pad = 24;
  var values = points.map(function(p) { return p.value; });
  var min = Math.min.apply(null, values);
  var max = Math.max.apply(null, values);
  if (min === max) { min -= 1; max += 1; }
  var coords = points.map(function(p, idx) {
    var x = pad + (idx * ((width - pad * 2) / Math.max(1, points.length - 1)));
    var y = height - pad - ((p.value - min) / (max - min)) * (height - pad * 2);
    return { x: x, y: y, value: p.value, date: p.date };
  });
  var poly = coords.map(function(p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  var area = poly + ' ' + (width - pad) + ',' + (height - pad) + ' ' + pad + ',' + (height - pad);
  return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Gráfico de evolução de peso">'
    + '<polyline points="' + area + '" fill="rgba(34,197,94,0.12)" stroke="none"></polyline>'
    + '<polyline points="' + poly + '" fill="none" stroke="#22C55E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>'
    + coords.map(function(p) { return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4.5" fill="#22C55E" stroke="#fff" stroke-width="2"></circle>'; }).join('')
    + '<text x="' + pad + '" y="16" fill="#64748B" font-size="11" font-weight="700">' + escapeHTML(formatKroniaNumber(max, 'kg')) + '</text>'
    + '<text x="' + pad + '" y="' + (height - 4) + '" fill="#64748B" font-size="11" font-weight="700">' + escapeHTML(formatKroniaNumber(min, 'kg')) + '</text>'
    + '</svg>';
}

function toggleOrientSuggestions() {
  const row = document.querySelector(".orient-shortcuts-row");
  const btn = document.getElementById("orientSuggestBtn");
  if (!row || !btn) return;
  const isCollapsed = row.classList.toggle("collapsed");
  btn.classList.toggle("open", !isCollapsed);
}
function autoResizeOrientInput(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}



function runKroniaActionFallback(action, context) {
  var safeContext = sanitizeCtaObject(context);
  if (action === 'open_training') {
    try { schedulePendingConversationIntentConsumption('fallback_training'); } catch (_) {}
    try { window.openKronosWorkoutEntry?.(); return true; } catch (_) {}
    try { navTo?.('treino'); return true; } catch (_) {}
  }
  if (action === 'open_diet') {
    try { navTo?.('dieta'); } catch (_) {}
    try { openDietDataScreen?.(); } catch (_) {}
    try { schedulePendingConversationIntentConsumption('fallback_diet'); } catch (_) {}
    try { navTo?.('dieta'); return true; } catch (_) {}
  }
  if (action === 'generate_diet') {
    try { navTo?.('dieta'); } catch (_) {}
    try { openDietDataScreen?.(); } catch (_) {}
    try { schedulePendingConversationIntentConsumption('fallback_generate_diet'); } catch (_) {}
    try { openDietaSheet?.(Object.assign({}, safeContext, { autoGenerate: true, fromChatIntent: true, returnTab: safeContext.returnTab || 'dieta' })); return true; } catch (_) {}
    try { openDieta?.(); return true; } catch (_) {}
    try { navTo?.('dieta'); return true; } catch (_) {}
  }
  if (action === 'open_labs_upload') {
    try { openLabsUploadScreen(safeContext); return true; } catch (_) {}
    try { openPerfil?.(); return true; } catch (_) {}
    try { navTo?.('perfil'); return true; } catch (_) {}
  }
  if (action === 'open_kronos') {
    try { navTo?.('inicio'); } catch (_) {}
    try { openAI?.(); return true; } catch (_) {}
    try {
      var aiModal = document.getElementById('aiModal');
      if (aiModal) {
        aiModal.style.display = 'flex';
        return true;
      }
    } catch (_) {}
    try { window.location.href = '/app/chat'; return true; } catch (_) {}
  }
  return false;
}

window.KroniaActions = {
  openTrainingBuilder: function (context) {
    try { closeAI?.(); } catch (_) {}
    try { closeOrientacao?.(); } catch (_) {}
    try { schedulePendingConversationIntentConsumption('kronia_action_training'); } catch (_) {}
    try { window.openKronosWorkoutEntry?.(); } catch (_) {}
  },

  openDietGenerator: function (context) {
    try { closeAI?.(); } catch (_) {}
    try { closeOrientacao?.(); } catch (_) {}
    try { this.openDietWorkspace(context); } catch (_) {}
    try {
      openNutritionFlowFull?.(Object.assign({}, sanitizeCtaObject(context), {
        source: context && context.source || 'kronia_action_diet',
        origin: context && context.origin || 'dieta_ia',
        returnTab: context && context.returnTab || 'dieta',
        fromChatIntent: !!(context && context.fromChatIntent),
        autoGenerate: !!(context && context.autoGenerate),
      }));
      clearPendingConversationIntent();
    } catch (_) {
      schedulePendingConversationIntentConsumption('kronia_action_diet');
    }
  },

  openDietWorkspace: function (context) {
    try { closeAI?.(); } catch (_) {}
    try { closeOrientacao?.(); } catch (_) {}
    try { closeNutritionFlow?.(); } catch (_) {}
    try { navTo?.('dieta'); } catch (_) {}
    try { openDietDataScreen?.(); } catch (_) {}
    return true;
  },

  openLabsUpload: function (context) {
    openLabsUploadScreen(context);
  },
};

if (window.KroniaIntelligence && typeof window.KroniaIntelligence.setAdminAuditTrace !== 'function') {
  window.KroniaIntelligence.setAdminAuditTrace = function (data) {
    try {
      var nextTrace = Object.assign({}, this._trace || {}, data || {});
      this._trace = nextTrace;
      localStorage.setItem('kronia_admin_audit_trace_v1', JSON.stringify(nextTrace));
      if (typeof this.track === 'function') {
        this.track({
          module: 'conversation',
          action: 'admin_audit_trace_updated',
          status: 'success',
          source: 'app_admin_trace',
          metadata: {
            keys: Object.keys(data || {}),
          },
        });
      }
    } catch (_) {}
  };
}
if (window.KroniaIntelligence && typeof window.KroniaIntelligence.getAdminAuditTrace !== 'function') {
  window.KroniaIntelligence.getAdminAuditTrace = function () {
    if (this._trace && typeof this._trace === 'object') return this._trace;
    try {
      var raw = localStorage.getItem('kronia_admin_audit_trace_v1');
      var parsed = raw ? JSON.parse(raw) : {};
      this._trace = parsed;
      return parsed;
    } catch (_) {
      return {};
    }
  };
}

function extractObjectiveFromInput(input) {
  var text = String(input?.message || input?.objective || '').toLowerCase();
  if (/hipertrof|massa/.test(text)) return 'hipertrofia';
  if (/emagrec|defini/.test(text)) return 'emagrecimento';
  if (/forca/.test(text)) return 'forca';
  if (/manuten/.test(text)) return 'manutencao';
  if (/recompos/.test(text)) return 'recomposicao';
  return 'hipertrofia';
}

function writeAuditTracePatch(patch) {
  try {
    var current = window.KroniaIntelligence?.getAdminAuditTrace?.() || {};
    var next = Object.assign({}, current, patch || {});
    if (patch?.conversation) {
      next.conversation = Object.assign({}, current.conversation || {}, patch.conversation || {});
    }
    if (patch?.science) {
      next.science = Object.assign({}, current.science || {}, patch.science || {});
    }
    if (patch?.generation) {
      next.generation = Object.assign({}, current.generation || {}, patch.generation || {});
    }
    window.KroniaIntelligence?.setAdminAuditTrace?.(next);
  } catch (_err) {
    return;
  }
}


function buildGenerationEnvelope(input) {
  var evidenceCount = Number(input?.evidenceCount || 0);
  var usedScientificEvidence = !!input?.usedScientificEvidence && evidenceCount > 0;
  return {
    type: input?.type || null,
    sourceOfTruth: input?.sourceOfTruth || 'none',
    usedScientificEvidence: usedScientificEvidence,
    scienceTopicsUsed: Array.isArray(input?.scienceTopicsUsed) ? input.scienceTopicsUsed : [],
    evidenceCount: evidenceCount,
    validationStatus: input?.validationStatus || 'unknown',
    blockedReason: input?.blockedReason || null,
    constraintsUsed: input?.constraintsUsed || {},
    userInputsUsed: input?.userInputsUsed || {},
    respectedCardContext: !!input?.respectedCardContext,
    respectedAnamnesisContext: !!input?.respectedAnamnesisContext,
    usedFallback: !!input?.usedFallback,
    evidenceState: input?.evidenceState || null,
    warningMessage: input?.warningMessage || null,
    timestamp: new Date().toISOString(),
  };
}

function deriveOperationalScienceConstraints(kind, objective, evidenceRows) {
  var refs = (Array.isArray(evidenceRows) ? evidenceRows : []).map(function (item) {
    return {
      topic: item?.topic?.topic || item?.topic || null,
      recommendation: item?.recommendation || item?.summary || null,
      level: item?.evidence_level || item?.level || null,
    };
  }).filter(function (item) { return !!item.topic || !!item.recommendation; });

  var text = refs.map(function (r) { return String(r.recommendation || '').toLowerCase(); }).join(' ');
  if (kind === 'workout') {
    return {
      objective: objective,
      evidenceReferences: refs.slice(0, 8),
      volumeGuidance: /volume|series|sets/.test(text) ? refs.find(function (r) { return /volume|series|sets/.test(String(r.recommendation || '').toLowerCase()); })?.recommendation || null : null,
      progressionModel: /progress|progressao|sobrecarga/.test(text) ? refs.find(function (r) { return /progress|progressao|sobrecarga/.test(String(r.recommendation || '').toLowerCase()); })?.recommendation || null : null,
      effortModel: /rpe|esforco|falha/.test(text) ? refs.find(function (r) { return /rpe|esforco|falha/.test(String(r.recommendation || '').toLowerCase()); })?.recommendation || null : null,
      frequencyGuidance: /frequenc|semana|weekly/.test(text) ? refs.find(function (r) { return /frequenc|semana|weekly/.test(String(r.recommendation || '').toLowerCase()); })?.recommendation || null : null,
    };
  }

  return {
    objective: objective,
    evidenceReferences: refs.slice(0, 8),
    proteinRange: /protein|proteina|g\/kg/.test(text) ? refs.find(function (r) { return /protein|proteina|g\/kg/.test(String(r.recommendation || '').toLowerCase()); })?.recommendation || null : null,
    calorieStrategy: /kcal|caloria|deficit|superavit/.test(text) ? refs.find(function (r) { return /kcal|caloria|deficit|superavit/.test(String(r.recommendation || '').toLowerCase()); })?.recommendation || null : null,
    macroBias: /carb|gordura|macro/.test(text) ? refs.find(function (r) { return /carb|gordura|macro/.test(String(r.recommendation || '').toLowerCase()); })?.recommendation || null : null,
    clinicalNotes: /clin|saude|patolog|insulina|pressao/.test(text) ? refs.filter(function (r) { return /clin|saude|patolog|insulina|pressao/.test(String(r.recommendation || '').toLowerCase()); }).slice(0, 3).map(function (r) { return r.recommendation; }) : [],
  };
}

function pickScientificProfileValue() {
  for (var i = 0; i < arguments.length; i += 1) {
    var value = arguments[i];
    if (value === undefined || value === null || value === '') continue;
    return value;
  }
  return undefined;
}

function normalizeScientificProfileInput(input) {
  var safeInput = input && typeof input === 'object' ? input : {};
  var profile = safeInput.profile && typeof safeInput.profile === 'object' ? safeInput.profile : {};
  var context = safeInput.context && typeof safeInput.context === 'object' ? safeInput.context : {};
  var persisted = safeJSON('kronia_config', {});

  return {
    objetivo: pickScientificProfileValue(
      safeInput.objetivo,
      safeInput.objective,
      profile.objetivo,
      profile.objective,
      context.objetivo,
      context.objective,
      persisted.objetivo,
      persisted.objective
    ),
    sexo: pickScientificProfileValue(
      safeInput.sexo,
      safeInput.sex,
      profile.sexo,
      profile.sex,
      context.sexo,
      context.sex,
      persisted.sexo,
      persisted.sex
    ),
    idade: pickScientificProfileValue(
      safeInput.idade,
      safeInput.age,
      profile.idade,
      profile.age,
      context.idade,
      context.age,
      persisted.idade,
      persisted.age
    ),
    peso: pickScientificProfileValue(
      safeInput.peso,
      safeInput.pesoKg,
      safeInput.weight,
      safeInput.weightKg,
      profile.peso,
      profile.pesoKg,
      profile.weight,
      profile.weightKg,
      context.peso,
      context.pesoKg,
      context.weight,
      context.weightKg,
      persisted.peso,
      persisted.weight
    ),
    altura: pickScientificProfileValue(
      safeInput.altura,
      safeInput.alturaCm,
      safeInput.height,
      safeInput.heightCm,
      profile.altura,
      profile.alturaCm,
      profile.height,
      profile.heightCm,
      context.altura,
      context.alturaCm,
      context.height,
      context.heightCm,
      persisted.altura,
      persisted.height
    ),
    atividade: pickScientificProfileValue(
      safeInput.nivelAtividade,
      safeInput.activityLevel,
      safeInput.rotina,
      safeInput.routine,
      profile.nivelAtividade,
      profile.activityLevel,
      profile.rotina,
      profile.routine,
      context.nivelAtividade,
      context.activityLevel,
      context.rotina,
      context.routine,
      persisted.atividade,
      persisted.nivelAtividade
    ),
  };
}

async function buildScientificConstraintsByObjective(objective, kind, input) {
  var profile = normalizeScientificProfileInput(input);
  try {
    var response = await apiFetch('/api/science', {
      method: 'POST',
      body: JSON.stringify({
        objetivo: objective || profile.objetivo,
        sexo: profile.sexo || undefined,
        idade: profile.idade || undefined,
        peso: profile.peso || undefined,
        altura: profile.altura || undefined,
        nivelAtividade: profile.atividade || undefined,
      }),
    });
    var payload = await response.json();
    var evidence = Array.isArray(payload?.science) ? payload.science : [];
    var topics = evidence.map(function (item) {
      return item?.topic?.topic || item?.topic || null;
    }).filter(Boolean);
    var constraints = deriveOperationalScienceConstraints(kind || "diet", objective, evidence);

    var evidenceState = evidence.length >= 3 ? 'ok' : (evidence.length > 0 ? 'weak_evidence' : 'no_evidence');
    var serviceUnavailable = !response.ok || payload?.ok === false;
    var unsafeObjective = /extremo|milagre|sem comer|anabolizante sem acompanhamento/.test(String(objective || '').toLowerCase());
    var result = {
      ok: !unsafeObjective,
      blockedReason: unsafeObjective ? 'unsafe_request' : null,
      sourceOfTruth: serviceUnavailable ? 'safe_default_protocol' : 'supabase_scientific_evidence',
      usedScientificEvidence: evidence.length > 0,
      evidenceCount: evidence.length,
      scienceTopicsUsed: topics,
      constraints: constraints,
      evidenceState: serviceUnavailable && evidence.length === 0 ? 'no_evidence' : evidenceState,
      validationStatus: unsafeObjective ? 'blocked' : (evidenceState === 'ok' ? 'validated' : 'fallback_safe_protocol'),
      usedFallback: serviceUnavailable || evidenceState !== 'ok',
      fallbackProtocol: evidenceState === 'no_evidence' || serviceUnavailable ? 'safe_conservative_sports_nutrition' : null,
      warningMessage: evidenceState === 'weak_evidence'
        ? 'Estou usando a melhor base disponível para esse objetivo e reforçando o plano com regras esportivas confiáveis.'
        : null,
      timestamp: new Date().toISOString(),
    };

    writeAuditTracePatch({
      science: {
        sourceOfTruth: result.sourceOfTruth,
        usedScientificEvidence: result.usedScientificEvidence,
        evidenceCount: result.evidenceCount,
        scienceTopicsUsed: result.scienceTopicsUsed,
        usedFallback: result.usedFallback,
        blockedReason: result.blockedReason,
        validationStatus: result.validationStatus,
        timestamp: result.timestamp,
      },
    });
    return result;
  } catch (_err) {
    var failure = {
      ok: true,
      blockedReason: null,
      sourceOfTruth: 'safe_default_protocol',
      usedScientificEvidence: false,
      evidenceCount: 0,
      scienceTopicsUsed: [],
      constraints: deriveOperationalScienceConstraints(kind || 'diet', objective, []),
      evidenceState: 'no_evidence',
      validationStatus: 'fallback_safe_protocol',
      usedFallback: true,
      fallbackProtocol: 'safe_conservative_sports_nutrition',
      warningMessage: null,
      timestamp: new Date().toISOString(),
    };
    writeAuditTracePatch({
      science: {
        sourceOfTruth: failure.sourceOfTruth,
        usedScientificEvidence: false,
        evidenceCount: 0,
        scienceTopicsUsed: [],
        usedFallback: true,
        blockedReason: failure.blockedReason,
        validationStatus: failure.validationStatus,
        timestamp: failure.timestamp,
      },
    });
    return failure;
  }
}

window.buildScientificConstraintsForDiet = async function buildScientificConstraintsForDiet(input) {
  var objective = extractObjectiveFromInput(input);
  return buildScientificConstraintsByObjective(objective, 'diet', input);
};

window.buildScientificConstraintsForWorkout = async function buildScientificConstraintsForWorkout(input) {
  var objective = extractObjectiveFromInput(input);
  return buildScientificConstraintsByObjective(objective, 'workout', input);
};

async function validateScientificGenerationGuard(kind, objective, userInputsUsed, contextFlags) {
  var scienceBuilder = kind === 'diet'
    ? window.buildScientificConstraintsForDiet
    : window.buildScientificConstraintsForWorkout;

  var science = typeof scienceBuilder === 'function'
    ? await scienceBuilder({
      objective: objective,
      message: String(objective || ''),
      profile: userInputsUsed || {},
      context: contextFlags || {},
    })
    : {
      ok: false,
      blockedReason: 'science_builder_missing',
      sourceOfTruth: 'supabase_scientific_evidence',
      usedScientificEvidence: false,
      evidenceCount: 0,
      scienceTopicsUsed: [],
      constraints: {},
      validationStatus: 'blocked',
      usedFallback: false,
    };

  var blocked = !science?.ok;
  var envelope = buildGenerationEnvelope({
    type: kind,
    sourceOfTruth: science?.sourceOfTruth || 'safe_default_protocol',
    usedScientificEvidence: !!science?.usedScientificEvidence,
    scienceTopicsUsed: science?.scienceTopicsUsed || [],
    evidenceCount: Number(science?.evidenceCount || 0),
    validationStatus: blocked ? 'blocked' : (science?.validationStatus || 'validated'),
    blockedReason: blocked ? (science?.blockedReason || 'unsafe_request') : null,
    constraintsUsed: science?.constraints || {},
    userInputsUsed: userInputsUsed,
    respectedCardContext: !!contextFlags?.respectedCardContext,
    respectedAnamnesisContext: !!contextFlags?.respectedAnamnesisContext,
    usedFallback: !!science?.usedFallback,
    evidenceState: science?.evidenceState || null,
    warningMessage: science?.warningMessage || null,
  });

  writeAuditTracePatch({
    science: {
      sourceOfTruth: envelope.sourceOfTruth,
      usedScientificEvidence: envelope.usedScientificEvidence,
      scienceTopicsUsed: envelope.scienceTopicsUsed,
      evidenceCount: envelope.evidenceCount,
      validationStatus: envelope.validationStatus,
      blockedReason: envelope.blockedReason,
      usedFallback: envelope.usedFallback,
      evidenceState: envelope.evidenceState || null,
      timestamp: envelope.timestamp,
    },
    generation: envelope,
  });

  return {
    ok: !blocked,
    blockedReason: envelope.blockedReason,
    evidenceState: science?.evidenceState || (envelope.evidenceCount > 0 ? 'weak_evidence' : 'no_evidence'),
    warningMessage: science?.warningMessage || null,
    science: science,
    generationTrace: envelope,
  };
}

function shouldShowScientificWarningToast(guard) {
  if (!guard || typeof guard !== 'object') return false;
  if (!guard.warningMessage) return false;
  return String(guard.evidenceState || '') === 'weak_evidence';
}

async function resolveKronosConversation(inputText) {
  var appLayer = window.KroniaApplication && window.KroniaApplication.application;
  if (!appLayer || typeof appLayer.resolveConversationFlow !== 'function') {
    return {
      type: 'answer_only',
      intent: 'general_question',
      message: 'Nao consegui inicializar o motor conversacional agora.',
      cta: null,
    };
  }
  return appLayer.resolveConversationFlow({ message: String(inputText || '') });
}

function normalizeCtaPayload(payload) {
  var safePayload = sanitizeCtaObject(payload);
  delete safePayload._targetModule;
  return safePayload;
}

function sanitizeCtaObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  var cloned = Object.create(null);
  Object.keys(value).forEach(function (key) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
    var normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;
    var fieldValue = value[key];
    if (fieldValue === undefined || typeof fieldValue === 'function') return;
    if (fieldValue && typeof fieldValue === 'object') {
      if (Array.isArray(fieldValue)) {
        // Preserve arrays of primitive values only (strings, numbers, booleans).
        // Objects and functions inside arrays are dropped for safety.
        var safeArr = fieldValue.filter(function (v) {
          return v !== null && v !== undefined && typeof v !== 'function' && typeof v !== 'object';
        });
        if (safeArr.length) cloned[normalizedKey] = safeArr;
        return;
      }
      cloned[normalizedKey] = sanitizeCtaObject(fieldValue);
      return;
    }
    cloned[normalizedKey] = fieldValue;
  });
  return cloned;
}

var KRONIA_CTA_ALLOWED_ACTIONS = Object.freeze({
  open_training: true,
  open_diet: true,
  generate_diet: true,
  open_kronos: true,
  open_labs_upload: true,
});

// Compatibilidade legada temporária (remover quando emissores antigos forem eliminados).
var KRONIA_CTA_ACTION_ALIASES = Object.freeze({
  open_training_builder: 'open_training',
  open_diet_generator: 'generate_diet',
  open_labs_uploader: 'open_labs_upload',
});
var KRONIA_CTA_LOCK_MS = 1200;
var __kroniaCtaExecutionLocks = Object.create(null);
var __kroniaCtaDelegationInstalled = false;

function trackKroniaCta(stage, status, metadata) {
  try {
    window.KroniaIntelligence?.track?.({
      module: 'conversation',
      action: 'cta_' + String(stage || 'unknown'),
      status: status || 'success',
      source: 'app_cta_pipeline',
      metadata: Object.assign({}, metadata || {}),
    });
  } catch (_) {}
}

function parseCtaPayloadAttribute(payloadRaw) {
  if (!payloadRaw) return {};
  try {
    var parsed = JSON.parse(String(payloadRaw));
    return sanitizeCtaObject(parsed);
  } catch (_) {
    trackKroniaCta('payload_parse_failed', 'error', { reason: 'invalid_json_payload' });
    return {};
  }
}

function parseCtaMetaAttribute(metaRaw) {
  if (!metaRaw) return {};
  try {
    var parsed = JSON.parse(String(metaRaw));
    return sanitizeCtaObject(parsed);
  } catch (_) {
    trackKroniaCta('meta_parse_failed', 'error', { reason: 'invalid_json_meta' });
    return {};
  }
}

function renderConversationCta(containerId, cta, payload) {
  var container = document.getElementById(containerId);
  if (!container || !cta || !cta.action) return null;

  var wrap = document.createElement('div');
  wrap.className = 'ai-msg assistant';
  wrap.setAttribute('data-role', 'assistant');

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'ai-suggest-btn kronia-cta';
  button.textContent = cta.label || 'Continuar';
  button.setAttribute('data-action', String(resolveCanonicalKroniaAction(cta.action) || ''));
  button.setAttribute('data-cta-label', String(cta.label || ''));
  button.setAttribute('data-cta-payload', JSON.stringify(normalizeCtaPayload(payload)));
  button.setAttribute('data-cta-meta', JSON.stringify({
    source: 'conversation_message',
    targetModule: payload?._targetModule || null,
    intentSource: cta?.intentSource || null,
  }));
  button.onclick = function () {
    return window.executeConversationCta({
      action: cta.action,
      label: cta.label || 'Continuar',
      payload: normalizeCtaPayload(payload),
      meta: {
        source: 'conversation_message',
        targetModule: payload?._targetModule || null,
        intentSource: cta?.intentSource || null,
      },
    });
  };

  var inner = document.createElement('div');
  inner.className = 'ai-avatar-inner';
  var bubble = document.createElement('div');
  bubble.className = 'ai-bubble';
  bubble.appendChild(button);
  inner.appendChild(bubble);
  wrap.appendChild(inner);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;

  writeAuditTracePatch({
    conversation: {
      ctaRendered: true,
      ctaClicked: false,
      ctaAction: cta.action,
      ctaLabel: cta.label || null,
      targetModule: payload?._targetModule || null,
      payload: normalizeCtaPayload(payload),
      timestamp: new Date().toISOString(),
    },
  });

  return wrap;
}

function normalizeKroniaAction(action) {
  var value = String(action || '').trim().toLowerCase();
  if (KRONIA_CTA_ACTION_ALIASES[value]) return KRONIA_CTA_ACTION_ALIASES[value];
  return value;
}

function resolveCanonicalKroniaAction(action) {
  var normalizedAction = normalizeKroniaAction(action);
  if (!normalizedAction) return null;
  return KRONIA_CTA_ALLOWED_ACTIONS[normalizedAction] ? normalizedAction : null;
}

function buildKroniaCtaLockKey(action, payload, meta) {
  var safePayload = sanitizeCtaObject(payload);
  var safeMeta = sanitizeCtaObject(meta);
  var label = String(safeMeta.label || '');
  var targetModule = String(safeMeta.targetModule || safePayload._targetModule || '');
  return String(action || '') + '|' + label + '|' + targetModule;
}

function acquireKroniaCtaExecutionLock(actionKey) {
  var key = String(actionKey || '');
  if (!key) return false;
  var now = Date.now();
  var lockedUntil = Number(__kroniaCtaExecutionLocks[key] || 0);
  if (lockedUntil > now) return false;
  __kroniaCtaExecutionLocks[key] = now + KRONIA_CTA_LOCK_MS;
  return true;
}

var KRONIA_CTA_EXECUTOR_MAP = Object.freeze({
  open_training: function (context) {
    if (window.KroniaActions && typeof window.KroniaActions.openTrainingBuilder === 'function') {
      window.KroniaActions.openTrainingBuilder(context);
      return true;
    }
    return false;
  },
  open_diet: function (context) {
    if (window.KroniaActions && typeof window.KroniaActions.openDietWorkspace === 'function') {
      window.KroniaActions.openDietWorkspace(context);
      return true;
    }
    return false;
  },
  generate_diet: function (context) {
    if (window.KroniaActions && typeof window.KroniaActions.openDietGenerator === 'function') {
      window.KroniaActions.openDietGenerator(context);
      return true;
    }
    return false;
  },
  open_labs_upload: function (context) {
    if (window.KroniaActions && typeof window.KroniaActions.openLabsUpload === 'function') {
      window.KroniaActions.openLabsUpload(context);
      return true;
    }
    return false;
  },
});

function executeKroniaCtaAction(action, context) {
  var executor = KRONIA_CTA_EXECUTOR_MAP[action];
  if (typeof executor !== 'function') return runKroniaActionFallback(action, context);
  try {
    if (executor(context)) return true;
  } catch (_) {}
  return runKroniaActionFallback(action, context);
}

function renderInferredConversationCta(containerId, payload) {
  var inferredIntent = inferConversationCtaFromApiResponse(payload);
  var inferredCta = buildCtaFromCanonicalIntent(inferredIntent);
  if (!inferredIntent || !inferredCta) return false;
  renderConversationCta(
    containerId,
    { action: inferredCta.action, label: inferredCta.label, intentSource: inferredCta.intentSource },
    Object.assign({}, inferredCta.payload, { _targetModule: inferredCta.targetModule })
  );
  trackKroniaCta('api_cta_rendered', 'success', {
    normalizedAction: inferredIntent.type,
    source: inferredIntent.source,
    inferredFrom: inferredIntent?.meta?.inferred_from || null,
  });
  return true;
}

window.handleKroniaCTA = function handleKroniaCTA(action, payload, meta) {
  var safeMeta = sanitizeCtaObject(meta);
  var safePayload = sanitizeCtaObject(payload);
  var canonicalAction = resolveCanonicalKroniaAction(action);
  if (!canonicalAction) {
    trackKroniaCta('action_rejected', 'error', {
      actionRaw: String(action || ''),
      normalizedAction: normalizeKroniaAction(action),
      reason: 'action_not_whitelisted',
    });
    return false;
  }
  var lockKey = buildKroniaCtaLockKey(canonicalAction, safePayload, safeMeta);
  if (!acquireKroniaCtaExecutionLock(lockKey)) {
    trackKroniaCta('click_deduplicated', 'success', {
      normalizedAction: canonicalAction,
      lockKey: lockKey,
      deduplicated: true,
    });
    return false;
  }

  var context = Object.assign({}, safePayload, {
    source: safePayload.source || 'conversation_cta',
    ctaLabel: safeMeta.label || null,
    ctaMeta: safeMeta,
  });
  trackKroniaCta('conversation_cta_clicked', 'success', {
    normalizedAction: canonicalAction,
    source: context.source || null,
    hasPayload: !!Object.keys(safePayload).length,
  });

  var pendingIntentSaved = persistPendingConversationIntent({
    type: canonicalAction,
    source: safeMeta.intentSource === 'agent' || context.source === 'api_agent_response' ? 'agent' : 'inferred',
    payload: safePayload,
    meta: Object.assign({}, safeMeta, { source: context.source || 'conversation_cta' }),
  });
  if (!pendingIntentSaved) {
    trackKroniaCta('conversation_cta_rejected', 'error', {
      reason: 'pending_intent_not_persisted',
      normalizedAction: canonicalAction,
    });
  }

  try { window.KroniaActions = window.KroniaActions || {}; } catch (_) {}
  trackKroniaCta('execution_started', 'success', {
    normalizedAction: canonicalAction,
    hasPrimaryExecutor: !!(window.KroniaActions && (window.KroniaActions.openTrainingBuilder || window.KroniaActions.openDietGenerator)),
  });
  var executed = executeKroniaCtaAction(canonicalAction, context);
  trackKroniaCta(executed ? 'execution_succeeded' : 'execution_failed', executed ? 'success' : 'error', {
    normalizedAction: canonicalAction,
    executor: executed ? 'central' : 'fallback_failed',
  });
  trackKroniaCta('result', executed ? 'success' : 'error', {
    normalizedAction: canonicalAction,
    path: executed ? 'centralized_executor' : 'centralized_executor_failed',
  });
  return executed;
};

window.executeConversationCta = function executeConversationCta(data) {
  if (!data || !data.action) return false;
  var meta = sanitizeCtaObject(data.meta);
  if (!meta.label && data.label) meta.label = data.label;
  return window.handleKroniaCTA(data.action, sanitizeCtaObject(data.payload), meta);
};

function executeKroniaQuickAction(action, payload, meta) {
  if (typeof window.handleKroniaCTA === 'function') {
    return window.handleKroniaCTA(action, sanitizeCtaObject(payload), sanitizeCtaObject(meta));
  }
  return runKroniaActionFallback(resolveCanonicalKroniaAction(action), sanitizeCtaObject(payload));
}

function installConversationCtaDelegation() {
  if (__kroniaCtaDelegationInstalled || window.__kroniaCtaDelegationInstalled) return;
  __kroniaCtaDelegationInstalled = true;
  window.__kroniaCtaDelegationInstalled = true;

  document.addEventListener('click', function (event) {
    var target = event && event.target && typeof event.target.closest === 'function'
      ? event.target.closest('.kronia-cta[data-action]')
      : null;
    if (!target) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();

    var action = String(target.getAttribute('data-action') || '');
    var label = String(target.getAttribute('data-cta-label') || '');
    var payloadRaw = String(target.getAttribute('data-cta-payload') || '');
    var metaRaw = String(target.getAttribute('data-cta-meta') || '');
    var payload = parseCtaPayloadAttribute(payloadRaw);
    var meta = parseCtaMetaAttribute(metaRaw);
    meta.label = label || meta.label || null;
    trackKroniaCta('click_received', 'success', {
      actionRaw: action,
      normalizedAction: resolveCanonicalKroniaAction(action),
      hasPayload: !!Object.keys(payload).length,
      hasMeta: !!Object.keys(meta).length,
    });

    var executed = window.handleKroniaCTA(action, payload, meta);
    writeAuditTracePatch({
      conversation: {
        ctaClicked: !!executed,
        ctaAction: resolveCanonicalKroniaAction(action) || String(action || ''),
        ctaLabel: label || null,
        payload: payload,
        meta: meta,
        timestamp: new Date().toISOString(),
      },
    });
  });
}

installConversationCtaDelegation();

function addOrientMsg(containerId, role, text) {
  const c = document.getElementById(containerId);
  if (!c) return null;
  const wrap = document.createElement("div");
  wrap.className = `ai-msg ${role}`;
  wrap.setAttribute("data-role", role);

  const kronosAvatar = getKronosAvatarMarkup("orient-kronos-avatar");

  if (role === "assistant") {
    wrap.innerHTML = `${kronosAvatar}<div class="ai-avatar-inner"><div class="ai-bubble">${renderMarkdown(text)}</div></div>`;
  } else {
    wrap.innerHTML = `<div class="ai-avatar-inner"><div class="ai-bubble">${renderMarkdown(text)}</div></div>`;
  }

  c.appendChild(wrap);
  c.scrollTop = c.scrollHeight;
  return wrap.querySelector(".ai-bubble");
}

// ─── KRONOS central call ────────────────────────────────────────────────────
// /api/chat é o backend canônico JSON; mantém uma repetição curta para falhas transitórias.
async function _kronosCall(messages, userData, onChunk) {
  async function tryJson() {
    const resp = await apiFetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages, history: userData.history, profile: userData.profile, stream: false })
    });
    if (!resp.ok) return null;
    const data = await parseApiJsonSafely(resp);
    const text = (data.message || data.data?.content?.[0]?.text || data.content?.[0]?.text || '').trim();
    if (text && onChunk) onChunk(text);
    return text || null;
  }

  let result = await tryJson();
  if (result) return result;

  await new Promise(r => setTimeout(r, 2000));
  result = await tryJson();
  if (result) return result;

  throw new Error('sem_resposta');
}

async function sendOrientExpert() {
  var input = document.getElementById('orientExpertInput');
  var text = String(input?.value || '').trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  function renderAI(message) {
    addOrientMsg('orientExpertMessages', 'assistant', String(message || 'Ok'));
  }

  addOrientMsg('orientExpertMessages', 'user', text);
  try {
    var userData = buildUserData();
    var response = await apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
        history: userData.history,
        profile: userData.profile,
        requestId: 'orient_' + Date.now()
      })
    });
    var data = await parseApiJsonSafely(response);
    renderAI(data.message || data.data?.content?.[0]?.text || 'Ok');
    renderInferredConversationCta('orientExpertMessages', data);
  } catch (_err) {
    var result = await resolveKronosConversation(text);
    if (result.type === 'answer_with_cta') {
      renderAI(result.message);
      renderConversationCta('orientExpertMessages', result.cta, Object.assign({}, result.payload || {}, { _targetModule: result.targetModule || null }));
      return;
    }
    renderAI(result.message || 'Ok');
  }
}


function orientExpertQuick(tipo) {
  if (tipo === 'basal') {
    const cfg = safeJSON("kronia_config", {});
    const peso   = parseFloat(cfg.peso)   || null;
    const altura = parseFloat(cfg.altura) || null;
    const idade  = parseInt(cfg.idade)    || null;
    const sexo   = cfg.sexo === "F" ? "feminino" : "masculino";
    const ativ   = cfg.atividade || "moderadamente ativo";
    let msg = "Calcule minha Taxa Metabólica Basal (TMB) e meu TDEE (gasto calórico total diário). Use a fórmula de Mifflin-St Jeor.";
    if (peso && altura && idade) {
      msg += ` Meus dados: ${peso} kg, ${altura} cm, ${idade} anos, sexo ${sexo}, nível de atividade: ${ativ}.`;
      msg += " Mostre passo a passo: TMB → TDEE para cada nível de atividade. E explique o que cada valor significa.";
    } else {
      msg += " (Não encontrei todos os dados do seu perfil — por favor informe: peso, altura, idade, sexo e nível de atividade.)";
    }
    document.getElementById("orientExpertInput").value = msg;
    sendOrientExpert();
    return;
  }
  if (tipo === 'dieta') {
    try { closeOrientacao(); } catch (_) {}
    try { navTo('dieta'); openDietDataScreen(); } catch (_) {}
    return;
  }
  const msgs = {
    analise:     "Analise meu treino atual e me dê feedback técnico.",
    plato:       "Detecte se há sinais de platô no meu histórico de treinos.",
    rpe:         "Baseado no meu RPE recente, devo ajustar minha carga?",
    suplementos: "Quais suplementos têm evidência científica real e valem a pena?",
    postreino:   "O que comer no pós-treino para maximizar recuperação?"
  };
  document.getElementById("orientExpertInput").value = msgs[tipo] || "";
  sendOrientExpert();
}

/* ── KRONOS Nutritionist Questionnaire ───────────────── */
var _wdRespostas = {};

function iniciarFluxoDietaNutri() {
  try {
    closeOrientacao();
    openDietaSheet({ source: "legacy_chat_diet_intake_redirect", returnTab: "dieta" });
    return;
  } catch (_) {}
  // Garante que a tela de orientação está aberta
  const screen = document.getElementById('orientacaoScreen');
  if (screen && !screen.classList.contains('show')) _showEl(screen);

  // Remove card anterior
  document.getElementById('wdCard')?.remove();
  _wdRespostas = {};

  // Pré-preenche dados do perfil se disponíveis
  const cfg = safeJSON('kronia_config', {});
  if (cfg.peso)   _wdRespostas.peso   = cfg.peso + ' kg';
  if (cfg.altura) _wdRespostas.altura = cfg.altura + ' cm';
  if (cfg.idade)  _wdRespostas.idade  = cfg.idade + ' anos';
  if (cfg.sexo)   _wdRespostas.sexo   = cfg.sexo === 'F' ? 'Feminino' : 'Masculino';

  const container = document.getElementById('orientExpertMessages');
  if (!container) return;

  const chipStyle = 'display:inline-block;padding:7px 14px;margin:4px 4px 0 0;border-radius:20px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:0.82rem;font-weight:600;cursor:pointer;font-family:var(--font);transition:all .15s;';
  const sectionStyle = 'margin-top:14px;';
  const labelStyle = 'font-size:0.85rem;color:var(--text-2);margin:0 0 6px;';

  const card = document.createElement('div');
  card.id = 'wdCard';
  card.className = 'ai-msg assistant';
  card.innerHTML = `
    <div class="ai-avatar-inner">
      <div class="ai-bubble" style="max-width:100%;">
        <b style="font-size:0.95rem;">Vou montar a dieta ideal pra você! Me conta um pouco sobre você 🥗</b>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">🎯 <b>Objetivo:</b></p>
          <div>
            <button style="${chipStyle}" onclick="wdSelect(this,'objetivo','Emagrecimento')">Emagrecimento</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'objetivo','Ganho de massa')">Ganho de massa</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'objetivo','Definição')">Definição</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'objetivo','Manutenção / saúde')">Manutenção</button>
          </div>
        </div>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">📅 <b>Refeições por dia:</b></p>
          <div>
            <button style="${chipStyle}" onclick="wdSelect(this,'refeicoes','3 refeições por dia')">3x</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'refeicoes','4 refeições por dia')">4x</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'refeicoes','5 refeições por dia')">5x</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'refeicoes','6 refeições por dia')">6x</button>
          </div>
        </div>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">🥗 <b>Restrições alimentares:</b></p>
          <div>
            <button style="${chipStyle}" onclick="wdSelect(this,'restricao','Nenhuma restrição')">Nenhuma</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'restricao','Vegetariano')">Vegetariano</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'restricao','Vegano')">Vegano</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'restricao','Intolerante à lactose')">Sem lactose</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'restricao','Intolerante ao glúten')">Sem glúten</button>
          </div>
        </div>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">🏥 <b>Patologia ou condição de saúde:</b></p>
          <div>
            <button style="${chipStyle}" onclick="wdSelect(this,'patologia','Nenhuma')">Nenhuma</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'patologia','Diabetes tipo 2')">Diabetes</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'patologia','Hipertensão arterial')">Hipertensão</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'patologia','Colesterol alto')">Colesterol</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'patologia','Hipotireoidismo')">Tireoide</button>
          </div>
        </div>

        <div style="${sectionStyle}">
          <p style="${labelStyle}">🍽️ <b>Preferência de pratos:</b></p>
          <div>
            <button style="${chipStyle}" onclick="wdSelect(this,'pratos','Comida brasileira tradicional (arroz, feijão, frango, etc.)')">Brasileira</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'pratos','Fitness simples e prático')">Fitness simples</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'pratos','Variedade de culinárias')">Variado</button>
            <button style="${chipStyle}" onclick="wdSelect(this,'pratos','Sem preferência, qualquer coisa saudável')">Qualquer</button>
          </div>
        </div>

        <div id="wdGerarBtn" style="display:none;margin-top:16px;">
          <button onclick="gerarDietaComRespostas()" style="width:100%;padding:13px 16px;background:var(--green, #22c55e);border:none;border-radius:12px;color:#fff;font-family:var(--font);font-size:0.9rem;font-weight:700;cursor:pointer;">
            ${_ico('utensils', 15)} Gerar minha dieta personalizada
          </button>
        </div>
      </div>
    </div>`;

  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

function wdSelect(btn, campo, valor) {
  _wdRespostas[campo] = valor;

  const group = btn.parentElement;
  group.querySelectorAll('button').forEach(function(b) {
    b.style.background = 'transparent';
    b.style.color = 'var(--accent)';
  });
  btn.style.background = 'var(--accent)';
  btn.style.color = '#fff';

  const required = ['objetivo', 'refeicoes', 'restricao', 'patologia', 'pratos'];
  const allDone = required.every(function(k) { return _wdRespostas[k]; });
  const gerarBtn = document.getElementById('wdGerarBtn');
  if (gerarBtn) gerarBtn.style.display = allDone ? 'block' : 'none';

  const container = document.getElementById('orientExpertMessages');
  if (container) container.scrollTop = container.scrollHeight;
}

async function gerarDietaComRespostas() {
  try { closeOrientacao(); } catch (_) {}
  document.getElementById('wdCard')?.remove();

  const r = _wdRespostas;
  const dadosPerfil = [
    r.sexo   ? '- Sexo: '   + r.sexo   : '',
    r.peso   ? '- Peso: '   + r.peso   : '',
    r.altura ? '- Altura: ' + r.altura : '',
    r.idade  ? '- Idade: '  + r.idade  : '',
  ].filter(Boolean).join('\n');

  const prompt = [
    'Crie uma dieta personalizada e detalhada para mim com as seguintes informações:',
    '',
    '**Objetivo:** ' + (r.objetivo || 'Manutenção'),
    '**Refeições por dia:** ' + (r.refeicoes || '4 refeições por dia'),
    '**Restrições alimentares:** ' + (r.restricao || 'Nenhuma'),
    '**Patologia/condição:** ' + (r.patologia || 'Nenhuma'),
    '**Preferência de pratos:** ' + (r.pratos || 'Sem preferência'),
    dadosPerfil ? '\n**Dados físicos:**\n' + dadosPerfil : '',
    '',
    'Monte um cardápio completo com cada refeição, alimentos, quantidades em gramas e macros aproximados (proteínas, carboidratos, gorduras e calorias). Considere a patologia informada para evitar alimentos contraindicados. Use pratos reais e acessíveis de acordo com a preferência informada. No final, adicione orientações gerais de nutrição.',
  ].filter(Boolean).join('\n');

  _wdRespostas = {};
  document.getElementById('orientExpertInput').value = prompt;
  await sendOrientExpert();

  // Adiciona botão de exportar PDF após a dieta ser gerada
  const container = document.getElementById('orientExpertMessages');
  if (!container) return;
  const wrap = document.createElement('div');
  wrap.className = 'ai-msg assistant transform-wrap';
  const btn = document.createElement('button');
  btn.className = 'transform-btn';
  btn.style.cssText = 'display:block;width:100%;padding:12px 16px;background:rgba(34,197,94,0.12);border:1.5px solid var(--green,#22c55e);border-radius:12px;color:var(--green,#22c55e);font-family:var(--font);font-size:0.88rem;font-weight:700;cursor:pointer;text-align:left;transition:all .15s;animation:fadeInUp .3s ease;';
  btn.innerHTML = _ico('file-text', 14) + ' Exportar dieta em PDF';
  btn.onclick = function() { exportarDietaChatPDF(); wrap.remove(); };
  wrap.appendChild(btn);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

function exportarDietaChatPDF() {
  if (typeof exportActiveDietPlanPDF === "function") {
    exportActiveDietPlanPDF();
    return;
  }
  // Pega o último bubble de assistente do chat de orientação
  const container = document.getElementById('orientExpertMessages');
  if (!container) return;
  const bubbles = container.querySelectorAll('.ai-msg[data-role="assistant"] .ai-bubble, .ai-msg.assistant .ai-bubble');
  if (!bubbles.length) { showToast('Nenhuma dieta gerada ainda.', 'info'); return; }
  const content = bubbles[bubbles.length - 1].innerHTML;

  const cfg  = safeJSON('kronia_config', {});
  const nome = cfg.nome || 'Atleta';
  const data = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });

  const win = window.open('', '_blank');
  if (!win) { showToast('Permita popups para gerar o PDF.', 'info'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dieta KRONIA</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #222; line-height: 1.6; }
    h1 { color: #ff6b00; font-size: 1.4rem; } h2 { color: #333; font-size: 1.1rem; margin-top: 1.5em; }
    p { margin: 0.4em 0; } ul,ol { padding-left: 1.4em; }
    .header { border-bottom: 2px solid #ff6b00; padding-bottom: 12px; margin-bottom: 20px; }
    .footer { margin-top: 30px; font-size: 0.8rem; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
    @media print { body { margin: 20px; } }
  </style></head><body>
  <div class="header"><h1>Dieta Personalizada — KRONIA</h1><p><b>Atleta:</b> ${nome} &nbsp;|&nbsp; <b>Data:</b> ${data}</p></div>
  <div>${content}</div>
  <div class="footer">Gerado por KRONIA · Consulte sempre um nutricionista.</div>
  <script>window.onload=function(){window.print();}<\/script></body></html>`);
  win.document.close();
}

// ── Dieta Sheet ──────────────────────────────────────
function formatDietMasterKcal(value) {
  var n = Number(value || 0);
  return n > 0 ? n.toLocaleString("pt-BR") + " kcal" : "-- kcal";
}

function readDietMasterTrainingSnapshot() {
  var hist = safeJSON(STORAGE.historyKey, []);
  var draft = safeJSON(STORAGE.draftKey, null);
  var sections = Array.isArray(draft && draft.sections) ? draft.sections : [];
  var now = Date.now();
  var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  var recent = (Array.isArray(hist) ? hist : []).filter(function(item) {
    var created = new Date(item && (item.createdAt || item.date || item.data)).getTime();
    return Number.isFinite(created) && now - created <= sevenDaysMs;
  });
  var last = recent.length ? recent[recent.length - 1] : ((Array.isArray(hist) && hist.length) ? hist[hist.length - 1] : null);
  var volume = recent.reduce(function(acc, item) {
    try { return acc + Number(calcVolumeTotal(item.state) || 0); } catch (_) { return acc; }
  }, 0);
  return {
    sessions7d: recent.length,
    volume7d: Math.round(volume),
    plannedDays: sections.length,
    lastWorkoutAt: last && (last.createdAt || last.date || last.data) ? (last.createdAt || last.date || last.data) : null,
    split: sections.map(function(sec) { return sec && (sec.treinoKey || sec.nome || sec.name); }).filter(Boolean).slice(0, 6),
  };
}

function summarizeDietMasterClinical(input) {
  var patologia = String(input && input.patologia || "").toLowerCase();
  var lab = input && input.supabaseSnapshot && input.supabaseSnapshot.latestLabReport ? input.supabaseSnapshot.latestLabReport : null;
  var flags = []
    .concat(lab && Array.isArray(lab.clinicalFlags) ? lab.clinicalFlags : [])
    .concat(lab && Array.isArray(lab.criticalFlags) ? lab.criticalFlags : []);
  var flagsText = flags.join(" ").toLowerCase();
  var hasDiabetes = /diabetes|resist[eê]ncia.*insulina|insulina|glycemic|hba1c|pre_diabetes|glic/.test(patologia + " " + flagsText);
  var layers = [];
  if (hasDiabetes) layers.push("Diabetes/glicemia priorizada");
  if (/hipertens|pressao|pressão/.test(patologia + " " + flagsText)) layers.push("Pressão arterial");
  if (/colesterol|dislipidem|ldl|lipid/.test(patologia + " " + flagsText)) layers.push("Perfil lipídico");
  if (/renal|rim|creatin|kidney|drc/.test(patologia + " " + flagsText)) layers.push("Rim/DRC");
  if (/esteatose|hepat|figado|fígado|liver/.test(patologia + " " + flagsText)) layers.push("Fígado/esteatose");
  if (!layers.length && patologia && patologia !== "nenhuma") layers.push("Condição informada");
  return {
    label: layers.length ? layers.slice(0, 2).join(" + ") : (lab && lab.isValid ? "Exame validado" : "Sem exame validado"),
    detail: flags.length ? (flags.length + " sinal(is) clínico(s) estruturados") : (layers.length ? "Restrições combinadas de forma conservadora" : "Aguardando exames ou condições"),
    hasDiabetes: hasDiabetes,
  };
}

function renderDietMasterMealPreview(plan) {
  var container = document.getElementById("dietMasterMealPreview");
  if (!container || !plan || !Array.isArray(plan.refeicoes)) return;
  container.innerHTML = plan.refeicoes.slice(0, 6).map(function(meal) {
    var subtotal = meal.subtotal || {};
    return `<button type="button" onclick="openKronosFromDieta('Trocar uma refeição mantendo meu alvo do dia.')" class="diet-master-meal-card">
      <span>${meal.horario || "Hoje"}</span>
      <strong>${meal.nome || "Refeição"}</strong>
      <small>${subtotal.kcal || "--"} kcal · P ${subtotal.prot || "--"}g · C ${subtotal.carb || "--"}g · G ${subtotal.gord || "--"}g</small>
    </button>`;
  }).join("");
}

function renderDietMasterSnapshot(input, baseline) {
  var safeInput = input && typeof input === "object" ? input : {};
  var safeBaseline = baseline || computeDietGenerationBaseline(safeInput);
  var training = readDietMasterTrainingSnapshot();
  window._dietaTrainingSnapshot = training;

  var targetKcal = document.getElementById("dietMasterTargetKcal");
  var targetDelta = document.getElementById("dietMasterTargetDelta");
  var targetMacros = document.getElementById("dietMasterTargetMacros");
  var targetProtein = document.getElementById("dietMasterTargetProtein");
  var tmbEl = document.getElementById("dietMasterTmb");
  var activitiesEl = document.getElementById("dietMasterActivities");
  var activityImpactEl = document.getElementById("dietMasterActivityImpact");
  var trainingEl = document.getElementById("dietMasterTraining");
  var trainingImpactEl = document.getElementById("dietMasterTrainingImpact");
  var clinicalEl = document.getElementById("dietMasterClinical");
  var clinicalImpactEl = document.getElementById("dietMasterClinicalImpact");
  var todayModeEl = document.getElementById("dietMasterTodayMode");

  if (targetKcal) targetKcal.textContent = formatDietMasterKcal(safeBaseline.metaCalorias);
  if (targetDelta) targetDelta.textContent = "Gasto total " + formatDietMasterKcal(safeBaseline.tdee) + " ajustado para " + String(safeInput.objetivo || "objetivo");
  if (targetMacros) targetMacros.textContent = "P " + (safeBaseline.proteinaMeta || "--") + "g · C " + (safeBaseline.carboMeta || "--") + "g · G " + (safeBaseline.gorduraMeta || "--") + "g";
  if (targetProtein) targetProtein.textContent = "Proteína e carboidrato calculados por peso, objetivo e treino";
  if (tmbEl) tmbEl.textContent = formatDietMasterKcal(safeBaseline.tmb);
  if (activitiesEl) activitiesEl.textContent = String(safeInput.nivelAtividade || "Rotina base");
  if (activityImpactEl) activityImpactEl.textContent = "Multiplicador aplicado ao gasto diário";
  if (trainingEl) trainingEl.textContent = training.sessions7d ? (training.sessions7d + " treino(s) em 7 dias") : (training.plannedDays ? (training.plannedDays + " dia(s) planejados") : String(safeInput.frequenciaTreino || "Sem histórico recente"));
  if (trainingImpactEl) trainingImpactEl.textContent = training.volume7d ? (training.volume7d.toLocaleString("pt-BR") + " kg de volume recente") : [safeInput.frequenciaTreino, safeInput.duracaoTreino, safeInput.tipoTreino].filter(Boolean).join(" · ");
  var clinical = summarizeDietMasterClinical(safeInput);
  if (clinicalEl) clinicalEl.textContent = clinical.label;
  if (clinicalImpactEl) clinicalImpactEl.textContent = clinical.detail;
  if (todayModeEl) todayModeEl.textContent = /não treino|nao treino/i.test(String(safeInput.frequenciaTreino || "")) ? "Dia de descanso" : "Dia com demanda de treino";
}

function openKronosFromDieta(initialPrompt) {
  var input = {};
  try { input = collectDietGenerationInput(); } catch (_) {}
  var baseline = computeDietGenerationBaseline(input);
  window._kronosEntryContext = {
    origin: "dieta_ia",
    source: "diet_master_workspace",
    dietSnapshot: {
      targetCalories: baseline.metaCalorias,
      macros: { protein: baseline.proteinaMeta, carbs: baseline.carboMeta, fat: baseline.gorduraMeta },
      mealsPerDay: input.refeicoesPorDia,
      objective: input.objetivo,
      adherence: input.aderencia || null,
    },
    trainingContext: window._dietaTrainingSnapshot || readDietMasterTrainingSnapshot(),
    labContext: input.supabaseSnapshot && input.supabaseSnapshot.latestLabReport ? input.supabaseSnapshot.latestLabReport : null,
    healthContext: { patologia: input.patologia, medicamentos: input.medicamentos },
  };
  try { closeDietaSheet(); } catch (_) {}
  openAI();
  if (initialPrompt) {
    setTimeout(function() {
      var aiInput = document.getElementById("aiInput");
      if (aiInput) aiInput.value = String(initialPrompt);
      sendAI(String(initialPrompt), false);
    }, 60);
  }
}

function dietMasterRegisterMeal() {
  showToast("Registro de refeição preparado. Use o plano gerado para concluir cada refeição.", "info", 3600);
}

function dietMasterCheckIn() {
  openKronosFromDieta("Fazer check-in da minha dieta: avaliar aderência, fome, treino, exames e sugerir ajuste controlado para esta semana.");
}

var KRONIA_NUTRITION_SNAPSHOT_KEY = "kronia_nutrition_snapshot_v1";
var NUTRITION_FLOW_STEPS = [];

var NUTRITION_FOOD_CATALOG = [
  { id: "prot_frango", nome: "Frango grelhado", grupo: "proteinas", subgrupo: "aves", porcao: "120 g", unidade: "g", kcal: 198, proteina: 37, carboidrato: 0, gordura: 4, fibra: 0, tags: ["força", "prático"], restricoes: [], practicalScore: 5, costScore: 4 },
  { id: "prot_ovos", nome: "Ovos mexidos", grupo: "proteinas", subgrupo: "ovos", porcao: "3 un", unidade: "un", kcal: 210, proteina: 18, carboidrato: 1, gordura: 15, fibra: 0, tags: ["café da manhã"], restricoes: ["ovo"], practicalScore: 5, costScore: 5 },
  { id: "prot_patinho", nome: "Patinho grelhado", grupo: "proteinas", subgrupo: "bovinos", porcao: "120 g", unidade: "g", kcal: 225, proteina: 34, carboidrato: 0, gordura: 10, fibra: 0, tags: ["principal"], restricoes: [], practicalScore: 4, costScore: 3 },
  { id: "prot_tilapia", nome: "Tilápia grelhada", grupo: "proteinas", subgrupo: "peixes", porcao: "140 g", unidade: "g", kcal: 180, proteina: 33, carboidrato: 0, gordura: 4, fibra: 0, tags: ["leve"], restricoes: ["peixe"], practicalScore: 4, costScore: 3 },
  { id: "prot_atum", nome: "Atum em lata", grupo: "proteinas", subgrupo: "peixes", porcao: "1 lata", unidade: "lata", kcal: 170, proteina: 30, carboidrato: 0, gordura: 5, fibra: 0, tags: ["rápido"], restricoes: ["peixe"], practicalScore: 5, costScore: 3 },
  { id: "prot_whey", nome: "Whey protein", grupo: "proteinas", subgrupo: "suplementos", porcao: "30 g", unidade: "g", kcal: 120, proteina: 24, carboidrato: 3, gordura: 2, fibra: 0, tags: ["rápido", "pós-treino"], restricoes: ["lactose"], practicalScore: 5, costScore: 2 },
  { id: "prot_tofu", nome: "Tofu firme", grupo: "proteinas", subgrupo: "vegetais proteicos", porcao: "200 g", unidade: "g", kcal: 192, proteina: 20, carboidrato: 5, gordura: 11, fibra: 2, tags: ["vegano"], restricoes: ["soja"], practicalScore: 4, costScore: 3 },
  { id: "prot_graobico", nome: "Grão-de-bico cozido", grupo: "proteinas", subgrupo: "vegetais proteicos", porcao: "130 g", unidade: "g", kcal: 213, proteina: 11, carboidrato: 35, gordura: 3.5, fibra: 10, tags: ["vegano", "fibra"], restricoes: [], practicalScore: 3, costScore: 4 },
  { id: "prot_lentilha", nome: "Lentilha cozida", grupo: "proteinas", subgrupo: "vegetais proteicos", porcao: "140 g", unidade: "g", kcal: 162, proteina: 12.6, carboidrato: 28, gordura: 0.6, fibra: 11, tags: ["vegano", "fibra"], restricoes: [], practicalScore: 3, costScore: 5 },

  { id: "carb_arroz", nome: "Arroz cozido", grupo: "carboidratos", subgrupo: "arroz e grãos", porcao: "120 g", unidade: "g", kcal: 156, proteina: 3, carboidrato: 34, gordura: 0.4, fibra: 1, tags: ["base"], restricoes: [], practicalScore: 5, costScore: 5 },
  { id: "carb_feijao", nome: "Feijão cozido", grupo: "carboidratos", subgrupo: "leguminosas", porcao: "100 g", unidade: "g", kcal: 76, proteina: 4.8, carboidrato: 13.6, gordura: 0.5, fibra: 8.5, tags: ["fibra"], restricoes: [], practicalScore: 4, costScore: 5 },
  { id: "carb_batatadoce", nome: "Batata-doce cozida", grupo: "carboidratos", subgrupo: "tubérculos", porcao: "130 g", unidade: "g", kcal: 112, proteina: 2, carboidrato: 26, gordura: 0.1, fibra: 3.9, tags: ["pré-treino"], restricoes: [], practicalScore: 4, costScore: 4 },
  { id: "carb_aveia", nome: "Aveia", grupo: "carboidratos", subgrupo: "cereais", porcao: "40 g", unidade: "g", kcal: 156, proteina: 6.8, carboidrato: 26.5, gordura: 3.4, fibra: 4.2, tags: ["café da manhã"], restricoes: ["glúten"], practicalScore: 5, costScore: 4 },
  { id: "carb_macarrao", nome: "Macarrão cozido", grupo: "carboidratos", subgrupo: "massas", porcao: "120 g", unidade: "g", kcal: 188, proteina: 6, carboidrato: 37, gordura: 1.2, fibra: 2, tags: ["energia"], restricoes: ["glúten"], practicalScore: 4, costScore: 4 },
  { id: "carb_pao", nome: "Pão integral", grupo: "carboidratos", subgrupo: "pães", porcao: "2 fatias", unidade: "fatias", kcal: 128, proteina: 6, carboidrato: 24, gordura: 2, fibra: 4, tags: ["rápido"], restricoes: ["glúten"], practicalScore: 5, costScore: 4 },
  { id: "carb_tapioca", nome: "Tapioca", grupo: "carboidratos", subgrupo: "cereais", porcao: "60 g", unidade: "g", kcal: 150, proteina: 0.2, carboidrato: 37, gordura: 0, fibra: 0.3, tags: ["rápido"], restricoes: [], practicalScore: 5, costScore: 4 },
  { id: "carb_mandioca", nome: "Mandioca cozida", grupo: "carboidratos", subgrupo: "tubérculos", porcao: "120 g", unidade: "g", kcal: 150, proteina: 1.2, carboidrato: 36, gordura: 0.3, fibra: 2, tags: ["energia"], restricoes: [], practicalScore: 3, costScore: 4 },

  { id: "fat_azeite", nome: "Azeite de oliva", grupo: "gorduras", subgrupo: "azeites e óleos", porcao: "10 g", unidade: "g", kcal: 88, proteina: 0, carboidrato: 0, gordura: 10, fibra: 0, tags: ["molho"], restricoes: [], practicalScore: 5, costScore: 3 },
  { id: "fat_abacate", nome: "Abacate", grupo: "gorduras", subgrupo: "abacate / azeitona", porcao: "100 g", unidade: "g", kcal: 96, proteina: 1.2, carboidrato: 6, gordura: 8.4, fibra: 6, tags: ["saciedade"], restricoes: [], practicalScore: 4, costScore: 3 },
  { id: "fat_castanhas", nome: "Castanhas", grupo: "gorduras", subgrupo: "oleaginosas", porcao: "20 g", unidade: "g", kcal: 120, proteina: 3, carboidrato: 4, gordura: 10, fibra: 2, tags: ["lanche"], restricoes: ["oleaginosas"], practicalScore: 5, costScore: 2 },
  { id: "fat_pasta_amendoim", nome: "Pasta de amendoim", grupo: "gorduras", subgrupo: "pastas", porcao: "20 g", unidade: "g", kcal: 118, proteina: 5, carboidrato: 4, gordura: 10, fibra: 1.6, tags: ["café da manhã"], restricoes: ["amendoim"], practicalScore: 5, costScore: 4 },
  { id: "fat_sementes", nome: "Sementes de chia", grupo: "gorduras", subgrupo: "sementes", porcao: "15 g", unidade: "g", kcal: 73, proteina: 2.5, carboidrato: 6.3, gordura: 4.6, fibra: 5.2, tags: ["fibra"], restricoes: [], practicalScore: 4, costScore: 3 },
  { id: "fat_tahine", nome: "Tahine", grupo: "gorduras", subgrupo: "pastas", porcao: "20 g", unidade: "g", kcal: 119, proteina: 3.4, carboidrato: 4.2, gordura: 10.7, fibra: 1.8, tags: ["vegano"], restricoes: ["gergelim"], practicalScore: 3, costScore: 2 },

  { id: "fruit_banana", nome: "Banana", grupo: "frutas", subgrupo: "mais energéticas", porcao: "1 un", unidade: "un", kcal: 80, proteina: 1, carboidrato: 20.7, gordura: 0.2, fibra: 2.6, tags: ["pré-treino"], restricoes: [], practicalScore: 5, costScore: 5 },
  { id: "fruit_maca", nome: "Maçã", grupo: "frutas", subgrupo: "neutras", porcao: "1 un", unidade: "un", kcal: 72, proteina: 0.3, carboidrato: 19, gordura: 0.2, fibra: 3.3, tags: ["lanche"], restricoes: [], practicalScore: 5, costScore: 4 },
  { id: "fruit_vermelhas", nome: "Frutas vermelhas", grupo: "frutas", subgrupo: "menor impacto glicêmico", porcao: "140 g", unidade: "g", kcal: 70, proteina: 1, carboidrato: 16, gordura: 0.5, fibra: 5, tags: ["diabetes"], restricoes: [], practicalScore: 3, costScore: 2 },
  { id: "fruit_laranja", nome: "Laranja", grupo: "frutas", subgrupo: "neutras", porcao: "1 un", unidade: "un", kcal: 62, proteina: 1.2, carboidrato: 15.4, gordura: 0.2, fibra: 3.1, tags: ["vitamina c"], restricoes: [], practicalScore: 4, costScore: 5 },
  { id: "fruit_mamao", nome: "Mamão", grupo: "frutas", subgrupo: "neutras", porcao: "160 g", unidade: "g", kcal: 69, proteina: 0.8, carboidrato: 17, gordura: 0.4, fibra: 2.7, tags: ["digestivo"], restricoes: [], practicalScore: 4, costScore: 4 },

  { id: "veg_brocolis", nome: "Brócolis cozido", grupo: "vegetais", subgrupo: "crucíferos", porcao: "100 g", unidade: "g", kcal: 25, proteina: 3, carboidrato: 4.4, gordura: 0.5, fibra: 3.4, tags: ["volume"], restricoes: [], practicalScore: 4, costScore: 4 },
  { id: "veg_salada", nome: "Salada verde", grupo: "vegetais", subgrupo: "folhas", porcao: "1 prato", unidade: "prato", kcal: 20, proteina: 1, carboidrato: 3, gordura: 0.2, fibra: 2, tags: ["baixo amido"], restricoes: [], practicalScore: 5, costScore: 5 },
  { id: "veg_cenoura", nome: "Cenoura cozida", grupo: "vegetais", subgrupo: "legumes", porcao: "100 g", unidade: "g", kcal: 30, proteina: 1, carboidrato: 7, gordura: 0.2, fibra: 2.8, tags: ["legume"], restricoes: [], practicalScore: 4, costScore: 5 },
  { id: "veg_abobrinha", nome: "Abobrinha refogada", grupo: "vegetais", subgrupo: "vegetais de baixo amido", porcao: "120 g", unidade: "g", kcal: 32, proteina: 1.4, carboidrato: 5.6, gordura: 0.6, fibra: 1.8, tags: ["baixo amido"], restricoes: [], practicalScore: 4, costScore: 4 },
  { id: "veg_tomate", nome: "Tomate", grupo: "vegetais", subgrupo: "aromáticos", porcao: "100 g", unidade: "g", kcal: 18, proteina: 0.9, carboidrato: 3.9, gordura: 0.2, fibra: 1.2, tags: ["salada"], restricoes: [], practicalScore: 5, costScore: 5 },

  { id: "lac_iogurte_grego", nome: "Iogurte grego natural", grupo: "laticinios", subgrupo: "iogurtes", porcao: "170 g", unidade: "g", kcal: 130, proteina: 17, carboidrato: 6, gordura: 4, fibra: 0, tags: ["café da manhã"], restricoes: ["lactose"], practicalScore: 5, costScore: 3 },
  { id: "lac_iogurte", nome: "Iogurte natural", grupo: "laticinios", subgrupo: "iogurtes", porcao: "170 g", unidade: "g", kcal: 104, proteina: 6, carboidrato: 8, gordura: 5, fibra: 0, tags: ["lanche"], restricoes: ["lactose"], practicalScore: 5, costScore: 4 },
  { id: "lac_queijo", nome: "Queijo branco", grupo: "laticinios", subgrupo: "queijos", porcao: "40 g", unidade: "g", kcal: 98, proteina: 7.2, carboidrato: 1.2, gordura: 7.2, fibra: 0, tags: ["lanche"], restricoes: ["lactose"], practicalScore: 4, costScore: 3 },
  { id: "lac_leite", nome: "Leite", grupo: "laticinios", subgrupo: "leite", porcao: "200 ml", unidade: "ml", kcal: 122, proteina: 6.4, carboidrato: 9.6, gordura: 6.6, fibra: 0, tags: ["vitamina"], restricoes: ["lactose"], practicalScore: 5, costScore: 4 },
  { id: "lac_bebida_soja", nome: "Bebida vegetal de soja", grupo: "laticinios", subgrupo: "bebidas vegetais", porcao: "200 ml", unidade: "ml", kcal: 82, proteina: 6.6, carboidrato: 4.6, gordura: 4, fibra: 1.2, tags: ["vegano"], restricoes: ["soja"], practicalScore: 4, costScore: 3 },

  { id: "temp_ervas", nome: "Ervas secas", grupo: "temperos", subgrupo: "secos", porcao: "1 colher chá", unidade: "colher", kcal: 3, proteina: 0.1, carboidrato: 0.5, gordura: 0, fibra: 0.2, tags: ["sabor"], restricoes: [], practicalScore: 5, costScore: 5 },
  { id: "temp_mostarda", nome: "Mostarda", grupo: "temperos", subgrupo: "pastosos", porcao: "10 g", unidade: "g", kcal: 7, proteina: 0.4, carboidrato: 0.5, gordura: 0.4, fibra: 0.3, tags: ["molho"], restricoes: [], practicalScore: 5, costScore: 4 },
  { id: "temp_vinagrete", nome: "Vinagrete", grupo: "temperos", subgrupo: "molhos", porcao: "30 g", unidade: "g", kcal: 22, proteina: 0.4, carboidrato: 2.5, gordura: 1, fibra: 0.7, tags: ["salada"], restricoes: [], practicalScore: 4, costScore: 5 },
  { id: "temp_alho_cebola", nome: "Alho e cebola", grupo: "temperos", subgrupo: "secos", porcao: "20 g", unidade: "g", kcal: 16, proteina: 0.5, carboidrato: 3.4, gordura: 0.1, fibra: 0.5, tags: ["base"], restricoes: [], practicalScore: 5, costScore: 5 },
];

var NUTRITION_GROUP_LABELS = {
  proteinas: "Proteínas",
  carboidratos: "Carboidratos",
  gorduras: "Gorduras / extras",
  frutas: "Frutas",
  vegetais: "Vegetais",
  laticinios: "Laticínios e substitutos",
  temperos: "Temperos / molhos",
};

function defaultNutritionFlowState() {
  return {
    step: 0,
    objetivo: "manter_peso",
    sexo: "masculino",
    peso: "82",
    altura: "178",
    idade: "",
    gorduraCorporal: "",
    cintura: "90",
    pescoco: "38",
    quadril: "100",
    treinoForca: "sim",
    nivelAtividade: "moderado",
    frequenciaTreino: "4x",
    horarioTreino: "tarde",
    fadiga: 5,
    tendenciaForca: "Estável",
    prioridadeMetabolica: "Render Mais",
    neat: "moderado",
    patologia: ["nenhuma"],
    restricoesClinicas: [],
    sinaisRelevantes: [],
    labsStatus: "detected",
    medicamentos: "",
    sinaisClinicos: "",
    padraoAlimentar: "onívoro",
    refeicoesPorDia: 4,
    sugestao: "flexível",
    preferenciasRapidas: ["flexível"],
    proteinas: ["Frango grelhado"],
    carboidratos: ["Arroz", "Feijão"],
    gorduras: ["Azeite de oliva", "Abacate"],
    frutas: ["Banana", "Maçã"],
    vegetais: ["Brócolis cozido", "Salada verde"],
    laticinios: ["Iogurte grego natural"],
    temperos: ["Ervas secas"],
    preferencias: "",
    alimentosEvitar: "",
    generatedPlan: null,
    generatedText: "",
    selectedMealIndex: 0,
    registeredMeals: {},
    checkin: { aderencia: "parcial", fome: "controlada", energia: "boa", observacoes: "" },
    healthConditions: [],
    otherHealthCondition: "",
    bcmManual: { dryWeightKg: "", bodyFatPercent: "", leanMassKg: "", muscleMassKg: "", totalBodyWaterLiters: "", bmi: "", waistCm: "", hipCm: "", notes: "" },
    bcmManualOpen: false,
    examContext: { useExistingExams: false, uploadedExamFile: null, uploadedExamName: null },
  };
}

function restoreNutritionFlowFromSnapshot() {
  try {
    var raw = localStorage.getItem(KRONIA_NUTRITION_SNAPSHOT_KEY);
    if (!raw) return null;
    var snap = JSON.parse(raw);
    if (!snap || snap.v !== 1) return null;
    var p = snap.profile || {};
    var food = snap.foodSelections || {};
    var ctx = snap.canonicalContext || {};
    var adh = p.aderencia || {};
    var nivelMap = {
      "sedentário": "sedentario", "sedentario": "sedentario",
      "levemente ativo": "leve", "moderadamente ativo": "moderado",
      "muito ativo": "intenso", "atleta": "intenso"
    };
    var def = defaultNutritionFlowState();
    return Object.assign({}, def, {
      objetivo:          mapObjectiveToPremiumFlow(p.objetivo) || def.objetivo,
      sexo:              p.sexo || def.sexo,
      peso:              p.peso       ? String(p.peso)       : def.peso,
      altura:            p.altura     ? String(p.altura)     : def.altura,
      idade:             p.idade      ? String(p.idade)      : def.idade,
      gorduraCorporal:   p.gorduraCorporal != null ? String(p.gorduraCorporal) : def.gorduraCorporal,
      cintura:           p.cintura    ? String(p.cintura)    : def.cintura,
      pescoco:           p.pescoco    ? String(p.pescoco)    : def.pescoco,
      quadril:           p.quadril    ? String(p.quadril)    : def.quadril,
      nivelAtividade:    nivelMap[String(p.nivelAtividade || "").toLowerCase()] || def.nivelAtividade,
      treinoForca:       p.frequenciaTreino === "não treino" ? "nao" : "sim",
      frequenciaTreino:  p.frequenciaTreino && p.frequenciaTreino !== "não treino" ? p.frequenciaTreino : def.frequenciaTreino,
      horarioTreino:     adh.horarioTreino || def.horarioTreino,
      refeicoesPorDia:   p.refeicoesPorDia  || def.refeicoesPorDia,
      padraoAlimentar:   p.padraoAlimentar  || def.padraoAlimentar,
      medicamentos:      p.medicamentos     || def.medicamentos,
      alimentosEvitar:   p.alimentosEvitar  || def.alimentosEvitar,
      neat:              adh.neat            || def.neat,
      fadiga:            adh.fadiga != null  ? adh.fadiga : def.fadiga,
      sugestao:          adh.modoAjuste      || def.sugestao,
      tendenciaForca:    adh.tendenciaForca  || def.tendenciaForca,
      prioridadeMetabolica: adh.prioridadeMetabolica || def.prioridadeMetabolica,
      patologia:         Array.isArray(ctx.patologias) && ctx.patologias.length ? ctx.patologias : def.patologia,
      proteinas:         food.proteinas    || def.proteinas,
      carboidratos:      food.carboidratos || def.carboidratos,
      gorduras:          food.gorduras     || def.gorduras,
      frutas:            food.frutas       || def.frutas,
      vegetais:          food.vegetais     || def.vegetais,
      laticinios:        food.laticinios   || def.laticinios,
      temperos:          food.temperos     || def.temperos,
      generatedPlan:     snap.activePlan   || def.generatedPlan,
      checkin:           snap.checkin      || def.checkin,
    });
  } catch (_) {
    return null;
  }
}

function getNutritionFlowState() {
  if (!window._nutritionFlowState) window._nutritionFlowState = restoreNutritionFlowFromSnapshot() || defaultNutritionFlowState();
  return window._nutritionFlowState;
}

function setNutritionFlowState(patch) {
  window._nutritionFlowState = Object.assign({}, getNutritionFlowState(), patch || {});
  syncNutritionFlowToLegacyDietForm();
  persistCanonicalNutritionSnapshot({ source: "nutrition_flow_state" });
}

function nutritionSelected(key, value) {
  var state = getNutritionFlowState();
  if (Array.isArray(state[key])) return state[key].indexOf(value) !== -1;
  return String(state[key]) === String(value);
}

function nutritionToggleArray(key, value, minExclusiveValue) {
  var state = getNutritionFlowState();
  var current = Array.isArray(state[key]) ? state[key].slice() : [];
  if (minExclusiveValue && value === minExclusiveValue) {
    setNutritionFlowState({ [key]: [minExclusiveValue] });
    renderNutritionFlow({ preserveScroll: true });
    return;
  }
  current = current.filter(function(item) { return item !== minExclusiveValue; });
  var idx = current.indexOf(value);
  if (idx >= 0) current.splice(idx, 1); else current.push(value);
  if (!current.length && minExclusiveValue) current = [minExclusiveValue];
  setNutritionFlowState({ [key]: current });
  renderNutritionFlow({ preserveScroll: true });
}

function nutritionSet(key, value) {
  setNutritionFlowState({ [key]: value });
  renderNutritionFlow({ preserveScroll: true });
}

function toggleHealthCondition(value) {
  var state = getNutritionFlowState();
  var conditions = Array.isArray(state.healthConditions) ? state.healthConditions.slice() : [];
  var idx = conditions.indexOf(value);
  if (idx >= 0) conditions.splice(idx, 1); else conditions.push(value);
  setNutritionFlowState({ healthConditions: conditions });
  renderNutritionFlow({ preserveScroll: true });
}

function toggleBcmManualOpen() {
  var state = getNutritionFlowState();
  setNutritionFlowState({ bcmManualOpen: !state.bcmManualOpen });
  renderNutritionFlow({ preserveScroll: true });
}

function setBcmManualField(key, value) {
  var state = getNutritionFlowState();
  var bcm = Object.assign({}, state.bcmManual || {});
  bcm[key] = value;
  setNutritionFlowState({ bcmManual: bcm });
}

function setExamUseExisting(val) {
  var state = getNutritionFlowState();
  var ctx = Object.assign({}, state.examContext || {});
  ctx.useExistingExams = val === true || val === "true";
  setNutritionFlowState({ examContext: ctx });
  renderNutritionFlow({ preserveScroll: true });
}

function handleExamFileUpload(inputEl) {
  var file = inputEl && inputEl.files && inputEl.files[0];
  var state = getNutritionFlowState();
  var ctx = Object.assign({}, state.examContext || {});
  ctx.uploadedExamFile = file || null;
  ctx.uploadedExamName = file ? file.name : null;
  setNutritionFlowState({ examContext: ctx });
  renderNutritionFlow({ preserveScroll: true });
}

function mapObjectiveToPremiumFlow(value) {
  var normalized = normalizeKroniaObjective(value);
  if (normalized === "emagrecimento") return "perder_peso";
  if (normalized === "hipertrofia") return "ganhar_massa";
  if (normalized === "recomposicao") return "definicao";
  return "manter_peso";
}

function humanizePremiumFlowValue(type, value) {
  var map = {
    objetivo: { perder_peso: "Perder peso", manter_peso: "Manter peso", ganhar_massa: "Ganhar massa", definicao: "Definição" },
    nivelAtividade: { sedentario: "Sedentário", leve: "Leve", moderado: "Moderado", intenso: "Intenso" },
    sexo: { masculino: "Masculino", feminino: "Feminino" },
    fomeHoje: { baixa: "Baixa", normal: "Normal", alta: "Alta", fome_noturna: "Fome à noite" },
    horarioTreino: { manha: "Manhã", tarde: "Tarde", noite: "Noite", nao_treinei: "Não treinei" },
  };
  return (map[type] && map[type][value]) || value || "--";
}

function hydrateNutritionFlowFromLegacyForm(context) {
  var current = getNutritionFlowState();
  var ctx = context && typeof context === "object" ? context : {};
  var payloadObjective = ctx.objective || ctx.objetivo || ctx.goal;
  var meals = Number(ctx.meals || ctx.refeicoesPorDia || ctx.mealCount || 0);
  var snapshot = window._dietaSupabaseSnapshot || {};
  var profile = snapshot.profile || {};
  var bodyMetrics = snapshot.bodyMetrics || {};
  var age = profile.birth_date ? parseDietAgeFromBirthDate(profile.birth_date) : "";
  var next = Object.assign({}, current, {
    objetivo: mapObjectiveToPremiumFlow(payloadObjective || document.querySelector("#dietaObjChips .bs-chip.active")?.dataset.val || profile.objective || current.objetivo),
    sexo: document.getElementById("dietaSexoF")?.classList.contains("active") ? "feminino" : (profile.sex === "female" || profile.sex === "feminino" ? "feminino" : current.sexo),
    peso: document.getElementById("dietaPeso")?.value || bodyMetrics.weight_kg || profile.current_weight_kg || current.peso,
    altura: document.getElementById("dietaAltura")?.value || profile.height_cm || current.altura,
    idade: document.getElementById("dietaIdade")?.value || age || current.idade,
    gorduraCorporal: document.getElementById("dietaGordura")?.value || bodyMetrics.body_fat_percent || current.gorduraCorporal,
    cintura: bodyMetrics.waist_cm || current.cintura,
    pescoco: current.pescoco || "",
    quadril: bodyMetrics.hip_cm || current.quadril,
    nivelAtividade: ({"sedentário":"sedentario","levemente ativo":"leve","moderadamente ativo":"moderado","muito ativo":"intenso","atleta":"intenso"}[String(document.querySelector("#dietaAtivChips .bs-chip.active")?.dataset.val || profile.activity_level || "").toLowerCase()] || current.nivelAtividade),
    padraoAlimentar: document.getElementById("dietaPadrao")?.value || profile.dietary_pattern || current.padraoAlimentar,
    refeicoesPorDia: meals || Number(document.getElementById("dietaRefeicoes")?.value || 0) || current.refeicoesPorDia,
    preferencias: document.getElementById("dietaPrefs")?.value || (Array.isArray(profile.liked_foods) ? profile.liked_foods.join(", ") : current.preferencias),
    alimentosEvitar: document.getElementById("dietaDislikes")?.value || (Array.isArray(profile.disliked_foods) ? profile.disliked_foods.join(", ") : current.alimentosEvitar),
    labsStatus: snapshot.latestLabReport ? "detected" : current.labsStatus,
  });
  var restrictions = []
    .concat(Array.isArray(profile.allergies) ? profile.allergies : [])
    .concat(Array.isArray(profile.intolerances) ? profile.intolerances : []);
  if (restrictions.length) next.sinaisClinicos = restrictions.join(", ");
  window._nutritionFlowState = next;
  syncNutritionFlowToLegacyDietForm();
}

function syncNutritionFlowToLegacyDietForm() {
  var state = getNutritionFlowState();
  function setValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value == null ? "" : String(value);
  }
  setValue("dietaPeso", state.peso);
  setValue("dietaAltura", state.altura);
  setValue("dietaIdade", state.idade);
  setValue("dietaGordura", state.gorduraCorporal);
  setValue("dietaFreqTreino", state.frequenciaTreino === "não treino" ? "" : state.frequenciaTreino);
  setValue("dietaHorarioTreino", state.horarioTreino);
  setValue("dietaRefeicoes", state.refeicoesPorDia);
  setValue("dietaPrefs", mergeUniqueDietList(state.preferencias, state.proteinas, state.carboidratos, state.gorduras, state.frutas, state.vegetais, state.laticinios, state.temperos).join(", "));
  setValue("dietaDislikes", state.alimentosEvitar);
  setValue("dietaMedicamentos", state.medicamentos);
  setValue("dietaRestric", state.sinaisClinicos);
  var padrao = document.getElementById("dietaPadrao");
  if (padrao && state.padraoAlimentar) padrao.value = state.padraoAlimentar;
  document.querySelectorAll("#dietaObjChips .bs-chip").forEach(function(chip) {
    chip.classList.toggle("active", chip.dataset.val === state.objetivo);
  });
  selectDietaSexo(state.sexo === "feminino" ? "F" : "M");
  document.querySelectorAll("#dietaAtivChips .bs-chip").forEach(function(chip) {
    chip.classList.toggle("active", chip.dataset.val === state.nivelAtividade);
  });
}

function buildNutritionFlowInput() {
  syncNutritionFlowToLegacyDietForm();
  var state = getNutritionFlowState();
  var pathologies = Array.isArray(state.patologia) ? state.patologia : [];
  var flowConditions = Array.isArray(state.healthConditions) ? state.healthConditions : [];
  var allPathologies = flowConditions.concat(pathologies.filter(function(item) { return item !== "nenhuma" && flowConditions.indexOf(item) === -1; }));
  var restrictionText = mergeUniqueDietList(state.sinaisClinicos, state.restricoesClinicas, allPathologies).join(", ") || "nenhuma";
  var preferenceText = mergeUniqueDietList(state.preferencias, state.proteinas, state.carboidratos, state.gorduras, state.frutas, state.vegetais, state.laticinios, state.temperos).join(", ");
  return Object.assign({}, collectDietGenerationInput(), {
    objetivo: normalizeKroniaObjective(state.objetivo),
    sexo: state.sexo,
    peso: Number(state.peso || 0) || 75,
    altura: Number(state.altura || 0) || 175,
    idade: Number(state.idade || 0) || 25,
    gorduraCorporal: state.gorduraCorporal ? Number(state.gorduraCorporal) : null,
    cintura: state.cintura ? Number(state.cintura) : null,
    pescoco: state.pescoco ? Number(state.pescoco) : null,
    quadril: state.quadril ? Number(state.quadril) : null,
    massaMagraEstimada: state.massaMagraEstimada ? Number(state.massaMagraEstimada) : null,
    refeicoesPorDia: Number(state.refeicoesPorDia || 4),
    nivelAtividade: ({ sedentario: "sedentário", leve: "levemente ativo", moderado: "moderadamente ativo", intenso: "muito ativo" }[state.nivelAtividade] || state.nivelAtividade),
    frequenciaTreino: state.treinoForca === "sim" ? (state.frequenciaTreino || document.getElementById("dietaFreqTreino")?.value || "3x por semana") : "não treino",
    horarioTreino: ({ manha: "Manhã", tarde: "Tarde", noite: "Noite", nao_treinei: "Não treinei" }[state.horarioTreino] || state.horarioTreino || ""),
    tipoTreino: state.treinoForca === "sim" ? "musculação" : "não treino",
    patologia: allPathologies.length ? allPathologies.join(", ") : (pathologies.join(", ") || "nenhuma"),
    medicamentos: state.medicamentos || "",
    padraoAlimentar: state.padraoAlimentar,
    restricoes: restrictionText,
    preferencias: preferenceText,
    alimentosEvitar: state.alimentosEvitar || "",
    aderencia: Object.assign({}, collectDietGenerationInput().aderencia || {}, {
      modoAjuste: state.sugestao,
      praticidade: state.sugestao,
      neat: state.neat,
      fadiga: Number(state.fadiga || 0),
      tendenciaForca: state.tendenciaForca,
      prioridadeMetabolica: state.prioridadeMetabolica,
      horarioTreino: state.horarioTreino || "",
    }),
    clinicalFlow: {
      patologias: allPathologies.length ? allPathologies : pathologies,
      diabetes: allPathologies.some(function(item) { return /diabetes/i.test(String(item)); }) || pathologies.some(function(item) { return /diabetes|insulina/i.test(String(item)); }),
      hipertensao: allPathologies.some(function(item) { return /hipertens/i.test(String(item)); }),
      doencaRenal: allPathologies.some(function(item) { return /renal|hemodial/i.test(String(item)); }),
      alergia: allPathologies.some(function(item) { return /alergia|intoler/i.test(String(item)); }),
      sinaisClinicos: state.sinaisClinicos,
      sinaisRelevantes: state.sinaisRelevantes,
      labsStatus: state.labsStatus,
      bcmManual: state.bcmManual || null,
      examContext: state.examContext || null,
    },
    clinicalData: {
      healthConditions: flowConditions,
      otherHealthCondition: state.otherHealthCondition || "",
      bcmManual: state.bcmManual || null,
      exams: {
        useExistingExams: (state.examContext || {}).useExistingExams || false,
        uploadedExamName: (state.examContext || {}).uploadedExamName || null,
      },
    },
    nutritionFlowSelections: {
      proteinas: state.proteinas,
      carboidratos: state.carboidratos,
      gorduras: state.gorduras,
      frutas: state.frutas,
      vegetais: state.vegetais,
      laticinios: state.laticinios,
      temperos: state.temperos,
      restricoesClinicas: state.restricoesClinicas,
      sinaisRelevantes: state.sinaisRelevantes,
      labsStatus: state.labsStatus,
    },
    // Stale stored nutrition_goals must not override the freshly computed TDEE+objective baseline
    nutritionGoals: null,
  });
}

function computeNutritionFlowResult(input) {
  var baseline = computeDietGenerationBaseline(input);
  var training = readDietMasterTrainingSnapshot();
  var activityFactor = {
    "sedentário": 1.2,
    "sedentario": 1.2,
    "levemente ativo": 1.375,
    "moderadamente ativo": 1.55,
    "muito ativo": 1.725,
    "atleta": 1.9,
  }[String(input.nivelAtividade || "").toLowerCase()] || 1.375;
  var neatImpact = { baixo: -120, moderado: 0, alto: 180 }[getNutritionFlowState().neat] || 0;
  var clinical = summarizeDietMasterClinical(input);
  var clinicalImpact = clinical.hasDiabetes ? -80 : 0;
  var sinaisImpact = input && input.supabaseSnapshot && input.supabaseSnapshot.latestLabReport ? -40 : 0;
  var trainingImpact = Math.round(Math.max(0, baseline.tdee - baseline.tmb) * 0.55);
  var activityImpact = Math.round(Math.max(0, baseline.tdee - baseline.tmb) * 0.45);
  var adjustedTarget = Math.max(1200, Math.round(baseline.metaCalorias + neatImpact + clinicalImpact + sinaisImpact));
  var protein = baseline.proteinaMeta;
  var fat = baseline.gorduraMeta;
  var carbs = Math.max(70, Math.round((adjustedTarget - protein * 4 - fat * 9) / 4));
  return Object.assign({}, baseline, {
    trainingSnapshot: training,
    treinoImpacto: trainingImpact,
    atividadeImpacto: activityImpact,
    neatImpacto: neatImpact,
    clinicaImpacto: clinicalImpact,
    sinaisImpacto: sinaisImpact,
    metaCalorias: adjustedTarget,
    proteinaMeta: protein,
    gorduraMeta: fat,
    carboMeta: carbs,
  });
}

function persistCanonicalNutritionSnapshot(meta) {
  try {
    var input = buildNutritionFlowInput();
    var result = computeNutritionFlowResult(input);
    var state = getNutritionFlowState();
    var snapshot = {
      v: 1,
      source: "kronos_central_nutrition_flow",
      updatedAt: new Date().toISOString(),
      meta: meta || {},
      profile: input,
      calculation: {
        basal: result.tmb,
        gastoEstimado: result.tdee,
        impactoTreino: result.treinoImpacto,
        impactoAtividade: result.atividadeImpacto,
        impactoNeat: result.neatImpacto,
        metaCalorica: result.metaCalorias,
        macros: { proteina: result.proteinaMeta, carboidratos: result.carboMeta, gorduras: result.gorduraMeta },
      },
      canonicalContext: {
        supabaseSnapshot: input.supabaseSnapshot || null,
        treino: input.trainingSnapshot || null,
        exames: input.supabaseSnapshot && input.supabaseSnapshot.latestLabReport ? input.supabaseSnapshot.latestLabReport : null,
        patologias: state.patologia,
        diabetes: Array.isArray(state.patologia) && state.patologia.some(function(item) { return /diabetes|insulina/i.test(String(item)); }),
      },
      foodSelections: {
        proteinas: state.proteinas,
        carboidratos: state.carboidratos,
        gorduras: state.gorduras,
        frutas: state.frutas,
        vegetais: state.vegetais,
        laticinios: state.laticinios,
        temperos: state.temperos,
      },
      activePlan: state.generatedPlan || null,
      checkin: state.checkin || null,
    };
    localStorage.setItem(KRONIA_NUTRITION_SNAPSHOT_KEY, JSON.stringify(snapshot));
    window._kroniaNutritionSnapshot = snapshot;
    return snapshot;
  } catch (_) {
    return null;
  }
}

function nutritionHasBaseProfile(state) {
  var st = state || getNutritionFlowState();
  return Boolean(
    st && st.objetivo && st.nivelAtividade && st.sexo &&
    Number(st.peso) > 0 && Number(st.altura) > 0 && Number(st.idade) > 0
  );
}

function openNutritionFlow(context) {
  if (!(context && context.__allowLegacyNutritionFlow === true)) {
    scheduleKroniaUIUnblock('before-open-nutrition-flow-route');
    try { window.KroniaDiet.hideLegacyScreens?.(); } catch (_) {}
    return openOfficialDietEntry(Object.assign({ source: 'open_nutrition_flow_route', forceNew: true }, context || {}));
  }
}

function closeNutritionFlow() {
  if (document.body) document.body.classList.remove('nutrition-flow-active');
}

function nutritionFlowBack() {}
function nutritionFlowNext() {}

function validateNutritionFlowStep() {
  var state = getNutritionFlowState();
  var key = (NUTRITION_FLOW_STEPS[state.step] || {}).key;
  if (key === "perfil_base") {
    if (!(Number(state.peso) > 0 && Number(state.altura) > 0 && Number(state.idade) > 0)) {
      return { ok: false, message: "Preencha peso, altura e idade com valores válidos." };
    }
    if (!state.objetivo || !state.nivelAtividade || !state.sexo) {
      return { ok: false, message: "Selecione objetivo, atividade e sexo para continuar." };
    }
  }
  if (key === "ajuste_dia" && !Number(state.refeicoesPorDia || 0)) {
    return { ok: false, message: "Selecione quantas refeições por dia você deseja." };
  }
  return { ok: true };
}

function renderNutritionOption(key, value, title, subtitle) {
  var active = nutritionSelected(key, value);
  return `<button type="button" class="nutrition-option ${active ? "active" : ""}" onclick="nutritionSet('${key}', '${escapeAttr(value)}')">
    <span><strong>${escapeHTML(title)}</strong>${subtitle ? `<small>${escapeHTML(subtitle)}</small>` : ""}</span>
    <span class="nutrition-check">${active ? "✓" : ""}</span>
  </button>`;
}

function renderNutritionChipArray(key, value, label, exclusiveValue) {
  var selected = nutritionSelected(key, value);
  return `<button type="button" class="nutrition-chip ${selected ? "active" : ""}" onclick="nutritionToggleArray('${key}', '${escapeAttr(value)}', ${exclusiveValue ? "'" + escapeAttr(exclusiveValue) + "'" : "null"})">${escapeHTML(label || value)}</button>`;
}

function calculateNutritionNavyAnthro(state) {
  var safe = state && typeof state === "object" ? state : {};
  var sex = String(safe.sexo || "masculino").toLowerCase();
  var weight = Number(safe.peso || 0);
  var height = Number(safe.altura || 0);
  var waist = Number(safe.cintura || 0);
  var neck = Number(safe.pescoco || 0);
  // Reset physiologically impossible neck values (normal adult: 20–60 cm)
  if (neck < 20 || neck > 60) neck = 38;
  var hip = Number(safe.quadril || 0);
  var bf = Number(safe.gorduraCorporal || 0);
  if (!(bf > 2 && bf < 60) && height > 0 && waist > neck) {
    if (sex === "feminino" && hip > 0 && (waist + hip) > neck) {
      bf = 163.205 * Math.log10(waist + hip - neck) - 97.684 * Math.log10(height) - 78.387;
    } else if (sex !== "feminino") {
      bf = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76;
    }
  }
  bf = Number.isFinite(bf) ? Math.max(0, Math.min(60, Math.round(bf * 10) / 10)) : 0;
  var leanMass = weight > 0 && bf > 0 ? Math.round(weight * (1 - bf / 100) * 10) / 10 : 0;
  return { bf: bf, leanMass: leanMass };
}

function syncNutritionAnthroEstimate() {
  var state = getNutritionFlowState();
  var estimate = calculateNutritionNavyAnthro(state);
  if (estimate.bf > 0 && String(state.gorduraCorporal || "") !== String(estimate.bf)) {
    window._nutritionFlowState = Object.assign({}, state, {
      gorduraCorporal: String(estimate.bf),
      massaMagraEstimada: String(estimate.leanMass || ""),
    });
    syncNutritionFlowToLegacyDietForm();
    persistCanonicalNutritionSnapshot({ source: "nutrition_anthro_estimate" });
  }
  return calculateNutritionNavyAnthro(getNutritionFlowState());
}

function renderNutritionSegment(key, value, label) {
  var active = nutritionSelected(key, value);
  return `<button type="button" class="nutrition-chip ${active ? "active" : ""}" onclick="nutritionSet('${key}', '${escapeAttr(value)}')">${escapeHTML(label || value)}</button>`;
}

function renderNutritionLabLabel(value) {
  var labels = { detected: "Exames detectados", missing: "Não tenho exames", ignored: "Ignorar exames" };
  return labels[value] || "Exames detectados";
}

var NUTRITION_PATHOLOGY_CATALOG = [
  {
    id: "metabolicas",
    label: "Metabólicas",
    items: [
      { id: "obesidade", label: "Obesidade" },
      { id: "sobrepeso", label: "Sobrepeso" },
      { id: "pre_diabetes", label: "Pré-diabetes" },
      { id: "diabetes_tipo_2", label: "Diabetes tipo 2" },
      { id: "resistencia_insulina", label: "Resistência à insulina" },
      { id: "sindrome_metabolica", label: "Síndrome metabólica" },
      { id: "esteatose_hepatica", label: "Esteatose hepática" },
      { id: "dislipidemia", label: "Dislipidemia" },
      { id: "hipercolesterolemia", label: "Hipercolesterolemia" },
      { id: "hipertrigliceridemia", label: "Hipertrigliceridemia" },
    ],
  },
  {
    id: "cardiovasculares",
    label: "Cardiovasculares",
    items: [
      { id: "hipertensao_arterial", label: "Hipertensão arterial" },
    ],
  },
  {
    id: "endocrinas_hormonais",
    label: "Endócrinas e hormonais",
    items: [
      { id: "hipotireoidismo", label: "Hipotireoidismo" },
      { id: "hipertireoidismo", label: "Hipertireoidismo" },
      { id: "sop", label: "SOP" },
      { id: "menopausa", label: "Menopausa" },
    ],
  },
  {
    id: "gastrointestinais",
    label: "Gastrointestinais",
    items: [
      { id: "refluxo_gastroesofagico", label: "Refluxo gastroesofágico" },
      { id: "gastrite", label: "Gastrite" },
      { id: "ulcera_peptica", label: "Úlcera péptica" },
      { id: "sindrome_intestino_irritavel", label: "Síndrome do intestino irritável" },
      { id: "constipacao_intestinal", label: "Constipação intestinal" },
      { id: "diarreia_cronica", label: "Diarreia crônica" },
      { id: "doenca_celiaca", label: "Doença celíaca" },
      { id: "sensibilidade_gluten", label: "Sensibilidade ao glúten" },
      { id: "intolerancia_lactose", label: "Intolerância à lactose" },
      { id: "doenca_crohn", label: "Doença de Crohn" },
      { id: "retocolite_ulcerativa", label: "Retocolite ulcerativa" },
    ],
  },
  {
    id: "renais",
    label: "Renais",
    items: [
      { id: "doenca_renal_cronica", label: "Doença renal crônica" },
      { id: "hiperuricemia", label: "Hiperuricemia" },
      { id: "gota", label: "Gota" },
    ],
  },
  {
    id: "carenciais_nutricionais",
    label: "Carenciais e nutricionais",
    items: [
      { id: "desnutricao", label: "Desnutrição" },
      { id: "baixo_peso", label: "Baixo peso" },
      { id: "sarcopenia", label: "Sarcopenia" },
      { id: "caquexia", label: "Caquexia" },
      { id: "anemia_ferropriva", label: "Anemia ferropriva" },
      { id: "anemia_megaloblastica", label: "Anemia megaloblástica" },
      { id: "deficiencia_vitamina_d", label: "Deficiência de vitamina D" },
    ],
  },
  {
    id: "osseas",
    label: "Ósseas",
    items: [
      { id: "osteopenia", label: "Osteopenia" },
      { id: "osteoporose", label: "Osteoporose" },
    ],
  },
  {
    id: "ginecologicas",
    label: "Ginecológicas",
    items: [
      { id: "endometriose", label: "Endometriose" },
    ],
  },
  {
    id: "alergias_alimentares",
    label: "Alergias alimentares",
    items: [
      { id: "alergia_proteina_leite", label: "Alergia à proteína do leite" },
      { id: "alergia_ovo", label: "Alergia ao ovo" },
      { id: "alergia_amendoim", label: "Alergia ao amendoim" },
      { id: "alergia_oleaginosas", label: "Alergia a oleaginosas" },
      { id: "alergia_frutos_mar", label: "Alergia a frutos do mar" },
      { id: "alergia_peixe", label: "Alergia a peixe" },
    ],
  },
];

var openNutritionPathologyCategories = new Set(["metabolicas", "gastrointestinais"]);

function getNutritionPathologyLabel(value) {
  for (var i = 0; i < NUTRITION_PATHOLOGY_CATALOG.length; i += 1) {
    var items = NUTRITION_PATHOLOGY_CATALOG[i].items || [];
    for (var j = 0; j < items.length; j += 1) {
      if (items[j].id === value) return items[j].label;
    }
  }
  return value === "nenhuma" ? "Nenhuma" : String(value || "");
}

function renderNutritionPathologySection() {
  var state = getNutritionFlowState();
  var selected = Array.isArray(state.patologia) ? state.patologia : ["nenhuma"];
  var categories = NUTRITION_PATHOLOGY_CATALOG.filter(function(category) {
    return category && Array.isArray(category.items) && category.items.length > 0;
  });
  return `<section class="glass-card border-l-rose">
    <div class="nutrition-official-card-head">
      <div>
        <h2 class="nutrition-official-label no-margin">Contexto Clínico</h2>
        <p class="nutrition-official-hint">Selecione para ajuste fino do KRONOS</p>
      </div>
      <i data-lucide="stethoscope" class="lucide nutrition-official-rose" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"></i>
    </div>
    <div class="nutrition-pathology-list">
      ${categories.map(function(category) {
        var isOpen = openNutritionPathologyCategories.has(category.id);
        return `<div id="nutrition-pathology-category-${escapeAttr(category.id)}" class="nutrition-pathology-category">
          <button type="button" class="nutrition-pathology-category-btn" onclick="toggleNutritionPathologyCategory('${escapeAttr(category.id)}')">
            <span>${escapeHTML(category.label)}</span>
            <i data-lucide="chevron-down" class="lucide ${isOpen ? "rotate-180" : ""}" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"></i>
          </button>
          <div id="nutrition-pathology-items-${escapeAttr(category.id)}" class="nutrition-pathology-items ${isOpen ? "show" : ""}">
            ${category.items.map(function(item) {
              var active = selected.indexOf(item.id) !== -1;
              return `<button type="button" class="nutrition-pathology-chip ${active ? "active" : ""}" onclick="toggleNutritionPathology('${escapeAttr(item.id)}')">${escapeHTML(item.label)}</button>`;
            }).join("")}
          </div>
        </div>`;
      }).join("")}
    </div>
  </section>`;
}

function toggleNutritionPathologyCategory(categoryId) {
  var exists = NUTRITION_PATHOLOGY_CATALOG.some(function(category) {
    return category && category.id === categoryId;
  });
  if (!exists) return;
  var categoryEl = document.getElementById("nutrition-pathology-category-" + categoryId);
  if (!categoryEl) return;
  var itemsEl = document.getElementById("nutrition-pathology-items-" + categoryId);
  if (!itemsEl) return;
  var chevron = itemsEl.previousElementSibling?.querySelector("i");
  if (openNutritionPathologyCategories.has(categoryId)) {
    openNutritionPathologyCategories.delete(categoryId);
  } else {
    openNutritionPathologyCategories.add(categoryId);
  }
  if (chevron) {
    chevron.style.transform = openNutritionPathologyCategories.has(categoryId) ? "rotate(180deg)" : "rotate(0deg)";
  }
  renderNutritionFlow({ preserveScroll: true });
}

function toggleNutritionPathology(pathologyId) {
  var state = getNutritionFlowState();
  var current = Array.isArray(state.patologia) ? state.patologia.slice() : ["nenhuma"];
  current = current.filter(function(item) { return item && item !== "nenhuma"; });
  var index = current.indexOf(pathologyId);
  if (index >= 0) current.splice(index, 1); else current.push(pathologyId);
  setNutritionFlowState({ patologia: current.length ? current : ["nenhuma"] });
  renderNutritionFlow({ preserveScroll: true });
}

function buildNutritionIntakeSnapshot() {
  var state = getNutritionFlowState();
  var estimate = calculateNutritionNavyAnthro(state);
  var input = buildNutritionFlowInput();
  return {
    objetivo: input.objetivo,
    sexo: input.sexo,
    peso: input.peso,
    altura: input.altura,
    idade: input.idade,
    cintura: input.cintura,
    pescoco: input.pescoco,
    quadril: input.quadril,
    gorduraCorporal: estimate.bf || input.gorduraCorporal,
    massaMagraEstimada: estimate.leanMass || input.massaMagraEstimada,
    treino: {
      frequencia: input.frequenciaTreino,
      periodo: state.horarioTreino,
      fadiga: Number(state.fadiga || 0),
      tendenciaForca: state.tendenciaForca,
      prioridadeMetabolica: state.prioridadeMetabolica,
    },
    aderencia: {
      estilo: state.sugestao === "prática" ? "Alta praticidade" : "Brasileiro clássico",
      preferencias: input.preferencias,
      restricoes: input.restricoes,
      sinais: Array.isArray(state.sinaisRelevantes) ? state.sinaisRelevantes : [],
      labsStatus: state.labsStatus,
      observacoes: state.observacoesFinais || "",
    },
    supabaseSnapshot: input.supabaseSnapshot || null,
    generatedAt: new Date().toISOString(),
  };
}

function getNutritionCatalogItems(group) {
  return NUTRITION_FOOD_CATALOG.filter(function(item) { return item.grupo === group; });
}

function buildDietSubstitutionGroups(flowState) {
  var restricoes = String((flowState && flowState.restricoes) || (flowState && flowState.restricoesClinicas) || '').toLowerCase();
  var padrao = String((flowState && flowState.padraoAlimentar) || 'onivoro').toLowerCase();
  var isVegan = /vegano|vegan/.test(padrao);
  var isVegetarian = /vegetariano/.test(padrao);
  var hasLactose = /lactose/.test(restricoes);
  var hasGluten = /gluten|glúten/.test(restricoes);

  function allowed(item) {
    if (isVegan && /(frango|patinho|ovo|iogurte|atum|sardinha|salmão|tilápia|queijo|leite|whey)/i.test(item.nome)) return false;
    if (isVegetarian && /(frango|patinho|atum|sardinha|salmão|tilápia)/i.test(item.nome)) return false;
    if (hasLactose && /(iogurte|queijo|leite|whey)/i.test(item.nome)) return false;
    if (hasGluten && /(macarrão|pão|aveia)/i.test(item.nome)) return false;
    return true;
  }

  var groups = [
    { label: 'Proteínas', grupo: 'proteinas' },
    { label: 'Carboidratos', grupo: 'carboidratos' },
    { label: 'Gorduras saudáveis', grupo: 'gorduras' },
    { label: 'Vegetais', grupo: 'vegetais' },
    { label: 'Frutas', grupo: 'frutas' },
    { label: 'Laticínios e substitutos', grupo: 'laticinios' },
  ];

  return groups.map(function(g) {
    var items = getNutritionCatalogItems(g.grupo).filter(allowed).slice(0, 4).map(function(item) {
      return item.nome + ' (' + item.porcao + ')';
    });
    return items.length ? { label: g.label, items: items } : null;
  }).filter(Boolean);
}

function getNutritionCatalogNameOptions(group) {
  return getNutritionCatalogItems(group).map(function(item) { return item.nome; });
}

function nutritionOfficialGoalLabel(value) {
  var labels = { hipertrofia: "Hipertrofia", emagrecimento: "Emagrecimento", forca: "Performance", performance: "Performance" };
  return labels[String(value || "").toLowerCase()] || String(value || "Hipertrofia");
}

function nutritionOfficialPlanStyleLabel(value) {
  return value === "prática" ? "Prático" : "Brasileiro";
}

function nutritionOfficialLikeSelected(value) {
  var state = getNutritionFlowState();
  if (value === "Arroz/Feijão") {
    return nutritionSelected("carboidratos", "Arroz") && nutritionSelected("carboidratos", "Feijão");
  }
  if (value === "Frango") return nutritionSelected("proteinas", "Frango grelhado");
  if (value === "Ovos") return nutritionSelected("proteinas", "Ovos");
  if (value === "Carne Vermelha") return nutritionSelected("proteinas", "Patinho grelhado");
  return Array.isArray(state.proteinas) && state.proteinas.indexOf(value) !== -1;
}

function nutritionOfficialToggleLike(value) {
  var state = getNutritionFlowState();
  if (value === "Arroz/Feijão") {
    var hasPair = nutritionOfficialLikeSelected(value);
    var carbs = Array.isArray(state.carboidratos) ? state.carboidratos.slice() : [];
    ["Arroz", "Feijão"].forEach(function(item) {
      var idx = carbs.indexOf(item);
      if (hasPair && idx >= 0) carbs.splice(idx, 1);
      if (!hasPair && idx < 0) carbs.push(item);
    });
    setNutritionFlowState({ carboidratos: carbs });
  } else {
    var map = { Frango: "Frango grelhado", Ovos: "Ovos", "Carne Vermelha": "Patinho grelhado" };
    var item = map[value] || value;
    var proteins = Array.isArray(state.proteinas) ? state.proteinas.slice() : [];
    var pidx = proteins.indexOf(item);
    if (pidx >= 0) proteins.splice(pidx, 1); else proteins.push(item);
    setNutritionFlowState({ proteinas: proteins });
  }
  renderNutritionFlow({ preserveScroll: true });
}

function nutritionOfficialSetAnthro(patch) {
  setNutritionFlowState(patch || {});
  var estimate = calculateNutritionNavyAnthro(getNutritionFlowState());
  var bf = document.getElementById("nutritionOfficialBf");
  var lean = document.getElementById("nutritionOfficialLeanMass");
  if (bf) bf.textContent = estimate.bf ? formatKroniaNumber(estimate.bf, "%") : "--%";
  if (lean) lean.textContent = estimate.leanMass ? formatKroniaNumber(estimate.leanMass, "kg") : "--";
}

function nutritionOfficialSetFatigue(value) {
  setNutritionFlowState({ fadiga: value });
  var el = document.getElementById("nutritionOfficialFatigueVal");
  if (el) el.textContent = value;
}

function nutritionOfficialSummaryRow(label, value, extraClass) {
  return `<div class="nutrition-official-summary-row"><span>${escapeHTML(label)}</span><strong class="${extraClass || ""}">${value}</strong></div>`;
}

function renderNutritionFoodStep(key, options, minRequired) {
  var state = getNutritionFlowState();
  var selected = Array.isArray(state[key]) ? state[key] : [];
  var items = Array.isArray(options) && options.length && typeof options[0] === "object"
    ? options
    : getNutritionCatalogItems(key);
  var grouped = items.reduce(function(acc, item) {
    var group = item.subgrupo || "opções";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
  var minimum = Number(minRequired || (key === "frutas" || key === "vegetais" ? 2 : 1));
  return `<div class="nutrition-food-head">
    <strong>${selected.length}/${minimum} selecionados</strong>
    <span>${escapeHTML(NUTRITION_GROUP_LABELS[key] || "Alimentos")}</span>
  </div>
  <div class="nutrition-food-sections">
    ${Object.keys(grouped).map(function(subgroup) {
      return `<section class="nutrition-food-section">
        <div class="nutrition-food-subgroup">${escapeHTML(subgroup)}</div>
        <div class="nutrition-chip-grid">
          ${grouped[subgroup].map(function(item) {
            var label = item.nome;
            var detail = `${item.porcao} · ${Math.round(item.kcal)} kcal · P ${item.proteina}g · C ${item.carboidrato}g · G ${item.gordura}g`;
            var selectedItem = nutritionSelected(key, item.nome);
            return `<button type="button" class="nutrition-food-chip ${selectedItem ? "active" : ""}" onclick="nutritionToggleArray('${key}', '${escapeAttr(item.nome)}', null)">
              <strong>${escapeHTML(label)}</strong>
              <small>${escapeHTML(detail)}</small>
            </button>`;
          }).join("")}
        </div>
      </section>`;
    }).join("")}
  </div>
  <div class="nutrition-card">
    <div class="nutrition-metric"><span>Como o KRONOS usa isso</span><strong>Preferências viram regra de geração</strong><small>As opções escolhidas entram no snapshot canônico, nas refeições e nas substituições por macro.</small></div>
  </div>`;
}


function renderNutritionResultScreen() {
  var input = buildNutritionFlowInput();
  var result = computeNutritionFlowResult(input);
  return `<div class="nutrition-metric-grid">
    <div class="nutrition-metric"><span>Basal</span><strong>${result.tmb.toLocaleString("pt-BR")} kcal</strong><small>Mifflin/Katch quando disponível.</small></div>
    <div class="nutrition-metric"><span>Gasto estimado</span><strong>${result.tdee.toLocaleString("pt-BR")} kcal</strong><small>Basal + atividade.</small></div>
    <div class="nutrition-metric"><span>Impacto do treino</span><strong>${result.treinoImpacto.toLocaleString("pt-BR")} kcal</strong><small>${result.trainingSnapshot.sessions7d || 0} treino(s) recentes.</small></div>
    <div class="nutrition-metric"><span>Impacto atividade</span><strong>${result.atividadeImpacto.toLocaleString("pt-BR")} kcal</strong><small>${input.nivelAtividade}</small></div>
    <div class="nutrition-metric"><span>Impacto NEAT</span><strong>${result.neatImpacto > 0 ? "+" : ""}${result.neatImpacto.toLocaleString("pt-BR")} kcal</strong><small>Rotina fora do treino.</small></div>
    <div class="nutrition-metric"><span>Impacto clínico</span><strong>${result.clinicaImpacto.toLocaleString("pt-BR")} kcal</strong><small>Diabetes e patologias reduzem agressividade.</small></div>
    <div class="nutrition-metric"><span>Sinais clínicos</span><strong>${result.sinaisImpacto.toLocaleString("pt-BR")} kcal</strong><small>Exames válidos aplicam margem conservadora.</small></div>
    <div class="nutrition-metric"><span>Meta inicial</span><strong>${result.metaCalorias.toLocaleString("pt-BR")} kcal</strong><small>P ${result.proteinaMeta}g · C ${result.carboMeta}g · G ${result.gorduraMeta}g</small></div>
  </div>`;
}

function renderNutritionGenerateScreen() {
  var state = getNutritionFlowState();
  var input = buildNutritionFlowInput();
  var result = computeNutritionFlowResult(input);
  var hasClinical = Array.isArray(state.patologia) && state.patologia.some(function(item) { return item !== "nenhuma"; });
  return `<div class="nutrition-card">
    <div class="nutrition-metric"><span>Pronto para gerar</span><strong>${result.metaCalorias.toLocaleString("pt-BR")} kcal</strong><small>P ${result.proteinaMeta}g · C ${result.carboMeta}g · G ${result.gorduraMeta}g</small></div>
    <div class="nutrition-warning" style="${hasClinical ? "" : "display:none"}">Condições clínicas serão tratadas de forma conservadora. Dieta IA não substitui acompanhamento médico ou nutricional.</div>
  </div>`;
}

function renderNutritionTodayScreen() {
  var state = getNutritionFlowState();
  var plan = state.generatedPlan || buildLocalDietPlan(buildNutritionFlowInput());
  var meta = plan.meta || {};
  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  return `<div class="nutrition-metric-grid">
    <div class="nutrition-metric"><span>Meta do dia</span><strong>${Math.round(meta.calorias || 0).toLocaleString("pt-BR")} kcal</strong><small>Plano ativo</small></div>
    <div class="nutrition-metric"><span>Proteína</span><strong>${meta.proteina || 0}g</strong><small>Prioridade diária</small></div>
    <div class="nutrition-metric"><span>Carboidratos</span><strong>${meta.carbo || 0}g</strong><small>Ajustado ao treino</small></div>
    <div class="nutrition-metric"><span>Gorduras</span><strong>${meta.gordura || 0}g</strong><small>Base hormonal e saciedade</small></div>
  </div>
  <div class="nutrition-meal-list" style="margin-top:14px">
    ${meals.map(function(meal, index) {
      var subtotal = meal.subtotal || {};
      var registered = state.registeredMeals && state.registeredMeals[index];
      return `<button type="button" class="nutrition-meal ${registered ? "registered" : ""}" onclick="setNutritionFlowState({ selectedMealIndex: ${index} }); openDietDataScreen();">
        <div class="nutrition-meal-head"><strong>${escapeHTML(meal.nome || "Refeição")}</strong><span>${escapeHTML(registered ? "Registrada" : (meal.horario || "Hoje"))}</span></div>
        <small>${subtotal.kcal || "--"} kcal · P ${subtotal.prot || "--"}g · C ${subtotal.carb || "--"}g · G ${subtotal.gord || "--"}g</small>
      </button>`;
    }).join("")}
  </div>
  <div class="nutrition-inline-actions">
    <button class="nutrition-secondary" onclick="openDietDataScreen()">Abrir plano salvo</button>
    <button class="nutrition-secondary" onclick="dietMasterCheckIn()">Check-in</button>
    <button class="nutrition-secondary" onclick="gerarDietaPDF()">Exportar PDF</button>
    <button class="nutrition-secondary" onclick="openKronosFromDieta('Preciso de uma troca para a dieta de hoje.')">KRONOS Coach</button>
  </div>`;
}

function renderNutritionWeekScreen() {
  var state = getNutritionFlowState();
  var plan = state.generatedPlan || buildLocalDietPlan(buildNutritionFlowInput());
  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  var days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  return `<div class="nutrition-week-list">
    ${days.map(function(day, dayIndex) {
      var treino = dayIndex < 5 ? "Dia com treino planejado" : "Dia de rotina livre";
      return `<section class="nutrition-card nutrition-week-day">
        <div class="nutrition-meal-head"><strong>${day}</strong><span>${treino}</span></div>
        <small>${meals.length} refeições · mesmas metas, substituições liberadas por macro.</small>
        <div class="nutrition-week-meals">${meals.slice(0, 4).map(function(meal, mealIndex) {
          return `<button type="button" onclick="setNutritionFlowState({ selectedMealIndex: ${mealIndex} }); openDietDataScreen();">${escapeHTML(meal.horario || "")} · ${escapeHTML(meal.nome || "Refeição")}</button>`;
        }).join("")}</div>
      </section>`;
    }).join("")}
  </div>`;
}

function renderNutritionMealDetailScreen() {
  var state = getNutritionFlowState();
  var plan = state.generatedPlan || buildLocalDietPlan(buildNutritionFlowInput());
  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  var mealIndex = Math.max(0, Math.min(meals.length - 1, Number(state.selectedMealIndex || 0)));
  var meal = meals[mealIndex] || meals[0] || {};
  var alimentos = Array.isArray(meal.alimentos) ? meal.alimentos : [];
  var subtotal = meal.subtotal || {};
  return `<div class="nutrition-card">
    <div class="nutrition-meal-head"><strong>${escapeHTML(meal.nome || "Refeição")}</strong><span>${escapeHTML(meal.horario || "Hoje")}</span></div>
    <small>${subtotal.kcal || "--"} kcal · P ${subtotal.prot || "--"}g · C ${subtotal.carb || "--"}g · G ${subtotal.gord || "--"}g</small>
  </div>
  <div class="nutrition-meal-list" style="margin-top:12px">
    ${alimentos.map(function(food, foodIndex) {
      return `<div class="nutrition-meal-item">
        <div><strong>${escapeHTML(food.nome || "Alimento")}</strong><small>${escapeHTML(food.qtde || "")} · ${food.kcal || 0} kcal · P ${food.prot || 0}g · C ${food.carb || 0}g · G ${food.gord || 0}g</small></div>
        <button type="button" onclick="nutritionSubstituteFood(${mealIndex}, ${foodIndex})">Trocar</button>
      </div>`;
    }).join("")}
  </div>
  <div class="nutrition-inline-actions">
    <button class="nutrition-secondary" onclick="nutritionRegisterMeal(${mealIndex})">Registrar refeição</button>
    <button class="nutrition-secondary" onclick="openDietDataScreen()">Voltar para o plano salvo</button>
  </div>`;
}

function normalizePlannerFood(item) {
  if (!item) return null;
  return {
    nome: item.nome,
    porcao: item.porcao,
    kcal: Number(item.kcal || 0),
    prot: Number(item.proteina != null ? item.proteina : item.prot || 0),
    carb: Number(item.carboidrato != null ? item.carboidrato : item.carb || 0),
    gord: Number(item.gordura != null ? item.gordura : item.gord || 0),
    grupo: item.grupo || null,
    subgrupo: item.subgrupo || null,
  };
}

function classifyNutritionFoodGroup(food) {
  var name = normalizeDietFoodText(food && food.nome);
  var catalog = NUTRITION_FOOD_CATALOG.find(function(item) { return normalizeDietFoodText(item.nome) === name; });
  if (catalog) return catalog.grupo;
  if (Number(food && food.prot || 0) >= 8) return "proteinas";
  if (Number(food && food.carb || 0) >= 8) return "carboidratos";
  if (Number(food && food.gord || 0) >= 7) return "gorduras";
  return "vegetais";
}

function sumNutritionFoods(items) {
  return (Array.isArray(items) ? items : []).reduce(function(acc, item) {
    acc.kcal += Number(item.kcal || 0);
    acc.prot += Number(item.prot || 0);
    acc.carb += Number(item.carb || 0);
    acc.gord += Number(item.gord || 0);
    return acc;
  }, { kcal: 0, prot: 0, carb: 0, gord: 0 });
}

function buildNutritionSubstitutionOptions(food, group) {
  var base = normalizeDietFoodText(food && food.nome);
  var groupItems = getNutritionCatalogItems(group).map(normalizePlannerFood).filter(Boolean);
  var currentKcal = Number(food && food.kcal || 0);
  return groupItems
    .filter(function(item) { return normalizeDietFoodText(item.nome) !== base; })
    .sort(function(a, b) {
      return Math.abs(Number(a.kcal || 0) - currentKcal) - Math.abs(Number(b.kcal || 0) - currentKcal);
    })
    .slice(0, 4);
}

function scaleReplacementFood(candidate, previous) {
  var targetKcal = Math.max(1, Number(previous && previous.kcal || candidate.kcal || 1));
  var factor = Math.max(0.5, Math.min(1.7, targetKcal / Math.max(Number(candidate.kcal || 1), 1)));
  var cloned = {
    nome: candidate.nome,
    qtde: candidate.porcao,
    kcal: Math.round(candidate.kcal * factor),
    prot: Math.round(candidate.prot * factor * 10) / 10,
    carb: Math.round(candidate.carb * factor * 10) / 10,
    gord: Math.round(candidate.gord * factor * 10) / 10,
  };
  if (!/\bun\b|\bfatias\b|\blata\b|\bprato\b|\bml\b/i.test(String(candidate.porcao || ""))) {
    cloned.qtde = Math.max(5, Math.round((parseFloat(String(candidate.porcao).replace(",", ".")) || 0) * factor)) + " g";
  }
  return cloned;
}

function nutritionSubstituteFood(mealIndex, foodIndex) {
  var state = getNutritionFlowState();
  var plan = state.generatedPlan || buildLocalDietPlan(buildNutritionFlowInput());
  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes.slice() : [];
  var meal = meals[mealIndex];
  if (!meal || !Array.isArray(meal.alimentos) || !meal.alimentos[foodIndex]) return;
  var foods = meal.alimentos.slice();
  var previous = foods[foodIndex];
  var group = classifyNutritionFoodGroup(previous);
  var options = buildNutritionSubstitutionOptions(previous, group);
  if (!options.length) {
    showToast("Sem substituição compatível neste grupo.", "info", 2800);
    return;
  }
  var used = state._lastSubstitutionByFood || {};
  var key = mealIndex + ":" + foodIndex + ":" + normalizeDietFoodText(previous.nome);
  var nextIndex = Number(used[key] || 0) % options.length;
  foods[foodIndex] = scaleReplacementFood(options[nextIndex], previous);
  used[key] = nextIndex + 1;
  var subtotalRaw = sumNutritionFoods(foods);
  meals[mealIndex] = Object.assign({}, meal, {
    alimentos: foods,
    subtotal: {
      kcal: Math.round(subtotalRaw.kcal),
      prot: Math.round(subtotalRaw.prot * 10) / 10,
      carb: Math.round(subtotalRaw.carb * 10) / 10,
      gord: Math.round(subtotalRaw.gord * 10) / 10,
    },
  });
  var totals = meals.reduce(function(acc, currentMeal) {
    var subtotal = currentMeal.subtotal || {};
    acc.calorias += Number(subtotal.kcal || 0);
    acc.proteina += Number(subtotal.prot || 0);
    acc.carbo += Number(subtotal.carb || 0);
    acc.gordura += Number(subtotal.gord || 0);
    return acc;
  }, { calorias: 0, proteina: 0, carbo: 0, gordura: 0 });
  var nextPlan = Object.assign({}, plan, {
    meta: Object.assign({}, plan.meta || {}, {
      calorias: Math.round(totals.calorias),
      proteina: Math.round(totals.proteina * 10) / 10,
      carbo: Math.round(totals.carbo * 10) / 10,
      gordura: Math.round(totals.gordura * 10) / 10,
    }),
    refeicoes: meals,
  });
  setNutritionFlowState({
    generatedPlan: nextPlan,
    generatedText: renderDietModelAsText(nextPlan),
    _lastSubstitutionByFood: used,
  });
  try {
    var txt = document.getElementById("dietaTexto");
    if (txt) txt.textContent = renderDietModelAsText(nextPlan);
  } catch (_) {}
  showToast("Substituição aplicada mantendo o grupo e macros próximos.", "success", 2600);
  renderNutritionFlow();
}

function nutritionRegisterMeal(mealIndex) {
  var state = getNutritionFlowState();
  var registered = Object.assign({}, state.registeredMeals || {});
  registered[mealIndex] = new Date().toISOString();
  setNutritionFlowState({ registeredMeals: registered });
  showToast("Refeição registrada no plano de hoje.", "success", 2400);
  renderNutritionFlow();
}

function renderNutritionCheckinScreen() {
  var state = getNutritionFlowState();
  var checkin = state.checkin || {};
  return `<div class="nutrition-card">
    <div class="nutrition-input-wrap"><label>Aderência</label><select onchange="nutritionUpdateCheckin('aderencia', this.value)"><option ${checkin.aderencia === "total" ? "selected" : ""} value="total">Segui tudo</option><option ${checkin.aderencia === "parcial" ? "selected" : ""} value="parcial">Segui parcialmente</option><option ${checkin.aderencia === "baixa" ? "selected" : ""} value="baixa">Baixa aderência</option></select></div>
    <div class="nutrition-input-grid" style="margin-top:10px">
      <div class="nutrition-input-wrap"><label>Fome</label><select onchange="nutritionUpdateCheckin('fome', this.value)"><option ${checkin.fome === "controlada" ? "selected" : ""} value="controlada">Controlada</option><option ${checkin.fome === "alta" ? "selected" : ""} value="alta">Alta</option><option ${checkin.fome === "baixa" ? "selected" : ""} value="baixa">Baixa</option></select></div>
      <div class="nutrition-input-wrap"><label>Energia</label><select onchange="nutritionUpdateCheckin('energia', this.value)"><option ${checkin.energia === "boa" ? "selected" : ""} value="boa">Boa</option><option ${checkin.energia === "baixa" ? "selected" : ""} value="baixa">Baixa</option><option ${checkin.energia === "alta" ? "selected" : ""} value="alta">Alta</option></select></div>
    </div>
    <div class="nutrition-input-wrap" style="margin-top:10px"><label>Observações</label><textarea oninput="nutritionUpdateCheckin('observacoes', this.value)">${escapeHTML(checkin.observacoes || "")}</textarea></div>
  </div>`;
}

function nutritionUpdateCheckin(key, value) {
  var state = getNutritionFlowState();
  var checkin = Object.assign({}, state.checkin || {}, { [key]: value });
  setNutritionFlowState({ checkin: checkin });
}

function captureNutritionFlowScrollSnapshot() { return {}; }
function restoreNutritionFlowScrollSnapshot() {}

function renderNutritionFlow() {}


async function nutritionFlowGeneratePlan() {
  var primary = document.getElementById("nutritionFlowPrimary");
  if (primary) {
    primary.disabled = true;
    primary.textContent = "PROCESSANDO";
  }
  var body = document.getElementById("nutritionFlowBody");
  if (body) {
    body.innerHTML = `<div class="nutrition-official-processing">
      <div class="nutrition-official-spinner"></div>
      <h2 class="font-kronia" style="color:#F97316;font-size:20px;margin:0 0 8px">Processando Plano</h2>
      <p style="color:#94A3B8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;line-height:1.5;margin:0">Cruzando motor físico, metabólico e bioquímico...</p>
    </div>`;
  }
  var intakeSnapshot = buildNutritionIntakeSnapshot();
  var input = buildNutritionFlowInput();
  var dietPayload = buildDietRequestPayloadFromInput(input);
  dietPayload.context = Object.assign({}, dietPayload.context || {}, { intakeSnapshot: intakeSnapshot, source: "nutrition_intake_v2" });
  dietPayload.intakeSnapshot = intakeSnapshot;
  var localBasePlan = buildLocalDietPlan(input);
  var localPlan = Object.assign({}, localBasePlan, {
    visualPrescription: buildDietVisualPrescriptionFromLegacyPlan(localBasePlan)
  });
  var finalPlan = localPlan;
  var finalText = buildLocalDietRenderText(input, "Plano inicial gerado localmente pelo KRONOS.");
  var resolvedFromEngine = false;
  try {
    var guard = await validateScientificGenerationGuard("diet", input.objetivo, dietPayload, { respectedCardContext: true, respectedAnamnesisContext: true });
    if (guard && guard.ok) {
      var renderModel = await generateDietWithModernEngine(input, dietPayload, 12000);
      finalPlan = renderModel;
      finalText = renderDietModelAsText(renderModel) || finalText;
      resolvedFromEngine = true;
    }
  } catch (err) {
    finalText = buildLocalDietRenderText(input, err && err.message ? err.message : "Falha temporária ao sincronizar dieta. Prévia local temporária exibida sem substituir o plano ativo.");
  }
  setNutritionFlowState({
    generatedPlan: finalPlan,
    generatedText: finalText,
    step: NUTRITION_FLOW_STEPS.length - 1,
  });
  try {
    setActiveDietPlan(Object.assign(normalizeDietGeneratedPlan(finalPlan, {
      source: resolvedFromEngine ? "nutrition_intake_generated" : "nutrition_intake_local_fallback"
    }), {
      contextSnapshot: intakeSnapshot,
      rawGeneratedPlan: finalPlan,
    }), { render: false });
  } catch (_) {}
  try {
    var txt = document.getElementById("dietaTexto");
    var res = document.getElementById("dietaResultado");
    if (txt) txt.textContent = finalText;
    if (res) res.style.display = "block";
  } catch (_) {}
  persistDietGenerationPrefs(input);
  persistCanonicalNutritionSnapshot({ source: "nutrition_plan_generated" });
  var savedPlan = null;
  try { savedPlan = await saveActiveDietPlan({ silent: true, contextSnapshot: intakeSnapshot, generatedPlan: finalPlan }); } catch (_) {}
  finishDietGenerationSuccess(savedPlan || window._kroniaDietPlan || finalPlan);
}


function selDietaSingleChip(el, groupId) {
  document.querySelectorAll("#" + groupId + " .bs-chip").forEach(function(chip) { chip.classList.remove("active"); });
  el.classList.add("active");
}

// ══════════════════════════════════════════
// EXERCISE — YouTube redirect
// ══════════════════════════════════════════
function closeExerciseDiscSheet() {}

function normalizeExerciseLookupKey(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}


function openExerciseOnYouTube(card, nameOverride) {
  var name = nameOverride || (card && (card.getAttribute('data-ex-name') || card.querySelector('.ex-title')?.textContent)) || 'exercício';
  var url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent('como fazer ' + name + ' execução correta');
  window.open(url, '_blank', 'noopener,noreferrer');
}

function resolveAppApiUrl(path) {
  const safePath = String(path || "").trim();
  const normalizedPath = safePath.startsWith("/") ? safePath : ("/" + safePath);
  if (/^https?:\/\//i.test(safePath)) return safePath;
  if (/^https?:$/i.test(String(location.protocol || "")) && location.host) {
    return location.protocol + "//" + location.host + normalizedPath;
  }
  return "https://kronia.app.br" + normalizedPath;
}

function resolveInternalApiPath(path) {
  var safePath = String(path || "").trim();
  if (!safePath) return '/';
  if (/^https?:\/\//i.test(safePath)) {
    try {
      var parsed = new URL(safePath, window.location.href);
      return parsed.pathname + parsed.search;
    } catch (_) {
      return '/';
    }
  }
  return safePath.startsWith('/') ? safePath : ('/' + safePath);
}

function normalizeExerciseDetailsPayload(payload) {
  var safe = payload && typeof payload === 'object' ? payload : {};
  var names = safe.names && typeof safe.names === 'object' ? safe.names : null;
  if (!names && (safe.name || safe.nome)) { names = { pt: String(safe.name || safe.nome || '') }; }
  return Object.assign({}, safe, { names: names || {} });
}

function normalizeExerciseDetails(result) {
  var safe = result && typeof result === 'object' ? result : {};
  var inner = safe.data && typeof safe.data === 'object' ? safe.data : safe;
  return normalizeExerciseDetailsPayload(inner);
}

function renderExercise(data) {
  var normalized = normalizeExerciseDetails(data);
  _exerciseDiscSetState('result');
  _renderExerciseDiscResult(normalized, 'enriched');
}

async function fetchExerciseDetailsResponse(endpoint) {
  var response;
  try { response = await apiFetch(endpoint, { cache: 'no-store' }); } catch (err) {
    if (/did not match the expected pattern/i.test(String(err && err.message || ''))) {
      try { var h = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {}; var rt = await fetch(endpoint, { headers: h, cache: 'no-store' }); return JSON.parse(await rt.text()); } catch (_) {}
    }
    _exerciseDiscSetState('error');
    var errEl = document.getElementById('exerciseDiscErrorMsg');
    if (errEl) errEl.textContent = 'Não foi possível carregar os detalhes do exercício.';
    return null;
  }
  var ct = String(response && response.headers && response.headers.get('content-type') || '');
  if (!response.ok || /text\/html/i.test(ct)) { _exerciseDiscSetState('error'); var errEl2 = document.getElementById('exerciseDiscErrorMsg'); if (errEl2) errEl2.textContent = 'O servidor retornou uma página em vez de JSON.'; return null; }
  try { var t = await response.text(); return JSON.parse(t); } catch (_) { _exerciseDiscSetState('error'); var errEl3 = document.getElementById('exerciseDiscErrorMsg'); if (errEl3) errEl3.textContent = 'Resposta inválida do servidor.'; return null; }
}

async function openExerciseDetailsByName(exerciseName, options = {}) {
  var ref = options.exerciseRef && typeof options.exerciseRef === 'object' ? options.exerciseRef : {};
  var params = new URLSearchParams();
  if (exerciseName) params.set('exerciseName', String(exerciseName));
  if (ref.id) params.set('id', String(ref.id));
  if (ref.slug) params.set('slug', String(ref.slug));
  if (ref.normalized_lookup_key) params.set('lookupKey', String(ref.normalized_lookup_key));
  openExerciseDiscSheet();
  _exerciseDiscSetState('loading');
  var endpoint = resolveAppApiUrl('/api/kronia/exercises/details?' + params.toString());
  var result = await fetchExerciseDetailsResponse(endpoint);
  if (!result) return;
  renderExercise(result);
  if (typeof logExerciseDetailsEvent === 'function') logExerciseDetailsEvent(exerciseName, options);
}



function formatMuscleLabel(value) {
  const dict = {
    gluteos: 'Glúteos', posteriores_de_coxa: 'Posteriores de coxa', core: 'Core',
    peito: 'Peito', triceps: 'Tríceps', ombros: 'Ombros', quadriceps: 'Quadríceps',
    dorsais: 'Dorsais', biceps: 'Bíceps', antebracos: 'Antebraços', panturrilhas: 'Panturrilhas',
    trapezio: 'Trapézio', peito_superior: 'Peito superior', deltoides_posteriores: 'Deltoides posteriores',
    flexores_do_quadril: 'Flexores do quadril', abdomen: 'Abdômen', lombar: 'Lombar'
  };
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  return dict[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}


async function openNutritionFlowFull(context) {
  if (!(context && context.__allowLegacyNutritionFlow === true)) {
    scheduleKroniaUIUnblock('before-open-nutrition-flow-full-route');
    try { window.KroniaDiet.hideLegacyScreens?.(); } catch (_) {}
    return openOfficialDietEntry(Object.assign({ source: 'open_nutrition_flow_full_route', forceNew: true }, context || {}));
  }
}
async function openDietaSheet(context) {
  return openNutritionFlowFull(context);
}
function closeDietaSheet() {
  document.getElementById("dietaSheet").classList.remove("show");
  closeAllDietGenerationLayers({ keepDietData: document.getElementById('dietDataScreen')?.classList.contains('show') === true });
}

// ── Busca dados do perfil no Supabase e preenche o formulário ──
async function _preencherDietaDoSupabase() {
  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    const scopeResolver = window.KroniaAccessScope && window.KroniaAccessScope.resolveAccessScope
      ? window.KroniaAccessScope.resolveAccessScope(session.user, { ownershipColumn: 'user_id', purpose: 'diet_sheet', allowAdminGlobalRead: false })
      : null;

    const profileScope = window.KroniaAccessScope && window.KroniaAccessScope.resolveAccessScope
      ? window.KroniaAccessScope.resolveAccessScope(session.user, { ownershipColumn: 'id', purpose: 'diet_sheet_profile', allowAdminGlobalRead: false })
      : null;

    const [profRes, metricRes, goalsRes, suplRes, labsRes] = await Promise.all([
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('profiles').select('full_name,birth_date,sex,height_cm,current_weight_kg,activity_level,objective,dietary_pattern,allergies,intolerances,liked_foods,disliked_foods,clinical_notes'), profileScope) : _sb.from('profiles').select('full_name,birth_date,sex,height_cm,current_weight_kg,activity_level,objective,dietary_pattern,allergies,intolerances,liked_foods,disliked_foods,clinical_notes').eq('id', userId)).maybeSingle(),
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('body_metrics').select('weight_kg,body_fat_percent,waist_cm,hip_cm'), scopeResolver) : _sb.from('body_metrics').select('weight_kg,body_fat_percent,waist_cm,hip_cm').eq('user_id', userId)).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('nutrition_goals').select('calories_target,protein_g,carbs_g,fat_g'), scopeResolver) : _sb.from('nutrition_goals').select('calories_target,protein_g,carbs_g,fat_g').eq('user_id', userId)).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('supplement_protocols').select('supplement_name').eq('active', true), scopeResolver) : _sb.from('supplement_protocols').select('supplement_name').eq('user_id', userId).eq('active', true)),
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('lab_reports').select('id,normalized_payload,ai_insights,confidence,confidence_summary,is_valid,clinical_flags,critical_flags,created_at,processed_at').eq('is_valid', true), scopeResolver) : _sb.from('lab_reports').select('id,normalized_payload,ai_insights,confidence,confidence_summary,is_valid,clinical_flags,critical_flags,created_at,processed_at').eq('user_id', userId).eq('is_valid', true)).order('processed_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
    ]);

    const p  = profRes.data;
    const bm = metricRes.data;
    const g  = goalsRes.data;
    const sp = suplRes.data || [];
    const lab = labsRes.data || null;
    const labInsights = lab && lab.ai_insights && typeof lab.ai_insights === 'object' ? lab.ai_insights : null;

    window._dietaSupabaseSnapshot = {
      profile: p || null,
      bodyMetrics: bm || null,
      nutritionGoals: g || null,
      supplementProtocols: sp.map(function(item) { return item?.supplement_name; }).filter(Boolean),
      latestLabReport: lab ? {
        id: lab.id || null,
        isValid: Boolean(lab.is_valid),
        confidence: Number(lab.confidence || 0),
        confidenceSummary: lab.confidence_summary || null,
        biomarkers: lab.normalized_payload && Array.isArray(lab.normalized_payload.biomarkers) ? lab.normalized_payload.biomarkers : [],
        healthProfile: labInsights && labInsights.health_profile ? labInsights.health_profile : null,
        clinicalFlags: Array.isArray(lab.clinical_flags) ? lab.clinical_flags : (labInsights && Array.isArray(labInsights.clinical_flags) ? labInsights.clinical_flags : []),
        criticalFlags: Array.isArray(lab.critical_flags) ? lab.critical_flags : (labInsights && Array.isArray(labInsights.critical_flags) ? labInsights.critical_flags : []),
        createdAt: lab.created_at || null,
        processedAt: lab.processed_at || null,
      } : null,
      hydratedAt: new Date().toISOString(),
    };

    // Guarda goals para usar no prompt
    if (g) window._dietaGoalsSupabase = g;

    if (!p) return;

    // Peso — prefere body_metrics mais recente
    const peso = bm?.weight_kg || p.current_weight_kg;
    if (peso) document.getElementById("dietaPeso").value = peso;
    if (p.height_cm) document.getElementById("dietaAltura").value = p.height_cm;

    // % gordura do body_metrics
    if (bm?.body_fat_percent) document.getElementById("dietaGordura").value = bm.body_fat_percent;

    // Idade a partir de birth_date
    if (p.birth_date) {
      const age = Math.floor((Date.now() - new Date(p.birth_date)) / (365.25*24*3600*1000));
      if (age > 10 && age < 120) document.getElementById("dietaIdade").value = age;
    }

    // Sexo
    if (p.sex) selectDietaSexo(p.sex === 'female' || p.sex === 'feminino' ? 'F' : 'M');

    // Objetivo
    if (p.objective) {
      const oMap = { emagrecimento:'emagrecimento', manutencao:'manutencao', manutención:'manutencao', hipertrofia:'hipertrofia', recomposicao:'recomposicao', forca:'forca' };
      const el = document.querySelector(`#dietaObjChips [data-val="${oMap[p.objective] || p.objective}"]`);
      if (el) selDietaObj(el);
    }

    // Atividade
    if (p.activity_level) {
      const aMap = { sedentario:'sedentário', sedentário:'sedentário', leve:'levemente ativo', moderado:'moderadamente ativo', ativo:'muito ativo', muito_ativo:'muito ativo', atleta:'atleta' };
      const el = document.querySelector(`#dietaAtivChips [data-val="${aMap[p.activity_level] || 'levemente ativo'}"]`);
      if (el) selDietaAtiv(el);
    }

    // Padrão alimentar
    if (p.dietary_pattern) {
      const padSel = document.getElementById("dietaPadrao");
      if (padSel) {
        const pMap = { onivoro:'onívoro', vegetariano:'vegetariano', vegano:'vegano', low_carb:'low carb', cetogenico:'cetogênico', mediterraneo:'mediterrâneo' };
        const pv = pMap[p.dietary_pattern] || p.dietary_pattern;
        Array.from(padSel.options).forEach(o => { if (o.value === pv) o.selected = true; });
      }
    }

    // Preferências alimentares (liked_foods)
    if (p.liked_foods?.length && !document.getElementById("dietaPrefs").value) {
      document.getElementById("dietaPrefs").value = p.liked_foods.join(", ");
    }

    // Alimentos que não gosta (disliked_foods)
    if (p.disliked_foods?.length && !document.getElementById("dietaDislikes").value) {
      document.getElementById("dietaDislikes").value = p.disliked_foods.join(", ");
    }

    // Restrições: allergies + intolerances + clinical_notes
    const restParts = [...(p.allergies || []), ...(p.intolerances || [])];
    if (restParts.length && !document.getElementById("dietaRestric").value) {
      document.getElementById("dietaRestric").value = restParts.join(", ");
    }

    // Suplementos do banco
    if (sp.length) {
      sp.forEach(s => {
        const el = document.querySelector(`#dietaSuplChips [data-val="${s.supplement_name}"]`);
        if (el && !el.classList.contains("active")) el.classList.add("active");
      });
    }

    atualizarBasalDieta();
  } catch(e) {
    console.warn('[dietaSheet] Supabase:', e.message);
  }
}

// ── Calculadora Basal Ultra-Profissional ──────────────────────
function atualizarBasalDieta() {
  const peso   = parseFloat(document.getElementById("dietaPeso")?.value);
  const altura = parseFloat(document.getElementById("dietaAltura")?.value);
  const idade  = parseInt(document.getElementById("dietaIdade")?.value);
  const gordPct = parseFloat(document.getElementById("dietaGordura")?.value);
  const card   = document.getElementById("dietaBasalCard");
  if (!card) return;
  if (!peso || !altura || !idade || peso <= 0 || altura <= 0 || idade <= 0) { card.style.display = "none"; return; }

  const sexoF = document.getElementById("dietaSexoF")?.classList.contains("active");

  // Mifflin-St Jeor
  const tmbMifflin = sexoF
    ? Math.round(10*peso + 6.25*altura - 5*idade - 161)
    : Math.round(10*peso + 6.25*altura - 5*idade + 5);

  // Katch-McArdle (requer % gordura)
  let tmbKatch = null, massaMagra = null;
  if (gordPct && gordPct > 2 && gordPct < 60) {
    massaMagra = Math.round(peso * (1 - gordPct/100) * 10) / 10;
    tmbKatch   = Math.round(370 + 21.6 * massaMagra);
  }

  // TMB principal: Katch-McArdle se disponível (mais preciso)
  const tmbPrincipal = tmbKatch || tmbMifflin;

  // Níveis de atividade
  const niveis = [
    { label: "😴 Sedentário",          val: "sedentário",           mult: 1.2   },
    { label: "🚶 Levemente ativo",     val: "levemente ativo",      mult: 1.375 },
    { label: "🏃 Moderadamente ativo", val: "moderadamente ativo",  mult: 1.55  },
    { label: "💪 Muito ativo",         val: "muito ativo",          mult: 1.725 },
    { label: "🔥 Atleta",             val: "atleta",               mult: 1.9   }
  ];
  const ativEl  = document.querySelector("#dietaAtivChips .bs-chip.active");
  const ativVal = ativEl?.dataset.val || "levemente ativo";
  const fator   = niveis.find(n => n.val === ativVal)?.mult || 1.375;
  const tdee    = Math.round(tmbPrincipal * fator);

  // Objetivo e meta calórica
  const objEl = document.querySelector("#dietaObjChips .bs-chip.active");
  const obj   = objEl?.dataset.val || "hipertrofia";
  const metaCfg = {
    emagrecimento: { delta: -400, label: "Emagrecimento",  deltaTxt: "−400 kcal abaixo do TDEE (déficit moderado)" },
    hipertrofia:   { delta:  300, label: "Hipertrofia",    deltaTxt: "+300 kcal acima do TDEE (superávit limpo)"  },
    manutencao:    { delta:    0, label: "Manutenção",     deltaTxt: "= TDEE (equilíbrio calórico)"              },
    forca:         { delta:  200, label: "Força",          deltaTxt: "+200 kcal acima do TDEE"                  },
    recomposicao:  { delta:  -50, label: "Recomposição",   deltaTxt: "~TDEE com leve déficit + alta proteína"   }
  };
  const cfg  = metaCfg[obj] || metaCfg.hipertrofia;
  const meta = tdee + cfg.delta;

  // Macros por objetivo (ISSN)
  const protFator = { emagrecimento: 2.3, hipertrofia: 2.0, manutencao: 1.8, forca: 2.0, recomposicao: 2.2 }[obj] || 2.0;
  const protG   = Math.round(peso * protFator);
  const gordG   = Math.round(meta * 0.25 / 9);
  const carbG   = Math.max(0, Math.round((meta - protG*4 - gordG*9) / 4));
  const pctProt = Math.round(protG*4 / meta * 100);
  const pctCarb = Math.round(carbG*4 / meta * 100);
  const pctGord = Math.round(gordG*9 / meta * 100);

  // ── Atualiza DOM ──
  document.getElementById("dietaBasalTMB").textContent = tmbMifflin.toLocaleString('pt-BR') + " kcal";

  const katchDiv = document.getElementById("dietaBasalKatchDiv");
  const massaDiv = document.getElementById("dietaBasalMassaDiv");
  if (tmbKatch && massaMagra) {
    document.getElementById("dietaBasalTMBKatch").textContent  = tmbKatch.toLocaleString('pt-BR') + " kcal";
    document.getElementById("dietaBasalMassaMagra").textContent = massaMagra.toLocaleString('pt-BR') + " kg";
    if (katchDiv) katchDiv.style.display = "";
    if (massaDiv) massaDiv.style.display = "none";
  } else {
    document.getElementById("dietaBasalMassaMagra").textContent = "Informe % gordura";
    if (katchDiv) katchDiv.style.display = "none";
    if (massaDiv) massaDiv.style.display = "";
  }

  // TDEE table
  document.getElementById("dietaBasalTDEERows").innerHTML = niveis.map(n => {
    const v = Math.round(tmbPrincipal * n.mult);
    const active = n.val === ativVal;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:0.75rem;color:${active ? 'var(--text)' : 'var(--text-2)'};font-weight:${active ? 700 : 400}">${n.label}</span>
      <span style="font-size:0.8rem;font-weight:${active ? 800 : 500};color:${active ? 'var(--accent)' : 'var(--text-2)'}">${v.toLocaleString('pt-BR')} kcal${active ? ' ◀' : ''}</span>
    </div>`;
  }).join('');

  // Meta
  document.getElementById("dietaBasalObjLabel").textContent = cfg.label;
  document.getElementById("dietaBasalMeta").textContent     = meta.toLocaleString('pt-BR') + " kcal/dia";
  document.getElementById("dietaBasalDelta").textContent    = cfg.deltaTxt;

  // Macros grid
  document.getElementById("dietaBasalMacros").innerHTML = [
    { nome: "Proteína",    g: protG, pct: pctProt, sub: `${protFator.toFixed(1)}g/kg · ${protG*4} kcal` },
    { nome: "Carboidrato", g: carbG, pct: pctCarb, sub: `${carbG*4} kcal`   },
    { nome: "Gordura",     g: gordG, pct: pctGord, sub: `${gordG*9} kcal`   }
  ].map(m => `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center">
    <div style="font-size:0.57rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">${m.nome}</div>
    <div style="font-size:0.95rem;font-weight:800;color:var(--text)">${m.g}g</div>
    <div style="font-size:0.6rem;color:var(--muted)">${m.pct}%</div>
    <div style="font-size:0.6rem;color:var(--muted)">${m.sub}</div>
  </div>`).join('');

  // Extras
  const hidrat  = (peso * 0.035).toFixed(1);
  const protMin = Math.round(peso * 1.6);
  document.getElementById("dietaBasalHidrat").textContent   = hidrat + " L/dia";
  document.getElementById("dietaBasalProtRange").textContent = `${protMin}–${protG}g/dia`;

  card.style.display = "";
  try {
    var snapshotInput = collectDietGenerationInput();
    renderDietMasterSnapshot(snapshotInput, {
      tmb: tmbPrincipal,
      tdee: tdee,
      metaCalorias: meta,
      proteinaMeta: protG,
      gorduraMeta: gordG,
      carboMeta: carbG,
      hidratacaoLitros: Number(hidrat),
      massaMagra: massaMagra,
    });
  } catch (_) {}
}

function selDietaObj(el) {
  document.querySelectorAll("#dietaObjChips .bs-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  atualizarBasalDieta();
}
function selDietaAtiv(el) {
  document.querySelectorAll("#dietaAtivChips .bs-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  atualizarBasalDieta();
}
function selDietaBio(el) {
  document.querySelectorAll("#dietaBioChips .bs-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
}
function selDietaTipoTreino(el) {
  // Múltipla seleção
  el.classList.toggle("active");
}
function selDietaPatologia(el) {
  const val = el.dataset.val;
  if (val === "nenhuma") {
    // "Nenhuma" é exclusivo — desseleciona todas as outras
    document.querySelectorAll("#dietaPatologiaChips .bs-chip").forEach(c => c.classList.remove("active"));
    el.classList.add("active");
  } else {
    // Selecionar outra → remove "nenhuma" e faz toggle
    document.querySelector('#dietaPatologiaChips [data-val="nenhuma"]')?.classList.remove("active");
    el.classList.toggle("active");
    // Se nenhuma ficou ativa, volta "Nenhuma"
    const anyActive = document.querySelectorAll("#dietaPatologiaChips .bs-chip.active").length > 0;
    if (!anyActive) document.querySelector('#dietaPatologiaChips [data-val="nenhuma"]')?.classList.add("active");
  }
}
function selDietaSupl(el) {
  // Toggle (múltipla seleção)
  el.classList.toggle("active");
}
// aliases para retrocompatibilidade
function selectDietaObj(el) { selDietaObj(el); }
function selectDietaSexo(s) {
  document.getElementById("dietaSexoM").classList.toggle("active", s === "M");
  document.getElementById("dietaSexoF").classList.toggle("active", s === "F");
  atualizarBasalDieta();
}
function selectDietaAtiv(el) { selDietaAtiv(el); }

// ── Calculadora Basal Sheet ───────────────────────────
let _bsSexo = 'M', _bsAtiv = 1.375;

function openBasalSheet() {
  const cfg = safeJSON("kronia_config", {});
  const prefs = safeJSON("kronia_calc_prefs", {});
  document.getElementById("bsPeso").value   = prefs.bsPeso   || cfg.peso   || "";
  document.getElementById("bsAltura").value = prefs.bsAltura || cfg.altura || "";
  document.getElementById("bsIdade").value  = prefs.bsIdade  || cfg.idade  || "";
  selBsSexo(prefs.bsSexo || cfg.sexo || "M");
  if (prefs.bsAtiv) {
    const el = document.querySelector(`#bsAtivChips [data-val="${prefs.bsAtiv}"]`);
    if (el) selBsAtiv(el);
  }
  document.getElementById("basalSheet").classList.add("show");
}
function closeBasalSheet() {
  document.getElementById("basalSheet").classList.remove("show");
}
function selBsSexo(s) {
  _bsSexo = s;
  document.getElementById("bsSexoM").classList.toggle("active", s === "M");
  document.getElementById("bsSexoF").classList.toggle("active", s === "F");
}
function selBsAtiv(el) {
  document.querySelectorAll("#bsAtivChips .bs-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  _bsAtiv = parseFloat(el.dataset.val);
}
function calcBasal() {
  const peso   = parseFloat(document.getElementById("bsPeso").value);
  const altura = parseFloat(document.getElementById("bsAltura").value);
  const idade  = parseInt(document.getElementById("bsIdade").value);
  if (!peso || peso <= 0 || !altura || altura <= 0 || !idade || idade <= 0) { showToast("Preencha peso, altura e idade com valores válidos.", "error"); return; }
  const _bsAtivEl = document.querySelector("#bsAtivChips .bs-chip.active");
  localStorage.setItem("kronia_calc_prefs", JSON.stringify({
    ...safeJSON("kronia_calc_prefs", {}),
    bsPeso: document.getElementById("bsPeso").value,
    bsAltura: document.getElementById("bsAltura").value,
    bsIdade: document.getElementById("bsIdade").value,
    bsSexo: _bsSexo,
    bsAtiv: _bsAtivEl ? _bsAtivEl.dataset.val : String(_bsAtiv)
  }));

  const tmb = _bsSexo === "F"
    ? Math.round(10*peso + 6.25*altura - 5*idade - 161)
    : Math.round(10*peso + 6.25*altura - 5*idade + 5);
  const tdee = Math.round(tmb * _bsAtiv);

  document.getElementById("bsValTMB").textContent  = tmb  + " kcal";
  document.getElementById("bsValTDEE").textContent = tdee + " kcal";

  const niveis = [
    { label: "😴 Sedentário",          mult: 1.2   },
    { label: "🚶 Levemente ativo",     mult: 1.375 },
    { label: "🏃 Moderadamente ativo", mult: 1.55  },
    { label: "💪 Muito ativo",         mult: 1.725 },
    { label: "🔥 Atleta",             mult: 1.9   }
  ];
  document.getElementById("bsTDEERows").innerHTML = niveis.map(n =>
    `<div class="bs-tdee-row">
      <span>${n.label}</span>
      <span style="font-weight:700;color:${Math.abs(n.mult - _bsAtiv) < 0.001 ? 'var(--accent)' : 'var(--text)'}">${Math.round(tmb * n.mult)} kcal</span>
    </div>`
  ).join('');

  document.getElementById("bsEmagRec").textContent = (tdee - 400) + " kcal";
  document.getElementById("bsMant").textContent    = tdee + " kcal";
  document.getElementById("bsGanho").textContent   = (tdee + 300) + " kcal";

  document.getElementById("basalSheetResult").style.display = "";
  document.getElementById("basalSheetResult").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function irGerarDieta() {
  closeBasalSheet();
  setTimeout(() => openDietaSheet(), 320);
}
function preencherDietaDosPerfil() {
  const cfg   = safeJSON("kronia_config", {});
  const prefs = safeJSON("kronia_calc_prefs", {});
  const setV  = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  setV("dietaPeso",    prefs.dietaPeso    || cfg.peso    || "");
  setV("dietaAltura",  prefs.dietaAltura  || cfg.altura  || "");
  setV("dietaIdade",   prefs.dietaIdade   || cfg.idade   || "");
  setV("dietaGordura", prefs.dietaGordura || cfg.gordura || "");
  setV("dietaRefeicoes", prefs.dietaRefeicoes || "");
  setV("dietaRestric",   prefs.dietaRestric   || "");
  setV("dietaPrefs",     prefs.dietaPrefs     || "");
  setV("dietaDislikes",  prefs.dietaDislikes  || "");
  setV("dietaMedicamentos", prefs.dietaMedicamentos || "");
  setV("dietaOutrosSupl",   prefs.dietaOutrosSupl   || "");
  if (prefs.dietaOrcamento) setV("dietaOrcamento", prefs.dietaOrcamento);
  if (prefs.dietaPadrao)    setV("dietaPadrao",    prefs.dietaPadrao);
  if (prefs.dietaHorarioTreino) setV("dietaHorarioTreino", prefs.dietaHorarioTreino);
  if (prefs.dietaPraticidade) setV("dietaPraticidade", prefs.dietaPraticidade);
  if (prefs.dietaVariedade) {
    const el = document.querySelector(`#dietaVariedadeChips [data-val="${prefs.dietaVariedade}"]`);
    if (el) selDietaSingleChip(el, "dietaVariedadeChips");
  }
  if (prefs.dietaModoAjuste) {
    const el = document.querySelector(`#dietaAjusteChips [data-val="${prefs.dietaModoAjuste}"]`);
    if (el) selDietaSingleChip(el, "dietaAjusteChips");
  }
  if (prefs.dietaObj)  { const el = document.querySelector(`#dietaObjChips [data-val="${prefs.dietaObj}"]`);   if (el) selDietaObj(el); }
  if (prefs.dietaSexo) selectDietaSexo(prefs.dietaSexo);
  if (prefs.dietaAtiv) { const el = document.querySelector(`#dietaAtivChips [data-val="${prefs.dietaAtiv}"]`); if (el) selDietaAtiv(el); }
  if (prefs.dietaBio)  { const el = document.querySelector(`#dietaBioChips [data-val="${prefs.dietaBio}"]`);   if (el) selDietaBio(el); }
}
function copiarDieta() {
  const txt = document.getElementById("dietaTexto").textContent;
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => {
    const btn = document.getElementById("btnCopiarDieta");
    const orig = btn.innerHTML;
    btn.textContent = "✓ Copiado!";
    setTimeout(() => { btn.innerHTML = orig; }, 2200);
  }).catch(() => {});
}

function gerarDietaPDF() {
  if (typeof exportActiveDietPlanPDF === "function") {
    exportActiveDietPlanPDF();
    return;
  }
  const conteudo = document.getElementById("dietaTexto").textContent;
  if (!conteudo || conteudo.includes("Calculando")) return;

  const cfg    = safeJSON("kronia_config", {});
  const nome   = cfg.nome || "Atleta";
  const peso   = document.getElementById("dietaPeso")?.value || cfg.peso || "";
  const altura = document.getElementById("dietaAltura")?.value || cfg.altura || "";
  const idade  = document.getElementById("dietaIdade")?.value || cfg.idade || "";
  const obj    = document.querySelector("#dietaObjChips .bs-chip.active")?.textContent || "";
  const ativ   = document.querySelector("#dietaAtivChips .bs-chip.active")?.textContent || "";
  const data   = new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" });
  const logoUrl = window.location.origin + "/Kronia.png";

  // ── Parser do formato estruturado por blocos ## ────────────────────
  function parseConteudo(txt) {
    const result = { meta:{}, refeicoes:[], resumo:[], total:null, orientacoes:[] };
    let bloco = null, ref = null;
    txt.split("\n").forEach(raw => {
      const l = raw.trim();
      if (!l) return;
      if (l === "##META")        { bloco="meta"; return; }
      if (l === "##REFEICAO")    { if(ref) result.refeicoes.push(ref); ref={nome:"",horario:"",tag:"",alimentos:[],subtotal:null}; bloco="refeicao"; return; }
      if (l === "##RESUMO")      { if(ref){result.refeicoes.push(ref);ref=null;} bloco="resumo"; return; }
      if (l === "##ORIENTACOES") { bloco="orientacoes"; return; }
      if (bloco==="meta") {
        const m=l.match(/^([^:]+):\s*(.+)/); if(m) result.meta[m[1].trim().toUpperCase()]=m[2].trim();
      } else if (bloco==="refeicao" && ref) {
        if (l.startsWith("NOME:"))    { ref.nome=l.replace(/^NOME:\s*/,""); return; }
        if (l.startsWith("HORARIO:")) { ref.horario=l.replace(/^HORARIO:\s*/,""); return; }
        if (l.startsWith("TAG:"))     { ref.tag=l.replace(/^TAG:\s*/,""); return; }
        const p=l.split("|");
        if (p.length>=6) {
          if (p[0].trim().toUpperCase().startsWith("SUBTOTAL")) {
            ref.subtotal={kcal:p[2]||p[3],prot:p[3]||p[4],carb:p[4]||p[5],gord:p[5]||p[6]};
          } else if (!p[0].trim().toUpperCase().startsWith("ALIMENTO")) {
            ref.alimentos.push({nome:p[0].trim(),qtde:p[1].trim(),kcal:p[2].trim(),prot:p[3].trim(),carb:p[4].trim(),gord:p[5].trim()});
          }
        }
      } else if (bloco==="resumo") {
        const p=l.split("|");
        if (p.length>=5) {
          if (p[0].trim().toUpperCase().startsWith("TOTAL")) result.total={kcal:p[1].trim(),prot:p[2].trim(),carb:p[3].trim(),gord:p[4].trim()};
          else result.resumo.push({nome:p[0].trim(),kcal:p[1].trim(),prot:p[2].trim(),carb:p[3].trim(),gord:p[4].trim()});
        }
      } else if (bloco==="orientacoes") {
        const idx=l.indexOf("|");
        if(idx>0) result.orientacoes.push({label:l.slice(0,idx).trim(),desc:l.slice(idx+1).trim()});
      }
    });
    if(ref) result.refeicoes.push(ref);
    return result;
  }

  const d = parseConteudo(conteudo);

  // ── HTML das refeições em tabela ───────────────────────────────────
  const refeicoesHTML = d.refeicoes.map(r => {
    const rows = r.alimentos.map((a,i)=>`
        <tr class="${i%2===0?'tr-even':'tr-odd'}">
          <td>${a.nome}</td><td class="tc">${a.qtde}</td><td class="tc">${a.kcal}</td>
          <td class="tc">${a.prot}</td><td class="tc">${a.carb}</td><td class="tc">${a.gord}</td>
        </tr>`).join("");
    const sub = r.subtotal ? `
        <tr class="sub-row">
          <td colspan="2">SUBTOTAL DA REFEIÇÃO</td>
          <td colspan="4" class="tr">TOTAL: ${r.subtotal.kcal} kcal | Prot ${r.subtotal.prot}g | Carb ${r.subtotal.carb}g | Gord ${r.subtotal.gord}g</td>
        </tr>` : "";
    return `
    <div class="meal-block">
      <div class="meal-bar">
        <div class="meal-left">
          ${r.horario?`<span class="meal-hr">${r.horario}</span>`:""}
          <strong class="meal-nm">${r.nome}</strong>
        </div>
        ${r.tag?`<span class="meal-tag">${r.tag}</span>`:""}
      </div>
      <table>
        <thead><tr><th>ALIMENTO</th><th class="tc">QTDE</th><th class="tc">KCAL</th><th class="tc">PROT</th><th class="tc">CARB</th><th class="tc">GORD</th></tr></thead>
        <tbody>${rows}${sub}</tbody>
      </table>
    </div>`;
  }).join("");

  // ── HTML resumo do dia ─────────────────────────────────────────────
  const resumoHTML = d.resumo.length ? `
    <div class="sec-title"><span class="sec-icon">■</span><span>Resumo do Dia</span></div>
    <table>
      <thead><tr class="thead-dark"><th>REFEIÇÃO</th><th class="tc">KCAL</th><th class="tc">PROT (g)</th><th class="tc">CARB (g)</th><th class="tc">GORD (g)</th></tr></thead>
      <tbody>
        ${d.resumo.map((r,i)=>`<tr class="${i%2===0?'tr-even':'tr-odd'}"><td>${r.nome}</td><td class="tc">${r.kcal}</td><td class="tc">${r.prot}</td><td class="tc">${r.carb}</td><td class="tc">${r.gord}</td></tr>`).join("")}
        ${d.total?`<tr class="total-row"><td>TOTAL DIÁRIO</td><td class="tc">${d.total.kcal}</td><td class="tc">${d.total.prot}</td><td class="tc">${d.total.carb}</td><td class="tc">${d.total.gord}</td></tr>`:""}
      </tbody>
    </table>` : "";

  // ── HTML orientações ───────────────────────────────────────────────
  const oriHTML = d.orientacoes.length ? `
    <div class="sec-title" style="margin-top:22px"><span class="sec-icon">■</span><span>Hidratação & Orientações</span></div>
    <table class="ori-tbl">
      <tbody>${d.orientacoes.map((o,i)=>`
        <tr class="${i%2===0?'tr-even':'tr-odd'}">
          <td class="ori-lbl"><span class="ori-sq">■</span><strong>${o.label}</strong></td>
          <td class="ori-desc">${o.desc}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : "";

  // ── Barra de macros no topo ────────────────────────────────────────
  const metaHTML = d.meta.CALORIAS ? `
  <div class="meta-bar">
    <div class="mi"><span class="mv">${d.meta.CALORIAS}</span><span class="ml">kcal / dia</span></div>
    <div class="ms"></div>
    <div class="mi"><span class="mv">${d.meta.PROTEINA||"–"}g</span><span class="ml">Proteína</span></div>
    <div class="ms"></div>
    <div class="mi"><span class="mv">${d.meta.CARB||"–"}g</span><span class="ml">Carboidrato</span></div>
    <div class="ms"></div>
    <div class="mi"><span class="mv">${d.meta.GORDURA||"–"}g</span><span class="ml">Gordura</span></div>
  </div>` : "";

  const infoChips = [obj, ativ, peso?`${peso} kg`:"", altura?`${altura} cm`:"", idade?`${idade} anos`:""]
    .filter(Boolean).map(c=>`<span class="chip">${c}</span>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Plano Alimentar – ${nome}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#fff;max-width:900px;margin:auto;font-size:13px}

  /* HEADER */
  .hd{background:#1a1a1a;padding:20px 32px;display:flex;align-items:center;justify-content:space-between}
  .hd-l{display:flex;align-items:center;gap:14px}
  .logo{width:52px;height:52px;background:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:3px;flex-shrink:0}
  .logo img{width:100%;height:100%;object-fit:contain}
  .hd-title{color:#fff;font-size:1.3rem;font-weight:900;letter-spacing:.06em}
  .hd-sub{color:rgba(255,255,255,.4);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;margin-top:3px}
  .hd-r{text-align:right}
  .hd-nome{color:#fff;font-size:.95rem;font-weight:800;letter-spacing:.04em}
  .hd-data{color:rgba(255,255,255,.4);font-size:.62rem;margin-top:3px}
  .obar{height:4px;background:#f97316}

  /* INFO CHIPS */
  .info-row{padding:10px 32px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #e5e7eb}
  .chip{background:#fff7ed;color:#c2410c;border:1.5px solid #fed7aa;border-radius:100px;padding:3px 11px;font-size:.63rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase}

  /* META BAR */
  .meta-bar{margin:14px 32px;background:#1a1a1a;border-radius:10px;display:flex;align-items:center;justify-content:space-around;padding:13px 20px}
  .mi{text-align:center}
  .mv{display:block;color:#f97316;font-size:1.05rem;font-weight:900}
  .ml{color:rgba(255,255,255,.5);font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;margin-top:2px;display:block}
  .ms{width:1px;height:30px;background:rgba(255,255,255,.12)}

  /* BODY */
  .body{padding:6px 32px 28px}

  /* MEAL BLOCK */
  .meal-block{margin-bottom:18px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
  .meal-bar{background:#1a1a1a;padding:9px 14px;display:flex;align-items:center;justify-content:space-between}
  .meal-left{display:flex;align-items:center;gap:10px}
  .meal-hr{color:#f97316;font-weight:900;font-size:.95rem}
  .meal-nm{color:#fff;font-size:.88rem}
  .meal-tag{color:#f97316;font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}

  /* TABLE */
  table{width:100%;border-collapse:collapse;font-size:12px}
  thead tr{background:#2d4535}
  th{color:#fff;padding:7px 10px;font-size:.61rem;letter-spacing:.07em;font-weight:700;text-align:left}
  .tc{text-align:center !important;width:58px}
  td{padding:7px 10px;border-bottom:1px solid #f3f4f6;color:#333}
  .tr-even{background:#fff}
  .tr-odd{background:#f9fafb}
  .sub-row td{background:#f0f0f0;font-size:.62rem;font-weight:700;color:#555;text-align:left !important}
  .thead-dark{background:#1a1a1a !important}
  .total-row td{background:#1a1a1a;color:#fff;font-weight:900;font-size:.82rem}
  .total-row .tc{color:#f97316}

  /* SECTION TITLE */
  .sec-title{display:flex;align-items:center;gap:8px;margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #1a1a1a;font-size:.88rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
  .sec-icon{font-size:.7rem;color:#1a1a1a}

  /* ORIENTACOES */
  .ori-tbl{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
  .ori-lbl{padding:9px 14px;white-space:nowrap;width:140px;vertical-align:middle}
  .ori-lbl strong{font-size:.73rem;color:#1a1a1a}
  .ori-sq{color:#2d4535;font-size:.62rem;margin-right:6px}
  .ori-desc{padding:9px 14px;font-size:.73rem;color:#555;vertical-align:middle}

  /* ASSINATURAS */
  .sign{margin:28px 32px 14px;display:flex;justify-content:space-around}
  .sign-item{text-align:center;width:220px}
  .sign-line{border-top:1px solid #9ca3af;margin-bottom:6px}
  .sign-lbl{font-size:.62rem;color:#6b7280;letter-spacing:.04em}

  /* FOOTER */
  .ft{border-top:1px solid #e5e7eb;padding:9px 32px;display:flex;justify-content:space-between;align-items:center;font-size:.61rem;color:#9ca3af}
  .ft-brand{font-weight:900;color:#f97316;font-size:.7rem;letter-spacing:.06em}

  @media print{
    body{max-width:100%}
    .hd,.meta-bar,thead,.total-row,.meal-bar,.obar{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>
  <div class="hd">
    <div class="hd-l">
      <div class="logo"><img src="${logoUrl}" alt="KRONIA"/></div>
      <div>
        <div class="hd-title">PLANO ALIMENTAR PROFISSIONAL</div>
        <div class="hd-sub">Nutrição &nbsp;·&nbsp; Saúde &nbsp;·&nbsp; Performance</div>
      </div>
    </div>
    <div class="hd-r">
      <div class="hd-nome">${nome.toUpperCase()}</div>
      <div class="hd-data">Gerado em ${data}</div>
    </div>
  </div>
  <div class="obar"></div>
  <div class="info-row">${infoChips}</div>
  ${metaHTML}
  <div class="body">
    ${refeicoesHTML}
    ${resumoHTML}
    ${oriHTML}
  </div>
  <div class="sign">
    <div class="sign-item"><div class="sign-line"></div><div class="sign-lbl">Assinatura do Nutricionista</div></div>
    <div class="sign-item"><div class="sign-line"></div><div class="sign-lbl">Assinatura do Paciente</div></div>
  </div>
  <div class="ft">
    <span>Este modelo é meramente ilustrativo. Consulte um nutricionista.</span>
    <span class="ft-brand">KRONIA</span>
  </div>
  <script>window.onload=()=>{window.print()}<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { showToast("Permita pop-ups para gerar o PDF.", "warning", 3000); return; }
  win.document.write(html);
  win.document.close();
}

function collectDietGenerationInput() {
  const sexo = document.getElementById("dietaSexoF").classList.contains("active") ? "feminino" : "masculino";
  const suplementosAtivos = Array.from(document.querySelectorAll("#dietaSuplChips .bs-chip.active")).map(function (element) {
    return element.dataset.val;
  });
  const outrosSuplementos = document.getElementById("dietaOutrosSupl")?.value.trim() || "";

  return {
    objetivo: document.querySelector("#dietaObjChips .bs-chip.active")?.dataset.val || "hipertrofia",
    sexo: sexo,
    peso: parseFloat(document.getElementById("dietaPeso").value) || 75,
    altura: parseFloat(document.getElementById("dietaAltura").value) || 175,
    idade: parseInt(document.getElementById("dietaIdade").value) || 25,
    gorduraCorporal: parseFloat(document.getElementById("dietaGordura")?.value) || null,
    biotipo: document.querySelector("#dietaBioChips .bs-chip.active")?.dataset.val || "mesomorfo",
    refeicoesPorDia: parseInt(document.getElementById("dietaRefeicoes").value) || 4,
    nivelAtividade: document.querySelector("#dietaAtivChips .bs-chip.active")?.dataset.val || "levemente ativo",
    frequenciaTreino: document.getElementById("dietaFreqTreino")?.value || "3x por semana",
    duracaoTreino: document.getElementById("dietaDuracaoTreino")?.value || "~60 minutos",
    tipoTreino: Array.from(document.querySelectorAll("#dietaTipoTreinoChips .bs-chip.active")).map(function (element) {
      return element.dataset.val;
    }).join(", ") || "musculação",
    sono: document.getElementById("dietaSono")?.value || "7-8h",
    estresse: document.getElementById("dietaEstresse")?.value || "moderado",
    patologia: Array.from(document.querySelectorAll("#dietaPatologiaChips .bs-chip.active")).map(function (element) {
      return element.dataset.val;
    }).join(", ") || "nenhuma",
    medicamentos: document.getElementById("dietaMedicamentos")?.value.trim() || "",
    padraoAlimentar: document.getElementById("dietaPadrao")?.value || "onívoro",
    restricoes: document.getElementById("dietaRestric").value.trim() || "nenhuma",
    preferencias: document.getElementById("dietaPrefs").value.trim(),
    alimentosEvitar: document.getElementById("dietaDislikes")?.value.trim() || "",
    suplementos: suplementosAtivos.concat(outrosSuplementos ? [outrosSuplementos] : []),
    orcamento: document.getElementById("dietaOrcamento").value || "",
    aderencia: {
      variedade: document.querySelector("#dietaVariedadeChips .bs-chip.active")?.dataset.val || "equilibrada",
      modoAjuste: document.querySelector("#dietaAjusteChips .bs-chip.active")?.dataset.val || "manual assistido",
      horarioTreino: document.getElementById("dietaHorarioTreino")?.value || "",
      praticidade: document.getElementById("dietaPraticidade")?.value || "equilibrada",
    },
    trainingSnapshot: window._dietaTrainingSnapshot || readDietMasterTrainingSnapshot(),
    nutritionGoals: window._dietaGoalsSupabase || null,
    supabaseSnapshot: window._dietaSupabaseSnapshot || null,
    fromChatDiet: !!window._kroniaChatDietHydratedContext,
  };
}

function computeDietGenerationBaseline(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const peso = Number(safeInput.peso || 0);
  const altura = Number(safeInput.altura || 0);
  const idade = Number(safeInput.idade || 0);
  const gordura = Number(safeInput.gorduraCorporal || 0);
  const sexo = String(safeInput.sexo || "masculino").toLowerCase();
  const objetivo = String(safeInput.objetivo || "manutencao").toLowerCase();
  const atividade = String(safeInput.nivelAtividade || "levemente ativo").toLowerCase();

  const tmbMifflin = sexo === "feminino"
    ? Math.round((10 * peso) + (6.25 * altura) - (5 * idade) - 161)
    : Math.round((10 * peso) + (6.25 * altura) - (5 * idade) + 5);

  var massaMagra = null;
  var tmbKatch = null;
  if (gordura > 2 && gordura < 60) {
    massaMagra = Math.round(peso * (1 - gordura / 100) * 10) / 10;
    tmbKatch = Math.round(370 + (21.6 * massaMagra));
  }

  const atividadeFator = {
    "sedentário": 1.2,
    "sedentario": 1.2,
    "levemente ativo": 1.375,
    "moderadamente ativo": 1.55,
    "muito ativo": 1.725,
    "atleta": 1.9,
  }[atividade] || 1.375;
  const tdee = Math.round((tmbKatch || tmbMifflin) * atividadeFator);
  const objectiveConfig = {
    emagrecimento: { calorieMultiplier: 0.85, proteinPerKg: 2.2, fatPerKg: 0.8 },
    hipertrofia: { calorieMultiplier: 1.1, proteinPerKg: 2.0, fatPerKg: 0.9 },
    manutencao: { calorieMultiplier: 1.0, proteinPerKg: 1.8, fatPerKg: 0.9 },
    forca: { calorieMultiplier: 1.05, proteinPerKg: 2.0, fatPerKg: 0.95 },
    recomposicao: { calorieMultiplier: 0.95, proteinPerKg: 2.2, fatPerKg: 0.85 },
  }[objetivo] || { calorieMultiplier: 1.0, proteinPerKg: 1.8, fatPerKg: 0.9 };
  const metaCalorias = Math.round(tdee * objectiveConfig.calorieMultiplier);
  const proteinaMeta = Math.round(peso * objectiveConfig.proteinPerKg);
  const gorduraMeta = Math.round(Math.max(peso * 0.6, Math.min(peso * 1.0, peso * objectiveConfig.fatPerKg)));
  const carboMeta = Math.max(70, Math.round((metaCalorias - (proteinaMeta * 4) - (gorduraMeta * 9)) / 4));

  return {
    tmb: tmbKatch || tmbMifflin,
    tdee: tdee,
    metaCalorias: metaCalorias,
    proteinaMeta: proteinaMeta,
    gorduraMeta: gorduraMeta,
    carboMeta: carboMeta,
    hidratacaoLitros: Number((peso * 0.035).toFixed(1)),
    massaMagra: massaMagra,
  };
}

function persistDietGenerationPrefs(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  localStorage.setItem("kronia_calc_prefs", JSON.stringify({
    ...safeJSON("kronia_calc_prefs", {}),
    dietaObj: safeInput.objetivo,
    dietaSexo: safeInput.sexo === "feminino" ? "F" : "M",
    dietaPeso: String(safeInput.peso || ""),
    dietaAltura: String(safeInput.altura || ""),
    dietaIdade: String(safeInput.idade || ""),
    dietaGordura: String(safeInput.gorduraCorporal || ""),
    dietaBio: safeInput.biotipo || "",
    dietaRefeicoes: String(safeInput.refeicoesPorDia || ""),
    dietaAtiv: safeInput.nivelAtividade || "",
    dietaRestric: safeInput.restricoes || "",
    dietaPrefs: safeInput.preferencias || "",
    dietaDislikes: safeInput.alimentosEvitar || "",
    dietaMedicamentos: safeInput.medicamentos || "",
    dietaOutrosSupl: Array.isArray(safeInput.suplementos) ? safeInput.suplementos.join(", ") : "",
    dietaOrcamento: safeInput.orcamento || "",
    dietaPadrao: safeInput.padraoAlimentar || "",
    dietaHorarioTreino: safeInput.aderencia && safeInput.aderencia.horarioTreino || "",
    dietaPraticidade: safeInput.aderencia && safeInput.aderencia.praticidade || "",
    dietaVariedade: safeInput.aderencia && safeInput.aderencia.variedade || "",
    dietaModoAjuste: safeInput.aderencia && safeInput.aderencia.modoAjuste || "",
  }));
}

function buildDietRequestPayloadFromInput(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const baseline = computeDietGenerationBaseline(safeInput);
  const activeNutritionSnapshot = typeof window !== "undefined" ? (window._kroniaNutritionSnapshot || null) : null;
  const observacoes = [
    safeInput.orcamento ? ("orcamento: " + safeInput.orcamento) : "",
    safeInput.aderencia ? ("aderência: variedade " + safeInput.aderencia.variedade + " | ajuste " + safeInput.aderencia.modoAjuste + " | praticidade " + safeInput.aderencia.praticidade + " | treino " + (safeInput.aderencia.horarioTreino || "sem horário fixo")) : "",
    safeInput.medicamentos ? ("medicamentos: " + safeInput.medicamentos) : "",
    safeInput.patologia && safeInput.patologia !== "nenhuma" ? ("patologia: " + safeInput.patologia) : "",
    "sono: " + (safeInput.sono || "7-8h"),
    "estresse: " + (safeInput.estresse || "moderado"),
    "treino: " + [safeInput.frequenciaTreino, safeInput.duracaoTreino, safeInput.tipoTreino].filter(Boolean).join(" | "),
    safeInput.trainingSnapshot ? ("histórico_treino: " + (safeInput.trainingSnapshot.sessions7d || 0) + " sessões_7d | volume_7d " + (safeInput.trainingSnapshot.volume7d || 0) + "kg | dias_planejados " + (safeInput.trainingSnapshot.plannedDays || 0)) : "",
    "tdee_estimado: " + baseline.tdee,
    "meta_calorica_estimada: " + baseline.metaCalorias,
  ].filter(Boolean).join(" ; ");

  return {
    objetivo: safeInput.objetivo,
    sexo: safeInput.sexo,
    peso: safeInput.peso,
    altura: safeInput.altura,
    idade: safeInput.idade,
    gorduraCorporal: safeInput.gorduraCorporal,
    biotipo: safeInput.biotipo,
    rotina: safeInput.nivelAtividade,
    nivelAtividade: safeInput.nivelAtividade,
    refeicoesPorDia: safeInput.refeicoesPorDia,
    padraoAlimentar: safeInput.padraoAlimentar,
    restricoes: safeInput.restricoes,
    preferencias: safeInput.preferencias,
    alimentosEvitar: safeInput.alimentosEvitar,
    suplementos: safeInput.suplementos,
    observacoes: observacoes,
    contextoTreino: {
      frequencia: safeInput.frequenciaTreino,
      duracao: safeInput.duracaoTreino,
      tipo: safeInput.tipoTreino,
    },
    saude: {
      patologia: safeInput.patologia,
      medicamentos: safeInput.medicamentos,
      sono: safeInput.sono,
      estresse: safeInput.estresse,
      clinicalData: safeInput.clinicalData || null,
    },
    clinicalData: safeInput.clinicalData || null,
    aderencia: safeInput.aderencia || null,
    trainingSnapshot: safeInput.trainingSnapshot || null,
    nutritionGoals: safeInput.nutritionGoals || null,
    supabaseSnapshot: safeInput.supabaseSnapshot || null,
    nutritionSnapshot: activeNutritionSnapshot,
    nutritionFlowSelections: safeInput.nutritionFlowSelections || null,
    profile: {
      objetivo: safeInput.objetivo,
      sexo: safeInput.sexo,
      idade: safeInput.idade,
      pesoKg: safeInput.peso,
      alturaCm: safeInput.altura,
      bodyFatPercent: safeInput.gorduraCorporal,
      biotipo: safeInput.biotipo,
      activityLevel: safeInput.nivelAtividade,
      refeicoesPorDia: safeInput.refeicoesPorDia,
      dietaryPattern: safeInput.padraoAlimentar,
      restricoes: safeInput.restricoes,
      preferencias: safeInput.preferencias,
      alimentosEvitar: safeInput.alimentosEvitar,
      suplementos: safeInput.suplementos,
      nutritionGoals: safeInput.nutritionGoals || null,
      supabaseSnapshot: safeInput.supabaseSnapshot || null,
    },
    context: {
      source: "diet_sheet",
      fromChatDiet: !!safeInput.fromChatDiet,
      trainingContext: {
        frequencia: safeInput.frequenciaTreino,
        duracao: safeInput.duracaoTreino,
        tipo: safeInput.tipoTreino,
      },
      healthContext: {
        patologia: safeInput.patologia,
        medicamentos: safeInput.medicamentos,
        sono: safeInput.sono,
        estresse: safeInput.estresse,
        clinicalData: safeInput.clinicalData || null,
      },
      clinicalData: safeInput.clinicalData || null,
      adherenceContext: safeInput.aderencia || null,
      trainingSnapshot: safeInput.trainingSnapshot || null,
      nutritionSnapshot: activeNutritionSnapshot,
      nutritionFlowSelections: safeInput.nutritionFlowSelections || null,
    },
  };
}

function normalizeDietFoodText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dietTextIncludesAny(value, candidates) {
  const source = normalizeDietFoodText(value);
  return (Array.isArray(candidates) ? candidates : []).some(function (candidate) {
    const normalized = normalizeDietFoodText(candidate);
    return normalized && source.indexOf(normalized) >= 0;
  });
}

function splitDietList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(function (item) { return String(item || "").trim(); }).filter(Boolean);
  return String(value).split(",").map(function (item) { return item.trim(); }).filter(Boolean);
}

function mergeUniqueDietList() {
  const items = [];
  for (let index = 0; index < arguments.length; index += 1) {
    items.push.apply(items, splitDietList(arguments[index]));
  }
  const seen = Object.create(null);
  return items.filter(function (item) {
    const key = normalizeDietFoodText(item);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function parseDietAgeFromBirthDate(birthDate) {
  if (!birthDate) return undefined;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return undefined;
  const years = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 10 && years <= 120 ? years : undefined;
}

function buildMergedDietInput(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const snapshot = safeInput.supabaseSnapshot && typeof safeInput.supabaseSnapshot === "object"
    ? safeInput.supabaseSnapshot
    : {};
  const profile = snapshot.profile && typeof snapshot.profile === "object" ? snapshot.profile : {};
  const bodyMetrics = snapshot.bodyMetrics && typeof snapshot.bodyMetrics === "object" ? snapshot.bodyMetrics : {};
  const nutritionGoals = snapshot.nutritionGoals && typeof snapshot.nutritionGoals === "object"
    ? snapshot.nutritionGoals
    : (safeInput.nutritionGoals && typeof safeInput.nutritionGoals === "object" ? safeInput.nutritionGoals : null);
  const supplementProtocols = Array.isArray(snapshot.supplementProtocols) ? snapshot.supplementProtocols : [];

  const merged = Object.assign({}, safeInput);
  merged.objetivo = safeInput.objetivo || profile.objective || "hipertrofia";
  merged.sexo = safeInput.sexo || profile.sex || "masculino";
  merged.peso = Number(safeInput.peso || bodyMetrics.weight_kg || profile.current_weight_kg || 75);
  merged.altura = Number(safeInput.altura || profile.height_cm || 175);
  merged.idade = Number(safeInput.idade || parseDietAgeFromBirthDate(profile.birth_date) || 25);
  merged.gorduraCorporal = safeInput.gorduraCorporal != null ? safeInput.gorduraCorporal : (bodyMetrics.body_fat_percent || null);
  merged.nivelAtividade = safeInput.nivelAtividade || profile.activity_level || "levemente ativo";
  merged.padraoAlimentar = safeInput.padraoAlimentar || profile.dietary_pattern || "onívoro";
  merged.restricoes = mergeUniqueDietList(safeInput.restricoes, profile.allergies, profile.intolerances).join(", ");
  merged.preferencias = mergeUniqueDietList(safeInput.preferencias, profile.liked_foods).join(", ");
  merged.alimentosEvitar = mergeUniqueDietList(safeInput.alimentosEvitar, profile.disliked_foods).join(", ");
  merged.suplementos = mergeUniqueDietList(safeInput.suplementos, supplementProtocols);
  merged.nutritionGoals = nutritionGoals || null;
  if (!merged.medicamentos && profile.clinical_notes) merged.medicamentos = String(profile.clinical_notes);
  return merged;
}

function buildLocalDietFoodCatalog(input) {
  const safeInput = buildMergedDietInput(input);
  const preferencias = splitDietList(safeInput.preferencias);
  const evitar = splitDietList(safeInput.alimentosEvitar);
  const restricoes = splitDietList(safeInput.restricoes);
  const padrao = normalizeDietFoodText(safeInput.padraoAlimentar);
  const suplementos = Array.isArray(safeInput.suplementos) ? safeInput.suplementos : [];
  const isVegan = /vegano|vegan/.test(padrao);
  const isVegetarian = /vegetarian|vegetariano/.test(padrao);

  function allowed(item) {
    if (dietTextIncludesAny(item.nome, evitar)) return false;
    if (/vegano/.test(padrao) && /(frango|patinho|ovo|iogurte|atum|sardinha)/i.test(item.nome)) return false;
    if (/vegetariano/.test(padrao) && /(frango|patinho|atum|sardinha)/i.test(item.nome)) return false;
    if (dietTextIncludesAny("lactose", restricoes) && /(iogurte)/i.test(item.nome)) return false;
    return true;
  }

  function sortByPreference(items) {
    return items.slice().sort(function (a, b) {
      const aScore = dietTextIncludesAny(a.nome, preferencias) ? 1 : 0;
      const bScore = dietTextIncludesAny(b.nome, preferencias) ? 1 : 0;
      const aPlant = /tofu/i.test(a.nome) ? 1 : 0;
      const bPlant = /tofu/i.test(b.nome) ? 1 : 0;
      if (!isVegan && !isVegetarian && aPlant !== bPlant) return aPlant - bPlant;
      return (bScore - aScore) || (aPlant - bPlant);
    });
  }

  function preferAnimalProteins(items) {
    if (isVegan || isVegetarian || dietTextIncludesAny("tofu", preferencias)) return items;
    const animalOnly = items.filter(function(item) { return !/tofu/i.test(String(item.nome || "")); });
    return animalOnly.length ? animalOnly : items;
  }

  const breakfastProteins = preferAnimalProteins(sortByPreference([
    { nome: "Ovos mexidos", porcao: "3 un", kcal: 210, prot: 18, carb: 1, gord: 15 },
    { nome: "Whey protein", porcao: "30 g", kcal: 120, prot: 24, carb: 3, gord: 2 },
    { nome: "Tofu mexido", porcao: "180 g", kcal: 173, prot: 18, carb: 5, gord: 10 },
    { nome: "Iogurte grego natural", porcao: "170 g", kcal: 130, prot: 17, carb: 6, gord: 4 },
  ].filter(allowed)));

  const fastProteins = preferAnimalProteins(sortByPreference([
    { nome: "Whey protein", porcao: "30 g", kcal: 120, prot: 24, carb: 3, gord: 2 },
    { nome: "Iogurte natural", porcao: "170 g", kcal: 104, prot: 6, carb: 8, gord: 5 },
    { nome: "Tofu firme", porcao: "150 g", kcal: 144, prot: 15, carb: 4, gord: 8 },
  ].filter(allowed)));

  const mealProteins = preferAnimalProteins(sortByPreference([
    { nome: "Frango grelhado", porcao: "120 g", kcal: 198, prot: 37, carb: 0, gord: 4 },
    { nome: "Patinho grelhado", porcao: "120 g", kcal: 225, prot: 34, carb: 0, gord: 10 },
    { nome: "Tilápia grelhada", porcao: "140 g", kcal: 180, prot: 33, carb: 0, gord: 4 },
    { nome: "Tofu firme", porcao: "200 g", kcal: 192, prot: 20, carb: 5, gord: 11 },
    { nome: "Atum em lata", porcao: "1 lata", kcal: 170, prot: 30, carb: 0, gord: 5 },
  ].filter(allowed)));

  const breakfastCarbs = [
    { nome: "Aveia", porcao: "40 g", kcal: 156, prot: 6.8, carb: 26.5, gord: 3.4 },
    { nome: "Pão integral", porcao: "2 fatias", kcal: 128, prot: 6, carb: 24, gord: 2 },
    { nome: "Banana", porcao: "1 un", kcal: 80, prot: 1, carb: 20.7, gord: 0.2 },
  ].filter(allowed);

  const fastCarbs = [
    { nome: "Banana", porcao: "1 un", kcal: 80, prot: 1, carb: 20.7, gord: 0.2 },
    { nome: "Frutas vermelhas", porcao: "140 g", kcal: 70, prot: 1, carb: 16, gord: 0.5 },
    { nome: "Granola", porcao: "30 g", kcal: 128, prot: 3, carb: 20, gord: 4 },
  ].filter(allowed);

  const mealCarbs = [
    { nome: "Arroz cozido", porcao: "120 g", kcal: 156, prot: 3, carb: 34, gord: 0.4 },
    { nome: "Batata-doce cozida", porcao: "130 g", kcal: 112, prot: 2, carb: 26, gord: 0.1 },
    { nome: "Macarrão cozido", porcao: "120 g", kcal: 188, prot: 6, carb: 37, gord: 1.2 },
    { nome: "Feijão cozido", porcao: "100 g", kcal: 76, prot: 4.8, carb: 13.6, gord: 0.5 },
  ].filter(allowed);

  const supportCarbs = [
    { nome: "Banana", porcao: "1 un", kcal: 80, prot: 1, carb: 20.7, gord: 0.2 },
    { nome: "Maçã", porcao: "1 un", kcal: 72, prot: 0.3, carb: 19, gord: 0.2 },
    { nome: "Mel", porcao: "20 g", kcal: 61, prot: 0, carb: 17, gord: 0 },
  ].filter(allowed);

  const breakfastFats = [
    { nome: "Pasta de amendoim", porcao: "20 g", kcal: 118, prot: 5, carb: 4, gord: 10 },
    { nome: "Castanhas", porcao: "20 g", kcal: 120, prot: 3, carb: 4, gord: 10 },
  ].filter(allowed);

  const fats = [
    { nome: "Azeite de oliva", porcao: "10 g", kcal: 88, prot: 0, carb: 0, gord: 10 },
    { nome: "Abacate", porcao: "100 g", kcal: 96, prot: 1.2, carb: 6, gord: 8.4 },
    { nome: "Castanhas", porcao: "20 g", kcal: 120, prot: 3, carb: 4, gord: 10 },
  ].filter(allowed);

  const veggies = [
    { nome: "Brócolis cozido", porcao: "100 g", kcal: 25, prot: 3, carb: 4.4, gord: 0.5 },
    { nome: "Cenoura cozida", porcao: "100 g", kcal: 30, prot: 1, carb: 7, gord: 0.2 },
    { nome: "Salada verde", porcao: "1 prato", kcal: 20, prot: 1, carb: 3, gord: 0.2 },
  ].filter(allowed);

  const extras = [];
  if (suplementos.some(function (item) { return /whey/i.test(String(item || "")); })) {
    extras.push({ nome: "Whey protein", porcao: "30 g", kcal: 120, prot: 24, carb: 3, gord: 2 });
  }

  function fromCatalogNames(group, names) {
    var list = Array.isArray(names) ? names : [];
    return list.map(function(name) {
      var item = NUTRITION_FOOD_CATALOG.find(function(catalogItem) {
        return catalogItem.grupo === group && normalizeDietFoodText(catalogItem.nome) === normalizeDietFoodText(name);
      });
      return item ? {
        nome: item.nome,
        porcao: item.porcao,
        kcal: Number(item.kcal || 0),
        prot: Number(item.proteina || 0),
        carb: Number(item.carboidrato || 0),
        gord: Number(item.gordura || 0),
      } : null;
    }).filter(function(item) { return item && allowed(item); });
  }

  function uniqueFoods() {
    var out = [];
    var seen = Object.create(null);
    for (var index = 0; index < arguments.length; index += 1) {
      (Array.isArray(arguments[index]) ? arguments[index] : []).forEach(function(item) {
        var key = normalizeDietFoodText(item && item.nome);
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(item);
      });
    }
    return out;
  }

  var selections = safeInput.nutritionFlowSelections && typeof safeInput.nutritionFlowSelections === "object" ? safeInput.nutritionFlowSelections : {};
  var selectedProteins = fromCatalogNames("proteinas", selections.proteinas);
  var selectedCarbs = fromCatalogNames("carboidratos", selections.carboidratos);
  var selectedFats = fromCatalogNames("gorduras", selections.gorduras);
  var selectedFruits = fromCatalogNames("frutas", selections.frutas);
  var selectedVeggies = fromCatalogNames("vegetais", selections.vegetais);
  var selectedDairy = fromCatalogNames("laticinios", selections.laticinios);

  return {
    breakfastProteins: uniqueFoods(selectedDairy, selectedProteins, breakfastProteins).length ? uniqueFoods(selectedDairy, selectedProteins, breakfastProteins) : [{ nome: "Tofu mexido", porcao: "180 g", kcal: 173, prot: 18, carb: 5, gord: 10 }],
    fastProteins: uniqueFoods(selectedProteins, selectedDairy, fastProteins).length ? uniqueFoods(selectedProteins, selectedDairy, fastProteins) : [{ nome: "Tofu firme", porcao: "150 g", kcal: 144, prot: 15, carb: 4, gord: 8 }],
    mealProteins: uniqueFoods(selectedProteins, mealProteins).length ? uniqueFoods(selectedProteins, mealProteins) : [{ nome: "Tofu firme", porcao: "200 g", kcal: 192, prot: 20, carb: 5, gord: 11 }],
    breakfastCarbs: uniqueFoods(selectedCarbs, selectedFruits, breakfastCarbs).length ? uniqueFoods(selectedCarbs, selectedFruits, breakfastCarbs) : [{ nome: "Aveia", porcao: "40 g", kcal: 156, prot: 6.8, carb: 26.5, gord: 3.4 }],
    fastCarbs: uniqueFoods(selectedFruits, selectedCarbs, fastCarbs).length ? uniqueFoods(selectedFruits, selectedCarbs, fastCarbs) : [{ nome: "Banana", porcao: "1 un", kcal: 80, prot: 1, carb: 20.7, gord: 0.2 }],
    mealCarbs: uniqueFoods(selectedCarbs, mealCarbs).length ? uniqueFoods(selectedCarbs, mealCarbs) : [{ nome: "Arroz cozido", porcao: "120 g", kcal: 156, prot: 3, carb: 34, gord: 0.4 }],
    supportCarbs: uniqueFoods(selectedFruits, supportCarbs).length ? uniqueFoods(selectedFruits, supportCarbs) : [{ nome: "Banana", porcao: "1 un", kcal: 80, prot: 1, carb: 20.7, gord: 0.2 }],
    breakfastFats: uniqueFoods(selectedFats, breakfastFats).length ? uniqueFoods(selectedFats, breakfastFats) : [{ nome: "Pasta de amendoim", porcao: "20 g", kcal: 118, prot: 5, carb: 4, gord: 10 }],
    fats: uniqueFoods(selectedFats, fats).length ? uniqueFoods(selectedFats, fats) : [{ nome: "Abacate", porcao: "100 g", kcal: 96, prot: 1.2, carb: 6, gord: 8.4 }],
    veggies: uniqueFoods(selectedVeggies, veggies).length ? uniqueFoods(selectedVeggies, veggies) : [{ nome: "Salada verde", porcao: "1 prato", kcal: 20, prot: 1, carb: 3, gord: 0.2 }],
    extras: extras,
    helpers: {
      isVegan: isVegan,
      isVegetarian: isVegetarian,
    },
  };
}

function buildLocalDietPlan(input) {
  const safeInput = buildMergedDietInput(input);
  let baseline = computeDietGenerationBaseline(safeInput);
  const activeGoalCalories = Number(safeInput.nutritionGoals && safeInput.nutritionGoals.calories_target);
  const activeGoalProtein = Number(safeInput.nutritionGoals && safeInput.nutritionGoals.protein_g);
  const activeGoalCarbs = Number(safeInput.nutritionGoals && safeInput.nutritionGoals.carbs_g);
  const activeGoalFat = Number(safeInput.nutritionGoals && safeInput.nutritionGoals.fat_g);
  if (activeGoalCalories > 0 || activeGoalProtein > 0 || activeGoalCarbs > 0 || activeGoalFat > 0) {
    baseline = Object.assign({}, baseline, {
      metaCalorias: activeGoalCalories > 0 ? Math.round(activeGoalCalories) : baseline.metaCalorias,
      proteinaMeta: activeGoalProtein > 0 ? Math.round(activeGoalProtein) : baseline.proteinaMeta,
      carboMeta: activeGoalCarbs > 0 ? Math.round(activeGoalCarbs) : baseline.carboMeta,
      gorduraMeta: activeGoalFat > 0 ? Math.round(activeGoalFat) : baseline.gorduraMeta,
    });
  }
  const refeicoesPorDia = Math.min(6, Math.max(3, Number(safeInput.refeicoesPorDia || 4)));
  const templateMap = {
    3: [
      { tipo: "cafe_da_manha", nome: "Café da manhã", horario: "07:00", proteinShare: 0.28, carbShare: 0.24, fatShare: 0.28 },
      { tipo: "almoco", nome: "Almoço", horario: "12:30", proteinShare: 0.37, carbShare: 0.36, fatShare: 0.36 },
      { tipo: "jantar", nome: "Jantar", horario: "20:00", proteinShare: 0.35, carbShare: 0.4, fatShare: 0.36 },
    ],
    4: [
      { tipo: "cafe_da_manha", nome: "Café da manhã", horario: "07:00", proteinShare: 0.25, carbShare: 0.22, fatShare: 0.28 },
      { tipo: "almoco", nome: "Almoço", horario: "12:30", proteinShare: 0.3, carbShare: 0.28, fatShare: 0.27 },
      { tipo: "lanche_pre_treino", nome: "Pré-treino", horario: "16:30", proteinShare: 0.2, carbShare: 0.25, fatShare: 0.1 },
      { tipo: "jantar_pos_treino", nome: "Pós-treino / Jantar", horario: "20:30", proteinShare: 0.25, carbShare: 0.25, fatShare: 0.35 },
    ],
    5: [
      { tipo: "cafe_da_manha", nome: "Café da manhã", horario: "07:00", proteinShare: 0.22, carbShare: 0.17, fatShare: 0.24 },
      { tipo: "lanche_manha", nome: "Lanche da manhã", horario: "10:00", proteinShare: 0.13, carbShare: 0.12, fatShare: 0.15 },
      { tipo: "almoco", nome: "Almoço", horario: "12:30", proteinShare: 0.25, carbShare: 0.22, fatShare: 0.22 },
      { tipo: "lanche_pre_treino", nome: "Pré-treino", horario: "16:30", proteinShare: 0.16, carbShare: 0.24, fatShare: 0.08 },
      { tipo: "jantar_pos_treino", nome: "Pós-treino / Jantar", horario: "20:30", proteinShare: 0.24, carbShare: 0.25, fatShare: 0.31 },
    ],
    6: [
      { tipo: "cafe_da_manha", nome: "Café da manhã", horario: "07:00", proteinShare: 0.2, carbShare: 0.15, fatShare: 0.22 },
      { tipo: "lanche_manha", nome: "Lanche da manhã", horario: "09:45", proteinShare: 0.13, carbShare: 0.11, fatShare: 0.13 },
      { tipo: "almoco", nome: "Almoço", horario: "12:30", proteinShare: 0.22, carbShare: 0.18, fatShare: 0.22 },
      { tipo: "lanche_pre_treino", nome: "Pré-treino", horario: "15:45", proteinShare: 0.14, carbShare: 0.2, fatShare: 0.08 },
      { tipo: "jantar_pos_treino", nome: "Pós-treino / Jantar", horario: "19:30", proteinShare: 0.2, carbShare: 0.24, fatShare: 0.18 },
      { tipo: "ceia", nome: "Ceia", horario: "22:00", proteinShare: 0.11, carbShare: 0.12, fatShare: 0.17 },
    ],
  };
  const templates = templateMap[refeicoesPorDia] || templateMap[5];
  const catalog = buildLocalDietFoodCatalog(safeInput);
  const substitutionAvoid = splitDietList(safeInput.alimentosEvitar);
  const substitutionRestrictions = splitDietList(safeInput.restricoes);
  const substitutionPattern = normalizeDietFoodText(safeInput.padraoAlimentar);

  function substitutionAllowed(item) {
    if (!item || dietTextIncludesAny(item.nome, substitutionAvoid)) return false;
    if (/vegano/.test(substitutionPattern) && /(frango|patinho|ovo|iogurte|atum|sardinha|queijo|leite|whey)/i.test(item.nome)) return false;
    if (/vegetariano/.test(substitutionPattern) && /(frango|patinho|atum|sardinha)/i.test(item.nome)) return false;
    if (dietTextIncludesAny("lactose", substitutionRestrictions) && /(iogurte|queijo|leite|whey)/i.test(item.nome)) return false;
    return true;
  }

  function cloneFood(item, factor) {
    const ratio = Number(factor || 1);
    const isUnits = /\bun\b|\bfatias\b|\blata\b|\bprato\b/i.test(String(item.porcao || ""));
    let qtde = item.porcao;
    if (ratio !== 1) {
      if (isUnits) {
        const baseUnits = parseFloat(String(item.porcao).replace(",", ".")) || 1;
        const unitLabel = String(item.porcao).replace(/^[\d.,]+\s*/, "");
        qtde = (Math.max(1, Math.round(baseUnits * ratio * 10) / 10)) + " " + unitLabel.trim();
      } else {
        qtde = Math.max(5, Math.round((parseFloat(String(item.porcao).replace(",", ".")) || 0) * ratio)) + " g";
      }
    }
    return {
      nome: item.nome,
      qtde: qtde,
      kcal: Math.round(item.kcal * ratio),
      prot: Math.round(item.prot * ratio * 10) / 10,
      carb: Math.round(item.carb * ratio * 10) / 10,
      gord: Math.round(item.gord * ratio * 10) / 10,
    };
  }

  function sumMeal(items) {
    return items.reduce(function(acc, item) {
      acc.kcal += Number(item.kcal || 0);
      acc.prot += Number(item.prot || 0);
      acc.carb += Number(item.carb || 0);
      acc.gord += Number(item.gord || 0);
      return acc;
    }, { kcal: 0, prot: 0, carb: 0, gord: 0 });
  }

  function scaleFood(item, factor) {
    const ratio = Math.max(0.45, Math.min(1.65, Number(factor || 1)));
    return cloneFood({
      nome: item.nome,
      porcao: item.qtde || item.porcao,
      kcal: Number(item.kcal || 0),
      prot: Number(item.prot || 0),
      carb: Number(item.carb || 0),
      gord: Number(item.gord || 0),
    }, ratio);
  }

  function pickDistinctFood(items, excludedNames) {
    const excluded = (excludedNames || []).map(normalizeDietFoodText).filter(Boolean);
    return (items || []).find(function(item) {
      return excluded.indexOf(normalizeDietFoodText(item && item.nome)) === -1;
    }) || null;
  }

  function pickAdjustableIndex(items, macroKey, options) {
    const settings = options || {};
    let index = -1;
    let best = -1;
    items.forEach(function(item, itemIndex) {
      const name = normalizeDietFoodText(item && item.nome);
      if (!name) return;
      if (settings.excludeVeggies && /brocolis|salada|legumes|cenoura/.test(name)) return;
      const score = Number(item[macroKey] || 0);
      if (score > best) {
        best = score;
        index = itemIndex;
      }
    });
    return index;
  }

  function rebalanceLocalMeal(alimentos, target, options) {
    const settings = options || {};
    const balanced = alimentos.slice();
    for (let pass = 0; pass < 4; pass += 1) {
      const subtotal = sumMeal(balanced);
      const proteinGap = Math.round(((Number(target.protein || 0) - subtotal.prot) || 0) * 10) / 10;
      const carbGap = Math.round(((Number(target.carbs || 0) - subtotal.carb) || 0) * 10) / 10;
      const fatGap = Math.round(((Number(target.fat || 0) - subtotal.gord) || 0) * 10) / 10;

      if (Math.abs(proteinGap) > 2) {
        const proteinIndex = pickAdjustableIndex(balanced, "prot", { excludeVeggies: true });
        if (proteinIndex >= 0) {
          const item = balanced[proteinIndex];
          balanced[proteinIndex] = scaleFood(item, (Number(item.prot || 0) + proteinGap) / Math.max(Number(item.prot || 1), 1));
        }
      }
      if (Math.abs(carbGap) > 4) {
        const carbIndex = pickAdjustableIndex(balanced, "carb", { excludeVeggies: true });
        if (carbIndex >= 0) {
          const item = balanced[carbIndex];
          balanced[carbIndex] = scaleFood(item, (Number(item.carb || 0) + carbGap) / Math.max(Number(item.carb || 1), 1));
        }
      }
      if (!settings.isWorkoutMeal && Math.abs(fatGap) > 1.5) {
        const fatIndex = pickAdjustableIndex(balanced, "gord", { excludeVeggies: true });
        if (fatIndex >= 0) {
          const item = balanced[fatIndex];
          balanced[fatIndex] = scaleFood(item, (Number(item.gord || 0) + fatGap) / Math.max(Number(item.gord || 1), 1));
        }
      }
    }
    return balanced;
  }

  function buildFoodSubstitutions(food) {
    var group = Number(food && food.prot || 0) >= 8
      ? "proteinas"
      : (Number(food && food.carb || 0) >= 8 ? "carboidratos" : (Number(food && food.gord || 0) >= 7 ? "gorduras" : "vegetais"));
    var current = normalizeDietFoodText(food && food.nome);
    var kcal = Number(food && food.kcal || 0);
    return getNutritionCatalogItems(group)
      .filter(function(item) { return normalizeDietFoodText(item.nome) !== current && substitutionAllowed(item); })
      .sort(function(a, b) { return Math.abs(Number(a.kcal || 0) - kcal) - Math.abs(Number(b.kcal || 0) - kcal); })
      .slice(0, 3)
      .map(function(item) { return item.nome + " (" + item.porcao + ")"; });
  }

  const refeicoes = templates.map(function (template, index) {
    const mealProteinTarget = Math.round(baseline.proteinaMeta * template.proteinShare * 10) / 10;
    const mealCarbTarget = Math.round(baseline.carboMeta * template.carbShare * 10) / 10;
    const mealFatTarget = Math.round(baseline.gorduraMeta * template.fatShare * 10) / 10;

    const protein = /cafe/.test(template.tipo)
      ? catalog.breakfastProteins[index % catalog.breakfastProteins.length]
      : (/lanche/.test(template.tipo) ? catalog.fastProteins[index % catalog.fastProteins.length] : catalog.mealProteins[index % catalog.mealProteins.length]);
    const carb = /cafe/.test(template.tipo)
      ? catalog.breakfastCarbs[index % catalog.breakfastCarbs.length]
      : (/lanche/.test(template.tipo) ? catalog.fastCarbs[index % catalog.fastCarbs.length] : catalog.mealCarbs[index % catalog.mealCarbs.length]);
    const isWorkoutMeal = /pre_treino|pos_treino/.test(template.tipo);
    const isBreakfast = /cafe/.test(template.tipo);
    const isMainMeal = /almoco|jantar/.test(template.tipo);
    const supportCarb = catalog.supportCarbs[index % catalog.supportCarbs.length];
    const fat = isBreakfast
      ? catalog.breakfastFats[index % catalog.breakfastFats.length]
      : catalog.fats[index % catalog.fats.length];
    const veggie = catalog.veggies[index % catalog.veggies.length];
    const extra = catalog.extras[index % Math.max(catalog.extras.length, 1)] || null;
    const rice = catalog.mealCarbs.find(function(item) { return /arroz/i.test(item.nome); }) || catalog.mealCarbs[0];
    const beans = catalog.mealCarbs.find(function(item) { return /feij[aã]o/i.test(item.nome); }) || catalog.mealCarbs[0];
    const breakfastFruit = catalog.breakfastCarbs.find(function(item) { return /banana/i.test(item.nome); }) || catalog.breakfastCarbs[0];

    const alimentos = [];
    alimentos.push(cloneFood(protein, Math.max(0.9, Math.min(1.4, mealProteinTarget / Math.max(protein.prot, 1)))));
    if (isBreakfast) {
      alimentos.push(cloneFood(carb, Math.max(0.8, Math.min(1.3, (mealCarbTarget * 0.65) / Math.max(carb.carb, 1)))));
      if (breakfastFruit && breakfastFruit.nome !== carb.nome) {
        alimentos.push(cloneFood(breakfastFruit, Math.max(0.6, Math.min(1.1, (mealCarbTarget * 0.2) / Math.max(breakfastFruit.carb, 1)))));
      }
    } else if (isMainMeal) {
      alimentos.push(cloneFood(rice, Math.max(0.8, Math.min(1.5, (mealCarbTarget * 0.55) / Math.max(rice.carb, 1)))));
      alimentos.push(cloneFood(beans, Math.max(0.7, Math.min(1.4, (mealCarbTarget * 0.25) / Math.max(beans.carb, 1)))));
      if (mealCarbTarget > 28) alimentos.push(cloneFood(supportCarb, Math.max(0.45, Math.min(0.9, (mealCarbTarget * 0.12) / Math.max(supportCarb.carb, 1)))));
    } else {
      alimentos.push(cloneFood(carb, Math.max(0.8, Math.min(1.4, (mealCarbTarget * 0.68) / Math.max(carb.carb, 1)))));
      if (mealCarbTarget > 28) alimentos.push(cloneFood(supportCarb, Math.max(0.6, Math.min(1.0, (mealCarbTarget * 0.22) / Math.max(supportCarb.carb, 1)))));
    }
    if (isMainMeal) alimentos.push(cloneFood(veggie, 1));

    const subtotalBeforeFat = sumMeal(alimentos);
    const remainingProtein = Math.max(0, mealProteinTarget - subtotalBeforeFat.prot);
    const remainingFat = Math.max(0, mealFatTarget - subtotalBeforeFat.gord);

    if (extra && remainingProtein > 8) {
      alimentos.push(cloneFood(extra, Math.max(0.5, Math.min(1.2, remainingProtein / Math.max(extra.prot, 1)))));
    }
    if (!isMainMeal) {
      const subtotalAfterProtein = sumMeal(alimentos);
      const carbGap = Math.max(0, mealCarbTarget - subtotalAfterProtein.carb);
      if (carbGap > 8) {
        const candidate = isBreakfast
          ? (pickDistinctFood(catalog.breakfastCarbs, alimentos.map(function(item) { return item.nome; })) || pickDistinctFood(catalog.supportCarbs, alimentos.map(function(item) { return item.nome; })))
          : (pickDistinctFood(catalog.supportCarbs, alimentos.map(function(item) { return item.nome; })) || pickDistinctFood(catalog.fastCarbs, alimentos.map(function(item) { return item.nome; })));
        if (candidate) {
          alimentos.push(cloneFood(candidate, Math.max(0.5, Math.min(1.2, carbGap / Math.max(candidate.carb, 1)))));
        }
      }
    }
    if (remainingFat > 3 && !isWorkoutMeal) {
      alimentos.push(cloneFood(fat, Math.max(0.3, Math.min(isBreakfast ? 0.8 : 1.0, remainingFat / Math.max(fat.gord, 1)))));
    }

    const alimentosBalanceados = rebalanceLocalMeal(alimentos, {
      protein: mealProteinTarget,
      carbs: mealCarbTarget,
      fat: mealFatTarget,
    }, { isWorkoutMeal: isWorkoutMeal });
    const subtotalRaw = sumMeal(alimentosBalanceados);
    const subtotal = {
      kcal: Math.round(subtotalRaw.kcal),
      prot: Math.round(subtotalRaw.prot * 10) / 10,
      carb: Math.round(subtotalRaw.carb * 10) / 10,
      gord: Math.round(subtotalRaw.gord * 10) / 10,
    };
    return {
      tipo: template.tipo,
      nome: template.nome,
      horario: template.horario,
      foco: "META: " + Math.round((mealProteinTarget * 4) + (mealCarbTarget * 4) + (mealFatTarget * 9)) + " kcal",
      proteinas: alimentosBalanceados.filter(function(item) { return Number(item.prot || 0) >= 8; }).map(function(item) { return item.nome + " (" + item.qtde + ")"; }),
      carbos: alimentosBalanceados.filter(function(item) { return Number(item.carb || 0) >= 8; }).map(function(item) { return item.nome + " (" + item.qtde + ")"; }),
      extras: alimentosBalanceados.filter(function(item) { return Number(item.gord || 0) >= 7 || (Number(item.prot || 0) < 8 && Number(item.carb || 0) < 8); }).map(function(item) { return item.nome + " (" + item.qtde + ")"; }),
      alimentos: alimentosBalanceados,
      subtotal: subtotal,
      substituicoes: alimentosBalanceados.map(function(item) {
        return { item: item.nome, opcoes: buildFoodSubstitutions(item) };
      }).filter(function(entry) { return entry.opcoes.length; }),
    };
  });

  const resumo = refeicoes.reduce(function(acc, meal) {
    acc.calorias += Number(meal.subtotal.kcal || 0);
    acc.proteina += Number(meal.subtotal.prot || 0);
    acc.carbo += Number(meal.subtotal.carb || 0);
    acc.gordura += Number(meal.subtotal.gord || 0);
    return acc;
  }, { calorias: 0, proteina: 0, carbo: 0, gordura: 0 });

  return {
    failSafe: false,
    caloriasMeta: baseline.metaCalorias,
    macrosMeta: { protein: baseline.proteinaMeta, carbs: baseline.carboMeta, fat: baseline.gorduraMeta },
    meta: {
      calorias: Math.round(resumo.calorias),
      proteina: Math.round(resumo.proteina * 10) / 10,
      carbo: Math.round(resumo.carbo * 10) / 10,
      gordura: Math.round(resumo.gordura * 10) / 10,
      tmb: baseline.tmb,
      get: baseline.tdee,
    },
    refeicoes: refeicoes,
    hidratacao: { litros: baseline.hidratacaoLitros },
    observacoes: buildLocalDietOrientacoes(safeInput, baseline),
  };
}

function buildLocalDietOrientacoes(input, baseline) {
  var obj = String(input.objetivo || 'manutencao').toLowerCase();
  var patologia = String(input.patologia || '').toLowerCase();
  var restricoes = String(input.restricoes || '').toLowerCase();
  var medicamentos = String(input.medicamentos || '').toLowerCase();
  var sexo = String(input.sexo || 'masculino').toLowerCase();
  var peso = Number(input.peso || 0);
  var lines = [];

  // === MÉDICO ESPORTIVO: estratégia calórico-proteica por objetivo ===
  if (obj === 'hipertrofia') {
    lines.push('Superavit calórico de 200-400 kcal sobre o TDEE para ganho muscular limpo, minimizando acumulo de gordura.');
    lines.push('Proteína: 1,8-2,2 g/kg/dia. Distribua em todas as refeicoes (min. 25-30 g por refeicao) para estimular sintese proteica muscular ao longo do dia.');
    lines.push('Janela anabolica: consuma 30-40 g de proteina de rapida absorcao (whey, claras) e 60-80 g de carboidratos simples em ate 30-60 min apos o treino.');
    lines.push('Pre-treino: carboidratos de medio/alto IG (banana, batata-doce, arroz branco) 60-90 min antes para glicogenio muscular maximo.');
    lines.push('Sono 7-9 h: pico de GH ocorre nas primeiras horas de sono profundo. Ceia com caseina (iogurte grego, queijo cottage) reduz catabolismo noturno.');
  } else if (obj === 'forca') {
    lines.push('Calorias em leve superavit (150-300 kcal). Foco em potencia e recuperacao neuromuscular.');
    lines.push('Proteina: 2,0-2,4 g/kg/dia para suportar adaptacoes de forca e hipertrofia miofibilar.');
    lines.push('Creatina monohidratada 3-5 g/dia aumenta fosfato de creatina intramuscular, melhora performance em esforcos maximos de 1-10 s.');
    lines.push('Carboidratos no pre-treino sao criticos para manter intensidade nos lifts pesados.');
  } else if (obj === 'emagrecimento') {
    lines.push('Deficit calorico de 300-500 kcal/dia (max. 500 kcal) para perda de gordura sem catabolismo muscular significativo.');
    lines.push('Proteina alta: 2,0-2,4 g/kg/dia no deficit preserva massa magra e aumenta termogenese dietetica.');
    lines.push('Ciclagem de carboidratos: dias de treino pesado com mais carbo, dias de repouso com foco em proteina e gordura saudavel.');
    lines.push('Fibras soluveis (aveia, feijao, lentilha) retardam esvaziamento gastrico, controlam glicemia e aumentam saciedade.');
  } else if (obj === 'recomposicao') {
    lines.push('Recomposicao: calorias proximas do TDEE (+/-100 kcal). Exige disciplina proteica rigorosa: 2,2-2,6 g/kg/dia.');
    lines.push('Divida os macros pelo tipo de dia: treino pesado (mais carbo), repouso (mais proteina e gordura saudavel).');
  } else if (obj === 'manutencao') {
    lines.push('Calorias iguais ao TDEE. Mantenha variacao semanal pequena (+/-200 kcal) para estabilidade metabolica.');
    lines.push('Proteina minima de 1,6-1,8 g/kg/dia para preservar massa magra com o envelhecimento.');
  }

  // === ENDOCRINOLOGISTA: patologias metabolicas e hormonais ===
  if (/diabetes|pre.?diabetes|insulina|resistencia.*insulina/.test(patologia)) {
    lines.push('Diabetes/resistencia a insulina: distribua carboidratos em porcoes iguais ao longo do dia (max. 45-60 g por refeicao) para evitar picos de glicemia pos-prandial.');
    lines.push('Indice glicemico importa: prefira arroz integral, aveia, batata-doce e leguminosas. Evite arroz branco, pao frances, sucos e doces.');
    lines.push('Vinagre de maca (1 col. sopa antes das refeicoes) e canela (1-2 g/dia) tem evidencia modesta de melhora de sensibilidade a insulina.');
    lines.push('Exercicio resistido melhora captacao de glicose independente de insulina via GLUT-4. Priorize treino de forca.');
  }
  if (/hipotireoidismo/.test(patologia)) {
    lines.push('Hipotireoidismo: selenium (castanha-do-para: 1-2 unidades/dia) e zinco (carne vermelha magra, sementes de abobora) suportam conversao de T4 em T3 ativo.');
    lines.push('Evite goitrogenos crus em excesso (brocolis, couve, repolho) se TSH muito elevado. Cozidos sao seguros.');
    lines.push('Tome levotiroxina em jejum, 30-60 min antes do cafe da manha. Calcio, ferro e fibras prejudicam absorcao.');
  }
  if (/hipertireoidismo/.test(patologia)) {
    lines.push('Hipertireoidismo: hipercatabolismo eleva necessidade calorica. Priorize densidade calorica e proteina.');
    lines.push('Evite iodo em excesso (algas, suplementos com iodo). Limite cafeina pela taquicardia associada.');
  }
  if (/sop|sindrome.*ovario|ovarito/.test(patologia)) {
    lines.push('SOP: dieta de baixo indice glicemico reduz hiperinsulinemia, principal driver do excesso androgenico na SOP.');
    lines.push('Inositol (mio-inositol 2-4 g/dia) tem evidencia de melhora de sensibilidade a insulina e regularizacao do ciclo em SOP.');
    lines.push('Omega-3 (2-3 g/dia EPA+DHA) reduz inflamacao cronica de baixo grau associada a SOP.');
    if (/metformina/.test(medicamentos)) {
      lines.push('Metformina: tome com as refeicoes para reduzir efeitos gastrointestinais. Pode reduzir absorcao de B12 a longo prazo.');
    }
  }
  if (/menopausa|climaterio/.test(patologia)) {
    lines.push('Menopausa: queda de estrogenio acelera perda ossea. Calcio 1200 mg/dia (laticinios, sardinha com espinha, brocolis) e vitamina D 1000-2000 UI/dia.');
    lines.push('Fitoestrogenios (soja, linhaca) podem aliviar sintomas vasomotores em algumas mulheres.');
    lines.push('Proteina elevada (1,6-2,0 g/kg) e treino de forca sao as intervencoes mais eficazes contra sarcopenia pos-menopausa.');
  }
  if (/hipertensão|hipertensao|pressao.*alta/.test(patologia)) {
    lines.push('Hipertensao: limite sodio a 2000 mg/dia (equivale a 5 g de sal). Leia rotulos: embutidos, enlatados e temperos prontos sao as maiores fontes ocultas.');
    lines.push('Dieta DASH: rica em potassio (banana, batata-doce, feijao), magnesio (folhas verdes, amendoas) e calcio reduz PA sistolica 8-14 mmHg.');
    lines.push('Limit alcool a maximo 1 dose/dia (mulheres) ou 2 doses/dia (homens). Acima disso, PA aumenta linearmente.');
  }
  if (/colesterol|ldl|dislipidemia|triglicerid/.test(patologia)) {
    lines.push('Dislipidemia: fibras soluveis (aveia 40 g/dia, psyllium) reduzem LDL em 5-10% ao sequestrar acidos biliares no intestino.');
    lines.push('Omega-3 (2-4 g EPA+DHA/dia) reduz triglicerideos em 20-30%. Prefira sardinha, salmao, atum em natacao natural.');
    lines.push('Substitua gorduras saturadas (carne gorda, manteiga) por insaturadas (azeite extravirgem, abacate, nozes). Evite gordura trans.');
    lines.push('Fitosterois (2 g/dia via margarinas enriquecidas ou suplemento) inibem absorcao de colesterol no intestino.');
  }
  if (/refluxo|gerd|esofagite|gastrite|ulcera/.test(patologia)) {
    lines.push('Refluxo/gastrite: evite cafe, alcool, menta, tomate, citricos e alimentos gordurosos nas ultimas 3 h antes de dormir.');
    lines.push('Refeicoes menores e mais frequentes reduzem pressao intragastrica. Mastige bem e devagar.');
    lines.push('Elevacao da cabeceira da cama em 15-20 cm e nao deitar ate 2 h apos a refeicao reduz episodios noturnos.');
  }
  if (/renal|creatinina|ckd|rim/.test(patologia)) {
    lines.push('Doenca renal: restricao proteica (0,6-0,8 g/kg em DRC sem dialise) reduz progressao. Ajuste com nefrologista.');
    lines.push('Controle potassio (evite banana, laranja, tomate se K elevado), fosforo (evite laticinios em excesso, nozes) e sodio.');
  }

  // === NUTRÓLOGO: estratégias micronutricionais e interacoes ===
  if (/anemia|ferritina|hemoglobina/.test(patologia)) {
    lines.push('Anemia ferropriva: ferro heme (carne vermelha magra, figado) tem absorcao 3x maior que ferro nao-heme. Combine com vitamina C (laranja, limaO, pimentao) na mesma refeicao.');
    lines.push('Evite cha, cafe e calcio na mesma refeicao que alimentos ricos em ferro: inibem absorcao.');
  }
  if (/osteoporose|osteopenia/.test(patologia)) {
    lines.push('Osteoporose: calcio 1200 mg/dia + vitamina D 1000-2000 UI/dia sao base do tratamento nao-farmacologico.');
    lines.push('Vitamina K2 (MK-7, 100-200 mcg/dia) direciona calcio para os ossos e impede deposicao vascular.');
    lines.push('Treino de impacto (caminhada, corrida leve) e de forca estimulam osteoblastos diretamente.');
  }
  if (/esteatose|figado.?gordo|nash/.test(patologia)) {
    lines.push('Esteatose hepatica: reducao de 7-10% do peso corporal melhora histologia hepatica mesmo sem medicacao.');
    lines.push('Elimine acucar adicionado e frutose industrial (refrigerantes, sucos industrializados) — principal driver de esteatose independente de alcool.');
    lines.push('Cafe (2-3 xicaras/dia) tem evidencia de efeito hepatoprotetor em NAFLD.');
  }
  if (sexo === 'feminino') {
    lines.push('Ferro: mulheres em idade fertil necessitam 18 mg/dia (vs. 8 mg/dia em homens). Priorize carne vermelha magra, feijao e folhas escuras.');
    lines.push('Acido folico: essencial em mulheres que planejam gestacao (400-800 mcg/dia).');
  }

  // === RESTRIÇÕES ALIMENTARES ===
  if (/lactose/.test(restricoes)) {
    lines.push('Intolerancia a lactose confirmada: substitua leite e derivados por versoes sem lactose ou bebidas vegetais (soja, amendoa) enriquecidas com calcio para atingir cota diaria de 1000-1200 mg.');
  }
  if (/glúten|gluten/.test(restricoes)) {
    lines.push('Restricao ao gluten: evite trigo, centeio, cevada e aveia contaminada. Prefira arroz, batata-doce, mandioca, quinoa e milho como fontes de carboidrato.');
  }
  if (/amendoim|amend/.test(restricoes)) {
    lines.push('Alergia a amendoim: verifique rotulos de barras de proteina, pasta de amendoim, biscoitos e amendoas — contaminacao cruzada e frequente.');
  }

  // === HIDRATACAO (calculada pelo peso) ===
  if (baseline && baseline.hidratacaoLitros) {
    lines.push('Hidratacao: ' + baseline.hidratacaoLitros + ' L/dia (35 ml/kg). Aumente 500-750 ml por hora de treino intenso ou em dias de calor.');
  }

  // === COMPORTAMENTO ALIMENTAR (universal) ===
  lines.push('Mastigue devagar (min. 20 mastigadas por bocado) para melhorar digestao e sinalizar saciedade ao hipotalamo.');
  lines.push('Evite grandes volumes de liquido junto as refeicoes para nao diluir enzimas digestivas e acido gastrico.');
  lines.push('Planejamento semanal: prepare proteinas e carboidratos em lote (meal prep) para garantir aderencia nos dias corridos.');

  if (input.padraoAlimentar && !/oniv/i.test(input.padraoAlimentar)) {
    lines.push('Padrao alimentar: ' + input.padraoAlimentar + '. Atencao a vitamina B12, ferro e zinco que tem biodisponibilidade reduzida em dietas sem carnes.');
  }
  return lines;
}

function buildLocalDietRenderText(input, reason) {
  const fallbackPlan = buildLocalDietPlan(input);
  const fallbackNotes = Array.isArray(fallbackPlan.observacoes) ? fallbackPlan.observacoes.slice() : [];
  const normalizedReason = String(reason || "").trim();
  if (normalizedReason && !fallbackNotes.some(function(note) { return String(note || "").trim() === normalizedReason; })) {
    fallbackNotes.unshift(normalizedReason);
  }
  return renderDietModelAsText({
    text: reason || "Plano local gerado em modo contingência.",
    flowState: null,
    failSafe: false,
    limitedOrientation: null,
    meta: fallbackPlan.meta,
    refeicoes: fallbackPlan.refeicoes,
    hidratacao: fallbackPlan.hidratacao,
    observacoes: fallbackNotes,
  });
}

function buildDietFallbackTextFromInput(input, reason) {
  return buildLocalDietRenderText(input, reason || "O serviço principal de dieta falhou; aplicando protocolo inicial seguro.");
}

function resolveDietRuntimeErrorMessage(payload, httpStatus, input, fallbackReason) {
  const friendly = resolveAiFriendlyError(payload, httpStatus);
  const reason = (
    friendly &&
    !/não consegui (montar|processar)/i.test(String(friendly)) &&
    !/sem evid[eê]ncia espec[ií]fica dispon[ií]vel agora/i.test(String(friendly))
  )
    ? friendly
    : (fallbackReason || friendly || "Plano local gerado após falha da rota.");
  return buildLocalDietRenderText(input, reason);
}

async function requestDietRoute(payload, timeoutMs) {
  const timeout = Number(timeoutMs);
  const supportsAbort = typeof AbortController === "function";
  const controller = supportsAbort ? new AbortController() : null;
  const requestPromise = apiFetch(resolveAppApiUrl("/api/kronia/diet"), {
    method: "POST",
    body: JSON.stringify({
      requestId: "diet_" + Date.now(),
      action: "GENERATE_DIET",
      payload: payload,
    }),
    signal: controller ? controller.signal : undefined,
  });

  if (!supportsAbort || !Number.isFinite(timeout) || timeout <= 0) {
    return requestPromise;
  }

  let timeoutId = null;
  const timeoutPromise = new Promise(function (_, reject) {
    timeoutId = setTimeout(function () {
      try { controller.abort(); } catch (_) {}
      reject(new Error("Tempo limite da rota de dieta excedido."));
    }, timeout);
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function requestModernNutritionPlan(payload, timeoutMs) {
  const timeout = Number(timeoutMs);
  const supportsAbort = typeof AbortController === "function";
  const controller = supportsAbort ? new AbortController() : null;
  const requestPromise = apiFetch(resolveAppApiUrl("/api/nutrition-plan"), {
    method: "POST",
    body: JSON.stringify(payload || {}),
    signal: controller ? controller.signal : undefined,
  });

  if (!supportsAbort || !Number.isFinite(timeout) || timeout <= 0) {
    return requestPromise;
  }

  let timeoutId = null;
  const timeoutPromise = new Promise(function(_, reject) {
    timeoutId = setTimeout(function() {
      try { controller.abort(); } catch (_) {}
      reject(new Error("Tempo limite da rota moderna de dieta excedido."));
    }, timeout);
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function requestKronosDietPlan(payload, timeoutMs) {
  const timeout = Number(timeoutMs);
  const supportsAbort = typeof AbortController === "function";
  const controller = supportsAbort ? new AbortController() : null;
  const requestPromise = apiFetch(resolveAppApiUrl("/api/chat"), {
    method: "POST",
    body: JSON.stringify({
      requestId: "diet_kronos_" + Date.now(),
      isDietDirect: true,
      messages: [{ role: "user", content: "Gerar dieta completa pelo KRONOS central." }],
      dietProfile: payload || {},
      payload: payload || {},
    }),
    signal: controller ? controller.signal : undefined,
  });

  if (!supportsAbort || !Number.isFinite(timeout) || timeout <= 0) {
    return requestPromise;
  }

  let timeoutId = null;
  const timeoutPromise = new Promise(function(_, reject) {
    timeoutId = setTimeout(function() {
      try { controller.abort(); } catch (_) {}
      reject(new Error("Tempo limite do KRONOS central de dieta excedido."));
    }, timeout);
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function extractModernNutritionRenderModel(payload) {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const contentNodes = safePayload.data && Array.isArray(safePayload.data.content) ? safePayload.data.content : [];
  const dietNode = contentNodes.find(function(node) {
    return node && /^(diet_result|diet_primary|diet_failsafe)$/i.test(String(node.type || ""));
  });
  const serviceResult = dietNode && dietNode.data && typeof dietNode.data === "object"
    ? dietNode.data
    : (safePayload.data && typeof safePayload.data === "object" ? safePayload.data : safePayload);
  const plan = serviceResult.plan && typeof serviceResult.plan === "object" ? serviceResult.plan : serviceResult;
  const directVisual = serviceResult.visualPrescription && typeof serviceResult.visualPrescription === "object"
    ? serviceResult.visualPrescription
    : (plan.visualPrescription && typeof plan.visualPrescription === "object" ? plan.visualPrescription : null);
  const hasVisualMeals = !!(directVisual && Array.isArray(directVisual.meals) && directVisual.meals.length);
  if (!plan || ((!Array.isArray(plan.refeicoes) || !plan.refeicoes.length) && !hasVisualMeals)) return null;
  const calculation = serviceResult.calculation && typeof serviceResult.calculation === "object" ? serviceResult.calculation : {};
  const resumo = plan.resumoDiario && typeof plan.resumoDiario === "object" ? plan.resumoDiario : {};
  const legacyMeta = plan.meta && typeof plan.meta === "object" ? plan.meta : {};
  const clinicalNotes = Array.isArray(serviceResult.clinicalNotes) ? serviceResult.clinicalNotes : [];
  const meta = {
    calorias: legacyMeta.calorias || resumo.calorias || directVisual && directVisual.summary && directVisual.summary.kcal_total || calculation.targetCalories || 0,
    proteina: legacyMeta.proteina || resumo.proteinas || directVisual && directVisual.summary && directVisual.summary.proteina || calculation.macros && calculation.macros.protein || 0,
    carbo: legacyMeta.carbo || resumo.carboidratos || directVisual && directVisual.summary && directVisual.summary.carbo || calculation.macros && calculation.macros.carbs || 0,
    gordura: legacyMeta.gordura || resumo.gorduras || directVisual && directVisual.summary && directVisual.summary.gordura || calculation.macros && calculation.macros.fat || 0,
    tmb: legacyMeta.tmb || calculation.tmb || 0,
    get: legacyMeta.get || calculation.get || 0,
  };
  const refeicoes = (Array.isArray(plan.refeicoes) ? plan.refeicoes : []).map(function(meal) {
    const safeMeal = meal && typeof meal === "object" ? meal : {};
    const itens = Array.isArray(safeMeal.itens) ? safeMeal.itens : [];
    const subtotal = safeMeal.subtotal && typeof safeMeal.subtotal === "object" ? safeMeal.subtotal : {};
    const alimentos = Array.isArray(safeMeal.alimentos) && safeMeal.alimentos.length
      ? safeMeal.alimentos
      : itens.map(function(item) {
        const safeItem = item && typeof item === "object" ? item : {};
        return {
          nome: safeItem.nome || safeItem.name || "Alimento",
          qtde: safeItem.porcao || safeItem.quantity || (safeItem.gramas ? (safeItem.gramas + " g") : ""),
          kcal: safeItem.kcal || safeItem.calorias || 0,
          prot: safeItem.prot || safeItem.proteinas || safeItem.proteina || 0,
          carb: safeItem.carb || safeItem.carboidratos || safeItem.carbo || 0,
          gord: safeItem.gord || safeItem.gorduras || safeItem.gordura || 0,
        };
      });
    const computedSubtotal = alimentos.reduce(function(acc, item) {
      acc.kcal += Number(item.kcal || 0);
      acc.prot += Number(item.prot || 0);
      acc.carb += Number(item.carb || 0);
      acc.gord += Number(item.gord || 0);
      return acc;
    }, { kcal: 0, prot: 0, carb: 0, gord: 0 });
    return Object.assign({}, safeMeal, {
      subtotal: Object.assign({}, subtotal, {
        kcal: subtotal.kcal || subtotal.calorias || computedSubtotal.kcal || 0,
        prot: subtotal.prot || subtotal.proteinas || computedSubtotal.prot || 0,
        carb: subtotal.carb || subtotal.carboidratos || computedSubtotal.carb || 0,
        gord: subtotal.gord || subtotal.gorduras || computedSubtotal.gord || 0,
      }),
      alimentos: alimentos,
    });
  });
  if (!refeicoes.length && hasVisualMeals) {
    directVisual.meals.forEach(function(meal) {
      refeicoes.push({
        nome: meal.name || 'Refeição',
        horario: meal.time || '',
        subtotal: {
          kcal: Number(meal.kcal_estimada || 0),
          prot: 0,
          carb: 0,
          gord: 0
        },
        alimentos: (Array.isArray(meal.items) ? meal.items : []).map(function(item) {
          var text = String(item || '');
          var parts = text.split(/\s+-\s+/);
          return {
            nome: parts.shift() || 'Alimento',
            qtde: parts.join(' - '),
            kcal: 0,
            prot: 0,
            carb: 0,
            gord: 0,
          };
        })
      });
    });
  }
  return {
    text: dietNode ? "Plano alimentar gerado pelo KRONOS central." : "Plano alimentar gerado pelo motor moderno de nutrição.",
    flowState: null,
    failSafe: false,
    limitedOrientation: null,
    meta: meta,
    objetivo: plan.objetivo || calculation.objective || null,
    caloriasMeta: plan.caloriasMeta || meta.calorias,
    macrosMeta: plan.macrosMeta || {
      protein: meta.proteina,
      carbs: meta.carbo,
      fat: meta.gordura,
    },
    resumoDiario: plan.resumoDiario || {
      calorias: meta.calorias,
      proteinas: meta.proteina,
      carboidratos: meta.carbo,
      gorduras: meta.gordura,
    },
    visualPrescription: directVisual || null,
    refeicoes: refeicoes,
    hidratacao: plan.hidratacao || {},
    observacoes: []
      .concat(Array.isArray(plan.observacoes) ? plan.observacoes : [])
      .concat(clinicalNotes)
      .filter(Boolean),
  };
}

async function generateDietWithModernEngine(input, dietPayload, timeoutMs) {
  let resp = null;
  let data = null;
  let primaryError = null;

  try {
    resp = await requestKronosDietPlan(dietPayload, timeoutMs || 12000);
    data = await resp.json().catch(function() { return null; });
    if (!resp.ok || !data || data.success === false || data.ok === false || data.failSafe === true) {
      primaryError = new Error(data && (data.message || data.warning || data.error) || "O KRONOS central retornou erro.");
    }
  } catch (err) {
    primaryError = err;
  }

  if (primaryError) {
    resp = await requestModernNutritionPlan(dietPayload, timeoutMs || 12000);
    data = await resp.json().catch(function() { return null; });
    if (!resp.ok || !data || data.ok === false || data.failSafe === true) {
      throw new Error(data && (data.message || data.warning || data.error) || primaryError.message || "A rota moderna de dieta retornou erro.");
    }
  }
  const renderModel = extractModernNutritionRenderModel(data);
  if (!renderModel) throw new Error("Contrato inválido da rota moderna de dieta.");
  return renderModel;
}

async function gerarDieta() {
  if (window._dietGenerating) { showToast('Dieta já está sendo gerada...', 'info', 2000); return; }
  window._dietGenerating = true;
  const input = collectDietGenerationInput();
  if (input.fromChatDiet) {
    trackKroniaCta('diet_apply_started_from_chat', 'success', {
      hasPayload: !!Object.keys(window._kroniaChatDietHydratedContext || {}).length,
    });
  }

  const dietPayload = buildDietRequestPayloadFromInput(input);
  try {
    renderDietMasterSnapshot(input, computeDietGenerationBaseline(input));
    renderDietMasterMealPreview(buildLocalDietPlan(input));
  } catch (_) {}
  const guard = await validateScientificGenerationGuard(
    'diet',
    input.objetivo,
    dietPayload,
    { respectedCardContext: false, respectedAnamnesisContext: true }
  );

  const res = document.getElementById("dietaResultado");
  const txt = document.getElementById("dietaTexto");
  const btn = document.getElementById("btnGerarDieta");
  if (res) res.style.display = "block";
  if (txt) txt.textContent = buildLocalDietRenderText(input, "Plano inicial gerado localmente. Sincronizando versão completa...");
  if (btn) btn.disabled = true;
  showToast('Gerando sua dieta com IA...', 'info', 5000);
  persistDietGenerationPrefs(input);

  if (!guard.ok) {
    if (txt) txt.textContent = buildLocalDietRenderText(input, "Não foi possível validar todos os critérios científicos agora. Aplicando plano local conservador.");
    if (btn) btn.disabled = false;
    showToast('Não foi possível validar critérios agora. Tente novamente.', 'warning', 4000);
    return;
  }
  if (shouldShowScientificWarningToast(guard)) {
    showToast(guard.warningMessage, "info", 5200);
  }

  try {
    const renderModel = await generateDietWithModernEngine(input, dietPayload, 12000);

    txt.textContent = renderDietModelAsText(renderModel) || renderModel.text || buildDietFallbackTextFromInput(input);
    try { renderDietMasterMealPreview(renderModel); } catch (_) {}
    try {
      var intakeSnapshot = buildNutritionIntakeSnapshot();
      setNutritionFlowState({ generatedPlan: renderModel, generatedText: txt.textContent });
      setActiveDietPlan(Object.assign(normalizeDietGeneratedPlan(renderModel, { source: "nutrition_legacy_generate_redirect" }), {
        contextSnapshot: intakeSnapshot,
        rawGeneratedPlan: renderModel,
      }), { render: false });
      var savedPlan = await saveActiveDietPlan({ silent: true, contextSnapshot: intakeSnapshot, generatedPlan: renderModel });
      finishDietGenerationSuccess(savedPlan || window._kroniaDietPlan || renderModel);
    } catch (_) {}
    writeAuditTracePatch({
      generation: buildGenerationEnvelope({
        type: "diet",
        sourceOfTruth: guard.generationTrace?.sourceOfTruth || "supabase_scientific_evidence",
        usedScientificEvidence: guard.generationTrace?.usedScientificEvidence,
        scienceTopicsUsed: guard.generationTrace?.scienceTopicsUsed || [],
        evidenceCount: guard.generationTrace?.evidenceCount || 0,
        validationStatus: "generated",
        blockedReason: null,
        constraintsUsed: guard.generationTrace?.constraintsUsed || {},
        userInputsUsed: guard.generationTrace?.userInputsUsed || dietPayload,
        respectedCardContext: false,
        respectedAnamnesisContext: true,
        usedFallback: !!guard.generationTrace?.usedFallback,
      }),
    });
  } catch (e) {
    logUiEvent("diet_pipeline_failed", {
      context: "gerarDieta.catch",
      error: e && e.message ? e.message : "unknown",
    });
    if (txt) txt.textContent = buildLocalDietRenderText(input, e && e.message ? e.message : "Falha de rede ao gerar dieta.");
    showToast(e && e.message ? e.message : 'Falha de rede ao gerar dieta. Tente novamente.', 'error', 5000);
  } finally {
    if (btn) btn.disabled = false;
    window._dietGenerating = false;
  }

  if (input.fromChatDiet) {
    trackKroniaCta('diet_apply_completed_from_chat', 'success', {
      hasPayload: !!Object.keys(window._kroniaChatDietHydratedContext || {}).length,
    });
    window._kroniaChatDietHydratedContext = null;
  }
}

// ══════════════════════════════════════════
// CALCULAR BASAL
// ══════════════════════════════════════════
function calcularDietaAvancada() {
  const peso    = parseFloat(document.getElementById('davPeso').value);
  const altura  = parseFloat(document.getElementById('davAltura').value);
  const pescoco = parseFloat(document.getElementById('davPescoco').value);
  const cintura = parseFloat(document.getElementById('davCintura').value);
  const quadril = parseFloat(document.getElementById('davQuadril').value);
  if (!peso || peso <= 0 || !altura || altura <= 0 || !pescoco || pescoco <= 0 || !cintura || cintura <= 0) { showToast('Preencha peso, altura, pescoço e cintura com valores válidos.', 'error'); return; }
  if (_davSexo === 'F' && (!quadril || quadril <= 0)) { showToast('Preencha o quadril com um valor válido.', 'error'); return; }
  const _davCicloEl = document.querySelector('#davCicloChips .config-chip.active');
  localStorage.setItem("kronia_calc_prefs", JSON.stringify({
    ...safeJSON("kronia_calc_prefs", {}),
    davPeso: document.getElementById('davPeso').value,
    davAltura: document.getElementById('davAltura').value,
    davPescoco: document.getElementById('davPescoco').value,
    davCintura: document.getElementById('davCintura').value,
    davQuadril: document.getElementById('davQuadril').value,
    davSexo: _davSexo, davBio: _davBio, davObj: _davObj,
    davCiclo: _davCicloEl ? _davCicloEl.dataset.val : String(_davCicloProto)
  }));

  // BF% — Fórmula Naval (US Navy)
  let bf;
  if (_davSexo === 'M') {
    bf = 495 / (1.0324 - 0.19077 * Math.log10(cintura - pescoco) + 0.15456 * Math.log10(altura)) - 450;
  } else {
    bf = 495 / (1.29579 - 0.35004 * Math.log10(cintura + quadril - pescoco) + 0.22100 * Math.log10(altura)) - 450;
  }
  bf = Math.max(3, Math.min(50, bf));
  const massaMagra = peso * (1 - bf / 100);
  const massaGorda = peso * (bf / 100);

  // TMB — Katch-McArdle (usa massa magra → mais preciso)
  const tmb = 370 + 21.6 * massaMagra;

  // Ajuste de objetivo
  const goalMult = { emagrecer: 0.80, manter: 1.0, ganhar: 1.10 }[_davObj];

  // Proteína por biotipo (g/kg massa magra)
  const protM = {
    ecto: { descanso: 2.0, treino: 2.2, cardio: 2.0, tec: 2.4 },
    meso: { descanso: 2.2, treino: 2.4, cardio: 2.2, tec: 2.6 },
    endo: { descanso: 2.4, treino: 2.6, cardio: 2.4, tec: 2.8 }
  };
  // Gordura por biotipo (g/kg peso total)
  const fatM = {
    ecto: { descanso: 1.0, treino: 1.2, cardio: 0.9, tec: 1.1 },
    meso: { descanso: 0.8, treino: 0.9, cardio: 0.7, tec: 0.8 },
    endo: { descanso: 0.6, treino: 0.7, cardio: 0.5, tec: 0.6 }
  };
  // Multiplicadores TDEE por tipo de dia
  const tdeeMult = { descanso: 1.2, treino: 1.55, cardio: 1.35, tec: 1.7 };
  const dayKeys = ['descanso', 'treino', 'cardio', 'tec'];
  const days = {};
  for (const d of dayKeys) {
    const kcal = Math.round(tmb * tdeeMult[d] * goalMult);
    const prot = Math.round(massaMagra * protM[_davBio][d]);
    const fat  = Math.round(peso * fatM[_davBio][d]);
    const carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
    days[d] = { kcal, prot, fat, carbs };
  }
  _davCalcResult = { bf, massaMagra, massaGorda, tmb, days };
  renderDavResult(_davCalcResult);
}

function renderDavResult(r) {
  document.getElementById('davBF').textContent = r.bf.toFixed(1) + '%';
  document.getElementById('davMassaMagra').textContent = r.massaMagra.toFixed(1) + ' kg';
  document.getElementById('davMassaGorda').textContent = r.massaGorda.toFixed(1) + ' kg';
  document.getElementById('davTMB').textContent = Math.round(r.tmb) + ' kcal';
  const labels = { descanso: `${_ico('moon', 16)} Descanso`, treino: `${_ico('dumbbell', 16)} Treino`, cardio: `${_ico('activity', 16)} Cardio`, tec: `${_ico('flame', 16)} Treino + Cardio` };
  document.getElementById('davMacroRows').innerHTML = Object.entries(labels).map(([k, lbl]) => {
    const d = r.days[k];
    return `<div style="display:grid;grid-template-columns:1fr 0.7fr 0.7fr 0.7fr 0.7fr;gap:4px;padding:8px 0;border-top:1px solid var(--border)">
      <div style="font-size:0.78rem;font-weight:600;color:var(--text)">${lbl}</div>
      <div style="font-size:0.78rem;color:var(--accent);text-align:right;font-weight:700">${d.kcal}</div>
      <div style="font-size:0.78rem;color:var(--text);text-align:right">${d.prot}g</div>
      <div style="font-size:0.78rem;color:var(--text);text-align:right">${d.fat}g</div>
      <div style="font-size:0.78rem;color:${d.carbs===0?'var(--red)':'var(--text)'};text-align:right">${d.carbs}g</div>
    </div>`;
  }).join('');
  renderDavCiclo(r);
  document.getElementById('davResult').style.display = '';
  document.getElementById('davResult').scrollIntoView({ behavior: 'smooth' });
}

function renderDavCiclo(r) {
  const high = r.days['treino'], low = r.days['descanso'];
  const proto = _davCicloProto;
  const avgKcal  = Math.round((proto * high.kcal  + low.kcal)  / (proto + 1));
  const avgProt  = Math.round((proto * high.prot  + low.prot)  / (proto + 1));
  const avgFat   = Math.round((proto * high.fat   + low.fat)   / (proto + 1));
  const avgCarbs = Math.round((proto * high.carbs + low.carbs) / (proto + 1));
  const cycle = proto + 1;
  const pattern = Array.from({length: 7}, (_, i) => {
    const isHigh = (i % cycle) < proto;
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;font-size:0.6rem;font-weight:700;background:${isHigh?'var(--accent-dim)':'var(--bg2)'};color:${isHigh?'var(--accent)':'var(--muted)'};">${isHigh?'ALTO':'BAIXO'}</span>`;
  }).join('');
  document.getElementById('davCicloResult').innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${pattern}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:0.62rem;color:var(--accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Dia ALTO (${proto}×/ciclo)</div>
        <div style="font-size:0.9rem;font-weight:700;color:var(--accent)">${high.kcal} kcal</div>
        <div style="font-size:0.7rem;color:var(--muted);margin-top:4px">${high.prot}g prot · ${high.fat}g gord · ${high.carbs}g carbs</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:0.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Dia BAIXO (1×/ciclo)</div>
        <div style="font-size:0.9rem;font-weight:700;color:var(--text)">${low.kcal} kcal</div>
        <div style="font-size:0.7rem;color:var(--muted);margin-top:4px">${low.prot}g prot · ${low.fat}g gord · ${low.carbs}g carbs</div>
      </div>
    </div>
    <div style="padding:10px;background:var(--bg2);border-radius:10px">
      <div style="font-size:0.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Média Semanal</div>
      <div style="font-size:0.8rem;color:var(--text);font-weight:600">${avgKcal} kcal · ${avgProt}g prot · ${avgFat}g gord · ${avgCarbs}g carbs</div>
    </div>`;
}




// ══════════════════════════════════════════
// GUIA DE EXERCÍCIO — bonequinho animado
// ══════════════════════════════════════════
const GUIA_DB = {
  // tipo → { muscles, steps, type }
  "Supino Reto com Barra":        { m:"Peito · Tríceps · Ombros",    t:"bench",   steps:["Deite no banco, pés firmes no chão","Segure a barra na largura dos ombros","Desça até tocar levemente o peito","Empurre até os braços estendidos"] },
  "Supino Inclinado 30°":         { m:"Peito Superior · Tríceps",    t:"bench",   steps:["Banco inclinado a 30°, pés no chão","Barra acima do peito superior","Desça controlado até o peito","Empurre e esprema o peito no topo"] },
  "Supino com Halteres":          { m:"Peito · Tríceps · Estabilizadores", t:"bench", steps:["Halteres à altura do peito","Cotovelos levemente dobrados","Desça abrindo os braços","Junte e aperte o peito no topo"] },
  "Crucifixo com Halteres":       { m:"Peito · Ombros Anteriores",   t:"fly",     steps:["Deite, halteres sobre o peito","Braços levemente dobrados","Abra em arco até sentir o peito","Feche contraindo o peito"] },
  "Crossover Cabo":               { m:"Peito · Ombros",              t:"fly",     steps:["Fique entre os cabos altos","Pegue os cabos, passo à frente","Puxe cruzando pela frente","Junte as mãos na frente do corpo"] },
  "Barra Fixa Pronada":           { m:"Costas · Bíceps",             t:"pulldown",steps:["Pegada pronada, mãos afastadas","Braços esticados, corpo pendurado","Puxe o queixo acima da barra","Desça de forma controlada"] },
  "Remada Curvada com Barra":     { m:"Costas · Bíceps · Core",      t:"row",     steps:["Incline o tronco ~45°","Costas retas, joelhos leves","Puxe a barra até o umbigo","Junte as escápulas no topo"] },
  "Puxada Alta":                  { m:"Costas · Bíceps",             t:"pulldown",steps:["Segure a barra larga e pronada","Incline levemente o tronco","Puxe até a clavícula","Controle a subida devagar"] },
  "Remada Unilateral":            { m:"Costas · Bíceps",             t:"row",     steps:["Joelho e mão no banco","Costas paralelas ao chão","Puxe o halter até o quadril","Desça com controle total"] },
  "Remada Baixa Cabo":            { m:"Costas Média · Bíceps",       t:"row",     steps:["Sente, pés na plataforma","Segure o triângulo de cabo","Puxe até o umbigo","Deite as escápulas no topo"] },
  "Agachamento Livre":            { m:"Quadríceps · Glúteos · Core", t:"squat",   steps:["Pés na largura dos ombros","Peito ereto, olhar à frente","Sente até 90° ou abaixo","Empurre o chão e suba"] },
  "Leg Press 45°":                { m:"Quadríceps · Glúteos",        t:"squat",   steps:["Costas apoiadas no encosto","Pés na plataforma, largura média","Desça controlado até 90°","Empurre sem travar os joelhos"] },
  "Cadeira Extensora":            { m:"Quadríceps",                  t:"extension",steps:["Sentado, ajuste o apoio no tornozelo","Mãos nas alças laterais","Estenda as pernas completamente","Desça controlado sem bater"] },
  "Mesa Flexora":                 { m:"Posterior da Coxa",           t:"curl_leg",steps:["Deite de barriga para baixo","Apoio no tornozelo","Puxe o calcanhar até o glúteo","Desça com controle total"] },
  "Stiff":                        { m:"Posterior · Glúteos · Lombar",t:"hinge",   steps:["Pés na largura do quadril","Empurre o quadril para trás","Halteres descem retos pelo corpo","Contraia glúteos ao subir"] },
  "Agachamento Búlgaro":          { m:"Glúteos · Quadríceps",        t:"squat",   steps:["Pé traseiro elevado no banco","Pé da frente à frente","Desça o joelho traseiro ao chão","Empurre com a perna da frente"] },
  "Desenvolvimento com Halteres": { m:"Ombros · Tríceps",            t:"overhead",steps:["Sentado, halteres nos ombros","Palmas para frente","Empurre para cima até quase tocar","Desça controlado até o início"] },
  "Elevação Lateral Cabo":        { m:"Deltóide Lateral",            t:"lateral", steps:["Fique ao lado do cabo baixo","Pegue com a mão oposta","Eleve o braço até a altura do ombro","Desça controlado sem balançar"] },
  "Elevação Frontal":             { m:"Deltóide Anterior",           t:"lateral", steps:["Fique em pé, halteres na frente","Braços levemente dobrados","Eleve até a altura do ombro","Desça com controle total"] },
  "Crucifixo Inverso":            { m:"Deltóide Posterior · Trapézio",t:"row",    steps:["Incline o tronco para frente","Halteres pendurados","Eleve os cotovelos para os lados","Esprema as escápulas no topo"] },
  "Encolhimento":                 { m:"Trapézio",                    t:"shrug",   steps:["Fique em pé com halteres","Braços ao longo do corpo","Eleve os ombros ao máximo","Segure 1s e desça devagar"] },
  "Rosca Direta Barra":           { m:"Bíceps · Antebraço",          t:"curl",    steps:["Em pé, cotovelos fixos ao corpo","Palmas para cima, barra na frente","Suba contraindo o bíceps","Desça lentamente sem soltar"] },
  "Rosca Inclinada Haltere":      { m:"Bíceps Cabeça Longa",         t:"curl",    steps:["Banco inclinado ~45°","Halteres pendurados atrás","Suba girando o pulso (supinação)","Desça lentamente o braço"] },
  "Rosca Concentrada":            { m:"Pico do Bíceps",              t:"curl",    steps:["Sentado, cotovelo no joelho","Halter na mão livre","Suba até a contração máxima","Desça com total controle"] },
  "Rosca Martelo":                { m:"Bíceps · Braquial · Antebraço",t:"curl",   steps:["Em pé, palmas uma para a outra","Cotovelos fixos ao corpo","Suba sem girar o pulso","Desça controlado"] },
  "Rosca Spider":                 { m:"Bíceps",                      t:"curl",    steps:["Banco inclinado, peito apoiado","Braços pendurados para baixo","Suba até contração máxima","Desça devagar sem balançar"] },
  "Tríceps Testa":                { m:"Tríceps Cabeças Longa e Lateral",t:"tricep",steps:["Deite, barra acima do peito","Cotovelos apontando para cima","Desça a barra até a testa","Estenda sem mover os cotovelos"] },
  "Tríceps Pulley Corda":         { m:"Tríceps",                     t:"tricep",  steps:["Fique de frente ao cabo alto","Cotovelos fixos ao lado do corpo","Empurre a corda para baixo","Abra as mãos no final e aperte"] },
  "Mergulho em Paralelas":        { m:"Tríceps · Peito · Ombros",    t:"dip",     steps:["Apoie nas paralelas, braços estendidos","Incline levemente o tronco","Desça até o ângulo de 90°","Empurre até estender os braços"] },
  "Extensão Overhead":            { m:"Tríceps Cabeça Longa",        t:"tricep",  steps:["Em pé, halter atrás da cabeça","Cotovelos apontando para cima","Desça o halter atrás da cabeça","Estenda os braços completamente"] },
  "Tríceps Coice":                { m:"Tríceps",                     t:"tricep",  steps:["Incline o tronco ~45°","Cotovelo dobrado, junto ao corpo","Estenda o braço para trás","Contraia o tríceps no final"] },
  "Hip Thrust com Barra":         { m:"Glúteos · Posterior",         t:"hip",     steps:["Costas no banco, barra no quadril","Pés no chão, joelhos dobrados","Empurre o quadril para cima","Contraia no topo e desça"] },
  "Agachamento Profundo":         { m:"Glúteos · Quadríceps",        t:"squat",   steps:["Pés mais afastados que o ombro","Pontas dos pés levemente abertas","Desça o máximo possível","Empurre subindo com os glúteos"] },
  "Elevação Pélvica":             { m:"Glúteos",                     t:"hip",     steps:["Deite, pés no chão","Braços ao lado do corpo","Eleve o quadril contraindo glúteos","Segure 1s no topo e desça"] },
  "Passada":                      { m:"Glúteos · Quadríceps",        t:"lunge",   steps:["Em pé, passo à frente","Costas retas, mãos no quadril","Desça até o joelho quase tocar o chão","Suba e troque a perna"] },
  "Abdução com Cabo":             { m:"Glúteos Médio · TFL",         t:"abduct",  steps:["Fique de lado ao cabo baixo","Perna de fora presa ao cabo","Eleve a perna lateralmente","Desça controlado sem compensar"] },
  "Panturrilha em Pé":            { m:"Gastrocnêmio",                t:"calf",    steps:["Em pé na borda do step","Calcanhares para baixo","Suba na ponta dos pés","Desça sentindo o alongamento"] },
  "Panturrilha Sentado":          { m:"Sóleo · Panturrilha",         t:"calf",    steps:["Sentado, pés no step","Joelhos dobrados 90°","Suba na ponta dos pés","Desça controlado até o fim"] },
  "Leg Press Panturrilha":        { m:"Gastrocnêmio · Sóleo",        t:"calf",    steps:["No leg press, pés na borda","Pernas quase estendidas","Empurre com a ponta dos pés","Retorne sem travar os joelhos"] },
  "Prancha":                      { m:"Core · Abdômen · Lombar",     t:"plank",   steps:["Antebraços no chão","Corpo reto da cabeça ao calcanhar","Contraia o abdômen e glúteos","Respire e segure o tempo"] },
  "Abdominal Roda":               { m:"Abdômen Completo · Core",     t:"rollout", steps:["De joelhos, mãos na roda","Role para frente com as costas retas","Vá até onde conseguir sem arquear","Contraia o core para voltar"] },
  "Elevação de Pernas":           { m:"Abdômen Inferior",            t:"legrise", steps:["Deite, mãos embaixo do quadril","Pernas juntas e estendidas","Suba até 90° com controle","Desça sem tocar o chão"] },
  "Russian Twist":                { m:"Oblíquos · Core",             t:"twist",   steps:["Sentado, tronco inclinado 45°","Pés levantados do chão","Gire o tronco para cada lado","Mantenha o core contraído sempre"] },
  "Dead Bug":                     { m:"Core · Estabilização",        t:"plank",   steps:["Deite de costas","Braços para cima, joelhos dobrados 90°","Estenda braço e perna opostos","Volte e repita para o outro lado"] },
};

// Mapa de tipo → configuração SVG
const GUIA_TYPES = {
  bench:     { label:"Empurrar Deitado",   color:"#f97316" },
  fly:       { label:"Abrir/Fechar Peito", color:"#f97316" },
  pulldown:  { label:"Puxar p/ Baixo",     color:"#22c55e" },
  row:       { label:"Puxar Horizontal",   color:"#22c55e" },
  squat:     { label:"Agachamento",        color:"#3b82f6" },
  hinge:     { label:"Dobradiça",          color:"#3b82f6" },
  curl:      { label:"Rosca de Braço",     color:"#a855f7" },
  curl_leg:  { label:"Flexão de Perna",    color:"#a855f7" },
  tricep:    { label:"Extensão de Tríceps",color:"#f97316" },
  overhead:  { label:"Empurrar p/ Cima",   color:"#f97316" },
  lateral:   { label:"Elevação Lateral",   color:"#f97316" },
  hip:       { label:"Empurrar Quadril",   color:"#3b82f6" },
  lunge:     { label:"Passada",            color:"#3b82f6" },
  dip:       { label:"Mergulho",           color:"#f97316" },
  shrug:     { label:"Encolhimento",       color:"#f97316" },
  calf:      { label:"Panturrilha",        color:"#3b82f6" },
  plank:     { label:"Isometria Core",     color:"#22c55e" },
  rollout:   { label:"Extensão Core",      color:"#22c55e" },
  legrise:   { label:"Elevação de Pernas", color:"#22c55e" },
  twist:     { label:"Rotação",            color:"#22c55e" },
  extension: { label:"Extensão",           color:"#a855f7" },
  abduct:    { label:"Abdução",            color:"#3b82f6" },
};

// Busca curada por exercício → query específica pro YouTube
const GUIA_YT_QUERY = {
  "Supino Reto com Barra":        "como fazer supino reto execução correta musculação",
  "Supino Inclinado 30°":         "supino inclinado 30 graus execução correta musculação",
  "Supino com Halteres":          "supino halteres execução correta musculação",
  "Crucifixo com Halteres":       "crucifixo halteres execução correta peito",
  "Crossover Cabo":               "crossover cabo voador execução correta peito",
  "Barra Fixa Pronada":           "barra fixa pronada execução correta costas",
  "Remada Curvada com Barra":     "remada curvada barra execução correta costas",
  "Puxada Alta":                  "puxada alta execução correta costas latissimo",
  "Remada Unilateral":            "remada unilateral halter execução correta costas",
  "Remada Baixa Cabo":            "remada baixa cabo execução correta costas",
  "Agachamento Livre":            "agachamento livre execução correta joelhos quadriceps",
  "Leg Press 45°":                "leg press 45 graus execução correta quadriceps",
  "Cadeira Extensora":            "cadeira extensora execução correta quadriceps",
  "Mesa Flexora":                 "mesa flexora execução correta posterior coxa",
  "Stiff":                        "stiff halter execução correta posterior glúteo",
  "Agachamento Búlgaro":          "agachamento bulgaro execução correta glúteo quadriceps",
  "Desenvolvimento com Halteres": "desenvolvimento halteres ombro execução correta",
  "Elevação Lateral Cabo":        "elevação lateral cabo ombro execução correta",
  "Elevação Frontal":             "elevação frontal halter ombro execução correta",
  "Crucifixo Inverso":            "crucifixo inverso deltóide posterior execução",
  "Encolhimento":                 "encolhimento trapézio execução correta musculação",
  "Rosca Direta Barra":           "rosca direta barra execução correta bíceps",
  "Rosca Inclinada Haltere":      "rosca inclinada halter bíceps execução correta",
  "Rosca Concentrada":            "rosca concentrada bíceps execução correta",
  "Rosca Martelo":                "rosca martelo halter execução correta bíceps",
  "Rosca Spider":                 "rosca spider bíceps execução correta musculação",
  "Tríceps Testa":                "tríceps testa barra execução correta musculação",
  "Tríceps Pulley Corda":         "tríceps pulley corda execução correta musculação",
  "Mergulho em Paralelas":        "mergulho paralelas tríceps execução correta",
  "Extensão Overhead":            "extensão tríceps overhead halter execução",
  "Tríceps Coice":                "tríceps coice halter execução correta musculação",
  "Hip Thrust com Barra":         "hip thrust barra execução correta glúteo",
  "Agachamento Profundo":         "agachamento profundo glúteo execução correta",
  "Elevação Pélvica":             "elevação pélvica glúteo exercício execução",
  "Passada":                      "passada lunge glúteo quadriceps execução correta",
  "Abdução com Cabo":             "abdução cabo glúteo médio execução correta",
  "Panturrilha em Pé":            "panturrilha em pé execução correta musculação",
  "Panturrilha Sentado":          "panturrilha sentado sóleo execução correta",
  "Leg Press Panturrilha":        "leg press panturrilha execução correta",
  "Prancha":                      "prancha abdominal execução correta core",
  "Abdominal Roda":               "abdominal roda execução correta core",
  "Elevação de Pernas":           "elevação pernas abdominal inferior execução",
  "Russian Twist":                "russian twist oblíquos execução correta",
  "Dead Bug":                     "dead bug core estabilização execução correta",
};

let _guiaExNome = "";

function switchGuiaTab(tab) {
  document.querySelectorAll(".guia-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".guia-panel").forEach(p => p.classList.remove("active"));
  if (tab === "movimento") {
    document.getElementById("guiaTabMovimento").classList.add("active");
    document.getElementById("guiaPanelMovimento").classList.add("active");
    if (_guiaPlaying) _startGuiaAnim();
  } else {
    document.getElementById("guiaTabVideo").classList.add("active");
    document.getElementById("guiaPanelVideo").classList.add("active");
    _stopGuiaAnim();
  }
}

function abrirYouTube() {
  const query = GUIA_YT_QUERY[_guiaExNome] || ("como fazer " + _guiaExNome + " execução correta musculação");
  const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(query);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Busca curada por exercício → query específica pro YouTube
let _guiaAnim = null;
let _guiaPhase = 0;
let _guiaDir = 1;
let _guiaPlaying = true;
let _guiaCurType = "bench";
let _guiaStepIdx = 0;
let _guiaStepTimer = null;

function abrirGuia(nome) {
  openExerciseOnYouTube(null, nome);
}

function fecharGuia() {
  document.getElementById("guiaModal").classList.remove("show");
  document.body.style.overflow = "";
  _stopGuiaAnim();
  _stopGuiaSteps();
}

function toggleGuiaAnim() {
  _guiaPlaying = !_guiaPlaying;
  if (_guiaPlaying) _startGuiaAnim(); else _stopGuiaAnim();
  _updatePlayBtn();
}

function _updatePlayBtn() {
  const icon = document.getElementById("guiaPlayIcon");
  const txt  = document.getElementById("guiaPlayTxt");
  if (_guiaPlaying) {
    icon.innerHTML = '<rect x="1" y="1" width="3" height="8" rx="1"/><rect x="6" y="1" width="3" height="8" rx="1"/>';
    txt.textContent = "Pausar";
  } else {
    icon.innerHTML = '<polygon points="1 1 9 5 1 9"/>';
    txt.textContent = "Animar";
  }
}

function _startGuiaAnim() {
  _stopGuiaAnim();
  _guiaAnim = setInterval(() => {
    _guiaPhase += 0.022 * _guiaDir;
    if (_guiaPhase >= 1) { _guiaPhase = 1; _guiaDir = -1; }
    if (_guiaPhase <= 0) { _guiaPhase = 0; _guiaDir = 1; }
    _drawGuia(_guiaCurType, _guiaPhase);
  }, 16);
}

function _stopGuiaAnim() {
  if (_guiaAnim) { clearInterval(_guiaAnim); _guiaAnim = null; }
}

function _startGuiaSteps(steps) {
  _stopGuiaSteps();
  function next() {
    _guiaStepIdx = (_guiaStepIdx + 1) % steps.length;
    _renderGuiaStep(steps);
    _guiaStepTimer = setTimeout(next, 2200);
  }
  _guiaStepTimer = setTimeout(next, 2200);
}

function _stopGuiaSteps() {
  if (_guiaStepTimer) { clearTimeout(_guiaStepTimer); _guiaStepTimer = null; }
}

function _renderGuiaStep(steps) {
  const container = document.getElementById("guiaSteps");
  container.innerHTML = steps.map((s, i) => `
    <div class="guia-step ${i===_guiaStepIdx?'active':''}" onclick="_guiaStepIdx=${i};_renderGuiaStep(${JSON.stringify(steps).replace(/"/g,"'")})">
      <div class="guia-step-num">${i+1}</div>
      <div class="guia-step-txt">${s}</div>
    </div>`).join("");
}

// ── DESENHO SVG ──────────────────────────────────────────────────────
function _drawGuia(tipo, t) {
  const svg = document.getElementById("guiaSVG");
  if (!svg) return;
  const ns = "http://www.w3.org/2000/svg";
  const acc = "#f97316";
  const dim = "rgba(255,255,255,0.08)";
  const L = (a, b) => a + (b-a)*t;

  function el(tag, attrs) {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, v));
    return e;
  }
  function line(x1,y1,x2,y2,c=acc,w=2.5) {
    return el("line",{x1,y1,x2,y2,stroke:c,"stroke-width":w,"stroke-linecap":"round"});
  }
  function circle(cx,cy,r,fill=`rgba(249,115,22,0.2)`,stroke=acc) {
    return el("ellipse",{cx,cy,rx:r,ry:r,fill,stroke,"stroke-width":1.8});
  }
  function head(cx,cy) {
    const h = el("ellipse",{cx,cy,rx:9,ry:9,fill:"rgba(249,115,22,0.12)",stroke:acc,"stroke-width":2.5});
    return h;
  }
  function rect(x,y,w,h,rx=3,stroke=dim) {
    return el("rect",{x,y,width:w,height:h,rx,fill:"none",stroke,"stroke-width":2});
  }
  function ground(y=94) { return line(15,y,85,y,dim,2); }

  svg.innerHTML = "";

  const draws = {
    bench: () => {
      const armY = L(52,36,t);
      svg.append(
        rect(8,62,84,6,3), // banco
        head(50,44),
        line(50,53,50,68), line(50,68,35,80), line(50,68,65,80),
        line(20,armY,80,armY,acc,3),
        line(50,armY+5,20,armY), line(50,armY+5,80,armY),
        circle(20,armY,4), circle(80,armY,4)
      );
    },
    fly: () => {
      const spread = L(18,38,t);
      svg.append(
        rect(8,62,84,6,3),
        head(50,44),
        line(50,53,50,68), line(50,68,35,80), line(50,68,65,80),
        line(50,52,50-spread,62), line(50,52,50+spread,62),
        circle(50-spread,62,4), circle(50+spread,62,4)
      );
    },
    pulldown: () => {
      const armY = L(28,45,t);
      const sp = L(32,18,t);
      svg.append(
        line(5,8,95,8,"rgba(249,115,22,0.35)",2),
        head(50,42),
        line(50,51,50,70), line(50,70,37,94), line(50,70,63,94),
        line(50,50,50-sp,armY+5), line(50-sp,armY+5,50-sp+5,armY-6),
        line(50,50,50+sp,armY+5), line(50+sp,armY+5,50+sp-5,armY-6),
        circle(50-sp+5,armY-6,3), circle(50+sp-5,armY-6,3),
        ground()
      );
    },
    row: () => {
      const armX = L(34,48,t);
      svg.append(
        head(28,36),
        line(28,45,28,70), line(28,52,armX,60), line(armX,60,armX+10,55),
        line(28,70,14,94), line(28,70,42,94),
        line(10,94,55,94,dim,2),
        circle(armX+10,55,4),
        el("line",{x1:78,y1:57,x2:armX+12,y2:57,stroke:acc,"stroke-width":1.5,"stroke-dasharray":"4,3"}),
        circle(78,57,5,"rgba(249,115,22,0.15)")
      );
    },
    squat: () => {
      const hipY = L(52,70,t);
      const kX   = L(6,16,t);
      const kY   = L(68,80,t);
      svg.append(
        head(50,16),
        line(50,25,50,hipY),
        line(50,36,32,54), line(50,36,68,54),
        line(50,hipY,50-kX,kY), line(50,hipY,50+kX,kY),
        line(50-kX,kY,50-kX-2,95), line(50+kX,kY,50+kX+2,95),
        ground()
      );
    },
    hinge: () => {
      const ang = L(-15,-55,t) * Math.PI/180;
      const tx  = 50 + Math.sin(ang)*28;
      const ty  = 54 + Math.cos(ang)*28;
      svg.append(
        head(tx,ty-10),
        line(tx,ty,50,54),
        line(50,54,38,94), line(50,54,62,94),
        line(tx-8,ty-5,50-2,58), line(tx+8,ty-5,50+2,58),
        circle(50-2,60,4), circle(50+2,60,4),
        ground()
      );
    },
    curl: () => {
      const ang = L(0,-55,t) * Math.PI/180;
      const fx1 = 30 + Math.sin(ang)*22, fy1 = 72 - Math.cos(ang)*22;
      const fx2 = 70 - Math.sin(ang)*22, fy2 = 72 - Math.cos(ang)*22;
      svg.append(
        head(50,16),
        line(50,25,50,65), line(50,65,35,92), line(50,65,65,92),
        line(50,38,30,50), line(30,50,fx1,fy1),
        line(50,38,70,50), line(70,50,fx2,fy2),
        circle(fx1,fy1,4), circle(fx2,fy2,4),
        ground()
      );
    },
    tricep: () => {
      const handY = L(50,76,t);
      svg.append(
        head(50,16),
        line(50,25,50,65), line(50,65,35,92), line(50,65,65,92),
        line(50,36,38,50), line(38,50,38,handY),
        line(50,36,62,50), line(62,50,62,handY),
        circle(38,handY+2,4), circle(62,handY+2,4),
        line(30,10,70,10,"rgba(249,115,22,0.3)",1.5),
        ground()
      );
    },
    overhead: () => {
      const armY = L(44,16,t);
      svg.append(
        head(50,26),
        line(50,35,50,72), line(50,72,36,94), line(50,72,64,94),
        line(50,46,30,armY+10), line(50,46,70,armY+10),
        line(18,armY,82,armY,acc,3),
        circle(18,armY,4), circle(82,armY,4),
        ground()
      );
    },
    lateral: () => {
      const armH = L(58,40,t);
      svg.append(
        head(50,18),
        line(50,27,50,66), line(50,66,36,92), line(50,66,64,92),
        line(50,40,30,50), line(30,50,20,armH),
        line(50,40,70,50),
        circle(20,armH,4), circle(70,50,4),
        ground()
      );
    },
    hip: () => {
      const hipY = L(72,54,t);
      svg.append(
        rect(5,66,24,8,3),
        head(25,48),
        line(25,57,42,hipY), line(42,hipY,62,hipY),
        line(62,hipY,70,92), line(62,hipY,76,80), line(76,80,80,92),
        line(25,60,18,66),
        line(42,hipY-2,20,hipY-2,acc,3),
        ground()
      );
    },
    lunge: () => {
      const fwd  = L(0,18,t);
      const kneY = L(65,85,t);
      svg.append(
        head(50,16),
        line(50,25,50,60),
        line(50,36,35,52), line(50,36,65,52),
        line(50,60,50-fwd,kneY), line(50-fwd,kneY,50-fwd-2,95),
        line(50,60,50+fwd,kneY+5), line(50+fwd,kneY+5,50+fwd+5,95),
        ground()
      );
    },
    dip: () => {
      const armY = L(44,58,t);
      svg.append(
        line(20,30,20,92,dim,3), line(80,30,80,92,dim,3),
        head(50,16),
        line(50,25,50,62), line(50,62,36,92), line(50,62,64,92),
        line(50,38,20,armY), line(50,38,80,armY),
        circle(20,armY,4), circle(80,armY,4),
        ground()
      );
    },
    shrug: () => {
      const shY = L(36,28,t);
      svg.append(
        head(50,shY-10),
        line(50,shY,50,68), line(50,68,36,92), line(50,68,64,92),
        line(50,44,30,50), line(50,44,70,50),
        circle(30,50,4), circle(70,50,4),
        ground()
      );
    },
    calf: () => {
      const heelY = L(88,76,t);
      svg.append(
        rect(25,84,50,5,2),
        head(50,20),
        line(50,29,50,62), line(50,40,36,55), line(50,40,64,55),
        line(50,62,38,80), line(50,62,62,80),
        line(38,80,35,heelY), line(62,80,65,heelY),
        ground(90)
      );
    },
    plank: () => {
      const cY = L(60,57,t);
      svg.append(
        head(22,cY-4),
        line(22,cY+4,80,cY+4),
        line(22,cY+4,14,82), line(22,cY+4,30,82),
        line(80,cY+4,72,82), line(80,cY+4,88,82),
        circle(22,82,3),
        ground(84)
      );
    },
    rollout: () => {
      const extX = L(50,72,t);
      const extY = L(50,72,t);
      svg.append(
        head(28,42),
        line(28,51,28,70), line(28,51,extX,extY-10),
        line(28,70,20,88), line(28,70,36,88),
        circle(extX,extY,5,"rgba(249,115,22,0.15)"),
        ground(90)
      );
    },
    legrise: () => {
      const legY = L(80,50,t);
      const legX = L(80,50,t);
      svg.append(
        head(50,15),
        line(50,24,50,52), line(50,36,36,50), line(50,36,64,50),
        line(50,52,38,legY), line(50,52,62,legY),
        circle(38,legY,3), circle(62,legY,3),
        ground(88)
      );
    },
    twist: () => {
      const rotX = L(0,20,t) * (t > 0.5 ? -1 : 1);
      svg.append(
        head(50,18),
        line(50,27,50,60), line(50,60,37,90), line(50,60,63,90),
        line(50,38,30+rotX,50), line(50,38,70+rotX,50),
        circle(30+rotX,50,4), circle(70+rotX,50,4),
        ground()
      );
    },
    extension: () => {
      const legY = L(70,50,t);
      svg.append(
        rect(10,55,80,10,4),
        head(50,30),
        line(50,39,50,56),
        line(50,56,36,60), line(50,56,64,60),
        line(36,60,32,legY), line(64,60,68,legY),
        circle(32,legY,3), circle(68,legY,3)
      );
    },
    abduct: () => {
      const legX = L(0,20,t);
      svg.append(
        head(50,18),
        line(50,27,50,62), line(50,40,36,55), line(50,40,64,55),
        line(50,62,38,90), line(50,62,62+legX,85),
        circle(62+legX,85,3),
        ground()
      );
    },
    curl_leg: () => {
      const legY = L(90,60,t);
      svg.append(
        rect(8,54,84,6,3),
        head(50,28),
        line(50,37,50,55),
        line(50,45,35,55), line(50,45,65,55),
        line(38,60,38,legY-5), line(62,60,62,legY-5),
        circle(38,legY-5,4,"rgba(249,115,22,0.2)"),
        circle(62,legY-5,4,"rgba(249,115,22,0.2)")
      );
    },
  };

  (draws[tipo] || draws.curl)();
}

/* ═══════════════════════════════════════════════════
   SUPERSET / CIRCUITO
═══════════════════════════════════════════════════ */
let _ssCounter = 0;
const SS_LETTERS = 'ABCDEFGH';

function toggleSuperset(cardEl) {
  if (!cardEl) return;
  if (cardEl.closest('.superset-group')) {
    const group  = cardEl.closest('.superset-group');
    const parent = group.parentNode;
    parent.insertBefore(cardEl, group);
    const remaining = group.querySelectorAll('.exercise-card');
    if (remaining.length === 0) { group.remove(); }
    else if (remaining.length === 1) {
      parent.insertBefore(remaining[0], group);
      group.remove();
    }
    scheduleDraftSave();
    showToast('Removido do superset.', 'info', 2000);
    return;
  }
  const next = cardEl.nextElementSibling;
  if (!next || !next.classList.contains('exercise-card')) {
    showToast('Posicione dois exercícios seguidos para criar superset.', 'info', 3500);
    return;
  }
  const letter = SS_LETTERS[_ssCounter++ % SS_LETTERS.length];
  const group  = document.createElement('div');
  group.className = 'superset-group';
  const label = document.createElement('div');
  label.className = 'superset-label';
  label.textContent = `Superset ${letter} — descanse após os dois`;
  group.appendChild(label);
  cardEl.parentNode.insertBefore(group, cardEl);
  group.appendChild(cardEl);
  group.appendChild(next);
  scheduleDraftSave();
  showToast(`Superset ${letter} criado!`, 'success', 3000);
}

/* ═══════════════════════════════════════════════════
   LOG POR VOZ
═══════════════════════════════════════════════════ */
let _vozRec = null, _vozCard = null;

function iniciarLogVoz(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voz não suportada neste navegador.', 'error'); return; }
  if (_vozRec) { _vozRec.stop(); return; }
  _vozCard = btn.closest('.exercise-card');
  const r = new SR();
  r.lang = 'pt-BR'; r.interimResults = false; r.maxAlternatives = 1;
  r.onstart = () => {
    btn.classList.add('listening');
    document.getElementById('vozIndicator').classList.add('show');
  };
  r.onend = () => {
    btn.classList.remove('listening');
    document.getElementById('vozIndicator').classList.remove('show');
    _vozRec = null;
  };
  r.onresult = e => parseVozLog(e.results[0][0].transcript.toLowerCase(), _vozCard);
  r.onerror  = () => showToast('Não entendeu. Tente: "100 quilos 8 reps"', 'warning', 3500);
  _vozRec = r;
  r.start();
}

function parseVozLog(text, card) {
  if (!card) return;
  const kgM  = text.match(/(\d+(?:[.,]\d+)?)\s*(?:quilos?|kg|kilo(?:grama)?s?)/);
  const repM = text.match(/(\d+)\s*(?:reps?|repeti[cç][oõ]es?)/);
  const rpeM = text.match(/(?:rpe|esfor[cç]o)\s*(\d+)/);
  const kg   = kgM  ? kgM[1].replace(',','.')  : null;
  const reps = repM ? repM[1] : null;
  const rpe  = rpeM ? rpeM[1] : null;
  const rows = Array.from(card.querySelectorAll('.series-grid[data-row]'));
  const target = rows.find(r => {
    const ins = r.querySelectorAll('input');
    return ins.length >= 2 && !ins[0].value && !ins[1].value;
  }) || rows[rows.length - 1];
  if (!target) return;
  const ins = target.querySelectorAll('input');
  if (kg   && ins[0]) { ins[0].value = kg;   ins[0].dispatchEvent(new Event('input')); }
  if (reps && ins[1]) { ins[1].value = reps; ins[1].dispatchEvent(new Event('input')); }
  if (rpe  && ins[2]) { ins[2].value = rpe;  ins[2].dispatchEvent(new Event('input')); }
  showToast(`Voz: ${kg||'?'}kg × ${reps||'?'} reps${rpe?' · RPE '+rpe:''}`, 'success', 3000);
}

/* ═══════════════════════════════════════════════════
   VOZ NO CHAT KRONOS
═══════════════════════════════════════════════════ */
let _kronosVozRec = null;

function iniciarKronosVoz(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voz não suportada neste navegador.', 'error'); return; }
  if (_kronosVozRec) { _kronosVozRec.stop(); return; }
  const r = new SR();
  r.lang = 'pt-BR'; r.interimResults = true; r.maxAlternatives = 1;
  const input = document.getElementById('orientExpertInput');
  r.onstart = () => {
    btn.style.color = 'var(--accent)';
    btn.querySelector('i')?.setAttribute('stroke', 'var(--accent)');
  };
  r.onend = () => {
    btn.style.color = '';
    btn.querySelector('i')?.setAttribute('stroke', 'currentColor');
    _kronosVozRec = null;
    // Send if we have text
    if (input && input.value.trim()) sendOrientExpert();
  };
  r.onresult = e => {
    const transcript = e.results[e.results.length - 1][0].transcript;
    if (input) input.value = transcript;
  };
  r.onerror = () => showToast('Não entendeu. Tente falar novamente.', 'warning', 3000);
  _kronosVozRec = r;
  r.start();
}

/* ═══════════════════════════════════════════════════
   ALERTA DE HIDRATAÇÃO
═══════════════════════════════════════════════════ */
function checkHidratacaoPosTreino(state, durationMin) {
  const vol = calcVolumeTotal(state);
  const dur = parseFloat(durationMin) || 0;
  if (dur < 40 && vol < 2000) return;
  const cfg   = safeJSON('kronia_config', {});
  const peso  = parseFloat(cfg.peso) || 75;
  const litros = Math.max(2, (peso * 0.035 + Math.ceil(dur / 30) * 0.35 + (vol >= 3000 ? 0.5 : 0))).toFixed(1);
  setTimeout(() => {
    const ref = document.getElementById('sumNutricao') || document.getElementById('sumGrid');
    if (!ref || document.getElementById('sumHidrat')) return;
    const card = document.createElement('div');
    card.id = 'sumHidrat';
    card.style.cssText = 'margin-top:10px;background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(14,165,233,.06));border:1px solid rgba(59,130,246,.28);border-radius:14px;padding:12px 14px;font-size:.8rem;line-height:1.6;color:var(--text-2)';
    card.innerHTML = `<div style="font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#3b82f6;margin-bottom:6px;display:flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>HIDRATA\u00c7\u00c3O</div>Beba ao menos <b>${litros} litros hoje</b>. Inclua água com eletrólitos se o treino foi intenso.`;
    ref.insertAdjacentElement('afterend', card);
  }, 500);
}

/* ═══════════════════════════════════════════════════
   RESPIRAÇÃO / BOX BREATHING
═══════════════════════════════════════════════════ */
let _breathRunning = false, _breathTick = null;
const BREATH_SEQ = [
  { label:'INSPIRE',   dur:4, expand:true  },
  { label:'SEGURE',    dur:4, expand:true  },
  { label:'EXPIRE',    dur:4, expand:false },
  { label:'SEGURE',    dur:4, expand:false },
];

function abrirRespiracao() {
  closeSummary();
  setTimeout(() => {
    _showEl('breathingModal');
    _breathRunning = true;
    runBreathPhase(0, 1);
  }, 200);
}

function fecharRespiracao() {
  _breathRunning = false;
  clearInterval(_breathTick);
  document.getElementById('breathingModal').classList.remove('show');
  const c = document.getElementById('breathCircle');
  c.classList.remove('expand','contract');
}

function runBreathPhase(phaseIdx, cycle) {
  if (!_breathRunning) return;
  if (cycle > 5) {
    document.getElementById('breathPhase').textContent  = 'Concluído. Ótimo trabalho!';
    document.getElementById('breathCycles').textContent = '';
    setTimeout(() => { if (_breathRunning) fecharRespiracao(); }, 2800);
    return;
  }
  const phase  = BREATH_SEQ[phaseIdx];
  const circle = document.getElementById('breathCircle');
  document.getElementById('breathPhase').textContent  = phase.label;
  document.getElementById('breathCycles').textContent = `Ciclo ${cycle} de 5`;
  circle.classList.remove('expand','contract');
  requestAnimationFrame(() => {
    circle.classList.add(phase.expand ? 'expand' : 'contract');
  });
  let t = phase.dur;
  document.getElementById('breathCount').textContent = t;
  clearInterval(_breathTick);
  _breathTick = setInterval(() => {
    if (!_breathRunning) { clearInterval(_breathTick); return; }
    t--;
    document.getElementById('breathCount').textContent = t;
    if (t <= 0) {
      clearInterval(_breathTick);
      const nextPhase = (phaseIdx + 1) % BREATH_SEQ.length;
      const nextCycle = nextPhase === 0 ? cycle + 1 : cycle;
      setTimeout(() => runBreathPhase(nextPhase, nextCycle), 150);
    }
  }, 1000);
}

/* ═══════════════════════════════════════════════════
   TRACKING DE SONO
═══════════════════════════════════════════════════ */
function getSonoWarning(h) {
  const n = parseFloat(h);
  if (!n) return '';
  if (n < 6)   return ' ⚠️ CRÍTICO — abaixo de 6h compromete ganhos e recuperação';
  if (n < 7)   return ' ⚠️ ABAIXO DO IDEAL — tente chegar a 7-9h';
  if (n >= 9)  return ' ✅ Excelente recuperação';
  return ' ✅ Dentro do ideal';
}

/* ═══════════════════════════════════════════════════
   COMPARTILHAR RELATÓRIO
═══════════════════════════════════════════════════ */
function gerarTextoRelatorio(state, prs, durationMin, dateStr) {
  const vol  = Math.round(calcVolumeTotal(state));
  const sets = (state.sections||[]).reduce((a,s)=>a+(s.cards||[]).reduce((b,c)=>b+(c.values||[]).filter(v=>v.kg&&v.reps).length,0),0);
  let txt = `🏋️ KRONIA — Relatório de Treino\n📅 ${dateStr || new Date().toLocaleDateString('pt-BR')}\n`;
  txt += `⏱ Duração: ${durationMin ? durationMin+'min' : '—'} | 📊 Volume: ${vol.toLocaleString('pt-BR')}kg | Séries: ${sets}\n\n`;
  if (prs && prs.length > 0) {
    txt += `🏆 Novos Recordes:\n`;
    prs.forEach(p => { txt += `  • ${p.name}: ${p.rm}kg 1RM\n`; });
    txt += '\n';
  }
  txt += `📋 Exercícios:\n`;
  (state.sections||[]).forEach(sec => {
    (sec.cards||[]).forEach(c => {
      const setsStr = (c.values||[]).filter(v=>v.kg&&v.reps).map(v=>`${v.kg}kg×${v.reps}`).join(', ');
      if (setsStr) txt += `  • ${c.name}: ${setsStr}\n`;
    });
  });
  txt += `\n— Registrado no KRONIA`;
  return txt;
}

async function compartilharRelatorio() {
  const hist = safeJSON(STORAGE.historyKey, []);
  if (!hist.length) { showToast('Salve um treino primeiro.', 'error'); return; }
  const last = hist[0];
  const txt  = gerarTextoRelatorio(last.state, [], last.durationMin, new Date(last.createdAt).toLocaleDateString('pt-BR'));
  try {
    if (navigator.share) { await navigator.share({ title: 'KRONIA — Treino', text: txt }); return; }
  } catch {}
  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
}

/* ═══════════════════════════════════════════════════
   DESAFIOS PESSOAIS
═══════════════════════════════════════════════════ */
const DESAFIOS = [
  {
    id: 'c30_60', name: '30 treinos em 60 dias',
    desc: 'Consistência é o único segredo.', iconBg: 'linear-gradient(145deg,#f97316,#c2410c)',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    calc: h => {
      const cut = Date.now() - 60*86400000;
      return { v: Math.min(h.filter(s => new Date(s.createdAt).getTime()>cut).length, 30), t:30 };
    }
  },
  {
    id: 'cvol', name: '50 000 kg de volume total',
    desc: 'Volume acumulado de todos os treinos.', iconBg: 'linear-gradient(145deg,#3b82f6,#1d4ed8)',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
    calc: h => {
      const v = Math.round(h.reduce((a,s)=>a+calcVolumeTotal(s.state),0));
      return { v: Math.min(v,50000), t:50000 };
    }
  },
  {
    id: 'cstreak', name: '7 dias consecutivos',
    desc: 'Treine 7 dias sem parar.', iconBg: 'linear-gradient(145deg,#a855f7,#7c3aed)',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    calc: () => { const s=calcStreak(); return { v:Math.min(s,7), t:7 }; }
  },
];

function renderDesafios() {
  const el = document.getElementById('desafiosSection');
  if (!el) return;
  const hist = safeJSON(STORAGE.historyKey, []);
  el.innerHTML = DESAFIOS.map(d => {
    const {v,t} = d.calc(hist);
    const pct   = Math.min(100, Math.round((v/t)*100));
    const done  = pct >= 100;
    return `<div class="desafio-card">
      <div class="desafio-head">
        <div class="desafio-ico" style="background:${d.iconBg}">${d.svg}</div>
        <div>
          <div class="desafio-name">${d.name}${done?' ✅':''}</div>
          <div class="desafio-desc">${d.desc}</div>
        </div>
      </div>
      <div class="desafio-bar"><div class="desafio-fill" style="width:${pct}%"></div></div>
      <div class="desafio-pct">${v.toLocaleString('pt-BR')} / ${t.toLocaleString('pt-BR')} &nbsp;·&nbsp; ${pct}%</div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════
   GERADOR DE MESOCICLOS
═══════════════════════════════════════════════════ */
let _mesoConf = { dur:4, obj:'hipertrofia' }, _mesoAtual = null;

function abrirMesociclo() {
  _showEl('mesocicloSheet');
}
function fecharMesociclo() {
  document.getElementById('mesocicloSheet').classList.remove('show');
}
function selectMesoChip(el, type) {
  const id = type==='dur' ? 'mesoDurChips' : 'mesoObjChips';
  document.querySelectorAll(`#${id} .bs-chip`).forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  _mesoConf[type] = el.dataset.val;
}
const MESO_FASES = {
  hipertrofia: [{n:'Adaptação',c:'adapt',w:.25},{n:'Sobrecarga',c:'sob',w:.5},{n:'Pico',c:'pico',w:.12},{n:'Deload',c:'deload',w:.13}],
  forca:       [{n:'Adaptação',c:'adapt',w:.2}, {n:'Sobrecarga',c:'sob',w:.4},{n:'Pico',c:'pico',w:.25},{n:'Deload',c:'deload',w:.15}],
  definicao:   [{n:'Adaptação',c:'adapt',w:.2}, {n:'Sobrecarga',c:'sob',w:.6},{n:'Deload',c:'deload',w:.2}],
  performance: [{n:'Adaptação',c:'adapt',w:.15},{n:'Sobrecarga',c:'sob',w:.45},{n:'Pico',c:'pico',w:.25},{n:'Deload',c:'deload',w:.15}],
};
function gerarMesociclo() {
  const total = parseInt(_mesoConf.dur);
  const fases = MESO_FASES[_mesoConf.obj] || MESO_FASES.hipertrofia;
  const cfg   = safeJSON('kronia_config', {});
  const freq  = parseInt(cfg.freq || '3');
  const weeks = [];
  fases.forEach(f => {
    const n = Math.max(1, Math.round(f.w * total));
    for (let i=0; i<n && weeks.length<total; i++) weeks.push({n:f.n, c:f.c});
  });
  while (weeks.length < total) weeks.push({n:'Deload',c:'deload'});
  const trainDays = ({2:[1,4],3:[1,3,5],4:[1,2,4,5],5:[1,2,3,4,5],6:[1,2,3,4,5,6]})[freq]||[1,3,5];
  const dayLbls = ['D','S','T','Q','Q','S','S'];
  document.getElementById('mesoFases').innerHTML =
    [...new Set(weeks.map(w=>JSON.stringify({n:w.n,c:w.c})))].map(s=>{const p=JSON.parse(s);return `<span class="meso-badge ${p.c}">${p.n}</span>`;}).join('');
  document.getElementById('mesoGrid').innerHTML = weeks.map((w,i) =>
    `<div class="meso-week-row"><span class="meso-week-lbl">S${i+1}</span>` +
    dayLbls.map((d,di)=>{
      const isTrain = trainDays.includes(di);
      const cls = w.c==='deload' ? 'deload' : (isTrain?'treino':'rest');
      const lbl = w.c==='deload' ? (isTrain?'DLD':'') : (isTrain?'TRN':'');
      return `<div class="meso-day ${cls}">${lbl}</div>`;
    }).join('') +
    `<span class="meso-badge ${w.c}" style="font-size:.48rem;padding:2px 5px;margin-left:4px">${w.n.slice(0,3)}</span></div>`
  ).join('');
  _mesoAtual = {weeks, freq, obj:_mesoConf.obj, total, createdAt:new Date().toISOString()};
  document.getElementById('mesoVisualizacao').style.display = 'block';
}
function salvarMesociclo() {
  if (!_mesoAtual) return;
  localStorage.setItem('kronia_mesociclo', JSON.stringify(_mesoAtual));
  showToast('Mesociclo salvo!', 'success', 3000);
  fecharMesociclo();
}

/* ═══════════════════════════════════════════════════
   HOME BANNER
═══════════════════════════════════════════════════ */
function updateHomeBanner() {
  const streak = calcStreak();
  const hist   = safeJSON(STORAGE.historyKey, []);
  const msgs   = [
    { t:`${streak} dia${streak!==1?'s':''} seguidos. Não para agora.`, s:'Sequência ativa — cada treino conta.' },
    { t:'Hoje é dia de evoluir.',                                         s:'Cada série te aproxima do objetivo.' },
    { t:`${hist.length} treinos registrados.`,                           s:'Você é o que você repete. Continue.' },
    { t:'Disciplina supera motivação.',                                   s:'Apareça. Os resultados vêm depois.' },
  ];
  const m = streak > 0 ? msgs[0] : msgs[Math.floor(Date.now()/86400000) % (msgs.length-1) + 1];
  const t = document.getElementById('homeBannerTitle');
  const s = document.getElementById('homeBannerSub');
  if (t) t.textContent = m.t;
  if (s) s.textContent = m.s;
}

/* ════════════════════════════════════════════════════
   NOVAS TELAS — GERAR TREINO, TREINO GERADO, EXECUÇÃO
════════════════════════════════════════════════════ */

// ── Treino Choice Screen ─────────────────────────────

function openTreinoChoiceScreen() {
  scheduleKroniaUIUnblock('before-treino-choice-open');
  var sc = document.getElementById('treinoChoiceScreen');
  if (sc) sc.classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTreinoChoiceScreen() {
  var sc = document.getElementById('treinoChoiceScreen');
  if (sc) sc.classList.remove('show');
}

// ── Gerar Treino Wizard ─────────────────────────────

const _gtFlows = {
  completo:   ['gt-step-0','gt-kronos-ctx','gt-c-1','gt-c-2','gt-c-3','gt-c-4','gt-c-5','gt-c-6','gt-c-7'],
  especifico: ['gt-step-0','gt-kronos-ctx','gt-e-1','gt-e-2','gt-e-3','gt-e-4','gt-e-5','gt-e-6'],
  ajuste:     ['gt-step-0','gt-kronos-ctx','gt-a-1','gt-a-2','gt-a-3','gt-a-4'],
};

let _gtState = {};

function _gtResetState() {
  _gtState = {
    tipo: null, stepId: 'gt-step-0',
    obj: null, nivel: null, dias: null, tempo: null, equip: null, fase: null,
    limitacoes: ['nao'],
    musculo: null, focoSessao: null,
    problema: null, tempoProtocolo: null, direcao: null,
    kronosCtx: null,
  };
}

function openGerarTreino() {
  _gtResetState();
  document.querySelectorAll('#gerarTreinoScreen .gt-tipo-card, #gerarTreinoScreen .gt-obj-card, #gerarTreinoScreen .gt-day-btn').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('#gerarTreinoScreen .gt-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('#gerarTreinoScreen .gt-chip[data-val="nao"]').forEach(c => c.classList.add('selected'));
  _gtRenderStep('gt-step-0');
  document.getElementById('gerarTreinoScreen').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeGerarTreino() {
  document.getElementById('gerarTreinoScreen').classList.remove('show');
}

function gtBack() {
  if (_gtState.stepId === 'gt-step-0') { closeGerarTreino(); return; }
  const flow = _gtFlows[_gtState.tipo] || _gtFlows.completo;
  const idx = flow.indexOf(_gtState.stepId);
  const prevId = idx > 0 ? flow[idx - 1] : 'gt-step-0';
  _gtState.stepId = prevId;
  _gtRenderStep(prevId);
}

function gtNext() {
  const flow = _gtFlows[_gtState.tipo] || _gtFlows.completo;
  const idx = flow.indexOf(_gtState.stepId);
  if (idx < 0) return;
  if (idx === flow.length - 1) { _gtGerarComIA(); return; }
  const nextId = flow[idx + 1];
  _gtState.stepId = nextId;
  _gtRenderStep(nextId);
}

function gtSelectTipo(el) {
  document.querySelectorAll('#gt-step-0 .gt-tipo-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  _gtState.tipo = el.dataset.tipo || el.dataset.val;
  document.getElementById('gtContinuarBtn').disabled = false;
  _gtState.kronosCtx = null;
  _gtFetchKronosContext();
  setTimeout(gtNext, 300);
}

async function _gtFetchKronosContext() {
  try {
    const resp = await apiFetch(resolveAppApiUrl('/api/kronia/workout'), {
      method: 'POST',
      body: JSON.stringify({ action: 'GET_KRONOS_CONTEXT' }),
    });
    if (!resp || !resp.ok) return;
    const json = await resp.json().catch(() => null);
    if (json && json.data && Array.isArray(json.data.content) && json.data.content[0]) {
      _gtState.kronosCtx = json.data.content[0].data || null;
    }
  } catch (e) {
    // non-blocking — context is optional for display
  }
  if (_gtState.stepId === 'gt-kronos-ctx') _gtRenderKronosCtx();
}

function _gtRenderKronosCtx() {
  const wrap = document.getElementById('gtKronosStatusWrap');
  if (!wrap) return;
  const ctx = _gtState.kronosCtx;
  if (!ctx) {
    wrap.innerHTML = '<div class="gt-kronos-status-note">O KRONOS vai usar suas respostas para personalizar o treino. Complete dieta, exames e fadiga para personalização avançada.</div>';
    return;
  }
  const av = ctx.available || {};
  const level = ctx.personalizationLevel || 'base';
  const readiness = ctx.readiness || {};
  const levelLabels = { precision: 'Precisão clínica', advanced: 'Avançado', contextual: 'Contextual', base: 'Base' };
  const levelColors = { precision: '#22c55e', advanced: '#60a5fa', contextual: '#f59e0b', base: '#9ca3af' };
  const sources = [
    { key: 'profile', label: 'Perfil' },
    { key: 'diet', label: 'Dieta' },
    { key: 'labs', label: 'Exames' },
    { key: 'fatigue', label: 'Fadiga' },
    { key: 'workoutHistory', label: 'Histórico' },
    { key: 'currentProtocol', label: 'Protocolo' },
  ];
  const chips = sources.map(s => '<span class="gt-kronos-chip ' + (av[s.key] ? 'ok' : 'off') + '">' + s.label + '</span>').join('');
  const readinessLine = readiness.level && readiness.level !== 'desconhecida'
    ? '<div class="gt-kronos-readiness">Disposição: <strong>' + readiness.level + '</strong>' + (readiness.reasons && readiness.reasons[0] ? ' · ' + readiness.reasons[0] : '') + '</div>'
    : '';
  const missingLine = ctx.missingAdvancedData && ctx.missingAdvancedData.length
    ? '<div class="gt-kronos-missing">Para personalização avançada: complete ' + ctx.missingAdvancedData.join(', ') + '</div>'
    : '';
  wrap.innerHTML = '<div class="gt-kronos-level">Modo: <strong style="color:' + (levelColors[level] || '#9ca3af') + '">' + (levelLabels[level] || 'Base') + '</strong></div>' + readinessLine + '<div class="gt-kronos-chips">' + chips + '</div>' + missingLine;
}

function gtPick(field, el) {
  const step = el.closest('.gt-step');
  step.querySelectorAll('.gt-tipo-card, .gt-obj-card, .gt-day-btn').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  _gtState[field] = el.dataset.val;
  document.getElementById('gtContinuarBtn').disabled = false;
}

function gtPickChip(field, el) {
  const wrap = el.closest('.gt-chips-wrap');
  wrap.querySelectorAll('.gt-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  _gtState[field] = el.dataset.val;
  document.getElementById('gtContinuarBtn').disabled = false;
}

function gtMultiSelectChip(field, el) {
  el.classList.toggle('selected');
  const wrap = el.closest('.gt-chips-wrap');
  const selected = Array.from(wrap.querySelectorAll('.gt-chip.selected')).map(c => c.dataset.val);
  _gtState[field] = selected;
  document.getElementById('gtContinuarBtn').disabled = selected.length === 0;
}

function gtToggleChip(field, el, isExclusive) {
  const wrap = el.closest('.gt-chips-wrap');
  if (isExclusive) {
    wrap.querySelectorAll('.gt-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    _gtState[field] = ['nao'];
  } else {
    wrap.querySelector('.gt-chip[data-val="nao"]')?.classList.remove('selected');
    el.classList.toggle('selected');
    const selected = Array.from(wrap.querySelectorAll('.gt-chip.selected')).map(c => c.dataset.val);
    if (selected.length === 0) {
      wrap.querySelector('.gt-chip[data-val="nao"]')?.classList.add('selected');
      _gtState[field] = ['nao'];
    } else {
      _gtState[field] = selected;
    }
  }
}

function _gtIsComplete(stepId) {
  if (['gt-c-7','gt-e-6','gt-a-4','gt-kronos-ctx'].includes(stepId)) return true;
  const map = {
    'gt-step-0': () => !!_gtState.tipo,
    'gt-c-1': () => !!_gtState.obj,
    'gt-c-2': () => !!_gtState.nivel,
    'gt-c-3': () => !!_gtState.dias,
    'gt-c-4': () => !!_gtState.tempo,
    'gt-c-5': () => !!_gtState.equip,
    'gt-c-6': () => !!_gtState.fase,
    'gt-e-1': () => Array.isArray(_gtState.musculo) ? _gtState.musculo.length > 0 : !!_gtState.musculo,
    'gt-e-2': () => !!_gtState.focoSessao,
    'gt-e-3': () => !!_gtState.nivel,
    'gt-e-4': () => !!_gtState.equip,
    'gt-e-5': () => !!_gtState.tempo,
    'gt-a-1': () => !!_gtState.problema,
    'gt-a-2': () => !!_gtState.tempoProtocolo,
    'gt-a-3': () => !!_gtState.direcao,
  };
  return map[stepId] ? map[stepId]() : true;
}

function _gtRenderStep(stepId) {
  _gtState.stepId = stepId;
  const flow = _gtFlows[_gtState.tipo] || _gtFlows.completo;
  const idx = flow.indexOf(stepId);
  const total = flow.length;

  document.querySelectorAll('#gerarTreinoScreen .gt-step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(stepId);
  if (el) el.classList.add('active');

  const dotsWrap = document.getElementById('gtDotsWrap');
  if (dotsWrap) {
    dotsWrap.innerHTML = '';
    for (let i = 0; i < Math.min(total, 8); i++) {
      const d = document.createElement('div');
      d.className = 'gt-step-dot' + (i === idx ? ' active' : '') + (i < idx ? ' done' : '');
      dotsWrap.appendChild(d);
    }
  }

  const pct = ((idx + 1) / total) * 100;
  const bar = document.getElementById('gtProgressBar');
  if (bar) bar.style.width = pct + '%';

  const isLast = idx === total - 1;
  const btn = document.getElementById('gtContinuarBtn');
  if (btn) {
    btn.disabled = !_gtIsComplete(stepId);
    btn.innerHTML = isLast
      ? '<i data-lucide="sparkles" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"></i> Gerar com IA'
      : 'Continuar <i data-lucide="chevron-right" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.5"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  if (stepId === 'gt-kronos-ctx') _gtRenderKronosCtx();
}

function _gtBuildPayload() {
  const lims = (_gtState.limitacoes || ['nao']).filter(v => v !== 'nao');
  const limitacoesStr = lims.join(', ') || 'nao';

  if (_gtState.tipo === 'especifico') {
    return {
      objetivo: _gtState.focoSessao || 'hipertrofia',
      nivel: _gtState.nivel || 'iniciante',
      dias: '1',
      tempo: (_gtState.tempo || '45') + ' min',
      equipamentos: _gtState.equip || 'academia_completa',
      limitacoes: limitacoesStr,
      tipoGeracao: 'especifico',
      profile: {
        objetivo: _gtState.focoSessao || 'hipertrofia',
        nivel: _gtState.nivel || 'iniciante',
        dias: '1',
        equipamentos: _gtState.equip || 'academia_completa',
        persona: 'dedicado',
        restricoes: lims,
        musculosPrioritarios: Array.isArray(_gtState.musculo) ? _gtState.musculo : [_gtState.musculo].filter(Boolean),
        fase: '2',
      },
      context: { source: 'wizard_especifico', tipoGeracao: 'especifico', musculoAlvo: _gtState.musculo },
    };
  }

  if (_gtState.tipo === 'ajuste') {
    return {
      objetivo: 'ajuste',
      nivel: 'intermediario',
      dias: '4',
      tempo: '60 min',
      equipamentos: 'academia_completa',
      limitacoes: limitacoesStr,
      tipoGeracao: 'ajuste',
      profile: {
        objetivo: 'ajuste',
        nivel: 'intermediario',
        dias: '4',
        equipamentos: 'academia_completa',
        persona: 'dedicado',
        restricoes: lims,
        musculosPrioritarios: [],
        fase: '2',
      },
      context: {
        source: 'wizard_ajuste',
        tipoGeracao: 'ajuste',
        problema: _gtState.problema,
        tempoProtocolo: _gtState.tempoProtocolo,
        direcao: _gtState.direcao,
      },
    };
  }

  // completo (default)
  return {
    objetivo: _gtState.obj || 'hipertrofia',
    nivel: _gtState.nivel || 'iniciante',
    dias: String(_gtState.dias || 4),
    tempo: (_gtState.tempo || '60') + ' min',
    equipamentos: _gtState.equip || 'academia_completa',
    limitacoes: limitacoesStr,
    tipoGeracao: 'completo',
    profile: {
      objetivo: _gtState.obj || 'hipertrofia',
      nivel: _gtState.nivel || 'iniciante',
      dias: String(_gtState.dias || 4),
      equipamentos: _gtState.equip || 'academia_completa',
      persona: 'dedicado',
      restricoes: lims,
      musculosPrioritarios: [],
      fase: String(_gtState.fase || '2'),
    },
    context: { source: 'wizard_completo', tipoGeracao: 'completo' },
  };
}

async function _gtGerarComIA() {
  document.querySelectorAll('#gerarTreinoScreen .gt-step').forEach(s => s.classList.remove('active'));
  const loadingEl = document.getElementById('gt-loading');
  if (loadingEl) {
    loadingEl.innerHTML = '<div class="gt-loading-wrap"><div class="gt-loading-spinner"></div><div class="gt-loading-title">Gerando seu treino</div><div class="gt-loading-sub">A IA está montando um plano personalizado para você...</div></div>';
    loadingEl.classList.add('active');
  }
  const btn = document.getElementById('gtContinuarBtn');
  if (btn) btn.disabled = true;

  const payload = _gtBuildPayload();

  const supportsAbort = typeof AbortController === 'function';
  const controller = supportsAbort ? new AbortController() : null;
  let timeoutId = null;

  try {
    const fetchPromise = apiFetch(resolveAppApiUrl('/api/chat'), {
      method: 'POST',
      body: JSON.stringify({
        requestId: 'gt_' + Date.now(),
        messages: [{ role: 'user', content: 'Gerar treino pelo KRONOS central.' }],
        isWorkoutDirect: true,
        workoutProfile: payload,
        payload: payload,
      }),
      signal: controller ? controller.signal : undefined,
    });

    let resp;
    if (supportsAbort) {
      const timeoutPromise = new Promise(function(_, reject) {
        timeoutId = setTimeout(function() {
          try { controller.abort(); } catch (_) {}
          reject(new Error('Tempo limite excedido.'));
        }, 15000);
      });
      resp = await Promise.race([fetchPromise, timeoutPromise]);
    } else {
      resp = await fetchPromise;
    }

    const data = await parseWorkoutApiJsonSafely(resp);

    if (data && data.error === 'INVALID_JSON') {
      _gtShowGenError('Erro ao processar resposta. Tente novamente.');
      return;
    }

    const renderModel = extractWorkoutRenderModel(data);

    if (!resp.ok || !renderModel || !renderModel.plan || !Array.isArray(renderModel.plan.treinos) || renderModel.plan.treinos.length === 0) {
      _gtShowGenError('Não foi possível gerar o treino. Tente novamente.');
      return;
    }

    closeGerarTreino();
    applyAIWorkout({
      treino: {
        grupos: renderModel.plan.treinos.map(function(t) {
          return { nome: String(t.nome || ''), exercicios: Array.isArray(t.exercicios) ? t.exercicios : [] };
        }),
      }
    });
  } catch (e) {
    _gtShowGenError('Tempo esgotado. Verifique sua conexão e tente novamente.');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    const btnFinal = document.getElementById('gtContinuarBtn');
    if (btnFinal) btnFinal.disabled = false;
  }
}

function _gtShowGenError(msg) {
  const loadingEl = document.getElementById('gt-loading');
  if (loadingEl) {
    loadingEl.innerHTML = '<div class="gt-loading-wrap"><div style="font-size:2.5rem;margin-bottom:8px">⚠️</div><div class="gt-loading-title">Ops!</div><div class="gt-loading-sub">' + msg + '</div><button class="gt-continuar-btn" style="margin-top:24px;opacity:1" onclick="openGerarTreino()">Tentar novamente</button></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// compat shims for old callers
function gtSelectObj(el)  { gtPick('obj',  el); }
function gtSelectDays(el) { gtPick('dias', el); }

// ── KRONOS Workout Entry — ponto de entrada único ─────────────

window.openKronosWorkoutEntry = function() {
  try {
    navTo('treino');
    if (typeof openGerarTreino === 'function') {
      openGerarTreino();
      return true;
    }
    // fallback: tenta ativar o elemento direto
    var screen = document.getElementById('gerarTreinoScreen');
    if (screen) { screen.classList.add('show'); return true; }
    console.error('[KRONOS_WORKOUT] gerarTreinoScreen não encontrado.');
    return false;
  } catch (err) {
    console.error('[KRONOS_WORKOUT] Erro ao abrir novo fluxo:', err);
    return false;
  }
};

window.startKronosWorkoutMode = function(mode) {
  try {
    var allowed = ['full_workout', 'specific_workout', 'protocol_adjustment'];
    var modeToTipo = { full_workout: 'completo', specific_workout: 'especifico', protocol_adjustment: 'ajuste' };
    var selectedMode = allowed.includes(mode) ? mode : 'full_workout';
    var tipo = modeToTipo[selectedMode] || 'completo';

    window.kronosWorkoutState = window.kronosWorkoutState || {};
    window.kronosWorkoutState.mode = selectedMode;
    window.kronosWorkoutState.step = 0;
    window.kronosWorkoutState.answers = {};

    try {
      localStorage.setItem('kronos_workout_mode', selectedMode);
      localStorage.setItem('kronos_workout_step', '0');
    } catch (_) {}

    _gtState.tipo = tipo;
    _gtState.kronosCtx = null;

    var card = document.querySelector('#gt-step-0 .gt-tipo-card[data-tipo="' + tipo + '"]');
    if (card) {
      document.querySelectorAll('#gt-step-0 .gt-tipo-card').forEach(function(c) { c.classList.remove('selected'); });
      card.classList.add('selected');
    }
    document.getElementById('gtContinuarBtn').disabled = false;
    _gtFetchKronosContext();
    gtNext();
    return true;
  } catch (err) {
    console.error('[KRONOS_WORKOUT] Erro ao iniciar modo:', err);
    return false;
  }
};

// Event delegation: data-kronia-open e data-kronos-workout-mode
document.addEventListener('click', function(event) {
  var entry = event.target.closest('[data-kronia-open="kronos-workout-entry"]');
  if (entry) {
    event.preventDefault();
    event.stopPropagation();
    window.openKronosWorkoutEntry && window.openKronosWorkoutEntry();
    return;
  }
  var modeCard = event.target.closest('[data-kronos-workout-mode]');
  if (modeCard && !modeCard.classList.contains('gt-tipo-card')) {
    // gt-tipo-card já tem onclick; só interceptar outros elementos com o atributo
    event.preventDefault();
    event.stopPropagation();
    window.startKronosWorkoutMode && window.startKronosWorkoutMode(modeCard.getAttribute('data-kronos-workout-mode'));
  }
});

document.addEventListener('keydown', function(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  var clickable = event.target.closest('[data-kronia-open="kronos-workout-entry"]');
  if (!clickable) return;
  event.preventDefault();
  clickable.click();
});

// Proteção: migrar estado legado de localStorage
(function() {
  try {
    var legacyScreens = ['workout-program','programa-treino','training-program','workout-config','workout-builder','programaDeTreino'];
    ['activeTab','currentScreen','selectedScreen','currentPage','lastRoute','currentRoute','activeScreen'].forEach(function(key) {
      var val = localStorage.getItem(key);
      if (val && legacyScreens.includes(val)) localStorage.setItem(key, 'kronos-workout-entry');
    });
  } catch (_) {}
}());

// ── Treino Gerado ──────────────────────────────────
function openTreinoGerado(state) {
  const objMap = { hipertrofia:'Hipertrofia', forca:'Força', performance:'Performance' };
  const titulosMap = {
    hipertrofia: 'Força Superior',
    forca: 'Força e Potência',
    performance: 'Performance Total',
  };
  const titulo = titulosMap[state?.obj] || 'Treino Completo';
  const obj = objMap[state?.obj] || 'Hipertrofia';
  const days = state?.days || 4;
  const dur = days <= 3 ? '45 min' : days <= 4 ? '60 min' : '75 min';

  const el = id => document.getElementById(id);
  if (el('tgTreinoTitle')) el('tgTreinoTitle').textContent = titulo;
  if (el('tgTreinoObj')) el('tgTreinoObj').textContent = obj;
  if (el('tgTreinoDuration')) el('tgTreinoDuration').textContent = dur;

  document.getElementById('treinoGeradoScreen').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTreinoGerado() {
  document.getElementById('treinoGeradoScreen').classList.remove('show');
}

function iniciarTreinoGerado() {
  closeTreinoGerado();
  if (typeof iniciarTreino === 'function') {
    iniciarTreino();
  } else {
    openStartWorkoutScreen();
  }
}

// ── Execução Focada ────────────────────────────────
let _execState = { carga: 80, reps: 8, rpe: 8 };

function openExecucao(opts) {
  if (opts) {
    _execState.carga = opts.carga || 80;
    _execState.reps = opts.reps || 8;
    _execState.rpe = opts.rpe || 8;
    const nm = document.getElementById('execExerciseName');
    const mn = document.getElementById('execMuscleName');
    if (nm && opts.nome) nm.textContent = opts.nome;
    if (mn && opts.musculo) mn.textContent = opts.musculo;
  }
  _execRender();
  document.getElementById('execucaoScreen').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeExecucao() {
  document.getElementById('execucaoScreen').classList.remove('show');
}

function execAdjust(field, delta) {
  if (field === 'carga') {
    _execState.carga = Math.max(0, +(_execState.carga + delta).toFixed(1));
  } else if (field === 'reps') {
    _execState.reps = Math.max(1, _execState.reps + delta);
  } else if (field === 'rpe') {
    _execState.rpe = Math.min(10, Math.max(1, _execState.rpe + delta));
  }
  _execRender();
}

function _execRender() {
  const c = document.getElementById('execCargaVal');
  const r = document.getElementById('execRepsVal');
  const p = document.getElementById('execRpeVal');
  if (c) c.textContent = _execState.carga % 1 === 0 ? _execState.carga : _execState.carga.toFixed(1);
  if (r) r.textContent = _execState.reps;
  if (p) p.textContent = _execState.rpe;
}

function execConcluirSerie() {
  const atualEl = document.getElementById('execSerieAtual');
  const totalEl = document.getElementById('execSerieTotal');
  const atual = atualEl ? parseInt(atualEl.textContent) : 1;
  const total = totalEl ? parseInt(totalEl.textContent) : 4;
  if (atual < total) {
    if (atualEl) atualEl.textContent = atual + 1;
    const dots = document.querySelectorAll('#execucaoScreen .exec-series-dot');
    dots.forEach((d, i) => {
      d.classList.toggle('done', i < atual);
      d.classList.toggle('current', i === atual);
    });
  } else {
    closeExecucao();
  }
}

function execPularDescanso() {
  const d = document.getElementById('execDescansoVal');
  if (d) d.textContent = '00:00';
}


// ── Score Adaptativo ─────────────────────────────────
function updateScoreAdaptativo() {
  try {
    const hist = JSON.parse(localStorage.getItem('kronia_history') || '[]');
    const streak = parseInt(localStorage.getItem('kronia_streak') || '0');

    const thisWeek = hist.filter(s => {
      const d = new Date(s.date || s.timestamp || 0);
      return (Date.now() - d) / 86400000 < 7;
    });

    const rpeVals = thisWeek.flatMap(s => (s.exercises || []).flatMap(e =>
      (e.series || []).map(r => r.rpe).filter(v => v > 0)
    ));
    const avgRpe = rpeVals.length ? rpeVals.reduce((a,b) => a+b, 0) / rpeVals.length : 5;

    const score = Math.min(100, Math.max(20,
      50 + (streak * 3) + (thisWeek.length * 5) - ((avgRpe - 5) * 3)
    ));
    const scoreInt = Math.round(score);

    const numEl = document.getElementById('homeScoreNum');
    const lblEl = document.getElementById('homeScoreLabel');
    const ringEl = document.getElementById('homeScoreRing');

    if (numEl) numEl.textContent = scoreInt;
    const lbl = scoreInt >= 85 ? 'ÓTIMO' : scoreInt >= 70 ? 'BOM' : scoreInt >= 50 ? 'OK' : 'BAIXO';
    if (lblEl) lblEl.textContent = lbl;

    // animate ring: circumference 263.9, offset = 263.9 * (1 - score/100)
    if (ringEl) ringEl.style.strokeDashoffset = (263.9 * (1 - scoreInt / 100)).toFixed(1);

    // stats
    const cargaEl = document.getElementById('scoreStatCarga');
    const prontEl = document.getElementById('scoreStatProntidao');
    const fadEl   = document.getElementById('scoreStatFadiga');
    const tendEl  = document.getElementById('scoreStatTendencia');

    const cargaRec = Math.min(100, Math.round(80 + streak * 2));
    if (cargaEl) cargaEl.textContent = cargaRec + '%';
    if (prontEl) prontEl.textContent = avgRpe < 7 ? 'Alta' : avgRpe < 8.5 ? 'Média' : 'Baixa';
    if (fadEl)   fadEl.textContent   = avgRpe > 8.5 ? 'Alta' : avgRpe > 7 ? 'Média' : 'Baixa';
    if (tendEl)  tendEl.textContent  = streak >= 3 ? 'Positiva' : streak === 0 ? 'Neutra' : 'Estável';

    // KRONOS rec
    const rcTitle = document.getElementById('kronosRecTitle');
    const rcType  = document.getElementById('kronosRecType');
    if (rcTitle) {
      const workouts = ['Força Superior', 'Costas e Bíceps', 'Pernas e Glúteos', 'Ombros e Tríceps'];
      rcTitle.textContent = workouts[thisWeek.length % workouts.length];
    }
    if (rcType) rcType.textContent = 'Hipertrofia';
  } catch(e) { /* falha silenciosa */ }
}

// Chama ao abrir home
const _origOpenHome = typeof openHome === 'function' ? openHome : null;
if (typeof window !== 'undefined') {
  window.addEventListener('kronia:home-opened', updateScoreAdaptativo);
  // também atualiza na carga inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateScoreAdaptativo);
  } else {
    setTimeout(updateScoreAdaptativo, 500);
  }
}

// ── Garante que as novas telas fecham quando navTo é chamado ──
(function() {
  const _origNavTo = navTo;
  window.navTo = function(tab) {
    // fecha telas novas ao navegar
    document.getElementById('gerarTreinoScreen')?.classList.remove('show');
    document.getElementById('treinoGeradoScreen')?.classList.remove('show');
    document.getElementById('execucaoScreen')?.classList.remove('show');
    document.getElementById('startWorkoutScreen')?.classList.remove('show');
    if (tab === 'kronos') {
      document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
      document.getElementById('nav-kronos')?.classList.add('active');
      return; // openAI é chamado no onclick do botão
    }
    _origNavTo(tab);
  };
})();

/* ════════════════════════════════════════════════════
   BIOMARCADORES
════════════════════════════════════════════════════ */
function openBiomarcadores() {
  document.getElementById('biomarcadoresScreen').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function closeBiomarcadores() {
  document.getElementById('biomarcadoresScreen').classList.remove('show');
}
function bioSetTab(tab, btn) {
  document.querySelectorAll('.bio-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const tabs = { geral: 'bioGeralContent', exames: 'bioExamesContent', historico: 'bioHistoricoContent' };
  Object.entries(tabs).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = k === tab ? '' : 'none';
  });
}

/* ════════════════════════════════════════════════════
   PERFIL HERO — populate dinâmico
════════════════════════════════════════════════════ */
function _updatePerfilHero() {
  try {
    const nome = localStorage.getItem('kronia_nome') || localStorage.getItem('userName') || 'ATLETA';
    const streak = parseInt(localStorage.getItem('kronia_streak') || '0');
    const hist = JSON.parse(localStorage.getItem('kronia_history') || '[]');
    const plan = localStorage.getItem('kronia_plan') || 'free';
    const planLabel = plan === 'ultra' ? 'Membro ULTRA' : plan === 'pro' ? 'Membro PRO' : 'Membro FREE';

    const heroNome = document.getElementById('perfilHeroNome');
    const heroAvatar = document.getElementById('perfilHeroAvatar');
    const heroBadge = document.getElementById('perfilHeroPlanBadge');
    const heroScore = document.getElementById('perfilHeroScore');
    const heroPlanVal = document.getElementById('perfilHeroPlanVal');
    const heroSince = document.getElementById('perfilHeroSince');
    const signInRow = document.getElementById('perfilSignInRow');
    const signOutRow = document.getElementById('perfilSignOutRow');

    if (heroNome) heroNome.textContent = nome.toUpperCase();
    if (heroAvatar) {
      const img = localStorage.getItem('kronia_avatar');
      if (img) {
        heroAvatar.style.backgroundImage = 'url(' + img + ')';
        heroAvatar.textContent = '';
      } else {
        heroAvatar.textContent = nome.charAt(0).toUpperCase();
      }
    }
    if (heroBadge) heroBadge.lastChild.textContent = ' ' + planLabel;
    if (heroPlanVal) heroPlanVal.textContent = plan.toUpperCase();

    // performance score: re-use same formula as home
    const thisWeek = hist.filter(s => (Date.now() - new Date(s.date || s.timestamp || 0)) / 86400000 < 7);
    const rpeVals = thisWeek.flatMap(s => (s.exercises || []).flatMap(e => (e.series || []).map(r => r.rpe).filter(v => v > 0)));
    const avgRpe = rpeVals.length ? rpeVals.reduce((a,b) => a+b, 0) / rpeVals.length : 5;
    const score = Math.min(100, Math.max(20, 50 + (streak * 3) + (thisWeek.length * 5) - ((avgRpe - 5) * 3)));
    if (heroScore) heroScore.textContent = Math.round(score);

    // data de cadastro
    const since = localStorage.getItem('kronia_since');
    if (heroSince && since) {
      const d = new Date(since);
      heroSince.textContent = 'Desde ' + d.toLocaleDateString('pt-BR', { month:'short', year:'numeric' });
    }

    // auth state
    const isLogged = !!localStorage.getItem('sb-user') || !!localStorage.getItem('kronia_uid');
    if (signInRow) signInRow.style.display = isLogged ? 'none' : '';
    if (signOutRow) signOutRow.style.display = isLogged ? '' : 'none';

    // também preenche IDs que o JS existente espera
    const legacyNome = document.getElementById('perfilContaNome');
    const legacyEmail = document.getElementById('perfilContaEmail');
    if (legacyNome) legacyNome.textContent = nome;
  } catch(e) { /* falha silenciosa */ }
}

// Aplica no openPerfil existente via observer
(function() {
  const _origOpen = typeof openPerfil === 'function' ? openPerfil : null;
  if (_origOpen) {
    window.openPerfil = function() {
      _origOpen();
      setTimeout(_updatePerfilHero, 120);
    };
  }
  // também na carga inicial
  setTimeout(_updatePerfilHero, 800);
})();

// fecha biomarcadores ao navegar
(function() {
  const _patchedNavTo = window.navTo;
  window.navTo = function(tab) {
    document.getElementById('biomarcadoresScreen')?.classList.remove('show');
    _patchedNavTo(tab);
  };
})();

/* ══════════════════════════════════════════════════════════════
   ANAMNESE — Wizard de perfil nutricional (Kleber, 2026-06)
   Princípio: geração resiliente — nunca bloqueia por falta de dado.
   Salva em nutrition_profiles via window._sb (Supabase JS client).
══════════════════════════════════════════════════════════════ */

var _anamneseState = null;
var _anamneseTotalSteps = 7; // steps 0-6

var _AN_STEP_LABELS = [
  'Confirmar dados',
  '1 de 6 — Rotina',
  '2 de 6 — Restrições',
  '3 de 6 — Preferências',
  '4 de 6 — Hábitos',
  '5 de 6 — Histórico',
  '6 de 6 — Observações'
];

function _anDefaultState() {
  return {
    // Bloco 0
    sexo: null, idade: null, peso_kg: null, altura_cm: null,
    objetivo: null, nivel_atividade: null,
    // Bloco 1
    refeicoes_por_dia: null, faz_jejum: null, tipo_jejum: null,
    come_fora_frequencia: null, quem_cozinha: null,
    // Bloco 2
    restricoes_alimentares: [], condicoes_saude: [],
    medicamentos_continuos: null,
    // Bloco 3
    alimentos_nao_abre_mao: null, alimentos_nao_come: null,
    orcamento_alimentar: null,
    // Bloco 4
    agua_litros_dia: null, consumo_alcool: null, consumo_cafeina: null,
    // Bloco 5
    historico_dieta: null, tem_compulsao: null,
    // Bloco 6
    observacoes: null,
    // Meta
    anamnese_completa: false, anamnese_versao: 1,
    // UI
    _step: 0, _fromDiet: false
  };
}

async function openAnamnese(fromDiet) {
  _anamneseState = _anDefaultState();
  _anamneseState._fromDiet = !!fromDiet;

  var screen = document.getElementById('anamneseScreen');
  if (!screen) return;
  screen.classList.add('open');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

  // Carrega dados existentes do Supabase
  await _anLoadExistingProfile();
  _anGoToStep(0);
}

function closeAnamnese() {
  var screen = document.getElementById('anamneseScreen');
  if (screen) screen.classList.remove('open');
  _anamneseState = null;
}

async function _anLoadExistingProfile() {
  var card = document.getElementById('anConfirmCard');
  if (!card) return;
  try {
    var uid = (window._sb && window._sb.auth && (await window._sb.auth.getUser()).data.user?.id)
            || localStorage.getItem('kronia_uid');
    if (!uid) { _anShowConfirmCard(null); return; }

    var { data, error } = await window._sb.from('nutrition_profiles').select('*').eq('user_id', uid).maybeSingle();
    if (error || !data) { _anShowConfirmCard(null); return; }

    // Preenche o estado com dados existentes
    var fields = ['sexo','idade','peso_kg','altura_cm','objetivo','nivel_atividade',
      'refeicoes_por_dia','faz_jejum','tipo_jejum','come_fora_frequencia','quem_cozinha',
      'restricoes_alimentares','condicoes_saude','medicamentos_continuos',
      'alimentos_nao_abre_mao','alimentos_nao_come','orcamento_alimentar',
      'agua_litros_dia','consumo_alcool','consumo_cafeina',
      'historico_dieta','tem_compulsao','observacoes','anamnese_completa','anamnese_versao'];
    fields.forEach(function(f) {
      if (data[f] !== undefined && data[f] !== null) _anamneseState[f] = data[f];
    });
    _anShowConfirmCard(data);

    // Verifica se já tem exames
    var { data: exames } = await window._sb.from('lab_report_biomarkers').select('id').eq('user_id', uid).limit(1);
    var aviso = document.getElementById('anExamesAviso');
    if (aviso) aviso.style.display = (exames && exames.length > 0) ? 'flex' : 'none';
  } catch (e) {
    console.error('[anamnese] load error', e);
    _anShowConfirmCard(null);
  }
}

function _anShowConfirmCard(profile) {
  var card = document.getElementById('anConfirmCard');
  if (!card) return;
  var LABELS = {
    sexo: 'Sexo', idade: 'Idade', peso_kg: 'Peso', altura_cm: 'Altura',
    objetivo: 'Objetivo', nivel_atividade: 'Atividade'
  };
  var DISPLAY = {
    masculino: 'Masculino', feminino: 'Feminino',
    hipertrofia: 'Hipertrofia', emagrecimento: 'Emagrecimento',
    manutencao: 'Manutenção', recomposicao: 'Recomposição',
    sedentario: 'Sedentário', leve: 'Leve', moderado: 'Moderado',
    ativo: 'Ativo', muito_ativo: 'Muito ativo'
  };
  var keys = ['sexo', 'idade', 'peso_kg', 'altura_cm', 'objetivo', 'nivel_atividade'];
  var hasMissing = false;
  var html = keys.map(function(k) {
    var raw = profile && profile[k] != null ? profile[k] : null;
    var val = raw != null
      ? (DISPLAY[raw] || (k === 'idade' ? raw + ' anos' : k === 'peso_kg' ? raw + ' kg' : k === 'altura_cm' ? raw + ' cm' : raw))
      : null;
    if (!val) hasMissing = true;
    return '<div class="an-confirm-row">'
      + '<span class="an-confirm-key">' + LABELS[k] + '</span>'
      + '<span class="an-confirm-val' + (!val ? ' missing' : '') + '">'
      + (val || 'não informado') + '</span>'
      + '</div>';
  }).join('');

  if (profile) {
    html = '<div style="font-size:0.78rem;color:var(--text-2);margin-bottom:12px">'
      + '<strong style="color:var(--text)">' + (profile.nome || '') + '</strong> — revise e confirme'
      + '</div>' + html;
  }

  if (hasMissing) {
    html += '<button class="an-confirm-edit-btn" style="margin-top:10px;width:100%;padding:8px;border-radius:10px;background:rgba(37,99,235,0.12);border:1px solid rgba(37,99,235,0.25)" onclick="anToggle(\'anEditBasic\',true)">Preencher campos em branco</button>';
  }

  card.innerHTML = html;

  // Se tem dados completos, não mostra o form de edição; caso contrário mostra
  var editDiv = document.getElementById('anEditBasic');
  if (editDiv) editDiv.style.display = hasMissing ? 'block' : 'none';
  // Sincroniza chips de edição com o estado atual
  if (hasMissing) _anSyncEditChips();
}

function _anSyncEditChips() {
  if (!_anamneseState) return;
  ['sexo','objetivo','nivel_atividade'].forEach(function(group) {
    var val = _anamneseState[group];
    if (!val) return;
    var wrap = document.querySelector('#anEditBasic .an-chips[data-group="' + group + '"]');
    if (!wrap) return;
    wrap.querySelectorAll('.an-chip').forEach(function(chip) {
      chip.classList.toggle('selected', chip.dataset.val === val);
    });
  });
  ['idade','peso_kg','altura_cm'].forEach(function(f) {
    var el = document.getElementById('an' + f.charAt(0).toUpperCase() + f.slice(1).replace('_',''));
    if (el && _anamneseState[f]) el.value = _anamneseState[f];
  });
}

function _anGoToStep(step) {
  if (!_anamneseState) return;
  _anamneseState._step = step;

  // Atualiza steps visíveis
  for (var i = 0; i < _anamneseTotalSteps; i++) {
    var el = document.getElementById('an-step-' + i);
    if (el) el.classList.toggle('active', i === step);
  }

  // Progresso
  var pct = step === 0 ? 0 : Math.round((step / (_anamneseTotalSteps - 1)) * 100);
  var bar = document.getElementById('anProgressBar');
  if (bar) bar.style.width = pct + '%';
  var lbl = document.getElementById('anProgressLabel');
  if (lbl) lbl.textContent = _AN_STEP_LABELS[step] || '';

  // Botão prev
  var prev = document.getElementById('anamnesePrevBtn');
  if (prev) prev.style.visibility = step === 0 ? 'hidden' : 'visible';

  // Botão next
  var next = document.getElementById('anNextBtn');
  if (next) {
    var isLast = step === _anamneseTotalSteps - 1;
    next.innerHTML = isLast
      ? 'Salvar e ' + (_anamneseState._fromDiet ? 'gerar dieta' : 'concluir')
        + ' <i data-lucide="check" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"></i>'
      : 'Avançar <i data-lucide="arrow-right" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"></i>';
    next.classList.toggle('finish', isLast);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ nodes: [next] });
  }

  // Preenche resumo no último passo
  if (step === _anamneseTotalSteps - 1) _anBuildSummary();

  // Sincroniza chips visuais com estado
  _anSyncAllChips(step);

  // Scroll ao topo do body
  var body = document.getElementById('anBody');
  if (body) body.scrollTop = 0;
}

function _anSyncAllChips(step) {
  if (!_anamneseState) return;
  var stepEl = document.getElementById('an-step-' + step);
  if (!stepEl) return;
  stepEl.querySelectorAll('.an-chips').forEach(function(wrap) {
    var group = wrap.dataset.group;
    if (!group || group.startsWith('_')) return;
    var multi = wrap.dataset.multi === 'true';
    var val = _anamneseState[group];
    wrap.querySelectorAll('.an-chip').forEach(function(chip) {
      if (multi) {
        chip.classList.toggle('selected', Array.isArray(val) && val.includes(chip.dataset.val));
      } else {
        chip.classList.toggle('selected', chip.dataset.val === String(val ?? ''));
      }
    });
  });

  // Inputs de texto
  var map = {
    alimentos_nao_abre_mao: 'anAliNaoAbre',
    alimentos_nao_come: 'anAliNaoCome',
    observacoes: 'anObservacoes',
    tipo_jejum: 'anTipoJejum',
    medicamentos_continuos: 'anMedicamentos'
  };
  Object.keys(map).forEach(function(f) {
    var el = document.getElementById(map[f]);
    if (el && _anamneseState[f]) {
      el.value = _anamneseState[f];
      if (f === 'observacoes') {
        var counter = document.getElementById('anObsCount');
        if (counter) counter.textContent = el.value.length;
      }
    }
  });
}

function anamneseNext() {
  if (!_anamneseState) return;
  var step = _anamneseState._step;
  if (step === _anamneseTotalSteps - 1) {
    _anSave();
    return;
  }
  _anGoToStep(step + 1);
}

function anamnesePrev() {
  if (!_anamneseState) return;
  var step = _anamneseState._step;
  if (step > 0) _anGoToStep(step - 1);
}

function anChip(el) {
  if (!_anamneseState || !el) return;
  var wrap = el.closest('.an-chips');
  if (!wrap) return;
  var group = wrap.dataset.group;
  var multi = wrap.dataset.multi === 'true';
  var val = el.dataset.val;
  if (!group || !val) return;

  // _flag groups: só atualiza UI, não salva no estado principal
  if (group.startsWith('_')) {
    wrap.querySelectorAll('.an-chip').forEach(function(c) { c.classList.remove('selected'); });
    el.classList.add('selected');
    return;
  }

  if (multi) {
    var arr = Array.isArray(_anamneseState[group]) ? _anamneseState[group].slice() : [];
    var idx = arr.indexOf(val);
    if (idx >= 0) { arr.splice(idx, 1); el.classList.remove('selected'); }
    else { arr.push(val); el.classList.add('selected'); }
    _anamneseState[group] = arr;
  } else {
    wrap.querySelectorAll('.an-chip').forEach(function(c) { c.classList.remove('selected'); });
    el.classList.add('selected');
    _anamneseState[group] = val;
  }

  // Reação especial: compulsão frequente → mostra nota
  if (group === 'tem_compulsao') {
    var note = document.getElementById('anCompulsaoNote');
    if (note) note.style.display = (val === 'frequente') ? 'flex' : 'none';
  }
  // Faz jejum
  if (group === 'faz_jejum') {
    anToggle('anJejumOpts', val !== 'nao');
  }
}

// Chip exclusivo: ao selecionar "Nenhuma", limpa os outros do mesmo grupo
function anChipExclusive(el, group) {
  if (!_anamneseState) return;
  var wrap = el.closest('.an-chips');
  if (!wrap) return;
  wrap.querySelectorAll('.an-chip').forEach(function(c) { c.classList.remove('selected'); });
  el.classList.add('selected');
  _anamneseState[group] = [];
}

function anField(field, value) {
  if (!_anamneseState) return;
  _anamneseState[field] = value;
}

function anToggle(id, show) {
  var el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
}

function _anBuildSummary() {
  var card = document.getElementById('anSummaryCard');
  if (!card || !_anamneseState) return;
  var s = _anamneseState;
  var lines = [
    s.refeicoes_por_dia ? '<strong>' + s.refeicoes_por_dia + '</strong> refeições/dia' : null,
    s.faz_jejum && s.faz_jejum !== 'nao' ? 'Jejum: <strong>' + s.faz_jejum + (s.tipo_jejum ? ' (' + s.tipo_jejum + ')' : '') + '</strong>' : null,
    s.restricoes_alimentares && s.restricoes_alimentares.length ? 'Restrições: <strong>' + s.restricoes_alimentares.join(', ') + '</strong>' : null,
    s.condicoes_saude && s.condicoes_saude.length && !s.condicoes_saude.includes('nenhuma') ? 'Saúde: <strong>' + s.condicoes_saude.join(', ') + '</strong>' : null,
    s.historico_dieta ? 'Histórico: <strong>' + s.historico_dieta + '</strong>' : null,
    s.tem_compulsao === 'frequente' ? '<strong>⚠ Plano vai priorizar saciedade e volume</strong>' : null,
    s.orcamento_alimentar ? 'Orçamento: <strong>' + s.orcamento_alimentar + '</strong>' : null,
  ].filter(Boolean);
  card.innerHTML = lines.length
    ? '<div style="margin-bottom:6px;font-size:0.75rem;color:var(--text-2);font-weight:600">RESUMO DO SEU PERFIL</div>'
      + lines.map(function(l) { return '<div>• ' + l + '</div>'; }).join('')
    : '<div style="color:var(--text-2);font-size:0.75rem">Complete as etapas anteriores para ver o resumo.</div>';
}

async function _anSave() {
  if (!_anamneseState) return;
  var nextBtn = document.getElementById('anNextBtn');
  if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Salvando…'; }

  try {
    var uid = (window._sb && window._sb.auth && (await window._sb.auth.getUser()).data.user?.id)
            || localStorage.getItem('kronia_uid');
    if (!uid) throw new Error('Usuário não autenticado');

    var payload = {
      user_id: uid,
      anamnese_completa: true,
      anamnese_versao: (_anamneseState.anamnese_versao || 0) + 1,
      updated_at: new Date().toISOString()
    };

    // Campos básicos (sempre salvar se preenchido)
    var basicFields = ['sexo','idade','peso_kg','altura_cm','objetivo','nivel_atividade'];
    basicFields.forEach(function(f) {
      if (_anamneseState[f] != null) payload[f] = _anamneseState[f];
    });

    // Campos do wizard (salvar se preenchido)
    var wizardFields = [
      'refeicoes_por_dia','faz_jejum','tipo_jejum','come_fora_frequencia','quem_cozinha',
      'restricoes_alimentares','condicoes_saude','medicamentos_continuos',
      'alimentos_nao_abre_mao','alimentos_nao_come','orcamento_alimentar',
      'agua_litros_dia','consumo_alcool','consumo_cafeina',
      'historico_dieta','tem_compulsao'
    ];
    wizardFields.forEach(function(f) {
      if (_anamneseState[f] != null) payload[f] = _anamneseState[f];
    });

    // Observações: appenda ao existente em vez de substituir
    if (_anamneseState.observacoes) {
      var { data: existing } = await window._sb.from('nutrition_profiles')
        .select('observacoes').eq('user_id', uid).maybeSingle();
      var prev = existing && existing.observacoes ? existing.observacoes + '\n' : '';
      payload.observacoes = (prev + _anamneseState.observacoes).trim().slice(0, 1000);
    }

    // Faz jejum: converte string "16h"/"18h"/"outro" → boolean true; "nao" → false
    if (payload.faz_jejum !== undefined) {
      payload.faz_jejum = payload.faz_jejum !== 'nao';
    }

    // refeicoes_por_dia: garante número
    if (payload.refeicoes_por_dia) {
      payload.refeicoes_por_dia = parseInt(payload.refeicoes_por_dia, 10) || 4;
    }

    var { error } = await window._sb.from('nutrition_profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) console.error('[anamnese] save error', error.message, '— continuando com dados locais');

    // Salva estado local também
    try { localStorage.setItem('kronia_anamnese_v1', JSON.stringify(payload)); } catch (_) {}

    if (typeof showToast === 'function') showToast('Perfil nutricional salvo!', 'success', 2500);
    closeAnamnese();

    // Se veio do diet flow, inicia geração da dieta
    if (_anamneseState && _anamneseState._fromDiet) {
      setTimeout(function() {
        if (window.KroniaDiet && typeof window.KroniaDiet.generate === 'function') {
          window.KroniaDiet.generate({ source: 'post_anamnese' });
        } else {
          openOfficialDietEntry({ source: 'post_anamnese', forceNew: true });
        }
      }, 400);
    }
  } catch (e) {
    console.error('[anamnese] save exception', e);
    if (typeof showToast === 'function') showToast('Erro ao salvar. Tente novamente.', 'error', 3000);
  } finally {
    if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Salvar'; }
  }
}

// Verifica se anamnese está completa (para gate no startAIDiet)
async function _anIsCompleted() {
  try {
    // Checa localStorage primeiro (rápido)
    var cached = localStorage.getItem('kronia_anamnese_v1');
    if (cached) {
      var obj = JSON.parse(cached);
      if (obj && obj.anamnese_completa) return true;
    }
    // Checa Supabase
    var uid = (window._sb && window._sb.auth && (await window._sb.auth.getUser()).data.user?.id)
            || localStorage.getItem('kronia_uid');
    if (!uid) return false;
    var { data } = await window._sb.from('nutrition_profiles').select('anamnese_completa').eq('user_id', uid).maybeSingle();
    return !!(data && data.anamnese_completa);
  } catch (_) { return false; }
}

/* ──────────────────────────────────────────────────
   ANAMNESE — Banner + badge UI helpers
────────────────────────────────────────────────── */

// Mostra/esconde banner na tela de dieta e atualiza badge de configurações
async function _anUpdateUIHints() {
  try {
    var done = await _anIsCompleted();
    var banner = document.getElementById('anProfileBanner');
    if (banner) banner.style.display = done ? 'none' : 'flex';
    var badge = document.getElementById('settingsAnamneseBadge');
    if (badge) badge.textContent = done ? 'Completo ✓' : 'Pendente';
  } catch (_) {}
}

/* ═══════════════════════════════════════════════════
   EXECUÇÃO GUIADA — KroniA Guided Execution Layer
   Adapter visual sobre a lógica existente.
   Preserva 100% de: onPressSetCell, calcNextSessionLoad,
   updateSuggests, checkRPEAlert, salvarTreino,
   histórico, progressão, PRs, volume.
═══════════════════════════════════════════════════ */

window._ge = { active: false, cardIdx: 0, setIdx: 0, cards: [], _repeatTimer: null };

function geGetCards() {
  // Pega apenas cards da seção ativa
  const activeSec = document.querySelector('.section.active');
  if (activeSec) {
    const cards = Array.from(activeSec.querySelectorAll('.exercise-card'));
    if (cards.length) return cards;
  }
  return Array.from(document.querySelectorAll('#container .exercise-card'));
}

function geGetCurrentCard() { return window._ge.cards[window._ge.cardIdx] || null; }

function geGetCurrentSets(card) {
  return Array.from((card || geGetCurrentCard()).querySelectorAll('.series-grid[data-row]'));
}

function geGetCurrentSetRow() {
  const card = geGetCurrentCard();
  if (!card) return null;
  return geGetCurrentSets(card)[window._ge.setIdx] || null;
}

function geShowEntryButton() {
  const btn = document.getElementById('geEntryBar');
  if (btn) btn.style.display = 'block';
  // Auto-inicia o modo guiado após gerar/carregar o treino
  // (só ativa se o overlay não estiver já aberto)
  if (!window._ge.active) setTimeout(startGuidedExecution, 400);
}

function startGuidedExecution() {
  const cards = geGetCards();
  if (!cards.length) {
    if (typeof showToast === 'function') showToast('Gere um treino antes de iniciar a execução guiada.', 'warning', 3000);
    return;
  }

  // Começa no primeiro set não concluído
  let startCardIdx = 0, startSetIdx = 0;
  outer: for (let ci = 0; ci < cards.length; ci++) {
    const sets = Array.from(cards[ci].querySelectorAll('.series-grid[data-row]'));
    for (let si = 0; si < sets.length; si++) {
      if (!sets[si].classList.contains('done')) {
        startCardIdx = ci; startSetIdx = si; break outer;
      }
    }
  }

  window._ge.active = true;
  window._ge.cards = cards;
  window._ge.cardIdx = startCardIdx;
  window._ge.setIdx = startSetIdx;

  const overlay = document.getElementById('guidedExecutionOverlay');
  if (overlay) overlay.classList.add('active');
  document.body.classList.add('ge-mode');
  if (navigator.vibrate) navigator.vibrate(20);
  geRender();
}

function exitGuidedExecution() {
  window._ge.active = false;
  geStopRepeat();
  document.getElementById('guidedExecutionOverlay')?.classList.remove('active');
  document.body.classList.remove('ge-mode');
  // Fecha timer se estiver rodando (via fecharTimer normal)
  const sheet = document.getElementById('timerSheet');
  if (sheet && sheet.classList.contains('show')) fecharTimer();
}

function geRender() {
  const card = geGetCurrentCard();
  if (!card) { exitGuidedExecution(); if (typeof showToast === 'function') showToast('Todos os exercícios concluídos! 💪 Salve o treino.', 'success', 4000); return; }

  const sets = geGetCurrentSets(card);
  const totalSets = Math.max(parseInt(card.getAttribute('data-ex-sets') || '0'), sets.length);
  const currentSetNum = window._ge.setIdx + 1;

  // Nome e info do exercício
  const name = card.querySelector('.ex-title')?.textContent || card.getAttribute('data-ex-name') || '';
  const metaEl = card.querySelector('.ex-target');
  const metaText = metaEl?.textContent || '';
  let ref = {};
  try { ref = JSON.parse(card.getAttribute('data-ex-ref') || '{}'); } catch(_) {}
  const muscle = ref.target_muscle || ref.muscle_group || '';
  const muscleLabel = muscle ? muscle.charAt(0).toUpperCase() + muscle.slice(1) : '';

  // Header
  const setLabelEl = document.getElementById('geSetLabel');
  if (setLabelEl) setLabelEl.textContent = 'Série ' + currentSetNum + ' de ' + totalSets;

  const nameEl = document.getElementById('geExerciseName');
  if (nameEl) nameEl.textContent = name;

  const muscleEl = document.getElementById('geMuscleGroup');
  if (muscleEl) {
    const metaParts = metaText.split('·');
    const setsInfo = (metaParts[0] || '').trim();
    muscleEl.innerHTML = muscleLabel
      ? muscleLabel + (setsInfo ? ' · <span class="ge-meta-info">' + setsInfo + '</span>' : '')
      : setsInfo || '';
  }

  // Progress geral
  const totalCards = window._ge.cards.length;
  let totalAllSets = 0, doneSets = 0;
  window._ge.cards.forEach((c, ci) => {
    const n = Math.max(parseInt(c.getAttribute('data-ex-sets') || '0'), geGetCurrentSets(c).length);
    totalAllSets += n;
    if (ci < window._ge.cardIdx) doneSets += n;
  });
  doneSets += window._ge.setIdx;
  const pct = totalAllSets > 0 ? Math.round((doneSets / totalAllSets) * 100) : 0;
  const progressBar = document.getElementById('geProgressBar');
  if (progressBar) progressBar.style.width = pct + '%';

  // Contador de exercício
  const exCounter = document.getElementById('geExerciseCounter');
  if (exCounter) exCounter.textContent = 'Exercício ' + (window._ge.cardIdx + 1) + ' de ' + totalCards;

  // Valores do set atual
  const row = geGetCurrentSetRow();
  if (row) {
    const inputs = row.querySelectorAll('input');
    const kg   = inputs[0]?.value !== '' ? inputs[0]?.value : (inputs[0]?.placeholder || '0');
    const reps = inputs[1]?.value !== '' ? inputs[1]?.value : (inputs[1]?.placeholder || '0');
    const rpe  = inputs[2]?.value !== '' ? inputs[2]?.value : (inputs[2]?.placeholder || '0');
    const kgEl   = document.getElementById('geKgValue');
    const repsEl = document.getElementById('geRepsValue');
    const rpeEl  = document.getElementById('geRpeValue');
    if (kgEl)   kgEl.textContent   = kg   || '0';
    if (repsEl) repsEl.textContent = reps || '0';
    if (rpeEl)  rpeEl.textContent  = rpe  || '0';
  }

  // Chips de séries
  geRenderSetsStrip(card, sets, window._ge.setIdx);

  // Sugestão da lógica existente (updateSuggests / calcNextSessionLoad)
  geRenderSuggestion(card);

  // Análise de RPE (mesma lógica de checkRPEAlert)
  geRenderAnalysis(row);

  // Esconde rest card ao mudar de série
  document.getElementById('geRestCard')?.classList.remove('active');
}

function geRenderSetsStrip(card, sets, currentIdx) {
  const strip = document.getElementById('geSetsStrip');
  if (!strip) return;
  strip.innerHTML = sets.map((row, i) => {
    const inputs = row.querySelectorAll('input');
    const kg   = inputs[0]?.value;
    const reps = inputs[1]?.value;
    const rpe  = inputs[2]?.value;
    const isDone    = row.classList.contains('done');
    const isCurrent = i === currentIdx;
    let detail = '';
    if (isDone && kg && reps) { detail = kg + 'kg×' + reps; if (rpe) detail += ' R' + rpe; }
    return '<div class="ge-set-chip' + (isDone ? ' done' : '') + (isCurrent ? ' current' : '') + '" onclick="geJumpToSet(' + i + ')">'
      + '<span class="ge-chip-label">S' + (i + 1) + '</span>'
      + (isDone ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '')
      + (detail ? '<span class="ge-chip-detail">' + detail + '</span>' : '')
      + '</div>';
  }).join('');
}

function geRenderSuggestion(card) {
  const sugEl  = card.querySelector('.card-load-suggest');
  const geCard = document.getElementById('geSuggestionCard');
  const geText = document.getElementById('geSuggestionText');
  if (!geCard || !geText) return;
  if (sugEl && sugEl.style.display !== 'none' && sugEl.innerHTML.trim()) {
    geText.innerHTML = sugEl.innerHTML;
    geCard.style.display = 'flex';
  } else {
    geCard.style.display = 'none';
  }
}

function geRenderAnalysis(row) {
  const el = document.getElementById('geAnalysisCard');
  if (!el) return;
  if (!row) { el.style.display = 'none'; return; }
  const inputs = row.querySelectorAll('input');
  const kg  = parseFloat(inputs[0]?.value || 0);
  const rpe = parseFloat(inputs[2]?.value || 0);
  const reps = parseFloat(inputs[1]?.value || 0);
  if (!rpe || !kg) { el.style.display = 'none'; return; }
  // Mesma lógica de checkRPEAlert (Zourdos et al. 2016)
  const diff = rpe - 8;
  let msg = '', cls = '';
  if (rpe >= 9) {
    const sug = Math.round(kg * (1 - diff * 0.025) * 2) / 2;
    msg = '⚠️ RPE alto. Próxima série: ' + sug + 'kg'; cls = 'warning';
  } else if (rpe >= 7 && rpe <= 8.5) {
    msg = '✓ RPE ideal. Mantenha a carga ou aumente as reps.'; cls = 'ideal';
  } else if (rpe <= 6 && reps > 0) {
    const sug = Math.round(kg * (1 - diff * 0.025) * 2) / 2;
    msg = '💡 RPE baixo. Pode subir para ' + sug + 'kg.'; cls = 'info';
  }
  if (msg) { el.innerHTML = '<span class="ge-analysis-msg ' + cls + '">' + msg + '</span>'; el.style.display = 'block'; }
  else el.style.display = 'none';
}

function geJumpToSet(setIdx) {
  const sets = geGetCurrentSets(geGetCurrentCard());
  if (setIdx >= 0 && setIdx < sets.length) { window._ge.setIdx = setIdx; geRender(); }
}

function geUpdateField(field, delta) {
  const row = geGetCurrentSetRow();
  if (!row) return;
  const inputs = row.querySelectorAll('input');
  let input, step, min, max;
  if      (field === 'kg')   { input = inputs[0]; step = 2.5; min = 0;   max = 500; }
  else if (field === 'reps') { input = inputs[1]; step = 1;   min = 1;   max = 100; }
  else if (field === 'rpe')  { input = inputs[2]; step = 0.5; min = 0;   max = 10;  }
  if (!input) return;
  const cur  = parseFloat(input.value !== '' ? input.value : (input.placeholder || '0')) || 0;
  const next = parseFloat(Math.min(max, Math.max(min, cur + delta * step)).toFixed(1));
  input.value = String(next);
  input.classList.remove('ghost');
  // Dispara eventos reais: updateSuggests, checkRPEAlert, atualizarBtnConfirm, scheduleDraftSave
  input.dispatchEvent(new Event('input', { bubbles: true }));
  // Atualiza display guiado imediatamente
  const dispId = field === 'kg' ? 'geKgValue' : field === 'reps' ? 'geRepsValue' : 'geRpeValue';
  const dispEl = document.getElementById(dispId);
  if (dispEl) dispEl.textContent = next;
  // Atualiza sugestão e análise com pequeno delay (aguarda updateSuggests processar)
  const card = geGetCurrentCard();
  if (card) setTimeout(() => { geRenderSuggestion(card); geRenderAnalysis(geGetCurrentSetRow()); }, 60);
}

// Long-press para +/- contínuo
let _geRepeatTimer = null, _geRepeatInterval = null;
function geStartRepeat(field, dir) {
  geUpdateField(field, dir);
  _geRepeatTimer = setTimeout(() => {
    _geRepeatInterval = setInterval(() => geUpdateField(field, dir), 120);
  }, 400);
}
function geStopRepeat() {
  clearTimeout(_geRepeatTimer); clearInterval(_geRepeatInterval);
  _geRepeatTimer = null; _geRepeatInterval = null;
}

async function geCompleteSet() {
  const row = geGetCurrentSetRow();
  if (!row) return;
  if (row.classList.contains('done')) { geAdvanceAfterRest(); return; }
  const inputs = row.querySelectorAll('input');
  const kg   = parseFloat(inputs[0]?.value || 0);
  const reps = parseFloat(inputs[1]?.value || 0);
  if (!kg && !reps) {
    if (typeof showToast === 'function') showToast('Preencha pelo menos Carga ou Repetições.', 'warning', 2500);
    return;
  }
  // Chama a lógica REAL de conclusão de série (onPressSetCell)
  const setcell = row.querySelector('.setcell');
  if (setcell) await onPressSetCell(setcell);
  // Atualiza strip (o rest card já foi mostrado via abrirTimer interceptado)
  const card = geGetCurrentCard();
  if (card) geRenderSetsStrip(card, geGetCurrentSets(card), window._ge.setIdx);
}

function geSkipRest() {
  // Pula descanso: fecha timer e avança
  document.getElementById("timerSheet")?.classList.remove("show");
  document.getElementById("geRestCard")?.classList.remove("active");
  clearInterval(timerInt); isRunning = false; timeLeft = baseTime; updateT();
  if (typeof scheduleKroniaUIUnblock === 'function') scheduleKroniaUIUnblock('timer-close');
  geAdvanceAfterRest();
}

function geAdvanceAfterRest() {
  if (!window._ge.active) return;
  document.getElementById('geRestCard')?.classList.remove('active');
  const card = geGetCurrentCard();
  if (!card) return;
  const sets = geGetCurrentSets(card);
  const nextSetIdx = window._ge.setIdx + 1;
  if (nextSetIdx < sets.length) {
    window._ge.setIdx = nextSetIdx;
    geRender();
  } else {
    // Próximo exercício
    const nextCardIdx = window._ge.cardIdx + 1;
    // Atualiza lista de cards (pode ter mudado)
    window._ge.cards = geGetCards();
    if (nextCardIdx < window._ge.cards.length) {
      window._ge.cardIdx = nextCardIdx;
      window._ge.setIdx  = 0;
      geRender();
    } else {
      exitGuidedExecution();
      if (typeof showToast === 'function') showToast('Todos os exercícios concluídos! 💪 Salve o treino.', 'success', 4000);
    }
  }
}

function geSkipCurrentSet() {
  // Pula a série sem registrar (avança sem marcar como done)
  geAdvanceAfterRest();
}

function geShowExerciseInfo() {
  // Abre YouTube ou instrução do exercício atual via função existente
  const card = geGetCurrentCard();
  if (card && typeof openExerciseOnYouTube === 'function') openExerciseOnYouTube(card);
}

// Chama ao abrir a tela de dieta (navTo 'dieta') e ao abrir configurações
(function() {
  var _origNavTo = typeof navTo === 'function' ? navTo : null;
  if (!_origNavTo) return;
  window.navTo = function(tab) {
    _origNavTo.apply(this, arguments);
    if (tab === 'dieta' || tab === 'perfil') {
      setTimeout(_anUpdateUIHints, 300);
    }
  };
})();
