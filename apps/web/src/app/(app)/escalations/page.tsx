import { prisma } from "@canopy/database";
import { Badge, Card } from "@/components/ui/card";
import Link from "next/link";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";

export default async function EscalationsPage() {
  const { allowed, ctx } = await guardOrgPage("conversations.escalate");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const rows = await prisma.escalation.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    include: {
      conversation: {
        select: {
          id: true,
          creator: { select: { displayName: true } },
          subscriber: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operate"
        title="Escalations"
        description="Conversations that require a human. Safety blocks always land here."
      />
      {rows.map((e) => (
        <Card key={e.id}>
          <div className="flex items-center justify-between">
            <Badge tone={e.status === "OPEN" ? "bad" : "neutral"}>{e.reason}</Badge>
            <span className="text-xs text-white/40">{e.status}</span>
          </div>
          <p className="mt-2 text-sm">{e.summary}</p>
          {e.conversation ? (
            <Link className="mt-2 inline-block text-xs text-canopy-400" href={`/conversations/${e.conversation.id}`}>
              {e.conversation.subscriber.displayName} / {e.conversation.creator.displayName}
            </Link>
          ) : null}
        </Card>
      ))}
      {!rows.length ? <EmptyState title="No escalations" body="Age, consent and pricing blocks appear here." /> : null}
    </div>
  );
}
