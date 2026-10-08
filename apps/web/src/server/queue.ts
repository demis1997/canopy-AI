import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@canopy/database";
import { createLLMProvider } from "@canopy/ai";
import { randomUUID } from "node:crypto";

type JobName =
  | "summarize-conversation"
  | "extract-memories"
  | "embed-chunk"
  | "ingest-document"
  | "aggregate-analytics"
  | "follow-up-suggestions"
  | "retention-delete"
  | "provider-health"
  | "sync-platform-catalog"
  | "sync-platform-receipts"
  | "sync-platform-inbox"
  | "process-incoming-message"
  | "generate-automation-decision"
  | "deliver-automation-action"
  | "reconcile-delivery"
  | "detect-purchase"
  | "send-follow-up"
  | "browser-heartbeat";

type JobPayload = {
  organizationId: string;
  conversationId?: string;
  documentId?: string;
  chunkId?: string;
  platformAccountId?: string;
  platformConversationId?: string;
  triggerExternalMessageId?: string;
  actionId?: string;
  syncRunId?: string;
};

let connection: IORedis | null = null;
let queue: Queue<JobPayload, void, JobName> | null = null;

function getRedis(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    connection.on("error", () => {
      /* redis optional in local mock */
    });
  }
  return connection;
}

export function getQueue() {
  const redis = getRedis();
  if (!redis) return null;
  if (!queue) {
    queue = new Queue<JobPayload, void, JobName>("canopy", { connection: redis });
  }
  return queue;
}

export async function enqueueJob(
  name: JobName,
  payload: JobPayload,
  opts?: { delayMs?: number; debounceKey?: string },
) {
  const q = getQueue();
  if (!q) {
    await processJob(name, payload);
    return;
  }
  const jobId =
    opts?.debounceKey ??
    (name === "generate-automation-decision" && payload.triggerExternalMessageId
      ? `${name}-${payload.platformAccountId}-${payload.platformConversationId}-${payload.triggerExternalMessageId}`
      : name === "deliver-automation-action" && payload.actionId
        ? `${name}-${payload.actionId}`
        : name === "process-incoming-message" && payload.triggerExternalMessageId
          ? `${name}-${payload.platformConversationId}-${payload.triggerExternalMessageId}`
          : `${name}-${randomUUID()}`);
  if (opts?.debounceKey) {
    const existing = await q.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "delayed" || state === "waiting") {
        await existing.remove();
      }
    }
  }
  await q.add(name, payload, {
    jobId,
    delay: opts?.delayMs,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
  });
}

