import { NextResponse } from "next/server";
import { generateRequestSchema } from "@canopy/shared";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { generateForConversation } from "@/server/generation";
import { getConversationAccess } from "@/lib/access";
import { rateLimit } from "@/server/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    if (!rateLimit(`gen:${ctx.userId}`, 20)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const { id } = await params;
    const access = await getConversationAccess(ctx, id);
    if (!access.ok)
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status },
      );
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
