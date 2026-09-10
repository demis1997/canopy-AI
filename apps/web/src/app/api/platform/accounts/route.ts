import { NextResponse } from "next/server";
import { prisma, requireTenant, assertSameOrganization } from "@canopy/database";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { writeAutomationAudit } from "@/server/automation/service";

export async function GET() {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    requirePerm(ctx, "automation.review");
    const accounts = await prisma.platformAccount.findMany({
      where: { organizationId: ctx.tenant.organizationId },
      include: { policy: true, creator: true, actions: { take: 8, orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        creatorId: account.creatorId,
        creatorName: account.creator.displayName,
        displayName: account.displayName,
        driver: account.driver,
        autonomyMode: account.autonomyMode,
        connectionStatus: account.connectionStatus,
        lastHeartbeatAt: account.lastHeartbeatAt,
        lastInboxSyncAt: account.lastInboxSyncAt,
        manualInterventionReason: account.manualInterventionReason,
        policy: account.policy,
        recentActions: account.actions.map((action) => ({
          id: action.id,
          status: action.status,
          actionType: action.actionType,
          escalationReason: action.escalationReason,
          createdAt: action.createdAt,
        })),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    requirePerm(ctx, "platform.connect");
    const body = (await request.json()) as { creatorId?: string; driver?: "MOCK" | "BROWSER"; displayName?: string };
    if (!body.creatorId) return NextResponse.json({ error: "creatorId required" }, { status: 400 });
    const creator = await prisma.creator.findFirst({
      where: { id: body.creatorId, organizationId: ctx.tenant.organizationId },
    });
    if (!creator) return NextResponse.json({ error: "Creator not in this organization" }, { status: 404 });
    await assertSameOrganization(requireTenant(ctx.tenant.organizationId), creator.organizationId);
    const account = await prisma.platformAccount.upsert({
      where: {
        organizationId_creatorId_platform: {
          organizationId: ctx.tenant.organizationId,
          creatorId: creator.id,
          platform: "ONLYFANS",
        },
      },
      update: { displayName: body.displayName ?? creator.displayName, driver: body.driver ?? "MOCK" },
      create: {
        organizationId: ctx.tenant.organizationId,
        creatorId: creator.id,
        displayName: body.displayName ?? creator.displayName,
        driver: body.driver ?? "MOCK",
        autonomyMode: "AUTOPILOT",
        policy: { create: {} },
      },
      include: { policy: true },
    });
    await writeAutomationAudit({
      organizationId: ctx.tenant.organizationId,
      userId: ctx.userId,
      action: "CONNECT_PLATFORM",
      entityType: "PlatformAccount",
      entityId: account.id,
      metadata: { driver: account.driver },
    });
    return NextResponse.json({ account });
  } catch (error) {
    return jsonError(error);
  }
}
