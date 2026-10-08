import { afterEach, expect, it, vi } from "vitest";
import { InMemoryRateLimiter } from "./rate-limit";
afterEach(() => vi.useRealTimers());
it("enforces independent quotas and resets at the exact window boundary", () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const limiter = new InMemoryRateLimiter(100, 10);
  expect(limiter.allow("a", 1)).toBe(true);
  expect(limiter.allow("a", 1)).toBe(false);
  expect(limiter.allow("b", 1)).toBe(true);
  vi.setSystemTime(100);
  expect(limiter.allow("a", 1)).toBe(true);
});
it("bounds distinct-key storage and reclaims expired capacity", () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const limiter = new InMemoryRateLimiter(100, 2);
  expect(limiter.allow("a")).toBe(true);
  expect(limiter.allow("b")).toBe(true);
  expect(limiter.allow("c")).toBe(false);
  vi.setSystemTime(100);
  expect(limiter.allow("c")).toBe(true);
});
