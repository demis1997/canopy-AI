import { z } from "zod";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { parseProductCsv, productInputSchema } from "@canopy/shared";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";

export async function GET() {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "products.manage");
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
      return NextResponse.json(
        { error: "Minimum price cannot exceed standard price" },
        { status: 400 },
      );
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
        secondPriceCents: body.secondPrice != null ? Math.round(body.secondPrice * 100) : null,
        discountLimitPercent: body.discountLimitPercent,
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
    const { csv } = z.object({ csv: z.string().min(1).max(1_000_000) }).parse(await request.json());
    if (!csv) return NextResponse.json({ error: "CSV required" }, { status: 400 });
    const rows = parseProductCsv(csv);
    if (rows.length > 5000)
      return NextResponse.json({ error: "Maximum 5000 rows per import" }, { status: 400 });
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
      const importKey = `${ctx.tenant.organizationId}:csv:${creator.id}:${row.external_id || createHash("sha256").update(JSON.stringify(row)).digest("hex")}`;
      const product = await prisma.$transaction(async (tx) => {
        const data = {
          name: row.name,
          description: row.description,
          mediaType: row.content_type as "PHOTO" | "VIDEO" | "AUDIO" | "TEXT" | "BUNDLE" | "CUSTOM",
          standardPriceCents: Math.round(row.standard_price * 100),
          minimumPriceCents: Math.round(row.minimum_price * 100),
          discountLimitPercent: Math.round(row.discount_limit_percent),
          tags: row.tags,
          available: row.availability,
          source: "CSV_IMPORT" as const,
          externalId: row.external_id || null,
        };
        const p = await tx.product.upsert({
          where: { importKey },
          create: {
            ...data,
            organizationId: ctx.tenant!.organizationId,
            creatorId: creator.id,
            importKey,
          },
          update: data,
        });
        await tx.productMedia.deleteMany({ where: { productId: p.id } });
        await tx.productPreview.deleteMany({ where: { productId: p.id } });
        for (const [reference, preview] of [
          [row.media_reference, false],
          [row.preview_reference, true],
        ] as const) {
          if (!reference) continue;
          const media = await tx.mediaAsset.upsert({
            where: {
              importKey: `${ctx.tenant!.organizationId}:csv-media:${creator.id}:${reference}`,
            },
            create: {
              importKey: `${ctx.tenant!.organizationId}:csv-media:${creator.id}:${reference}`,
              organizationId: ctx.tenant!.organizationId,
              creatorId: creator.id,
              externalId: reference,
              title: row.name,
              mediaType: data.mediaType,
              source: "CSV_IMPORT",
            },
            update: {},
          });
          if (preview)
            await tx.productPreview.upsert({
              where: { productId_mediaId: { productId: p.id, mediaId: media.id } },
              create: { productId: p.id, mediaId: media.id },
              update: {},
            });
          else
            await tx.productMedia.upsert({
              where: { productId_mediaId: { productId: p.id, mediaId: media.id } },
              create: { productId: p.id, mediaId: media.id },
              update: {},
            });
        }
        return p;
      });
      created.push(product.id);
    }
    return NextResponse.json({ created: created.length, skipped, valid: valid.length });
  } catch (error) {
    return jsonError(error);
  }
}
