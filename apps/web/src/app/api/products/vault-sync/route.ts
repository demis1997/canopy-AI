import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { enqueueJob, getQueue } from "@/server/jobs/queue";

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgUser();
    requirePerm(ctx, "products.manage");
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    const platformAccountId = new URL(request.url).searchParams.get("accountId");
    const runs = await prisma.catalogSyncRun.findMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        ...(platformAccountId ? { platformAccountId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return NextResponse.json({ runs });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    requirePerm(ctx, "products.manage");
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    const body = z.object({ platformAccountId: z.string().min(1) }).parse(await request.json());
    const account = await prisma.platformAccount.findFirst({
      where: {
        id: body.platformAccountId,
        organizationId: ctx.tenant.organizationId,
        driver: "ONLYFANS_API",
      },
    });
    if (!account?.providerAccountId || !account.encryptedApiKey || !account.externalAccountId) {
      return NextResponse.json(
        { error: "Connect this creator to OnlyFansAPI first" },
        { status: 409 },
      );
    }
    if (!getQueue())
      return NextResponse.json(
        { error: "Catalog import requires Redis and the Canopy worker" },
        { status: 503 },
      );
    const existing = await prisma.catalogSyncRun.findFirst({
      where: { platformAccountId: account.id, status: { in: ["QUEUED", "RUNNING"] } },
    });
    if (existing)
      return NextResponse.json(
        {
          runId: existing.id,
          status: existing.status,
          message: "Import already queued or running",
        },
        { status: 202 },
      );
    let run;
    try {
      run = await prisma.catalogSyncRun.create({
        data: { organizationId: ctx.tenant.organizationId, platformAccountId: account.id },
      });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        const active = await prisma.catalogSyncRun.findFirstOrThrow({
          where: { platformAccountId: account.id, status: { in: ["QUEUED", "RUNNING"] } },
        });
        return NextResponse.json(
          { runId: active.id, status: active.status, message: "Import already queued or running" },
          { status: 202 },
        );
      }
      throw error;
    }
    try {
      await enqueueJob("sync-platform-catalog", {
        organizationId: ctx.tenant.organizationId,
        platformAccountId: account.id,
        syncRunId: run.id,
      });
    } catch {
      await prisma.catalogSyncRun.update({
        where: { id: run.id },
        data: { status: "FAILED", lastError: "QUEUE_UNAVAILABLE" },
      });
      return NextResponse.json({ error: "Import queue unavailable" }, { status: 503 });
    }
    return NextResponse.json(
      {
        runId: run.id,
        status: "QUEUED",
        message: "Vault media and paid posts/messages queued for import",
      },
      { status: 202 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
