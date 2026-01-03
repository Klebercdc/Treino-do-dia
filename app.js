"use strict";

const TZ = "America/Sao_Paulo";
const K = {
  SESSIONS: "tdd_sessions_v1",
  SETTINGS: "tdd_settings_v1",
  PHASE: "tdd_current_phase", // Nova chave para salvar a fase da periodização
};

const DEFAULT_SETTINGS = { keepRpe: true };

// --- 1. CONFIGURAÇÃO DA PERIODIZAÇÃO (O "Cérebro" do Treinador) ---
const PERIODIZATION = {
  1: {
    name: "Fase 1: Base (Adaptação)",
    desc: "Foco em execução perfeita. RPE 7-8.",
    setsMod: 0,       // Mantém séries padrão
    repsOverride: "12-15",
    rpeTarget: "7-8"
  },
  2: {
    name: "Fase 2: Volume (Hipertrofia)",
    desc: "Acumular fadiga. Falha na última série. RPE 8-9.",
    setsMod: 1,       // Adiciona 1 série (Hardcore)
    repsOverride: "10-12",
    rpeTarget: "9"
  },
  3: {
    name: "Fase 3: Força (Intensidade)",
    desc: "Carga alta, descanso longo. RPE 9-10.",
    setsMod: 0,       // Volta ao padrão
    repsOverride: "6-8",
    rpeTarget: "10"
  },
  4: {
    name: "Fase 4: Deload (Recuperação)",
    desc: "Recuperação ativa. -40% carga. NÃO chegar à falha.",
    setsMod: -1,      // Remove 1 série (Mínimo 2)
    repsOverride: "10-12",
    rpeTarget: "5-6"
  }
};

// --- 2. CONFIGURAÇÃO DOS TREINOS (Módulos Puros) ---
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
    objective: "Full Body / Metabólico / Perna Foco",
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
    objective: "Recuperação / Cardio Leve",
    items: [{ ex: "CARDIO 45MIN", sets: 1, reps: "FC 120bpm", rest: "-" }],
  },
};

