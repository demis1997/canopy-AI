import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { recordAnalytics } from "@/server/generate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.escalate");
    const { id } = await params;
    const body = z
      .object({ reason: z.string().default("MANUAL"), summary: z.string().optional() })
      .parse(await request.json().catch(() => ({})));
    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
    });
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const escalation = await prisma.escalation.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        conversationId: id,
        openedById: ctx.userId,
        reason: body.reason === "MANUAL" ? "MANUAL" : "MANUAL",
        summary: body.summary ?? "Manual chatter escalation",
        riskEvent: { retainedText: false },
      },
    });
    await recordAnalytics({
      organizationId: ctx.tenant.organizationId,
      type: "ESCALATION",
      creatorId: conversation.creatorId,
      chatterId: ctx.userId,
      conversationId: id,
    });
    return NextResponse.json({ id: escalation.id });
  } catch (error) {
    return jsonError(error);
  }
}
