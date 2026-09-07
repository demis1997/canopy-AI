import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { assignedCreatorIds } from "@/lib/access";
import { rateLimit } from "@/server/security";

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.view");
    if (!rateLimit(`conv:${ctx.userId}`)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const body = z
      .object({ creatorId: z.string(), subscriberId: z.string() })
      .parse(await request.json());
    const allowed = await assignedCreatorIds(ctx);
    if (allowed && !allowed.includes(body.creatorId)) {
      return NextResponse.json({ error: "Creator not assigned" }, { status: 403 });
    }
    const creator = await prisma.creator.findFirst({
      where: { id: body.creatorId, organizationId: ctx.tenant.organizationId },
    });
    const subscriber = await prisma.subscriber.findFirst({
      where: { id: body.subscriberId, organizationId: ctx.tenant.organizationId },
    });
    if (!creator || !subscriber) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.conversation.findFirst({
      where: {
        organizationId: ctx.tenant.organizationId,
        creatorId: creator.id,
        subscriberId: subscriber.id,
      },
    });
    if (existing) return NextResponse.json({ id: existing.id });
    const created = await prisma.conversation.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        creatorId: creator.id,
        subscriberId: subscriber.id,
        adultStatus: subscriber.adultStatus,
        funnelStage: "NEW_FAN",
      },
    });
    return NextResponse.json({ id: created.id });
  } catch (error) {
    return jsonError(error);
  }
}
