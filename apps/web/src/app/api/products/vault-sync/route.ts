import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";

export async function POST() {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "products.manage");
    const authorised = process.env.CANOPY_PLATFORM_VAULT_SYNC === "1";
    const existing = await prisma.platformConnection.findFirst({
      where: { organizationId: ctx.tenant.organizationId },
    });
    const data = {
      mode: authorised ? ("PLATFORM_VAULT_SYNC" as const) : ("DEMO" as const),
      enabled: authorised,
      label: authorised ? "Authorised vault connector" : "Demo vault",
      note: authorised
        ? "Flag CANOPY_PLATFORM_VAULT_SYNC is on. Live credentials are still not stored here."
        : "No authorised live platform API is connected. DEMO uses seeded vault data.",
    };
    if (existing) {
      await prisma.platformConnection.update({ where: { id: existing.id }, data });
    } else {
      await prisma.platformConnection.create({
        data: { organizationId: ctx.tenant.organizationId, ...data },
      });
    }
    if (!authorised) {
      return NextResponse.json({
        enabled: false,
        mode: "DEMO",
        message:
          "PLATFORM_VAULT_SYNC is disabled. Canopy does not provide a public OnlyFans API, does not scrape credentials, and will not crawl an account. Use manual create, CSV import, or a permitted extension “Import selected items” flow.",
      });
    }
    return NextResponse.json({
      enabled: true,
      mode: "PLATFORM_VAULT_SYNC",
      message: "Authorised flag is on. Connector recorded; no live crawl was performed.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
