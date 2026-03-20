import { useState, useEffect, useRef, useCallback } from “react”;
import * as d3 from “d3”;
import {
Zap, Activity, Brain, Shield, AlertTriangle,
TrendingUp, TrendingDown, User, Dumbbell, Apple,
Trophy, Flame, BarChart2, RefreshCw, ChevronRight,
CheckCircle, XCircle, Info
} from “lucide-react”;

// ═══════════════════════════════════════════════════════
// ENTIDADES
// ═══════════════════════════════════════════════════════
const ENTITY_TYPES = {
Usuario:       { color: “#FF6B00”, icon: “👤”, group: 0 },
Treino:        { color: “#3B82F6”, icon: “🏋️”, group: 1 },
Exercicio:     { color: “#6366F1”, icon: “💪”, group: 1 },
RPE:           { color: “#F59E0B”, icon: “⚡”, group: 2 },
FadigaScore:   { color: “#EF4444”, icon: “🔥”, group: 2 },
PR:            { color: “#10B981”, icon: “🏆”, group: 3 },
Nutricao:      { color: “#84CC16”, icon: “🥗”, group: 3 },
Mesociclo:     { color: “#8B5CF6”, icon: “📅”, group: 4 },
Recomendacao:  { color: “#EC4899”, icon: “🧠”, group: 4 },
Alerta:        { color: “#F97316”, icon: “⚠️”, group: 5 },
};

// ═══════════════════════════════════════════════════════
// TRANSFORMS — função(entidade) → entidades derivadas
// ═══════════════════════════════════════════════════════
const TRANSFORMS = {
“Usuario→Treino”: {
from: “Usuario”, to: “Treino”,
label: “expandTreinos”,
description: “Busca histórico de treinos do usuário”,
model: null,
execute: (usuario) => ({
type: “Treino”,
data: { userId: usuario.id, count: usuario.treinos?.length ?? 0, lastDate: usuario.lastTreino }
})
},
“Usuario→FadigaScore”: {
from: “Usuario”, to: “FadigaScore”,
label: “calcFadiga”,
description: “Calcula score de fadiga acumulada”,
model: “mixtral-8x7b-32768”,
execute: (usuario) => ({
type: “FadigaScore”,
data: { score: usuario.rpeHistory?.reduce((a, b) => a + b, 0) / (usuario.rpeHistory?.length || 1) || 0 }
})
},
“Treino→Exercicio”: {
from: “Treino”, to: “Exercicio”,
label: “expandExercicios”,
description: “Extrai exercícios de um treino”,
model: null,
execute: (treino) => treino.exercicios?.map(e => ({ type: “Exercicio”, data: e })) ?? []
},
“Treino→RPE”: {
from: “Treino”, to: “RPE”,
label: “extractRPE”,
description: “Extrai escala de esforço percebido”,
model: null,
execute: (treino) => ({ type: “RPE”, data: { value: treino.rpe, date: treino.date } })
},
“RPE→FadigaScore”: {
from: “RPE”, to: “FadigaScore”,
label: “computeFadiga”,
description: “Computa fadiga a partir de RPE acumulado”,
model: “mixtral-8x7b-32768”,
execute: (rpe) => ({ type: “FadigaScore”, data: { score: rpe.value * 1.2, risk: rpe.value > 8 ? “alto” : “normal” } })
},
“FadigaScore→Recomendacao”: {
from: “FadigaScore”, to: “Recomendacao”,
label: “kronosAdvise”,
description: “KRONOS gera recomendação de treino”,
model: “llama3-70b-8192”,
execute: (fadiga) => ({
type: “Recomendacao”,
data: {
action: fadiga.data.score > 8 ? “Descanso ativo” : “Treino normal”,
intensity: fadiga.data.score > 8 ? “30%” : “100%”
}
})
},
“Exercicio→PR”: {
from: “Exercicio”, to: “PR”,
label: “detectPR”,
description: “Detecta Personal Record no exercício”,
model: null,
execute: (ex) => ({ type: “PR”, data: { exercise: ex.data.name, value: ex.data.carga, isPR: ex.data.isPR } })
},
“PR→Recomendacao”: {
from: “PR”, to: “Recomendacao”,
label: “projecaoEvolucao”,
description: “Projeta evolução baseada nos PRs”,
model: “llama3-70b-8192”,
execute: (pr) => ({
type: “Recomendacao”,
data: { action: pr.data.isPR ? “Aumenta carga 2.5kg próxima sessão” : “Mantém carga atual” }
})
},
“Nutricao→Recomendacao”: {
from: “Nutricao”, to: “Recomendacao”,
label: “macroAjuste”,
description: “Ajusta macros com base no treino”,
model: “llama3-70b-8192”,
execute: (nutri) => ({
type: “Recomendacao”,
data: { action: `Aumenta proteína para ${nutri.data.peso * 2}g`, calorias: nutri.data.tmb * 1.4 }
})
},
“Mesociclo→Treino”: {
from: “Mesociclo”, to: “Treino”,
label: “gerarSemana”,
description: “Gera treinos da semana do mesociclo”,
model: “llama3-70b-8192”,
execute: (meso) => ({
type: “Treino”,
data: { semana: meso.data.semanaAtual, split: meso.data.split, volume: meso.data.volume }
})
},
};

// ═══════════════════════════════════════════════════════
// DEFENSIVE TRANSFORMS — detecta anomalias
// ═══════════════════════════════════════════════════════
const DEFENSIVE_TRANSFORMS = [
{
id: “overtraining”,
name: “Detector de Overtraining”,
icon: “🔥”,
severity: “high”,
trigger: (data) => data.fadigaScore > 8.5,
message: (data) => `RPE médio ${data.fadigaScore?.toFixed(1)} — risco alto de overtraining. Recomendo 48h de descanso.`,
action: “Forçar descanso no mesociclo”,
},
{
id: “plateau”,
name: “Detector de Plateau”,
icon: “📉”,
severity: “medium”,
trigger: (data) => data.semSemPR >= 3,
message: (data) => `${data.semSemPR} semanas sem PR. Possível plateau — ajustar volume ou intensidade.`,
action: “Sugerir deload ou variação de exercício”,
},
{
id: “rpe_inconsistente”,
name: “RPE Inconsistente”,
icon: “⚠️”,
severity: “low”,
trigger: (data) => data.rpeVariance > 3,
message: (data) => `Variância de RPE alta (${data.rpeVariance?.toFixed(1)}). Registros possivelmente imprecisos.`,
action: “Recalibrar escala RPE do atleta”,
},
{
id: “regressao_carga”,
name: “Regressão de Carga”,
icon: “📊”,
severity: “medium”,
trigger: (data) => data.cargaRegression < -5,
message: (data) => `Carga caiu ${Math.abs(data.cargaRegression?.toFixed(1))}% nas últimas sessões. Verificar recuperação.`,
action: “Revisar nutrição e sono”,
},
{
id: “streak_quebrado”,
name: “Streak em Risco”,
icon: “🔗”,
severity: “low”,
trigger: (data) => data.diasSemTreino >= 2,
message: (data) => `${data.diasSemTreino} dias sem treino. Streak em risco de quebrar.`,
action: “Notificação push de lembrete”,
},
];

// ═══════════════════════════════════════════════════════
// GRAFO D3 COMPONENT
// ═══════════════════════════════════════════════════════
function TransformGraph({ entities, transforms, onNodeClick, activeNode }) {
const svgRef = useRef(null);
const simRef = useRef(null);

useEffect(() => {
if (!svgRef.current || !entities.length) return;

```
const svg = d3.select(svgRef.current);
svg.selectAll("*").remove();

const width = svgRef.current.clientWidth || 600;
const height = svgRef.current.clientHeight || 400;

svg.attr("viewBox", `0 0 ${width} ${height}`);

// Defs — glow filter
const defs = svg.append("defs");
const filter = defs.append("filter").attr("id", "glow");
filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
const feMerge = filter.append("feMerge");
feMerge.append("feMergeNode").attr("in", "coloredBlur");
feMerge.append("feMergeNode").attr("in", "SourceGraphic");

// Arrow marker
defs.append("marker")
  .attr("id", "arrow")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 20).attr("refY", 0)
  .attr("markerWidth", 6).attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("fill", "rgba(255,107,0,0.6)");

const nodes = entities.map(e => ({ ...e, id: e.id || e.type + Math.random() }));
const links = transforms.map(t => ({
  source: nodes.find(n => n.type === t.from)?.id,
  target: nodes.find(n => n.type === t.to)?.id,
  label: t.label,
  model: t.model,
})).filter(l => l.source && l.target);

const sim = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(d => d.id).distance(100))
  .force("charge", d3.forceManyBody().strength(-200))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collision", d3.forceCollide(40));
simRef.current = sim;

// Links
const link = svg.append("g").selectAll("line")
  .data(links).join("line")
  .attr("stroke", d => d.model ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.15)")
  .attr("stroke-width", d => d.model ? 2 : 1)
  .attr("stroke-dasharray", d => d.model ? "5,3" : "none")
  .attr("marker-end", "url(#arrow)");

// Link labels
const linkLabel = svg.append("g").selectAll("text")
  .data(links).join("text")
  .attr("font-size", 8)
  .attr("fill", "rgba(255,255,255,0.3)")
  .attr("text-anchor", "middle")
  .text(d => d.label);

// Nodes
const node = svg.append("g").selectAll("g")
  .data(nodes).join("g")
  .attr("cursor", "pointer")
  .call(d3.drag()
    .on("start", (event, d) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    })
    .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
    .on("end", (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null; d.fy = null;
    })
  )
  .on("click", (event, d) => onNodeClick(d));

node.append("circle")
  .attr("r", d => d.type === "Usuario" ? 28 : 20)
  .attr("fill", d => ENTITY_TYPES[d.type]?.color + "22" || "#ffffff22")
  .attr("stroke", d => d.type === activeNode ? "#fff" : (ENTITY_TYPES[d.type]?.color || "#fff"))
  .attr("stroke-width", d => d.type === activeNode ? 3 : 1.5)
  .attr("filter", d => d.type === activeNode ? "url(#glow)" : "none");

node.append("text")
  .attr("text-anchor", "middle")
  .attr("dy", "0.3em")
  .attr("font-size", d => d.type === "Usuario" ? 18 : 14)
  .text(d => ENTITY_TYPES[d.type]?.icon || "●");

node.append("text")
  .attr("text-anchor", "middle")
  .attr("dy", "2.8em")
  .attr("font-size", 9)
  .attr("fill", d => ENTITY_TYPES[d.type]?.color || "#fff")
  .attr("font-weight", 700)
  .text(d => d.type);

sim.on("tick", () => {
  link
    .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
  linkLabel
    .attr("x", d => (d.source.x + d.target.x) / 2)
    .attr("y", d => (d.source.y + d.target.y) / 2 - 6);
  node.attr("transform", d => `translate(${d.x},${d.y})`);
});

return () => sim.stop();
```

}, [entities, transforms, activeNode]);

return (
<svg ref={svgRef} style={{ width: “100%”, height: “100%”, borderRadius: 16 }} />
);
}

// ═══════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════
export default function TitanTransformEngine() {
const [activeTab, setActiveTab] = useState(“grafo”);
const [activeNode, setActiveNode] = useState(null);
const [alerts, setAlerts] = useState([]);
const [running, setRunning] = useState(false);
const [log, setLog] = useState([]);
const [kronosReply, setKronosReply] = useState(””);

// Mock de dados do atleta
const mockData = {
fadigaScore: 9.1,
semSemPR: 3,
rpeVariance: 3.8,
cargaRegression: -7.2,
diasSemTreino: 2,
};

const entities = Object.keys(ENTITY_TYPES).map(type => ({ type, id: type }));
const transformList = Object.values(TRANSFORMS);

// Roda Defensive Transforms
const runDefensive = useCallback(async () => {
setRunning(true);
setLog([]);
const found = [];

```
for (const dt of DEFENSIVE_TRANSFORMS) {
  await new Promise(r => setTimeout(r, 300));
  setLog(l => [...l, `⚙️ Executando: ${dt.name}...`]);
  if (dt.trigger(mockData)) {
    found.push({ ...dt, message: dt.message(mockData) });
    setLog(l => [...l, `${dt.icon} ALERTA: ${dt.message(mockData)}`]);
  } else {
    setLog(l => [...l, `✅ OK: ${dt.name}`]);
  }
}

setAlerts(found);

// Chama KRONOS se houver alertas graves
const highAlerts = found.filter(a => a.severity === "high");
if (highAlerts.length > 0) {
  setLog(l => [...l, "🧠 Enviando para KRONOS (llama3-70b)..."]);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `Você é KRONOS, coach de alta performance do TITAN PRO. 
```

Analise os alertas de Defensive Transforms e dê uma recomendação direta em português brasileiro.
Máximo 2 parágrafos.`, messages: [{ role: "user", content: `Alertas detectados: ${highAlerts.map(a => a.message).join(” | “)}. Dados: ${JSON.stringify(mockData)}`
}]
})
});
const data = await res.json();
const reply = data.content?.[0]?.text || “”;
setKronosReply(reply);
setLog(l => […l, “⚡ KRONOS respondeu!”]);
} catch {
setLog(l => […l, “❌ Erro ao contactar KRONOS”]);
}
}

```
setRunning(false);
```

}, []);

const severityColor = { high: “#EF4444”, medium: “#F59E0B”, low: “#6366F1” };
const tabStyle = (t) => ({
padding: “8px 16px”, borderRadius: 8, border: “none”, cursor: “pointer”,
fontSize: 12, fontWeight: 700, letterSpacing: 0.5, transition: “all 0.2s”,
background: activeTab === t ? “linear-gradient(135deg,#FF6B00,#FF9A3C)” : “rgba(255,255,255,0.06)”,
color: activeTab === t ? “#fff” : “rgba(255,255,255,0.4)”,
});

return (
<div style={{
minHeight: “100vh”, background: “#080808”,
fontFamily: “‘Barlow’,‘DM Sans’,sans-serif”, color: “#fff”,
position: “relative”, overflow: “hidden”,
}}>
{/* Grid bg */}
<div style={{
position: “fixed”, inset: 0, pointerEvents: “none”,
backgroundImage: “radial-gradient(circle at 20% 20%, rgba(255,107,0,0.06) 0%, transparent 50%), linear-gradient(rgba(255,107,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.03) 1px, transparent 1px)”,
backgroundSize: “100% 100%, 40px 40px, 40px 40px”,
}} />

```
  {/* HEADER */}
  <header style={{
    position: "sticky", top: 0, zIndex: 100,
    background: "rgba(8,8,8,0.95)", backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,107,0,0.15)",
    padding: "0 20px", height: 56,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: "linear-gradient(135deg,#FF6B00,#FF9A3C)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Zap size={16} color="#fff" fill="#fff" />
      </div>
      <span style={{ fontWeight: 800, fontSize: 16 }}>TITAN <span style={{ color: "#FF6B00" }}>TRANSFORMS</span></span>
    </div>
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 1,
      color: "#FF6B00", border: "1px solid rgba(255,107,0,0.3)",
      borderRadius: 20, padding: "2px 10px",
    }}>MALTEGO KERNEL ⚡</span>
  </header>

  <main style={{ padding: "20px", maxWidth: 900, margin: "0 auto" }}>
    {/* TABS */}
    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
      {[
        { id: "grafo", label: "🕸️ Grafo de Entidades" },
        { id: "transforms", label: "⚙️ Transforms" },
        { id: "defensive", label: "🛡️ Defensive" },
      ].map(t => (
        <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>
          {t.label}
        </button>
      ))}
    </div>

    {/* ── GRAFO ── */}
    {activeTab === "grafo" && (
      <div>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>Grafo de Entidades</h2>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            Clique em um nó para ver seus transforms. Arraste para reorganizar.
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,107,0,0.15)",
          borderRadius: 16, height: 420, marginBottom: 16,
        }}>
          <TransformGraph
            entities={entities}
            transforms={transformList}
            onNodeClick={(n) => setActiveNode(n.type === activeNode ? null : n.type)}
            activeNode={activeNode}
          />
        </div>

        {/* Node detail */}
        {activeNode && (
          <div style={{
            background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.25)",
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{ENTITY_TYPES[activeNode]?.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{activeNode}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Entidade selecionada</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {transformList.filter(t => t.from === activeNode || t.to === activeNode).map((t, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <span style={{ fontSize: 11, color: t.from === activeNode ? "#FF6B00" : "#10B981", fontFamily: "monospace", fontWeight: 700 }}>
                    {t.from === activeNode ? "OUT" : "IN "}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
                  <ChevronRight size={12} color="rgba(255,255,255,0.2)" />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{t.description}</span>
                  {t.model && (
                    <span style={{
                      marginLeft: "auto", fontSize: 9, padding: "2px 8px", borderRadius: 20,
                      background: "rgba(255,107,0,0.15)", color: "#FF6B00", fontWeight: 700,
                    }}>⚡ {t.model.split("-")[0]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legenda */}
        <div style={{
          marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8,
        }}>
          {Object.entries(ENTITY_TYPES).map(([type, cfg]) => (
            <div key={type} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 20,
              background: cfg.color + "15", border: `1px solid ${cfg.color}40`,
              fontSize: 11, cursor: "pointer",
            }}
              onClick={() => setActiveNode(type === activeNode ? null : type)}
            >
              <span>{cfg.icon}</span>
              <span style={{ color: cfg.color, fontWeight: 600 }}>{type}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ── TRANSFORMS ── */}
    {activeTab === "transforms" && (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>Catálogo de Transforms</h2>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            {transformList.filter(t => t.model).length} transforms com Groq · {transformList.filter(t => !t.model).length} transforms determinísticos
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {transformList.map((t, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, padding: "14px 16px",
              display: "grid", gridTemplateColumns: "1fr auto",
              gap: 12, alignItems: "center",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,107,0,0.3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{ENTITY_TYPES[t.from]?.icon}</span>
                  <span style={{ color: ENTITY_TYPES[t.from]?.color, fontSize: 12, fontWeight: 700 }}>{t.from}</span>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>→</span>
                  <span style={{ fontSize: 14 }}>{ENTITY_TYPES[t.to]?.icon}</span>
                  <span style={{ color: ENTITY_TYPES[t.to]?.color, fontSize: 12, fontWeight: 700 }}>{t.to}</span>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                  {t.label}()
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{t.description}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {t.model ? (
                  <div>
                    <div style={{
                      fontSize: 9, padding: "3px 10px", borderRadius: 20,
                      background: "rgba(255,107,0,0.15)", color: "#FF6B00",
                      fontWeight: 700, marginBottom: 4,
                    }}>⚡ GROQ</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                      {t.model}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize: 9, padding: "3px 10px", borderRadius: 20,
                    background: "rgba(100,200,100,0.1)", color: "#7AE89E",
                    fontWeight: 700,
                  }}>DETERMINÍSTICO</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ── DEFENSIVE ── */}
    {activeTab === "defensive" && (
      <div>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>Defensive Transforms</h2>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
              Detecta overtraining, plateau, regressão e riscos ao atleta
            </p>
          </div>
          <button
            onClick={runDefensive}
            disabled={running}
            style={{
              background: "linear-gradient(135deg,#FF6B00,#FF9A3C)",
              border: "none", borderRadius: 10, padding: "10px 18px",
              cursor: running ? "not-allowed" : "pointer", color: "#fff",
              fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8,
              opacity: running ? 0.7 : 1,
            }}
          >
            {running
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Analisando...</>
              : <><Shield size={14} /> Executar Scan</>
            }
          </button>
        </div>

        {/* Regras */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {DEFENSIVE_TRANSFORMS.map((dt, i) => {
            const triggered = alerts.find(a => a.id === dt.id);
            return (
              <div key={i} style={{
                background: triggered ? `${severityColor[dt.severity]}12` : "rgba(255,255,255,0.03)",
                border: `1px solid ${triggered ? severityColor[dt.severity] + "50" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 14, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 22 }}>{dt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{dt.name}</div>
                  {triggered
                    ? <div style={{ fontSize: 12, color: severityColor[dt.severity] }}>{triggered.message}</div>
                    : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{dt.action}</div>
                  }
                </div>
                <div>
                  {triggered
                    ? <AlertTriangle size={18} color={severityColor[dt.severity]} />
                    : alerts.length > 0
                      ? <CheckCircle size={18} color="#10B981" />
                      : <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* Log de execução */}
        {log.length > 0 && (
          <div style={{
            background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: 16, marginBottom: 16,
            maxHeight: 180, overflowY: "auto",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,107,0,0.6)", letterSpacing: 1, marginBottom: 10 }}>
              LOG DE EXECUÇÃO
            </div>
            {log.map((l, i) => (
              <div key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", marginBottom: 4 }}>
                {l}
              </div>
            ))}
          </div>
        )}

        {/* KRONOS reply */}
        {kronosReply && (
          <div style={{
            background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.3)",
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Brain size={16} color="#FF6B00" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B00", letterSpacing: 1 }}>KRONOS — ANÁLISE DEFENSIVA</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, margin: 0 }}>
              {kronosReply}
            </p>
          </div>
        )}
      </div>
    )}
  </main>

  <style>{`
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.3); border-radius: 4px; }
  `}</style>
</div>
```

);
}
