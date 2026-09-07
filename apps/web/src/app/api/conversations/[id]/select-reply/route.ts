import { NextResponse } from "next/server";
import { selectReplySchema } from "@canopy/shared";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { selectReply } from "@/server/generate";
import { rateLimit } from "@/server/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    if (!rateLimit(`sel:${ctx.userId}`)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const { id } = await params;
    const body = selectReplySchema.parse({ conversationId: id, ...(await request.json()) });
    const result = await selectReply({
      organizationId: ctx.tenant.organizationId,
      userId: ctx.userId,
      conversationId: id,
      generationId: body.generationId,
      replyOptionId: body.replyOptionId,
      editedText: body.editedText,
      inserted: body.inserted,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
