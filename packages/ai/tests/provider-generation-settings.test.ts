import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mock.create } };
  },
}));
import { VeniceLLMProvider } from "../src/provider/venice.js";
import { generationSettingsFromEnv } from "../src/provider/generation-settings.js";
import type { GenerationInput } from "../src/provider/types.js";

const input: GenerationInput = {
  requestId: "settings",
  model: "qwen",
  promptVersionId: "test",
  persona: {
    displayName: "Maya",
    biography: "",
    authorisedBackstory: "",
    personality: "direct",
    tone: "warm",
    typicalMessageLength: "SHORT",
    preferredEmojis: [],
    frequentlyUsedPhrases: [],
    preferredExplicitVocabulary: [],
    prohibitedWords: [],
    preferredCompliments: [],
    allowedExplicitness: "FLIRTY",
    style: "DIRECT",
    interests: [],
    contentBoundaries: [],
    claimsNeverToMake: [],
    customContentRules: "",
    offlineMeetingPolicy: "never",
    discountLimitPercent: 0,
    approvedExampleMessages: [],
  },
  recentMessages: [{ authorType: "SUBSCRIBER", body: "hello" }],
  memories: [],
  products: [],
  funnelStage: "RAPPORT",
  playbook: "RAPPORT",
  retrievedExamples: [],
};
const output = {
  intent: "CASUAL_CHAT",
  funnelStage: "RAPPORT",
  explicitnessLevel: "FLIRTY",
  recommendedAction: "REPLY",
  replyOptions: [
    { text: "Hi, good to hear from you.", tone: "DIRECT", internalReason: "greeting" },
  ],
  recommendedProductId: null,
  approvedPrice: null,
  requiresHumanReview: true,
  riskFlags: [],
  memoryUpdates: [],
  suggestedFunnelTransition: null,
};
const completion = () => ({
  choices: [{ message: { content: JSON.stringify(output) } }],
  usage: { prompt_tokens: 20, completion_tokens: 10 },
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.create.mockResolvedValue(completion());
});
it("bounds standard settings and requires explicit support for vendor extensions", () => {
  expect(() => generationSettingsFromEnv({ AI_TOP_P: "2" })).toThrow();
  expect(() => generationSettingsFromEnv({ AI_MAX_OUTPUT_TOKENS: "NaN" })).toThrow();
  expect(() => generationSettingsFromEnv({ AI_REPETITION_PENALTY: "1.1" })).toThrow(
    "explicit endpoint support",
  );
  expect(
    generationSettingsFromEnv({
      AI_REPETITION_PENALTY: "1.1",
      AI_REPETITION_PENALTY_SUPPORTED: "true",
    }).repetitionPenalty,
  ).toBe(1.1);
});
it("sends configured sampling and token limits and preserves provider casing", async () => {
  const provider = new VeniceLLMProvider({
    apiKey: "synthetic",
    generationSettings: { temperature: 0.5, topP: 0.85, frequencyPenalty: 0.4, maxTokens: 1000 },
  });
  const result = await provider.generateReplies(input);
  const request = mock.create.mock.calls[0]?.[0];
  expect(request).toMatchObject({
    temperature: 0.5,
    top_p: 0.85,
    frequency_penalty: 0.4,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });
  expect(request).not.toHaveProperty("repetition_penalty");
  expect(result.output.replyOptions[0]?.text).toBe("Hi, good to hear from you.");
  expect(result.promptTokens).toBe(20);
});
it("includes repetition penalty only when explicitly configured", async () => {
  await new VeniceLLMProvider({
    apiKey: "synthetic",
    generationSettings: { repetitionPenalty: 1.05 },
  }).generateReplies(input);
  expect(mock.create.mock.calls[0]?.[0]).toHaveProperty("repetition_penalty", 1.05);
});
it("retains configured limits and prior context during JSON repair", async () => {
  mock.create.mockResolvedValueOnce({ choices: [{ message: { content: "invalid" } }] });
  const result = await new VeniceLLMProvider({
    apiKey: "synthetic",
    generationSettings: { maxTokens: 1024 },
  }).generateReplies(input);
  expect(result.repaired).toBe(true);
  expect(mock.create.mock.calls[1]?.[0]).toMatchObject({ temperature: 0.2, max_tokens: 1024 });
  expect(mock.create.mock.calls[1]?.[0].messages).toContainEqual({
    role: "assistant",
    content: "invalid",
  });
});
it("traces the exact synthetic system request and unvalidated raw response before parsing", async () => {
  const events: import("../src/provider/types.js").SyntheticTraceEvent[] = [];
  await new VeniceLLMProvider({ apiKey: "synthetic" }).generateReplies({
    ...input,
    syntheticTrace: { kind: "SYNTHETIC_ONLY", emit: (event) => events.push(event) },
  });
  expect(events.map((event) => event.stage)).toEqual([
    "provider-request",
    "provider-raw-response",
    "provider-parse",
  ]);
  const request = events[0];
  expect(request?.stage === "provider-request" && request.messages[0]?.role).toBe("system");
  const raw = events[1];
  expect(raw?.stage === "provider-raw-response" && raw.rawText).toBe(JSON.stringify(output));
  expect(JSON.stringify(events)).not.toContain("Authorization");
});
it("a diagnostic sink failure cannot change generation behavior", async () => {
  const result = await new VeniceLLMProvider({ apiKey: "synthetic" }).generateReplies({
    ...input,
    syntheticTrace: {
      kind: "SYNTHETIC_ONLY",
      emit: () => {
        throw new Error("Synthetic logging failure");
      },
    },
  });
  expect(result.output.replyOptions[0]?.text).toBe("Hi, good to hear from you.");
});
