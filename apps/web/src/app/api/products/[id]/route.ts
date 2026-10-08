import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { requireOrgUser, requirePerm, jsonError } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgUser();
    requirePerm(ctx, "products.manage");
    if (!ctx.tenant) return NextResponse.json({ error: "Organization required" }, { status: 400 });
    const { id } = await params;
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(8000).optional(),
        standardPriceCents: z.number().int().min(300).max(20_000),
        minimumPriceCents: z.number().int().min(300).max(20_000),
        available: z.boolean(),
        approvedForAutomation: z.boolean().default(false),
      })
      .refine((b) => b.minimumPriceCents <= b.standardPriceCents, "Minimum exceeds standard price")
      .parse(await request.json());
    const product = await prisma.product.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
      include: { media: { include: { media: true } }, previews: { include: { media: true } } },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (
      (body.available || body.approvedForAutomation) &&
      (!product.sourceAvailable ||
        (product.source === "PLATFORM_VAULT_SYNC" &&
          (!product.media.length ||
            [...product.media, ...product.previews].some(
              (m) => !m.media.available || !m.media.externalId,
            ))))
    ) {
      return NextResponse.json(
        { error: "Source media is unavailable or incomplete" },
        { status: 409 },
      );
    }
    await prisma.$transaction([
      prisma.product.update({ where: { id }, data: body }),
      prisma.auditLog.create({
        data: {
          organizationId: ctx.tenant.organizationId,
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "Product",
          entityId: id,
          metadata: {
            available: body.available,
            approvedForAutomation: body.approvedForAutomation,
          },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
