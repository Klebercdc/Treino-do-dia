"use strict";

const TZ = "America/Sao_Paulo";
const K = {
  SESSIONS: "tdd_sessions_v1",
  SETTINGS: "tdd_settings_v1",
};

const DEFAULT_SETTINGS = { keepRpe: true };

const WORKOUTS = {
  A: {
    title: "TREINO A",
    objective: "Força/hipertrofia — foco em execução + progressão",
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
    objective: "Posterior + costas + bíceps + core",
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
    objective: "Circuito/bi-set — volume + condicionamento",
    items: [
      { ex: "1A. Leg Press", sets: 3, reps: "12", rest: "0s" },
      { ex: "1B. Flexão Braço", sets: 3, reps: "Máx", rest: "60s" },
      { ex: "2A. Passada", sets: 3, reps: "12", rest: "0s" },
      { ex: "2B. Elev. Lateral", sets: 3, reps: "15", rest: "60s" },
      { ex: "3A. Remada Máq.", sets: 3, reps: "12", rest: "0s" },
      { ex: "3B. Tríceps Corda", sets: 3, reps: "15", rest: "60s" },
      { ex: "4. Mesa Flexora", sets: 4, reps: "15", rest: "45s" },
      { ex: "5. Abd. Supra", sets: 4, reps: "20", rest: "30s" },
    ],
  },
  OFF: {
    title: "OFF (Descanso)",
    objective: "Recuperação / cardio leve se quiser",
    items: [{ ex: "CARDIO 45MIN", sets: 1, reps: "FC 120 ou H2O UP", rest: "-" }],
  },
};

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
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(dt));
  // fallback: use JS day in TZ via formatting trick
  const w = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" }).format(dt).toUpperCase();
  if (w.includes("SEG")) return 1;
  if (w.includes("TER")) return 2;
  if (w.includes("QUA")) return 3;
  if (w.includes("QUI")) return 4;
  if (w.includes("SEX")) return 5;
  if (w.includes("SÁB") || w.includes("SAB")) return 6;
  return 0; // DOM
}

function autoWorkoutForDow(dow) {
  // SEG=A | TER=OFF | QUA=B | QUI=OFF | SEX=C | SAB=OFF | DOM=OFF
  if (dow === 1) return "A";
  if (dow === 3) return "B";
  if (dow === 5) return "C";
  return "OFF";
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
            <span>Reps alvo: ${escapeHtml(String(item.reps))}</span>
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

function renderWorkout(ymd, workoutKey, settings, sessions) {
  const w = WORKOUTS[workoutKey] || WORKOUTS.OFF;
  const dow = weekdayFromYMD(ymd);
  const labels = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

  $("todayLabel").textContent = `${labels[dow]} • ${formatBR(ymd)} (GMT-3)`;
  $("pillDay").textContent = `Data: ${formatBR(ymd)} • ${workoutKey}`;
  $("workoutTitle").textContent = w.title;
  $("workoutObjective").textContent = w.objective || "";

  const existingSession = getSessionByDate(sessions, ymd);
  const existingEntries = new Map();
  if (existingSession && Array.isArray(existingSession.entries)) {
    existingSession.entries.forEach((e) => existingEntries.set(e.ex, e));
  }

  const list = $("exerciseList");
  list.innerHTML = "";
  w.items.forEach((it) => {
    const exEntry = existingEntries.get(it.ex) || null;
    list.insertAdjacentHTML("beforeend", buildExerciseRow(it, exEntry));
  });

  // preencher selects do histórico
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
  const w = WORKOUTS[workoutKey] || WORKOUTS.OFF;
  const existing = getSessionByDate(sessions, ymd);
  const map = new Map();
  (existing?.entries || []).forEach((e) => map.set(e.ex, e));

  const lines = [];
  lines.push(`Treino — ${formatBR(ymd)} (GMT-3) — ${w.title}`);
  if (w.objective) lines.push(`Objetivo: ${w.objective}`);
  lines.push("");

  w.items.forEach((it, i) => {
    const e = map.get(it.ex);
    const wgt = e?.weight ? `${e.weight}kg` : "";
    const reps = e?.doneReps ? `${e.doneReps} reps` : "";
    const rpe = e?.rpe ? `RPE ${e.rpe}` : "";
    const extra = [wgt, reps, rpe].filter(Boolean).join(" • ");
    lines.push(`${i + 1}. ${it.ex} — ${it.sets}x${it.reps} — desc ${it.rest}${extra ? " | " + extra : ""}`);
    if (e?.notes) lines.push(`   Notas: ${e.notes}`);
  });

  return lines.join("\n");
}

function hydrateHistExercises(sessions) {
  const sel = $("histExercise");
  const set = new Set();
  sessions.forEach((s) => (s.entries || []).forEach((e) => set.add(e.ex)));
  const all = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  sel.innerHTML = `<option value="__ALL__">Todos</option>` + all.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
}

function renderHistory(sessions, filterEx) {
  const box = $("histList");
  box.innerHTML = "";

  if (!sessions.length) {
    box.innerHTML = `<div class="small">Sem registros ainda. Use “Salvar hoje” após preencher carga/reps.</div>`;
    return;
  }

  const f = filterEx && filterEx !== "__ALL__" ? filterEx : null;

  sessions.forEach((s) => {
    const entries = (s.entries || []).filter((e) => (f ? e.ex === f : true));
    if (!entries.length) return;

    const header = `<div class="small">${formatBR(s.dateKey)} • Treino ${escapeHtml(s.workoutKey)}</div>`;
    const rows = entries
      .map((e) => {
        const a = `${escapeHtml(e.ex)}`;
        const b = `Carga: <b>${escapeHtml(e.weight || "-")}</b> kg`;
        const c = `Reps: <b>${escapeHtml(e.doneReps || "-")}</b>`;
        const d = `RPE: <b>${escapeHtml(e.rpe || "-")}</b>`;
        const n = e.notes ? `<div class="small">Notas: ${escapeHtml(e.notes)}</div>` : "";
        return `<div class="histcard">
          <div><b>${a}</b></div>
          <div class="kv">
            <div class="small">${b}</div>
            <div class="small">${c}</div>
            <div class="small">${d}</div>
            <div class="small">Alvo: ${escapeHtml(String((WORKOUTS[s.workoutKey]?.items || []).find((x) => x.ex === e.ex)?.reps || ""))}</div>
          </div>
          ${n}
        </div>`;
      })
      .join("");

    box.insertAdjacentHTML(
      "beforeend",
      `<div class="histcard">
        ${header}
        <div class="divider"></div>
        <div class="hist">${rows}</div>
      </div>`
    );
  });
}

function exportJSON() {
  const sessions = loadSessions();
  const payload = { version: 1, exportedAt: new Date().toISOString(), tz: TZ, sessions };
  const blob = new Blob([JSON.stringify(payload]()
