import { prisma } from "@canopy/database";
import { Badge, Card } from "@/components/ui/card";
import { TrainingInbox } from "@/components/training-inbox";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";

export default async function TrainingPage() {
  const { allowed, ctx } = await guardOrgPage("training.approve");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const chunks = await prisma.trainingChunk.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    include: { document: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Optimize"
        title="Training"
        description="Approved examples, playbooks and feedback. Chunks stay pending until a manager approves them."
      />
      <TrainingInbox
        chunks={chunks.map((c) => ({
          id: c.id,
          title: c.document.title,
          content: c.content,
          status: c.status,
        }))}
      />
      <div className="grid gap-3">
        {chunks.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{c.document.title}</div>
              <Badge tone={c.status === "APPROVED" ? "good" : c.status === "REJECTED" ? "bad" : "warn"}>
                {c.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-white/60">{c.content.slice(0, 280)}</p>
          </Card>
        ))}
      </div>
      {!chunks.length ? <EmptyState title="No training chunks" body="Upload anonymized examples for manager approval." /> : null}
    </div>
  );
}
