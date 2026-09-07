import { notFound, redirect } from "next/navigation";
import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { Card, Badge } from "@/components/ui/card";
import { PersonaForm } from "@/components/persona-form";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const { id } = await params;
  const creator = await prisma.creator.findFirst({
    where: { id, organizationId: ctx.tenant.organizationId },
    include: { personas: { orderBy: { version: "desc" } }, products: true },
  });
  if (!creator) notFound();
  const active = creator.personas.find((p) => p.isActive) ?? creator.personas[0];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{creator.displayName}</h1>
        <p className="text-sm text-white/50">@{creator.handle}</p>
      </div>
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
