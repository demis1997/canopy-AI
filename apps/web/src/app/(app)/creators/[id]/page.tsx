import { notFound } from "next/navigation";
import { prisma } from "@canopy/database";
import { Card, Badge } from "@/components/ui/card";
import { PersonaForm } from "@/components/persona-form";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, PageHeader } from "@/components/page-chrome";
import Link from "next/link";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { allowed, ctx } = await guardOrgPage([
    "creators.view_assigned",
    "creators.manage",
    "creators.edit_own_persona",
  ]);
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const { id } = await params;
  const creator = await prisma.creator.findFirst({
    where: { id, organizationId: ctx.tenant.organizationId },
    include: { personas: { orderBy: { version: "desc" } }, products: true },
  });
  if (!creator) notFound();
  const active = creator.personas.find((p) => p.isActive) ?? creator.personas[0];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`@${creator.handle}`}
        title={creator.displayName}
        description={creator.bio}
        actions={
          <Link href="/conversations" className="text-sm text-canopy-300">
            Open conversations
          </Link>
        }
      />
      {active ? (
        <PersonaForm
          creatorId={creator.id}
          initial={{
            displayName: active.displayName,
            biography: active.biography,
            authorisedBackstory: active.authorisedBackstory,
            personality: active.personality,
            tone: active.tone,
            typicalMessageLength: active.typicalMessageLength,
            preferredEmojis: active.preferredEmojis,
            frequentlyUsedPhrases: active.frequentlyUsedPhrases,
            preferredExplicitVocabulary: active.preferredExplicitVocabulary,
            prohibitedWords: active.prohibitedWords,
            preferredCompliments: active.preferredCompliments,
            allowedExplicitness: active.allowedExplicitness,
            style: active.style,
            interests: active.interests,
            contentBoundaries: active.contentBoundaries,
            claimsNeverToMake: active.claimsNeverToMake,
            customContentRules: active.customContentRules,
            offlineMeetingPolicy: active.offlineMeetingPolicy,
            discountLimitPercent: active.discountLimitPercent,
            escalationRules: active.escalationRules,
            approvedExampleMessages: active.approvedExampleMessages,
          }}
        />
      ) : null}
      <Card>
        <div className="text-sm font-medium">Approved catalog</div>
        <ul className="mt-3 space-y-1 text-sm text-white/70">
          {creator.products.map((p) => (
            <li key={p.id}>
              <Link href="/products" className="text-canopy-300">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="text-sm font-medium">Persona versions</div>
        <ul className="mt-3 space-y-1 text-sm text-white/60">
          {creator.personas.map((p) => (
            <li key={p.id}>
              v{p.version} {p.isActive ? <Badge tone="good">active</Badge> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
