/* ==========================================================================
   TITAN PRO - CORE ENGINE V8 (GOD MODE)
   ========================================================================== */

const STORAGE_KEYS = Object.freeze({
    draft: "titan_pro_draft_v8",
    history: "titan_pro_history_v8",
    max_history: 100
});

let prCache = new Map();
let activeTimer = null;
let baseSeconds = 60;
let secondsLeft = 60;

/* 1. MOTOR DE PERFORMANCE E RECORDES (PR) */
const buildPRCache = () => {
    prCache.clear();
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
    history.forEach(session => {
        if (!session.state?.sections) return;
        session.state.sections.forEach(section => {
            section.cards.forEach(card => {
                let maxRM = 0;
                card.values.forEach(v => {
                    const kg = parseFloat(v.kg) || 0;
                    const reps = parseFloat(v.reps) || 0;
                    if (kg > 0 && reps > 0) {
                        const rm = kg * (1 + reps / 30); // Epley Formula
                        if (rm > maxRM) maxRM = rm;
                    }
                });
                const globalMax = prCache.get(card.name) || 0;
                if (maxRM > globalMax) prCache.set(card.name, maxRM);
            });
        });
    });
};

/* 2. GHOST DATA ENGINE (CARGA FANTASMA) */
const getGhostValue = (exerciseName, setIndex) => {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
    for (let session of history) {
        if (!session.state?.sections) continue;
        for (let section of session.state.sections) {
            const card = section.cards.find(c => c.name === exerciseName);
            if (card && card.values[setIndex]) {
                const data = card.values[setIndex];
                if (data.kg || data.reps) return data;
            }
        }
    }
    return null;
};

/* 3. RENDERIZADOR DE EXERCÍCIOS (HORIZONTAL CAROUSEL) */
const renderCard = (name, seriesCount = 4, existingValues = null) => {
    const container = document.getElementById("container");
    const exerciseId = `ex-${Math.random().toString(36).substr(2, 9)}`;
    
    const card = document.createElement("div");
    card.className = "exercise-card";
    card.setAttribute("data-id", exerciseId);
    card.setAttribute("data-name", name);

    let rowsHtml = "";
    for (let i = 0; i < seriesCount; i++) {
        const val = existingValues?.[i] || { kg: "", reps: "", rpe: "" };
        const ghost = getGhostValue(name, i);

        rowsHtml += `
            <div class="series-grid">
                <span class="header-grid">S${i + 1}</span>
                <div class="input-box ${val.kg ? 'filled' : ''}">
                    <input type="number" inputmode="decimal" value="${val.kg}" 
                           placeholder="${ghost?.kg || '0'}" oninput="syncState('${exerciseId}')">
                </div>
                <div class="input-box ${val.reps ? 'filled' : ''}">
                    <input type="number" inputmode="decimal" value="${val.reps}" 
                           placeholder="${ghost?.reps || '0'}" oninput="syncState('${exerciseId}')">
                </div>
                <div class="input-box">
                    <input type="number" inputmode="decimal" value="${val.rpe}" 
                           placeholder="RPE" oninput="syncState('${exerciseId}')" style="color:var(--orange)">
                </div>
            </div>`;
    }

    card.innerHTML = `
        <div class="card-header">
            <h3 class="ex-title">${name}</h3>
            <span>${seriesCount} Séries</span>
        </div>
        <span class="rpe-suggest">1RM: <span id="rm-${exerciseId}">-</span> | <span id="status-${exerciseId}">-</span></span>
        <div class="series-grid header-grid">
            <span>SET</span><span>KG</span><span>REPS</span><span>RPE</span>
        </div>
        ${rowsHtml}`;

    container.appendChild(card);
    syncState(exerciseId);
};

