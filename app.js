/* ==========================================================================
   TITAN PRO - CORE ENGINE V7 (GOD MODE)
   ========================================================================== */

const STORAGE = Object.freeze({
    draft: "titan_draft_v7",
    history: "titan_hist_v7",
    max: 50
});

const BIBLIOTECA = {
    "Peito": ["Supino Inclinado", "Supino Reto", "Crossover", "Voador"],
    "Costas": ["Puxada Alta", "Remada Curvada", "Remada Baixa", "Barra Fixa"],
    "Pernas": ["Agachamento", "Leg Press", "Extensora", "Flexora", "Stiff", "Panturrilha"],
    "Ombros": ["Desenvolvimento", "Elevação Lateral", "Crucifixo Inverso"],
    "Braços": ["Rosca Direta", "Rosca Martelo", "Tríceps Corda", "Tríceps Testa"]
};

let prMap = new Map();
let isAddingNew = false;
let currentExId = null;

/* --------------------------------------------------------------------------
   1. MOTOR DE PERFORMANCE (CACHE & GHOST)
   -------------------------------------------------------------------------- */

// Constrói mapa de recordes para busca instantânea
function buildPRCache() {
    prMap.clear();
    const hist = JSON.parse(localStorage.getItem(STORAGE.history) || "[]");
    hist.forEach(sessao => {
        if (!sessao.state?.sections) return;
        sessao.state.sections.forEach(sec => {
            sec.cards.forEach(c => {
                let bestSetRM = 0;
                c.values.forEach(v => {
                    const k = parseFloat(v.kg) || 0, r = parseFloat(v.reps) || 0;
                    if (k > 0 && r > 0) {
                        const rm = k * (1 + r / 30); // Epley Formula
                        if (rm > bestSetRM) bestSetRM = rm;
                    }
                });
                const currentMax = prMap.get(c.name) || 0;
                if (bestSetRM > currentMax) prMap.set(c.name, bestSetRM);
            });
        });
    });
}

// Busca carga do treino anterior para o Ghost Loading
function buscarSombraAnterior(nomeEx, indexSerie) {
    const hist = JSON.parse(localStorage.getItem(STORAGE.history) || "[]");
    for (let sessao of hist) {
        if (!sessao.state?.sections) continue;
        for (let sec of sessao.state.sections) {
            const card = sec.cards.find(x => x.name === nomeEx);
            if (card && card.values[indexSerie]) {
                const val = card.values[indexSerie];
                if (val.kg || val.reps) return val;
            }
        }
    }
    return null;
}

/* --------------------------------------------------------------------------
   2. MOTOR DE RENDERIZAÇÃO (HORIZONTAL LAYOUT)
   -------------------------------------------------------------------------- */

function criarCard(nome, series = 4, values = null) {
    const container = document.getElementById("container");
    const id = "ex-" + Math.random().toString(36).substr(2, 7);
    
    const card = document.createElement("div");
    card.className = "exercise-card";
    card.setAttribute("data-ex-id", id);
    card.setAttribute("data-ex-name", nome);

    let rowsHtml = "";
    for (let i = 0; i < series; i++) {
        const v = values?.[i] || { kg: "", reps: "", rpe: "" };
        const sombra = buscarSombraAnterior(nome, i);

        rowsHtml += `
            <div class="series-grid">
                <span class="header-grid">S${i + 1}</span>
                <div class="input-box ${v.kg ? 'filled' : ''}">
                    <input type="number" inputmode="decimal" value="${v.kg}" placeholder="${sombra?.kg || 'kg'}" oninput="updateSuggests('${id}')">
                </div>
                <div class="input-box ${v.reps ? 'filled' : ''}">
                    <input type="number" inputmode="decimal" value="${v.reps}" placeholder="${sombra?.reps || 'reps'}" oninput="updateSuggests('${id}')">
                </div>
                <div class="input-box">
                    <input type="number" inputmode="decimal" value="${v.rpe}" placeholder="RPE" oninput="updateSuggests('${id}')" style="color:var(--orange)">
                </div>
            </div>`;
    }

    card.innerHTML = `
        <div class="card-header">
            <h3 class="ex-title" onclick="abrirLibParaTrocar('${id}')">${nome}</h3>
            <span class="ex-target">${series} Sets x Meta</span>
        </div>
        <span class="rpe-suggest">EST. 1RM: <span id="1rm-${id}">-</span> | <span id="stat-${id}">-</span></span>
        <div class="series-grid header-grid">
            <span>SET</span><span>KG</span><span>REPS</span><span>RPE</span>
        </div>
        ${rowsHtml}`;

    container.appendChild(card);
    updateSuggests(id);
}

