"use strict";

const TZ = "America/Sao_Paulo";
const K = {
  SESSIONS: "tdd_sessions_v2", // Mudei para v2 pois a estrutura de dados mudou (array de séries)
  SETTINGS: "tdd_settings_v1",
  PHASE: "tdd_current_phase",
};

const DEFAULT_SETTINGS = { keepRpe: true };

// --- 1. PERIODIZAÇÃO ---
const PERIODIZATION = {
  1: { name: "Fase 1: Base", desc: "Foco em execução perfeita. RPE 7-8.", setsMod: 0, repsOverride: "12-15", rpeTarget: "7-8" },
  2: { name: "Fase 2: Volume", desc: "Acumular fadiga. Falha na última. RPE 8-9.", setsMod: 1, repsOverride: "10-12", rpeTarget: "9" },
  3: { name: "Fase 3: Força", desc: "Carga alta, descanso longo. RPE 9-10.", setsMod: 0, repsOverride: "6-8", rpeTarget: "10" },
  4: { name: "Fase 4: Deload", desc: "Recuperação. -40% carga. Sem falha.", setsMod: -1, repsOverride: "10-12", rpeTarget: "5-6" }
};

// --- 2. TREINOS ---
const WORKOUTS = {
  A: {
    title: "TREINO A",
    objective: "Peito, Ombros, Tríceps e Quad.",
    items: [
      { ex: "Agachamento Livre", sets: 4, reps: "8-10", rest: "90s" },
      { ex: "Supino Inclinado", sets: 4, reps: "8-10", rest: "90s" },
      { ex: "Desenv. Militar", sets: 3, reps: "10-12", rest: "60s" },
      { ex: "Fundos/Tríceps", sets: 3, reps: "Falha", rest: "60s" },
      { ex: "Cadeira Extensora", sets: 3, reps: "15", rest: "45s" },
      { ex: "Abdominal Infra", sets: 4, reps: "15-20", rest: "45s" },
    ],
  },
  B: {
    title: "TREINO B",
    objective: "Costas, Posterior, Bíceps e Core.",
    items: [
      { ex: "Terra/Stiff", sets: 4, reps: "6-8", rest: "90s" },
      { ex: "Remada Curvada", sets: 4, reps: "8-10", rest: "90s" },
      { ex: "Puxada Alta", sets: 3, reps: "10-12", rest: "60s" },
      { ex: "Face Pull", sets: 3, reps: "15", rest: "45s" },
      { ex: "Rosca Direta", sets: 3, reps: "10-12", rest: "60s" },
      { ex: "Prancha Abd.", sets: 4, reps: "Falha", rest: "45s" },
    ],
  },
  C: {
    title: "TREINO C",
    objective: "Full Body / Metabólico",
    items: [
      { ex: "Leg Press", sets: 3, reps: "12", rest: "60s" },
      { ex: "Flexão de Braço", sets: 3, reps: "Máx", rest: "60s" },
      { ex: "Passada (Lunge)", sets: 3, reps: "12", rest: "60s" },
      { ex: "Elevação Lateral", sets: 3, reps: "15", rest: "60s" },
      { ex: "Remada Máquina", sets: 3, reps: "12", rest: "60s" },
      { ex: "Tríceps Corda", sets: 3, reps: "15", rest: "60s" },
      { ex: "Mesa Flexora", sets: 4, reps: "15", rest: "45s" },
      { ex: "Abd. Supra", sets: 4, reps: "20", rest: "30s" },
    ],
  },
  OFF: {
    title: "OFF / DESCANSO",
    objective: "Recuperação",
    items: [{ ex: "CARDIO 45MIN", sets: 1, reps: "FC 120bpm", rest: "-" }],
  },
};

// --- HELPER FUNCTIONS ---
function $(id) { return document.getElementById(id); }

function jsonParse(s, fallback) {
  try { return JSON.parse(s) ?? fallback; } catch { return fallback; }
}

function loadSettings() {
  const s = jsonParse(localStorage.getItem(K.SETTINGS), DEFAULT_SETTINGS);
  return { keepRpe: Boolean(s.keepRpe) };
}

