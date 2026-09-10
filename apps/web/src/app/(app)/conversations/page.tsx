import Link from "next/link";
import { prisma } from "@canopy/database";
import { assignedCreatorIds } from "@/lib/access";
import { Badge, Card } from "@/components/ui/card";
import { NewConversationForm } from "@/components/new-conversation-form";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";
import { loadInbox } from "@/lib/inbox";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { allowed, ctx } = await guardOrgPage("conversations.view");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const { q } = await searchParams;
  const ids = await assignedCreatorIds(ctx);
  const inbox = await loadInbox(ctx.tenant.organizationId, ids, q);
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
      <PageHeader
        eyebrow="Operate"
        title="Conversations"
        description="Unified inbox. Open a thread for the copilot panel. Human approval is required before anything is treated as sent."
      />
      <NewConversationForm
        creators={creators.map((c) => ({ id: c.id, name: c.displayName }))}
        subscribers={subscribers.map((s) => ({
          id: s.id,
          name: s.displayName,
          adultStatus: s.adultStatus,
        }))}
      />
      <Card className="p-0">
        {inbox.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-white/40">
              <tr>
                <th className="px-5 py-3">Fan</th>
                <th>Creator</th>
                <th>Intent</th>
                <th>Spend</th>
                <th>Unread</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {inbox.map((c) => (
                <tr key={c.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <Link href={`/conversations/${c.id}`} className="text-canopy-300">
                      {c.fanName}
                    </Link>
                  </td>
                  <td>{c.creatorName}</td>
                  <td>
                    <Badge tone="accent">{c.intent ?? c.funnelStage}</Badge>
                  </td>
                  <td>{c.spendTier}</td>
                  <td>{c.unreadCount}</td>
                  <td className="text-white/50">{new Date(c.lastActivity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6">
            <EmptyState title="No conversations" body="Create a thread or seed the demo agency." />
          </div>
        )}
      </Card>
    </div>
  );
}
