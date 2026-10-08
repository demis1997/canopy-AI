import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  conversation: vi.fn(),
  messages: vi.fn(),
  summary: vi.fn(),
  saveSummary: vi.fn(),
  saveMemory: vi.fn(),
  healthUpdate: vi.fn(),
  provider: vi.fn(),
  summarize: vi.fn(),
  extract: vi.fn(),
  health: vi.fn(),
}));
vi.mock("@canopy/database", () => ({
  MemoryCategory: { INTERESTS: "INTERESTS" },
  prisma: {
    conversation: { findFirst: mocks.conversation },
    message: { findMany: mocks.messages },
    conversationSummary: { findFirst: mocks.summary, upsert: mocks.saveSummary },
    subscriberMemory: { create: mocks.saveMemory },
    lLMProviderConfiguration: { updateMany: mocks.healthUpdate },
  },
}));
vi.mock("../ai-provider", () => ({ resolveOrganizationProvider: mocks.provider }));
import { processJob } from "./dispatch";
import { parseJob } from "./contracts";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.provider.mockResolvedValue({
    provider: {
      summarizeConversation: mocks.summarize,
      extractMemories: mocks.extract,
      healthCheck: mocks.health,
    },
  });
  mocks.conversation.mockResolvedValue({
    id: "conversation",
    creatorId: "creator",
    subscriberId: "fan",
  });
});
describe("background job contracts and tenant isolation", () => {
  it("rejects incomplete or unknown jobs before touching data or providers", async () => {
    await expect(processJob("extract-memories", { organizationId: "org" })).rejects.toThrow();
    await expect(processJob("unknown", { organizationId: "org" })).rejects.toThrow();
    expect(mocks.conversation).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(() => parseJob("provider-health", { organizationId: " " })).toThrow();
  });
  it("cannot read another organization's summary by supplying its conversation ID", async () => {
    mocks.conversation.mockResolvedValue(null);
    await expect(
      processJob("summarize-conversation", { organizationId: "org-a", conversationId: "foreign" }),
    ).rejects.toThrow("not found in organization");
    expect(mocks.summary).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(mocks.conversation).toHaveBeenCalledWith({
      where: { organizationId: "org-a", id: "foreign" },
      select: { id: true },
    });
  });
  it("uses the scoped provider and summary for an owned conversation", async () => {
    mocks.messages.mockResolvedValue([
      { id: "message", authorType: "SUBSCRIBER", body: "synthetic hello" },
    ]);
    mocks.summary.mockResolvedValue({ summary: "synthetic prior summary" });
    mocks.summarize.mockResolvedValue({ summary: "synthetic summary" });
    await processJob("summarize-conversation", {
      organizationId: "org-a",
      conversationId: "conversation",
    });
    expect(mocks.provider).toHaveBeenCalledWith("org-a");
    expect(mocks.summary).toHaveBeenCalledWith({
      where: { organizationId: "org-a", conversationId: "conversation" },
    });
    expect(mocks.saveSummary).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ organizationId: "org-a" }) }),
    );
  });
  it("persists only memories attributed to an actual fan message with a valid category", async () => {
    mocks.messages.mockResolvedValue([
      { id: "fan-message", authorType: "SUBSCRIBER", body: "I like hiking" },
      { id: "creator-message", authorType: "CHATTER", body: "I'm good" },
    ]);
    const update = {
      key: "interest",
      value: "hiking",
      confidence: 0.9,
      category: "INTERESTS",
      sourceMessageId: "fan-message",
    };
    mocks.extract.mockResolvedValue({
      updates: [
        update,
        { ...update, sourceMessageId: "creator-message" },
        { ...update, sourceMessageId: "foreign" },
        { ...update, category: "invented" },
      ],
    });
    await processJob("extract-memories", {
      organizationId: "org-a",
      conversationId: "conversation",
    });
    expect(mocks.saveMemory).toHaveBeenCalledTimes(1);
    expect(mocks.saveMemory).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        sourceMessageId: "fan-message",
        category: "INTERESTS",
      }),
    });
  });
  it("updates only the job's organization's provider health", async () => {
    mocks.health.mockResolvedValue({ ok: true, latencyMs: 5 });
    await processJob("provider-health", { organizationId: "org-a" });
    expect(mocks.healthUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org-a" },
      data: expect.objectContaining({ lastHealthOk: true }),
    });
  });
});
