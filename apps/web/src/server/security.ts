import { prisma } from "@canopy/database";
import { createHash, randomBytes } from "node:crypto";

const WINDOW_MS = 60_000;
const LIMIT = 40;
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = LIMIT): boolean {
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.reset < now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function issueExtensionToken(userId: string, organizationId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const row = await prisma.extensionToken.create({
    data: { userId, organizationId, tokenHash, expiresAt },
  });
  return { token, expiresAt, id: row.id };
}

export async function listExtensionTokens(userId: string) {
  return prisma.extensionToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, createdAt: true, expiresAt: true, revokedAt: true },
  });
}

export async function revokeExtensionToken(userId: string, id: string) {
  const row = await prisma.extensionToken.findFirst({ where: { id, userId } });
  if (!row) return null;
  return prisma.extensionToken.update({ where: { id }, data: { revokedAt: new Date() } });
}

export async function verifyExtensionToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = await prisma.extensionToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { memberships: true } } },
  });
  if (!row || row.revokedAt || row.expiresAt < new Date()) return null;
  if (!row.organizationId) return null;
  const membership = row.user.memberships.find((m) => m.organizationId === row.organizationId);
  if (!membership) return null;
  return { user: row.user, membership };
}
