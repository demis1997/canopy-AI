import { prisma, requireTenant } from "@canopy/database";
import { operatorRejectLesson, splitReplyBubbles } from "@canopy/shared";
import { recordAnalytics } from "../analytics";
import { enqueueJob } from "../jobs/queue";
import { generateForConversation } from "./generate";
import { addSubscriberMessage } from "./messages";
import { editDistance } from "./edit-distance";

async function persistThreadLesson(opts: {
  organizationId: string;
  conversationId: string;
  lesson: string;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: opts.conversationId, organizationId: opts.organizationId },
    select: { subscriberId: true, creatorId: true },
  });
  if (!conversation || !opts.lesson.trim()) return;
  const existing = await prisma.subscriberMemory.findFirst({
    where: {
      organizationId: opts.organizationId,
      subscriberId: conversation.subscriberId,
      creatorId: conversation.creatorId,
      key: "thread_lessons",
      deletedAt: null,
    },
  });
  const lines = (existing?.value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.some((line) => line.toLowerCase() === opts.lesson.toLowerCase())) {
    lines.push(opts.lesson.trim());
  }
  const value = lines.join("\n").slice(0, 4000);
  if (existing) {
    await prisma.subscriberMemory.update({
      where: { id: existing.id },
      data: { value, confidence: 1, verified: true, lastConfirmedAt: new Date() },
    });
    return;
  }
  await prisma.subscriberMemory.create({
    data: {
      organizationId: opts.organizationId,
      subscriberId: conversation.subscriberId,
      creatorId: conversation.creatorId,
      category: "BOUNDARIES",
      key: "thread_lessons",
      value,
      confidence: 1,
      verified: true,
      sensitivity: "INTERNAL",
    },
  });
}

