"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var kronosAgent_exports = {};
__export(kronosAgent_exports, {
  runKronosAgent: () => runKronosAgent
});
module.exports = __toCommonJS(kronosAgent_exports);
var import_supabase_js = require("@supabase/supabase-js");
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials not configured");
  return (0, import_supabase_js.createClient)(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
const SYSTEM_PROMPT = `Voc\xEA \xE9 o KRONOS, agente de coaching cl\xEDnico do Kronia.

REGRAS ABSOLUTAS:
1. SEMPRE busque os dados reais do usu\xE1rio antes de qualquer resposta cl\xEDnica
2. NUNCA invente valores de exames, peso, macros ou m\xE9tricas
3. Se n\xE3o houver dados suficientes, diga explicitamente o que est\xE1 faltando
4. Cruze lab_reports + body_metrics + nutrition_goals + fadiga_scores antes de diagnosticar
5. Identifique padr\xF5es: overtraining, plateau, d\xE9ficit proteico, disfun\xE7\xE3o hormonal
6. Seja direto, cl\xEDnico e acion\xE1vel \u2014 sem enrola\xE7\xE3o

FLUXO OBRIGAT\xD3RIO para qualquer pergunta sobre sa\xFAde, dieta ou treino:
1. buscar_metricas_corporais \u2192 ver evolu\xE7\xE3o de peso/composi\xE7\xE3o corporal
2. buscar_metas_nutricionais \u2192 ver macros atuais
3. buscar_exames \u2192 ver lab_reports relevantes
4. buscar_fadiga \u2192 ver score de fadiga recente
5. buscar_suplementos \u2192 ver protocolo atual
6. S\xF3 ent\xE3o gerar resposta com base nos dados reais

Tom: cl\xEDnico, direto, sem eufemismos. Voc\xEA \xE9 um coach especializado, n\xE3o um chatbot gen\xE9rico.`;
const TOOLS = [
  {
    name: "buscar_metricas_corporais",
    description: "Busca hist\xF3rico de m\xE9tricas corporais do usu\xE1rio: peso, gordura corporal e medidas. Use antes de qualquer an\xE1lise de composi\xE7\xE3o corporal ou evolu\xE7\xE3o f\xEDsica.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "UUID do usu\xE1rio" },
        limite: { type: "number", description: "Quantos registros retornar (padr\xE3o 10)" }
      },
      required: ["user_id"]
    }
  },
  {
    name: "buscar_metas_nutricionais",
    description: "Busca as metas de macros e calorias mais recentes do usu\xE1rio. Use antes de qualquer recomenda\xE7\xE3o de dieta ou an\xE1lise de ingest\xE3o.",
    input_schema: {
      type: "object",
      properties: { user_id: { type: "string" } },
      required: ["user_id"]
    }
  },
  {
    name: "buscar_exames",
    description: "Busca exames laboratoriais do usu\xE1rio (hemograma, lip\xEDdios, hormonal, etc). Use para cruzar dados cl\xEDnicos com sintomas, fadiga ou desempenho.",
    input_schema: {
      type: "object",
      properties: { user_id: { type: "string" } },
      required: ["user_id"]
    }
  },
  {
    name: "buscar_fadiga",
    description: "Busca scores de fadiga recentes do usu\xE1rio. Use para detectar overtraining, necessidade de deload ou ajuste de volume.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        dias: { type: "number", description: "Quantos dias para tr\xE1s buscar (padr\xE3o 14)" }
      },
      required: ["user_id"]
    }
  },
  {
    name: "buscar_suplementos",
    description: "Busca o protocolo de suplementa\xE7\xE3o ativo do usu\xE1rio. Use para cruzar com sintomas ou recomendar ajustes.",
    input_schema: {
      type: "object",
      properties: { user_id: { type: "string" } },
      required: ["user_id"]
    }
  },
  {
    name: "criar_alerta",
    description: "Cria um alerta no sistema para o usu\xE1rio (overtraining, plateau, d\xE9ficit proteico). Use quando identificar padr\xE3o cl\xEDnico que exige aten\xE7\xE3o imediata.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        tipo: { type: "string", enum: ["overtraining", "plateau", "deficit_proteico"] },
        mensagem: { type: "string", description: "Mensagem clara do alerta para o usu\xE1rio" }
      },
      required: ["user_id", "tipo", "mensagem"]
    }
  }
];
async function callClaudeMessages(messages, system, tools) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system,
      tools,
      messages
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude API error: ${response.status}`);
  }
  return response.json();
}
async function executeTool(name, input) {
  const supabase = getSupabaseAdmin();
  try {
    switch (name) {
      case "buscar_metricas_corporais": {
        const { data, error } = await supabase.from("body_metrics").select("id, measured_at, weight_kg, body_fat_percent, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, notes").eq("user_id", input.user_id).order("measured_at", { ascending: false }).limit(input.limite ?? 10).returns();
        if (error) throw error;
        return JSON.stringify(data);
      }
      case "buscar_metas_nutricionais": {
        const { data, error } = await supabase.from("nutrition_goals").select("id, calories_target, protein_g, carbs_g, fat_g, fiber_g, water_ml, meal_strategy, updated_at").eq("user_id", input.user_id).order("updated_at", { ascending: false }).limit(1).returns();
        if (error) throw error;
        return JSON.stringify(data?.[0] ?? null);
      }
      case "buscar_exames": {
        const { data, error } = await supabase.from("lab_reports").select("id, parsed, clinical_flags, critical_flags, parse_status, created_at").eq("user_id", input.user_id).eq("parse_status", "parsed").order("created_at", { ascending: false }).limit(5).returns();
        if (error) throw error;
        return JSON.stringify(data);
      }
      case "buscar_fadiga": {
        const diasAtras = input.dias ?? 14;
        const dataLimite = /* @__PURE__ */ new Date();
        dataLimite.setDate(dataLimite.getDate() - diasAtras);
        const { data, error } = await supabase.from("fadiga_scores").select("id, score, notas, created_at").eq("user_id", input.user_id).gte("created_at", dataLimite.toISOString()).order("created_at", { ascending: false }).returns();
        if (error) throw error;
        return JSON.stringify(data);
      }
      case "buscar_suplementos": {
        const { data, error } = await supabase.from("supplement_protocols").select("id, supplement_name, dosage, timing, purpose, notes, created_at").eq("user_id", input.user_id).eq("active", true).returns();
        if (error) throw error;
        return JSON.stringify(data);
      }
      case "criar_alerta": {
        const tipo = input.tipo;
        const mensagem = input.mensagem;
        if (!tipo || !mensagem) throw new Error("criar_alerta requer tipo e mensagem");
        const { error } = await supabase.from("alertas_kronos").insert({
          user_id: input.user_id,
          tipo,
          mensagem,
          lido: false
        });
        if (error) throw error;
        return JSON.stringify({ sucesso: true, tipo });
      }
      default:
        return JSON.stringify({ erro: `Tool desconhecida: ${name}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ erro: message, tool: name });
  }
}
async function runKronosAgent(userId, userMessage) {
  const messages = [{ role: "user", content: userMessage }];
  const MAX_ITERATIONS = 8;
  let iterations = 0;
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await callClaudeMessages(messages, SYSTEM_PROMPT, TOOLS);
    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter(
      (b) => b.type === "tool_use"
    );
    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      const textBlock = response.content.find(
        (b) => b.type === "text"
      );
      return { resposta: textBlock?.text ?? "", iteracoes: iterations };
    }
    const toolResults = await Promise.all(
      toolUses.map(async (t) => ({
        type: "tool_result",
        tool_use_id: t.id,
        content: await executeTool(t.name, { user_id: userId, ...t.input })
      }))
    );
    messages.push({ role: "user", content: toolResults });
  }
  return {
    resposta: "Limite de racioc\xEDnio atingido. Tente uma pergunta mais espec\xEDfica.",
    iteracoes: MAX_ITERATIONS
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runKronosAgent
});
