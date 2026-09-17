import { prisma } from "@canopy/database";

export async function clearConversationThread(opts: {
  organizationId: string;
  conversationId: string;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: opts.conversationId, organizationId: opts.organizationId },
    select: { id: true, creatorId: true, subscriberId: true },
  });
  if (!conversation) return null;

  const generations = await prisma.generation.findMany({
    where: { organizationId: opts.organizationId, conversationId: conversation.id },
    select: { id: true },
  });
  const generationIds = generations.map((row) => row.id);
  if (generationIds.length) {
    await prisma.replyOption.deleteMany({
      where: { organizationId: opts.organizationId, generationId: { in: generationIds } },
    });
    await prisma.generation.deleteMany({
      where: { organizationId: opts.organizationId, id: { in: generationIds } },
    });
  }

  try {
    await prisma.platformMessage.updateMany({
      where: { organizationId: opts.organizationId, canopyMessage: { conversationId: conversation.id } },
      data: { canopyMessageId: null },
    });
  } catch {
    // Older local schemas may not have PlatformMessage.
  }

  await prisma.subscriberMemory.updateMany({
    where: { organizationId: opts.organizationId, sourceMessage: { conversationId: conversation.id } },
    data: { sourceMessageId: null },
  });
  await prisma.message.deleteMany({
    where: { organizationId: opts.organizationId, conversationId: conversation.id },
  });
  await prisma.conversationSummary.deleteMany({
    where: { organizationId: opts.organizationId, conversationId: conversation.id },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      funnelStage: "NEW_FAN",
      unreadCount: 0,
      mutedAi: false,
      followUpAt: null,
      activeSequenceStep: 0,
      unansweredFollowUps: 0,
      lastOfferAt: null,
      offerCountToday: 0,
      lastMessageAt: new Date(),
    },
  });
  try {
    await prisma.fanNote.updateMany({
      where: {
        organizationId: opts.organizationId,
        creatorId: conversation.creatorId,
        subscriberId: conversation.subscriberId,
      },
      data: { extra: {}, dominance: "UNKNOWN" },
    });
  } catch {
    // Older local schemas may not have FanNote.
  }
  await prisma.subscriberMemory.deleteMany({
    where: {
      organizationId: opts.organizationId,
      creatorId: conversation.creatorId,
      subscriberId: conversation.subscriberId,
      key: { in: ["thread_lessons", "last_fan_message"] },
    },
  });

  return { cleared: true as const, id: conversation.id };
}
