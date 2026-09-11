import { prisma } from "@canopy/database";
import type { InboxItem } from "@/components/copilot-workspace";

function spendTier(cents: number) {
  if (cents >= 10_000) return "High spend";
  if (cents >= 2_000) return "Mid spend";
  if (cents > 0) return "Low spend";
  return "No spend";
}

export async function loadInbox(organizationId: string, creatorIds?: string[] | null, q?: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      organizationId,
      ...(creatorIds ? { creatorId: { in: creatorIds } } : {}),
      ...(q
        ? {
            OR: [
              { subscriber: { displayName: { contains: q, mode: "insensitive" } } },
              { creator: { displayName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      creator: true,
      subscriber: { include: { purchases: { where: { refunded: false } } } },
      generations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    omit: {
      activeSequenceId: true,
      activeSequenceStep: true,
      unansweredFollowUps: true,
    },
    orderBy: { lastMessageAt: "desc" },
    take: 80,
  });
  return conversations.map((c) => {
    const spend = c.subscriber.purchases.reduce((sum, p) => sum + p.amountCents, 0);
    return {
      id: c.id,
      creatorName: c.creator.displayName,
      fanName: c.subscriber.displayName,
      unreadCount: c.unreadCount,
      intent: c.generations[0]?.intent ?? null,
      spendTier: spendTier(spend),
      lastActivity: c.lastMessageAt.toISOString(),
      funnelStage: c.funnelStage,
      adultStatus: c.adultStatus,
      creatorId: c.creatorId,
      subscriberId: c.subscriber.id,
    } satisfies InboxItem & { adultStatus: string; creatorId: string; subscriberId: string };
  });
}
