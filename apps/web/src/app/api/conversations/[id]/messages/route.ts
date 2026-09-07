import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { handleFanTurn } from "@/server/generate";
import { rateLimit } from "@/server/security";
import { assignedCreatorIds } from "@/lib/access";
import { prisma } from "@canopy/database";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    if (!rateLimit(`msg:${ctx.userId}`)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
    });
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const allowed = await assignedCreatorIds(ctx);
    if (allowed && !allowed.includes(conversation.creatorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = z
      .object({
        text: z.string().min(1).max(8000),
        autoReply: z.boolean().optional().default(true),
      })
      .parse(await request.json());
    const result = await handleFanTurn({
      organizationId: ctx.tenant.organizationId,
      userId: ctx.userId,
      conversationId: id,
      text: body.text,
      autoReply: body.autoReply,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
