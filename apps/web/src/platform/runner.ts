import { randomUUID } from "node:crypto";
import { prisma } from "@canopy/database";
import {
  acquireConversationLock,
  generateAutomationDecision,
  markActionSent,
  recordDeliveredBubble,
  preflightDelivery,
  releaseConversationLock,
  upsertIncomingPlatformMessage,
  writeAutomationAudit,
} from "../server/automation/service";
import type { OnlyFansAdapter } from "./types";
import { AdapterClosedError } from "./types";
import { platformLog } from "./logger";

async function syncInboxUnlocked(input: {
  organizationId: string;
  platformAccountId: string;
  adapter: OnlyFansAdapter;
}) {
  const accountRecord = await prisma.platformAccount.findFirstOrThrow({ where: { id: input.platformAccountId, organizationId: input.organizationId } });
  const state = await input.adapter.detectConnectionState();
  await prisma.platformAccount.update({
    where: { id: input.platformAccountId },
    data: {
      connectionStatus: state,
      lastHeartbeatAt: new Date(),
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

  const identity = await input.adapter.detectAccount();
  if (!identity.externalAccountId || identity.externalAccountId !== accountRecord.externalAccountId) throw new Error("ACCOUNT_MISMATCH");
  const threads = await input.adapter.listInboxConversations();
  let processed = 0;
  for (const thread of threads) {
    await input.adapter.openConversation(thread.externalConversationId);
    const storedThread = await prisma.platformConversation.findUnique({ where: { platformAccountId_externalConversationId: { platformAccountId: input.platformAccountId, externalConversationId: thread.externalConversationId } } });
    const messages = (await input.adapter.detectNewMessages(storedThread?.lastSyncedMessageId)).sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || a.externalMessageId.localeCompare(b.externalMessageId, undefined, { numeric: true }));
    let latestPending: { id: string; externalId: string } | null = null;
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
        historical: !storedThread,
      });
      if (message.direction === "OUTBOUND") latestPending = null;
      if (result.created && message.direction === "INBOUND" && message.messageType === "TEXT" &&
        (storedThread || !accountRecord.authorizedAt || Date.parse(message.sentAt) >= accountRecord.authorizedAt.getTime())) {
        processed += 1;
        latestPending = { id: result.platformConversation.id, externalId: message.externalMessageId };
      }
    }
    if (latestPending) {
      const { enqueueJob } = await import("../server/queue");
      await enqueueJob("generate-automation-decision", {
        organizationId: input.organizationId, platformAccountId: input.platformAccountId,
        platformConversationId: latestPending.id, triggerExternalMessageId: latestPending.externalId,
      }, { delayMs: 3000, debounceKey: `generate-automation-decision-${latestPending.id}` });
    }
  }
  await prisma.platformAccount.update({ where: { id: input.platformAccountId }, data: { lastInboxSyncAt: new Date() } });
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
    return generated;
  } finally {
    await releaseConversationLock({
      organizationId: input.organizationId,
      platformConversationId: input.platformConversationId,
      token,
    });
  }
}

