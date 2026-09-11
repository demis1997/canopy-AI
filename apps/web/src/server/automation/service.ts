import { randomUUID } from "node:crypto";
import { prisma, requireTenant, assertSameOrganization } from "@canopy/database";
import type { Prisma } from "@prisma/client";
import { evaluateAutomationSafety } from "@canopy/ai";
import {
  automationDecisionSchema,
  confidenceFromGeneration,
  evaluateDeliveryGates,
  extraAutomationFlags,
  idempotencyKey,
  readFeatureFlags,
  routeAutonomy,
  type AutomationDecision,
  type AutomationPolicySnapshot,
  type AutonomyMode,
  splitReplyBubbles,
  type FeatureFlags,
} from "@canopy/shared";
import { addSubscriberMessage, generateForConversation, recordAnalytics, selectReply } from "../generate";

export { readFeatureFlags };

export function policySnapshot(row: {
  minimumConfidence: number;
  maximumPpvPriceCents: number;
  minimumReplyDelaySeconds: number;
  maximumReplyDelaySeconds: number;
  maximumMessagesPerHourPerFan: number;
  welcomeEnabled: boolean;
  followUpsEnabled: boolean;
  ppvEnabled: boolean;
  quietHours: unknown;
  allowedProductIds: string[];
  humanTakeoverMinutes: number;
  allowedLanguages: string[];
}): AutomationPolicySnapshot {
  return {
    minimumConfidence: row.minimumConfidence,
    maximumPpvPriceCents: row.maximumPpvPriceCents,
    minimumReplyDelaySeconds: row.minimumReplyDelaySeconds,
    maximumReplyDelaySeconds: row.maximumReplyDelaySeconds,
    maximumMessagesPerHourPerFan: row.maximumMessagesPerHourPerFan,
    welcomeEnabled: row.welcomeEnabled,
    followUpsEnabled: row.followUpsEnabled,
    ppvEnabled: row.ppvEnabled,
    quietHours: (row.quietHours as AutomationPolicySnapshot["quietHours"]) ?? null,
    allowedProductIds: row.allowedProductIds,
    humanTakeoverMinutes: row.humanTakeoverMinutes,
    allowedLanguages: row.allowedLanguages,
  };
}

export async function writeAutomationAudit(input: {
  organizationId: string;
  userId?: string | null;
  action:
    | "CONNECT_PLATFORM"
    | "DISCONNECT_PLATFORM"
    | "EMERGENCY_STOP"
    | "AUTOMATION_SEND"
    | "AUTOMATION_FAIL"
    | "CONFIGURE_AUTONOMY"
    | "APPROVE_AUTOMATION"
    | "ESCALATE";
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const safe = { ...(input.metadata ?? {}) };
  delete safe.body;
  delete safe.cookies;
  delete safe.authorization;
  delete safe.profilePath;
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: safe as Prisma.InputJsonValue,
    },
  });
}

export async function emergencyStop(input: {
  organizationId: string;
  platformAccountId: string;
  userId: string;
  reason?: string;
}) {
  const tenant = requireTenant(input.organizationId);
  const account = await prisma.platformAccount.findFirst({
    where: { id: input.platformAccountId, organizationId: tenant.organizationId },
  });
  if (!account) throw new Error("Platform account not found");
  await prisma.$transaction([
    prisma.platformAccount.update({
      where: { id: account.id },
      data: {
        autonomyMode: "PAUSED",
        connectionStatus: "PAUSED",
        manualInterventionReason: input.reason ?? "Emergency stop",
      },
    }),
    prisma.automationAction.updateMany({
      where: {
        organizationId: tenant.organizationId,
        platformAccountId: account.id,
        status: { in: ["PENDING", "GENERATING", "SCHEDULED", "APPROVAL_REQUIRED"] },
      },
      data: { status: "CANCELLED", lastError: "Emergency stop" },
    }),
  ]);
  await writeAutomationAudit({
    organizationId: tenant.organizationId,
    userId: input.userId,
    action: "EMERGENCY_STOP",
    entityType: "PlatformAccount",
    entityId: account.id,
  });
  return { ok: true as const };
}

