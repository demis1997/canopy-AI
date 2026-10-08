import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";

const TEMPLATES: {
  name: string;
  kind: "STARTER" | "TEASER" | "VOICE" | "PPV" | "FOLLOW_UP" | "AFTERCARE";
  description: string;
  steps: {
    body: string;
    mediaHint: "TEXT" | "VOICE" | "PHOTO" | "PPV";
    delayMinutes: number;
    priceTier: number;
    useProduct?: boolean;
  }[];
}[] = [
  {
    name: "New / existing fan flow",
    kind: "STARTER",
    description:
      "PDF intake: how is he, vibe (hands), age/location/job into notes, personal permission, then sub/dom. Welcome-paid skips to the bundle + permission.",
    steps: [
      { body: "heyy NAME. how are you", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      {
        body: "im doing great actually was about to get ready to go to the gym and saw u here",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "how many hands are you typing with?",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "mmm how old are you? feel curious idk why",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "where are you from btw? lets see how close or far we are",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "soo last question then u always busy? what do u do for a living? just curiouss",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "you know, i cant quite read you yet. mind if i ask you something a little personal?",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "are you usually the one taking control, or do you like being told what to do?",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
    ],
  },
  {
    name: "Tease + photo",
    kind: "TEASER",
    description: "Warm-up before a paid drop. Attach a free/blurred photo on the live platform.",
    steps: [
      {
        body: "i'm in a mean mood. want a peek or are you gonna make me wait?",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "here. that's the tease. the rest isn't free.",
        mediaHint: "PHOTO",
        delayMinutes: 8,
        priceTier: 1,
      },
    ],
  },
  {
    name: "Voice note",
    kind: "VOICE",
    description: "Send the voice on OnlyFans; this is the caption.",
    steps: [
      {
        body: "listen to this and tell me if you can behave.",
        mediaHint: "VOICE",
        delayMinutes: 0,
        priceTier: 1,
      },
    ],
  },
  {
    name: "PPV first send",
    kind: "PPV",
    description: "Pitch the catalog item at full price. The first PPV (≤ $10) is never discounted.",
    steps: [
      {
        body: "this one's for you. full thing, list price. you actually want it or just looking?",
        mediaHint: "PPV",
        delayMinutes: 0,
        priceTier: 1,
        useProduct: true,
      },
    ],
  },
  {
    name: "No-buy follow-ups",
    kind: "FOLLOW_UP",
    description:
      "If he doesn't pay, keep asking at list. Discount only after he goes silent — never on the first PPV.",
    steps: [
      {
        body: "still thinking about that set? it's sitting here at the same price.",
        mediaHint: "TEXT",
        delayMinutes: 180,
        priceTier: 1,
        useProduct: true,
      },
      {
        body: "hey you went quiet. unlock it at list before i take it down.",
        mediaHint: "TEXT",
        delayMinutes: 360,
        priceTier: 1,
        useProduct: true,
      },
      {
        body: "ok you vanished. i can meet you in the middle on this one — not the first ppv.",
        mediaHint: "PPV",
        delayMinutes: 720,
        priceTier: 2,
        useProduct: true,
      },
    ],
  },
  {
    name: "S1 Black lingerie",
    kind: "TEASER",
    description: "Black lace warmup with dildo tease. First PPV is the $8 lingerie drop.",
    steps: [
      {
        body: "dont get too excited.. i havent done anything yet",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "im just getting warmed up baby... and by the looks of things so are you",
        mediaHint: "PHOTO",
        delayMinutes: 2,
        priceTier: 1,
      },
      {
        body: "this one's the black lace tease. list price. u actually wanna see",
        mediaHint: "PPV",
        delayMinutes: 4,
        priceTier: 1,
        useProduct: true,
      },
    ],
  },
  {
    name: "S2 Netflix script",
    kind: "PPV",
    description: "Movie-night sexting into the Netflix PPV.",
    steps: [
      {
        body: "put something on netflix and keep ur hands where i can use them",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "i shot the rest of that scene. wanna watch it with me",
        mediaHint: "PPV",
        delayMinutes: 6,
        priceTier: 1,
        useProduct: true,
      },
    ],
  },
  {
    name: "S3 Dominant script",
    kind: "PPV",
    description: "Control / JOI into the dominant drop.",
    steps: [
      {
        body: "good. now be obedient and dont touch till i say",
        mediaHint: "VOICE",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "this is the mean one. list price. u earning it or wasting my time",
        mediaHint: "PPV",
        delayMinutes: 5,
        priceTier: 1,
        useProduct: true,
      },
    ],
  },
  {
    name: "Sexting script — fleshlight",
    kind: "PPV",
    description: "Toy / fleshlight sexting into that PPV.",
    steps: [
      { body: "grab that toy. i wanna hear it", mediaHint: "TEXT", delayMinutes: 0, priceTier: 1 },
      {
        body: "i filmed me using one too. u getting it or just talking",
        mediaHint: "PPV",
        delayMinutes: 5,
        priceTier: 1,
        useProduct: true,
      },
    ],
  },
  {
    name: "Aftercare",
    kind: "AFTERCARE",
    description:
      "After the third sequence product he bought. Not after the first or second unlock. No more pitching.",
    steps: [
      {
        body: "that was so good, seriously felt like cloud nine, haha",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "i want to get to know you more than just on a sexual note, because thats only gonna bring us closer together",
        mediaHint: "TEXT",
        delayMinutes: 0,
        priceTier: 1,
      },
      {
        body: "and if we are closer together.. that means even our fun is gonna be spicier and spicier as we progress",
        mediaHint: "TEXT",
        delayMinutes: 1440,
        priceTier: 1,
      },
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