export async function selectReply(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
  generationId: string;
  replyOptionId: string;
  editedText?: string;
  inserted: boolean;
  discard?: boolean;
  rejectReason?: string;
}) {
  const tenant = requireTenant(input.organizationId);
  const option = await prisma.replyOption.findFirst({
    where: {
      id: input.replyOptionId,
      organizationId: tenant.organizationId,
      generationId: input.generationId,
    },
    include: { generation: true },
  });
  if (!option || option.generation.conversationId !== input.conversationId) {
    throw new Error("Reply option not found");
  }

  if (input.discard) {
    const reason = input.rejectReason?.trim() || "Not a fit";
    await prisma.replyOption.update({
      where: { id: option.id },
      data: {
        outcome: "DISCARDED",
        selectedById: input.userId,
        internalReason: `${option.internalReason} · rejected: ${reason}`,
      },
    });
    await persistThreadLesson({
      organizationId: tenant.organizationId,
      conversationId: input.conversationId,
      lesson: operatorRejectLesson(reason, option.text),
    });
    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "OVERRIDE",
      conversationId: input.conversationId,
      chatterId: input.userId,
      metadata: { reason },
    });
    return { discarded: true as const };
  }

  const nextText = input.editedText ?? option.text;
  const edited = option.originalText.trim() !== nextText.trim();
  const distance = editDistance(option.originalText, nextText);
  const bubbles = splitReplyBubbles(nextText, { splitSentences: true });
  const bodies = bubbles.length ? bubbles : [nextText.trim()].filter(Boolean);

  const now = Date.now();
  const created = [];
  for (let i = 0; i < bodies.length; i += 1) {
    created.push(
      await prisma.message.create({
        data: {
          organizationId: tenant.organizationId,
          conversationId: input.conversationId,
          authorType: "CHATTER",
          authorUserId: input.userId,
          body: bodies[i]!,
          aiAssisted: true,
          createdAt: new Date(now + i),
        },
      }),
    );
  }
  const message = created[created.length - 1];
  if (!message) throw new Error("Reply text was empty");

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: new Date() },
  });

  await prisma.replyOption.update({
    where: { id: option.id },
    data: {
      text: nextText,
      outcome: input.inserted ? "INSERTED" : edited ? "EDITED" : "SELECTED",
      editDistance: distance,
      selectedById: input.userId,
      messageId: message.id,
    },
  });

  const conversation = await prisma.conversation.findFirstOrThrow({
    where: { id: input.conversationId, organizationId: tenant.organizationId },
  });

  if (option.generation.funnelStage && option.generation.funnelStage !== conversation.funnelStage) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { funnelStage: option.generation.funnelStage },
    });
    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "FUNNEL_TRANSITION",
      creatorId: conversation.creatorId,
      chatterId: input.userId,
      conversationId: conversation.id,
      metadata: { from: conversation.funnelStage, to: option.generation.funnelStage },
    });
  }

  if (option.generation.recommendedProductId && option.generation.approvedPriceCents) {
    await prisma.offer.create({
      data: {
        organizationId: tenant.organizationId,
        conversationId: conversation.id,
        productId: option.generation.recommendedProductId,
        priceCents: option.generation.approvedPriceCents,
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastOfferAt: new Date(),
        offerCountToday: { increment: 1 },
        rapportPriority: false,
      },
    });
    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "OFFER_PRESENTED",
      creatorId: conversation.creatorId,
      conversationId: conversation.id,
      numericValue: option.generation.approvedPriceCents / 100,
    });
  }

  await recordAnalytics({
    organizationId: tenant.organizationId,
    type: edited ? "SUGGESTION_EDITED" : "SUGGESTION_ACCEPTED",
    creatorId: conversation.creatorId,
    chatterId: input.userId,
    conversationId: conversation.id,
    numericValue: distance,
  });

  try {
    await enqueueJob("summarize-conversation", {
      organizationId: tenant.organizationId,
      conversationId: conversation.id,
    });
    await enqueueJob("extract-memories", {
      organizationId: tenant.organizationId,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("background jobs failed after auto-send", error);
  }

  return {
    messageId: message.id,
    messageIds: created.map((m) => m.id),
    editDistance: distance,
    edited,
  };
}

export async function handleFanTurn(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
  text: string;
  autoReply?: boolean;
  toneOverride?: "PLAYFUL" | "ROMANTIC" | "TEASING" | "DOMINANT" | "SUBMISSIVE" | "DIRECT";
}) {
  const { message } = await addSubscriberMessage({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    text: input.text,
    chatterId: input.userId,
  });
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    select: { mutedAi: true },
  });
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { unansweredFollowUps: 0 },
  });
  const muted = Boolean(conversation?.mutedAi);
  if (muted || input.autoReply === false) {
    return { subscriberMessageId: message.id, autoSent: false as const, muted };
  }

  const generation = await generateForConversation({
    organizationId: input.organizationId,
    userId: input.userId,
    conversationId: input.conversationId,
    toneOverride: input.toneOverride,
    triggerMessageId: message.id,
  });

  const option = generation.replyOptions[0];
  const failed = "failed" in generation && generation.failed === true;
  const action = "recommendedAction" in generation ? generation.recommendedAction : undefined;
  const escalated = "escalated" in generation && generation.escalated === true;
  const skipped = "skippedGeneration" in generation && generation.skippedGeneration === true;
  const canSend =
    !generation.blocked &&
    !failed &&
    !escalated &&
    !skipped &&
    action !== "BLOCK" &&
    action !== "REQUEST_HUMAN_REVIEW" &&
    Boolean(option);

  if (!canSend || !option || !generation.generationId) {
    return {
      subscriberMessageId: message.id,
      autoSent: false as const,
      generation,
    };
  }

  const selected = await selectReply({
    organizationId: input.organizationId,
    userId: input.userId,
    conversationId: input.conversationId,
    generationId: generation.generationId,
    replyOptionId: option.id,
    editedText: option.text,
    inserted: true,
  });

  return {
    subscriberMessageId: message.id,
    autoSent: true as const,
    sentText: option.text,
    messageId: selected.messageId,
    generation,
  };
}
