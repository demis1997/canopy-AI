import { describe, expect, it } from "vitest";
import { detectAdapter, type PlatformAdapter } from "../src/adapters/types";
import { demoAdapter } from "../src/adapters/demo";

describe("extension adapters", () => {
  it("selects the demo adapter on the local messenger", () => {
    const found = detectAdapter("http://localhost:3000/demo", [demoAdapter]);
    expect(found?.id).toBe("demo");
  });

  it("does not match unknown platforms without configuration", () => {
    const blank: PlatformAdapter = {
      id: "onlyfans",
      matches: (url) => /onlyfans/.test(url),
      getVisibleThread: () => null,
      insertReply: () => ({ ok: false, reason: "selectors-unconfigured" }),
      diagnostics: () => ({ configured: false }),
    };
    expect(blank.insertReply("hi").ok).toBe(false);
  });
});
