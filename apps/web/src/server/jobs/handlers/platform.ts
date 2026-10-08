import { prisma } from "@canopy/database";
import type { BackgroundJob } from "../contracts";

export async function processPlatformJob(
  job: Extract<
    BackgroundJob,
    {
      name:
        | "browser-heartbeat"
        | "generate-automation-decision"
        | "process-incoming-message"
        | "sync-platform-inbox"
        | "deliver-automation-action"
        | "reconcile-delivery"
        | "detect-purchase"
        | "send-follow-up";
    }
  >,
) {
  const { name, payload } = job;
  if (name === "browser-heartbeat" && payload.platformAccountId) {
    await prisma.platformAccount.updateMany({
      where: { id: payload.platformAccountId, organizationId: payload.organizationId },
      data: { lastHeartbeatAt: new Date() },
    });
  }

  if (
    (name === "generate-automation-decision" || name === "process-incoming-message") &&
    payload.platformAccountId &&
    payload.platformConversationId &&
    payload.triggerExternalMessageId
  ) {
    const { generateAutomationDecision } = await import("../../automation/service");
    await generateAutomationDecision({
      organizationId: payload.organizationId,
      platformAccountId: payload.platformAccountId,
      platformConversationId: payload.platformConversationId,
      triggerExternalMessageId: payload.triggerExternalMessageId,
    });
  }

  if (
    (name === "sync-platform-inbox" || name === "deliver-automation-action") &&
    payload.platformAccountId
  ) {
    const account = await prisma.platformAccount.findFirst({
      where: { id: payload.platformAccountId, organizationId: payload.organizationId },
    });
    if (!account) return;
    if (account.driver !== "MOCK") {
      if (name === "deliver-automation-action" && payload.actionId) {
        await prisma.automationAction.updateMany({
          where: {
            id: payload.actionId,
            organizationId: payload.organizationId,
            status: { in: ["SCHEDULED", "PENDING"] },
          },
          data: { status: "APPROVAL_REQUIRED", lastError: "BROWSER_WORKER_REQUIRED" },
        });
      }
      return;
    }
    const { MockOnlyFansAdapter, createMockInboxState } =
      await import("../../../platform/mock-adapter");
    const { syncInbox, deliverAction } = await import("../../../platform/runner");
    const adapter = new MockOnlyFansAdapter(createMockInboxState());
    if (name === "sync-platform-inbox") {
      await syncInbox({
        organizationId: payload.organizationId,
        platformAccountId: account.id,
        adapter,
      });
    } else if (payload.actionId) {
      await deliverAction({
        organizationId: payload.organizationId,
        actionId: payload.actionId,
        adapter,
      });
    }
  }

  if (name === "reconcile-delivery" && payload.organizationId) {
    const stale = new Date(Date.now() - 2 * 60 * 1000);
    await prisma.automationAction.updateMany({
      where: {
        organizationId: payload.organizationId,
        status: "SENDING",
        updatedAt: { lt: stale },
      },
      data: { status: "FAILED", lastError: "AMBIGUOUS_DELIVERY" },
    });
  }

  if (name === "detect-purchase" && payload.platformAccountId) {
    await prisma.platformAccount.updateMany({
      where: { id: payload.platformAccountId, organizationId: payload.organizationId },
      data: { lastHeartbeatAt: new Date() },
    });
  }

  if (name === "send-follow-up" && payload.platformAccountId && payload.platformConversationId) {
    const account = await prisma.platformAccount.findFirst({
      where: { id: payload.platformAccountId, organizationId: payload.organizationId },
      include: { policy: true },
    });
    if (!account?.policy?.followUpsEnabled || account.autonomyMode === "PAUSED") return;
    const { idempotencyKey } = await import("@canopy/shared");
    const thread = await prisma.platformConversation.findFirst({
      where: {
        id: payload.platformConversationId,
        organizationId: payload.organizationId,
        platformAccountId: account.id,
      },
    });
    if (!thread || thread.humanTakeover) return;
    const canopy = await prisma.conversation.findFirst({
      where: { id: thread.canopyConversationId, organizationId: payload.organizationId },
      select: { mutedAi: true },
    });
    if (canopy?.mutedAi) return;
    const key = idempotencyKey({
      platformAccountId: account.id,
      externalConversationId: thread.externalConversationId,
      triggerExternalMessageId: `followup-${thread.lastSyncedMessageId ?? "none"}`,
      actionType: "FOLLOW_UP",
    });
    await prisma.automationAction.upsert({
      where: { idempotencyKey: key },
      update: {},
      create: {
        organizationId: payload.organizationId,
        platformAccountId: account.id,
        platformConversationId: thread.id,
        actionType: "FOLLOW_UP",
        status: "APPROVAL_REQUIRED",
        idempotencyKey: key,
        escalationReason: "FOLLOW_UP_REQUIRES_APPROVAL",
        generatedPayload: {
          action: "SEND_TEXT",
          messages: ["hey — still here if you want the set"],
          productId: null,
          price: null,
          confidence: 0.4,
          funnelStage: "FOLLOW_UP",
          reason: "FOLLOW_UP",
          scheduledDelaySeconds: 0,
          safetyFlags: [],
        },
      },
    });
  }
}