function updateSuggests(id) {
    const card = document.querySelector(`[data-ex-id="${id}"]`);
    if (!card) return;
    const inputs = card.querySelectorAll("input"), nome = card.getAttribute("data-ex-name");
    let maxRM = 0, lastRpe = 0;

    for (let i = 0; i < inputs.length; i += 3) {
        const k = parseFloat(inputs[i].value) || 0;
        const r = parseFloat(inputs[i+1].value) || 0;
        const rp = parseFloat(inputs[i+2].value) || 0;
        if (k > 0 && r > 0) {
            inputs[i].parentElement.classList.add("filled");
            inputs[i+1].parentElement.classList.add("filled");
            const rm = k * (1 + r / 30);
            if (rm > maxRM) { maxRM = rm; lastRpe = rp; }
        } else {
            inputs[i].parentElement.classList.remove("filled");
            inputs[i+1].parentElement.classList.remove("filled");
        }
    }

    const elRM = document.getElementById(`1rm-${id}`), elST = document.getElementById(`stat-${id}`);
    if (maxRM > 0) {
        const bestAllTime = prMap.get(nome) || 0;
        elRM.innerHTML = `${Math.round(maxRM)}kg ${maxRM > (bestAllTime + 0.5) ? '<b style="color:var(--green)">▲PR</b>' : ''}`;
        elST.textContent = lastRpe >= 9 ? "HARD" : lastRpe >= 7 ? "OPT" : "LIGHT";
        elST.style.color = lastRpe >= 7 ? "var(--green)" : "var(--orange)";
    }
    salvarRascunho();
}

/* --------------------------------------------------------------------------
   3. TIMER ENGINE
   -------------------------------------------------------------------------- */

let timeLeft = 60, baseTime = 60, timerInt = null, isRunning = false;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function setT(s, btn) {
    if (isRunning) return;
    timeLeft = baseTime = s;
    updateTimerDisplay();
    document.querySelectorAll(".btn-timer-opt").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
}

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    document.getElementById("timerDisplay").innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
}

function toggleT() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const btn = document.getElementById("ctrlBtn");
    if (isRunning) {
        clearInterval(timerInt); isRunning = false;
        btn.innerText = "START REST"; btn.style.background = "var(--accent-green)";
    } else {
        isRunning = true; btn.innerText = "PAUSE"; btn.style.background = "var(--orange)";
        timerInt = setInterval(() => {
            if (timeLeft > 0) { timeLeft--; updateTimerDisplay(); }
            else { 
                clearInterval(timerInt); isRunning = false;
                new Audio('data:audio/wav;base64,UklGRl9vT1...').play().catch(()=>{}); // Placeholder som curto
                btn.innerText = "START REST"; timeLeft = baseTime; updateTimerDisplay();
            }
        }, 1000);
    }
}

function resetT() {
    clearInterval(timerInt); isRunning = false;
    timeLeft = baseTime; updateTimerDisplay();
    document.getElementById("ctrlBtn").innerText = "START REST";
}

/* --------------------------------------------------------------------------
   4. PERSISTÊNCIA & ESTADO
   -------------------------------------------------------------------------- */

function salvarRascunho() {
    const state = {
        sections: [{
            cards: Array.from(document.querySelectorAll(".exercise-card")).map(c => ({
                name: c.getAttribute("data-ex-name"),
                values: Array.from(c.querySelectorAll(".series-grid:not(.header-grid)")).map(r => {
                    const i = r.querySelectorAll("input");
                    return { kg: i[0].value, reps: i[1].value, rpe: i[2].value };
                })
            }))
        }]
    };
    localStorage.setItem(STORAGE.draft, JSON.stringify(state));
}

function salvarTreino() {
    const rascunho = localStorage.getItem(STORAGE.draft);
    if (!rascunho) return;
    const hist = JSON.parse(localStorage.getItem(STORAGE.history) || "[]");
    hist.unshift({ date: new Date().toISOString(), state: JSON.parse(rascunho) });
    localStorage.setItem(STORAGE.history, JSON.stringify(hist.slice(0, STORAGE.max)));
    buildPRCache();
    alert("✅ SESSÃO ARQUIVADA!");
}

/* --------------------------------------------------------------------------
   5. INICIALIZAÇÃO ABSOLUTA
   -------------------------------------------------------------------------- */

window.onload = () => {
    document.getElementById("displayDate").innerText = new Date().toLocaleDateString("pt-BR");
    buildPRCache();
    
    const salvo = localStorage.getItem(STORAGE.draft);
    if (salvo) {
        const st = JSON.parse(salvo);
        st.sections[0].cards.forEach(c => criarCard(c.name, c.values.length, c.values));
    } else {
        ["Supino", "Puxada", "Agachamento"].forEach(n => criarCard(n));
    }
};
