import { prisma } from "@canopy/database";
import { collectOperatorRejections } from "@canopy/shared";
import { Badge, Card } from "@/components/ui/card";
import { TrainingInbox } from "@/components/training-inbox";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";

export default async function TrainingPage() {
  const { allowed, ctx } = await guardOrgPage("training.approve");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const [chunks, discardedRows] = await Promise.all([
    prisma.trainingChunk.findMany({
      where: { organizationId: ctx.tenant.organizationId },
      include: { document: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.replyOption.findMany({
      where: { organizationId: ctx.tenant.organizationId, outcome: "DISCARDED" },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, text: true, internalReason: true, createdAt: true },
    }),
  ]);
  const rejections = collectOperatorRejections(discardedRows, 20);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Optimize"
        title="Training"
        description="Approved examples, playbooks and rejected drafts. Reject reasons are fed back into the next generate."
      />
      <TrainingInbox
        chunks={chunks.map((c) => ({
          id: c.id,
          title: c.document.title,
          content: c.content,
          status: c.status,
        }))}
      />
      <Card className="space-y-3">
        <div className="text-sm font-medium">Rejected copilot drafts</div>
        <p className="text-sm text-mist">
          Reasons you typed on Reject are saved and applied as style bans on the next generate.
        </p>
        {rejections.length ? (
          <ul className="space-y-3">
            {rejections.map((row) => (
              <li key={row.reason} className="rounded-[10px] border border-white/[0.06] p-3">
                <div className="text-sm text-brass">{row.reason}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-mist">{row.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mist">No reject reasons yet. Reject a suggestion and type why.</p>
        )}
      </Card>
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
      {!chunks.length && !rejections.length ? (
        <EmptyState title="No training chunks" body="Upload anonymized examples for manager approval." />
      ) : null}
    </div>
  );
}
