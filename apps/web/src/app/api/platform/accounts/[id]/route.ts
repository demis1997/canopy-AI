import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { emergencyStop, writeAutomationAudit } from "@/server/automation/service";
import { AUTONOMY_MODES, automationPolicyPatchSchema, type AutonomyMode } from "@canopy/shared";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    requirePerm(ctx, "platform.connect");
    const { id } = await params;
    const body = (await request.json()) as {
      autonomyMode?: AutonomyMode;
      emergencyStop?: boolean;
      policy?: unknown;
    };
    if (body.autonomyMode && !AUTONOMY_MODES.includes(body.autonomyMode)) {
      return NextResponse.json({ error: "Invalid autonomy mode" }, { status: 400 });
    }
    const account = await prisma.platformAccount.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
    });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (body.emergencyStop) {
      await emergencyStop({
        organizationId: ctx.tenant.organizationId,
        platformAccountId: account.id,
        userId: ctx.userId,
      });
      return NextResponse.json({ ok: true, autonomyMode: "PAUSED" });
    }
    if (body.autonomyMode) {
      await prisma.platformAccount.update({
        where: { id: account.id },
        data: {
          autonomyMode: body.autonomyMode,
          connectionStatus: body.autonomyMode === "PAUSED" ? "PAUSED" : account.connectionStatus,
        },
      });
      await writeAutomationAudit({
        organizationId: ctx.tenant.organizationId,
        userId: ctx.userId,
        action: "CONFIGURE_AUTONOMY",
        entityType: "PlatformAccount",
        entityId: account.id,
        metadata: { autonomyMode: body.autonomyMode },
      });
    }
    if (body.policy) {
      const policy = automationPolicyPatchSchema.safeParse(body.policy);
      if (!policy.success) return NextResponse.json({ error: "Invalid policy" }, { status: 400 });
      await prisma.automationPolicy.upsert({
        where: { platformAccountId: account.id },
        update: policy.data,
        create: { platformAccountId: account.id, ...policy.data },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
