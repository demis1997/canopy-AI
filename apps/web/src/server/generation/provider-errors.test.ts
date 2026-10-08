import { expect, it, vi } from "vitest";
import { ProviderError, type GenerationInput, type LLMProvider } from "@canopy/ai";
import { generateRepliesWithRetry } from "./provider-errors";
const input = {} as GenerationInput;
it("does not multiply exhausted transport retries at the application layer", async () => {
  for (const code of ["TIMEOUT", "RATE_LIMIT", "UNAVAILABLE", "INVALID_KEY", "UNKNOWN"] as const) {
    const generateReplies = vi
      .fn()
      .mockRejectedValue(new ProviderError("Synthetic failure", code, 503, "test"));
    await expect(
      generateRepliesWithRetry({ generateReplies } as unknown as LLMProvider, input),
    ).rejects.toThrow("Synthetic failure");
    expect(generateReplies).toHaveBeenCalledTimes(1);
  }
});
it("allows one fresh generation for malformed model output", async () => {
  const generateReplies = vi
    .fn()
    .mockRejectedValueOnce(new ProviderError("Malformed JSON", "INVALID_JSON", 502, "test"))
    .mockResolvedValueOnce({ replyOptions: [] });
  await generateRepliesWithRetry({ generateReplies } as unknown as LLMProvider, input);
  expect(generateReplies).toHaveBeenCalledTimes(2);
});
