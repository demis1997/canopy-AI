import { prisma } from "@canopy/database";
import { assignedCreatorIds } from "@/lib/access";
import { Badge, Card } from "@/components/ui/card";
import Link from "next/link";
import { CreateCreatorForm } from "@/components/create-creator-form";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";

export default async function CreatorsPage() {
  const { allowed, ctx } = await guardOrgPage([
    "creators.view_assigned",
    "creators.manage",
    "creators.edit_own_persona",
  ]);
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const ids = await assignedCreatorIds(ctx);
  const creators = await prisma.creator.findMany({
    where: {
      organizationId: ctx.tenant.organizationId,
      ...(ids ? { id: { in: ids } } : {}),
    },
    include: { personas: { where: { isActive: true }, take: 1 } },
  });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operate" title="Creators" description="Personas, boundaries and assigned accounts." />
      {ctx.role === "AGENCY_OWNER" || ctx.role === "MANAGER" ? <CreateCreatorForm /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {creators.map((c) => (
          <Link key={c.id} href={`/creators/${c.id}`}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium">{c.displayName}</div>
                  <div className="text-xs text-white/40">@{c.handle}</div>
                </div>
                {c.isDemo ? <Badge tone="warn">DEMO</Badge> : null}
              </div>
              <p className="mt-3 text-sm text-white/60">{c.personas[0]?.personality || c.bio}</p>
              <div className="mt-3">
                <Badge>{c.personas[0]?.allowedExplicitness}</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {!creators.length ? <EmptyState title="No creators" body="Owners and managers can add a persona." /> : null}
    </div>
  );
}
