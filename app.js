/* ═══════════════════════════════════════════════════
   MODAL CUSTOMIZADO
═══════════════════════════════════════════════════ */
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
    modal.classList.add("show");
    function done(ok) {
      modal.classList.remove("show");
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
}

function mostrarDicaTimer(msg) {
  const el = document.getElementById("timerDica");
  if (el) el.textContent = msg || "";
}


function fecharTimer() {
  document.getElementById("timerSheet")?.classList.remove("show");
  clearInterval(timerInt); isRunning = false;
  timeLeft = baseTime; updateT();
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
async function gerarProtocolo() {
  const input = collectWorkoutGenerationInput();
  const objective = input.objetivo;
  const guard = await validateScientificGenerationGuard(
    'workout',
    objective,
    input,
    { respectedCardContext: true, respectedAnamnesisContext: false }
  );
  if (!guard.ok) {
    dlgAlert('Não consegui gerar treino com segurança para este cenário. Revise os dados e tente novamente.');
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
      gerarTreinoDoPrograma();
      return;
    }

    const renderModel = extractWorkoutRenderModel(data);

    if (!resp.ok) {
      // Erro HTTP real — exibe mensagem da API se disponível
      dlgAlert(resolveWorkoutRouteFailureMessage(data, resp.status));
      return;
    }

    if (!renderModel) {
      // Shape desconhecido — fallback local silencioso
      console.warn('[gerarProtocolo] renderModel nulo após parse, usando geração local');
      gerarTreinoDoPrograma();
      return;
    }

    if (renderModel.failSafe) {
      // API em modo failsafe (dados insuficientes) — usa geração local
      console.info('[gerarProtocolo] API em modo failsafe, usando geração local como fallback');
      gerarTreinoDoPrograma();
      return;
    }

    applyAIWorkout({
      treino: {
        grupos: renderModel.plan.treinos.map(function(treino) {
          return {
            nome: treino.nome,
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
    gerarTreinoDoPrograma();
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
    return `<div class="series-grid${(kgVal||repsVal||rpeVal)?' has-data':''}" data-row="1">
      <span class="setcell" onclick="onPressSetCell(this)">
        <span class="slabel">S${s+1}</span>
        <span class="rmmini" id="rm-${id}-${s}">RM: ${escapeHTML(rmNow ? rmNow+"kg" : "-")}</span>
      </span>
      <div class="input-box"><input type="number" inputmode="decimal" placeholder="" value="${escapeAttr(kgVal)}"  oninput="updateSuggests('${id}');atualizarBtnConfirm(this)"></div>
      <div class="input-box"><input type="number"                    placeholder="" value="${escapeAttr(repsVal)}" oninput="updateSuggests('${id}');atualizarBtnConfirm(this)"></div>
      <div class="input-box"><input type="number"                    placeholder="" value="${escapeAttr(rpeVal)}"  oninput="updateSuggests('${id}');checkRPEAlert(this);atualizarBtnConfirm(this)"></div>
      <button class="btn-confirm" onclick="onPressSetCell(this.closest('.series-grid').querySelector('.setcell'))" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
    <div class="row-suggest" id="sug-${id}-${s}"></div>`;
  }).join("");
  card.innerHTML = `
    <div class="card-header">
      <span class="ex-title" id="${id}" onclick="abrirLibParaTrocar('${id}')">${escapeHTML(displayTitle)}</span>
      <button onclick="openExerciseDetailsFromCard(this.closest('.exercise-card'))" title="Ver exercício" style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.2);border-radius:8px;padding:4px 8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;color:var(--accent);font-family:var(--font);font-size:0.68rem;font-weight:700;-webkit-tap-highlight-color:transparent;flex-shrink:0" type="button">
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
    <div class="input-box"><input type="number" inputmode="decimal" placeholder="" oninput="updateSuggests('${id}')"></div>
    <div class="input-box"><input type="number" placeholder="" oninput="updateSuggests('${id}')"></div>
    <div class="input-box"><input type="number" placeholder="" oninput="updateSuggests('${id}');checkRPEAlert(this)"></div>`;
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
        if (guideBtn) guideBtn.setAttribute("onclick", "openExerciseDetailsFromCard(this.closest('.exercise-card'))");
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
function serializeCurrentState() {
  const freq = document.getElementById("freq")?.value || "3";
  const obj  = document.getElementById("obj")?.value  || "hipertrofia";
  const pills = Array.from(document.querySelectorAll("#nav .pill:not(.add-pill)")).map((p,i) => ({ idx:i, label: p.textContent.replace("×","").trim() }));
  const sections = Array.from(document.querySelectorAll("#container .section")).map((sec, secIdx) => {
    const treinoKey = sec.getAttribute("data-treino-key") || pills[secIdx]?.label || `Treino ${secIdx+1}`;
    const cards = Array.from(sec.querySelectorAll(".exercise-card")).map((card, cardIdx) => {
      const rows = Array.from(card.querySelectorAll(".series-grid")).filter(r => r.querySelectorAll("input").length===3);
      const values = rows.map(r => {
        const i = r.querySelectorAll("input");
        const kg=i[0].value, reps=i[1].value, rpe=i[2].value;
        const rm = roundRM(calcRM(kg,reps));
        return { kg, reps, rpe, rm: rm ? rm : "" };
      });
      const rawName = card.querySelector(".ex-title")?.textContent || "";
      const cleanName = getExerciseCardTitle({ display_name: rawName, name: rawName }, cardIdx);
      let parsedRef = null;
      try { parsedRef = JSON.parse(card.getAttribute("data-ex-ref") || "null"); } catch {}
      const exerciseRef = ensureExerciseRef(parsedRef || { display_name: cleanName, normalized_lookup_key: card.getAttribute("data-ex-lookup-key") || normalizeExerciseLookupKey(cleanName) }, cleanName, "serialized_state");
      return { name: cleanName, nome: cleanName, display_name: cleanName, exerciseRef, sets: values.length, meta: card.querySelector(".ex-target")?.textContent||"", values };
    });
    return { treinoKey, cards };
  });
  return { v:3, savedAt: new Date().toISOString(), freq, obj, activeIdx: getActiveIdx(), pills, sections };
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
  return true;
}
function clearAllInputsToGhost() {
  document.querySelectorAll(".exercise-card").forEach(card => {
    Array.from(card.querySelectorAll(".series-grid")).filter(r => r.querySelectorAll("input").length===3)
      .forEach(r => r.querySelectorAll("input").forEach(inp => inp.value = ""));
  });
  scheduleDraftSave();
}

/* ═══════════════════════════════════════════════════
   SALVAR SESSÃO
═══════════════════════════════════════════════════ */
async function salvarTreino() {
  try {
    const peso = await dlgPrompt("Peso corporal atual (kg)?", "number");
    const st   = serializeCurrentState();
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
  } catch { showToast("Erro ao salvar. Memória cheia?", "error"); }
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
    toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(20px);
      background:var(--card);border:1px solid var(--border);color:var(--text);
      padding:12px 20px;border-radius:24px;font-size:0.85rem;font-weight:600;
      box-shadow:var(--shadow-lg);z-index:9998;opacity:0;transition:opacity .25s,transform .25s;
      white-space:nowrap;max-width:90vw;text-align:center;`;
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
  document.querySelectorAll(".series-grid").forEach(r => {
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
  // Limpar análise anterior e rodar nova
  const aiSection = document.getElementById("aiCoachSummary");
  if (aiSection) aiSection.style.display = "none";
  runAICoachPostWorkout(state, prs, durationMin);
}
function closeSummary() { document.getElementById("summaryModal")?.classList.remove("show"); }

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
  const requestPromise = apiFetch(resolveAppApiUrl("/api/kronia/workout"), {
    method: "POST",
    body: JSON.stringify({
      action: "GENERATE_WORKOUT",
      requestId: "workout_" + Date.now(),
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

function gerarTreinoDoPrograma() {
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
  dlgAlert(msg);
}

function openConfig(context) {
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
  document.getElementById("configSheet").classList.add("show");
}
function closeConfig() { document.getElementById("configSheet").classList.remove("show"); }
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
  const ob = document.getElementById("onboarding");
  if (ob) { ob.style.display = "none"; ob.classList.remove("show"); }
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
- Endocrinologista: dúvidas hormonais, uso de EAAs`;
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

function navTo(tab) {
  const pt = document.getElementById("posTreinoSection");
  if (pt) pt.style.display = tab === "treino" ? "block" : "none";
  document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('nav-' + tab);
  if (el) el.classList.add('active');
  syncMainScrollArea();
}

function openLabsUploadScreen(context) {
  openLabsScreen();
}

/* ─── Tela Dedicada de Exames ───────────────────────────── */

var _labsScreenInited = false;

function openLabsScreen() {
  try { closeAI?.(); } catch (_) {}
  try { closeOrientacao?.(); } catch (_) {}
  try { schedulePendingConversationIntentConsumption('kronia_action_labs'); } catch (_) {}
  document.getElementById('labsScreen').classList.add('show');
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
  document.getElementById('labsScreen').classList.remove('show');
  document.body.classList.remove('overlay-open');
  var footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
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
  var ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  var EXT_MAP = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
  var ext = (file.name || '').split('.').pop().toLowerCase();
  var mime = ALLOWED_TYPES.includes(file.type) ? file.type : (EXT_MAP[ext] || file.type);

  if (!ALLOWED_TYPES.includes(mime)) {
    setStatus('Formato inválido. Use PDF, JPEG ou PNG.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setStatus('Arquivo muito grande. Máximo 10 MB.', 'error');
    return;
  }

  setStatus('Enviando exame…', 'loading');
  if (resultEl) resultEl.innerHTML = '';

  try {
    var formData = new FormData();
    // Corrige MIME type para o servidor se necessário
    var uploadFile = mime !== file.type ? new File([file], file.name, { type: mime }) : file;
    formData.append('file', uploadFile);

    var headers = await (typeof getAuthHeaders === 'function' ? getAuthHeaders() : Promise.resolve({}));
    delete headers['Content-Type'];

    var resp = await fetch(resolveAppApiUrl('/api/kronia/labs/upload'), { method: 'POST', headers, body: formData });
    var payload = await resp.json().catch(function() { return null; });

    if (!resp.ok || !payload || !payload.ok) {
      setStatus(payload?.error || payload?.message || 'Erro ao processar o exame.', 'error');
      return;
    }

    setStatus('Exame enviado! Processando biomarcadores…', 'success');
    renderLabsResult(payload, resultEl);
    setTimeout(function() { loadLabsScreenHistory(true); }, 2000);
  } catch (err) {
    console.error('[labs-upload] erro:', err);
    setStatus('Falha na conexão. Verifique sua internet e tente novamente.', 'error');
  } finally {
    var fi = document.getElementById('labsFile');
    if (fi) fi.value = '';
  }
}

async function loadLabsScreenHistory(forceRefresh) {
  var container = document.getElementById('labsHistoryContainer');
  var bioContainer = document.getElementById('labsBiomarkersContainer');
  if (!container) return;

  if (!forceRefresh && _labsHistoryCache) {
    renderLabReportHistory(_labsHistoryCache, container, null);
    _renderLabsBiomarkers(_labsHistoryCache, bioContainer);
    return;
  }

  container.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:12px 0">Carregando…</div>';

  try {
    var headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    var resp = await fetch(resolveAppApiUrl('/api/kronia/labs/reports?limit=10'), { headers });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var payload = await resp.json();
    if (!payload.ok) throw new Error(payload.error || 'response not ok');
    _labsHistoryCache = payload.reports || [];
    renderLabReportHistory(_labsHistoryCache, container, null);
    _renderLabsBiomarkers(_labsHistoryCache, bioContainer);
  } catch (err) {
    console.warn('[labs-history] erro:', err);
    container.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:12px 0">Não foi possível carregar o histórico.</div>';
  }
}

function _renderLabsBiomarkers(reports, container) {
  if (!container) return;
  var report = (reports || []).find(function(r) { return Array.isArray(r.biomarkers) && r.biomarkers.length > 0; });
  if (!report) {
    container.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:12px 0">Nenhum biomarcador extraído ainda. Envie um exame acima.</div>';
    return;
  }

  var LABELS = {
    glucose: 'Glicose', hba1c: 'HbA1c', creatinine: 'Creatinina', potassium: 'Potássio',
    sodium: 'Sódio', cholesterol_total: 'Colesterol Total', hdl: 'HDL', ldl: 'LDL',
    triglycerides: 'Triglicerídeos', hemoglobin: 'Hemoglobina', ferritin: 'Ferritina',
    vitamin_d: 'Vitamina D', tsh: 'TSH', t4: 'T4 Livre', uric_acid: 'Ácido Úrico',
    alt: 'ALT (TGP)', ast: 'AST (TGO)', urea: 'Ureia',
  };
  var FLAG_COLOR = { high: '#ef4444', low: '#f59e0b', normal: '#10b981' };

  var date = report.createdAt ? new Date(report.createdAt).toLocaleDateString('pt-BR') : '—';
  var rows = report.biomarkers.map(function(b) {
    var key = b.marker_key || '';
    var label = LABELS[key] || b.marker_name || key;
    var val = b.value_numeric != null ? b.value_numeric : (b.value_text || '—');
    var unit = b.unit ? ' ' + b.unit : '';
    var color = FLAG_COLOR[b.flag] || 'var(--text)';
    var ref = (b.reference_min != null || b.reference_max != null)
      ? '<span style="font-size:0.65rem;color:var(--muted);font-weight:400"> (' + (b.reference_min != null ? b.reference_min : '') + '–' + (b.reference_max != null ? b.reference_max : '') + (b.unit ? ' ' + b.unit : '') + ')</span>'
      : '';
    return '<div class="labs-bm-row"><span class="labs-bm-label">' + escapeHTML(String(label)) + '</span>'
      + '<span class="labs-bm-val" style="color:' + color + '">' + escapeHTML(String(val) + unit) + ref + '</span></div>';
  }).join('');

  container.innerHTML =
    '<div class="labs-bm-header"><span class="labs-bm-date">Exame de ' + escapeHTML(date) + '</span>'
    + '<span class="labs-bm-status">' + escapeHTML(String(report.status || '')) + '</span></div>'
    + '<div class="labs-bm-list">' + rows + '</div>';
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
      '<div class="labs-result-confidence">Status: ' + escapeHTML(String(payload.status || 'processing')) + '</div>' +
      (biomarkers ? '<div class="labs-result-biomarkers">' + biomarkers + '</div>' : '') +
    '</div>';
}

var _labsHistoryCache = null;

function renderLabReportHistory(reports, container, emptyEl) {
  if (!container) return;
  if (!reports || reports.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;text-align:center;padding:12px 0" id="perfilLabsHistoryEmpty">Nenhum exame enviado ainda.</div>';
    return;
  }

  const BIOMARKER_LABELS = {
    glucose: 'Glicose', hba1c: 'HbA1c', creatinine: 'Creatinina',
    potassium: 'Potássio', sodium: 'Sódio', cholesterol_total: 'Colesterol Total',
    hdl: 'HDL', ldl: 'LDL', triglycerides: 'Triglicerídeos',
  };

  const STATUS_LABELS = { analyzed: '✅ Analisado', extracted: '🧪 Extraído', processing: '⏳ Processando', uploaded: '📤 Enviado', needs_review: '🕵️ Revisão', failed: '❌ Falhou', parsed: '✅ Processado', pending: '⏳ Aguardando' };

  container.innerHTML = reports.map(function(r) {
    var date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : '—';
    var statusKey = r.status || r.parseStatus;
    var statusLabel = STATUS_LABELS[statusKey] || statusKey || '—';
    var fileName = r.fileName ? escapeHTML(r.fileName.replace(/^\d+-/, '')) : 'Exame';

    var biomarkersHtml = '';
    if (Array.isArray(r.biomarkers) && r.biomarkers.length) {
      var items = r.biomarkers.slice(0, 8).map(function(b) {
        var key = b.marker_key || b.marker_name || '';
        var val = b.value_numeric != null ? b.value_numeric : b.value_text;
        return '<span class="labs-hist-bm"><span class="labs-hist-bm-key">' + escapeHTML(BIOMARKER_LABELS[key] || key) + '</span><span class="labs-hist-bm-val">' + escapeHTML(String(val || '—')) + '</span></span>';
      });
      if (items.length) biomarkersHtml = '<div class="labs-hist-bms">' + items.join('') + '</div>';
    }

    var flagsHtml = '';
    if (r.clinicalFlags && r.clinicalFlags.length) {
      flagsHtml = '<div class="labs-hist-flags">' + r.clinicalFlags.map(function(f) { return '<span class="labs-hist-flag">' + escapeHTML(f) + '</span>'; }).join('') + '</div>';
    }

    return '<div class="labs-hist-card">' +
      '<div class="labs-hist-header">' +
        '<span class="labs-hist-name">' + fileName + '</span>' +
        '<span class="labs-hist-meta">' + date + ' · ' + statusLabel + (r.confidence ? ' · ' + Math.round(r.confidence * 100) + '%' : '') + '</span>' +
      '</div>' +
      (biomarkersHtml || '') +
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
  setTimeout(() => { navTo("programa"); openConfig(); }, 220);
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
    addAIMessage("assistant", `Olá! Sou o **KRONOS**, seu personal trainer com IA. ${_ico('dumbbell', 16)}\n\nAnalisei seu histórico e estou pronto para te ajudar. O que vamos fazer hoje?`);
    const container = document.getElementById("aiMessages");
    const sug = document.createElement("div");
    sug.id = "aiSuggestions";
    sug.style.cssText = "display:flex;flex-direction:column;gap:8px;padding-left:38px;";
    sug.innerHTML = `
      <button class="ai-suggest-btn" onclick="aiQuick('analise');document.getElementById('aiSuggestions')?.remove()">${_ico('bar-chart-3', 16)} Analisar meu treino de hoje</button>
      <button class="ai-suggest-btn" onclick="aiQuick('gerar');document.getElementById('aiSuggestions')?.remove()">${_ico('zap', 16)} Gerar treino para hoje</button>
      <button class="ai-suggest-btn" onclick="aiQuick('platô');document.getElementById('aiSuggestions')?.remove()">${_ico('trending-down', 16)} Estou em platô, o que fazer?</button>
      <button class="ai-suggest-btn" onclick="aiQuick('dica');document.getElementById('aiSuggestions')?.remove()">💡 Me dá uma dica de hoje</button>
    `;
    container.appendChild(sug);
  }
  setTimeout(() => document.getElementById("aiInput")?.focus(), 300);
}

function closeAI() {
  document.getElementById("aiModal").style.display = "none";
  document.getElementById("aiModal").classList.remove("show");
}

function clearAIChat() {
  _aiHistory = [];
  document.getElementById("aiMessages").innerHTML = "";
  addAIMessage("assistant", `Chat limpo. Como posso te ajudar? ${_ico('dumbbell', 16)}`);
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

  const div = document.createElement("div");
  div.className = `ai-msg ${role}`;
  const now = new Date().toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
  const avatarSVG = getKronosAvatarMarkup();

  if (role === "assistant") {
    if (isThinking) {
      div.id = "aiThinking";
      div.innerHTML = `${avatarSVG}<div class="ai-avatar-inner"><div class="ai-bubble thinking"><div class="ai-dots"><span></span><span></span><span></span></div></div></div>`;
    } else {
      div.innerHTML = `${avatarSVG}<div class="ai-avatar-inner"><div class="ai-bubble">${renderMarkdown(text)}</div><div class="ai-msg-time">${now}</div></div>`;
    }
  } else {
    div.innerHTML = `<div class="ai-bubble">${renderMarkdown(text)}</div><div class="ai-msg-time">${now}</div>`;
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
    label: intentType === 'open_training' ? 'Abrir treino' : (intentType === 'generate_diet' ? 'Gerar dieta' : 'Abrir dieta'),
    target: intentType === 'open_training' ? 'home_training_card' : 'home_diet_card',
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

  if (action === 'abrir_tela_treino_com_payload' || action === 'open_workout_flow' || buttonType === 'treino') inferredAction = 'open_training';
  if (action === 'gerar_pdf_dieta' || action === 'abrir_config_dieta') inferredAction = inferredAction || 'open_diet';
  if (action === 'open_diet_flow') inferredAction = inferredAction || 'generate_diet';
  if (buttonType === 'dieta' && shouldCreateButton) inferredAction = inferredAction || 'generate_diet';
  if (buttonType === 'dieta') inferredAction = inferredAction || 'open_diet';
  if (!inferredAction && /\btreino\b/.test(messageText) && /\b(abrir|gerar|montar|criar|monte|crie)\b/.test(messageText)) {
    inferredAction = 'open_training';
    wasTextuallyInferred = true;
  }
  if (!inferredAction && /\bdieta\b/.test(messageText) && /\b(abrir|gerar|montar|criar|monte|crie)\b/.test(messageText)) {
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
    label: String(intent.label || (action === 'open_training' ? 'Abrir treino' : (action === 'generate_diet' ? 'Gerar dieta' : 'Abrir dieta'))),
    payload: sanitizeConversationIntentPayload(action, intent.payload || {}),
    meta: sanitizeCtaObject(intent.meta || {}),
    intentSource: intent.source || 'agent',
    targetModule: intent.target === 'home_training_card' ? 'programa' : 'dieta',
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
      navTo?.('programa');
      var hydratedTrainingPayload = hydrateTrainingFromConversationIntent(intent.payload || {});
      openConfig?.(Object.assign({}, hydratedTrainingPayload, { source: 'chat', fromChatIntent: true }));
      trackKroniaCta('home_card_auto_opened', 'success', { type: intent.type, target: intent.target });
      trackKroniaCta('home_card_hydrated_from_chat', 'success', { type: intent.type, hasPayload: !!Object.keys(hydratedTrainingPayload).length });
      return true;
    }
    if (intent.type === 'open_diet' || intent.type === 'generate_diet') {
      var hydratedDietPayload = hydrateDietFromConversationIntent(intent.payload || {});
      openDietaSheet?.(Object.assign({}, hydratedDietPayload, {
        source: 'chat',
        fromChatIntent: true,
        autoGenerate: intent.type === 'generate_diet',
      }));
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
  const meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  const hasFailSafeOrientation = !!(plan.failSafe && (plan.limitedOrientation || (Array.isArray(plan.observacoes) && plan.observacoes.length)));
  if (!meals.length && !plan.flow_state && !hasFailSafeOrientation) return null;
  return {
    text: String(node.text || safePayload.message || "").trim(),
    flowState: plan.flow_state || null,
    failSafe: plan.failSafe === true,
    limitedOrientation: plan.limitedOrientation && typeof plan.limitedOrientation === "object" ? plan.limitedOrientation : null,
    meta: plan.meta && typeof plan.meta === "object" ? plan.meta : {},
    refeicoes: meals,
    hidratacao: plan.hidratacao && typeof plan.hidratacao === "object" ? plan.hidratacao : {},
    observacoes: Array.isArray(plan.observacoes) ? plan.observacoes : []
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
    "##META",
    "CALORIAS: " + (meta.calorias ?? ""),
    "PROTEINA: " + (meta.proteina ?? ""),
    "CARB: " + (meta.carbo ?? ""),
    "GORDURA: " + (meta.gordura ?? ""),
    "TMB: " + (meta.tmb ?? ""),
    "TDEE: " + (meta.get ?? "")
  ].join("\n");
  const mealBlocks = meals.map(function(ref) {
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
    "##RESUMO",
    "TOTAL||" + (meta.calorias ?? "") + "|" + (meta.proteina ?? "") + "|" + (meta.carbo ?? "") + "|" + (meta.gordura ?? "")
  ].join("\n");
  const orientBlock = [
    "##ORIENTACOES",
    "Água|" + ((model.hidratacao && model.hidratacao.litros) ? (model.hidratacao.litros + " L/dia") : "Hidrate-se ao longo do dia.")
  ].concat(orientacoes.map(function(obs) { return "Nota|" + obs; })).join("\n");
  return [metaBlock, mealBlocks, resumoBlock, orientBlock].filter(Boolean).join("\n\n");
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

  try {
    var flow = await resolveKronosConversation(text);
    removeThinking();

    if (flow.type === 'answer_with_cta') {
      addAIMessage('assistant', flow.message || 'Posso te direcionar pelo botao abaixo.');
      renderConversationCta('aiMessages', flow.cta, Object.assign({}, flow.payload || {}, { _targetModule: flow.targetModule || null }));
      try {
        window.KroniaIntelligence?.track?.({
          module: 'conversation',
          action: 'chat_cta_rendered',
          status: 'success',
          correlationId: correlationId,
          source: 'app_send_ai',
          metadata: {
            ctaAction: flow?.cta?.action || null,
            targetModule: flow?.targetModule || null,
            sourceOfTruth: flow?.sourceOfTruth || null,
            evidenceCount: flow?.evidenceCount || 0,
          },
        });
      } catch (_) {}
      return;
    }

    if (flow.type === 'analysis_answer') {
      try {
        var progressResp = await apiFetch('/api/memory?action=progress', { method: 'GET' });
        var progressData = await parseApiJsonSafely(progressResp);
        if (progressResp.ok && progressData && progressData.success && progressData.data && progressData.data.progress) {
          addAIMessage('assistant', progressData.data.progress.explanation || flow.message || 'Análise concluída.');
          return;
        }
      } catch (_memoryErr) {}
      addAIMessage('assistant', flow.message || 'Analise concluida.');
      return;
    }

    if (flow.intent === 'supplement_question') {
      addAIMessage('assistant', flow.message || 'Analise concluida.');
      return;
    }

    var userData = buildUserData();
    var messages = _aiHistory.slice(-12);
    var response = await apiFetch('/api/agent', {
      method: 'POST',
      body: JSON.stringify({ messages: messages, history: userData.history, profile: userData.profile, requestId: correlationId }),
    });
    var data = await parseApiJsonSafely(response);
    if (!response.ok || data?.success === false || data?.ok === false) {
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
  const labelStyle = 'font-size:0.85rem;color:var(--text-secondary);margin:0 0 6px;';

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

function applyAIWorkout(data) {
  try {
    const treino = data.treino;
    if (!treino) { showToast("Formato inválido", "error"); return; }

    let grupos = treino.grupos;
    if (!grupos && Array.isArray(treino.exercicios)) {
      grupos = [{ nome: treino.nome || "Treino A", exercicios: treino.exercicios }];
    }
    if (!grupos || grupos.length === 0) { showToast("Nenhum exercício encontrado", "error"); return; }

    const nav  = document.getElementById("nav");
    const cont = document.getElementById("container");
    nav.innerHTML  = "";
    cont.innerHTML = "";

    grupos.forEach((grupo, idx) => {
      // Label curto: pegar só a letra/número do treino
      const labelMatch = grupo.nome.match(/[A-Za-z]\s*[\-–]?\s*[A-Za-z]*/);
      const label = grupo.nome.replace(/treino\s*/i, "").trim().substring(0, 12) || String.fromCharCode(65 + idx);

      nav.innerHTML += `<div class="pill ${idx===0?"active":""}" id="p${idx}" onclick="tab(${idx})">${escapeHTML(label)}</div>`;

      const sec = document.createElement("div");
      sec.id = "sec" + idx;
      sec.className = "section " + (idx === 0 ? "active" : "");
      sec.setAttribute("data-treino-key", grupo.nome);
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

    const total = grupos.reduce((a, g) => a + g.exercicios.length, 0);
    showToast("✅ " + grupos.length + " treino(s) aplicado(s) — " + total + " exercícios!", "success", 3000);

  } catch(e) {
    showToast("Erro ao aplicar: " + e.message, "error");
  }
}

function checkRPEAlert(input) {
  const row  = input.closest(".series-grid");
  if (!row) return;
  // Remove alerta anterior desta linha
  const prev = row.nextElementSibling;
  if (prev && prev.classList.contains("rpe-inline-alert")) prev.remove();
  const inputs = row.querySelectorAll("input");
  const rpe  = parseFloat(inputs[2]?.value);
  const kg   = parseFloat(inputs[0]?.value);
  const reps = parseFloat(inputs[1]?.value);
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
  navigator.serviceWorker.register('/sw.js?v=2026-04-05-2', { updateViaCache: 'none' }).catch(() => {});
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
  if (!loaded) gerarProtocolo();
  // Garante que o container nunca fique vazio
  if (!document.getElementById("container").children.length) gerarProtocolo();

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
  const el = document.getElementById("homeScreen");
  el.classList.add("show");
  // Atualiza dados no próximo frame — tela aparece antes de qualquer cálculo
  requestAnimationFrame(() => {
    try { updateHomeScreen(); } catch(e) {}
    schedulePendingConversationIntentConsumption('home_open');
  });
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
  document.getElementById("homeGreeting").textContent = sauds[saudIdx];

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
  document.getElementById("homeStreak").textContent = streak;
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
  document.getElementById("homeSemanaTreinos").textContent = semTreinos;
  // Progress bar treinos
  const treinosBar = document.getElementById("homeTreinosBarFill");
  if (treinosBar) treinosBar.style.width = Math.min((semTreinos / 5) * 100, 100) + "%";

  const volFormatted = volSem > 999 ? (volSem / 1000).toFixed(1) + "t" : Math.round(volSem) + "kg";
  document.getElementById("homeVolSemana").textContent = volSem > 999 ? (volSem/1000).toFixed(1)+"t" : Math.round(volSem);
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
  const muscleIcons = { peito:"💪", costas:"🔙", pernas:"🦵", ombros:"🙆", biceps:"💪", triceps:"💪", abdomen:"🧱", gluteos:"🍑" };
  list.innerHTML = cards.slice(0, 6).map((c, i) => {
    const exSource = c?.exercicios?.[0] || c;
    const ex = getExerciseCardTitle(exSource, i);
    return `<div class="exercise-preview-item">
      <div class="exercise-preview-thumb">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,140,0,0.6)" stroke-width="1.5" stroke-linecap="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
      </div>
      <div class="exercise-preview-label">${ex}</div>
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
  document.getElementById("perfilScreen").classList.add("show");
  document.body.classList.add('overlay-open');
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = 'none';
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
}
function closePerfil() {
  document.getElementById("perfilScreen").classList.remove("show");
  document.body.classList.remove('overlay-open');
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
  document.getElementById('settingsScreen').classList.add('show');
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
  // Aplica foto salva ao avatar da tela de edição
  const savedPhoto = localStorage.getItem("userAvatarPhoto");
  const av = document.getElementById("epAvatar");
  const epIni = document.getElementById("epAvatarInicial");
  if (savedPhoto) {
    av.style.backgroundImage = `url(${savedPhoto})`;
    av.style.backgroundSize = "cover";
    av.style.backgroundPosition = "center";
    if (epIni) epIni.textContent = "";
  } else {
    av.style.backgroundImage = "";
    if (epIni) epIni.textContent = nome[0]?.toUpperCase() || "T";
  }
  const cta = document.getElementById("epCtaTreino");
  if (cta) cta.style.display = "none";
  document.getElementById("editarPerfilScreen").classList.add("show");
  document.body.classList.add('overlay-open');
  const _footerEP = document.querySelector('.footer-actions');
  if (_footerEP) _footerEP.style.display = 'none';
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
  const savedPhoto = localStorage.getItem("userAvatarPhoto");
  if (!savedPhoto) {
    const ini = document.getElementById("epAvatarInicial");
    if (ini) ini.textContent = (val[0] || "T").toUpperCase();
  }
}
function epHandleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    localStorage.setItem("userAvatarPhoto", dataUrl);
    applyAvatarPhoto(dataUrl);
    const av = document.getElementById("epAvatar");
    av.style.backgroundImage = `url(${dataUrl})`;
    av.style.backgroundSize = "cover";
    av.style.backgroundPosition = "center";
    const ini = document.getElementById("epAvatarInicial");
    if (ini) ini.textContent = "";
  };
  reader.readAsDataURL(file);
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
  const savedPhoto = localStorage.getItem("userAvatarPhoto");
  if (!savedPhoto) {
    const inicial = nome[0]?.toUpperCase() || "T";
    ["perfilAvatar","homeCardAvatar"].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = inicial;
    });
    const ini = document.getElementById("epAvatarInicial");
    if (ini) ini.textContent = inicial;
  }
  const btn = document.querySelector("#editarPerfilScreen .ep-save");
  if (btn) { btn.textContent = "✓ Salvo!"; setTimeout(() => { btn.textContent = "Salvar Perfil"; }, 2000); }
  // CTA para configurar treino após salvar perfil
  const cta = document.getElementById("epCtaTreino");
  if (cta) cta.style.display = "flex";
  showToast("Perfil atualizado!", "success", 2000);
}
function epIrParaTreino() {
  closeEditarPerfil();
  setTimeout(() => { try { navTo("programa"); openConfig(); } catch(e) {} }, 200);
}

function salvarMedidas() {
  const data = {
    nome:   document.getElementById("perfilNomeInput")?.value || "",
    peso:   document.getElementById("perfilPeso")?.value || "",
    altura: document.getElementById("perfilAltura")?.value || "",
    idade:  document.getElementById("perfilIdade")?.value || "",
    sono:   document.getElementById("perfilSono")?.value   || "",
  };
  localStorage.setItem("kronia_config", JSON.stringify(data));
  _dbSync.pushConfig(); // backup silencioso na nuvem
  const nome = data.nome || "ATLETA";
  document.getElementById("perfilNome").textContent = nome.toUpperCase();
  const savedPhoto = localStorage.getItem('userAvatarPhoto');
  if (!savedPhoto) document.getElementById("perfilAvatar").textContent = nome[0]?.toUpperCase() || "T";
  const hc = document.getElementById("homeCardNome");
  if (hc) {
    hc.textContent = nome.toUpperCase();
    if (!savedPhoto) document.getElementById("homeCardAvatar").textContent = nome[0]?.toUpperCase() || "T";
  }
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
  const savedPhoto = localStorage.getItem('userAvatarPhoto');
  if (savedPhoto) {
    applyAvatarPhoto(savedPhoto);
  } else {
    document.getElementById("perfilAvatar").textContent = cfg.nome ? cfg.nome[0].toUpperCase() : "A";
  }
  if (cfg.peso)   document.getElementById("perfilPeso").value   = cfg.peso;
  if (cfg.altura) document.getElementById("perfilAltura").value = cfg.altura;
  if (cfg.idade)  document.getElementById("perfilIdade").value  = cfg.idade;
  if (cfg.sono)   document.getElementById("perfilSono").value   = cfg.sono;
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
  const muscToId = {
    "peito":      ["hm-peito-e","hm-peito-d"],
    "ombros":     ["hm-ombro-e","hm-ombro-d"],
    "biceps":     ["hm-bic-e","hm-bic-d"],
    "abdomen":    ["hm-abs"],
    "quadriceps": ["hm-quad-e","hm-quad-d"],
    "costas":     ["hm-trap","hm-lat-e","hm-lat-d","hm-lombar"],
    "gluteos":    ["hm-glut-e","hm-glut-d"],
    "posterior":  ["hm-post-e","hm-post-d"],
    "triceps":    ["hm-tri-e","hm-tri-d"],
  };

  Object.entries(counts).forEach(([musc, cnt]) => {
    const level = cnt === 0 ? 0 : cnt / maxCount < 0.34 ? 1 : cnt / maxCount < 0.67 ? 2 : 3;
    (muscToId[musc] || []).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.className = "muscle-group level-" + level;
      }
    });
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

  apiFetch("/api/agent", {
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
  apiFetch("/api/agent", {
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
function openDieta() {
  const cfg = safeJSON("kronia_config", {});
  const prefs = safeJSON("kronia_calc_prefs", {});
  document.getElementById("davPeso").value    = prefs.davPeso    || cfg.peso    || "";
  document.getElementById("davAltura").value  = prefs.davAltura  || cfg.altura  || "";
  document.getElementById("davPescoco").value = prefs.davPescoco || "";
  document.getElementById("davCintura").value = prefs.davCintura || "";
  document.getElementById("davQuadril").value = prefs.davQuadril || "";
  selectDavSexo(prefs.davSexo || cfg.sexo || "M");
  if (prefs.davBio) { const el = document.querySelector(`#davBioChips [data-val="${prefs.davBio}"]`); if (el) selectDavBio(el); }
  if (prefs.davObj) { const el = document.querySelector(`#davObjChips [data-val="${prefs.davObj}"]`); if (el) selectDavObj(el); }
  if (prefs.davCiclo) { const el = document.querySelector(`#davCicloChips [data-val="${prefs.davCiclo}"]`); if (el) selectDavCiclo(el); }
  document.getElementById("dietaScreen").classList.add("show");
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = 'none';
}
function closeDieta() {
  document.getElementById("dietaScreen").classList.remove("show");
  const footer = document.querySelector('.footer-actions');
  if (footer) footer.style.display = '';
  navTo("treino");
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
    try { openHome?.(); } catch (_) {}
    try { navTo?.('inicio'); } catch (_) {}
    try { schedulePendingConversationIntentConsumption('fallback_training'); return true; } catch (_) {}
    try { navTo?.('programa'); } catch (_) {}
    try { openConfig?.(safeContext); return true; } catch (_) {}
    try { navTo?.('treino'); return true; } catch (_) {}
  }
  if (action === 'open_diet') {
    try { openHome?.(); } catch (_) {}
    try { navTo?.('inicio'); } catch (_) {}
    try { schedulePendingConversationIntentConsumption('fallback_diet'); return true; } catch (_) {}
    try { openDietaSheet?.(safeContext); return true; } catch (_) {}
    try { openDieta?.(); return true; } catch (_) {}
    try { navTo?.('treino'); return true; } catch (_) {}
  }
  if (action === 'generate_diet') {
    try { openHome?.(); } catch (_) {}
    try { navTo?.('inicio'); } catch (_) {}
    try { schedulePendingConversationIntentConsumption('fallback_generate_diet'); return true; } catch (_) {}
    try { openDietaSheet?.(Object.assign({}, safeContext, { autoGenerate: true, fromChatIntent: true })); return true; } catch (_) {}
    try { openDieta?.(); return true; } catch (_) {}
    try { navTo?.('treino'); return true; } catch (_) {}
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
    try { openHome?.(); } catch (_) {}
    try { navTo?.('inicio'); } catch (_) {}
    schedulePendingConversationIntentConsumption('kronia_action_training');
  },

  openDietGenerator: function (context) {
    try { closeAI?.(); } catch (_) {}
    try { closeOrientacao?.(); } catch (_) {}
    try { openHome?.(); } catch (_) {}
    try { navTo?.('inicio'); } catch (_) {}
    schedulePendingConversationIntentConsumption('kronia_action_diet');
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
    if (window.KroniaActions && typeof window.KroniaActions.openDietGenerator === 'function') {
      window.KroniaActions.openDietGenerator(context);
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

// ─── Auto-healing agent call ────────────────────────────────────────────────
// Tenta streaming → se vazio, cai para JSON → se falhar, aguarda e tenta 1x mais.
// Retorna a string de resposta ou lança erro após esgotar as tentativas.
async function _kronosCall(messages, userData, onChunk) {
  async function tryStream() {
    const resp = await apiFetch("/api/agent", {
      method: "POST",
      body: JSON.stringify({ messages, history: userData.history, profile: userData.profile, stream: true })
    });
    if (!resp.headers.get('content-type')?.includes('text/event-stream')) return null;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', fullText = '', hadError = false;
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') break outer;
        try {
          const json = JSON.parse(raw);
          if (json.d) { fullText += json.d; onChunk && onChunk(fullText); }
          if (json.error) { hadError = true; break outer; }
        } catch (e) {}
      }
    }
    if (hadError || !fullText.trim()) return null; // força fallback
    return fullText.replace(/\s*\{\s*\}\s*$/, '').trim();
  }

  async function tryJson() {
    const resp = await apiFetch("/api/agent", {
      method: "POST",
      body: JSON.stringify({ messages, history: userData.history, profile: userData.profile, stream: false })
    });
    if (!resp.ok) return null;
    const data = await parseApiJsonSafely(resp);
    const text = (data.message || data.data?.content?.[0]?.text || data.content?.[0]?.text || '').trim();
    return text || null;
  }

  // 1ª tentativa: streaming
  let result = await tryStream();
  if (result) return result;

  // 2ª tentativa: JSON sem stream (imediata)
  result = await tryJson();
  if (result) return result;

  // 3ª tentativa: aguarda 2s e tenta streaming novamente
  await new Promise(r => setTimeout(r, 2000));
  result = await tryStream();
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
  var result = await resolveKronosConversation(text);

  if (result.type === 'analysis_answer') {
    renderAI(result.message);
    return;
  }

  if (result.type === 'answer_with_cta') {
    renderAI(result.message);
    renderConversationCta('orientExpertMessages', result.cta, Object.assign({}, result.payload || {}, { _targetModule: result.targetModule || null }));
    return;
  }

  renderAI(result.message || 'Ok');
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
    executeKroniaQuickAction('open_diet', { source: 'orient_quick_dieta' }, { label: 'Abrir dieta' });
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
  // Garante que a tela de orientação está aberta
  const screen = document.getElementById('orientacaoScreen');
  if (screen && !screen.classList.contains('show')) screen.classList.add('show');

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
  const labelStyle = 'font-size:0.85rem;color:var(--text-secondary);margin:0 0 6px;';

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
// ══════════════════════════════════════════
// EXERCISE DISCOVERY
// ══════════════════════════════════════════
function openExerciseDiscSheet() {
  const sheet = document.getElementById('exerciseDiscSheet');
  sheet.classList.add('show');
  // re-init lucide dentro do sheet
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function closeExerciseDiscSheet() {
  document.getElementById('exerciseDiscSheet').classList.remove('show');
}

function _exerciseDiscSetState(state) {
  document.getElementById('exerciseDiscLoading').style.display = state === 'loading' ? 'flex' : 'none';
  document.getElementById('exerciseDiscResult').style.display  = state === 'result'  ? 'block' : 'none';
  document.getElementById('exerciseDiscError').style.display   = state === 'error'   ? 'block' : 'none';
}

function logExerciseDetailsEvent(eventName, payload = {}) {
  try { console.info(`[kronia_exercise] ${eventName}`, payload); } catch {}
  try {
    window.KroniaIntelligence?.track?.({
      module: 'exercise',
      action: eventName === 'exercise_details_opened' ? 'exercise_click' : 'exercise_detail',
      status: /failed|error/.test(eventName) ? 'error' : 'success',
      source: 'exercise_details',
      metadata: { eventName, payload }
    });
  } catch (_) {}
}

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

function _readExerciseDetailsCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE.exerciseDetailsCacheKey) || "{}"); }
  catch { return {}; }
}
function _writeExerciseDetailsCache(cache) {
  try { localStorage.setItem(STORAGE.exerciseDetailsCacheKey, JSON.stringify(cache)); } catch {}
}

function normalizeExerciseDetails(result) {
  if (!result || typeof result !== "object") return null;
  const namePt = result.names?.pt || result.name_pt || result.display_name || result.exerciseName || result.names?.en || "Exercício";
  const lookupKey = result.normalized_lookup_key || result.metadata?.normalizedLookupKey || normalizeExerciseLookupKey(namePt);
  return {
    id: result.id || result.slug || "",
    slug: result.slug || lookupKey,
    normalized_lookup_key: lookupKey,
    names: {
      pt: namePt,
      en: result.names?.en || result.name_en || namePt || "Exercise",
    },
    media: {
      primary: result.media?.primary || null,
      thumbnailUrl: result.media?.thumbnailUrl || null,
      type: result.media?.type || (/\.(mp4|webm)$/i.test(result.media?.primary || "") ? "video" : result.media?.primary ? "image" : "none"),
      provider: result.media?.provider || "internal",
    },
    instructions: Array.isArray(result.instructions) ? result.instructions : [],
    target_muscle: result.target_muscle || result.muscles?.target || null,
    secondary_muscles: Array.isArray(result.secondary_muscles) ? result.secondary_muscles : (result.muscles?.secondary || []),
    body_part: result.body_part || result.muscles?.bodyPart || null,
    equipment: result.equipment || null,
    variations: Array.isArray(result.variations) ? result.variations.map(v => ({
      id: v.id || v.slug || "",
      slug: v.slug || normalizeExerciseLookupKey(v.names?.pt || v.name_pt || ""),
      names: {
        pt: v.names?.pt || v.name_pt || v.name_en || "Variação",
        en: v.names?.en || v.name_en || v.name_pt || "Variation",
      },
    })) : [],
    source: result.source || "internal",
    common_errors: Array.isArray(result.common_errors) ? result.common_errors : [],
    breathing_tip: result.breathing_tip || null,
    range_of_motion: result.range_of_motion || null,
    metadata: result.metadata || {},
  };
}

async function openExerciseDetailsFromCard(card) {
  if (!card) return;
  const exerciseName = card.getAttribute("data-ex-name") || card.querySelector(".ex-title")?.textContent || "Exercício";
  let exerciseRef = null;
  try { exerciseRef = JSON.parse(card.getAttribute("data-ex-ref") || "null"); } catch {}
  const fallbackRef = ensureExerciseRef(exerciseRef || { display_name: exerciseName, normalized_lookup_key: card.getAttribute("data-ex-lookup-key") }, exerciseName, "card_open");
  card.setAttribute("data-ex-ref", JSON.stringify(fallbackRef));
  card.setAttribute("data-ex-lookup-key", fallbackRef.normalized_lookup_key);
  await openExerciseDetailsByName(fallbackRef.display_name || exerciseName, { origin: "card", exerciseRef: fallbackRef });
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

async function fetchExerciseDetailsResponse(endpoint) {
  const buildFallbackHeaders = async function() {
    return typeof getAuthHeaders === "function"
      ? await getAuthHeaders()
      : { "Content-Type": "application/json" };
  };

  const buildRelativeEndpoint = function(url) {
    try {
      const resolved = new URL(String(url || ""), window.location.href);
      return resolved.pathname + resolved.search;
    } catch (_) {
      return String(url || "");
    }
  };

  const relativeEndpoint = buildRelativeEndpoint(endpoint);
  const attempts = [
    async function tryApiFetch() {
      return apiFetch(endpoint);
    },
    async function tryAbsoluteFetch() {
      return fetch(endpoint, {
        method: "GET",
        headers: await buildFallbackHeaders(),
        credentials: "same-origin",
      });
    },
    async function tryRelativeFetch() {
      return fetch(relativeEndpoint, {
        method: "GET",
        headers: await buildFallbackHeaders(),
        credentials: "same-origin",
      });
    },
    async function tryRelativeFetchWithoutHeaders() {
      return fetch(relativeEndpoint, {
        method: "GET",
        credentials: "same-origin",
      });
    }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      const message = String(error && error.message ? error.message : error || "");
      const isRecoverable = /string did not match the expected pattern|failed to fetch|load failed|networkerror/i.test(message);
      if (!isRecoverable) throw error;
    }
  }
  throw lastError || new Error("Falha ao abrir detalhes do exercício.");
}

async function openExerciseDetailsByName(exerciseName, options = {}) {
  const exerciseRef = ensureExerciseRef(options.exerciseRef || { display_name: exerciseName }, exerciseName, options.origin || "direct_open");
  const lookupKey = exerciseRef.normalized_lookup_key || normalizeExerciseLookupKey(exerciseName);
  const exerciseId = exerciseRef.exercise_id || exerciseRef.id || "";
  const exerciseSlug = exerciseRef.slug || "";

  logExerciseDetailsEvent("exercise_details_opened", { exerciseName, lookupKey, exerciseId, origin: options.origin || "unknown" });
  openExerciseDiscSheet();
  _exerciseDiscSetState("loading");

  try {
    const params = new URLSearchParams();
    if (exerciseId) params.set("id", exerciseId);
    if (exerciseSlug) params.set("slug", exerciseSlug);
    if (lookupKey) params.set("lookupKey", lookupKey);

    const endpoint = resolveAppApiUrl(`/api/kronia/exercises/details?${params.toString()}`);
    const resp = await fetchExerciseDetailsResponse(endpoint);
    const rawText = await resp.text();
    let json = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch (_parseError) {
      const contentType = resp.headers?.get("content-type") || "";
      const looksHtml = /text\/html/i.test(contentType) || /^\s*</.test(String(rawText || ""));
      throw new Error(
        looksHtml
          ? "A rota de exercícios retornou uma página em vez de JSON. Atualize o app e faça login novamente."
          : "Resposta inválida ao carregar detalhes do exercício."
      );
    }

    if (!resp.ok) {
      throw new Error(json?.message || "Falha ao carregar detalhes do exercício.");
    }

    renderExercise(json);
    logExerciseDetailsEvent("exercise_detail_loaded_from_api", {
      lookupKey,
      exerciseId,
      slug: exerciseSlug,
    });
  } catch (e) {
    const rawMessage = e?.message || "";
    const normalizedMessage = /string did not match the expected pattern|failed to fetch|load failed|networkerror/i.test(rawMessage)
      ? "Não consegui sincronizar os detalhes do exercício agora. Atualize o app e tente novamente."
      : (rawMessage || "Erro ao carregar detalhes do exercício.");
    document.getElementById("exerciseDiscErrorMsg").textContent = normalizedMessage;
    _exerciseDiscSetState("error");
    logExerciseDetailsEvent("exercise_details_external_fetch_failed", { lookupKey, message: rawMessage || String(e) });
  }
}

function renderExercise(data) {
  const normalized = normalizeExerciseDetails(data);
  if (!normalized) {
    document.getElementById("exerciseDiscErrorMsg").textContent = "Resposta inválida do endpoint de exercício.";
    _exerciseDiscSetState("error");
    return;
  }

  normalized.instructions = Array.isArray(data?.instructions) ? data.instructions : [];
  normalized.common_errors = Array.isArray(data?.common_errors) ? data.common_errors : [];
  normalized.breathing_tip = data?.breathing_tip ?? null;

  _renderExerciseDiscResult(normalized, "enriched");
  _exerciseDiscSetState("result");
}

async function openExerciseDiscovery(query) {
  openExerciseDiscSheet();
  _exerciseDiscSetState('loading');
  try {
    const resp = await apiFetch(resolveAppApiUrl("/api/kronia/exercises/discovery"), {
      method: 'POST',
      body: JSON.stringify({ message: query, locale: 'pt' })
    });
    const json = await resp.json();
    if (json.status !== 'success' || !json.data) {
      document.getElementById('exerciseDiscErrorMsg').textContent =
        json.errors?.[0]?.message || 'Exercício não encontrado. Tente descrever de outra forma.';
      _exerciseDiscSetState('error');
      return;
    }
    _renderExerciseDiscResult(normalizeExerciseDetails(json.data));
    _exerciseDiscSetState('result');
  } catch(e) {
    document.getElementById('exerciseDiscErrorMsg').textContent = 'Erro de conexão: ' + e.message;
    _exerciseDiscSetState('error');
  }
}

function _renderExerciseDiscResult(d, renderMode = "enriched") {
  d = normalizeExerciseDetails(d) || d;
  const mediaEl = document.getElementById('exerciseDiscMedia');
  const mediaSrc = d.media?.primary;
  const mediaType = d.media?.type || (mediaSrc && /\.(mp4|webm)/i.test(mediaSrc) ? "video" : mediaSrc ? "image" : "none");
  const usingPlaceholder = !mediaSrc;
  if (mediaSrc && mediaType === "video") {
    mediaEl.innerHTML = `<video src="${mediaSrc}" poster="${d.media.thumbnailUrl || ''}" controls playsinline muted style="width:100%;border-radius:16px;max-height:240px;object-fit:cover"></video>`;
  } else if (mediaSrc) {
    mediaEl.innerHTML = `<img src="${mediaSrc}" alt="${d.names?.pt || ''}" style="width:100%;border-radius:16px;max-height:240px;object-fit:cover">`;
  } else {
    mediaEl.innerHTML = `<div style="min-height:140px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,.01));color:var(--text-2);font-size:0.82rem;text-align:center;padding:18px">Sem demonstração visual</div>`;
  }

  const primaryMuscle = formatMuscleLabel(d.target_muscle);
  const secondaryMuscles = Array.isArray(d.secondary_muscles) ? d.secondary_muscles.map(formatMuscleLabel).filter(Boolean) : [];
  const muscleList = [primaryMuscle, ...secondaryMuscles].filter(Boolean);
  const musclesText = muscleList.length <= 1 ? (muscleList[0] || '') : `${muscleList.slice(0, -1).join(', ')} e ${muscleList[muscleList.length - 1]}`;

  document.getElementById('exerciseDiscInfo').innerHTML = `
    <div style="font-family:var(--display);font-size:1.14rem;font-weight:900;color:var(--text);letter-spacing:.04em;margin-bottom:4px">${d.names?.pt || d.names?.en || '—'}</div>
    ${d.names?.en ? `<div style="font-size:0.72rem;color:var(--text-2);margin-bottom:10px">${d.names.en}</div>` : ''}
  `;

  const instrs = Array.isArray(d.instructions) ? d.instructions.filter(Boolean) : [];
  const commonErrors = Array.isArray(d.common_errors) ? d.common_errors.filter(Boolean) : [];
  const blocks = [];

  if (instrs.length) {
    blocks.push(`<section style="margin-bottom:14px"><div style="margin-bottom:8px;font-size:0.72rem;font-weight:800;color:var(--text-2);letter-spacing:.08em;text-transform:uppercase">Como fazer</div><ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px">${instrs.map((step, idx) => `<li style="font-size:0.84rem;color:var(--text);line-height:1.5"><strong style="color:#FFB347">${idx + 1}.</strong> ${step}</li>`).join('')}</ol></section>`);
  }

  if (musclesText) {
    blocks.push(`<section style="margin-bottom:14px"><div style="margin-bottom:6px;font-size:0.72rem;font-weight:800;color:var(--text-2);letter-spacing:.08em;text-transform:uppercase">Músculos trabalhados</div><div style="font-size:0.82rem;line-height:1.45;color:var(--text)">${musclesText}</div></section>`);
  }

  if (commonErrors.length) {
    blocks.push(`<section style="margin-bottom:14px"><div style="margin-bottom:8px;font-size:0.72rem;font-weight:800;color:var(--text-2);letter-spacing:.08em;text-transform:uppercase">Erros para evitar</div><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">${commonErrors.map((err) => `<li style="font-size:0.8rem;color:var(--text);line-height:1.45">${err}</li>`).join('')}</ul></section>`);
  }

  if (d.breathing_tip) {
    blocks.push(`<section style="margin-bottom:14px;padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.02)"><div style="font-size:.72rem;text-transform:uppercase;color:var(--text-2);font-weight:800;letter-spacing:.08em;margin-bottom:5px">Respiração</div><div style="font-size:.82rem;line-height:1.45;color:var(--text)">${d.breathing_tip}</div>${d.range_of_motion ? `<div style="margin-top:8px;font-size:.78rem;color:var(--text-2)"><strong>Amplitude:</strong> ${d.range_of_motion}</div>` : ''}</section>`);
  }

  document.getElementById('exerciseDiscInstructions').innerHTML = blocks.join('');

  const vars = d.variations || [];
  const varHtml = vars.length
    ? `<div style="margin-bottom:8px;font-size:0.72rem;font-weight:800;color:var(--text-2);letter-spacing:.08em;text-transform:uppercase">Variações</div>
       <div style="display:flex;flex-wrap:wrap;gap:6px">
         ${vars.map(v => `<button onclick="openExerciseDetailsByName('${(v.names?.pt || v.names?.en || '').replace(/'/g,"\'")}')" style="font-size:0.72rem;font-weight:700;padding:6px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;-webkit-tap-highlight-color:transparent">${v.names?.pt || v.names?.en}</button>`).join('')}
       </div>`
    : '';
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`como fazer ${d.names?.pt || d.names?.en} execução correta`)}`;
  const fallbackLabel = renderMode === "minimal" ? "Ver referência complementar" : "Fonte externa complementar";
  document.getElementById('exerciseDiscVariations').innerHTML = `${varHtml}${varHtml ? '' : ''}<div style="margin-top:14px"><a href="${ytUrl}" target="_blank" rel="noopener noreferrer" onclick="logExerciseDetailsEvent('exercise_details_youtube_fallback_opened',{lookupKey:'${d.normalized_lookup_key || ''}'})" style="font-size:.72rem;color:var(--text-2);text-decoration:underline;opacity:.85">${fallbackLabel}</a></div>`;

  if (usingPlaceholder && !blocks.length) {
    logExerciseDetailsEvent('exercise_detail_rendered_with_placeholder_only', { lookupKey: d.normalized_lookup_key || d.slug || '' });
  }
  if (blocks.length) {
    logExerciseDetailsEvent('exercise_detail_rendered_with_curated_content', { lookupKey: d.normalized_lookup_key || d.slug || '', sections: blocks.length });
  }
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


async function openDietaSheet(context) {
  if (context && typeof context === 'object') {
    var safeContext = sanitizeCtaObject(context);
    window._kroniaLastDietContext = safeContext;
  }
  preencherDietaDosPerfil();
  document.getElementById("dietaSheet").classList.add("show");
  atualizarBasalDieta();
  await _preencherDietaDoSupabase();
  if (context && typeof context === 'object') {
    var hydratedDiet = hydrateDietFromConversationIntent(context);
    if (context.fromChatIntent) {
      window._kroniaChatDietHydratedContext = hydratedDiet;
      trackKroniaCta('home_card_hydrated_from_chat', 'success', {
        type: context.autoGenerate ? 'generate_diet' : 'open_diet',
        hasPayload: !!Object.keys(hydratedDiet).length,
      });
    }
    atualizarBasalDieta();
  }
  if (context && context.autoGenerate === true) {
    var peso = parseFloat(document.getElementById("dietaPeso")?.value);
    var altura = parseFloat(document.getElementById("dietaAltura")?.value);
    var idade = parseInt(document.getElementById("dietaIdade")?.value, 10);
    if (peso > 0 && altura > 0 && idade > 0) {
      await gerarDieta();
    } else {
      trackKroniaCta('diet_auto_generate_skipped', 'success', {
        reason: 'missing_required_fields',
      });
    }
  }
}
function closeDietaSheet() {
  document.getElementById("dietaSheet").classList.remove("show");
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

    const [profRes, metricRes, goalsRes, suplRes] = await Promise.all([
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('profiles').select('full_name,birth_date,sex,height_cm,current_weight_kg,activity_level,objective,dietary_pattern,allergies,intolerances,liked_foods,disliked_foods,clinical_notes'), profileScope) : _sb.from('profiles').select('full_name,birth_date,sex,height_cm,current_weight_kg,activity_level,objective,dietary_pattern,allergies,intolerances,liked_foods,disliked_foods,clinical_notes').eq('id', userId)).maybeSingle(),
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('body_metrics').select('weight_kg,body_fat_percent'), scopeResolver) : _sb.from('body_metrics').select('weight_kg,body_fat_percent').eq('user_id', userId)).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('nutrition_goals').select('calories_target,protein_g,carbs_g,fat_g'), scopeResolver) : _sb.from('nutrition_goals').select('calories_target,protein_g,carbs_g,fat_g').eq('user_id', userId)).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      (window.KroniaAccessScope ? window.KroniaAccessScope.applyScopedQuery(_sb.from('supplement_protocols').select('supplement_name').eq('active', true), scopeResolver) : _sb.from('supplement_protocols').select('supplement_name').eq('user_id', userId).eq('active', true))
    ]);

    const p  = profRes.data;
    const bm = metricRes.data;
    const g  = goalsRes.data;
    const sp = suplRes.data || [];

    window._dietaSupabaseSnapshot = {
      profile: p || null,
      bodyMetrics: bm || null,
      nutritionGoals: g || null,
      supplementProtocols: sp.map(function(item) { return item?.supplement_name; }).filter(Boolean),
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
  }));
}

function buildDietRequestPayloadFromInput(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const baseline = computeDietGenerationBaseline(safeInput);
  const observacoes = [
    safeInput.orcamento ? ("orcamento: " + safeInput.orcamento) : "",
    safeInput.medicamentos ? ("medicamentos: " + safeInput.medicamentos) : "",
    safeInput.patologia && safeInput.patologia !== "nenhuma" ? ("patologia: " + safeInput.patologia) : "",
    "sono: " + (safeInput.sono || "7-8h"),
    "estresse: " + (safeInput.estresse || "moderado"),
    "treino: " + [safeInput.frequenciaTreino, safeInput.duracaoTreino, safeInput.tipoTreino].filter(Boolean).join(" | "),
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
    },
    nutritionGoals: safeInput.nutritionGoals || null,
    supabaseSnapshot: safeInput.supabaseSnapshot || null,
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
      },
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

  return {
    breakfastProteins: breakfastProteins.length ? breakfastProteins : [{ nome: "Tofu mexido", porcao: "180 g", kcal: 173, prot: 18, carb: 5, gord: 10 }],
    fastProteins: fastProteins.length ? fastProteins : [{ nome: "Tofu firme", porcao: "150 g", kcal: 144, prot: 15, carb: 4, gord: 8 }],
    mealProteins: mealProteins.length ? mealProteins : [{ nome: "Tofu firme", porcao: "200 g", kcal: 192, prot: 20, carb: 5, gord: 11 }],
    breakfastCarbs: breakfastCarbs.length ? breakfastCarbs : [{ nome: "Aveia", porcao: "40 g", kcal: 156, prot: 6.8, carb: 26.5, gord: 3.4 }],
    fastCarbs: fastCarbs.length ? fastCarbs : [{ nome: "Banana", porcao: "1 un", kcal: 80, prot: 1, carb: 20.7, gord: 0.2 }],
    mealCarbs: mealCarbs.length ? mealCarbs : [{ nome: "Arroz cozido", porcao: "120 g", kcal: 156, prot: 3, carb: 34, gord: 0.4 }],
    supportCarbs: supportCarbs.length ? supportCarbs : [{ nome: "Banana", porcao: "1 un", kcal: 80, prot: 1, carb: 20.7, gord: 0.2 }],
    breakfastFats: breakfastFats.length ? breakfastFats : [{ nome: "Pasta de amendoim", porcao: "20 g", kcal: 118, prot: 5, carb: 4, gord: 10 }],
    fats: fats.length ? fats : [{ nome: "Abacate", porcao: "100 g", kcal: 96, prot: 1.2, carb: 6, gord: 8.4 }],
    veggies: veggies.length ? veggies : [{ nome: "Salada verde", porcao: "1 prato", kcal: 20, prot: 1, carb: 3, gord: 0.2 }],
    extras: extras,
    helpers: {
      isVegan: isVegan,
      isVegetarian: isVegetarian,
    },
  };
}

function buildLocalDietPlan(input) {
  const safeInput = buildMergedDietInput(input);
  const baseline = computeDietGenerationBaseline(safeInput);
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
      substituicoes: [],
    };
  });

  const goalCalories = Number(safeInput.nutritionGoals && safeInput.nutritionGoals.calories_target);
  const goalProtein = Number(safeInput.nutritionGoals && safeInput.nutritionGoals.protein_g);
  const goalCarbs = Number(safeInput.nutritionGoals && safeInput.nutritionGoals.carbs_g);
  const goalFat = Number(safeInput.nutritionGoals && safeInput.nutritionGoals.fat_g);

  const resumo = refeicoes.reduce(function(acc, meal) {
    acc.calorias += Number(meal.subtotal.kcal || 0);
    acc.proteina += Number(meal.subtotal.prot || 0);
    acc.carbo += Number(meal.subtotal.carb || 0);
    acc.gordura += Number(meal.subtotal.gord || 0);
    return acc;
  }, { calorias: 0, proteina: 0, carbo: 0, gordura: 0 });

  return {
    failSafe: false,
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
    observacoes: [
      "Plano local gerado em modo contingência com base na sua ficha atual.",
      safeInput.padraoAlimentar ? ("Padrão alimentar respeitado: " + safeInput.padraoAlimentar + ".") : "",
      safeInput.restricoes ? ("Restrições consideradas: " + safeInput.restricoes + ".") : "",
    ].filter(Boolean),
  };
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
      action: "GENERATE_DIET",
      requestId: "diet_" + Date.now(),
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

async function gerarDieta() {
  const input = collectDietGenerationInput();
  if (input.fromChatDiet) {
    trackKroniaCta('diet_apply_started_from_chat', 'success', {
      hasPayload: !!Object.keys(window._kroniaChatDietHydratedContext || {}).length,
    });
  }

  const dietPayload = buildDietRequestPayloadFromInput(input);
  const guard = await validateScientificGenerationGuard(
    'diet',
    input.objetivo,
    dietPayload,
    { respectedCardContext: false, respectedAnamnesisContext: true }
  );

  const res = document.getElementById("dietaResultado");
  const txt = document.getElementById("dietaTexto");
  const btn = document.getElementById("btnGerarDieta");
  res.style.display = "block";
  txt.textContent = buildLocalDietRenderText(input, "Plano inicial gerado localmente. Sincronizando versão completa...");
  btn.disabled = true;
  persistDietGenerationPrefs(input);

  if (!guard.ok) {
    txt.textContent = buildLocalDietRenderText(input, "Não foi possível validar todos os critérios científicos agora. Aplicando plano local conservador.");
    btn.disabled = false;
    return;
  }
  if (shouldShowScientificWarningToast(guard)) {
    showToast(guard.warningMessage, "info", 5200);
  }

  try {
    const resp = await requestDietRoute(dietPayload, 12000);
    const data = await parseApiJsonSafely(resp);
    if (!resp.ok || data.success === false) {
      logUiEvent("diet_pipeline_failed", { status: resp.status, error: data.error || "unknown_error" });
      txt.textContent = resolveDietRuntimeErrorMessage(data, resp.status, input, "A rota de dieta retornou erro.");
      return;
    }

    const renderModel = extractDietRenderModel(data);
    if (!renderModel) {
      logUiEvent("diet_response_invalid_contract", {
        context: "gerarDieta.extractDietRenderModel",
        keys: Object.keys(data || {}),
      });
      txt.textContent = buildLocalDietRenderText(input, "A resposta da dieta veio em formato inválido; aplicando plano local.");
      return;
    }

    txt.textContent = renderDietModelAsText(renderModel) || renderModel.text || buildDietFallbackTextFromInput(input);
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
    txt.textContent = buildLocalDietRenderText(input, e && e.message ? e.message : "Falha de rede ao gerar dieta.");
  } finally {
    btn.disabled = false;
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
// ── Dieta Avançada ─────────────────────────────────────────────
let _davSexo = 'M', _davBio = 'ecto', _davObj = 'emagrecer', _davCicloProto = 2, _davCalcResult = null;

function selectDavSexo(s) {
  _davSexo = s;
  document.getElementById('davSexoM').classList.toggle('active', s === 'M');
  document.getElementById('davSexoF').classList.toggle('active', s === 'F');
  document.getElementById('davQuadrilWrap').style.display = s === 'F' ? '' : 'none';
}
function selectDavBio(el) {
  document.querySelectorAll('#davBioChips .config-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active'); _davBio = el.dataset.val;
}
function selectDavObj(el) {
  document.querySelectorAll('#davObjChips .config-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active'); _davObj = el.dataset.val;
}
function selectDavCiclo(el) {
  document.querySelectorAll('#davCicloChips .config-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active'); _davCicloProto = parseInt(el.dataset.val);
  if (_davCalcResult) renderDavCiclo(_davCalcResult);
}

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
  logExerciseDetailsEvent("exercise_details_fallback_used", { origin: "legacy_abrirGuia_redirect", exerciseName: nome });
  return openExerciseDetailsByName(nome, {
    origin: "legacy_guide_redirect",
    exerciseRef: ensureExerciseRef({ display_name: nome, source: "legacy_guide" }, nome, "legacy_guide"),
  });
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
    document.getElementById('breathingModal').classList.add('show');
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
  void circle.offsetWidth;
  circle.classList.add(phase.expand ? 'expand' : 'contract');
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
  document.getElementById('mesocicloSheet').classList.add('show');
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
