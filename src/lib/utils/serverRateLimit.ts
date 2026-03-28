/**
 * In-memory rate limiter for Next.js server routes.
 * Same semantics as api/_ratelimit.js but for TypeScript.
 *
 * Note: resets on cold starts (serverless). Suitable for burst protection,
 * not as a hard absolute limit.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.max - 1 };
  }

  if (entry.count >= opts.max) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: opts.max - entry.count };
}
