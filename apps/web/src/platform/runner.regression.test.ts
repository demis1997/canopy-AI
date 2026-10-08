import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountClaim: vi.fn(), actionClaim: vi.fn(), update: vi.fn(), preflight: vi.fn(), record: vi.fn(), markSent: vi.fn(),
  incoming: vi.fn(), enqueue: vi.fn(),
}));
vi.mock("@canopy/database", () => ({ prisma: {
  platformAccount: { updateMany: mocks.accountClaim, update: mocks.update, findFirstOrThrow: vi.fn().mockResolvedValue({ externalAccountId: "1", authorizedAt: null }) },
  automationAction: { updateMany: mocks.actionClaim, update: mocks.update, findFirstOrThrow: vi.fn().mockResolvedValue({ platformAccountId: "account" }) },
  platformConversation: { findUnique: vi.fn().mockResolvedValue(null) }, product: { findFirst: vi.fn() },
} }));
vi.mock("../server/automation/service", () => ({
  acquireConversationLock: vi.fn(), generateAutomationDecision: vi.fn(), releaseConversationLock: vi.fn(),
  markActionSent: mocks.markSent, recordDeliveredBubble: mocks.record, preflightDelivery: mocks.preflight,
  upsertIncomingPlatformMessage: mocks.incoming, writeAutomationAudit: vi.fn(),
}));
vi.mock("../server/queue", () => ({ enqueueJob: mocks.enqueue }));
import { deliverAction, syncInbox } from "./runner";
import type { OnlyFansAdapter } from "./types";

const adapter = () => ({ detectAccount: vi.fn().mockResolvedValue({ externalAccountId: "1" }),
  detectConnectionState: vi.fn().mockResolvedValue("CONNECTED"), openConversation: vi.fn(),
  readFanMetadata: vi.fn().mockResolvedValue({ externalFanId: "2" }),
  sendMessage: vi.fn().mockImplementation(async (r) => ({ verified: true, ambiguous: false, externalMessageId: r.idempotencyKey, visibleText: r.text })),
}) as unknown as OnlyFansAdapter;

beforeEach(() => {
  vi.clearAllMocks(); mocks.accountClaim.mockResolvedValue({ count: 1 }); mocks.actionClaim.mockResolvedValue({ count: 1 });
  mocks.preflight.mockResolvedValue({ gate: { ok: true }, decision: { action: "SEND_TEXT", messages: ["Edited first bubble", "Edited second bubble"] },
    action: { platformAccount: { externalAccountId: "1", creatorId: "creator" }, platformConversation: { externalConversationId: "2", externalFanId: "2" } } });
  mocks.markSent.mockResolvedValue({ ok: true });
  mocks.incoming.mockResolvedValue({ created: true, platformConversation: { id: "thread" } });
});

describe("delivery regressions", () => {
  it("delivers and records every approved bubble separately", async () => {
    const a = adapter();
    expect(await deliverAction({ organizationId: "org", actionId: "action", adapter: a })).toEqual({ ok: true });
    expect(vi.mocked(a.sendMessage!).mock.calls.map((c) => c[0].text)).toEqual(["Edited first bubble", "Edited second bubble"]);
    expect(mocks.record.mock.calls.map((c) => c[0].text)).toEqual(["Edited first bubble", "Edited second bubble"]);
    expect(mocks.markSent).toHaveBeenCalledOnce();
  });
  it("sends only once when two workers race for an action", async () => {
    let claimed = false;
    mocks.actionClaim.mockImplementation(async () => { if (claimed) return { count: 0 }; claimed = true; return { count: 1 }; });
    const a = adapter();
    await Promise.all([deliverAction({ organizationId: "org", actionId: "action", adapter: a }), deliverAction({ organizationId: "org", actionId: "action", adapter: a })]);
    expect(a.sendMessage).toHaveBeenCalledTimes(2); // one action, two bubbles
    expect(mocks.markSent).toHaveBeenCalledOnce();
  });
  it("does not send with missing account identity", async () => {
    const a = adapter(); vi.mocked(a.detectAccount).mockResolvedValue({ externalAccountId: null, displayName: null });
    await deliverAction({ organizationId: "org", actionId: "action", adapter: a });
    expect(a.sendMessage).not.toHaveBeenCalled(); expect(mocks.markSent).not.toHaveBeenCalled();
  });
  it("does not retry an ambiguous receipt or mark the action sent", async () => {
    const a = adapter(); vi.mocked(a.sendMessage!).mockResolvedValue({ verified: false, ambiguous: true });
    await deliverAction({ organizationId: "org", actionId: "action", adapter: a });
    expect(a.sendMessage).toHaveBeenCalledOnce(); expect(mocks.markSent).not.toHaveBeenCalled();
  });
});

describe("inbox history before generation", () => {
  it("imports a creator reply before deciding whether the fan still needs an answer", async () => {
    const a = adapter(); a.listInboxConversations = vi.fn().mockResolvedValue([{ externalConversationId: "2", externalFanId: "2", externalFanDisplayName: "Fan" }]);
    a.detectNewMessages = vi.fn().mockResolvedValue([
      { externalMessageId: "f", direction: "INBOUND", body: "how are you?", messageType: "TEXT", sentAt: "2026-10-08T10:00:00Z" },
      { externalMessageId: "c", direction: "OUTBOUND", body: "I'm good", messageType: "TEXT", sentAt: "2026-10-08T10:00:01Z" },
    ]);
    await syncInbox({ organizationId: "org", platformAccountId: "account", adapter: a });
    expect(mocks.incoming.mock.calls.map((c) => c[0].direction)).toEqual(["INBOUND", "OUTBOUND"]);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
