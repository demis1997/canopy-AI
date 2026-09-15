import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";

const TEMPLATES: {
  name: string;
  kind: "STARTER" | "TEASER" | "VOICE" | "PPV" | "FOLLOW_UP" | "AFTERCARE";
  description: string;
  steps: { body: string; mediaHint: "TEXT" | "VOICE" | "PHOTO" | "PPV"; delayMinutes: number; priceTier: number; useProduct?: boolean }[];
}[] = [
  {
    name: "New / existing fan flow",
    kind: "STARTER",
    description: "Intake script: opener, gym, what he’s doing, vibe check, age, location, job, then tease. One beat per send. Take notes.",
    steps: [
      { body: "oh heyy youre here NAME. hows it going? enjoying the view so far ;)", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "im doing great actually was about to get ready to go to the gym and saw u here", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "well what you doing now? doing anything interesting besides talking to me? 😏", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "sooo before we keep going both hands free rn or is one of them busy... 👀", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "mmm how old are you? feel curious idk why", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "where are you from btw? lets see how close (or far) we are 😏", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "soo last question then u always busy? what do u do for a living? just curiouss", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "done with the boring questions haha i want to tell you something now...", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
    ],
  },
  {
    name: "Tease + photo",
    kind: "TEASER",
    description: "Warm-up before a paid drop. Attach a free/blurred photo on the live platform.",
    steps: [
      { body: "i'm in a mean mood. want a peek or are you gonna make me wait?", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "here. that's the tease. the rest isn't free.", mediaHint: "PHOTO", delayMinutes: 8, priceTier: 1 },
    ],
  },
  {
    name: "Voice note",
    kind: "VOICE",
    description: "Send the voice on OnlyFans; this is the caption.",
    steps: [
      { body: "listen to this and tell me if you can behave.", mediaHint: "VOICE", delayMinutes: 0, priceTier: 1 },
    ],
  },
  {
    name: "PPV first send",
    kind: "PPV",
    description: "Pitch the catalog item at full price. The first PPV (≤ $10) is never discounted.",
    steps: [
      { body: "this one's for you. full thing, list price. you actually want it or just looking?", mediaHint: "PPV", delayMinutes: 0, priceTier: 1, useProduct: true },
    ],
  },
  {
    name: "No-buy follow-ups",
    kind: "FOLLOW_UP",
    description: "If he doesn't pay, keep asking at list. Discount only after he goes silent — never on the first PPV.",
    steps: [
      { body: "still thinking about that set? it's sitting here at the same price.", mediaHint: "TEXT", delayMinutes: 180, priceTier: 1, useProduct: true },
      { body: "hey you went quiet. unlock it at list before i take it down.", mediaHint: "TEXT", delayMinutes: 360, priceTier: 1, useProduct: true },
      { body: "ok you vanished. i can meet you in the middle on this one — not the first ppv.", mediaHint: "PPV", delayMinutes: 720, priceTier: 2, useProduct: true },
    ],
  },
  {
    name: "Aftercare",
    kind: "AFTERCARE",
    description: "After the second PPV he bought. Not after the first unlock. No more pitching.",
    steps: [
      { body: "no pressure. i'm around when you want me, not going to spam you.", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      { body: "hope you're good. come back when you miss me.", mediaHint: "TEXT", delayMinutes: 1440, priceTier: 1 },
    ],
  },
];

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "creators.manage");
    const orgId = ctx.tenant.organizationId;
    const { creatorId } = z.object({ creatorId: z.string() }).parse(await request.json());
    const creator = await prisma.creator.findFirst({
      where: { id: creatorId, organizationId: ctx.tenant.organizationId },
      include: { products: { where: { available: true }, take: 1 } },
    });
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    const productId = creator.products[0]?.id ?? null;
    const created = [];
    for (const template of TEMPLATES) {
      const existing = await prisma.sequence.findFirst({
        where: {
          organizationId: ctx.tenant.organizationId,
          creatorId,
          kind: template.kind,
          name: template.name,
        },
      });
      if (existing) continue;
      created.push(
        await prisma.sequence.create({
          data: {
            organizationId: ctx.tenant.organizationId,
            creatorId,
            name: template.name,
            kind: template.kind,
            description: template.description,
            steps: {
              create: template.steps.map((step, position) => ({
                organizationId: orgId,
                position,
                body: step.body,
                mediaHint: step.mediaHint,
                delayMinutes: step.delayMinutes,
                priceTier: step.priceTier,
                productId: step.useProduct ? productId : null,
              })),
            },
          },
        }),
      );
    }
    return NextResponse.json({ created: created.length });
  } catch (error) {
    return jsonError(error);
  }
}
