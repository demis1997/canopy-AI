import { prisma } from "@canopy/database";
import { assignedCreatorIds } from "@/lib/access";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, PageHeader } from "@/components/page-chrome";
import { SequenceEditor } from "@/components/sequence-editor";
import { hasPermission } from "@canopy/shared";

export default async function SequencesPage() {
  const { allowed, ctx } = await guardOrgPage(["creators.manage", "conversations.view"]);
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const ids = await assignedCreatorIds(ctx);
  const [creators, products, sequences] = await Promise.all([
    prisma.creator.findMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        active: true,
        ...(ids ? { id: { in: ids } } : {}),
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.product.findMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        available: true,
        ...(ids ? { creatorId: { in: ids } } : {}),
      },
    }),
    prisma.sequence.findMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        ...(ids ? { creatorId: { in: ids } } : {}),
      },
      include: { steps: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Optimize"
        title="Sequences"
        description="Per-model scripts like Inflow: openers, teasers, voice/photo captions, PPV at list, full-price follow-ups, discount only after silence, aftercare after the third unlock."
      />
      <SequenceEditor
        canEdit={hasPermission(ctx.role, "creators.manage") || ctx.isPlatformAdmin}
        creators={creators.map((c) => ({ id: c.id, name: c.displayName }))}
        products={products.map((p) => ({ id: p.id, name: p.name, creatorId: p.creatorId }))}
        sequences={sequences.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          description: s.description,
          active: s.active,
          creatorId: s.creatorId,
          steps: s.steps.map((step) => ({
            body: step.body,
            mediaHint: step.mediaHint,
            delayMinutes: step.delayMinutes,
            productId: step.productId,
            priceTier: step.priceTier,
          })),
        }))}
      />
    </div>
  );
}
