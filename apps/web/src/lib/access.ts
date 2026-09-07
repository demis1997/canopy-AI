import { prisma } from "@canopy/database";
import type { SessionContext } from "./session";

export async function assignedCreatorIds(ctx: SessionContext): Promise<string[] | null> {
  if (!ctx.organizationId) return [];
  if (ctx.role === "CHATTER") {
    const rows = await prisma.chatterCreatorAssignment.findMany({
      where: { organizationId: ctx.organizationId, chatterId: ctx.userId },
      select: { creatorId: true },
    });
    return rows.map((r) => r.creatorId);
  }
  if (ctx.role === "CREATOR") {
    const rows = await prisma.creator.findMany({
      where: { organizationId: ctx.organizationId, userId: ctx.userId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  return null;
}

export function creatorWhere(ids: string[] | null) {
  if (ids === null) return {};
  return { creatorId: { in: ids } };
}
