import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui/card";
import Link from "next/link";

export default async function EscalationsPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const rows = await prisma.escalation.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    include: { conversation: { include: { creator: true, subscriber: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Escalations</h1>
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
    </div>
  );
}
