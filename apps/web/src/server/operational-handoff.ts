import { prisma, type Prisma } from "@canopy/database";
import {
  operationalGenerationPlan,
  shouldOpenEscalation,
  type OperationalGenerationPlan,
  type OperationalRoute,
  type ResponseMode,
} from "@canopy/shared";

export type OperationalSkipResult = {
  blocked: false;
  escalated: true;
  requiresHumanReview: true;
  recommendedAction: "REQUEST_HUMAN_REVIEW";
  recommendedProductId: null;
  approvedPrice: null;
  replyOptions: [];
  chatterMessage: string;
  generationId: string;
  escalationId: string | null;
  flags: string[];
  mockMode: boolean;
  skippedGeneration: true;
  operationalIntent: OperationalRoute["intent"];
  responseMode: ResponseMode;
};

export async function applyOperationalPause(input: {
  organizationId: string;
  conversationId: string;
  muteAi: boolean;
  humanTakeover: boolean;
  pauseAutomation: boolean;
  minutes?: number;
}) {
  const minutes = input.minutes ?? 30;
  const until = new Date(Date.now() + minutes * 60_000);
  await prisma.$transaction(async (tx) => {
    if (input.muteAi) {
      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { mutedAi: true },
      });
    }
    const platform = await tx.platformConversation.findFirst({
      where: {
        canopyConversationId: input.conversationId,
        organizationId: input.organizationId,
      },
    });
    if (!platform) return;
    if (input.humanTakeover) {
      await tx.platformConversation.update({
        where: { id: platform.id },
        data: { humanTakeover: true, automationLockedUntil: until },
      });
    } else if (input.pauseAutomation) {
      await tx.platformConversation.update({
        where: { id: platform.id },
        data: { automationLockedUntil: until },
      });
    }
    if (input.pauseAutomation || input.humanTakeover) {
      await tx.automationAction.updateMany({
        where: {
          organizationId: input.organizationId,
          platformConversationId: platform.id,
          status: { in: ["PENDING", "GENERATING", "SCHEDULED", "APPROVAL_REQUIRED"] },
        },
        data: {
          status: "CANCELLED",
          lastError: input.humanTakeover ? "Human takeover" : "Operational pause",
        },
      });
    }
  });
}

export async function persistOperationalSkip(input: {
  organizationId: string;
  conversationId: string;
  creatorId: string;
  userId: string;
  requestId: string;
  provider: string;
  model: string;
  mockMode: boolean;
  route: OperationalRoute;
  plan: OperationalGenerationPlan;
  responseMode: ResponseMode;
  inputMessageIds: string[];
  flags: string[];
  takeoverMinutes?: number;
}): Promise<OperationalSkipResult> {
  const plan = input.plan.skipGenerate ? input.plan : operationalGenerationPlan(input.route);
  await applyOperationalPause({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    muteAi: plan.muteAi,
    humanTakeover: plan.humanTakeover,
    pauseAutomation: plan.pauseAutomation,
    minutes: input.takeoverMinutes,
  });

  const reason =
    input.route.intent === "HUMAN_REQUEST" || input.route.intent === "STOP_AUTOMATION"
      ? "FAN_REQUESTED_HUMAN"
      : "HUMAN_TAKEOVER";
  const open = await prisma.escalation.findFirst({
    where: {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      status: "OPEN",
      reason: { in: ["FAN_REQUESTED_HUMAN", "HUMAN_TAKEOVER"] },
    },
  });
  const createEscalation = shouldOpenEscalation(Boolean(open));
  const escalation = createEscalation
    ? await prisma.escalation.create({
        data: {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          openedById: input.userId,
          reason,
          summary: plan.chatterMessage,
          riskEvent: {
            flags: input.flags,
            retainedText: false,
            requestId: input.requestId,
            operationalIntent: input.route.intent,
          },
        },
      })
    : open;

  const diagnostics: Prisma.InputJsonValue = {
    inputMessageIds: input.inputMessageIds,
    operationalIntent: input.route.intent,
    responseMode: input.responseMode,
    classifierIntent: null,
    classifierConfidence: null,
    trainingChunks: [],
    guardsApplied: [input.route.intent],
    validationFailureCodes: [],
    generationSkipped: true,
    stale: false,
    requestId: input.requestId,
  };

  const generation = await prisma.generation.create({
    data: {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      requestedById: input.userId,
      provider: input.provider,
      model: input.model,
      status: "MANUAL_REVIEW",
      recommendedAction: "REQUEST_HUMAN_REVIEW",
      recommendedProductId: null,
      approvedPriceCents: null,
      requiresHumanReview: true,
      riskFlags: input.flags,
      requestId: input.requestId,
      inputMessageIds: input.inputMessageIds,
      operationalIntent: input.route.intent,
      responseMode: input.responseMode,
      diagnostics,
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      organizationId: input.organizationId,
      type: "ESCALATION",
      creatorId: input.creatorId,
      chatterId: input.userId,
      conversationId: input.conversationId,
      metadata: { operationalIntent: input.route.intent, requestId: input.requestId },
    },
  });
  await prisma.analyticsEvent.create({
    data: {
      organizationId: input.organizationId,
      type: "AUTOMATION_ESCALATED",
      creatorId: input.creatorId,
      conversationId: input.conversationId,
      metadata: { reason, operationalIntent: input.route.intent },
    },
  });

  return {
    blocked: false,
    escalated: true,
    requiresHumanReview: true,
    recommendedAction: "REQUEST_HUMAN_REVIEW",
    recommendedProductId: null,
    approvedPrice: null,
    replyOptions: [],
    chatterMessage: plan.chatterMessage,
    generationId: generation.id,
    escalationId: escalation?.id ?? null,
    flags: input.flags,
    mockMode: input.mockMode,
    skippedGeneration: true,
    operationalIntent: input.route.intent,
    responseMode: input.responseMode,
  };
}