export async function acquireConversationLock(input: {
  organizationId: string;
  platformConversationId: string;
  ttlMs?: number;
}): Promise<string | null> {
  const token = randomUUID();
  const until = new Date(Date.now() + (input.ttlMs ?? 45_000));
  const result = await prisma.platformConversation.updateMany({
    where: {
      id: input.platformConversationId,
      organizationId: input.organizationId,
      OR: [{ processingLockUntil: null }, { processingLockUntil: { lt: new Date() } }],
    },
    data: { processingLockToken: token, processingLockUntil: until },
  });
  return result.count === 1 ? token : null;
}

export async function releaseConversationLock(input: {
  organizationId: string;
  platformConversationId: string;
  token: string;
}) {
  await prisma.platformConversation.updateMany({
    where: {
      id: input.platformConversationId,
      organizationId: input.organizationId,
      processingLockToken: input.token,
    },
    data: { processingLockToken: null, processingLockUntil: null },
  });
}

export async function markHumanTakeover(input: {
  organizationId: string;
  platformConversationId: string;
  minutes: number;
}) {
  const until = new Date(Date.now() + input.minutes * 60_000);
  await prisma.$transaction([
    prisma.platformConversation.update({
      where: { id: input.platformConversationId },
      data: { humanTakeover: true, automationLockedUntil: until },
    }),
    prisma.automationAction.updateMany({
      where: {
        organizationId: input.organizationId,
        platformConversationId: input.platformConversationId,
        status: { in: ["PENDING", "GENERATING", "SCHEDULED"] },
      },
      data: { status: "CANCELLED", lastError: "Human takeover" },
    }),
  ]);
}

export async function releaseHumanTakeover(input: {
  organizationId: string;
  platformConversationId: string;
}) {
  await prisma.platformConversation.update({
    where: { id: input.platformConversationId },
    data: { humanTakeover: false, automationLockedUntil: null },
  });
}

