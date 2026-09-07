import Link from "next/link";
import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { assignedCreatorIds, creatorWhere } from "@/lib/access";
import { Badge, Card } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { NewConversationForm } from "@/components/new-conversation-form";

export default async function ConversationsPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const ids = await assignedCreatorIds(ctx);
  const conversations = await prisma.conversation.findMany({
    where: { organizationId: ctx.tenant.organizationId, ...creatorWhere(ids) },
    include: { creator: true, subscriber: true },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
  });
  const creators = await prisma.creator.findMany({
    where: {
      organizationId: ctx.tenant.organizationId,
      ...(ids ? { id: { in: ids } } : {}),
    },
  });
  const subscribers = await prisma.subscriber.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    orderBy: { displayName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Conversations</h1>
          <p className="mt-1 text-sm text-white/50">
            Type as the fan. Each demo model replies automatically in her persona and pitches her
            catalog at list price first.
          </p>
        </div>
      </div>
      <NewConversationForm
        creators={creators.map((c) => ({ id: c.id, name: c.displayName }))}
        subscribers={subscribers.map((s) => ({
          id: s.id,
          name: s.displayName,
          adultStatus: s.adultStatus,
        }))}
      />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-white/40">
            <tr>
              <th className="px-5 py-3">Subscriber</th>
              <th>Creator</th>
              <th>Stage</th>
              <th>Age status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => (
              <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-5 py-3">
                  <Link href={`/conversations/${c.id}`} className="text-canopy-300">
                    {c.subscriber.displayName}
                  </Link>
                </td>
                <td>{c.creator.displayName}</td>
                <td>
                  <Badge tone="accent">{c.funnelStage}</Badge>
                </td>
                <td>
                  <Badge tone={c.adultStatus.includes("MINOR") || c.adultStatus === "UNCERTAIN" ? "bad" : "good"}>
                    {c.adultStatus}
                  </Badge>
                </td>
                <td className="text-white/50">{c.lastMessageAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
