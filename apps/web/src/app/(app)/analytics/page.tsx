import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

export default async function AnalyticsPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const orgId = ctx.tenant.organizationId;
  const types = [
    "MESSAGE_RECEIVED",
    "GENERATION_REQUESTED",
    "SUGGESTIONS_PRODUCED",
    "SUGGESTION_ACCEPTED",
    "SUGGESTION_EDITED",
    "SAFETY_BLOCK",
    "ESCALATION",
    "OFFER_PRESENTED",
    "PURCHASE",
    "COMPLAINT",
    "REFUND",
  ] as const;

  const counts = await Promise.all(
    types.map(async (type) => ({
      type,
      count: await prisma.analyticsEvent.count({ where: { organizationId: orgId, type } }),
    })),
  );

  const byCreator = await prisma.analyticsEvent.groupBy({
    by: ["creatorId", "type"],
    where: { organizationId: orgId, creatorId: { not: null } },
    _count: true,
  });
  const byChatter = await prisma.analyticsEvent.groupBy({
    by: ["chatterId", "type"],
    where: { organizationId: orgId, chatterId: { not: null } },
    _count: true,
  });
  const byModel = await prisma.generation.groupBy({
    by: ["model"],
    where: { organizationId: orgId },
    _avg: { latencyMs: true },
    _sum: { promptTokens: true, completionTokens: true },
    _count: true,
  });
  const purchases = await prisma.purchase.aggregate({
    where: { organizationId: orgId, refunded: false },
    _sum: { amountCents: true },
    _count: true,
  });
  const refunds = await prisma.purchase.count({
    where: { organizationId: orgId, refunded: true },
  });
  const offers = counts.find((c) => c.type === "OFFER_PRESENTED")?.count ?? 0;
  const conversion = offers ? ((purchases._count / offers) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
      <p className="text-sm text-white/50">
        Optimise for retention and complaint rate, not only short-term revenue. Raw prompts are not sent here.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map((c) => (
          <Card key={c.type}>
            <div className="text-xs text-white/45">{c.type}</div>
            <div className="mt-2 text-2xl font-semibold">{c.count}</div>
          </Card>
        ))}
        <Card>
          <div className="text-xs text-white/45">Attributed revenue</div>
          <div className="mt-2 text-2xl font-semibold">${((purchases._sum.amountCents ?? 0) / 100).toFixed(0)}</div>
        </Card>
        <Card>
          <div className="text-xs text-white/45">Conversion (purchases / offers)</div>
          <div className="mt-2 text-2xl font-semibold">{conversion}%</div>
        </Card>
        <Card>
          <div className="text-xs text-white/45">Refunds</div>
          <div className="mt-2 text-2xl font-semibold">{refunds}</div>
        </Card>
      </div>
      <Card>
        <div className="text-sm font-medium">By model</div>
        <ul className="mt-3 space-y-2 text-sm text-white/70">
          {byModel.map((m) => (
            <li key={m.model}>
              {m.model || "(none)"} · {m._count} gens · avg {Math.round(m._avg.latencyMs ?? 0)}ms · tokens{" "}
              {(m._sum.promptTokens ?? 0) + (m._sum.completionTokens ?? 0)}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="text-sm font-medium">Creator / chatter event counts</div>
        <p className="mt-2 text-xs text-white/40">
          {byCreator.length} creator slices, {byChatter.length} chatter slices.
        </p>
      </Card>
    </div>
  );
}
