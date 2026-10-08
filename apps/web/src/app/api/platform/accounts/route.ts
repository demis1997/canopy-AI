import { z } from "zod";
import { OnlyFansApiClient } from "@/platform/onlyfans-api-client";
import { NextResponse } from "next/server";
import {
  prisma,
  requireTenant,
  assertSameOrganization,
  encryptSecret,
  lastFour,
} from "@canopy/database";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { writeAutomationAudit } from "@/server/automation/service";

export async function GET() {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    requirePerm(ctx, "automation.review");
    const accounts = await prisma.platformAccount.findMany({
      where: { organizationId: ctx.tenant.organizationId },
      include: {
        policy: true,
        creator: true,
        actions: { take: 8, orderBy: { createdAt: "desc" } },
      },
    });
    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        creatorId: account.creatorId,
        creatorName: account.creator.displayName,
        displayName: account.displayName,
        driver: account.driver,
        providerAccountId: account.providerAccountId,
        lastCatalogSyncAt: account.lastCatalogSyncAt,
        lastReceiptSyncAt: account.lastReceiptSyncAt,
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
    const body = z
      .object({
        creatorId: z.string().min(1),
        driver: z.enum(["MOCK", "BROWSER", "ONLYFANS_API"]).default("MOCK"),
        displayName: z.string().min(1).max(100).optional(),
        providerAccountId: z
          .string()
          .regex(/^acct_[A-Za-z0-9_-]+$/)
          .optional(),
        apiKey: z.string().min(1).max(512).optional(),
      })
      .parse(await request.json());
    if (!body.creatorId) return NextResponse.json({ error: "creatorId required" }, { status: 400 });
    const creator = await prisma.creator.findFirst({
      where: { id: body.creatorId, organizationId: ctx.tenant.organizationId },
    });
    if (!creator)
      return NextResponse.json({ error: "Creator not in this organization" }, { status: 404 });
    await assertSameOrganization(requireTenant(ctx.tenant.organizationId), creator.organizationId);
    let apiData = {};
    if (body.driver === "ONLYFANS_API") {
      if (!body.providerAccountId || !body.apiKey)
        return NextResponse.json(
          { error: "API key and connected account ID required" },
          { status: 400 },
        );
      const me = await new OnlyFansApiClient(body.providerAccountId, body.apiKey).me();
      if (me.isAuth === false)
        return NextResponse.json({ error: "Provider account is disconnected" }, { status: 409 });
      const existing = await prisma.platformAccount.findFirst({
        where: { organizationId: ctx.tenant.organizationId, creatorId: creator.id },
      });
      const duplicate = await prisma.platformAccount.findFirst({
        where: {
          organizationId: ctx.tenant.organizationId,
          creatorId: { not: creator.id },
          externalAccountId: me.id,
        },
      });
      if (
        duplicate ||
        (existing?.externalAccountId &&
          existing.driver === "ONLYFANS_API" &&
          existing.externalAccountId !== me.id)
      ) {
        return NextResponse.json(
          { error: "This account belongs to a different creator connection" },
          { status: 409 },
        );
      }
      apiData = {
        providerAccountId: body.providerAccountId,
        externalAccountId: me.id,
        encryptedApiKey: encryptSecret(body.apiKey),
        apiKeyLastFour: lastFour(body.apiKey),
        connectionStatus: "CONNECTED",
        authorizedAt: new Date(),
      };
    }
    const account = await prisma.platformAccount.upsert({
      where: {
        organizationId_creatorId_platform: {
          organizationId: ctx.tenant.organizationId,
          creatorId: creator.id,
          platform: "ONLYFANS",
        },
      },
      update: {
        displayName: body.displayName ?? creator.displayName,
        driver: body.driver,
        ...apiData,
      },
      create: {
        organizationId: ctx.tenant.organizationId,
        creatorId: creator.id,
        displayName: body.displayName ?? creator.displayName,
        driver: body.driver ?? "MOCK",
        autonomyMode: "COPILOT",
        ...apiData,
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
    return NextResponse.json({
      account: {
        id: account.id,
        creatorId: account.creatorId,
        driver: account.driver,
        connectionStatus: account.connectionStatus,
        displayName: account.displayName,
        providerAccountId: account.providerAccountId,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
