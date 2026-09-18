import { prisma } from "@canopy/database";
import {
  acquireConversationLock,
  generateAutomationDecision,
  markActionSent,
  preflightDelivery,
  releaseConversationLock,
  upsertIncomingPlatformMessage,
  writeAutomationAudit,
} from "../server/automation/service";
import type { OnlyFansAdapter } from "./types";
import { AdapterClosedError } from "./types";
import { platformLog } from "./logger";

export async function syncInbox(input: {
  organizationId: string;
  platformAccountId: string;
  adapter: OnlyFansAdapter;
}) {
  const state = await input.adapter.detectConnectionState();
  await prisma.platformAccount.update({
    where: { id: input.platformAccountId },
    data: {
      connectionStatus: state,
      lastHeartbeatAt: new Date(),
      lastInboxSyncAt: new Date(),
      manualInterventionReason:
        state === "CHALLENGE_REQUIRED" || state === "LOGIN_REQUIRED"
          ? "Manual intervention required in the creator browser session"
          : null,
    },
  });
  if (state !== "CONNECTED" && state !== "SYNCING") {
    platformLog("inbox_blocked", input, { state });
    return { state, processed: 0 };
  }

  const threads = await input.adapter.listInboxConversations();
  let processed = 0;
  for (const thread of threads) {
    await input.adapter.openConversation(thread.externalConversationId);
    const messages = await input.adapter.readVisibleMessages();
    for (const message of messages) {
      const result = await upsertIncomingPlatformMessage({
        organizationId: input.organizationId,
        platformAccountId: input.platformAccountId,
        externalConversationId: thread.externalConversationId,
        externalFanId: thread.externalFanId,
        externalFanDisplayName: thread.externalFanDisplayName,
        externalMessageId: message.externalMessageId,
        body: message.body,
        sentAt: new Date(message.sentAt),
        direction: message.direction,
        messageType: message.messageType,
        fromAutomation: false,
      });
      if (result.created && message.direction === "INBOUND") {
        processed += 1;
        const { enqueueJob } = await import("../server/queue");
        await enqueueJob(
          "generate-automation-decision",
          {
            organizationId: input.organizationId,
            platformAccountId: input.platformAccountId,
            platformConversationId: result.platformConversation.id,
            triggerExternalMessageId: message.externalMessageId,
          },
          {
            delayMs: 3000,
            debounceKey: `generate-automation-decision-${result.platformConversation.id}`,
          },
        );
      }
    }
  }
  return { state, processed };
}

export async function processIncoming(input: {
  organizationId: string;
  platformAccountId: string;
  platformConversationId: string;
  triggerExternalMessageId: string;
  adapter: OnlyFansAdapter;
}) {
  const token = await acquireConversationLock({
    organizationId: input.organizationId,
    platformConversationId: input.platformConversationId,
  });
  if (!token) {
    platformLog("lock_busy", input);
    return { skipped: true as const };
  }
  try {
    const generated = await generateAutomationDecision({
      organizationId: input.organizationId,
      platformAccountId: input.platformAccountId,
      platformConversationId: input.platformConversationId,
      triggerExternalMessageId: input.triggerExternalMessageId,
    });
    if (generated.status === "SCHEDULED") {
      return deliverAction({
        organizationId: input.organizationId,
        actionId: generated.actionId,
        adapter: input.adapter,
      });
    }
    return generated;
  } finally {
    await releaseConversationLock({
      organizationId: input.organizationId,
      platformConversationId: input.platformConversationId,
      token,
    });
  }
}

export async function deliverAction(input: {
  organizationId: string;
  actionId: string;
  adapter: OnlyFansAdapter;
}) {
  const preflight = await preflightDelivery({
    organizationId: input.organizationId,
    actionId: input.actionId,
  });
  if (!preflight.gate.ok) {
    await prisma.automationAction.update({
      where: { id: input.actionId },
      data: { status: "APPROVAL_REQUIRED", lastError: preflight.gate.reason },
    });
    return { sent: false as const, reason: preflight.gate.reason };
  }
  const bubbles = preflight.decision.messages.map((m) => m.trim()).filter(Boolean);
  if (!bubbles.length) return { sent: false as const, reason: "EMPTY" };

  await prisma.automationAction.update({
    where: { id: input.actionId },
    data: { status: "SENDING", attemptCount: { increment: 1 } },
  });

  try {
    const account = await input.adapter.detectAccount();
    if (account.externalAccountId && preflight.action.platformAccount.externalAccountId) {
      if (account.externalAccountId !== preflight.action.platformAccount.externalAccountId) {
        throw new AdapterClosedError("SELECTOR_FAILURE", "Wrong platform account in browser");
      }
    }
    await input.adapter.openConversation(preflight.action.platformConversation.externalConversationId);
    const fan = await input.adapter.readFanMetadata();
    if (fan.externalFanId !== preflight.action.platformConversation.externalFanId) {
      throw new AdapterClosedError("SELECTOR_FAILURE", "Wrong fan conversation open");
    }
    let lastVerify: { verified: boolean; ambiguous: boolean; externalMessageId?: string; visibleText?: string } | null =
      null;
    for (let i = 0; i < bubbles.length; i += 1) {
      const text = bubbles[i]!;
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 600));
      await input.adapter.typeMessage(text);
      await input.adapter.sendCurrentMessage();
      lastVerify = await input.adapter.verifySentMessage(text);
      if (!lastVerify.verified || lastVerify.ambiguous || !lastVerify.externalMessageId) {
        await prisma.automationAction.update({
          where: { id: input.actionId },
          data: { status: "FAILED", lastError: "AMBIGUOUS_DELIVERY" },
        });
        await writeAutomationAudit({
          organizationId: input.organizationId,
          action: "AUTOMATION_FAIL",
          entityType: "AutomationAction",
          entityId: input.actionId,
          metadata: { reason: "AMBIGUOUS_DELIVERY", bubble: i },
        });
        return { sent: false as const, reason: "AMBIGUOUS_DELIVERY" };
      }
    }
    return markActionSent({
      organizationId: input.organizationId,
      actionId: input.actionId,
      externalMessageId: lastVerify!.externalMessageId!,
      finalText: lastVerify?.visibleText ?? bubbles.join("\n"),
    });
  } catch (error) {
    const reason = error instanceof AdapterClosedError ? error.code : "DELIVERY_FAILED";
    await prisma.automationAction.update({
      where: { id: input.actionId },
      data: { status: reason === "CHALLENGE_REQUIRED" ? "APPROVAL_REQUIRED" : "FAILED", lastError: reason },
    });
    if (reason === "CHALLENGE_REQUIRED" || reason === "LOGIN_REQUIRED") {
      await prisma.platformAccount.update({
        where: { id: preflight.action.platformAccountId },
        data: { connectionStatus: reason, manualInterventionReason: reason },
      });
    }
    return { sent: false as const, reason };
  }
}
