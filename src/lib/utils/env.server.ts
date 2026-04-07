export type RuntimeName = 'local' | 'preview' | 'production';

export interface RuntimeVarStatus {
  key: string;
  found: boolean;
  valueMasked: string;
}

export interface RuntimeEnvValidation {
  runtime: RuntimeName;
  source: 'env runtime' | 'vercel runtime';
  vars: RuntimeVarStatus[];
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface AIConfig {
  provider: 'groq';
  chatApiKey?: string;
  chatModel: string;
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function assertServerEnv() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_APP_URL'] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

export const optionalEnv = getOptionalEnv;
export const getOptionalEnvLegacy = getOptionalEnv;

export function assertServerOnlySecretNotPublic(name: string): void {
  if (name.startsWith('NEXT_PUBLIC_') || name.startsWith('VITE_')) {
    throw new Error(`Secret variable ${name} must not be public.`);
  }
}

export function getSupabaseConfig(target: 'server' | 'client' = 'server'): SupabaseConfig {
  if (target === 'client') {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return { url, anonKey };
  }

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return { url, anonKey, serviceRoleKey };
}

export function getAIConfig(options?: { requireChatKey?: boolean }): AIConfig {
  const provider: 'groq' = 'groq';
  const chatApiKey = getOptionalEnv('GROQ_API_KEY');
  const chatModel = getOptionalEnv('AI_CHAT_MODEL') ?? 'llama-3.3-70b-versatile';

  if (options?.requireChatKey && !chatApiKey) {
    throw new Error('GROQ_API_KEY não está carregada no runtime.');
  }

  return { provider, chatApiKey, chatModel };
}

export function maskSecret(value?: string): string {
  if (!value) return 'missing';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function validateRuntimeEnv(): RuntimeEnvValidation {
  const runtime: RuntimeName = process.env.VERCEL_ENV === 'production'
    ? 'production'
    : process.env.VERCEL_ENV === 'preview'
      ? 'preview'
      : 'local';

  const source: RuntimeEnvValidation['source'] = process.env.VERCEL ? 'vercel runtime' : 'env runtime';

  const vars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GROQ_API_KEY',
    'NEXT_PUBLIC_APP_URL',
    'EXAM_OCR_SERVICE_URL',
    'EXAM_OCR_TIMEOUT_MS',
  ].map((key) => {
    const value = getOptionalEnv(key);
    return {
      key,
      found: Boolean(value),
      valueMasked: maskSecret(value),
    };
  });

  return { runtime, source, vars };
}
