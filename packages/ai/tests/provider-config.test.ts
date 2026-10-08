import { afterEach, expect, it, vi } from "vitest";
const construct = vi.hoisted(() => vi.fn());
vi.mock("../src/provider/openai-compatible.js", () => ({ OpenAICompatibleProvider: construct }));
import { createLLMProvider, readProviderEnv } from "../src/provider/factory.js";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("rejects malformed retry and timeout settings rather than passing NaN into retries", () => {
  for (const value of ["NaN", "-1", "1.5", "6"])
    expect(() => readProviderEnv({ LLM_MAX_RETRIES: value })).toThrow("Invalid LLM_MAX_RETRIES");
  expect(() => readProviderEnv({ AI_TIMEOUT_MS: "zero" })).toThrow("Invalid AI_TIMEOUT_MS");
  expect(() => readProviderEnv({ AI_PROVIDER: "typo" })).toThrow("Unsupported AI provider");
  expect(readProviderEnv({ LLM_MAX_RETRIES: "0" }).retries).toBe(0);
});
it("trims empty preferred aliases and respects legacy settings", () => {
  expect(
    readProviderEnv({
      AI_PROVIDER: " ",
      LLM_PROVIDER: "openrouter",
      AI_API_KEY: " ",
      LLM_API_KEY: "synthetic-key",
    }),
  ).toMatchObject({
    name: "openrouter",
    apiKey: "synthetic-key",
    baseURL: "https://openrouter.ai/api/v1",
  });
});
it("chooses the endpoint of an explicitly selected provider", () => {
  vi.stubEnv("AI_PROVIDER", "venice");
  vi.stubEnv("AI_BASE_URL", "https://api.venice.ai/api/v1");
  const result = createLLMProvider({ apiKey: "synthetic-key", provider: "openrouter" });
  expect(result.mode).toBe("openrouter");
  expect(construct).toHaveBeenCalledWith(
    expect.objectContaining({ baseURL: "https://openrouter.ai/api/v1" }),
  );
});

it("does not implicitly reuse a different provider's environment credential", () => {
  vi.stubEnv("AI_PROVIDER", "venice");
  vi.stubEnv("AI_API_KEY", "synthetic-venice-key");
  expect(createLLMProvider({ provider: "openrouter" }).mode).toBe("mock");
  expect(construct).not.toHaveBeenCalled();
});
