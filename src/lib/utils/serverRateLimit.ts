interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
const RATE_LIMIT_PREFIX = process.env.RATE_LIMIT_PREFIX ?? 'kronia:ratelimit';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSec: number;
  resetAt: number;
  backend: 'upstash-redis' | 'local-memory';
  fallback?: boolean;
  category: string;
}

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  category?: string;
}

function checkRateLimitLocal(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return {
      allowed: true,
      remaining: opts.max - 1,
      limit: opts.max,
      retryAfterSec: Math.max(1, Math.ceil(opts.windowMs / 1000)),
      resetAt: now + opts.windowMs,
      backend: 'local-memory',
      category: opts.category ?? 'default',
    };
  }

  if (entry.count >= opts.max) {
    return {
      allowed: false,
      remaining: 0,
      limit: opts.max,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      resetAt: entry.resetAt,
      backend: 'local-memory',
      category: opts.category ?? 'default',
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: opts.max - entry.count,
    limit: opts.max,
    retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    resetAt: entry.resetAt,
    backend: 'local-memory',
    category: opts.category ?? 'default',
  };
}

function sanitizeRedisKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const category = opts.category ?? 'default';
  const namespacedKey = `${key}:c:${category}`;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return checkRateLimitLocal(namespacedKey, { ...opts, category });
  }

  try {
    const redisKey = `${RATE_LIMIT_PREFIX}:${sanitizeRedisKey(namespacedKey)}`;
    const ttlSec = Math.max(1, Math.ceil(opts.windowMs / 1000));
    const response = await fetch(`${UPSTASH_URL.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, ttlSec, 'NX'],
        ['TTL', redisKey],
      ]),
    });

    if (!response.ok) {
      throw new Error(`Upstash HTTP ${response.status}`);
    }

    const payload = (await response.json()) as Array<{ result: number | string }>;
    const count = Number(payload?.[0]?.result ?? 0);
    const ttlRaw = Number(payload?.[2]?.result ?? ttlSec);
    const ttl = Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : ttlSec;
    const now = Date.now();

    return {
      allowed: count <= opts.max,
      remaining: Math.max(0, opts.max - count),
      limit: opts.max,
      retryAfterSec: Math.max(1, ttl),
      resetAt: now + ttl * 1000,
      backend: 'upstash-redis',
      category,
    };
  } catch {
    return { ...checkRateLimitLocal(namespacedKey, { ...opts, category }), fallback: true };
  }
}
