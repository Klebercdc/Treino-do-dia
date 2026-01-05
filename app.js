/* ==========================================================================
   TITAN PRO - CORE ENGINE V9 (ESTRUTURA BLINDADA)
   ========================================================================== */

const APP_CONFIG = Object.freeze({
    keys: {
        draft: "titan_v9_draft",
        history: "titan_v9_history"
    },
    limits: {
        history: 100,
        maxSets: 10
    }
});

let globalPRMap = new Map();

/* 1. MOTOR DE CÁLCULO E RECORDES */
const TitanMath = {
    estimate1RM: (kg, reps) => kg * (1 + reps / 30),
    
    calcVolume: (values) => values.reduce((acc, v) => acc + (parseFloat(v.kg || 0) * parseFloat(v.reps || 0)), 0),
    
    buildPRCache: () => {
        globalPRMap.clear();
        const history = JSON.parse(localStorage.getItem(APP_CONFIG.keys.history) || "[]");
        history.forEach(session => {
            session.state?.sections?.forEach(sec => {
                sec.cards?.forEach(card => {
                    card.values?.forEach(v => {
                        const rm = TitanMath.estimate1RM(parseFloat(v.kg || 0), parseFloat(v.reps || 0));
                        if (rm > (globalPRMap.get(card.name) || 0)) globalPRMap.set(card.name, rm);
                    });
                });
            });
        });
    }
};

/* 2. GHOST LOADING (CARGA FANTASMA) */
const GhostEngine = {
    getLastPerformance: (exerciseName, setIndex) => {
        const history = JSON.parse(localStorage.getItem(APP_CONFIG.keys.history) || "[]");
        for (let session of history) {
            const section = session.state?.sections?.find(s => s.cards?.some(c => c.name === exerciseName));
            const card = section?.cards?.find(c => c.name === exerciseName);
            if (card?.values?.[setIndex] && (card.values[setIndex].kg || card.values[setIndex].reps)) {
                return card.values[setIndex];
            }
        }
        return null;
    }
};

/* 3. CONTROLADOR DE UI E RENDERIZAÇÃO */
const UIRenderer = {
    renderCard: (name, sectionId, series = 4, values = null) => {
        const id = `ex-${Math.random().toString(36).substr(2, 7)}`;
        const container = document.getElementById(sectionId);
        if (!container) return;

        const card = document.createElement("div");
        card.className = "exercise-card";
        card.id = id;
        card.setAttribute("data-name", name);

        let rows = "";
        for (let i = 0; i < series; i++) {
            const v = values?.[i] || { kg: "", reps: "", rpe: "" };
            const ghost = GhostEngine.getLastPerformance(name, i);
            
            rows += `
                <div class="series-grid">
                    <span class="header-grid">S${i + 1}</span>
                    <div class="input-box">
                        <input type="number" inputmode="decimal" step="any" value="${v.kg}" 
                               placeholder="${ghost?.kg || 'kg'}" oninput="UIRenderer.sync('${id}')">
                    </div>
                    <div class="input-box">
                        <input type="number" inputmode="decimal" value="${v.reps}" 
                               placeholder="${ghost?.reps || 'reps'}" oninput="UIRenderer.sync('${id}')">
                    </div>
                    <div class="input-box">
                        <input type="number" inputmode="decimal" value="${v.rpe}" 
                               placeholder="RPE" oninput="UIRenderer.sync('${id}')">
                    </div>
                </div>`;
        }

        card.innerHTML = `
            <span class="remove-ex" onclick="document.getElementById('${id}').remove(); UIRenderer.saveDraft();">×</span>
            <div class="card-header">
                <h3 class="ex-title">${name}</h3>
                <span class="ex-target">${series} Séries</span>
            </div>
            <div class="rpe-suggest">
                Est. 1RM: <span id="rm-${id}">-</span> | Recorde: <span id="pr-${id}">-</span>
            </div>
            <div class="series-grid header-grid">
                <span>SET</span><span>KG</span><span>REPS</span><span>RPE</span>
            </div>
            ${rows}`;

        container.appendChild(card);
        UIRenderer.sync(id);
    },

    sync: (id) => {
        const card = document.getElementById(id);
        const name = card.getAttribute("data-name");
        const inputs = card.querySelectorAll("input");
        let bestRM = 0;

        for (let i = 0; i < inputs.length; i += 3) {
            const kg = parseFloat(inputs[i].value) || 0;
            const reps = parseFloat(inputs[i+1].value) || 0;
            if (kg > 0 && reps > 0) {
                const currentRM = TitanMath.estimate1RM(kg, reps);
                if (currentRM > bestRM) bestRM = currentRM;
                inputs[i].parentElement.classList.add("filled");
            } else {
                inputs[i].parentElement.classList.remove("filled");
            }
        }

        const pr = globalPRMap.get(name) || 0;
        document.getElementById(`rm-${id}`).innerText = bestRM ? Math.round(bestRM) + "kg" : "-";
        document.getElementById(`pr-${id}`).innerText = pr ? Math.round(pr) + "kg" : "-";
        
        if (bestRM > pr + 0.1 && pr > 0) {
            document.getElementById(`rm-${id}`).style.color = "var(--green)";
        }
        UIRenderer.saveDraft();
    },

    saveDraft: () => {
        const state = {
            sections: Array.from(document.querySelectorAll(".section")).map(sec => ({
                treinoKey: sec.getAttribute("data-treino-key"),
                cards: Array.from(sec.querySelectorAll(".exercise-card")).map(c => ({
                    name: c.getAttribute("data-name"),
                    values: Array.from(c.querySelectorAll(".series-grid:not(.header-grid)")).map(r => {
                        const i = r.querySelectorAll("input");
                        return { kg: i[0].value, reps: i[1].value, rpe: i[2].value };
                    })
                }))
            }))
        };
        localStorage.setItem(APP_CONFIG.keys.draft, JSON.stringify(state));
    }
};

/* 4. BOOTSTRAP */
window.onload = () => {
    TitanMath.buildPRCache();
    const draft = JSON.parse(localStorage.getItem(APP_CONFIG.keys.draft));
    if (draft && draft.sections) {
        // Lógica de reidratação de abas e cards
        draft.sections.forEach((sec, i) => {
            // Renderiza conforme a estrutura de abas existente
        });
    }
};
