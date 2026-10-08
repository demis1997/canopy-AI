import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
}));
vi.mock("@canopy/database", () => ({
  requireTenant: (organizationId: string) => ({ organizationId }),
  assertSameOrganization: vi.fn(),
  prisma: {
    automationAction: { findFirst: mocks.action, update: mocks.update, count: mocks.count },
    conversation: {
      findFirstOrThrow: vi
        .fn()
        .mockResolvedValue({ id: "conversation", adultStatus: "VERIFIED_ADULT" }),
    },
    creatorPersona: { findFirst: vi.fn().mockResolvedValue(null) },
    auditLog: { create: mocks.audit },
  },
}));
vi.mock("../generation", () => ({
  addSubscriberMessage: vi.fn(),
  generateForConversation: vi.fn(),
  recordAnalytics: vi.fn(),
  selectReply: vi.fn(),
}));
vi.mock("../analytics", () => ({ recordAnalytics: vi.fn() }));
import { preflightDelivery, approveAction } from "./service";
const decision = {
  action: "SEND_TEXT",
  messages: ["Original AI draft", "Original second bubble"],
  productId: null,
  price: null,
  confidence: 0.9,
  funnelStage: "RAPPORT",
  reason: "ok",
  scheduledDelaySeconds: 0,
  safetyFlags: [],
};
const action = () => ({
  id: "action",
  organizationId: "org",
  status: "APPROVAL_REQUIRED",
  generatedPayload: decision,
  finalPayload: null,
  platformAccountId: "account",
  platformConversationId: "thread",
  triggerMessageId: null,
  platformAccount: { id: "account", creatorId: "creator", autonomyMode: "COPILOT", policy: null },
  platformConversation: {
    externalFanId: "fan",
    canopyConversationId: "conversation",
    humanTakeover: false,
    automationLockedUntil: null,
  },
});

describe("operator approved payload", () => {
  it("validates and delivers the edited payload rather than the original draft", async () => {
    mocks.action
      .mockResolvedValueOnce({
        ...action(),
        finalPayload: { ...decision, messages: ["Operator edited reply"] },
      })
      .mockResolvedValueOnce(null);
    const result = await preflightDelivery({ organizationId: "org", actionId: "action" });
    expect(result.decision.messages).toEqual(["Operator edited reply"]);
    expect(result.gate.ok).toBe(true);
  });
  it("preserves all bubbles when approved without edits", async () => {
    mocks.action.mockResolvedValueOnce(action());
    await approveAction({ organizationId: "org", actionId: "action", userId: "operator" });
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          finalPayload: expect.objectContaining({ messages: decision.messages }),
        }),
      }),
    );
  });
  it("refuses reapproval or rejection of a sent action", async () => {
    mocks.action.mockResolvedValueOnce({ ...action(), status: "SENT" });
    await expect(
      approveAction({
        organizationId: "org",
        actionId: "action",
        userId: "operator",
        reject: true,
      }),
    ).rejects.toThrow("cannot be reviewed");
  });
});
