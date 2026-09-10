import { NextResponse } from "next/server";
import { generateRequestSchema } from "@canopy/shared";
import { prisma } from "@canopy/database";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { generateForConversation } from "@/server/generate";
import { assignedCreatorIds } from "@/lib/access";
import { rateLimit } from "@/server/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    if (!rateLimit(`gen:${ctx.userId}`, 20)) {
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
    const body = generateRequestSchema.parse({
      conversationId: id,
      ...((await request.json().catch(() => ({}))) as object),
    });
    const result = await generateForConversation({
      organizationId: ctx.tenant.organizationId,
      userId: ctx.userId,
      conversationId: id,
      toneOverride: body.toneOverride,
      rewriteStyle: body.rewriteStyle,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
