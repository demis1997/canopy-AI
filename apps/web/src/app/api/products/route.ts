import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { parseProductCsv, productInputSchema } from "@canopy/shared";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";

export async function GET() {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    const products = await prisma.product.findMany({
      where: { organizationId: ctx.tenant.organizationId },
      include: { creator: true, media: true, previews: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ products });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "products.manage");
    const body = productInputSchema.parse(await request.json());
    const creator = await prisma.creator.findFirst({
      where: { id: body.creatorId, organizationId: ctx.tenant.organizationId },
    });
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    if (body.minimumPrice > body.standardPrice) {
      return NextResponse.json({ error: "Minimum price cannot exceed standard price" }, { status: 400 });
    }
    const product = await prisma.product.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        creatorId: body.creatorId,
        name: body.name,
        description: body.description,
        mediaType: body.mediaType,
        standardPriceCents: Math.round(body.standardPrice * 100),
        minimumPriceCents: Math.round(body.minimumPrice * 100),
        bundlePriceCents: body.bundlePrice != null ? Math.round(body.bundlePrice * 100) : null,
        tags: body.tags,
        explicitnessCategory: body.explicitnessCategory,
        available: body.available,
        customContent: body.customContent,
        deliveryRules: body.deliveryRules,
        source: body.source ?? "MANUAL",
      },
    });
    return NextResponse.json({ id: product.id });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "products.manage");
    const { csv } = (await request.json()) as { csv?: string };
    if (!csv) return NextResponse.json({ error: "CSV required" }, { status: 400 });
    const rows = parseProductCsv(csv);
    const valid = rows.filter((r) => r.errors.length === 0);
    const creators = await prisma.creator.findMany({
      where: { organizationId: ctx.tenant.organizationId, active: true },
    });
    const created: string[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const row of rows) {
      if (row.errors.length) {
        skipped.push({ name: row.name || row.external_id, reason: row.errors.join(", ") });
        continue;
      }
      const creator = creators.find(
        (c) =>
          c.displayName.toLowerCase() === row.creator.toLowerCase() ||
          c.handle.toLowerCase() === row.creator.toLowerCase(),
      );
      if (!creator) {
        skipped.push({ name: row.name, reason: `Unknown creator ${row.creator}` });
        continue;
      }
      const product = await prisma.product.create({
        data: {
          organizationId: ctx.tenant.organizationId,
          creatorId: creator.id,
          name: row.name,
          description: row.description,
          mediaType: row.content_type as "PHOTO" | "VIDEO" | "AUDIO" | "TEXT" | "BUNDLE" | "CUSTOM",
          standardPriceCents: Math.round(row.standard_price * 100),
          minimumPriceCents: Math.round(row.minimum_price * 100),
          tags: row.tags,
          available: row.availability,
          source: "CSV_IMPORT",
          externalId: row.external_id || null,
        },
      });
      created.push(product.id);
    }
    return NextResponse.json({ created: created.length, skipped, valid: valid.length });
  } catch (error) {
    return jsonError(error);
  }
}
