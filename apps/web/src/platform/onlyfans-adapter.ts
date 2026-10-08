import type { Page } from "@playwright/test";
import type { ConnectionState, OnlyFansAdapter, VaultReference } from "./types";
import { AdapterClosedError } from "./types";

/**
 * Browser adapter.
 *
 * Mock fixture selectors use `data-canopy-*` and are covered by tests.
 * Live OnlyFans selectors below are UNVERIFIED placeholders. They fail closed
 * unless CANOPY_OF_LIVE_SELECTORS=1 is set after a human validates them on an
 * authorized account. Do not treat these as a working official integration.
 */
const LIVE = {
  loginUrl: /onlyfans\.com\/(login|signin)/i,
  challenge: '[role="dialog"], :text("Verify"), :text("CAPTCHA"), :text("2FA")',
  inbox: '[data-canopy-role="inbox"]',
  conversation: '[data-canopy-role="conversation"]',
  thread: '[data-canopy-role="thread"]',
  message: '[data-canopy-role="message"]',
  composer: '[data-canopy-role="composer-input"]',
  send: '[data-canopy-role="send"]',
  vaultOpen: '[data-canopy-role="vault-open"]',
  vaultItem: '[data-canopy-role="vault-item"]',
  ppvPrice: '[data-canopy-role="ppv-price"]',
  account: "[data-canopy-account-id]",
} as const;

export class PlaywrightOnlyFansAdapter implements OnlyFansAdapter {
  constructor(
    private readonly page: Page,
    private readonly opts: { liveUnverified?: boolean } = {},
  ) {}

  private liveBlocked(method: string): never {
    throw new AdapterClosedError(
      "UNVERIFIED_SELECTOR",
      `${method} is not validated against live OnlyFans. Complete login on an authorized account and update selectors after a human review.`,
    );
  }

  private async failIfAmbiguous(locator: ReturnType<Page["locator"]>, label: string) {
    const count = await locator.count();
    if (count === 0) throw new AdapterClosedError("SELECTOR_FAILURE", `${label} not found`);
    if (count > 1) throw new AdapterClosedError("AMBIGUOUS_ELEMENT", `${label} matched ${count} nodes`);
  }

  async detectAccount() {
    const state = await this.detectConnectionState();
    if (state === "LOGIN_REQUIRED" || state === "CHALLENGE_REQUIRED") {
      return { externalAccountId: null, displayName: null };
    }
    const node = this.page.locator(LIVE.account);
    if ((await node.count()) !== 1) {
      if (this.opts.liveUnverified) this.liveBlocked("detectAccount");
      throw new AdapterClosedError("SELECTOR_FAILURE", "Account identity node missing");
    }
    return {
      externalAccountId: await node.getAttribute("data-canopy-account-id"),
      displayName: await node.getAttribute("data-canopy-account-name"),
    };
  }

  async detectConnectionState(): Promise<ConnectionState> {
    const url = this.page.url();
    if (LIVE.loginUrl.test(url)) return "LOGIN_REQUIRED";
    if (await this.page.locator('[data-canopy-role="challenge"]:visible').count()) {
      return "CHALLENGE_REQUIRED";
    }
    if (await this.page.locator(LIVE.challenge).count()) {
      const visible = await this.page.locator(LIVE.challenge).first().isVisible().catch(() => false);
      if (visible && this.opts.liveUnverified) return "CHALLENGE_REQUIRED";
    }
    const state = await this.page.locator("body").getAttribute("data-state");
    if (state === "LOGIN_REQUIRED" || state === "CHALLENGE_REQUIRED" || state === "DISCONNECTED") {
      return state;
    }
    if (await this.page.locator(LIVE.inbox).count()) return "CONNECTED";
    if (this.opts.liveUnverified) this.liveBlocked("detectConnectionState");
    return "DEGRADED";
  }

