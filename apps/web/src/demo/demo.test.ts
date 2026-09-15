import { describe, expect, it } from "vitest";
import { demoConversations, demoProducts, demoSubscribers, demoVault } from "./seed";

describe("demo seed", () => {
  it("has at least twelve subscribers, products and conversations", () => {
    expect(demoSubscribers.length).toBeGreaterThanOrEqual(12);
    expect(demoProducts.length).toBeGreaterThanOrEqual(12);
    expect(demoConversations.length).toBeGreaterThanOrEqual(12);
    expect(demoVault.length).toBeGreaterThanOrEqual(12);
  });

  it("keeps Alex on Maya with a girlcock request and a prior purchase", () => {
    const alex = demoSubscribers.find((s) => s.id === "sub_alex");
    const conv = demoConversations.find((c) => c.id === "conv_alex");
    expect(alex?.purchasedProductIds).toContain("prod_engagement");
    expect(conv?.lastMessage).toMatch(/girlcock/i);
    expect(demoProducts.every((p) => p.source !== "PLATFORM_VAULT_SYNC" || p.available)).toBe(true);
  });
});
