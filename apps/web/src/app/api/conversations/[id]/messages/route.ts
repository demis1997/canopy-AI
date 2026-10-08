import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { handleFanTurn } from "@/server/generation";
import { rateLimit } from "@/server/security";
import { getConversationAccess } from "@/lib/access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    if (!rateLimit(`msg:${ctx.userId}`)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const { id } = await params;
    const access = await getConversationAccess(ctx, id);
    if (!access.ok)
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status },
      );
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
