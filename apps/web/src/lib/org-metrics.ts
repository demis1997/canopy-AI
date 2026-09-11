import { prisma } from "@canopy/database";

export type MetricWindow = { from: Date; to: Date; creatorId?: string; chatterId?: string };

export function parseWindow(search: {
  from?: string;
  to?: string;
  creator?: string;
  chatter?: string;
}): MetricWindow {
  const to = search.to ? new Date(search.to) : new Date();
  const from = search.from ? new Date(search.from) : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return {
    from,
    to,
    creatorId: search.creator || undefined,
    chatterId: search.chatter || undefined,
  };
}

export async function loadOrgMetrics(organizationId: string, window: MetricWindow) {
  const createdAt = { gte: window.from, lte: window.to };
  const creatorId = window.creatorId;
  const chatterId = window.chatterId;
  const eventWhere = {
    organizationId,
    createdAt,
    ...(creatorId ? { creatorId } : {}),
    ...(chatterId ? { chatterId } : {}),
  };
  const convWhere = {
    organizationId,
    ...(creatorId ? { creatorId } : {}),
  };

  const [
    purchases,
    offers,
    conversations,
    suggestions,
    accepted,
    edited,
    escalations,
    generations,
    messages,
    events,
    creatorList,
    chatterGroups,
    recentEscalations,
    tokens,
    funnelRows,
  ] = await Promise.all([
    prisma.purchase.findMany({
      where: {
        organizationId,
        refunded: false,
        createdAt,
        ...(creatorId ? { conversation: { creatorId } } : {}),
      },
      include: { conversation: { select: { creatorId: true } } },
    }),
    prisma.analyticsEvent.count({ where: { ...eventWhere, type: "OFFER_PRESENTED" } }),
    prisma.conversation.count({ where: convWhere }),
    prisma.analyticsEvent.count({ where: { ...eventWhere, type: "SUGGESTIONS_PRODUCED" } }),
    prisma.analyticsEvent.count({ where: { ...eventWhere, type: "SUGGESTION_ACCEPTED" } }),
    prisma.analyticsEvent.count({ where: { ...eventWhere, type: "SUGGESTION_EDITED" } }),
    prisma.analyticsEvent.count({ where: { ...eventWhere, type: "ESCALATION" } }),
    prisma.generation.aggregate({
      where: { organizationId, createdAt, ...(creatorId ? { conversation: { creatorId } } : {}) },
      _avg: { latencyMs: true },
      _count: true,
    }),
    prisma.message.count({
      where: { organizationId, createdAt, ...(creatorId ? { conversation: { creatorId } } : {}) },
    }),
    prisma.analyticsEvent.findMany({
      where: eventWhere,
      select: { type: true, createdAt: true, numericValue: true, creatorId: true, chatterId: true },
    }),
    prisma.creator.findMany({
      where: { organizationId, active: true, ...(creatorId ? { id: creatorId } : {}) },
      include: { _count: { select: { conversations: true } } },
      take: 12,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["chatterId", "type"],
      where: { organizationId, chatterId: { not: null } },
      _count: true,
    }),
    prisma.escalation.findMany({
      where: { organizationId, status: { in: ["OPEN", "IN_REVIEW"] } },
      include: {
        conversation: {
          select: {
            id: true,
            creator: { select: { displayName: true } },
            subscriber: { select: { displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.extensionToken.count({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { memberships: { some: { organizationId } } },
      },
    }),
    prisma.conversation.groupBy({
      by: ["funnelStage"],
      where: convWhere,
      _count: true,
    }),
  ]);

  const revenueCents = purchases.reduce((sum, p) => sum + p.amountCents, 0);
  const conversion = offers ? (purchases.length / offers) * 100 : 0;
  const acceptance = suggestions ? ((accepted + edited) / suggestions) * 100 : 0;
  const editRate = suggestions ? (edited / suggestions) * 100 : 0;
  const escalationRate = messages ? (escalations / Math.max(messages, 1)) * 100 : 0;
  const rpc = conversations ? revenueCents / conversations : 0;

  const revenueByCreator = new Map<string, number>();
  for (const p of purchases) {
    const id = p.conversation.creatorId;
    revenueByCreator.set(id, (revenueByCreator.get(id) ?? 0) + p.amountCents);
  }

  const buckets = new Map<string, { revenue: number; offers: number; gens: number }>();
  for (const event of events) {
    const day = event.createdAt.toISOString().slice(0, 10);
    const row = buckets.get(day) ?? { revenue: 0, offers: 0, gens: 0 };
    if (event.type === "PURCHASE") row.revenue += event.numericValue ?? 0;
    if (event.type === "OFFER_PRESENTED") row.offers += 1;
    if (event.type === "SUGGESTIONS_PRODUCED") row.gens += 1;
    buckets.set(day, row);
  }

  const chatterAccepted = new Map<string, number>();
  for (const row of chatterGroups) {
    if (!row.chatterId) continue;
    if (row.type === "SUGGESTION_ACCEPTED" || row.type === "SUGGESTION_EDITED") {
      chatterAccepted.set(row.chatterId, (chatterAccepted.get(row.chatterId) ?? 0) + row._count);
    }
  }
  const chatterUsers = chatterAccepted.size
    ? await prisma.user.findMany({ where: { id: { in: [...chatterAccepted.keys()] } } })
    : [];

  return {
    revenueCents,
    unlocks: purchases.length,
    offers,
    conversations,
    conversion,
    acceptance,
    editRate,
    avgLatencyMs: generations._avg.latencyMs ?? 0,
    generationCount: generations._count,
    escalationRate,
    escalations,
    messages,
    rpc,
    tokens,
    funnel: funnelRows,
    series: [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, row]) => ({ day, ...row })),
    creators: creatorList
      .map((c) => ({
        id: c.id,
        name: c.displayName,
        handle: c.handle,
        conversations: c._count.conversations,
        revenueCents: revenueByCreator.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents),
    chatters: chatterUsers
      .map((u) => ({ id: u.id, name: u.name, accepted: chatterAccepted.get(u.id) ?? 0 }))
      .sort((a, b) => b.accepted - a.accepted),
    recentEscalations,
    window,
  };
}

export function formatPct(n: number) {
  return `${n.toFixed(1)}%`;
}

export function formatUsdFromCents(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}