async function processJob(name: JobName, payload: JobPayload) {
  if (name === "sync-platform-catalog" && payload.platformAccountId && payload.syncRunId) {
    const { syncPlatformCatalog } = await import("./platform-catalog");
    await syncPlatformCatalog({ organizationId: payload.organizationId, platformAccountId: payload.platformAccountId, syncRunId: payload.syncRunId });
    return;
  }
  if (name === "sync-platform-receipts" && payload.platformAccountId) {
    const { syncPlatformReceipts } = await import("./platform-catalog");
    await syncPlatformReceipts({ organizationId: payload.organizationId, platformAccountId: payload.platformAccountId });
    return;
  }

  if (name === "summarize-conversation" && payload.conversationId) {
    const messages = await prisma.message.findMany({
      where: {
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const existing = await prisma.conversationSummary.findUnique({
      where: { conversationId: payload.conversationId },
    });
    const { provider } = createLLMProvider();
    const result = await provider.summarizeConversation({
      requestId: randomUUID(),
      messages: messages.reverse().map((m) => ({ authorType: m.authorType, body: m.body })),
      previousSummary: existing?.summary,
    });
    await prisma.conversationSummary.upsert({
      where: { conversationId: payload.conversationId },
      update: { summary: result.summary, messageCount: messages.length },
      create: {
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
        summary: result.summary,
        messageCount: messages.length,
      },
    });
  }

  if (name === "extract-memories" && payload.conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: payload.conversationId, organizationId: payload.organizationId },
    });
    if (!conversation) return;
    const messages = await prisma.message.findMany({
      where: {
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const { provider } = createLLMProvider();
    const extracted = await provider.extractMemories({
      requestId: randomUUID(),
      messages: messages.reverse().map((m) => ({
        id: m.id,
        authorType: m.authorType,
        body: m.body,
      })),
    });
    for (const update of extracted.updates) {
      if (update.confidence < 0.5 || !messages.some((m) => m.id === update.sourceMessageId && m.authorType === "SUBSCRIBER")) continue;
      await prisma.subscriberMemory.create({
        data: {
          organizationId: payload.organizationId,
          subscriberId: conversation.subscriberId,
          creatorId: conversation.creatorId,
          category: (update.category as "INTERESTS") ?? "PERSONAL_DETAILS",
          key: update.key.slice(0, 80),
          value: update.value.slice(0, 500),
          sourceMessageId: update.sourceMessageId,
          confidence: update.confidence,
          verified: false,
          sensitivity: "INTERNAL",
        },
      });
    }
  }

  if (name === "browser-heartbeat" && payload.platformAccountId) {
    await prisma.platformAccount.updateMany({
      where: { id: payload.platformAccountId, organizationId: payload.organizationId },
      data: { lastHeartbeatAt: new Date() },
    });
  }

  if (name === "generate-automation-decision" && payload.platformAccountId && payload.platformConversationId && payload.triggerExternalMessageId) {
    const { generateAutomationDecision } = await import("./automation/service");
    await generateAutomationDecision({
      organizationId: payload.organizationId,
      platformAccountId: payload.platformAccountId,
      platformConversationId: payload.platformConversationId,
      triggerExternalMessageId: payload.triggerExternalMessageId,
    });
  }

  if (name === "process-incoming-message" && payload.platformAccountId && payload.platformConversationId && payload.triggerExternalMessageId) {
    const { generateAutomationDecision } = await import("./automation/service");
    await generateAutomationDecision({
      organizationId: payload.organizationId,
      platformAccountId: payload.platformAccountId,
      platformConversationId: payload.platformConversationId,
      triggerExternalMessageId: payload.triggerExternalMessageId,
    });
  }

  if ((name === "sync-platform-inbox" || name === "deliver-automation-action") && payload.platformAccountId) {
    const { readFeatureFlags } = await import("@canopy/shared");
    const flags = readFeatureFlags();
    const account = await prisma.platformAccount.findFirst({
      where: { id: payload.platformAccountId, organizationId: payload.organizationId },
    });
    if (!account) return;
    if (account.driver !== "MOCK") {
      if (name === "deliver-automation-action" && payload.actionId) {
        await prisma.automationAction.updateMany({
          where: { id: payload.actionId, organizationId: payload.organizationId, status: { in: ["SCHEDULED", "PENDING"] } },
          data: { status: "APPROVAL_REQUIRED", lastError: "BROWSER_WORKER_REQUIRED" },
        });
      }
      return;
    }
    const { MockOnlyFansAdapter, createMockInboxState } = await import("../platform/mock-adapter");
    const { syncInbox, deliverAction } = await import("../platform/runner");
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
      where: { id: payload.platformConversationId, organizationId: payload.organizationId },
    });
    if (!thread || thread.humanTakeover) return;
    const canopy = await prisma.conversation.findFirst({
      where: { id: thread.canopyConversationId },
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

  if (name === "provider-health") {
    const { provider } = createLLMProvider();
    const health = await provider.healthCheck();
    await prisma.lLMProviderConfiguration.updateMany({
      data: {
        lastHealthCheckAt: new Date(),
        lastHealthOk: health.ok,
        lastLatencyMs: health.latencyMs,
        lastError: health.error,
      },
    });
  }
}

export function startWorker() {
  const redis = getRedis();
  if (!redis) {
    console.log("Canopy worker: REDIS_URL missing, jobs run inline");
    return;
  }
  const worker = new Worker<JobPayload, void, JobName>(
    "canopy",
    async (job: Job<JobPayload, void, JobName>) => {
      await processJob(job.name, job.data);
    },
    { connection: redis, concurrency: 4 },
  );
  worker.on("failed", (job, err) => {
    console.error("job failed", job?.name, err.message);
  });
  return worker;
}
