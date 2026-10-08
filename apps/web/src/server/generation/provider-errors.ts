import { ProviderError, type LLMProvider, type GenerationInput } from "@canopy/ai";

export async function generateRepliesWithRetry(provider: LLMProvider, input: GenerationInput) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await provider.generateReplies(input);
    } catch (error) {
      lastError = error;
      const code = error instanceof ProviderError ? error.code : "UNKNOWN";
      // Transport retries already belong to the provider; only malformed output merits another generation.
      if (code !== "INVALID_JSON") throw error;
    }
  }
  throw lastError;
}

export function providerFailureMessage(code: string): string {
  switch (code) {
    case "TIMEOUT":
      return "The model took too long. Hit generate again — a page reload is not required.";
    case "RATE_LIMIT":
      return "The AI provider is rate-limiting. Wait a few seconds, then generate again.";
    case "INVALID_JSON":
      return "The model returned a messy reply. Hit generate again.";
    case "UNAVAILABLE":
      return "The AI provider was briefly unavailable. Hit generate again.";
    case "INVALID_KEY":
      return "The AI provider API key was rejected. Check AI provider settings.";
    case "CIRCUIT_OPEN":
      return "The provider is cooling down. Generate again in a few seconds.";
    default:
      return "The model missed that send. Hit generate again — a reload is not required.";
  }
}
