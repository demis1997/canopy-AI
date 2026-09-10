import { notFound } from "next/navigation";
import { prisma } from "@canopy/database";
import { assignedCreatorIds } from "@/lib/access";
import { CopilotWorkspace } from "@/components/copilot-workspace";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied } from "@/components/page-chrome";
import { loadInbox } from "@/lib/inbox";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { allowed, ctx } = await guardOrgPage("conversations.view");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: ctx.tenant.organizationId },
    include: {
      creator: { include: { personas: { where: { isActive: true }, take: 1 } } },
      subscriber: true,
      summary: true,
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });
  if (!conversation) notFound();
  const allowedIds = await assignedCreatorIds(ctx);
  if (allowedIds && !allowedIds.includes(conversation.creatorId)) notFound();

  const [memories, products, takeover, latestGeneration, inbox] = await Promise.all([
    prisma.subscriberMemory.findMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        subscriberId: conversation.subscriberId,
        creatorId: conversation.creatorId,
        deletedAt: null,
      },
      orderBy: { lastConfirmedAt: "desc" },
    }),
    prisma.product.findMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        creatorId: conversation.creatorId,
        available: true,
      },
    }),
    prisma.platformConversation.findFirst({
      where: {
        canopyConversationId: conversation.id,
        organizationId: ctx.tenant.organizationId,
        humanTakeover: true,
      },
    }),
    prisma.generation.findFirst({
      where: { organizationId: ctx.tenant.organizationId, conversationId: conversation.id },
      include: { replyOptions: true },
      orderBy: { createdAt: "desc" },
    }),
    loadInbox(ctx.tenant.organizationId, allowedIds),
  ]);

  return (
    <div className="space-y-4">
      {takeover ? (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Human takeover active. Automation is locked on this conversation until an operator releases it.
        </div>
      ) : null}
      <CopilotWorkspace
        inbox={inbox}
        conversation={{
          id: conversation.id,
          funnelStage: conversation.funnelStage,
          adultStatus: conversation.adultStatus,
          blocked: conversation.blocked,
          creatorName: conversation.creator.displayName,
          subscriberName: conversation.subscriber.displayName,
          personaName: conversation.creator.personas[0]?.displayName ?? conversation.creator.displayName,
          explicitness: conversation.creator.personas[0]?.allowedExplicitness ?? "SUGGESTIVE",
          summary: conversation.summary?.summary ?? null,
          mutedAi: conversation.mutedAi,
        }}
        messages={conversation.messages.map((m) => ({
          id: m.id,
          authorType: m.authorType,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          aiAssisted: m.aiAssisted,
          isPaid: m.isPaid,
          priceCents: m.priceCents,
          purchased: m.purchased,
        }))}
        memories={memories.map((m) => ({
          id: m.id,
          category: m.category,
          key: m.key,
          value: m.value,
          confidence: m.confidence,
          verified: m.verified,
        }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.standardPriceCents / 100,
          min: p.minimumPriceCents / 100,
        }))}
        initialGeneration={
          latestGeneration
            ? {
                id: latestGeneration.id,
                status: latestGeneration.status,
                intent: latestGeneration.intent,
                recommendedAction: latestGeneration.recommendedAction,
                riskFlags: latestGeneration.riskFlags,
                validationErrors: latestGeneration.validationErrors,
                recommendedProductId: latestGeneration.recommendedProductId,
                approvedPriceCents: latestGeneration.approvedPriceCents,
                replyOptions: latestGeneration.replyOptions.map((o) => ({
                  id: o.id,
                  text: o.text,
                  tone: o.tone,
                  internalReason: o.internalReason,
                })),
              }
            : null
        }
      />
    </div>
  );
}
