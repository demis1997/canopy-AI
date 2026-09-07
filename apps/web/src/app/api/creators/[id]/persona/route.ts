import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { personaInputSchema } from "@canopy/shared";
import { requireOrgUser, jsonError } from "@/lib/session";
import { hasPermission } from "@canopy/shared";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    const { id } = await params;
    const creator = await prisma.creator.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
      include: { personas: { where: { isActive: true } } },
    });
    if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const canManage = hasPermission(ctx.role, "creators.manage");
    const own = creator.userId === ctx.userId && hasPermission(ctx.role, "creators.edit_own_persona");
    if (!canManage && !own) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = personaInputSchema.parse(await request.json());
    const version = (creator.personas[0]?.version ?? 0) + 1;
    await prisma.creatorPersona.updateMany({
      where: { creatorId: creator.id, isActive: true },
      data: { isActive: false },
    });
    await prisma.creatorPersona.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        creatorId: creator.id,
        version,
        isActive: true,
        ...body,
      },
    });
    return NextResponse.json({ version });
  } catch (error) {
    return jsonError(error);
  }
}
