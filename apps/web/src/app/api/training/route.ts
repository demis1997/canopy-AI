import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "training.manage");
    const orgId = ctx.tenant.organizationId;
    const body = z
      .object({
        title: z.string(),
        documentType: z.enum([
          "HISTORICAL_CONVERSATION",
          "APPROVED_EXAMPLE",
          "SALES_SCRIPT",
          "PROMPT",
          "CHATTER_TRAINING",
          "PRODUCT_DESCRIPTION",
          "CREATOR_INSTRUCTIONS",
        ]),
        text: z.string().min(1),
        creatorId: z.string().optional(),
      })
      .parse(await request.json());
    const chunks = body.text
      .split(/\n{2,}/)
      .map((c) => c.trim())
      .filter((c) => c.length > 40);
    const doc = await prisma.trainingDocument.create({
      data: {
        organizationId: orgId,
        creatorId: body.creatorId,
        title: body.title,
        documentType: body.documentType,
        mimeType: "text/plain",
        rawText: body.text,
        status: "PENDING",
        chunks: {
          create: (chunks.length ? chunks : [body.text]).map((content) => ({
            organizationId: orgId,
            creatorId: body.creatorId,
            content,
            documentType: body.documentType,
            status: "PENDING",
            language: "en",
          })),
        },
      },
    });
    return NextResponse.json({ id: doc.id, pendingChunks: chunks.length || 1 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "training.approve");
    const body = z
      .object({ chunkId: z.string(), status: z.enum(["APPROVED", "REJECTED"]) })
      .parse(await request.json());
    const chunk = await prisma.trainingChunk.findFirst({
      where: { id: body.chunkId, organizationId: ctx.tenant.organizationId },
    });
    if (!chunk) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.trainingChunk.update({ where: { id: chunk.id }, data: { status: body.status } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
