import { MockLLMProvider } from "./mock.js";
import { VeniceLLMProvider } from "./venice.js";
import type { LLMProvider } from "./types.js";

export function createLLMProvider(opts?: {
  apiKey?: string;
  baseURL?: string;
  forceMock?: boolean;
}): { provider: LLMProvider; mode: "venice" | "mock" } {
  const apiKey = opts?.apiKey ?? process.env.LLM_API_KEY ?? "";
  if (opts?.forceMock || !apiKey) {
    return { provider: new MockLLMProvider(), mode: "mock" };
  }
  return {
    provider: new VeniceLLMProvider({
      apiKey,
      baseURL: opts?.baseURL ?? process.env.LLM_BASE_URL,
    }),
    mode: "venice",
  };
}
