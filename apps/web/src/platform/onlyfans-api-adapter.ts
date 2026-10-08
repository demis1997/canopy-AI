import { OnlyFansApiClient, messageSchema, chatSchema, messageDirection, plainText } from "./onlyfans-api-client";
import type { OnlyFansAdapter, VisibleMessage, SendRequest, SendVerification } from "./types";
import { AdapterClosedError } from "./types";

export class ApiOnlyFansAdapter implements OnlyFansAdapter {
  private chatId: string | null = null;
  private readonly fans = new Map<string, { id: string; name: string }>();
  constructor(readonly client: OnlyFansApiClient, private readonly creatorId: string) {}
  async detectAccount() {
    const me = await this.client.me();
    if (me.id !== this.creatorId || me.isAuth === false) throw new Error("ACCOUNT_MISMATCH");
    return { externalAccountId: me.id, displayName: me.name ?? me.username ?? me.id };
  }
  async detectConnectionState() { await this.detectAccount(); return "CONNECTED" as const; }
  async listInboxConversations() {
    const rows = [];
    for await (const page of this.client.pages("chats?limit=100")) for (const raw of page) {
      const chat = chatSchema.parse(raw); const fan = chat.withUser ?? chat.fan;
      if (!fan) throw new Error("CHAT_IDENTITY_MISSING");
      this.fans.set(chat.id ?? fan.id, { id: fan.id, name: fan.name ?? fan.username ?? fan.id });
      rows.push({ externalConversationId: chat.id ?? fan.id, externalFanId: fan.id,
        externalFanDisplayName: fan.name ?? fan.username ?? fan.id, unread: true });
    }
    return rows;
  }
  async openConversation(id: string) { if (!/^\d+$/.test(id)) throw new Error("Invalid chat ID"); this.chatId = id; }
  async readVisibleMessages(): Promise<VisibleMessage[]> { return this.readMessages(); }
  private async readMessages(sinceExternalId?: string | null): Promise<VisibleMessage[]> {
    if (!this.chatId) throw new Error("Chat not selected");
    const result: VisibleMessage[] = [];
    // Full paginated history is imported before decisions; no reply to old unanswered snapshots.
    let done = false;
    for await (const page of this.client.pages(`chats/${this.chatId}/messages?limit=100&order=desc`)) {
      for (const raw of page) {
      const m = messageSchema.parse(raw);
      if (m.id === sinceExternalId) { done = true; break; }
      result.push({ externalMessageId: m.id, body: plainText(m.text), sentAt: m.createdAt,
        direction: messageDirection(m, this.creatorId, this.fans.get(this.chatId)?.id ?? this.chatId),
        messageType: m.isTip ? "TIP" : m.price > 0 ? "PPV" : m.media.length ? "MEDIA" : "TEXT" });
      }
      if (done) break;
    }
    return result.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || a.externalMessageId.localeCompare(b.externalMessageId, undefined, { numeric: true }));
  }
  async detectNewMessages(sinceExternalId?: string | null) { return this.readMessages(sinceExternalId); }
  async readFanMetadata() { if (!this.chatId) throw new Error("Chat not selected"); const fan = this.fans.get(this.chatId); return { externalFanId: fan?.id ?? this.chatId, displayName: fan?.name ?? this.chatId }; }
  async sendMessage(request: SendRequest): Promise<SendVerification> {
    if (!this.chatId) throw new Error("Chat not selected");
    const sent = messageSchema.parse((await this.client.request(this.client.path(`chats/${this.chatId}/messages`), {
      text: request.text, ...(request.price != null ? { price: request.price, mediaFiles: request.mediaIds ?? [], previews: request.previewIds ?? [] } : {}),
      blockBannedWords: "strict_ban",
    }, request.idempotencyKey)).data);
    const allIds = sent.media.map((m) => m.id);
    const previews = sent.previews.map((p) => typeof p === "string" ? p : p.id);
    const paidIds = allIds.filter((id) => !previews.includes(id));
    const ppvMatches = request.price == null || (Math.round(sent.price * 100) === Math.round(request.price * 100) &&
      (request.mediaIds ?? []).every((id) => paidIds.includes(id)) && paidIds.length === request.mediaIds?.length &&
      (request.previewIds ?? []).every((id) => previews.includes(id)) && previews.length === (request.previewIds ?? []).length);
    const verified = sent.fromUser.id === this.creatorId && plainText(sent.text) === request.text && ppvMatches;
    return { verified, ambiguous: !verified, externalMessageId: sent.id, visibleText: plainText(sent.text), sentAt: sent.createdAt };
  }
  private closed(): never { throw new AdapterClosedError("SELECTOR_FAILURE", "Use atomic API sendMessage"); }
  async typeMessage(): Promise<void> { this.closed(); }
  async sendCurrentMessage(): Promise<void> { this.closed(); }
  async openVaultPicker(): Promise<void> { this.closed(); }
  async selectVaultItem(): Promise<void> { this.closed(); }
  async setPpvPrice(): Promise<void> { this.closed(); }
  async verifySentMessage(): Promise<SendVerification> { this.closed(); }
  async detectPurchaseEvents() { return []; }
  async captureDiagnosticScreenshot() { return null; }
}
