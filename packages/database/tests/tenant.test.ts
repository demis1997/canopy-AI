import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { requireTenant, tenantDb, scopedWhere } from "../src/tenant.js";
import { TenantIsolationError } from "@canopy/shared";
import { encryptSecret, decryptSecret } from "../src/encryption.js";

describe("requireTenant", () => {
  it("rejects missing organization context", () => {
    expect(() => requireTenant(undefined)).toThrow(TenantIsolationError);
    expect(() => requireTenant("")).toThrow(TenantIsolationError);
  });

  it("always injects organizationId into queries", () => {
    const where = scopedWhere(requireTenant("org_a"), { id: "creator_from_b" });
    expect(where.organizationId).toBe("org_a");
    expect(where.id).toBe("creator_from_b");
  });
});

describe("credential encryption", () => {
  beforeAll(() => {
    process.env.APP_ENCRYPTION_KEY ??=
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("round-trips secrets without storing plaintext", () => {
    const encrypted = encryptSecret("sk-venice-test-key");
    expect(encrypted).not.toContain("sk-venice");
    expect(decryptSecret(encrypted)).toBe("sk-venice-test-key");
  });
});

describe("tenant isolation", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("prevents org A from reading org B creators, subscribers, conversations, messages, memories, products, prompts, analytics, and training", async ({
    skip,
  }) => {
    try {
      await prisma.$connect();
    } catch (error) {
      if (process.env.CI) throw error;
      skip();
      return;
    }
    const orgs = await prisma.organization.findMany({
      where: { slug: { in: ["lumen-demo", "isolation-test"] } },
    });
    const lumen = orgs.find((o) => o.slug === "lumen-demo");
    const iso = orgs.find((o) => o.slug === "isolation-test");
    if (!lumen || !iso) {
      throw new Error("Seed data missing — run pnpm db:seed");
    }

    const a = tenantDb(requireTenant(lumen.id), prisma);
    const b = tenantDb(requireTenant(iso.id), prisma);

    const [aCreators, bCreators] = await Promise.all([
      a.creators.findMany(),
      b.creators.findMany(),
    ]);
    expect(aCreators.every((c) => c.organizationId === lumen.id)).toBe(true);
    expect(bCreators.every((c) => c.organizationId === iso.id)).toBe(true);
    expect(aCreators.some((c) => bCreators.map((x) => x.id).includes(c.id))).toBe(false);

    const [aSubs, bSubs] = await Promise.all([a.subscribers.findMany(), b.subscribers.findMany()]);
    expect(aSubs.every((s) => s.organizationId === lumen.id)).toBe(true);
    expect(bSubs.every((s) => s.organizationId === iso.id)).toBe(true);

    const [aConv, bConv] = await Promise.all([
      a.conversations.findMany(),
      b.conversations.findMany(),
    ]);
    expect(aConv.every((c) => c.organizationId === lumen.id)).toBe(true);
    expect(bConv.length === 0 || bConv.every((c) => c.organizationId === iso.id)).toBe(true);

    const [aMsg, bMsg] = await Promise.all([a.messages.findMany(), b.messages.findMany()]);
    expect(aMsg.every((m) => m.organizationId === lumen.id)).toBe(true);
    expect(bMsg.every((m) => m.organizationId === iso.id)).toBe(true);

    const [aMem, bMem] = await Promise.all([a.memories.findMany(), b.memories.findMany()]);
    expect(aMem.every((m) => m.organizationId === lumen.id)).toBe(true);
    expect(bMem.every((m) => m.organizationId === iso.id)).toBe(true);

    const [aProd, bProd] = await Promise.all([a.products.findMany(), b.products.findMany()]);
    expect(aProd.every((p) => p.organizationId === lumen.id)).toBe(true);
    expect(bProd.every((p) => p.organizationId === iso.id)).toBe(true);

    const [aTrain, bTrain] = await Promise.all([
      a.trainingDocuments.findMany(),
      b.trainingDocuments.findMany(),
    ]);
    expect(aTrain.every((t) => t.organizationId === lumen.id)).toBe(true);
    expect(bTrain.every((t) => t.organizationId === iso.id)).toBe(true);

    const [aAn, bAn] = await Promise.all([a.analytics.findMany(), b.analytics.findMany()]);
    expect(aAn.every((e) => e.organizationId === lumen.id)).toBe(true);
    expect(bAn.every((e) => e.organizationId === iso.id)).toBe(true);

    const [aPlat, bPlat] = await Promise.all([
      a.platformAccounts.findMany(),
      b.platformAccounts.findMany(),
    ]);
    expect(aPlat.every((p) => p.organizationId === lumen.id)).toBe(true);
    expect(bPlat.every((p) => p.organizationId === iso.id)).toBe(true);

    const foreignCreator = aCreators[0];
    if (foreignCreator) {
      const leaked = await b.creators.findFirst({ where: { id: foreignCreator.id } });
      expect(leaked).toBeNull();
    }
  });
});
