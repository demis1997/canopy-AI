import type {
  ConnectionState,
  FanMetadata,
  InboxConversation,
  OnlyFansAdapter,
  SendVerification,
  VaultReference,
  VisibleMessage,
} from "./types";
import { AdapterClosedError } from "./types";

export type MockInboxState = {
  connectionState: ConnectionState;
  accountId: string;
  displayName: string;
  conversations: InboxConversation[];
  messages: Record<string, VisibleMessage[]>;
  openConversationId: string | null;
  vaultOpen: boolean;
  selectedVault: string | null;
  ppvPrice: number | null;
  composer: string;
  purchases: { productRef: string; amount: number }[];
};

export function createMockInboxState(): MockInboxState {
  return {
    connectionState: "CONNECTED",
    accountId: "of_maya_demo",
    displayName: "Maya Voss",
    conversations: [
      {
        externalConversationId: "of_thread_1001",
        externalFanId: "fan_1001",
        externalFanDisplayName: "Jordan Hale",
        lastMessagePreview: "hey, you around?",
        unread: true,
      },
    ],
    messages: {
      of_thread_1001: [
        {
          externalMessageId: "of_msg_1",
          direction: "INBOUND",
          body: "hey, you around?",
          sentAt: new Date().toISOString(),
          messageType: "TEXT",
        },
      ],
    },
    openConversationId: "of_thread_1001",
    vaultOpen: false,
    selectedVault: null,
    ppvPrice: null,
    composer: "",
    purchases: [],
  };
}

export class MockOnlyFansAdapter implements OnlyFansAdapter {
  constructor(private readonly state: MockInboxState) {}

  async detectAccount() {
    return { externalAccountId: this.state.accountId, displayName: this.state.displayName };
  }

  async detectConnectionState() {
    return this.state.connectionState;
  }

  async listInboxConversations() {
    this.assertConnected();
    return this.state.conversations;
  }

  async openConversation(externalConversationId: string) {
    this.assertConnected();
    const found = this.state.conversations.find((c) => c.externalConversationId === externalConversationId);
    if (!found) throw new AdapterClosedError("SELECTOR_FAILURE", "Conversation not found in mock inbox");
    this.state.openConversationId = externalConversationId;
  }

  async readVisibleMessages() {
    this.assertConnected();
    if (!this.state.openConversationId) {
      throw new AdapterClosedError("AMBIGUOUS_ELEMENT", "No conversation is open");
    }
    return this.state.messages[this.state.openConversationId] ?? [];
  }

  async detectNewMessages(sinceExternalId?: string | null) {
    const visible = await this.readVisibleMessages();
    if (!sinceExternalId) return visible;
    const index = visible.findIndex((m) => m.externalMessageId === sinceExternalId);
    return index === -1 ? visible : visible.slice(index + 1);
  }

  async readFanMetadata(): Promise<FanMetadata> {
    const open = this.state.conversations.find((c) => c.externalConversationId === this.state.openConversationId);
    if (!open) throw new AdapterClosedError("AMBIGUOUS_ELEMENT", "Fan header missing");
    return { externalFanId: open.externalFanId, displayName: open.externalFanDisplayName };
  }

  async typeMessage(text: string) {
    this.assertConnected();
    this.state.composer = text;
  }

  async sendCurrentMessage() {
    this.assertConnected();
    if (!this.state.composer.trim() || !this.state.openConversationId) {
      throw new AdapterClosedError("AMBIGUOUS_ELEMENT", "Composer empty or no thread");
    }
    const message: VisibleMessage = {
      externalMessageId: `of_out_${Date.now()}`,
      direction: "OUTBOUND",
      body: this.state.composer,
      sentAt: new Date().toISOString(),
      messageType: "TEXT",
    };
    this.state.messages[this.state.openConversationId] = [
      ...(this.state.messages[this.state.openConversationId] ?? []),
      message,
    ];
    this.state.composer = "";
  }

  async openVaultPicker() {
    this.assertConnected();
    this.state.vaultOpen = true;
  }

  async selectVaultItem(reference: VaultReference) {
    if (!this.state.vaultOpen) throw new AdapterClosedError("SELECTOR_FAILURE", "Vault picker is closed");
    this.state.selectedVault = reference.platformMediaReference;
  }

  async setPpvPrice(price: number) {
    if (!this.state.vaultOpen) throw new AdapterClosedError("SELECTOR_FAILURE", "Vault picker is closed");
    this.state.ppvPrice = price;
  }

  async verifySentMessage(expectedText: string): Promise<SendVerification> {
    const visible = await this.readVisibleMessages();
    const last = [...visible].reverse().find((m) => m.direction === "OUTBOUND");
    if (!last) return { verified: false, ambiguous: true };
    if (last.body.trim() !== expectedText.trim()) {
      return { verified: false, ambiguous: true, visibleText: last.body, externalMessageId: last.externalMessageId };
    }
    return { verified: true, ambiguous: false, visibleText: last.body, externalMessageId: last.externalMessageId };
  }

  async detectPurchaseEvents() {
    return this.state.purchases;
  }

  async captureDiagnosticScreenshot() {
    return null;
  }

  injectInbound(body: string, conversationId = "of_thread_1001") {
    const message: VisibleMessage = {
      externalMessageId: `of_in_${Date.now()}`,
      direction: "INBOUND",
      body,
      sentAt: new Date().toISOString(),
      messageType: "TEXT",
    };
    this.state.messages[conversationId] = [...(this.state.messages[conversationId] ?? []), message];
    return message;
  }

  private assertConnected() {
    if (this.state.connectionState === "LOGIN_REQUIRED") {
      throw new AdapterClosedError("LOGIN_REQUIRED", "Creator must complete login and 2FA in the browser");
    }
    if (this.state.connectionState === "CHALLENGE_REQUIRED") {
      throw new AdapterClosedError("CHALLENGE_REQUIRED", "Platform challenge requires manual completion");
    }
    if (this.state.connectionState !== "CONNECTED" && this.state.connectionState !== "SYNCING") {
      throw new AdapterClosedError("SELECTOR_FAILURE", `Worker state ${this.state.connectionState} is not operable`);
    }
  }
}
