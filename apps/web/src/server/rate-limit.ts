/** Per-process protection, not a distributed quota. Storage is bounded and expired entries are swept. */
export class InMemoryRateLimiter {
  private readonly hits = new Map<string, { count: number; reset: number }>();
  private nextSweep = 0;
  constructor(
    private readonly windowMs = 60_000,
    private readonly maximumKeys = 10_000,
  ) {}
  allow(key: string, limit = 40): boolean {
    const now = Date.now();
    if (now >= this.nextSweep) {
      for (const [storedKey, hit] of this.hits) if (hit.reset <= now) this.hits.delete(storedKey);
      this.nextSweep = now + this.windowMs;
    }
    const current = this.hits.get(key);
    if (!current || current.reset <= now) {
      if (!current && this.hits.size >= this.maximumKeys) return false;
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      return true;
    }
    if (current.count >= limit) return false;
    current.count++;
    return true;
  }
}
const limiter = new InMemoryRateLimiter();
export function rateLimit(key: string, limit = 40) {
  return limiter.allow(key, limit);
}