/* 4. MOTOR DE ESTADO E 1RM */
const syncState = (id) => {
    const card = document.querySelector(`[data-id="${id}"]`);
    if (!card) return;
    const inputs = card.querySelectorAll("input");
    const name = card.getAttribute("data-name");
    let topRM = 0;
    let rpeVal = 0;

    for (let i = 0; i < inputs.length; i += 3) {
        const k = parseFloat(inputs[i].value) || 0;
        const r = parseFloat(inputs[i+1].value) || 0;
        const rp = parseFloat(inputs[i+2].value) || 0;
        
        if (k > 0 && r > 0) {
            inputs[i].parentElement.classList.add("filled");
            inputs[i+1].parentElement.classList.add("filled");
            const currentRM = k * (1 + r / 30);
            if (currentRM > topRM) { topRM = currentRM; rpeVal = rp; }
        } else {
            inputs[i].parentElement.classList.remove("filled");
            inputs[i+1].parentElement.classList.remove("filled");
        }
    }

    const rmDisplay = document.getElementById(`rm-${id}`);
    const statusDisplay = document.getElementById(`status-${id}`);
    if (topRM > 0) {
        const historyMax = prCache.get(name) || 0;
        rmDisplay.innerHTML = `${Math.round(topRM)}kg ${topRM > (historyMax + 0.1) ? '<b style="color:var(--accent-green)">▲PR</b>' : ''}`;
        statusDisplay.textContent = rpeVal >= 9 ? "HARD" : "OPT";
        statusDisplay.style.color = rpeVal >= 7 ? "var(--accent-green)" : "var(--orange)";
    }
    saveDraft();
};

/* 5. TIMER CONTROLLER */
const setT = (s, btn) => {
    if (activeTimer) return;
    secondsLeft = baseSeconds = s;
    updateTimerUI();
    document.querySelectorAll(".btn-timer-opt").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
};

const updateTimerUI = () => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    document.getElementById("timerDisplay").textContent = `0${m}:${s < 10 ? '0' : ''}${s}`;
};

const toggleT = () => {
    const btn = document.getElementById("ctrlBtn");
    if (activeTimer) {
        clearInterval(activeTimer);
        activeTimer = null;
        btn.textContent = "START REST";
        btn.style.background = "var(--accent-green)";
    } else {
        btn.textContent = "PAUSE";
        btn.style.background = "var(--orange)";
        activeTimer = setInterval(() => {
            if (secondsLeft > 0) {
                secondsLeft--;
                updateTimerUI();
            } else {
                clearInterval(activeTimer);
                activeTimer = null;
                btn.textContent = "START REST";
                secondsLeft = baseSeconds;
                updateTimerUI();
                if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
            }
        }, 1000);
    }
};

const resetT = () => {
    clearInterval(activeTimer);
    activeTimer = null;
    secondsLeft = baseSeconds;
    updateTimerUI();
    document.getElementById("ctrlBtn").textContent = "START REST";
};

/* 6. PERSISTÊNCIA */
const saveDraft = () => {
    const state = {
        sections: [{
            cards: Array.from(document.querySelectorAll(".exercise-card")).map(c => ({
                name: c.getAttribute("data-name"),
                values: Array.from(c.querySelectorAll(".series-grid:not(.header-grid)")).map(r => {
                    const i = r.querySelectorAll("input");
                    return { kg: i[0].value, reps: i[1].value, rpe: i[2].value };
                })
            }))
        }]
    };
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(state));
};

const salvarTreino = () => {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.draft));
    if (!draft) return;
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
    history.unshift({ date: new Date().toISOString(), state: draft });
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history.slice(0, STORAGE_KEYS.max_history)));
    buildPRCache();
    alert("SESSÃO SALVA");
};

/* 7. INITIALIZATION */
window.onload = () => {
    buildPRCache();
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.draft));
    if (draft && draft.sections) {
        draft.sections[0].cards.forEach(c => renderCard(c.name, c.values.length, c.values));
    } else {
        ["Supino Inclinado", "Puxada Aberta", "Agachamento Livre"].forEach(ex => renderCard(ex));
    }
    document.getElementById("displayDate").textContent = new Date().toLocaleDateString("pt-BR");
};
