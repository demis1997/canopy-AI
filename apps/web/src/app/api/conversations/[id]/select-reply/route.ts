import { getConversationAccess } from "@/lib/access";
import { NextResponse } from "next/server";
import { selectReplySchema } from "@canopy/shared";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { selectReply } from "@/server/generation";
import { rateLimit } from "@/server/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    if (!rateLimit(`sel:${ctx.userId}`)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const { id } = await params;
    const access = await getConversationAccess(ctx, id);
    if (!access.ok)
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status },
      );
    const body = selectReplySchema.parse({ conversationId: id, ...(await request.json()) });
    const result = await selectReply({
      organizationId: ctx.tenant.organizationId,
      userId: ctx.userId,
      conversationId: id,
      generationId: body.generationId,
      replyOptionId: body.replyOptionId,
      editedText: body.editedText,
      inserted: body.inserted,
      discard: body.discard,
      rejectReason: body.rejectReason,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