// --- FUNÇÕES UTILITÁRIAS ---

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento não encontrado: ${id}`);
  return el;
}

function jsonParse(s, fallback) {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function loadSettings() {
  const raw = localStorage.getItem(K.SETTINGS);
  const s = raw ? jsonParse(raw, DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
  return { keepRpe: Boolean(s.keepRpe) };
}

function saveSettings(s) {
  localStorage.setItem(K.SETTINGS, JSON.stringify({ keepRpe: s.keepRpe ? 1 : 0 }));
}

function loadSessions() {
  const raw = localStorage.getItem(K.SESSIONS);
  const arr = raw ? jsonParse(raw, []) : [];
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
  // Meio-dia para evitar bug de fuso
  const dt = new Date(y, m - 1, d, 12, 0, 0); 
  return dt.getDay(); // 0=Dom, 6=Sab
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sessionKey(ymd) {
  return ymd;
}

function getSessionByDate(sessions, ymd) {
  const key = sessionKey(ymd);
  return sessions.find((x) => x && x.dateKey === key) || null;
}

function upsertSession(sessions, session) {
  const key = sessionKey(session.dateKey);
  const idx = sessions.findIndex((x) => x && x.dateKey === key);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  sessions.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  return sessions;
}

function buildExerciseRow(item, existing) {
  const w = existing?.weight ?? "";
  const r = existing?.doneReps ?? "";
  const p = existing?.rpe ?? "";
  const n = existing?.notes ?? "";

  return `
    <div class="item" data-ex="${escapeHtml(item.ex)}">
      <div class="itemtop">
        <div>
          <h4>${escapeHtml(item.ex)}</h4>
          <div class="meta">
            <span>Séries: ${escapeHtml(String(item.sets))}</span>
            <span>Reps: ${escapeHtml(String(item.reps))}</span>
            <span>Desc: ${escapeHtml(String(item.rest))}</span>
          </div>
        </div>
      </div>

      <div class="grid" style="margin-top:10px;">
        <label class="field">
          <span>Carga (kg)</span>
          <input class="inpWeight" inputmode="decimal" placeholder="ex.: 80" value="${escapeHtml(w)}" />
        </label>
        <label class="field">
          <span>Reps feitas</span>
          <input class="inpReps" inputmode="numeric" placeholder="ex.: 8" value="${escapeHtml(r)}" />
        </label>
        <label class="field">
          <span>RPE</span>
          <input class="inpRpe" inputmode="decimal" placeholder="6–10" value="${escapeHtml(p)}" />
        </label>
        <label class="field">
          <span>Notas</span>
          <input class="inpNotes" placeholder="técnica, dor, etc." value="${escapeHtml(n)}" />
        </label>
      </div>
    </div>
  `;
}

// --- CORE: RENDERIZAÇÃO INTELIGENTE ---

function renderWorkout(ymd, workoutKey, settings, sessions) {
  // 1. Carregar Fase da Periodização
  let currentPhase = localStorage.getItem(K.PHASE) || "1";
  
  const w = WORKOUTS[workoutKey] || WORKOUTS.OFF;
  const p = PERIODIZATION[currentPhase];
  
  const dow = weekdayFromYMD(ymd);
  const labels = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

  // 2. Textos do Topo
  $("todayLabel").textContent = `${labels[dow]} • ${formatBR(ymd)}`;
  $("workoutTitle").textContent = w.title;
  $("workoutObjective").textContent = `${w.objective}`;
  
  // 3. Gerar Dropdowns (Seletores)
  const pillDay = $("pillDay");
  
  // Opções de Treino
  const workoutOpts = Object.keys(WORKOUTS).map(k => 
    `<option value="${k}" ${k === workoutKey ? 'selected' : ''}>${k}</option>`
  ).join('');

  // Opções de Fase (Periodização)
  const phaseOpts = Object.keys(PERIODIZATION).map(k => 
    `<option value="${k}" ${k === currentPhase ? 'selected' : ''}>${PERIODIZATION[k].name}</option>`
  ).join('');

  pillDay.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px; width:100%; margin-top:5px;">
      <label style="display:flex; justify-content:space-between; align-items:center; background:#222; padding:5px; border-radius:4px;">
        <span style="font-size:0.9rem; color:#aaa;">Treino:</span>
        <select id="workoutSelector" style="padding:5px; border-radius:4px; background:#444; color:#fff; border:none; width:70%;">
          ${workoutOpts}
        </select>
      </label>
      <label style="display:flex; justify-content:space-between; align-items:center; background:#222; padding:5px; border-radius:4px;">
        <span style="font-size:0.9rem; color:#aaa;">Ciclo:</span>
        <select id="phaseSelector" style="padding:5px; border-radius:4px; background:#224; color:#adf; border:none; width:70%;">
          ${phaseOpts}
        </select>
      </label>
      <div style="font-size:0.8rem; color:#888; text-align:right; font-style:italic;">
        ${p.desc}
      </div>
    </div>
  `;

  // Event Listeners dos Selects
  document.getElementById("workoutSelector").addEventListener("change", (e) => {
    // Recarrega a tela com o novo treino escolhido
    renderWorkout(ymd, e.target.value, settings, sessions);
  });

  document.getElementById("phaseSelector").addEventListener("change", (e) => {
    // Salva a nova fase e recarrega
    localStorage.setItem(K.PHASE, e.target.value);
    renderWorkout(ymd, workoutKey, settings, sessions);
  });


  // 4. Preparar Exercícios
  const existingSession = getSessionByDate(sessions, ymd);
  const existingEntries = new Map();
  if (existingSession && Array.isArray(existingSession.entries)) {
    existingSession.entries.forEach((e) => existingEntries.set(e.ex, e));
  }

  const list = $("exerciseList");
  list.innerHTML = "";
  
  w.items.forEach((it) => {
    // CLONAR item para modificar sem estragar o original
    let item = { ...it };

    // LÓGICA DE PERIODIZAÇÃO (Matemática do Treino)
    // Só aplica modificadores se NÃO for Cardio e NÃO for OFF
    if (workoutKey !== "OFF" && !item.ex.toUpperCase().includes("CARDIO")) {
        
        // Ajuste de Séries (Garante mínimo de 2 séries, exceto se original for 1)
        let baseSets = parseInt(item.sets);
        // Se a fase manda tirar séries, garantimos que nunca fica abaixo de 2
        item.sets = Math.max(2, baseSets + p.setsMod); 

        // Ajuste de Repetições
        item.reps = p.repsOverride; 

        // Adiciona alvo de RPE na descrição do descanso
        item.rest += ` | Meta RPE ${p.rpeTarget}`;
    }

    const exEntry = existingEntries.get(item.ex) || null;
    list.insertAdjacentHTML("beforeend", buildExerciseRow(item, exEntry));
  });

  hydrateHistExercises(sessions);
}

function collectEntriesFromUI(settings) {
  const nodes = Array.from(document.querySelectorAll("#exerciseList .item"));
  return nodes.map((node) => {
    const ex = node.getAttribute("data-ex") || "";
    const weight = node.querySelector(".inpWeight")?.value?.trim() || "";
    const doneReps = node.querySelector(".inpReps")?.value?.trim() || "";
    const rpe = settings.keepRpe ? (node.querySelector(".inpRpe")?.value?.trim() || "") : "";
    const notes = node.querySelector(".inpNotes")?.value?.trim() || "";
    return { ex, weight, doneReps, rpe, notes };
  });
}

