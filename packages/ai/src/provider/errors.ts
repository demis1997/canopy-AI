export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TIMEOUT"
      | "RATE_LIMIT"
      | "UNAUTHORIZED"
      | "INVALID_KEY"
      | "UNAVAILABLE"
      | "INVALID_JSON"
      | "CIRCUIT_OPEN"
      | "UNKNOWN",
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function mapProviderError(error: unknown, requestId: string): ProviderError {
  if (error instanceof ProviderError) return error;
  const err = error as {
    status?: number;
    code?: string;
    message?: string;
    name?: string;
  };
  if (err?.name === "AbortError" || err?.code === "ETIMEDOUT") {
    return new ProviderError("Provider timed out", "TIMEOUT", 408, requestId);
  }
  if (err?.status === 401 || err?.status === 403) {
    return new ProviderError("Invalid or unauthorized API key", "INVALID_KEY", err.status, requestId);
  }
  if (err?.status === 429) {
    return new ProviderError("Provider rate limited", "RATE_LIMIT", 429, requestId);
  }
  if (err?.status && err.status >= 500) {
    return new ProviderError("Provider unavailable", "UNAVAILABLE", err.status, requestId);
  }
  return new ProviderError(err?.message ?? "Provider error", "UNKNOWN", err?.status, requestId);
}