  async listInboxConversations() {
    await this.requireConnected();
    const items = this.page.locator(LIVE.conversation);
    const count = await items.count();
    if (!count) throw new AdapterClosedError("SELECTOR_FAILURE", "Inbox conversations missing");
    const rows = [];
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const id = await item.getAttribute("data-conversation-id");
      const fanId = await item.getAttribute("data-fan-id");
      const name = await item.getAttribute("data-fan-name");
      if (!id || !fanId || !name) {
        throw new AdapterClosedError("AMBIGUOUS_ELEMENT", "Conversation row missing stable attributes");
      }
      rows.push({
        externalConversationId: id,
        externalFanId: fanId,
        externalFanDisplayName: name,
        unread: true,
      });
    }
    return rows;
  }

  async openConversation(externalConversationId: string) {
    await this.requireConnected();
    const button = this.page.locator(
      `${LIVE.conversation}[data-conversation-id="${externalConversationId}"]`,
    );
    await this.failIfAmbiguous(button, "conversation");
    await button.click();
  }

  async readVisibleMessages() {
    await this.requireConnected();
    const nodes = this.page.locator(LIVE.message);
    const count = await nodes.count();
    const messages = [];
    for (let i = 0; i < count; i++) {
      const node = nodes.nth(i);
      const id = await node.getAttribute("data-message-id");
      const direction = await node.getAttribute("data-direction");
      if (!id || (direction !== "INBOUND" && direction !== "OUTBOUND")) {
        throw new AdapterClosedError("AMBIGUOUS_ELEMENT", "Message missing stable identity");
      }
      const typedDirection: "INBOUND" | "OUTBOUND" = direction;
      messages.push({
        externalMessageId: id,
        direction: typedDirection,
        body: ((await node.textContent()) ?? "").trim(),
        sentAt: new Date().toISOString(),
        messageType: "TEXT" as const,
      });
    }
    return messages;
  }

  async detectNewMessages(sinceExternalId?: string | null) {
    const visible = await this.readVisibleMessages();
    if (!sinceExternalId) return visible;
    const index = visible.findIndex((m) => m.externalMessageId === sinceExternalId);
    return index === -1 ? visible : visible.slice(index + 1);
  }

  async readFanMetadata() {
    const header = this.page.locator("[data-canopy-role='fan-header']");
    await this.failIfAmbiguous(header, "fan header");
    const id = await header.getAttribute("data-fan-id");
    const name = ((await header.textContent()) ?? "").trim();
    if (!id || !name) throw new AdapterClosedError("AMBIGUOUS_ELEMENT", "Fan metadata incomplete");
    return { externalFanId: id, displayName: name };
  }

  async typeMessage(text: string) {
    await this.requireConnected();
    const input = this.page.locator(LIVE.composer);
    await this.failIfAmbiguous(input, "composer");
    await input.fill(text);
  }

  async sendCurrentMessage() {
    await this.requireConnected();
    const send = this.page.getByRole("button", { name: "Send" });
    await this.failIfAmbiguous(send, "send");
    await send.click();
  }

  async openVaultPicker() {
    await this.requireConnected();
    const open = this.page.locator(LIVE.vaultOpen);
    await this.failIfAmbiguous(open, "vault open");
    await open.click();
  }

  async selectVaultItem(reference: VaultReference) {
    const item = this.page.locator(
      `${LIVE.vaultItem}[data-media-ref="${reference.platformMediaReference}"]`,
    );
    await this.failIfAmbiguous(item, "vault item");
    await item.click();
  }

  async setPpvPrice(price: number) {
    const field = this.page.getByLabel("PPV price");
    await this.failIfAmbiguous(field, "PPV price");
    await field.fill(String(price));
  }

  async verifySentMessage(expectedText: string) {
    const messages = await this.readVisibleMessages();
    const last = [...messages].reverse().find((m) => m.direction === "OUTBOUND");
    if (!last) return { verified: false, ambiguous: true };
    if (last.body.trim() !== expectedText.trim()) {
      return { verified: false, ambiguous: true, visibleText: last.body, externalMessageId: last.externalMessageId };
    }
    return { verified: true, ambiguous: false, visibleText: last.body, externalMessageId: last.externalMessageId };
  }

  async detectPurchaseEvents() {
    return [];
  }

  async captureDiagnosticScreenshot() {
    return null;
  }

  private async requireConnected() {
    const state = await this.detectConnectionState();
    if (state === "LOGIN_REQUIRED") {
      throw new AdapterClosedError("LOGIN_REQUIRED", "Creator must finish login and 2FA manually");
    }
    if (state === "CHALLENGE_REQUIRED") {
      throw new AdapterClosedError("CHALLENGE_REQUIRED", "Pause automation until the creator completes the challenge");
    }
    if (state === "CONNECTED" || state === "SYNCING") return;
    throw new AdapterClosedError("SELECTOR_FAILURE", `Not connected (${state})`);
  }
}

/** TODO(live-of): validate inbox list against an authorized OnlyFans account. */
/** TODO(live-of): validate conversation open + message identity attributes. */
/** TODO(live-of): validate composer role/label and Send button. */
/** TODO(live-of): validate vault picker and PPV price field. */
/** TODO(live-of): validate purchase/tip receipts without downloading media. */
