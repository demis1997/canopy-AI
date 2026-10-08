import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { memoryUpdateSchema } from "@canopy/shared";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    const { id: subscriberId } = await params;
    const body = memoryUpdateSchema.parse(await request.json());
    const memory = await prisma.subscriberMemory.findFirst({
      where: { id: body.id, subscriberId, organizationId: ctx.tenant.organizationId },
    });
    if (!memory) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (body.deleted) {
      await prisma.subscriberMemory.update({
        where: { id: memory.id },
        data: { deletedAt: new Date() },
      });
    } else {
      await prisma.subscriberMemory.update({
        where: { id: memory.id },
        data: {
          value: body.value ?? memory.value,
          verified: body.verified ?? memory.verified,
          lastConfirmedAt: new Date(),
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
