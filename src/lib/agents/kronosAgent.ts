import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────

interface BodyMetric {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
}

interface NutritionGoal {
  id: string;
  calories_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  water_ml: number | null;
  meal_strategy: string | null;
  updated_at: string;
}

interface LabReport {
  id: string;
  parsed: Record<string, unknown> | null;
  clinical_flags: Record<string, unknown> | null;
  critical_flags: Record<string, unknown> | null;
  parse_status: string;
  created_at: string;
}

interface FadigaScore {
  id: string;
  score: number;
  notas: string | null;
  created_at: string;
}

interface SupplementProtocol {
  id: string;
  supplement_name: string;
  dosage: string | null;
  timing: string | null;
  purpose: string | null;
  notes: string | null;
  created_at: string;
}

type AlertaTipo = "overtraining" | "plateau" | "deficit_proteico";

interface ToolInput {
  user_id: string;
  limite?: number;
  dias?: number;
  tipo?: AlertaTipo;
  mensagem?: string;
  [key: string]: unknown;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: ToolInput };

interface ClaudeResponse {
  content: ContentBlock[];
  stop_reason: "end_turn" | "tool_use" | string;
}

interface ClaudeMessage {
  role: "user" | "assistant";
  content:
    | string
    | ContentBlock[]
    | Array<{ type: "tool_result"; tool_use_id: string; content: string }>;
}

interface KronosResult {
  resposta: string;
  iteracoes: number;
}

// ─────────────────────────────────────────
// SUPABASE ADMIN
// ─────────────────────────────────────────

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o KRONOS, agente de coaching clínico do Kronia.

REGRAS ABSOLUTAS:
1. SEMPRE busque os dados reais do usuário antes de qualquer resposta clínica
2. NUNCA invente valores de exames, peso, macros ou métricas
3. Se não houver dados suficientes, diga explicitamente o que está faltando
4. Cruze lab_reports + body_metrics + nutrition_goals + fadiga_scores antes de diagnosticar
5. Identifique padrões: overtraining, plateau, déficit proteico, disfunção hormonal
6. Seja direto, clínico e acionável — sem enrolação

FLUXO OBRIGATÓRIO para qualquer pergunta sobre saúde, dieta ou treino:
1. buscar_metricas_corporais → ver evolução de peso/composição corporal
2. buscar_metas_nutricionais → ver macros atuais
3. buscar_exames → ver lab_reports relevantes
4. buscar_fadiga → ver score de fadiga recente
5. buscar_suplementos → ver protocolo atual
6. Só então gerar resposta com base nos dados reais

