import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { sequenceInputSchema } from "@canopy/shared";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "creators.manage");
    const orgId = ctx.tenant.organizationId;
    const { id } = await params;
    const body = sequenceInputSchema.parse(await request.json());
    const existing = await prisma.sequence.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.sequenceStep.deleteMany({ where: { sequenceId: existing.id } });
    const sequence = await prisma.sequence.update({
      where: { id: existing.id },
      data: {
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "creators.manage");
    const { id } = await params;
    const existing = await prisma.sequence.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.sequence.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
