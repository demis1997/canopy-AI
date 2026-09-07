import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { assignedCreatorIds } from "@/lib/access";
import { Card, Badge } from "@/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dollars } from "@/lib/utils";

export default async function DashboardPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const orgId = ctx.tenant.organizationId;
  const creatorIds = await assignedCreatorIds(ctx);

  const [org, creators, uncertain] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
    prisma.creator.findMany({
      where: {
        organizationId: orgId,
        active: true,
        ...(creatorIds ? { id: { in: creatorIds } } : {}),
      },
      include: {
        personas: { where: { isActive: true }, take: 1 },
        products: { where: { available: true }, orderBy: { standardPriceCents: "asc" } },
        conversations: {
          where: { adultStatus: "VERIFIED_ADULT" },
          include: { subscriber: true },
          orderBy: { lastMessageAt: "desc" },
          take: 1,
        },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.conversation.findFirst({
      where: {
        organizationId: orgId,
        adultStatus: "UNCERTAIN",
        ...(creatorIds ? { creatorId: { in: creatorIds } } : {}),
      },
      include: { subscriber: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-canopy-400">
          {org.isDemo ? "DEMO ORGANIZATION" : org.name}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{org.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">
          Pick a model. You type as the fan; she replies automatically. First pitch is list price.
          Say it is too expensive if you want to see the floor discount.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {creators.map((creator) => {
          const persona = creator.personas[0];
          const chat = creator.conversations[0];
          return (
            <Card key={creator.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-medium">{creator.displayName}</div>
                  <div className="text-xs text-white/40">@{creator.handle}</div>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {persona ? <Badge tone="accent">{persona.style}</Badge> : null}
                  {persona ? <Badge>{persona.allowedExplicitness}</Badge> : null}
                </div>
              </div>
              <p className="text-sm text-white/65">{persona?.personality || creator.bio}</p>
              <ul className="space-y-1 text-sm text-white/70">
                {creator.products.map((p) => (
                  <li key={p.id}>
                    {p.name.replace(" (DEMO)", "")} · {dollars(p.standardPriceCents)}
                    <span className="text-white/35"> · floor {dollars(p.minimumPriceCents)}</span>
                  </li>
                ))}
              </ul>
              {chat ? (
                <Link
                  href={`/conversations/${chat.id}`}
                  className="mt-auto inline-flex h-9 items-center justify-center rounded-md bg-canopy-500 px-3 text-sm font-medium text-ink-950 hover:bg-canopy-400"
                >
                  Open chat with {persona?.displayName ?? creator.displayName}
                </Link>
              ) : (
                <p className="text-xs text-white/40">No adult test chat yet.</p>
              )}
            </Card>
          );
        })}
      </div>

      {uncertain ? (
        <Card className="border-amber-500/20">
          <div className="text-sm font-medium text-amber-200">Safety check</div>
          <p className="mt-1 text-sm text-white/55">
            Age status is uncertain — the model must not auto-send explicit replies.
          </p>
          <Link
            href={`/conversations/${uncertain.id}`}
            className="mt-3 inline-flex text-sm text-canopy-300 hover:text-canopy-200"
          >
            Open {uncertain.subscriber.displayName}
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
