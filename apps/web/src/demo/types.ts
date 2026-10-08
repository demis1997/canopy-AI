import type {
  FunnelStage,
  Intent,
  MediaType,
  ProductSource,
  RecommendedAction,
  Tone,
} from "@canopy/shared";

export type DemoAttachment = {
  id: string;
  kind: "PHOTO_SET" | "SHORT_VIDEO" | "VOICE_NOTE" | "FREE_PREVIEW" | "PREMIUM_BUNDLE";
  label: string;
  paid: boolean;
  purchased: boolean;
  price?: number;
  preview?: boolean;
};

export type DemoMessage = {
  id: string;
  authorType: "SUBSCRIBER" | "CHATTER" | "SYSTEM";
  body: string;
  createdAt: string;
  read: boolean;
  aiAssisted?: boolean;
  chatterName?: string;
  attachments: DemoAttachment[];
};

export type DemoMemory = {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
};

export type DemoVaultItem = {
  id: string;
  creatorId: string;
  creatorName: string;
  mediaType: MediaType;
  title: string;
  description: string;
  tags: string[];
  placeholderKind: DemoAttachment["kind"];
  defaultPrice: number;
  minimumPrice: number;
  source: ProductSource;
  lastSyncedAt: string;
  available: boolean;
  productId?: string;
};

export type DemoProduct = {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  mediaType: MediaType;
  standardPrice: number;
  minimumPrice: number;
  bundlePrice?: number | null;
  tags: string[];
  available: boolean;
  source: ProductSource;
  timesSold: number;
  conversionRate: number;
  lastSyncedAt: string;
  externalId: string;
  mediaIds: string[];
  previewIds: string[];
  resaleAllowed?: boolean;
};

export type DemoConversation = {
  id: string;
  creatorId: string;
  subscriberId: string;
  funnelStage: FunnelStage;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  online: boolean;
  spend: number;
  tags: string[];
  escalated: boolean;
  highValue: boolean;
  followUp: boolean;
  mutedAi: boolean;
  assignedChatter: string;
  summary: string;
  intent?: Intent;
  recommendedAction?: RecommendedAction;
  messages: DemoMessage[];
};

export type DemoSubscriber = {
  id: string;
  displayName: string;
  username: string;
  initials: string;
  hue: number;
  online: boolean;
  spend: number;
  avgPurchase: number;
  subscribedAt: string;
  lastPurchase?: string;
  lastActive: string;
  preferredTone: Tone;
  interests: string[];
  boundaries: string[];
  objections: string[];
  followUpAt?: string;
  notes: string;
  memories: DemoMemory[];
  purchasedProductIds: string[];
  offeredProductIds: string[];
};

export type DemoCreator = {
  id: string;
  displayName: string;
  handle: string;
  style: string;
};

export type DemoSuggestion = {
  id: string;
  text: string;
  tone: Tone;
  recommendedAction: RecommendedAction;
  productId: string | null;
  price: number | null;
  internalReason: string;
};

export type DemoLineage = {
  subscriberMessage: string;
  intent: string;
  funnelStage: string;
  productQuery: string;
  eligibleProductIds: string[];
  retrievedExamples: string[];
  model: string;
  validation: string[];
  chatterApproval: string;
  finalMessage: string;
  originalSuggestion?: string;
  editedText?: string;
  chatterIdentity?: string;
  approvedAt?: string;
  product?: {
    id: string;
    externalId: string;
    source: ProductSource;
    creatorId: string;
    standardPrice: number;
    minimumPrice: number;
    recommendedPrice: number | null;
    checks: string[];
    mediaIds: string[];
    previewIds: string[];
    previouslyPurchased: boolean;
    whyEligible: string;
    whySelected: string;
  };
};
