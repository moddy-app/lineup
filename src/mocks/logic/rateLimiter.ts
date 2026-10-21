/**
 * Fixed-window counters like the backend's Redis keys (LINEUP.md §0 "Limites
 * de débit", §15): `INCR`, `EXPIRE` on the first hit, blocked above the limit
 * with the key's remaining TTL as `retry_after`.
 *
 *   reports   10 per hour and person   (lineup:reports:rate:{user_id})
 *   verify    5 per 10 minutes         (lineup:verify_attempts:{user_id})
 *   refresh   1 per minute and server  (lineup:guild_refresh:{guild_id})
 */

export interface RateResult {
  allowed: boolean;
  /** Seconds until the window ends (≥ 1). Meaningful when blocked. */
  retryAfter: number;
  count: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, {count: number; resetAt: number}>();

  /** Counts one hit on `key`. The attempt that goes over `limit` is refused. */
  hit(key: string, limit: number, windowMs: number, now: number): RateResult {
    let entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = {count: 0, resetAt: now + windowMs};
      this.windows.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= limit,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      count: entry.count,
    };
  }

  /** Seconds left on `key`, or 0 when it has no live window. */
  ttl(key: string, now: number): number {
    const entry = this.windows.get(key);
    return entry && entry.resetAt > now ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) : 0;
  }

  reset(): void {
    this.windows.clear();
  }
}
