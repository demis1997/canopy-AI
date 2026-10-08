import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@canopy/database";
import { acquireConversationLock, emergencyStop, releaseConversationLock } from "./service";

describe("automation persistence", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("isolates platform accounts, dedupes messages, locks conversations and emergency-stops", async ({ skip }) => {
    try {
      await prisma.$connect();
    } catch (error) {
      if (process.env.CI) throw error;
      skip();
      return;
    }
    const account = await prisma.platformAccount.findFirst({ include: { policy: true } });
    if (!account) {
      skip();
      return;
    }
    const foreign = await prisma.organization.findFirst({
      where: { slug: "isolation-test" },
    });
    expect(foreign).toBeTruthy();
    const leaked = await prisma.platformAccount.findFirst({
      where: { id: account.id, organizationId: foreign!.id },
    });
    expect(leaked).toBeNull();

    const conversation = await prisma.conversation.findFirst({
      where: { organizationId: account.organizationId, creatorId: account.creatorId },
    });
    if (!conversation) {
      skip();
      return;
    }
    const thread = await prisma.platformConversation.upsert({
      where: {
        platformAccountId_externalConversationId: {
          platformAccountId: account.id,
          externalConversationId: "of_thread_test",
        },
      },
      update: {},
      create: {
        organizationId: account.organizationId,
        platformAccountId: account.id,
        canopyConversationId: conversation.id,
        externalConversationId: "of_thread_test",
        externalFanId: "fan_test",
        externalFanDisplayName: "Test Fan",
      },
    });

    const first = await prisma.platformMessage.create({
      data: {
        organizationId: account.organizationId,
        platformConversationId: thread.id,
        externalMessageId: "dup_1",
        direction: "INBOUND",
        body: "hello",
        sentAt: new Date(),
      },
    });
    await expect(
      prisma.platformMessage.create({
        data: {
          organizationId: account.organizationId,
          platformConversationId: thread.id,
          externalMessageId: "dup_1",
          direction: "INBOUND",
          body: "hello",
          sentAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    expect(first.externalMessageId).toBe("dup_1");

    const tokenA = await acquireConversationLock({
      organizationId: account.organizationId,
      platformConversationId: thread.id,
    });
    const tokenB = await acquireConversationLock({
      organizationId: account.organizationId,
      platformConversationId: thread.id,
    });
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeNull();
    await releaseConversationLock({
      organizationId: account.organizationId,
      platformConversationId: thread.id,
      token: tokenA!,
    });

    const owner = await prisma.organizationMembership.findFirst({
      where: { organizationId: account.organizationId, role: "AGENCY_OWNER" },
    });
    if (owner) {
      await emergencyStop({
        organizationId: account.organizationId,
        platformAccountId: account.id,
        userId: owner.userId,
      });
      const paused = await prisma.platformAccount.findUniqueOrThrow({ where: { id: account.id } });
      expect(paused.autonomyMode).toBe("PAUSED");
      await prisma.platformAccount.update({
        where: { id: account.id },
        data: { autonomyMode: "AUTOPILOT", connectionStatus: "CONNECTED", manualInterventionReason: null },
      });
    }
  });
});
