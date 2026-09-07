import { describe, expect, it } from "vitest";
import { hasPermission } from "@canopy/shared";
import { rateLimit } from "../server/security";

describe("web rbac", () => {
  it("chatters cannot manage agencies", () => {
    expect(hasPermission("CHATTER", "org.manage")).toBe(false);
    expect(hasPermission("CHATTER", "conversations.generate")).toBe(true);
  });
});

describe("rate limiter", () => {
  it("allows a burst then blocks", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5)).toBe(true);
    expect(rateLimit(key, 5)).toBe(false);
  });
});
