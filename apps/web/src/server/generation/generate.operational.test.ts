import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  conversation: vi.fn(),
  messages: vi.fn(),
  analytics: vi.fn(),
  skip: vi.fn(),
  provider: vi.fn(),
  training: vi.fn(),
}));
vi.mock("@canopy/database", () => ({
  requireTenant: (organizationId: string) => ({ organizationId }),
  prisma: {
    conversation: { findFirst: mocks.conversation },
    organization: { findUniqueOrThrow: vi.fn().mockResolvedValue({ status: "ACTIVE" }) },
    message: { findMany: mocks.messages },
    platformConversation: { findFirst: vi.fn().mockResolvedValue(null) },
    trainingChunk: { findMany: mocks.training },
  },
}));
vi.mock("../analytics", () => ({ recordAnalytics: mocks.analytics }));
vi.mock("../ai-provider", () => ({ resolveOrganizationProvider: mocks.provider }));
vi.mock("../operational-handoff", () => ({ persistOperationalSkip: mocks.skip }));
import { generateForConversation } from "./generate";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.conversation.mockResolvedValue({
    id: "conversation",
    creatorId: "creator",
    adultStatus: "VERIFIED_ADULT",
    creator: { personas: [{}] },
  });
});
it("a human request exits the actual generation pipeline before provider setup or retrieval", async () => {
  mocks.messages.mockResolvedValue([
    { id: "fan-message", authorType: "SUBSCRIBER", body: "please redirect me to a human" },
  ]);
  mocks.skip.mockResolvedValue({ skippedGeneration: true });
  await generateForConversation({
    organizationId: "org",
    userId: "user",
    conversationId: "conversation",
  });
  expect(mocks.skip).toHaveBeenCalledWith(
    expect.objectContaining({
      inputMessageIds: ["fan-message"],
      plan: expect.objectContaining({ skipClassify: true, skipGenerate: true, skipTraining: true }),
    }),
  );
  expect(mocks.provider).not.toHaveBeenCalled();
  expect(mocks.training).not.toHaveBeenCalled();
});
it("an answered trigger cannot generate a reply to the creator's own message", async () => {
  mocks.messages.mockResolvedValue([
    { id: "creator-message", authorType: "CHATTER", body: "I'm good" },
    { id: "fan-message", authorType: "SUBSCRIBER", body: "how are you?" },
  ]);
  const result = await generateForConversation({
    organizationId: "org",
    userId: "user",
    conversationId: "conversation",
    triggerMessageId: "fan-message",
  });
  expect(result).toMatchObject({ skippedGeneration: true, replyOptions: [] });
  expect(mocks.provider).not.toHaveBeenCalled();
  expect(mocks.analytics).not.toHaveBeenCalled();
});
