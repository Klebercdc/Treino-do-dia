export type CheckStatus = 'OK' | 'WARNING' | 'ERROR';

export interface CheckResult {
  step: string;
  status: CheckStatus;
  description: string;
  details?: Record<string, unknown>;
  error?: string;
  suggestion?: string;
  suggestedSql?: string;
  durationMs?: number;
}

export interface CheckContext {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  aiApiKey?: string;
  aiApiUrl: string;
  aiEmbeddingModel: string;
  testUserPassword: string;
}

export interface RuntimeContext {
  checkContext: CheckContext;
  state: Record<string, unknown>;
}