async function actorUserId(organizationId: string, fallbackUserId?: string) {
  if (fallbackUserId) return fallbackUserId;
  const owner = await prisma.organizationMembership.findFirst({
    where: { organizationId, role: { in: ["AGENCY_OWNER", "MANAGER"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) throw new Error("No operator user available for automation");
  return owner.userId;
}

export async function upsertIncomingPlatformMessage(input: {
  organizationId: string;
  platformAccountId: string;
  externalConversationId: string;
  externalFanId: string;
  externalFanDisplayName: string;
  externalMessageId: string;
  body: string;
  sentAt: Date;
  direction: "INBOUND" | "OUTBOUND";
  messageType?: "TEXT" | "PPV" | "TIP" | "MEDIA" | "SYSTEM";
  fromAutomation?: boolean;
}) {
  const tenant = requireTenant(input.organizationId);
  const account = await prisma.platformAccount.findFirst({
    where: { id: input.platformAccountId, organizationId: tenant.organizationId },
    include: { policy: true },
  });
  if (!account) throw new Error("Platform account not found");
  await assertSameOrganization(tenant, account.organizationId);

  const subscriber = await prisma.subscriber.upsert({
    where: {
      organizationId_platform_platformHandle: {
        organizationId: tenant.organizationId,
        platform: "onlyfans",
        platformHandle: input.externalFanId,
      },
    },
    update: { displayName: input.externalFanDisplayName, lastActiveAt: input.sentAt },
    create: {
      organizationId: tenant.organizationId,
      displayName: input.externalFanDisplayName,
      platformHandle: input.externalFanId,
      platform: "onlyfans",
      adultStatus: "PLATFORM_ASSUMED_ADULT",
      lastActiveAt: input.sentAt,
    },
  });

  const conversation = await prisma.conversation.upsert({
    where: {
      organizationId_creatorId_subscriberId: {
        organizationId: tenant.organizationId,
        creatorId: account.creatorId,
        subscriberId: subscriber.id,
      },
    },
    update: { lastMessageAt: input.sentAt, platformThreadId: input.externalConversationId },
    create: {
      organizationId: tenant.organizationId,
      creatorId: account.creatorId,
      subscriberId: subscriber.id,
      lastMessageAt: input.sentAt,
      platformThreadId: input.externalConversationId,
      adultStatus: subscriber.adultStatus,
    },
  });

  const platformConversation = await prisma.platformConversation.upsert({
    where: {
      platformAccountId_externalConversationId: {
        platformAccountId: account.id,
        externalConversationId: input.externalConversationId,
      },
    },
    update: {
      externalFanDisplayName: input.externalFanDisplayName,
      lastActivityAt: input.sentAt,
      lastSyncedMessageId: input.externalMessageId,
    },
    create: {
      organizationId: tenant.organizationId,
      platformAccountId: account.id,
      canopyConversationId: conversation.id,
      externalConversationId: input.externalConversationId,
      externalFanId: input.externalFanId,
      externalFanDisplayName: input.externalFanDisplayName,
      lastSyncedMessageId: input.externalMessageId,
      lastActivityAt: input.sentAt,
    },
  });

  const existing = await prisma.platformMessage.findUnique({
    where: {
      platformConversationId_externalMessageId: {
        platformConversationId: platformConversation.id,
        externalMessageId: input.externalMessageId,
      },
    },
  });
  if (existing) {
    return { created: false as const, platformConversation, platformMessage: existing, conversation };
  }

  let canopyMessageId: string | undefined;
  if (input.direction === "INBOUND") {
    const added = await addSubscriberMessage({
      organizationId: tenant.organizationId,
      conversationId: conversation.id,
      text: input.body,
    });
    canopyMessageId = added.message.id;
  } else {
    const outgoing = await prisma.message.create({
      data: {
        organizationId: tenant.organizationId,
        conversationId: conversation.id,
        authorType: "CHATTER",
        body: input.body,
        aiAssisted: false,
      },
    });
    canopyMessageId = outgoing.id;
    if (!input.fromAutomation) {
      await markHumanTakeover({
        organizationId: tenant.organizationId,
        platformConversationId: platformConversation.id,
        minutes: account.policy?.humanTakeoverMinutes ?? 30,
      });
    }
  }

  const platformMessage = await prisma.platformMessage.create({
    data: {
      organizationId: tenant.organizationId,
      platformConversationId: platformConversation.id,
      canopyMessageId,
      externalMessageId: input.externalMessageId,
      direction: input.direction,
      messageType: input.messageType ?? "TEXT",
      body: input.body,
      sentAt: input.sentAt,
      deliveryStatus: input.direction === "INBOUND" ? "RECEIVED" : "VERIFIED",
    },
  });

  return { created: true as const, platformConversation, platformMessage, conversation };
}

export async function generateAutomationDecision(input: {
  organizationId: string;
  platformAccountId: string;
  platformConversationId: string;
  triggerExternalMessageId: string;
  actorUserId?: string;
  flags?: FeatureFlags;
}): Promise<{ decision: AutomationDecision; actionId: string; status: string }> {
  const flags = input.flags ?? readFeatureFlags();
  const tenant = requireTenant(input.organizationId);
  const account = await prisma.platformAccount.findFirst({
    where: { id: input.platformAccountId, organizationId: tenant.organizationId },
    include: { policy: true, creator: { include: { personas: { where: { isActive: true }, take: 1 } } } },
  });
  if (!account) throw new Error("Platform account not found");
  const platformConversation = await prisma.platformConversation.findFirst({
    where: { id: input.platformConversationId, organizationId: tenant.organizationId },
    include: { canopyConversation: true },
  });
  if (!platformConversation) throw new Error("Platform conversation not found");

  const trigger = await prisma.platformMessage.findFirst({
    where: {
      platformConversationId: platformConversation.id,
      externalMessageId: input.triggerExternalMessageId,
      organizationId: tenant.organizationId,
    },
  });
  if (!trigger) throw new Error("Trigger message not found");

  const key = idempotencyKey({
    platformAccountId: account.id,
    externalConversationId: platformConversation.externalConversationId,
    triggerExternalMessageId: trigger.externalMessageId,
    actionType: "SEND_TEXT",
  });

  const existingAction = await prisma.automationAction.findUnique({ where: { idempotencyKey: key } });
  if (existingAction) {
    const parsed = automationDecisionSchema.safeParse(existingAction.generatedPayload);
    return {
      decision: parsed.success
        ? parsed.data
        : {
            action: "ESCALATE",
            messages: [],
            productId: null,
            price: null,
            confidence: 0,
            funnelStage: platformConversation.canopyConversation.funnelStage,
            reason: "EXISTING_ACTION",
            scheduledDelaySeconds: 0,
            safetyFlags: [],
          },
      actionId: existingAction.id,
      status: existingAction.status,
    };
  }

  const policy = policySnapshot(
    account.policy ?? {
      minimumConfidence: 0.72,
      maximumPpvPriceCents: 5000,
      minimumReplyDelaySeconds: 8,
      maximumReplyDelaySeconds: 45,
      maximumMessagesPerHourPerFan: 8,
      welcomeEnabled: false,
      followUpsEnabled: false,
      ppvEnabled: false,
      quietHours: null,
      allowedProductIds: [],
      humanTakeoverMinutes: 30,
      allowedLanguages: ["en"],
    },
  );

  const conversation = await prisma.conversation.findFirstOrThrow({
    where: { id: platformConversation.canopyConversationId, organizationId: tenant.organizationId },
  });
  const persona = account.creator.personas[0];
  const safety = evaluateAutomationSafety({
    adultStatus: conversation.adultStatus,
    subscriberText: trigger.body,
    allowedLanguages: policy.allowedLanguages,
    prohibitedWords: persona?.prohibitedWords,
  });

  let decision: AutomationDecision = {
    action: "ESCALATE",
    messages: [],
    productId: null,
    price: null,
    confidence: 0.2,
    funnelStage: conversation.funnelStage,
    reason: safety.reason ?? "SAFETY",
    scheduledDelaySeconds: 0,
    safetyFlags: [...safety.flags, ...extraAutomationFlags(trigger.body)],
  };

  if (account.autonomyMode === "PAUSED") {
    decision = { ...decision, action: "DO_NOT_REPLY", reason: "PAUSED" };
  } else if (safety.allowed && !platformConversation.humanTakeover && !conversation.mutedAi) {
    const userId = await actorUserId(tenant.organizationId, input.actorUserId);
    const generation = await generateForConversation({
      organizationId: tenant.organizationId,
      userId,
      conversationId: conversation.id,
    });
    const option = generation.replyOptions[0];
    const failed = "failed" in generation && generation.failed;
    const confidence = confidenceFromGeneration({
      blocked: generation.blocked,
      failed,
      validationErrors: "validationErrors" in generation ? generation.validationErrors : [],
      riskFlags: "riskFlags" in generation ? generation.riskFlags : [],
      recommendedAction: "recommendedAction" in generation ? generation.recommendedAction : undefined,
    });
    const post = evaluateAutomationSafety({
      adultStatus: conversation.adultStatus,
      subscriberText: trigger.body,
      generatedTexts: generation.replyOptions.flatMap((o) => splitReplyBubbles(o.text)),
      allowedLanguages: policy.allowedLanguages,
      prohibitedWords: persona?.prohibitedWords,
    });
    if (generation.blocked || failed || !option || !post.allowed) {
      decision = {
        ...decision,
        action: "ESCALATE",
        confidence,
        reason: post.reason ?? "GENERATION_BLOCKED",
        safetyFlags: post.flags,
      };
    } else {
      const wantsPpv =
        "recommendedAction" in generation &&
        generation.recommendedAction === "PRESENT_OFFER" &&
        generation.recommendedProductId;
      decision = automationDecisionSchema.parse({
        action: wantsPpv ? "SEND_PPV" : "SEND_TEXT",
        messages: splitReplyBubbles(option.text, { splitSentences: true }),
        productId: "recommendedProductId" in generation ? generation.recommendedProductId : null,
        price: "approvedPrice" in generation ? generation.approvedPrice : null,
        confidence,
        funnelStage: "funnelStage" in generation ? generation.funnelStage : conversation.funnelStage,
        reason: "GENERATED",
        scheduledDelaySeconds: policy.minimumReplyDelaySeconds,
        safetyFlags: post.flags,
      });
    }
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentLastHour = await prisma.automationAction.count({
    where: {
      organizationId: tenant.organizationId,
      platformConversationId: platformConversation.id,
      status: "SENT",
      updatedAt: { gte: hourAgo },
    },
  });
  const newer = await prisma.platformMessage.findFirst({
    where: {
      platformConversationId: platformConversation.id,
      sentAt: { gt: trigger.sentAt },
    },
  });
  const alreadySent = await prisma.automationAction.findFirst({
    where: {
      organizationId: tenant.organizationId,
      triggerMessageId: trigger.id,
      status: "SENT",
    },
  });
  const product = decision.productId
    ? await prisma.product.findFirst({
        where: { id: decision.productId, organizationId: tenant.organizationId },
      })
    : null;
  const purchased = product
    ? await prisma.purchase.findFirst({
        where: {
          organizationId: tenant.organizationId,
          conversationId: conversation.id,
          productId: product.id,
          refunded: false,
        },
      })
    : null;

  const gate = evaluateDeliveryGates({
    expectedAccountId: account.id,
    actualAccountId: account.id,
    expectedFanId: platformConversation.externalFanId,
    actualFanId: platformConversation.externalFanId,
    autonomyMode: account.autonomyMode,
    flags,
    humanTakeover: platformConversation.humanTakeover || conversation.mutedAi,
    lockedUntil: platformConversation.automationLockedUntil,
    newerMessageAfterTrigger: Boolean(newer),
    alreadySentForTrigger: Boolean(alreadySent),
    messagesSentLastHour: sentLastHour,
    policy,
    decision,
    safetyAllowed: safety.allowed && !safety.bannedWordHit,
    bannedWordHit: safety.bannedWordHit,
    product: product
      ? {
          id: product.id,
          approvedForAutomation: product.approvedForAutomation,
          alreadyPurchased: Boolean(purchased),
          platformMediaReference: product.platformMediaReference,
          minimumPriceCents: product.minimumPriceCents,
          maximumPriceCents: product.maximumPriceCents,
          standardPriceCents: product.standardPriceCents,
        }
      : null,
  });
  const routed = routeAutonomy({
    mode: account.autonomyMode,
    flags,
    decision,
    policy,
    humanTakeover: platformConversation.humanTakeover || conversation.mutedAi,
    gate,
  });

  let action;
  try {
    action = await prisma.automationAction.create({
      data: {
        organizationId: tenant.organizationId,
        platformAccountId: account.id,
        platformConversationId: platformConversation.id,
        triggerMessageId: trigger.id,
        actionType: decision.action === "SEND_PPV" ? "SEND_PPV" : "SEND_TEXT",
        status: routed.status === "CANCELLED" ? "CANCELLED" : routed.status,
        idempotencyKey: key,
        generatedPayload: decision,
        confidence: decision.confidence,
        escalationReason: routed.status === "SCHEDULED" ? null : routed.reason,
        scheduledFor:
          routed.status === "SCHEDULED"
            ? new Date(Date.now() + decision.scheduledDelaySeconds * 1000)
            : null,
      },
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "P2002") {
      const existing = await prisma.automationAction.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        const parsed = automationDecisionSchema.safeParse(existing.generatedPayload);
        return {
          decision: parsed.success ? parsed.data : decision,
          actionId: existing.id,
          status: existing.status,
        };
      }
    }
    throw error;
  }

  await recordAnalytics({
    organizationId: tenant.organizationId,
    type: routed.status === "SCHEDULED" ? "AUTOMATION_DECISION" : "AUTOMATION_ESCALATED",
    creatorId: account.creatorId,
    conversationId: conversation.id,
    metadata: { action: decision.action, reason: routed.reason, confidence: decision.confidence },
  });

  return { decision, actionId: action.id, status: action.status };
}

export async function preflightDelivery(input: {
  organizationId: string;
  actionId: string;
  flags?: FeatureFlags;
}) {
  const flags = input.flags ?? readFeatureFlags();
  const tenant = requireTenant(input.organizationId);
  const action = await prisma.automationAction.findFirst({
    where: { id: input.actionId, organizationId: tenant.organizationId },
    include: {
      platformAccount: { include: { policy: true } },
      platformConversation: true,
    },
  });
  if (!action) throw new Error("Action not found");
  const decision = automationDecisionSchema.parse(action.generatedPayload);
  const trigger = action.triggerMessageId
    ? await prisma.platformMessage.findFirst({ where: { id: action.triggerMessageId } })
    : null;
  const newer = trigger
    ? await prisma.platformMessage.findFirst({
        where: { platformConversationId: action.platformConversationId, sentAt: { gt: trigger.sentAt } },
      })
    : null;
  const alreadySent = await prisma.automationAction.findFirst({
    where: {
      organizationId: tenant.organizationId,
      triggerMessageId: action.triggerMessageId ?? undefined,
      status: "SENT",
      id: { not: action.id },
    },
  });
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentLastHour = await prisma.automationAction.count({
    where: {
      organizationId: tenant.organizationId,
      platformConversationId: action.platformConversationId,
      status: "SENT",
      updatedAt: { gte: hourAgo },
    },
  });
  const conversation = await prisma.conversation.findFirstOrThrow({
    where: { id: action.platformConversation.canopyConversationId },
  });
  const product = decision.productId
    ? await prisma.product.findFirst({
        where: { id: decision.productId, organizationId: tenant.organizationId },
      })
    : null;
  const purchased = product
    ? await prisma.purchase.findFirst({
        where: {
          organizationId: tenant.organizationId,
          conversationId: conversation.id,
          productId: product.id,
          refunded: false,
        },
      })
    : null;
  const persona = await prisma.creatorPersona.findFirst({
    where: { creatorId: action.platformAccount.creatorId, isActive: true },
  });
  const safety = evaluateAutomationSafety({
    adultStatus: conversation.adultStatus,
    subscriberText: trigger?.body ?? "",
    generatedTexts: decision.messages,
    allowedLanguages: action.platformAccount.policy?.allowedLanguages ?? ["en"],
    prohibitedWords: persona?.prohibitedWords,
  });
  const policy = policySnapshot(
    action.platformAccount.policy ?? {
      minimumConfidence: 0.72,
      maximumPpvPriceCents: 5000,
      minimumReplyDelaySeconds: 8,
      maximumReplyDelaySeconds: 45,
      maximumMessagesPerHourPerFan: 8,
      welcomeEnabled: false,
      followUpsEnabled: false,
      ppvEnabled: false,
      quietHours: null,
      allowedProductIds: [],
      humanTakeoverMinutes: 30,
      allowedLanguages: ["en"],
    },
  );
  const gate = evaluateDeliveryGates({
    expectedAccountId: action.platformAccountId,
    actualAccountId: action.platformAccount.id,
    humanApproved: Boolean(action.finalPayload),
    expectedFanId: action.platformConversation.externalFanId,
    actualFanId: action.platformConversation.externalFanId,
    autonomyMode: action.platformAccount.autonomyMode,
    flags,
    humanTakeover: action.platformConversation.humanTakeover,
    lockedUntil: action.platformConversation.automationLockedUntil,
    newerMessageAfterTrigger: Boolean(newer),
    alreadySentForTrigger: Boolean(alreadySent),
    messagesSentLastHour: sentLastHour,
    policy,
    decision,
    safetyAllowed: safety.allowed,
    bannedWordHit: safety.bannedWordHit,
    product: product
      ? {
          id: product.id,
          approvedForAutomation: product.approvedForAutomation,
          alreadyPurchased: Boolean(purchased),
          platformMediaReference: product.platformMediaReference,
          minimumPriceCents: product.minimumPriceCents,
          maximumPriceCents: product.maximumPriceCents,
          standardPriceCents: product.standardPriceCents,
        }
      : null,
  });
  return { action, decision, gate, conversation };
}

export async function markActionSent(input: {
  organizationId: string;
  actionId: string;
  externalMessageId: string;
  finalText: string;
  userId?: string;
}) {
  const tenant = requireTenant(input.organizationId);
  const preflight = await preflightDelivery({ organizationId: tenant.organizationId, actionId: input.actionId });
  if (!preflight.gate.ok) {
    await prisma.automationAction.update({
      where: { id: input.actionId },
      data: { status: "FAILED", lastError: preflight.gate.reason },
    });
    await writeAutomationAudit({
      organizationId: tenant.organizationId,
      action: "AUTOMATION_FAIL",
      entityType: "AutomationAction",
      entityId: input.actionId,
      metadata: { reason: preflight.gate.reason },
    });
    return { ok: false as const, reason: preflight.gate.reason };
  }

  const { action, decision, conversation } = preflight;
  const userId = await actorUserId(tenant.organizationId, input.userId);
  const generation = await prisma.generation.findFirst({
    where: { conversationId: conversation.id, organizationId: tenant.organizationId },
    orderBy: { createdAt: "desc" },
    include: { replyOptions: true },
  });
  const option = generation?.replyOptions[0];
  let canopyMessageId: string | undefined;
  if (generation && option) {
    const selected = await selectReply({
      organizationId: tenant.organizationId,
      userId,
      conversationId: conversation.id,
      generationId: generation.id,
      replyOptionId: option.id,
      editedText: input.finalText,
      inserted: true,
    });
    canopyMessageId = selected.messageId;
  } else {
    const created = await prisma.message.create({
      data: {
        organizationId: tenant.organizationId,
        conversationId: conversation.id,
        authorType: "CHATTER",
        authorUserId: userId,
        body: input.finalText,
        aiAssisted: true,
      },
    });
    canopyMessageId = created.id;
  }

  await prisma.platformMessage.upsert({
    where: {
      platformConversationId_externalMessageId: {
        platformConversationId: action.platformConversationId,
        externalMessageId: input.externalMessageId,
      },
    },
    update: { canopyMessageId, deliveryStatus: "VERIFIED" },
    create: {
      organizationId: tenant.organizationId,
      platformConversationId: action.platformConversationId,
      canopyMessageId,
      externalMessageId: input.externalMessageId,
      direction: "OUTBOUND",
      body: input.finalText,
      sentAt: new Date(),
      deliveryStatus: "VERIFIED",
    },
  });

  await prisma.automationAction.update({
    where: { id: action.id },
    data: {
      status: "SENT",
      finalPayload: { ...decision, messages: [input.finalText] },
    },
  });
  await writeAutomationAudit({
    organizationId: tenant.organizationId,
    userId,
    action: "AUTOMATION_SEND",
    entityType: "AutomationAction",
    entityId: action.id,
    metadata: { verified: true },
  });
  await recordAnalytics({
    organizationId: tenant.organizationId,
    type: "AUTOMATION_SENT",
    creatorId: action.platformAccount.creatorId,
    conversationId: conversation.id,
  });
  return { ok: true as const };
}

export async function approveAction(input: {
  organizationId: string;
  actionId: string;
  userId: string;
  editedText?: string;
  reject?: boolean;
  returnToAutonomy?: boolean;
}) {
  const tenant = requireTenant(input.organizationId);
  const action = await prisma.automationAction.findFirst({
    where: { id: input.actionId, organizationId: tenant.organizationId },
    include: { platformConversation: true },
  });
  if (!action) throw new Error("Action not found");
  if (input.reject) {
    await prisma.automationAction.update({
      where: { id: action.id },
      data: { status: "CANCELLED", lastError: "Rejected by operator" },
    });
    if (input.returnToAutonomy) {
      await releaseHumanTakeover({
        organizationId: tenant.organizationId,
        platformConversationId: action.platformConversationId,
      });
    }
    return { ok: true as const, status: "CANCELLED" };
  }
  const decision = automationDecisionSchema.parse(action.generatedPayload);
  const text = input.editedText?.trim() || decision.messages[0];
  if (!text) throw new Error("No message to send");
  await prisma.automationAction.update({
    where: { id: action.id },
    data: {
      status: "SCHEDULED",
      scheduledFor: new Date(),
      finalPayload: { ...decision, messages: [text] },
    },
  });
  await writeAutomationAudit({
    organizationId: tenant.organizationId,
    userId: input.userId,
    action: "APPROVE_AUTOMATION",
    entityType: "AutomationAction",
    entityId: action.id,
  });
  return { ok: true as const, status: "SCHEDULED", text };
}

export function canSendAutonomously(mode: AutonomyMode, flags: FeatureFlags) {
  return flags.autonomousText && mode !== "PAUSED";
}
