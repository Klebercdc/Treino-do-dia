import { GroqClient } from "./modelClient"
import { AI_ENV } from "./env"
import { createClient } from "@supabase/supabase-js"

export interface SystemCheckResult {
  status: "OK" | "ERROR" | "SKIPPED"
  message: string
  details?: Record<string, unknown>
}

export interface FullSystemCheckResult {
  overall: "OK" | "DEGRADED" | "DOWN"
  checks: {
    ai: SystemCheckResult
    db: SystemCheckResult
    rag: SystemCheckResult
    embeddings: SystemCheckResult
  }
  timestamp: string
}

export async function runAiSystemCheck(): Promise<SystemCheckResult> {
  if (!process.env.GROQ_API_KEY) {
    return { status: "SKIPPED", message: "GROQ_API_KEY not configured" }
  }

  try {
    const client = new GroqClient()
    const res = await client.generate({
      systemPrompt: "Responda apenas com JSON válido.",
      messages: [{ role: "user", content: '{"ping":"ok"}' }],
      temperature: 0,
      maxTokens: 20,
    })
    if (!res) throw new Error("Sem resposta")
    return { status: "OK", message: "Groq funcionando" }
  } catch (error: unknown) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Erro na IA",
    }
  }
}

export async function runDbSystemCheck(): Promise<SystemCheckResult> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "SKIPPED", message: "Variáveis Supabase não configuradas" }
  }

  try {
    const db = createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { error } = await db.from("profiles").select("id").limit(0)
    if (error && /does not exist|relation/.test(error.message)) {
      return {
        status: "ERROR",
        message: "Tabela 'profiles' não encontrada. Execute sql/003_nutrition_schema.sql.",
        details: { error: error.message },
      }
    }
    if (error) {
      return {
        status: "ERROR",
        message: `Conexão com banco falhou: ${error.message}`,
      }
    }
    return { status: "OK", message: "Conexão com banco de dados OK" }
  } catch (error: unknown) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Erro ao conectar ao banco",
    }
  }
}

export async function runRagSystemCheck(): Promise<SystemCheckResult> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "SKIPPED", message: "Variáveis Supabase não configuradas" }
  }

  try {
    const db = createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { error } = await db.rpc("search_nutrition_knowledge", {
      search_query: "test",
      match_count: 1,
      category_filter: null,
    })

    if (error && /function.*does not exist/i.test(error.message)) {
      return {
        status: "ERROR",
        message: "Função search_nutrition_knowledge ausente. Execute sql/005_nutrition_functions.sql.",
        details: { error: error.message },
      }
    }

    return { status: "OK", message: "Função de busca RAG disponível" }
  } catch (error: unknown) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Erro no check RAG",
    }
  }
}

export async function runEmbeddingsSystemCheck(): Promise<SystemCheckResult> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "SKIPPED", message: "Variáveis Supabase não configuradas" }
  }

  try {
    const db = createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { count: total } = await db
      .from("nutrition_knowledge_chunks")
      .select("*", { count: "exact", head: true })

    const { count: nullCount } = await db
      .from("nutrition_knowledge_chunks")
      .select("*", { count: "exact", head: true })
      .is("embedding", null)

    if ((total ?? 0) === 0) {
      return { status: "SKIPPED", message: "Nenhum chunk de conhecimento cadastrado ainda" }
    }

    if ((nullCount ?? 0) > 0) {
      return {
        status: "ERROR",
        message: `${nullCount} de ${total} chunks sem embedding — busca semântica inoperante.`,
        details: { total, nullCount },
      }
    }

    return {
      status: "OK",
      message: `${total} chunks com embeddings populados`,
      details: { total },
    }
  } catch (error: unknown) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Erro no check de embeddings",
    }
  }
}

export async function runFullSystemCheck(): Promise<FullSystemCheckResult> {
  const [ai, db, rag, embeddings] = await Promise.all([
    runAiSystemCheck(),
    runDbSystemCheck(),
    runRagSystemCheck(),
    runEmbeddingsSystemCheck(),
  ])

  const checks = { ai, db, rag, embeddings }
  const hasError = Object.values(checks).some((c) => c.status === "ERROR")
  const hasSkipped = Object.values(checks).every((c) => c.status === "SKIPPED")

  return {
    overall: hasError ? "DOWN" : hasSkipped ? "DOWN" : "OK",
    checks,
    timestamp: new Date().toISOString(),
  }
}
