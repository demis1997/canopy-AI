const REDACT_KEYS = [
  "text",
  "message",
  "content",
  "prompt",
  "reply",
  "biography",
  "memory",
];

export function redactForLogs(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 24) return `[redacted ${value.length} chars]`;
    return "[redacted]";
  }
  if (Array.isArray(value)) return value.map(redactForLogs);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lower = k.toLowerCase();
      if (REDACT_KEYS.some((key) => lower.includes(key))) {
        out[k] = typeof v === "string" ? `[redacted ${v.length} chars]` : "[redacted]";
      } else {
        out[k] = redactForLogs(v);
      }
    }
    return out;
  }
  return value;
}

export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  if (secret.length <= 4) return "••••";
  return `••••${secret.slice(-4)}`;
}
