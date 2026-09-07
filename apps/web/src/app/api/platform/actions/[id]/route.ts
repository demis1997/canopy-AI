import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { approveAction, releaseHumanTakeover } from "@/server/automation/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    requirePerm(ctx, "automation.review");
    const { id } = await params;
    const body = (await request.json()) as {
      editedText?: string;
      reject?: boolean;
      returnToAutonomy?: boolean;
    };
    const result = await approveAction({
      organizationId: ctx.tenant.organizationId,
      actionId: id,
      userId: ctx.userId,
      editedText: body.editedText,
      reject: body.reject,
      returnToAutonomy: body.returnToAutonomy,
    });
    if (body.returnToAutonomy) {
      const action = await prisma.automationAction.findFirst({
        where: { id, organizationId: ctx.tenant.organizationId },
      });
      if (action) {
        await releaseHumanTakeover({
          organizationId: ctx.tenant.organizationId,
          platformConversationId: action.platformConversationId,
        });
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