function loadSessions() {
  const arr = jsonParse(localStorage.getItem(K.SESSIONS), []);
  return Array.isArray(arr) ? arr : [];
}

function saveSessions(arr) {
  localStorage.setItem(K.SESSIONS, JSON.stringify(arr));
}

function formatYMDinTZ(dateObj) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(dateObj);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

function formatBR(ymd) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function weekdayFromYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getSessionByDate(sessions, ymd) {
  return sessions.find((x) => x && x.dateKey === ymd) || null;
}

function upsertSession(sessions, session) {
  const idx = sessions.findIndex((x) => x && x.dateKey === session.dateKey);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  sessions.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  return sessions;
}

// --- FUNÇÃO CORE: Renderiza as Linhas de Inputs (Série a Série) ---
function buildExerciseRow(item, existing) {
  const notes = existing?.notes ?? "";
  
  // existing.setsData é um array com os dados de cada série salva: [{w:100, r:10, p:8}, ...]
  const setsData = existing?.setsData || [];

  let setsHtml = "";
  
  // Cabeçalho da tabelinha de séries
  setsHtml += `
    <div style="display:grid; grid-template-columns: 30px 1fr 1fr 1fr; gap:5px; margin-bottom:5px; font-size:11px; color:#aaa; text-align:center;">
      <span>#</span>
      <span>Carga (kg)</span>
      <span>Reps</span>
      <span>RPE</span>
    </div>
  `;

  // Loop para criar uma linha para CADA série programada
  for (let i = 0; i < item.sets; i++) {
    const sData = setsData[i] || {}; // Dados salvos desta série específica
    const w = sData.w || "";
    const r = sData.r || "";
    const p = sData.p || "";

    setsHtml += `
      <div class="set-row" style="display:grid; grid-template-columns: 30px 1fr 1fr 1fr; gap:5px; margin-bottom:8px; align-items:center;">
        <div style="text-align:center; font-weight:bold; color:#555;">${i + 1}</div>
        <input class="inpWeight" type="number" inputmode="decimal" placeholder="kg" value="${escapeHtml(w)}" style="text-align:center;">
        <input class="inpReps" type="number" inputmode="numeric" placeholder="reps" value="${escapeHtml(r)}" style="text-align:center;">
        <input class="inpRpe" type="number" inputmode="decimal" placeholder="-" value="${escapeHtml(p)}" style="text-align:center;">
      </div>
    `;
  }

  return `
    <div class="item" data-ex="${escapeHtml(item.ex)}">
      <div class="itemtop">
        <div>
          <h4 style="margin-bottom:4px;">${escapeHtml(item.ex)}</h4>
          <div class="meta">
            <span style="color:#2dd4bf;">${item.sets} Séries</span> • 
            <span>${item.reps} reps</span> • 
            <span>${item.rest}</span>
          </div>
        </div>
      </div>

      <div style="margin-top:15px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
        ${setsHtml}
      </div>

      <div style="margin-top:10px;">
        <label class="field">
          <span style="font-size:11px; margin-left:2px;">Observações do exercício</span>
          <input class="inpNotes" placeholder="Dores, ajustes, técnica..." value="${escapeHtml(notes)}" style="font-size:13px;">
        </label>
      </div>
    </div>
  `;
}

