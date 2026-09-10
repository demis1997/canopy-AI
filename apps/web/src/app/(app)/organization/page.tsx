import { prisma } from "@canopy/database";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, PageHeader } from "@/components/page-chrome";
import { Card } from "@/components/ui/card";

export default async function OrgSettingsPage() {
  const { allowed, ctx } = await guardOrgPage("org.manage");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.tenant.organizationId },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configure"
        title="Organization"
        description="Agency identity, seats and workspace status."
      />
      <Card className="grid gap-3 text-sm md:grid-cols-2">
        <div>Name: {org.name}</div>
        <div>Slug: {org.slug}</div>
        <div>Type: {org.type}</div>
        <div>Status: {org.status}</div>
        <div>Seats: {org.seatLimit}</div>
        {org.isDemo ? <div className="text-amber-300 md:col-span-2">This workspace is labelled DEMO data.</div> : null}
      </Card>
    </div>
  );
}
