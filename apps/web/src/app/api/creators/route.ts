import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { personaInputSchema } from "@canopy/shared";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "creators.manage");
    const body = z
      .object({
        displayName: z.string().min(1),
        handle: z.string().min(1).max(40),
        persona: personaInputSchema.partial().optional(),
      })
      .parse(await request.json());
    const creator = await prisma.creator.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        displayName: body.displayName,
        handle: body.handle,
      },
    });
    await prisma.creatorPersona.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        creatorId: creator.id,
        version: 1,
        isActive: true,
        displayName: body.persona?.displayName ?? body.displayName,
        biography: body.persona?.biography ?? "",
        authorisedBackstory: body.persona?.authorisedBackstory ?? "",
        personality: body.persona?.personality ?? "",
        tone: body.persona?.tone ?? "",
        typicalMessageLength: body.persona?.typicalMessageLength ?? "SHORT",
        preferredEmojis: body.persona?.preferredEmojis ?? [],
        frequentlyUsedPhrases: body.persona?.frequentlyUsedPhrases ?? [],
        preferredExplicitVocabulary: body.persona?.preferredExplicitVocabulary ?? [],
        prohibitedWords: body.persona?.prohibitedWords ?? [],
        preferredCompliments: body.persona?.preferredCompliments ?? [],
        allowedExplicitness: body.persona?.allowedExplicitness ?? "SUGGESTIVE",
        style: body.persona?.style ?? "PLAYFUL",
        interests: body.persona?.interests ?? [],
        contentBoundaries: body.persona?.contentBoundaries ?? [],
        claimsNeverToMake: body.persona?.claimsNeverToMake ?? [],
        customContentRules: body.persona?.customContentRules ?? "",
        offlineMeetingPolicy:
          body.persona?.offlineMeetingPolicy ?? "Never arrange offline meetings.",
        discountLimitPercent: body.persona?.discountLimitPercent ?? 10,
        escalationRules: body.persona?.escalationRules ?? "",
        approvedExampleMessages: body.persona?.approvedExampleMessages ?? [],
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        userId: ctx.userId,
        action: "CREATE",
        entityType: "Creator",
        entityId: creator.id,
      },
    });
    return NextResponse.json({ id: creator.id });
  } catch (error) {
    return jsonError(error);
  }
}
