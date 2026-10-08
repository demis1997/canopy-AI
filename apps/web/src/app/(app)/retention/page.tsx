import { prisma } from "@canopy/database";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, PageHeader } from "@/components/page-chrome";
import { Card } from "@/components/ui/card";

export default async function RetentionPage() {
  const { allowed, ctx } = await guardOrgPage("settings.retention");
  if (!ctx.tenant) return <AccessDenied />;
  if (!allowed) return <AccessDenied />;
  const policy = await prisma.dataRetentionPolicy.findUnique({
    where: { organizationId: ctx.tenant.organizationId },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configure"
        title="Data retention"
        description="Privacy windows for messages, memories, generations and audit records."
      />
      <Card className="space-y-2 text-sm">
        <div>Messages: {policy?.messageRetentionDays ?? 90} days</div>
        <div>Memories: {policy?.memoryRetentionDays ?? 180} days</div>
        <div>Generations: {policy?.generationRetentionDays ?? 90} days</div>
        <div>Audit: {policy?.auditRetentionDays ?? 365} days</div>
        <p className="pt-2 text-white/50">
          Subscriber export and deletion are on the subscriber page. Safety rules cannot be
          disabled.
        </p>
      </Card>
    </div>
  );
}
