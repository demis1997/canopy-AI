import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createMockInboxState, MockOnlyFansAdapter } from "./mock-adapter";
import { processIncoming, syncInbox } from "./runner";

describe("mock platform end-to-end", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("syncs an inbound mock message, generates a decision, and verifies a copilot draft", async ({ skip }) => {
    try {
      await prisma.$connect();
    } catch {
      skip();
      return;
    }
    const account = await prisma.platformAccount.findFirst({
      where: { driver: "MOCK", autonomyMode: { not: "PAUSED" } },
    });
    if (!account) {
      skip();
      return;
    }
    const state = createMockInboxState();
    const adapter = new MockOnlyFansAdapter(state);
    const inbound = adapter.injectInbound("hey are you free to chat?");
    const sync = await syncInbox({
      organizationId: account.organizationId,
      platformAccountId: account.id,
      adapter,
    });
    expect(sync.state).toBe("CONNECTED");
    const stored = await prisma.platformMessage.findFirst({
      where: { organizationId: account.organizationId, externalMessageId: inbound.externalMessageId },
    });
    expect(stored).toBeTruthy();
    const action = await prisma.automationAction.findFirst({
      where: { organizationId: account.organizationId, triggerMessageId: stored?.id },
    });
    expect(action).toBeTruthy();
    expect(["APPROVAL_REQUIRED", "SCHEDULED", "CANCELLED", "SENT"]).toContain(action!.status);

    if (action && action.status === "SCHEDULED") {
      const delivered = await processIncoming({
        organizationId: account.organizationId,
        platformAccountId: account.id,
        platformConversationId: action.platformConversationId,
        triggerExternalMessageId: inbound.externalMessageId,
        adapter,
      });
      expect(delivered).toBeTruthy();
    }
  });
});
