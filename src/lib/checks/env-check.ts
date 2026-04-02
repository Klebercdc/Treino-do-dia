const requiredRuntimeEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const;

export function validateRuntimeEnv() {
  const missing = requiredRuntimeEnv.filter((key) => !process.env[key]);

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length === 0
      ? 'Runtime environment OK'
      : `Missing required environment variables: ${missing.join(', ')}`,
  };
}

export function runEnvCheck() {
  const result = validateRuntimeEnv();

  if (!result.ok) {
    return {
      ok: false,
      message: `Environment check failed. Missing: ${result.missing.join(', ')}`,
    };
  }

  return { ok: true, message: 'Environment check passed' };
}
