import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

export default async function OrgSettingsPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.tenant.organizationId },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Organization</h1>
      <Card className="space-y-2 text-sm">
        <div>Name: {org.name}</div>
        <div>Slug: {org.slug}</div>
        <div>Type: {org.type}</div>
        <div>Status: {org.status}</div>
        <div>Seats: {org.seatLimit}</div>
        {org.isDemo ? <div className="text-amber-300">This is labelled DEMO data.</div> : null}
      </Card>
    </div>
  );
}
