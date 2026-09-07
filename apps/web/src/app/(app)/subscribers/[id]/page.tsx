import { notFound, redirect } from "next/navigation";
import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { Badge, Card } from "@/components/ui/card";
import Link from "next/link";

export default async function SubscriberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const { id } = await params;
  const subscriber = await prisma.subscriber.findFirst({
    where: { id, organizationId: ctx.tenant.organizationId },
    include: {
      conversations: { include: { creator: true } },
      memories: { where: { deletedAt: null } },
      purchases: true,
    },
  });
  if (!subscriber) notFound();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{subscriber.displayName}</h1>
        <p className="text-sm text-white/50">@{subscriber.platformHandle}</p>
        <Badge tone={subscriber.adultStatus === "UNCERTAIN" ? "bad" : "good"}>
          {subscriber.adultStatus}
        </Badge>
      </div>
      <Card>
        <div className="text-sm font-medium">Conversations</div>
        <ul className="mt-2 space-y-1 text-sm">
          {subscriber.conversations.map((c) => (
            <li key={c.id}>
              <Link className="text-canopy-300" href={`/conversations/${c.id}`}>
                {c.creator.displayName} · {c.funnelStage}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="text-sm font-medium">Memories</div>
        <ul className="mt-2 space-y-2 text-sm text-white/70">
          {subscriber.memories.map((m) => (
            <li key={m.id}>
              {m.category}: {m.value} {m.verified ? "(verified)" : `(confidence ${m.confidence})`}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