Tom: clínico, direto, sem eufemismos. Você é um coach especializado, não um chatbot genérico.`;

// ─────────────────────────────────────────
// TOOLS
// ─────────────────────────────────────────

const TOOLS = [
  {
    name: "buscar_metricas_corporais",
    description:
      "Busca histórico de métricas corporais do usuário: peso, gordura corporal e medidas. " +
      "Use antes de qualquer análise de composição corporal ou evolução física.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "UUID do usuário" },
        limite: { type: "number", description: "Quantos registros retornar (padrão 10)" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "buscar_metas_nutricionais",
    description:
      "Busca as metas de macros e calorias mais recentes do usuário. " +
      "Use antes de qualquer recomendação de dieta ou análise de ingestão.",
    input_schema: {
      type: "object",
      properties: { user_id: { type: "string" } },
      required: ["user_id"],
    },
  },
  {
    name: "buscar_exames",
    description:
      "Busca exames laboratoriais do usuário (hemograma, lipídios, hormonal, etc). " +
      "Use para cruzar dados clínicos com sintomas, fadiga ou desempenho.",
    input_schema: {
      type: "object",
      properties: { user_id: { type: "string" } },
      required: ["user_id"],
    },
  },
  {
    name: "buscar_fadiga",
    description:
      "Busca scores de fadiga recentes do usuário. " +
      "Use para detectar overtraining, necessidade de deload ou ajuste de volume.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        dias: { type: "number", description: "Quantos dias para trás buscar (padrão 14)" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "buscar_suplementos",
    description:
      "Busca o protocolo de suplementação ativo do usuário. " +
      "Use para cruzar com sintomas ou recomendar ajustes.",
    input_schema: {
      type: "object",
      properties: { user_id: { type: "string" } },
      required: ["user_id"],
    },
  },
  {
    name: "criar_alerta",
    description:
      "Cria um alerta no sistema para o usuário (overtraining, plateau, déficit proteico). " +
      "Use quando identificar padrão clínico que exige atenção imediata.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        tipo: { type: "string", enum: ["overtraining", "plateau", "deficit_proteico"] },
        mensagem: { type: "string", description: "Mensagem clara do alerta para o usuário" },
      },
      required: ["user_id", "tipo", "mensagem"],
    },
  },
] as const;

// ─────────────────────────────────────────
// CHAMADA CLAUDE API
// ─────────────────────────────────────────

async function callClaudeMessages(
  messages: ClaudeMessage[],
  system: string,
  tools: typeof TOOLS
): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system,
      tools,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message || `Claude API error: ${response.status}`);
  }

  return response.json() as Promise<ClaudeResponse>;
}

// ─────────────────────────────────────────
// EXECUÇÃO DAS TOOLS
// ─────────────────────────────────────────

async function executeTool(name: string, input: ToolInput): Promise<string> {
  const supabase = getSupabaseAdmin();
  try {
    switch (name) {
      case "buscar_metricas_corporais": {
        const { data, error } = await supabase
          .from("body_metrics")
          .select("id, measured_at, weight_kg, body_fat_percent, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, notes")
          .eq("user_id", input.user_id)
          .order("measured_at", { ascending: false })
          .limit(input.limite ?? 10)
          .returns<BodyMetric[]>();
        if (error) throw error;
        return JSON.stringify(data);
      }

      case "buscar_metas_nutricionais": {
        const { data, error } = await supabase
          .from("nutrition_goals")
          .select("id, calories_target, protein_g, carbs_g, fat_g, fiber_g, water_ml, meal_strategy, updated_at")
          .eq("user_id", input.user_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .returns<NutritionGoal[]>();
        if (error) throw error;
        return JSON.stringify(data?.[0] ?? null);
      }

      case "buscar_exames": {
        const { data, error } = await supabase
          .from("lab_reports")
          .select("id, parsed, clinical_flags, critical_flags, parse_status, created_at")
          .eq("user_id", input.user_id)
          .eq("parse_status", "parsed")
          .order("created_at", { ascending: false })
          .limit(5)
          .returns<LabReport[]>();
        if (error) throw error;
        return JSON.stringify(data);
      }

      case "buscar_fadiga": {
        const diasAtras = input.dias ?? 14;
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - diasAtras);
        const { data, error } = await supabase
          .from("fadiga_scores")
          .select("id, score, notas, created_at")
          .eq("user_id", input.user_id)
          .gte("created_at", dataLimite.toISOString())
          .order("created_at", { ascending: false })
          .returns<FadigaScore[]>();
        if (error) throw error;
        return JSON.stringify(data);
      }

      case "buscar_suplementos": {
        const { data, error } = await supabase
          .from("supplement_protocols")
          .select("id, supplement_name, dosage, timing, purpose, notes, created_at")
          .eq("user_id", input.user_id)
          .eq("active", true)
          .returns<SupplementProtocol[]>();
        if (error) throw error;
        return JSON.stringify(data);
      }

      case "criar_alerta": {
        const tipo = input.tipo as AlertaTipo;
        const mensagem = input.mensagem;
        if (!tipo || !mensagem) throw new Error("criar_alerta requer tipo e mensagem");
        const { error } = await supabase.from("alertas_kronos").insert({
          user_id: input.user_id,
          tipo,
          mensagem,
          lido: false,
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

// ─────────────────────────────────────────
// LOOP AGÊNTICO
// ─────────────────────────────────────────

export async function runKronosAgent(
  userId: string,
  userMessage: string
): Promise<KronosResult> {
  const messages: ClaudeMessage[] = [{ role: "user", content: userMessage }];
  const MAX_ITERATIONS = 8;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await callClaudeMessages(messages, SYSTEM_PROMPT, TOOLS);
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
    );

    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      const textBlock = response.content.find(
        (b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text"
      );
      return { resposta: textBlock?.text ?? "", iteracoes: iterations };
    }

    const toolResults = await Promise.all(
      toolUses.map(async (t) => ({
        type: "tool_result" as const,
        tool_use_id: t.id,
        content: await executeTool(t.name, { ...t.input, user_id: userId }),
      }))
    );

    messages.push({ role: "user", content: toolResults });
  }

  return {
    resposta: "Limite de raciocínio atingido. Tente uma pergunta mais específica.",
    iteracoes: MAX_ITERATIONS,
  };
}
