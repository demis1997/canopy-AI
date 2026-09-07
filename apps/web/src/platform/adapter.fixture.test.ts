import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";
import { PlaywrightOnlyFansAdapter } from "./onlyfans-adapter";

describe("playwright fixture adapter", () => {
  it("drives the mock HTML inbox through the adapter interface", async ({ skip }) => {
    const browser = await chromium.launch().catch(() => null);
    if (!browser) {
      skip();
      return;
    }
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(import.meta.dirname, "fixture.html")).href);
    const adapter = new PlaywrightOnlyFansAdapter(page);
    expect(await adapter.detectConnectionState()).toBe("CONNECTED");
    const inbox = await adapter.listInboxConversations();
    expect(inbox).toHaveLength(1);
    await adapter.openConversation(inbox[0]!.externalConversationId);
    const before = await adapter.readVisibleMessages();
    expect(before.some((m) => m.direction === "INBOUND")).toBe(true);
    await adapter.typeMessage("fixture hello");
    await adapter.sendCurrentMessage();
    const verify = await adapter.verifySentMessage("fixture hello");
    expect(verify.verified).toBe(true);
    await adapter.openVaultPicker();
    await adapter.selectVaultItem({ platformMediaReference: "vault_photo_1" });
    await adapter.setPpvPrice(25);
    await browser.close();
  });
});
