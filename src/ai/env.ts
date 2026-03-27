function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

export const AI_ENV = {
  PROVIDER: process.env.AI_PROVIDER ?? "groq",
  GROQ_API_KEY: readEnv("GROQ_API_KEY"),
  MODEL: process.env.AI_CHAT_MODEL ?? "llama-3.3-70b-versatile",
  SUPABASE_URL: readEnv("SUPABASE_URL"),
  SUPABASE_ANON_KEY: readEnv("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  APP_ENV: process.env.APP_ENV ?? "development",
}