function copyText(ymd, workoutKey, sessions) {
  // Nota: Copia os dados brutos. Se quiser incluir detalhes da periodização,
  // precisaria ler o DOM ou a fase. Aqui mantemos simples.
  const w = WORKOUTS[workoutKey] || WORKOUTS.OFF;
  const existing = getSessionByDate(sessions, ymd);
  const map = new Map();
  (existing?.entries || []).forEach((e) => map.set(e.ex, e));

  const lines = [];
  lines.push(`Treino — ${formatBR(ymd)} — ${w.title}`);
  if (w.objective) lines.push(`Foco: ${w.objective}`);
  lines.push("");

  w.items.forEach((it, i) => {
    const e = map.get(it.ex);
    const wgt = e?.weight ? `${e.weight}kg` : "";
    const reps = e?.doneReps ? `${e.doneReps} reps` : "";
    const rpe = e?.rpe ? `RPE ${e.rpe}` : "";
    const extra = [wgt, reps, rpe].filter(Boolean).join(" • ");
    // Nota: Aqui usamos os dados originais do objeto WORKOUTS para o nome,
    // mas os dados inseridos pelo user para o log.
    lines.push(`${i + 1}. ${it.ex} ${extra ? "— " + extra : ""}`);
    if (e?.notes) lines.push(`   Notas: ${e.notes}`);
  });

  return lines.join("\n");
}

function hydrateHistExercises(sessions) {
  const sel = $("histExercise");
  const set = new Set();
  sessions.forEach((s) => (s.entries || []).forEach((e) => set.add(e.ex)));
  const all = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  // Preserva valor selecionado se houver
  const currentVal = sel.value;
  sel.innerHTML = `<option value="__ALL__">Todos</option>` + all.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  if (currentVal) sel.value = currentVal;
}

function renderHistory(sessions, filterEx) {
  const box = $("histList");
  box.innerHTML = "";

  if (!sessions.length) {
    box.innerHTML = `<div class="small">Sem registros ainda.</div>`;
    return;
  }

  const f = filterEx && filterEx !== "__ALL__" ? filterEx : null;
  // Mostra apenas os últimos 50 treinos para não pesar
  const displaySessions = sessions.slice(0, 50);

  displaySessions.forEach((s) => {
    const entries = (s.entries || []).filter((e) => (f ? e.ex === f : true));
    if (!entries.length) return;

    const header = `<div class="small">${formatBR(s.dateKey)} • ${escapeHtml(s.workoutKey)}</div>`;
    const rows = entries
      .map((e) => {
        const b = e.weight ? `<b>${escapeHtml(e.weight)}kg</b>` : "";
        const c = e.doneReps ? `<b>${escapeHtml(e.doneReps)} reps</b>` : "";
        const d = e.rpe ? `RPE ${escapeHtml(e.rpe)}` : "";
        const info = [b, c, d].filter(Boolean).join(" • ");
        const n = e.notes ? `<div class="small" style="color:#aaa;">${escapeHtml(e.notes)}</div>` : "";
        
        return `<div class="histcard">
          <div><b>${escapeHtml(e.ex)}</b></div>
          <div class="kv"><div class="small">${info}</div></div>
          ${n}
        </div>`;
      })
      .join("");

    box.insertAdjacentHTML(
      "beforeend",
      `<div class="histcard" style="border-left: 2px solid #555;">
        ${header}
        <div class="hist">${rows}</div>
      </div>`
    );
  });
}

function exportJSON() {
  const sessions = loadSessions();
  const payload = { version: 1, exportedAt: new Date().toISOString(), tz: TZ, sessions };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `treino_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

// --- INICIALIZAÇÃO ---

window.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  const ymd = formatYMDinTZ(now);
  const settings = loadSettings();
  const sessions = loadSessions();

  // Definição Inicial do Treino
  // Tenta encontrar se já existe um treino salvo para hoje
  const existingSession = getSessionByDate(sessions, ymd);
  
  // Se já treinou hoje, carrega aquele treino. 
  // Se não, carrega "A" como padrão (podes mudar para B ou C se preferires começar noutro)
  const initialWorkoutKey = existingSession ? existingSession.workoutKey : "A";

  // Renderiza a aplicação
  renderWorkout(ymd, initialWorkoutKey, settings, sessions);
  renderHistory(sessions, "__ALL__");

  // Eventos dos Botões Principais
  $("btnSave").addEventListener("click", () => {
    const selector = document.getElementById("workoutSelector");
    const currentKey = selector ? selector.value : "OFF";
    
    const entries = collectEntriesFromUI(settings);
    const session = { dateKey: ymd, workoutKey: currentKey, entries };
    upsertSession(sessions, session);
    saveSessions(sessions);
    
    // Feedback visual
    const btn = $("btnSave");
    const originalText = btn.textContent;
    btn.textContent = "Salvo!";
    btn.style.background = "#2ea44f";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = "";
    }, 1500);
    
    renderHistory(sessions, $("histExercise").value);
  });

  $("btnCopy").addEventListener("click", () => {
    const selector = document.getElementById("workoutSelector");
    const currentKey = selector ? selector.value : "OFF";
    const txt = copyText(ymd, currentKey, sessions);
    
    navigator.clipboard.writeText(txt).then(() => {
      alert("Copiado para a área de transferência!");
    });
  });

  $("btnExport").addEventListener("click", exportJSON);

  $("histExercise").addEventListener("change", (e) => {
    renderHistory(sessions, e.target.value);
  });
});
