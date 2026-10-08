import { prisma } from "@canopy/database";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, MetricCard, PageHeader } from "@/components/page-chrome";
import { Badge, Card } from "@/components/ui/card";
import Link from "next/link";
import { formatPct, formatUsdFromCents, loadOrgMetrics, parseWindow } from "@/lib/org-metrics";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; creator?: string }>;
}) {
  const { allowed, ctx } = await guardOrgPage("conversations.view");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const params = await searchParams;
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.tenant.organizationId },
  });
  const metrics = await loadOrgMetrics(org.id, parseWindow(params));
  const demo = org.isDemo;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={demo ? "DEMO organization" : org.name}
        title="Executive overview"
        description="Revenue influenced, conversion, copilot quality and inbox health. Metrics open the detailed workspace."
        actions={
          <form className="flex flex-wrap gap-2 text-xs">
            <input
              type="date"
              name="from"
              defaultValue={metrics.window.from.toISOString().slice(0, 10)}
              className="h-9 rounded-[10px] border border-white/10 bg-ink-900 px-2"
            />
            <input
              type="date"
              name="to"
              defaultValue={metrics.window.to.toISOString().slice(0, 10)}
              className="h-9 rounded-[10px] border border-white/10 bg-ink-900 px-2"
            />
            <select
              name="creator"
              defaultValue={params.creator ?? ""}
              className="h-9 rounded-[10px] border border-white/10 bg-ink-900 px-2"
            >
              <option value="">All creators</option>
              {metrics.creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="h-9 rounded-[10px] bg-white/10 px-3" type="submit">
              Apply
            </button>
          </form>
        }
      />
      {demo ? (
        <p className="text-xs text-amber-300">
          Figures include labelled DEMO seed data when live events are sparse.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Revenue influenced"
          value={formatUsdFromCents(metrics.revenueCents)}
          href="/analytics"
          hint={`${metrics.unlocks} unlocks`}
        />
        <MetricCard
          label="PPV conversion"
          value={formatPct(metrics.conversion)}
          href="/analytics"
          hint={`${metrics.offers} offers sent`}
        />
        <MetricCard
          label="Active conversations"
          value={String(metrics.conversations)}
          href="/conversations"
        />
        <MetricCard
          label="Avg response time"
          value={`${Math.round(metrics.avgLatencyMs)}ms`}
          href="/analytics"
          hint="Model latency, not chatter typing"
        />
        <MetricCard
          label="AI acceptance"
          value={formatPct(metrics.acceptance)}
          href="/analytics"
          hint={`${formatPct(metrics.editRate)} edited`}
        />
        <MetricCard
          label="Escalation rate"
          value={formatPct(metrics.escalationRate)}
          href="/escalations"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="text-sm font-medium">Revenue trend</div>
          <p className="mt-1 text-xs text-white/40">Daily purchase events in the selected range.</p>
          <div className="mt-4 flex h-40 items-end gap-1">
            {metrics.series.length ? (
              metrics.series.map((row) => {
                const max = Math.max(...metrics.series.map((s) => s.revenue), 1);
                return (
                  <div key={row.day} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-canopy-500/70"
                      style={{ height: `${Math.max(6, (row.revenue / max) * 100)}%` }}
                      title={`${row.day}: ${row.revenue}`}
                    />
                  </div>
                );
              })
            ) : (
              <EmptyState title="No trend yet" body="Purchases in this window will chart here." />
            )}
          </div>
        </Card>
        <Card>
          <div className="text-sm font-medium">Funnel</div>
          <p className="mt-1 text-xs text-white/40">Conversations → offers → unlocks</p>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between">
              <span>Conversations</span>
              <span>{metrics.conversations}</span>
            </li>
            <li className="flex justify-between">
              <span>Offers</span>
              <span>{metrics.offers}</span>
            </li>
            <li className="flex justify-between">
              <span>Unlocks</span>
              <span>{metrics.unlocks}</span>
            </li>
          </ol>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-medium">Top-performing creators</div>
          <ul className="mt-3 space-y-2 text-sm">
            {metrics.creators.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <Link href={`/creators/${c.id}`} className="text-canopy-300">
                  {c.name}
                </Link>
                <span className="text-white/50">
                  {formatUsdFromCents(c.revenueCents)} · {c.conversations} chats
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="text-sm font-medium">Chatter leaderboard</div>
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
            <p className="mt-3 text-sm text-white/40">No accepted suggestions in this window.</p>
          )}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Recent escalations</div>
            <Link href="/escalations" className="text-xs text-canopy-300">
              View all
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {metrics.recentEscalations.map((e) => (
              <li key={e.id}>
                <Badge tone="bad">{e.reason}</Badge>{" "}
                {e.conversation ? (
                  <Link href={`/conversations/${e.conversation.id}`} className="text-canopy-300">
                    {e.conversation.subscriber.displayName} / {e.conversation.creator.displayName}
                  </Link>
                ) : null}
              </li>
            ))}
            {!metrics.recentEscalations.length ? (
              <li className="text-white/40">None open.</li>
            ) : null}
          </ul>
        </Card>
        <Card>
          <div className="text-sm font-medium">Extension / API health</div>
          <p className="mt-2 text-sm text-white/60">
            Active extension sessions: {metrics.tokens}. Provider generations in range:{" "}
            {metrics.generationCount}.
          </p>
          <Link href="/platform" className="mt-3 inline-block text-xs text-canopy-300">
            Open platform & extension
          </Link>
        </Card>
      </div>
    </div>
  );
}
