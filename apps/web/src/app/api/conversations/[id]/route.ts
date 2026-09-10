import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { assignedCreatorIds } from "@/lib/access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    const { id } = await params;
    const body = z.object({ mutedAi: z.boolean() }).parse(await request.json());
    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
    });
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const allowed = await assignedCreatorIds(ctx);
    if (allowed && !allowed.includes(conversation.creatorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { mutedAi: body.mutedAi },
    });
    await prisma.platformConversation.updateMany({
      where: { canopyConversationId: conversation.id, organizationId: ctx.tenant.organizationId },
      data: {
        humanTakeover: body.mutedAi,
        automationLockedUntil: body.mutedAi ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
      },
    });
    return NextResponse.json({ id: updated.id, mutedAi: updated.mutedAi });
  } catch (error) {
    return jsonError(error);
  }
}
