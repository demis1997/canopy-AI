import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  conversation: vi.fn(),
  messages: vi.fn(),
  fanNote: vi.fn(),
  saveNote: vi.fn(),
  createGeneration: vi.fn(),
  createOption: vi.fn(),
  provider: vi.fn(),
  classify: vi.fn(),
  generate: vi.fn(),
  analytics: vi.fn(),
}));
vi.mock("@canopy/database", () => ({
  requireTenant: (organizationId: string) => ({ organizationId }),
  prisma: {
    conversation: { findFirst: mocks.conversation },
    organization: { findUniqueOrThrow: vi.fn().mockResolvedValue({ status: "ACTIVE" }) },
    message: {
      findMany: mocks.messages,
      count: vi.fn().mockResolvedValue(3),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    subscriberMemory: { findMany: vi.fn().mockResolvedValue([]) },
    fanNote: { findUnique: mocks.fanNote, upsert: mocks.saveNote },
    purchase: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    trainingChunk: { findMany: vi.fn().mockResolvedValue([]) },
    replyOption: { findMany: vi.fn().mockResolvedValue([]), create: mocks.createOption },
    generation: { create: mocks.createGeneration },
    escalation: { create: vi.fn().mockResolvedValue({ id: "escalation" }) },
  },
}));
vi.mock("../analytics", () => ({ recordAnalytics: mocks.analytics }));
vi.mock("../ai-provider", () => ({ resolveOrganizationProvider: mocks.provider }));
import { generateForConversation } from "./generate";
import type { GenerationOutput } from "@canopy/shared";
const output = (texts: string[]): GenerationOutput => ({
  intent: "FLIRT",
  funnelStage: "INTEREST",
  explicitnessLevel: "FLIRTY",
  recommendedAction: "REPLY",
  replyOptions: texts.map((text) => ({
    text,
    messages: [text],
    tone: "ROMANTIC",
    internalReason: "Respond to interest",
  })),
  recommendedProductId: null,
  approvedPrice: null,
  requiresHumanReview: false,
  riskFlags: [],
  memoryUpdates: [],
  suggestedFunnelTransition: null,
});
const result = (texts: string[]) => ({
  output: output(texts),
  rawText: "",
  latencyMs: 1,
  promptTokens: 10,
  completionTokens: 10,
  model: "qwen",
  requestId: "test",
  repaired: false,
});
const run = () =>
  generateForConversation({
    organizationId: "org",
    userId: "operator",
    conversationId: "conversation",
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.conversation.mockResolvedValue({
    id: "conversation",
    creatorId: "creator",
    subscriberId: "fan",
    adultStatus: "VERIFIED_ADULT",
    funnelStage: "RAPPORT",
    offers: [],
    unansweredFollowUps: 0,
    offerCountToday: 0,
    rapportPriority: false,
    creator: {
      isDemo: false,
      personas: [
        {
          displayName: "Maya",
          biography: "Adult creator",
          authorisedBackstory: "Likes music",
          personality: "Affectionate",
          tone: "warm",
          typicalMessageLength: "SHORT",
          preferredEmojis: [],
          frequentlyUsedPhrases: [],
          preferredExplicitVocabulary: [],
          prohibitedWords: [],
          preferredCompliments: [],
          allowedExplicitness: "FLIRTY",
          style: "AFFECTIONATE",
          interests: [],
          contentBoundaries: [],
          claimsNeverToMake: [],
          customContentRules: "",
          offlineMeetingPolicy: "never",
          discountLimitPercent: 0,
          approvedExampleMessages: [],
        },
      ],
    },
    subscriber: { displayName: "Alex", spendCents: 0, notes: "" },
  });
  mocks.messages.mockImplementation((query: { take: number }) =>
    query.take === 10
      ? []
      : [
          {
            id: "fan-1",
            authorType: "SUBSCRIBER",
            body: "I really like you",
            createdAt: new Date("2026-10-21T12:00:00Z"),
          },
        ],
  );
  mocks.fanNote.mockResolvedValue(null);
  mocks.saveNote.mockResolvedValue({});
  mocks.provider.mockResolvedValue({
    provider: { classifyIntent: mocks.classify, generateReplies: mocks.generate },
    mode: "openai-compatible",
    model: "qwen",
  });
  mocks.classify.mockResolvedValue({ intent: "FLIRT", confidence: 0.9 });
  mocks.generate.mockResolvedValue(
    result(["I like how open you're being. I'm enjoying this conversation."]),
  );
  mocks.createGeneration.mockImplementation(({ data }) => ({ id: "generation", ...data }));
  mocks.createOption.mockImplementation(({ data }) => ({ id: "option", ...data }));
});
it("the production pipeline preserves a direct reply, tracks progress and retains approval", async () => {
  const generated = await run();
  expect(generated).toMatchObject({ status: "COMPLETED", requiresHumanReview: true });
  expect(generated.replyOptions[0]?.text).toContain("I'm enjoying this conversation");
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({
      progression: expect.objectContaining({ stage: "MUTUAL_INTEREST" }),
      intakeOpportunity: false,
    }),
  );
  expect(mocks.createGeneration).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        diagnostics: expect.objectContaining({
          conversationQuality: expect.any(Object),
          candidateEvaluations: expect.any(Array),
        }),
      }),
    }),
  );
  expect(
    mocks.saveNote.mock.calls[0]?.[0].update.extra.conversation_progression_conversation,
  ).toContain("MUTUAL_INTEREST");
});
it("retries evasive candidates with specific failure codes and full context", async () => {
  mocks.generate.mockResolvedValueOnce(result(["maybe, maybe not"]));
  expect((await run()).replyOptions[0]?.text).toContain("I'm enjoying this conversation");
  expect(mocks.generate).toHaveBeenCalledTimes(2);
  expect(mocks.generate.mock.calls[1]?.[0]).toMatchObject({
    correctiveRetry: true,
    recentMessages: [expect.objectContaining({ body: "I really like you" })],
  });
});
it("never offers a canned fallback or sendable draft after two failed attempts", async () => {
  mocks.generate.mockResolvedValue(result(["you're trouble"]));
  expect(await run()).toMatchObject({ status: "INVALID", escalated: true, replyOptions: [] });
  expect(mocks.generate).toHaveBeenCalledTimes(2);
  expect(mocks.createOption).not.toHaveBeenCalled();
});
it("filters a bad option without discarding the good candidate", async () => {
  mocks.generate.mockResolvedValue(
    result(["you're trouble", "I like how open you're being with me."]),
  );
  expect((await run()).replyOptions[0]?.text).toBe("i like how open you're being with me.");
  expect(mocks.generate).toHaveBeenCalledTimes(1);
});
it("age uncertainty exits before classification and generation", async () => {
  const conversation = await mocks.conversation();
  mocks.conversation.mockResolvedValue({ ...conversation, adultStatus: "UNCERTAIN" });
  expect(await run()).toMatchObject({ blocked: true, replyOptions: [] });
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.classify).not.toHaveBeenCalled();
});
it("provides concrete quality failures to the corrective generation", async () => {
  mocks.generate.mockResolvedValueOnce(result(["maybe, maybe not"]));
  await run();
  expect(mocks.generate.mock.calls[1]?.[0].correctiveCodes).toContain("GENERIC_DEFLECTION");
});
