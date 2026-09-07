import type {
  ExplicitnessLevel,
  FunnelStage,
  Intent,
  Tone,
} from "@canopy/shared";
import type { GenerationOutput } from "@canopy/shared";
import type { PricingContext } from "../pricing/concession.js";

export type AvailableModel = {
  id: string;
  name: string;
  ownedBy?: string;
  contextWindow?: number;
  uncensored?: boolean;
  recommended?: boolean;
  parameterHint?: string | null;
};

export type ProviderHealth = {
  ok: boolean;
  latencyMs: number;
  error?: string;
  requestId: string;
};

export type ClassificationInput = {
  message: string;
  recentContext: string;
  funnelStage: FunnelStage;
  requestId: string;
};

export type IntentResult = {
  intent: Intent;
  confidence: number;
  latencyMs: number;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
};

export type ProductCatalogItem = {
  id: string;
  name: string;
  description: string;
  standardPrice: number;
  minimumPrice: number;
  available: boolean;
  explicitnessCategory: ExplicitnessLevel;
};

export type PersonaSnapshot = {
  displayName: string;
  biography: string;
  authorisedBackstory: string;
  personality: string;
  tone: string;
  typicalMessageLength: string;
  preferredEmojis: string[];
  frequentlyUsedPhrases: string[];
  preferredExplicitVocabulary: string[];
  prohibitedWords: string[];
  preferredCompliments: string[];
  allowedExplicitness: ExplicitnessLevel;
  style: string;
  interests: string[];
  contentBoundaries: string[];
  claimsNeverToMake: string[];
  customContentRules: string;
  offlineMeetingPolicy: string;
  discountLimitPercent: number;
  approvedExampleMessages: string[];
};

export type MemorySnapshot = {
  category: string;
  key: string;
  value: string;
  confidence: number;
  verified: boolean;
};

export type GenerationInput = {
  requestId: string;
  persona: PersonaSnapshot;
  recentMessages: { authorType: string; body: string }[];
  summary?: string;
  memories: MemorySnapshot[];
  products: ProductCatalogItem[];
  funnelStage: FunnelStage;
  playbook: string;
  retrievedExamples: string[];
  toneOverride?: Tone;
  promptVersionId: string;
  model: string;
  pricing?: PricingContext;
};

export type GenerationResult = {
  output: GenerationOutput;
  rawText: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  requestId: string;
  repaired: boolean;
};

export type SummaryInput = {
  requestId: string;
  messages: { authorType: string; body: string }[];
  previousSummary?: string;
};

export type ConversationSummaryResult = {
  summary: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
};

export type MemoryExtractionInput = {
  requestId: string;
  messages: { id: string; authorType: string; body: string }[];
};

export type MemoryExtractionResult = {
  updates: GenerationOutput["memoryUpdates"];
  latencyMs: number;
};

export interface LLMProvider {
  listModels(): Promise<AvailableModel[]>;
  healthCheck(): Promise<ProviderHealth>;
  classifyIntent(input: ClassificationInput): Promise<IntentResult>;
  generateReplies(input: GenerationInput): Promise<GenerationResult>;
  summarizeConversation(input: SummaryInput): Promise<ConversationSummaryResult>;
  extractMemories(input: MemoryExtractionInput): Promise<MemoryExtractionResult>;
}