async function deliverActionUnlocked(input: {
  organizationId: string;
  actionId: string;
  adapter: OnlyFansAdapter;
}) {
  const claimed = await prisma.automationAction.updateMany({
    where: { id: input.actionId, organizationId: input.organizationId, status: "SCHEDULED",
      scheduledFor: { lte: new Date() } },
    data: { status: "SENDING", attemptCount: { increment: 1 } },
  });
  if (!claimed.count) return { sent: false as const, reason: "NOT_DUE_OR_ALREADY_CLAIMED" };
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
  if (!bubbles.length) {
    await prisma.automationAction.update({ where: { id: input.actionId }, data: { status: "FAILED", lastError: "EMPTY" } });
    return { sent: false as const, reason: "EMPTY" };
  }


  try {
    const account = await input.adapter.detectAccount();
    if (!account.externalAccountId || !preflight.action.platformAccount.externalAccountId) {
      throw new AdapterClosedError("SELECTOR_FAILURE", "Missing platform account identity");
    }
    {
      if (account.externalAccountId !== preflight.action.platformAccount.externalAccountId) {
        throw new AdapterClosedError("SELECTOR_FAILURE", "Wrong platform account in browser");
      }
    }
    await input.adapter.openConversation(preflight.action.platformConversation.externalConversationId);
    const fan = await input.adapter.readFanMetadata();
    if (fan.externalFanId !== preflight.action.platformConversation.externalFanId) {
      throw new AdapterClosedError("SELECTOR_FAILURE", "Wrong fan conversation open");
    }
    const paid = preflight.decision.action === "SEND_PPV";
    if (paid && !input.adapter.sendMessage) throw new Error("PPV_REQUIRES_VERIFIED_API_DELIVERY");
    const product = paid ? await prisma.product.findFirst({
      where: { id: preflight.decision.productId!, organizationId: input.organizationId,
        creatorId: preflight.action.platformAccount.creatorId, platformAccountId: preflight.action.platformAccountId,
        available: true, sourceAvailable: true },
      include: { media: { include: { media: true }, orderBy: { sortOrder: "asc" } }, previews: { include: { media: true }, orderBy: { sortOrder: "asc" } } },
    }) : null;
    if (paid && (!product || !product.media.length || product.media.some((m) => !m.media.externalId || !m.media.available))) {
      throw new Error("UNMAPPED_VAULT");
    }
    for (let i = 0; i < bubbles.length; i++) {
      // Re-check takeover, account mode and stale fan turns between bubbles.
      const gate = await preflightDelivery({ organizationId: input.organizationId, actionId: input.actionId });
      if (!gate.gate.ok) throw new Error(gate.gate.reason);
      const text = bubbles[i]!;
      const attach = paid && i === bubbles.length - 1;
      let verified;
      if (input.adapter.sendMessage) {
        verified = await input.adapter.sendMessage({ text, idempotencyKey: `${input.actionId}-${i}`,
          ...(attach ? { price: preflight.decision.price!, mediaIds: product!.media.map((m) => m.media.externalId!),
            previewIds: product!.previews.map((m) => m.media.externalId!) } : {}) });
      } else {
        await input.adapter.typeMessage(text);
        await input.adapter.sendCurrentMessage();
        verified = await input.adapter.verifySentMessage(text);
      }
      if (!verified.verified || verified.ambiguous || !verified.externalMessageId) throw new Error("AMBIGUOUS_DELIVERY");
      // Persist every bubble with OUTBOUND authorship before another sync/generation can see it.
      await recordDeliveredBubble({ organizationId: input.organizationId, actionId: input.actionId,
        externalMessageId: verified.externalMessageId, text, sentAt: verified.sentAt, paid: attach, price: attach ? preflight.decision.price : null });
    }
    return markActionSent({ organizationId: input.organizationId, actionId: input.actionId,
      externalMessageId: "", finalText: bubbles.join("\n") });
  } catch (error) {
    const reason = error instanceof AdapterClosedError ? error.code : "DELIVERY_FAILED_OR_AMBIGUOUS";
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

async function accountOperation<T>(organizationId: string, accountId: string, run: () => Promise<T>): Promise<T> {
  const token = randomUUID();
  const claim = await prisma.platformAccount.updateMany({ where: { id: accountId, organizationId,
    OR: [{ workerLockUntil: null }, { workerLockUntil: { lt: new Date() } }] },
    data: { workerLockToken: token, workerLockUntil: new Date(Date.now() + 120_000) } });
  if (!claim.count) throw new Error("PLATFORM_ACCOUNT_BUSY");
  // The worker must retain ownership throughout long paginated inbox imports.
  const renew = setInterval(() => {
    void prisma.platformAccount.updateMany({ where: { id: accountId, workerLockToken: token },
      data: { workerLockUntil: new Date(Date.now() + 120_000) } }).catch(() => {});
  }, 30_000);
  try { return await run(); }
  finally { clearInterval(renew); await prisma.platformAccount.updateMany({ where: { id: accountId, workerLockToken: token },
    data: { workerLockToken: null, workerLockUntil: null } }); }
}

export async function syncInbox(input: Parameters<typeof syncInboxUnlocked>[0]) {
  return accountOperation(input.organizationId, input.platformAccountId, () => syncInboxUnlocked(input));
}

export async function deliverAction(input: Parameters<typeof deliverActionUnlocked>[0]) {
  const action = await prisma.automationAction.findFirstOrThrow({ where: { id: input.actionId, organizationId: input.organizationId } });
  try { return await accountOperation(input.organizationId, action.platformAccountId, () => deliverActionUnlocked(input)); }
  catch (error) {
    await prisma.automationAction.updateMany({ where: { id: input.actionId, organizationId: input.organizationId, status: "SENDING" },
      data: { status: "FAILED", lastError: "DELIVERY_FAILED_OR_AMBIGUOUS" } });
    throw error;
  }
}
