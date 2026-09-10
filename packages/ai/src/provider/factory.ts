import { MockLLMProvider } from "./mock.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { LLMProvider } from "./types.js";

export type ProviderMode = "mock" | "venice" | "openrouter" | "openai";

export function readProviderEnv(env: NodeJS.Dict<string> = process.env) {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = env[key];
      if (value) return value;
    }
    return "";
  };
  const name = (pick("AI_PROVIDER", "LLM_PROVIDER") || "venice").toLowerCase();
  const defaults: Record<string, string> = {
    venice: "https://api.venice.ai/api/v1",
    openrouter: "https://openrouter.ai/api/v1",
    openai: "https://api.openai.com/v1",
  };
  return {
    name: (["venice", "openrouter", "openai"].includes(name) ? name : "venice") as Exclude<
      ProviderMode,
      "mock"
    >,
    apiKey: pick("AI_API_KEY", "LLM_API_KEY"),
    baseURL: pick("AI_BASE_URL", "LLM_BASE_URL") || defaults[name] || defaults.venice,
    model: pick("AI_MODEL", "LLM_MODEL"),
    fallbackModel: pick("AI_FALLBACK_MODEL"),
    timeoutMs: Number(pick("AI_TIMEOUT_MS", "LLM_TIMEOUT_MS") || 30_000),
    retries: Number(env.LLM_MAX_RETRIES || 2),
  };
}

export function createLLMProvider(opts?: {
  apiKey?: string;
  baseURL?: string;
  forceMock?: boolean;
  provider?: string;
  defaultModel?: string;
}): { provider: LLMProvider; mode: ProviderMode } {
  const cfg = readProviderEnv();
  const apiKey = opts?.apiKey ?? cfg.apiKey;
  if (opts?.forceMock || !apiKey) {
    return { provider: new MockLLMProvider(), mode: "mock" };
  }
  const name = (opts?.provider ?? cfg.name) as Exclude<ProviderMode, "mock">;
  const baseURL =
    opts?.baseURL ??
    cfg.baseURL ??
    (name === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.venice.ai/api/v1");
  const extraHeaders =
    name === "openrouter"
      ? {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://canopy.local",
          "X-Title": "Canopy",
        }
      : undefined;
  return {
    provider: new OpenAICompatibleProvider({
      apiKey,
      baseURL,
      timeoutMs: cfg.timeoutMs,
      retries: cfg.retries,
      defaultModel: opts?.defaultModel ?? cfg.model,
      fallbackModel: cfg.fallbackModel,
      extraHeaders,
    }),
    mode: name,
  };
}
