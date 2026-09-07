export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly threshold = 5,
    private readonly resetMs = 60_000,
  ) {}

  get open(): boolean {
    if (this.openedAt === null) return false;
    if (Date.now() - this.openedAt > this.resetMs) {
      this.failures = 0;
      this.openedAt = null;
      return false;
    }
    return true;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.open) {
      throw Object.assign(new Error("Circuit breaker open"), { code: "CIRCUIT_OPEN" });
    }
    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.threshold) {
        this.openedAt = Date.now();
      }
      throw error;
    }
  }
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: { retries: number; requestId: string; isRetryable: (error: unknown) => boolean },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!opts.isRetryable(error) || attempt === opts.retries) throw error;
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