// --- CORE: Renderização Principal ---
function renderWorkout(ymd, workoutKey, settings, sessions) {
  let currentPhase = localStorage.getItem(K.PHASE) || "1";
  const w = WORKOUTS[workoutKey] || WORKOUTS.OFF;
  const p = PERIODIZATION[currentPhase];
  const dow = weekdayFromYMD(ymd);
  const labels = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

  $("todayLabel").textContent = `${labels[dow]} • ${formatBR(ymd)}`;
  $("workoutTitle").textContent = w.title;
  $("workoutObjective").textContent = w.objective;

  // Dropdowns UI
  const pillDay = $("pillDay");
  const workoutOpts = Object.keys(WORKOUTS).map(k => `<option value="${k}" ${k === workoutKey ? 'selected' : ''}>${k}</option>`).join('');
  const phaseOpts = Object.keys(PERIODIZATION).map(k => `<option value="${k}" ${k === currentPhase ? 'selected' : ''}>${PERIODIZATION[k].name}</option>`).join('');

  pillDay.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px; width:100%; margin-top:5px;">
      <div style="display:flex; gap:10px;">
        <label style="flex:1; background:#222; padding:5px; border-radius:4px;">
          <select id="workoutSelector" style="width:100%; background:transparent; color:#fff; border:none;">${workoutOpts}</select>
        </label>
        <label style="flex:1; background:#224; padding:5px; border-radius:4px;">
          <select id="phaseSelector" style="width:100%; background:transparent; color:#adf; border:none;">${phaseOpts}</select>
        </label>
      </div>
      <div style="font-size:0.8rem; color:#888; text-align:center; font-style:italic;">${p.desc}</div>
    </div>
  `;

  // Listeners
  $("workoutSelector").addEventListener("change", (e) => renderWorkout(ymd, e.target.value, settings, sessions));
  $("phaseSelector").addEventListener("change", (e) => {
    localStorage.setItem(K.PHASE, e.target.value);
    renderWorkout(ymd, workoutKey, settings, sessions);
  });

  // Carregar dados existentes
  const existingSession = getSessionByDate(sessions, ymd);
  const existingEntries = new Map();
  if (existingSession && Array.isArray(existingSession.entries)) {
    existingSession.entries.forEach((e) => existingEntries.set(e.ex, e));
  }

  // Gerar Lista de Exercícios
  const list = $("exerciseList");
  list.innerHTML = "";
  
  w.items.forEach((it) => {
    let item = { ...it };
    // Aplica Periodização
    if (workoutKey !== "OFF" && !item.ex.toUpperCase().includes("CARDIO")) {
        let baseSets = parseInt(item.sets);
        item.sets = Math.max(1, baseSets + p.setsMod); 
        item.reps = p.repsOverride; 
        item.rest += ` | RPE ${p.rpeTarget}`;
    }

    const exEntry = existingEntries.get(item.ex) || null;
    list.insertAdjacentHTML("beforeend", buildExerciseRow(item, exEntry));
  });

  hydrateHistExercises(sessions);
}

// --- NOVA COLETA DE DADOS (Lê todas as linhas) ---
function collectEntriesFromUI(settings) {
  const nodes = Array.from(document.querySelectorAll("#exerciseList .item"));
  return nodes.map((node) => {
    const ex = node.getAttribute("data-ex") || "";
    const notes = node.querySelector(".inpNotes")?.value?.trim() || "";
    
    // Coleta todas as linhas de séries dentro deste exercício
    const setRows = Array.from(node.querySelectorAll(".set-row"));
    const setsData = setRows.map(row => ({
      w: row.querySelector(".inpWeight").value.trim(),
      r: row.querySelector(".inpReps").value.trim(),
      p: row.querySelector(".inpRpe").value.trim()
    })).filter(s => s.w || s.r); // Salva apenas se tiver algo preenchido

    // Para compatibilidade com histórico antigo (calcula média ou pega o melhor set)
    // Mas agora o foco é setsData.
    const bestSet = setsData.reduce((prev, curr) => (parseFloat(curr.w) > parseFloat(prev.w) ? curr : prev), {w:"", r:""});
    
    return { 
      ex, 
      notes, 
      setsData, // Novo formato rico
      weight: bestSet.w, // Mantém compatibilidade simples
      doneReps: bestSet.r,
      rpe: bestSet.p
    };
  });
}

function copyText(ymd, workoutKey, sessions) {
  const w = WORKOUTS[workoutKey] || WORKOUTS.OFF;
  const existing = getSessionByDate(sessions, ymd);
  const map = new Map();
  (existing?.entries || []).forEach((e) => map.set(e.ex, e));

  const lines = [`Treino — ${formatBR(ymd)} — ${w.title}`];
  
  w.items.forEach((it, i) => {
    const e = map.get(it.ex);
    lines.push(`${i + 1}. ${it.ex} (${it.sets}x${it.reps})`);
    
    if (e?.setsData && e.setsData.length > 0) {
      // Formata linha a linha: 100kg x 8 (RPE 8)
      e.setsData.forEach((s, idx) => {
        const txt = `   S${idx+1}: ${s.w}kg x ${s.r} ${s.p ? `(RPE ${s.p})` : ''}`;
        lines.push(txt);
      });
    }
    if (e?.notes) lines.push(`   Obs: ${e.notes}`);
    lines.push(""); // Linha vazia
  });

  return lines.join("\n");
}

function hydrateHistExercises(sessions) {
  const sel = $("histExercise");
  const set = new Set();
  sessions.forEach((s) => (s.entries || []).forEach((e) => set.add(e.ex)));
  const all = Array.from(set).sort();
  const val = sel.value;
  sel.innerHTML = `<option value="__ALL__">Todos</option>` + all.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  sel.value = val;
}

function renderHistory(sessions, filterEx) {
  const box = $("histList");
  box.innerHTML = "";
  if (!sessions.length) { box.innerHTML = `<div class="small">Sem registros.</div>`; return; }

  const f = filterEx && filterEx !== "__ALL__" ? filterEx : null;
  const displaySessions = sessions.slice(0, 50);

  displaySessions.forEach((s) => {
    const entries = (s.entries || []).filter((e) => (f ? e.ex === f : true));
    if (!entries.length) return;

    const rows = entries.map((e) => {
      let details = "";
      if (e.setsData && e.setsData.length) {
        details = e.setsData.map((sd, i) => 
          `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:2px 0;">
             <span>S${i+1}</span> <span><b>${sd.w}kg</b></span> <span>${sd.r} reps</span> 
           </div>`
        ).join("");
      } else {
        details = `<div>${e.weight}kg x ${e.doneReps}</div>`; // Fallback antigo
      }

      return `
        <div class="histcard" style="margin-bottom:8px;">
          <div style="font-weight:bold; color:#2dd4bf; margin-bottom:5px;">${escapeHtml(e.ex)}</div>
          <div style="font-size:12px; color:#ccc; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px;">
            ${details}
          </div>
          ${e.notes ? `<div class="small" style="margin-top:4px; color:#888;">Obs: ${escapeHtml(e.notes)}</div>` : ""}
        </div>`;
    }).join("");

    box.insertAdjacentHTML("beforeend", `
      <div style="margin-bottom:15px; border-left:2px solid #444; padding-left:10px;">
        <div class="small" style="margin-bottom:5px;">${formatBR(s.dateKey)} • ${s.workoutKey}</div>
        ${rows}
      </div>
    `);
  });
}

function exportJSON() {
  const sessions = loadSessions();
  const blob = new Blob([JSON.stringify({ sessions }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `treino_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

// --- INIT ---
window.addEventListener("DOMContentLoaded", () => {
  const ymd = formatYMDinTZ(new Date());
  const settings = loadSettings();
  const sessions = loadSessions();
  
  const existing = getSessionByDate(sessions, ymd);
  renderWorkout(ymd, existing ? existing.workoutKey : "A", settings, sessions);
  renderHistory(sessions, "__ALL__");

  $("btnSave").addEventListener("click", () => {
    const selector = $("workoutSelector");
    const entries = collectEntriesFromUI(settings);
    upsertSession(sessions, { dateKey: ymd, workoutKey: selector ? selector.value : "OFF", entries });
    saveSessions(sessions);
    
    const btn = $("btnSave");
    btn.textContent = "Salvo!";
    btn.style.background = "#2ea44f";
    setTimeout(() => { btn.textContent = "Salvar hoje"; btn.style.background = ""; }, 1500);
    renderHistory(sessions, $("histExercise").value);
  });

  $("btnCopy").addEventListener("click", () => {
    navigator.clipboard.writeText(copyText(ymd, $("workoutSelector").value, sessions))
      .then(() => alert("Copiado!"));
  });

  if($("btnExport")) $("btnExport").addEventListener("click", exportJSON);
  $("histExercise").addEventListener("change", (e) => renderHistory(sessions, e.target.value));
});
