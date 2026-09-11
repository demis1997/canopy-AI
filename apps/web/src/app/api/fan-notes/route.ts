import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { fanNoteInputSchema } from "@canopy/shared";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { assignedCreatorIds } from "@/lib/access";

export async function PUT(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    const body = fanNoteInputSchema.parse(await request.json());
    const allowed = await assignedCreatorIds(ctx);
    if (allowed && !allowed.includes(body.creatorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [creator, subscriber] = await Promise.all([
      prisma.creator.findFirst({
        where: { id: body.creatorId, organizationId: ctx.tenant.organizationId },
      }),
      prisma.subscriber.findFirst({
        where: { id: body.subscriberId, organizationId: ctx.tenant.organizationId },
      }),
    ]);
    if (!creator || !subscriber) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const note = await prisma.fanNote.upsert({
      where: {
        creatorId_subscriberId: { creatorId: body.creatorId, subscriberId: body.subscriberId },
      },
      create: {
        organizationId: ctx.tenant.organizationId,
        creatorId: body.creatorId,
        subscriberId: body.subscriberId,
        realName: body.realName,
        location: body.location,
        dominance: body.dominance,
        preferredTone: body.preferredTone,
        notes: body.notes,
        extra: body.extra,
      },
      update: {
        realName: body.realName,
        location: body.location,
        dominance: body.dominance,
        preferredTone: body.preferredTone,
        notes: body.notes,
        extra: body.extra,
      },
    });
    return NextResponse.json({ note });
  } catch (error) {
    return jsonError(error);
  }
}
