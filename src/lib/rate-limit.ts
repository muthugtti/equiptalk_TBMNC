import type { NextRequest } from "next/server";

interface Entry {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

/** Best-effort client IP, accounting for Firebase Hosting/Cloud Run's forwarding headers. */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    (req as any).ip ??
    "127.0.0.1"
  );
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
}

// ---------------------------------------------------------------------------
// Distributed backend (Upstash Redis over REST).
//
// The in-memory Map below is process-local and does NOT survive Cloud Run
// scale-out — three instances each keep their own counter, so the effective
// limit is 3x. When UPSTASH_REDIS_REST_URL/TOKEN are configured we use Redis
// so the limit is shared across all instances. If Redis is unreachable we fall
// back to the in-memory counter rather than failing the request open.
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisEnabled = Boolean(REDIS_URL && REDIS_TOKEN);

async function redisPipeline(commands: (string | number)[][]): Promise<any[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    // Rate limiting must never hang a request; give Redis a tight budget.
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`Upstash REST ${res.status}`);
  const data = await res.json();
  return (data as Array<{ result: unknown }>).map((d) => d.result);
}

async function redisCheck(
  key: string,
  countRequest: boolean,
  maxAttempts: number,
  windowMs: number,
  lockoutMs: number
): Promise<RateLimitResult> {
  const cntKey = `rl:cnt:${key}`;
  const lockKey = `rl:lock:${key}`;

  // A live lockout short-circuits everything.
  const [lockTtl] = await redisPipeline([["PTTL", lockKey]]);
  if (typeof lockTtl === "number" && lockTtl > 0) {
    return { allowed: false, retryAfterMs: lockTtl };
  }

  // Read-only pre-check: don't consume an attempt.
  if (!countRequest) return { allowed: true };

  const [count] = await redisPipeline([["INCR", cntKey]]);
  const n = typeof count === "number" ? count : parseInt(String(count), 10);

  // First hit in a new window: attach the window TTL.
  if (n === 1) {
    await redisPipeline([["PEXPIRE", cntKey, windowMs]]);
  }

  if (n > maxAttempts) {
    await redisPipeline([["SET", lockKey, "1", "PX", lockoutMs]]);
    return { allowed: false, retryAfterMs: lockoutMs };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// In-memory fallback (process-local).
// ---------------------------------------------------------------------------

const store = new Map<string, Entry>();

function memoryCheck(
  key: string,
  countRequest: boolean,
  maxAttempts: number,
  windowMs: number,
  lockoutMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    if (countRequest) {
      store.set(key, { count: 1, windowStart: now, lockedUntil: null });
    }
    return { allowed: true };
  }

  if (entry.lockedUntil !== null && now < entry.lockedUntil) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  }

  if (now - entry.windowStart > windowMs) {
    if (countRequest) {
      store.set(key, { count: 1, windowStart: now, lockedUntil: null });
    }
    return { allowed: true };
  }

  if (!countRequest) {
    return { allowed: true };
  }

  entry.count += 1;

  if (entry.count > maxAttempts) {
    entry.lockedUntil = now + lockoutMs;
    store.set(key, entry);
    return { allowed: false, retryAfterMs: lockoutMs };
  }

  store.set(key, entry);
  return { allowed: true };
}

/**
 * @param key          Unique key for this rate-limit bucket (e.g. "login:1.2.3.4")
 * @param countRequest If true, increment the counter.
 *                     Pass false for a read-only pre-check (does not consume an attempt).
 * @param opts         Optional overrides for attempt/window/lockout thresholds —
 *                      defaults are tuned for login lockout, pass tighter/looser
 *                      values for other endpoints (e.g. chat, upload).
 */
export async function checkRateLimit(
  key: string,
  countRequest = true,
  opts: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const lockoutMs = opts.lockoutMs ?? LOCKOUT_MS;

  if (redisEnabled) {
    try {
      return await redisCheck(key, countRequest, maxAttempts, windowMs, lockoutMs);
    } catch (err) {
      // Redis down — degrade to the process-local counter instead of failing open.
      console.error("[RateLimit] Redis check failed, using in-memory fallback:", err);
    }
  }

  return memoryCheck(key, countRequest, maxAttempts, windowMs, lockoutMs);
}

export async function clearRateLimit(key: string): Promise<void> {
  if (redisEnabled) {
    try {
      await redisPipeline([
        ["DEL", `rl:cnt:${key}`],
        ["DEL", `rl:lock:${key}`],
      ]);
      return;
    } catch (err) {
      console.error("[RateLimit] Redis clear failed:", err);
    }
  }
  store.delete(key);
}
