import { prisma } from "@canopy/database";
import { requireUser } from "@/lib/session";
import { AccessDenied, MetricCard, PageHeader } from "@/components/page-chrome";
import { Card } from "@/components/ui/card";
import { AdminOrgTable } from "@/components/admin-org-table";
import Link from "next/link";

export default async function AdminPage() {
  const ctx = await requireUser();
  if (!ctx.isPlatformAdmin) {
    return (
      <AccessDenied
        title="Platform administration only"
        description="This screen is hidden from agency operators. Ask a platform admin if you need access."
      />
    );
  }
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true, generations: true } },
    },
  });
  const generations = await prisma.generation.count();
  const failures = await prisma.generation.count({ where: { status: "FAILED" } });
  const lastByOrg = await prisma.analyticsEvent.groupBy({
    by: ["organizationId"],
    _max: { createdAt: true },
  });
  const lastMap = new Map(lastByOrg.map((r) => [r.organizationId, r._max.createdAt?.toISOString() ?? null]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Platform admin"
        description="Organizations, usage and provider failures. AI keys live on the AI provider page."
        actions={
          <Link href="/ai-provider" className="rounded-[10px] border border-white/10 px-3 py-2 text-sm">
            Open AI provider
          </Link>
        }
      />
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Organizations" value={String(orgs.length)} />
        <MetricCard label="Generations" value={String(generations)} />
        <MetricCard label="Provider failures" value={String(failures)} />
      </div>
      <AdminOrgTable
        orgs={orgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          status: o.status,
          type: o.type,
          isDemo: o.isDemo,
          seatLimit: o.seatLimit,
          memberCount: o._count.memberships,
          generationCount: o._count.generations,
          lastActivity: lastMap.get(o.id) ?? o.updatedAt.toISOString(),
        }))}
      />
      <Card className="text-sm text-white/50">
        Tenant isolation is enforced in queries. Do not paste live subscriber identifiers into support notes.
      </Card>
    </div>
  );
}
