export type ConnectionState =
  | "DISCONNECTED"
  | "LOGIN_REQUIRED"
  | "CONNECTED"
  | "SYNCING"
  | "CHALLENGE_REQUIRED"
  | "DEGRADED"
  | "PAUSED";

export type InboxConversation = {
  externalConversationId: string;
  externalFanId: string;
  externalFanDisplayName: string;
  lastMessagePreview?: string;
  unread: boolean;
};

export type VisibleMessage = {
  externalMessageId: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  sentAt: string;
  messageType: "TEXT" | "PPV" | "TIP" | "MEDIA" | "SYSTEM";
};

export type FanMetadata = {
  externalFanId: string;
  displayName: string;
};

export type SendVerification = {
  verified: boolean;
  ambiguous: boolean;
  externalMessageId?: string;
  visibleText?: string;
  sentAt?: string;
};

export type SendRequest = {
  text: string;
  idempotencyKey: string;
  price?: number;
  mediaIds?: string[];
  previewIds?: string[];
};

export type VaultReference = {
  platformMediaReference: string;
};

export class AdapterClosedError extends Error {
  readonly code: string;
  constructor(
    code:
      | "SELECTOR_FAILURE"
      | "CHALLENGE_REQUIRED"
      | "LOGIN_REQUIRED"
      | "AMBIGUOUS_ELEMENT"
      | "UNVERIFIED_SELECTOR",
    message: string,
  ) {
    super(message);
    this.name = "AdapterClosedError";
    this.code = code;
  }
}

export interface OnlyFansAdapter {
  sendMessage?(request: SendRequest): Promise<SendVerification>;
  detectAccount(): Promise<{ externalAccountId: string | null; displayName: string | null }>;
  detectConnectionState(): Promise<ConnectionState>;
  listInboxConversations(): Promise<InboxConversation[]>;
  openConversation(externalConversationId: string): Promise<void>;
  readVisibleMessages(): Promise<VisibleMessage[]>;
  detectNewMessages(sinceExternalId?: string | null): Promise<VisibleMessage[]>;
  readFanMetadata(): Promise<FanMetadata>;
  typeMessage(text: string): Promise<void>;
  sendCurrentMessage(): Promise<void>;
  openVaultPicker(): Promise<void>;
  selectVaultItem(reference: VaultReference): Promise<void>;
  setPpvPrice(price: number): Promise<void>;
  verifySentMessage(expectedText: string): Promise<SendVerification>;
  detectPurchaseEvents(): Promise<{ productRef: string; amount: number }[]>;
  captureDiagnosticScreenshot(): Promise<string | null>;
}

export type HostedBrowserFactory = (accountId: string) => Promise<OnlyFansAdapter>;
