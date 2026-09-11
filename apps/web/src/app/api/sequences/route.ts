import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { sequenceInputSchema } from "@canopy/shared";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { assignedCreatorIds } from "@/lib/access";

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.view");
    const creatorId = new URL(request.url).searchParams.get("creatorId");
    const allowed = await assignedCreatorIds(ctx);
    if (creatorId && allowed && !allowed.includes(creatorId)) {
      return NextResponse.json({ sequences: [] });
    }
    const sequences = await prisma.sequence.findMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        ...(creatorId ? { creatorId } : allowed ? { creatorId: { in: allowed } } : {}),
      },
      include: { steps: { orderBy: { position: "asc" } }, creator: true },
      orderBy: [{ creatorId: "asc" }, { kind: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ sequences });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "creators.manage");
    const orgId = ctx.tenant.organizationId;
    const body = sequenceInputSchema.parse(await request.json());
    const creator = await prisma.creator.findFirst({
      where: { id: body.creatorId, organizationId: ctx.tenant.organizationId },
    });
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    const sequence = await prisma.sequence.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        creatorId: body.creatorId,
        name: body.name,
        kind: body.kind,
        description: body.description,
        active: body.active,
        steps: {
          create: body.steps.map((step, position) => ({
            organizationId: orgId,
            position,
            body: step.body,
            mediaHint: step.mediaHint,
            delayMinutes: step.delayMinutes,
            productId: step.productId || null,
            priceTier: step.priceTier,
          })),
        },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    return NextResponse.json({ sequence });
  } catch (error) {
    return jsonError(error);
  }
}
