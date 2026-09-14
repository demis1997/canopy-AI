import { prisma } from "@canopy/database";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, MetricCard, PageHeader } from "@/components/page-chrome";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPct, formatUsdFromCents, loadOrgMetrics, parseWindow } from "@/lib/org-metrics";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; creator?: string; chatter?: string; campaign?: string; segment?: string }>;
}) {
  const { allowed, ctx } = await guardOrgPage("analytics.view");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const params = await searchParams;
  const orgId = ctx.tenant.organizationId;
  const window = parseWindow(params);
  const metrics = await loadOrgMetrics(orgId, window);
  const creators = await prisma.creator.findMany({ where: { organizationId: orgId, active: true } });
  const members = await prisma.organizationMembership.findMany({
    where: { organizationId: orgId, role: { in: ["CHATTER", "MANAGER"] } },
    include: { user: true },
  });
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Optimize"
        title="Analytics"
        description="Revenue influenced by Canopy, conversion, copilot quality and funnel mix. Filters apply to the CSV export."
        actions={
          <Button asChild variant="secondary">
            <a href={`/api/analytics/export?${qs}`}>Export CSV</a>
          </Button>
        }
      />
      <form className="grid gap-2 rounded-xl border border-white/[0.06] bg-ink-800/70 p-3 text-xs md:grid-cols-6">
        <label className="space-y-1">
          From
          <input type="date" name="from" defaultValue={window.from.toISOString().slice(0, 10)} className="h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2" />
        </label>
        <label className="space-y-1">
          To
          <input type="date" name="to" defaultValue={window.to.toISOString().slice(0, 10)} className="h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2" />
        </label>
        <label className="space-y-1">
          Creator
          <select name="creator" defaultValue={params.creator ?? ""} className="h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2">
            <option value="">All</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          Chatter
          <select name="chatter" defaultValue={params.chatter ?? ""} className="h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2">
            <option value="">All</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          Campaign
          <input name="campaign" defaultValue={params.campaign ?? ""} placeholder="Not tagged (demo filter)" className="h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2" />
        </label>
        <label className="space-y-1">
          Segment
          <input name="segment" defaultValue={params.segment ?? ""} placeholder="Subscriber segment" className="h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2" />
        </label>
        <button className="h-9 self-end rounded-[10px] bg-leaf px-3 text-bone" type="submit">
          Apply filters
        </button>
      </form>
      {(params.campaign || params.segment) && (
        <p className="text-xs text-amber-300">Campaign and subscriber segment filters are labelled demo — events are not campaign-tagged yet.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue influenced" value={formatUsdFromCents(metrics.revenueCents)} />
        <MetricCard label="Unlock revenue" value={formatUsdFromCents(metrics.revenueCents)} hint={`${metrics.unlocks} purchases`} />
        <MetricCard label="Offers sent" value={String(metrics.offers)} />
        <MetricCard label="PPV conversion" value={formatPct(metrics.conversion)} />
        <MetricCard label="Revenue / conversation" value={formatUsdFromCents(metrics.rpc)} />
        <MetricCard label="AI acceptance" value={formatPct(metrics.acceptance)} hint={`${formatPct(metrics.editRate)} edited`} />
        <MetricCard label="Response time" value={`${Math.round(metrics.avgLatencyMs)}ms`} />
        <MetricCard label="Escalation rate" value={formatPct(metrics.escalationRate)} />
      </div>
      <Card>
        <div className="text-sm font-medium">Daily time series</div>
        {metrics.series.length ? (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-white/40">
              <tr>
                <th className="py-2">Day</th>
                <th>Revenue events</th>
                <th>Offers</th>
                <th>Generations</th>
              </tr>
            </thead>
            <tbody>
              {metrics.series.map((row) => (
                <tr key={row.day} className="border-t border-white/[0.06]">
                  <td className="py-2">{row.day}</td>
                  <td>{row.revenue}</td>
                  <td>{row.offers}</td>
                  <td>{row.gens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No events in range" body="Generate replies or record purchases to populate the series." />
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-medium">Creator comparison</div>
          <ul className="mt-3 space-y-2 text-sm">
            {metrics.creators.map((c) => (
              <li key={c.id} className="flex justify-between">
                <a className="text-canopy-300" href={`/creators/${c.id}`}>
                  {c.name}
                </a>
                <span className="text-white/50">
                  {formatUsdFromCents(c.revenueCents)} · {c.conversations} chats
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="text-sm font-medium">Chatter comparison</div>
          {metrics.chatters.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {metrics.chatters.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="text-white/50">{c.accepted} accepted / edited</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-white/40">No chatter-attributed accepts yet.</p>
          )}
        </Card>
      </div>
      <Card>
        <div className="text-sm font-medium">Funnel-stage breakdown</div>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {metrics.funnel.map((f) => (
            <li key={f.funnelStage} className="rounded-[10px] border border-white/[0.06] px-3 py-2">
              <div className="text-[11px] text-white/40">{f.funnelStage}</div>
              <div className="text-lg font-semibold">{f._count}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
