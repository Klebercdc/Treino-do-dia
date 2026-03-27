export type CheckStatus = 'OK' | 'WARNING' | 'ERROR';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  summary: string;
  details?: Record<string, unknown>;
  error?: string;
  suggestion?: string;
  fix_sql?: string;
}

export interface CheckContext {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  groqApiKey?: string;
  aiChatModel?: string;
}
