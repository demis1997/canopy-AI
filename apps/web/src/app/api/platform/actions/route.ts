import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    requirePerm(ctx, "automation.review");
    const status = new URL(request.url).searchParams.get("status");
    const actions = await prisma.automationAction.findMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        platformConversation: true,
        platformAccount: { include: { creator: true } },
      },
    });
    return NextResponse.json({
      actions: actions.map((action) => ({
        id: action.id,
        status: action.status,
        actionType: action.actionType,
        confidence: action.confidence,
        escalationReason: action.escalationReason,
        generatedPayload: action.generatedPayload,
        finalPayload: action.finalPayload,
        creatorName: action.platformAccount.creator.displayName,
        fanName: action.platformConversation.externalFanDisplayName,
        humanTakeover: action.platformConversation.humanTakeover,
        createdAt: action.createdAt,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
