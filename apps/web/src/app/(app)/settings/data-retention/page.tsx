import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

export default async function RetentionPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const policy = await prisma.dataRetentionPolicy.findUnique({
    where: { organizationId: ctx.tenant.organizationId },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Data retention</h1>
      <Card className="space-y-2 text-sm">
        <div>Messages: {policy?.messageRetentionDays ?? 90} days</div>
        <div>Memories: {policy?.memoryRetentionDays ?? 180} days</div>
        <div>Generations: {policy?.generationRetentionDays ?? 90} days</div>
        <div>Audit: {policy?.auditRetentionDays ?? 365} days</div>
        <p className="pt-2 text-white/50">
          Subscriber export and deletion are available on the subscriber page. Safety rules cannot be
          disabled.
        </p>
      </Card>
    </div>
  );
}
