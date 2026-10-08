import { NextResponse } from "next/server";
import { assignedCreatorIds } from "@/lib/access";
import { requirePerm, jsonError, type SessionContext } from "@/lib/session";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { verifyExtensionToken } from "@/server/security";
import { generateForConversation } from "@/server/generation";
import { rateLimit } from "@/server/security";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!auth) return NextResponse.json({ error: "Missing token" }, { status: 401 });
  const verified = await verifyExtensionToken(auth);
  if (!verified) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  const { user, membership } = verified;
  try {
    if (!rateLimit(`ext:${user.id}`, 30)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const ctx: SessionContext = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      organizationId: membership.organizationId,
      isPlatformAdmin: user.isPlatformAdmin,
    };
    requirePerm(ctx, "conversations.generate");
    const body = z.object({ conversationId: z.string() }).parse(await request.json());
    const conversation = await prisma.conversation.findFirst({
      where: { id: body.conversationId, organizationId: membership.organizationId },
    });
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const allowed = await assignedCreatorIds(ctx);
    if (allowed && !allowed.includes(conversation.creatorId))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const result = await generateForConversation({
      organizationId: membership.organizationId,
      userId: user.id,
      conversationId: conversation.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
