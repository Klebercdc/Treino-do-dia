"use strict";

const TZ = "America/Sao_Paulo";
const K = { SESSIONS: "tdd_sessions_v2", SETTINGS: "tdd_settings_v1", PHASE: "tdd_current_phase" };

const PERIODIZATION = {
  1: { name: "F1: Base", desc: "Técnica e controle. RPE 7-8.", setsMod: 0, reps: "12-15", rpe: "7" },
  2: { name: "F2: Volume", desc: "Stress metabólico. RPE 8-9.", setsMod: 1, reps: "10-12", rpe: "9" },
  3: { name: "F3: Força", desc: "Tensão mecânica. RPE 9-10.", setsMod: 0, reps: "6-8", rpe: "10" },
  4: { name: "F4: Deload", desc: "Recuperação ativa. RPE 5-6.", setsMod: -1, reps: "10-12", rpe: "5" }
};

const WORKOUTS = {
  A: { title: "TREINO A", objective: "Empurrar (Peito/Ombro/Tríceps/Quad)", items: [
    { ex: "Agachamento", sets: 4, reps: "8-10", rest: "90s" },
    { ex: "Supino Inclinado", sets: 4, reps: "8-10", rest: "90s" },
    { ex: "Desenv. Militar", sets: 3, reps: "10-12", rest: "60s" }
  ]},
  B: { title: "TREINO B", objective: "Puxar (Costas/Posterior/Bíceps)", items: [
    { ex: "Terra/Stiff", sets: 4, reps: "6-8", rest: "90s" },
    { ex: "Remada Curvada", sets: 4, reps: "8-10", rest: "90s" },
    { ex: "Rosca Direta", sets: 3, reps: "10-12", rest: "60s" }
  ]},
  C: { title: "TREINO C", objective: "Full Body / Metabólico", items: [
    { ex: "Leg Press", sets: 3, reps: "12", rest: "60s" },
    { ex: "Flexão", sets: 3, reps: "Máx", rest: "60s" },
    { ex: "Elevação Lateral", sets: 3, reps: "15", rest: "60s" }
  ]},
  OFF: { title: "OFF", objective: "Recuperação", items: [{ ex: "Cardio Leve", sets: 1, reps: "45min", rest: "-" }] }
};

function $(id) { return document.getElementById(id); }

function renderWorkout(ymd, workoutKey) {
  const phaseKey = localStorage.getItem(K.PHASE) || "1";
  const w = WORKOUTS[workoutKey] || WORKOUTS.OFF;
  const p = PERIODIZATION[phaseKey];
  const sessions = JSON.parse(localStorage.getItem(K.SESSIONS) || "[]");
  const existing = sessions.find(s => s.dateKey === ymd) || {};

  $("todayLabel").textContent = `${new Date().toLocaleDateString('pt-BR')} (GMT-3)`;
  $("workoutTitle").textContent = w.title;
  $("workoutObjective").textContent = `${w.objective} | ${p.desc}`;

  $("pillDay").innerHTML = `
    <select id="wSel">${Object.keys(WORKOUTS).map(k => `<option value="${k}" ${k==workoutKey?'selected':''}>Treino ${k}</option>`).join('')}</select>
    <select id="pSel">${Object.keys(PERIODIZATION).map(k => `<option value="${k}" ${k==phaseKey?'selected':''}>${PERIODIZATION[k].name}</option>`).join('')}</select>
  `;

  $("wSel").onchange = (e) => renderWorkout(ymd, e.target.value);
  $("pSel").onchange = (e) => { localStorage.setItem(K.PHASE, e.target.value); renderWorkout(ymd, workoutKey); };

  const list = $("exerciseList");
  list.innerHTML = "";
  w.items.forEach(it => {
    let sets = Math.max(1, it.sets + (workoutKey !== 'OFF' ? p.setsMod : 0));
    let exData = (existing.entries || []).find(e => e.ex === it.ex) || { setsData: [] };
    
    let rows = "";
    for(let i=0; i<sets; i++) {
      let s = exData.setsData[i] || {};
      rows += `<div class="set-row"><span>${i+1}</span><input class="w" type="number" value="${s.w||''}" placeholder="kg"><input class="r" type="number" value="${s.r||''}" placeholder="rep"><input class="p" type="number" value="${s.p||''}" placeholder="rpe"></div>`;
    }

    list.insertAdjacentHTML("beforeend", `<div class="item" data-ex="${it.ex}"><h4>${it.ex}</h4><div class="muted">${sets}x ${p.reps} | Meta RPE ${p.rpe}</div><div style="margin-top:8px">${rows}</div></div>`);
  });
}

function save() {
  const ymd = new Intl.DateTimeFormat("en-CA").format(new Date());
  const entries = Array.from(document.querySelectorAll(".item")).map(el => ({
    ex: el.dataset.ex,
    setsData: Array.from(el.querySelectorAll(".set-row")).map(r => ({
      w: r.querySelector(".w").value, r: r.querySelector(".r").value, p: r.querySelector(".p").value
    }))
  }));
  let sessions = JSON.parse(localStorage.getItem(K.SESSIONS) || "[]");
  const idx = sessions.findIndex(s => s.dateKey === ymd);
  const session = { dateKey: ymd, workoutKey: $("wSel").value, entries };
  if(idx >= 0) sessions[idx] = session; else sessions.push(session);
  localStorage.setItem(K.SESSIONS, JSON.stringify(sessions));
  alert("Salvo!");
}

window.onload = () => {
  renderWorkout(new Intl.DateTimeFormat("en-CA").format(new Date()), "A");
  $("btnSave").onclick = save;
  $("btnExport").onclick = () => {
    const blob = new Blob([localStorage.getItem(K.SESSIONS)], {type:"application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download="treino.json"; a.click();
  };
};
