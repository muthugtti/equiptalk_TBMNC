interface Entry {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
}

const store = new Map<string, Entry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * @param key          Unique key for this rate-limit bucket (e.g. "login:1.2.3.4")
 * @param countRequest If true, increment the failure counter.
 *                     Pass false for a read-only pre-check (does not consume an attempt).
 */
export function checkRateLimit(
  key: string,
  countRequest = true
): { allowed: boolean; retryAfterMs?: number } {
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

  if (now - entry.windowStart > WINDOW_MS) {
    if (countRequest) {
      store.set(key, { count: 1, windowStart: now, lockedUntil: null });
    }
    return { allowed: true };
  }

  if (!countRequest) {
    return { allowed: true };
  }

  entry.count += 1;

  if (entry.count > MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    store.set(key, entry);
    return { allowed: false, retryAfterMs: LOCKOUT_MS };
  }

  store.set(key, entry);
  return { allowed: true };
}

export function clearRateLimit(key: string): void {
  store.delete(key);
}
