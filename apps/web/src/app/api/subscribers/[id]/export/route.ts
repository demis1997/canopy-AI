import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "settings.retention");
    const { id } = await params;
    const subscriber = await prisma.subscriber.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
      include: { memories: true, conversations: true, purchases: true },
    });
    if (!subscriber) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        userId: ctx.userId,
        action: "EXPORT",
        entityType: "Subscriber",
        entityId: id,
      },
    });
    return NextResponse.json({
      subscriber: {
        id: subscriber.id,
        displayName: subscriber.displayName,
        platformHandle: subscriber.platformHandle,
        adultStatus: subscriber.adultStatus,
      },
      memories: subscriber.memories,
      conversationIds: subscriber.conversations.map((c) => c.id),
      purchases: subscriber.purchases.map((p) => ({
        id: p.id,
        amountCents: p.amountCents,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "settings.retention");
    const { id } = await params;
    const subscriber = await prisma.subscriber.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
    });
    if (!subscriber) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.subscriberMemory.deleteMany({
      where: { subscriberId: id, organizationId: ctx.tenant.organizationId },
    });
    await prisma.message.deleteMany({
      where: {
        organizationId: ctx.tenant.organizationId,
        conversation: { subscriberId: id },
      },
    });
    await prisma.conversation.deleteMany({
      where: { subscriberId: id, organizationId: ctx.tenant.organizationId },
    });
    await prisma.subscriber.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        userId: ctx.userId,
        action: "DELETE",
        entityType: "Subscriber",
        entityId: id,
      },
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
