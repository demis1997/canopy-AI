import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { verifyExtensionToken } from "@/server/security";
import { generateForConversation } from "@/server/generate";
import { rateLimit } from "@/server/security";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!auth) return NextResponse.json({ error: "Missing token" }, { status: 401 });
  const user = await verifyExtensionToken(auth);
  if (!user) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  if (!rateLimit(`ext:${user.id}`, 30)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  const membership = user.memberships[0];
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 403 });
  const body = z.object({ conversationId: z.string() }).parse(await request.json());
  const conversation = await prisma.conversation.findFirst({
    where: { id: body.conversationId, organizationId: membership.organizationId },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await generateForConversation({
    organizationId: membership.organizationId,
    userId: user.id,
    conversationId: conversation.id,
  });
  return NextResponse.json(result);
}
