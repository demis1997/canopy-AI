import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@canopy/database";
import { randomUUID } from "node:crypto";
import { OnlyFansApiClient } from "../platform/onlyfans-api-client";
import { syncPlatformCatalog } from "./platform-catalog";

const orgIds: string[] = [];
afterAll(async () => {
  for (const id of orgIds) await prisma.organization.delete({ where: { id } });
});
async function connected() {
  await prisma.$connect();
}
async function fixture() {
  const organization = await prisma.organization.create({
    data: { name: "Catalog regression", slug: `catalog-${randomUUID()}` },
  });
  orgIds.push(organization.id);
  const creator = await prisma.creator.create({
    data: { organizationId: organization.id, displayName: "Test creator", handle: "catalog-test" },
  });
  const account = await prisma.platformAccount.create({
    data: {
      organizationId: organization.id,
      creatorId: creator.id,
      displayName: "Test",
      driver: "ONLYFANS_API",
      providerAccountId: "acct_test",
      externalAccountId: "1",
      autonomyMode: "COPILOT",
    },
  });
  return { organizationId: organization.id, platformAccountId: account.id };
}
function client(options: { fail?: boolean; empty?: boolean } = {}) {
  const media = { id: 10, type: "video", isReady: true };
  return new OnlyFansApiClient(
    "acct_test",
    "fake-test-key",
    vi.fn(async (url) => {
      const path = new URL(String(url)).pathname;
      if (options.fail && path.endsWith("/posts")) return new Response("", { status: 503 });
      const data = path.endsWith("/me")
        ? { id: 1 }
        : options.empty
          ? { list: [], hasMore: false }
          : path.endsWith("/media/vault")
            ? { list: [media], hasMore: false }
            : path.endsWith("/posts")
              ? {
                  list: [
                    {
                      id: 20,
                      author: { id: 1 },
                      text: "Paid post",
                      price: 9,
                      media: [media],
                      previews: [],
                    },
                  ],
                  hasMore: false,
                }
              : { list: [], hasMore: false };
      return new Response(JSON.stringify({ data }), { status: 200 });
    }),
    async () => {},
  );
}

describe("persisted catalog sync", () => {
  it("imports twice without duplicates and preserves operator prices and names", async ({
    skip,
  }) => {
    try {
      await connected();
    } catch (error) {
      if (process.env.CI) throw error;
      skip();
      return;
    }
    const input = await fixture();
    const run = await prisma.catalogSyncRun.create({ data: input });
    await syncPlatformCatalog({ ...input, syncRunId: run.id }, client());
    const post = await prisma.product.findFirstOrThrow({
      where: { platformAccountId: input.platformAccountId, externalId: "post:20" },
    });
    expect(post.available).toBe(false);
    expect(post.sourcePriceCents).toBe(900);
    await prisma.product.update({
      where: { id: post.id },
      data: {
        name: "Operator title",
        standardPriceCents: 1200,
        minimumPriceCents: 1000,
        available: true,
        approvedForAutomation: true,
      },
    });
    const next = await prisma.catalogSyncRun.create({ data: input });
    await syncPlatformCatalog({ ...input, syncRunId: next.id }, client());
    expect(
      await prisma.product.count({ where: { platformAccountId: input.platformAccountId } }),
    ).toBe(2);
    expect(
      await prisma.mediaAsset.count({ where: { platformAccountId: input.platformAccountId } }),
    ).toBe(1);
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: post.id } });
    expect(saved).toMatchObject({
      name: "Operator title",
      standardPriceCents: 1200,
      minimumPriceCents: 1000,
      available: true,
      approvedForAutomation: true,
    });
  });
  it("does not retire unseen products on a failed scan; complete empty scans do retire them", async ({
    skip,
  }) => {
    try {
      await connected();
    } catch (error) {
      if (process.env.CI) throw error;
      skip();
      return;
    }
    const input = await fixture();
    const run = await prisma.catalogSyncRun.create({ data: input });
    await syncPlatformCatalog({ ...input, syncRunId: run.id }, client());
    const failed = await prisma.catalogSyncRun.create({ data: input });
    await expect(
      syncPlatformCatalog({ ...input, syncRunId: failed.id }, client({ fail: true })),
    ).rejects.toThrow();
    expect(
      await prisma.product.count({
        where: { platformAccountId: input.platformAccountId, sourceAvailable: true },
      }),
    ).toBe(2);
    expect(
      (await prisma.catalogSyncRun.findUniqueOrThrow({ where: { id: failed.id } })).status,
    ).toBe("FAILED");
    const empty = await prisma.catalogSyncRun.create({ data: input });
    await syncPlatformCatalog({ ...input, syncRunId: empty.id }, client({ empty: true }));
    expect(
      await prisma.product.count({
        where: { platformAccountId: input.platformAccountId, sourceAvailable: true },
      }),
    ).toBe(0);
  });
});
