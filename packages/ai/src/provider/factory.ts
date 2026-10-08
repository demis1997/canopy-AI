import { MockLLMProvider } from "./mock.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { LLMProvider } from "./types.js";

export type ProviderMode = "mock" | "venice" | "openrouter" | "openai";

const BASE_URLS = {
  venice: "https://api.venice.ai/api/v1",
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
} as const;

function providerName(value: string): Exclude<ProviderMode, "mock"> {
  if (value !== "venice" && value !== "openrouter" && value !== "openai")
    throw new Error("Unsupported AI provider");
  return value;
}

function integerSetting(
  value: string,
  fallback: number,
  field: string,
  minimum: number,
  maximum: number,
) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`Invalid ${field}`);
  return parsed;
}

export function readProviderEnv(env: NodeJS.Dict<string> = process.env) {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = env[key];
      if (value?.trim()) return value.trim();
    }
    return "";
  };
  const name = providerName((pick("AI_PROVIDER", "LLM_PROVIDER") || "venice").toLowerCase());
  return {
    name,
    apiKey: pick("AI_API_KEY", "LLM_API_KEY"),
    baseURL: pick("AI_BASE_URL", "LLM_BASE_URL") || BASE_URLS[name],
    model: pick("AI_MODEL", "LLM_MODEL"),
    fallbackModel: pick("AI_FALLBACK_MODEL"),
    timeoutMs: integerSetting(
      pick("AI_TIMEOUT_MS", "LLM_TIMEOUT_MS"),
      60_000,
      "AI_TIMEOUT_MS",
      1,
      300_000,
    ),
    retries: integerSetting(pick("LLM_MAX_RETRIES"), 3, "LLM_MAX_RETRIES", 0, 5),
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
  const name = providerName(opts?.provider ?? cfg.name);
  const apiKey = opts?.apiKey ?? (name === cfg.name ? cfg.apiKey : "");
  if (opts?.forceMock || !apiKey) {
    return { provider: new MockLLMProvider(), mode: "mock" };
  }
  const baseURL = opts?.baseURL ?? (name === cfg.name ? cfg.baseURL : BASE_URLS[name]);
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
      defaultModel: opts?.defaultModel ?? (name === cfg.name ? cfg.model : ""),
      fallbackModel: name === cfg.name ? cfg.fallbackModel : "",
      extraHeaders,
    }),
    mode: name,
  };
}
