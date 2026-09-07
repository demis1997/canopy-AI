import { z } from "zod";
import {
  EXPLICITNESS_LEVELS,
  FUNNEL_STAGES,
  INTENTS,
  RECOMMENDED_ACTIONS,
  TONES,
  MEMORY_CATEGORIES,
} from "./enums.js";

export const generationOutputSchema = z.object({
  intent: z.enum(INTENTS),
  funnelStage: z.enum(FUNNEL_STAGES),
  explicitnessLevel: z.enum(EXPLICITNESS_LEVELS),
  recommendedAction: z.enum(RECOMMENDED_ACTIONS),
  replyOptions: z
    .array(
      z.object({
        text: z.string().min(1).max(2000),
        tone: z.enum(TONES),
        internalReason: z.string().max(500),
      }),
    )
    .min(1)
    .max(3),
  recommendedProductId: z.string().nullable(),
  approvedPrice: z.number().nonnegative().nullable(),
  requiresHumanReview: z.boolean(),
  riskFlags: z.array(z.string()),
  memoryUpdates: z.array(
    z.object({
      category: z.enum(MEMORY_CATEGORIES).or(z.string()),
      key: z.string(),
      value: z.string(),
      confidence: z.number().min(0).max(1),
      sourceMessageId: z.string(),
    }),
  ),
  suggestedFunnelTransition: z.enum(FUNNEL_STAGES).nullable(),
});

export type GenerationOutput = z.infer<typeof generationOutputSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const personaInputSchema = z.object({
  displayName: z.string().min(1).max(80),
  biography: z.string().max(4000).default(""),
  authorisedBackstory: z.string().max(4000).default(""),
  personality: z.string().max(2000).default(""),
  tone: z.string().max(500).default(""),
  typicalMessageLength: z.enum(["SHORT", "MEDIUM", "LONG"]).default("SHORT"),
  preferredEmojis: z.array(z.string()).default([]),
  frequentlyUsedPhrases: z.array(z.string()).default([]),
  preferredExplicitVocabulary: z.array(z.string()).default([]),
  prohibitedWords: z.array(z.string()).default([]),
  preferredCompliments: z.array(z.string()).default([]),
  allowedExplicitness: z.enum(EXPLICITNESS_LEVELS).default("SUGGESTIVE"),
  style: z
    .enum(["DOMINANT", "SUBMISSIVE", "ROMANTIC", "PLAYFUL", "DIRECT"])
    .default("PLAYFUL"),
  interests: z.array(z.string()).default([]),
  contentBoundaries: z.array(z.string()).default([]),
  claimsNeverToMake: z.array(z.string()).default([]),
  customContentRules: z.string().max(4000).default(""),
  offlineMeetingPolicy: z.string().max(1000).default("Never arrange offline meetings."),
  discountLimitPercent: z.number().min(0).max(100).default(10),
  escalationRules: z.string().max(2000).default(""),
  approvedExampleMessages: z.array(z.string()).default([]),
});

export type PersonaInput = z.infer<typeof personaInputSchema>;

export const productInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(4000).default(""),
  mediaType: z.enum(["PHOTO", "VIDEO", "AUDIO", "TEXT", "BUNDLE", "CUSTOM"]),
  creatorId: z.string(),
  standardPrice: z.number().positive(),
  minimumPrice: z.number().positive(),
  bundlePrice: z.number().positive().nullable().optional(),
  tags: z.array(z.string()).default([]),
  explicitnessCategory: z.enum(EXPLICITNESS_LEVELS).default("EXPLICIT"),
  available: z.boolean().default(true),
  customContent: z.boolean().default(false),
  deliveryRules: z.string().max(2000).default(""),
  source: z.enum(["DEMO_SEED", "MANUAL", "CSV_IMPORT", "MEDIA_UPLOAD", "PLATFORM_VAULT_SYNC"]).default("MANUAL"),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const subscriberMessageSchema = z.object({
  conversationId: z.string(),
  text: z.string().min(1).max(8000),
});

export const selectReplySchema = z.object({
  conversationId: z.string(),
  generationId: z.string(),
  replyOptionId: z.string(),
  editedText: z.string().min(1).max(2000),
  inserted: z.boolean().default(false),
});

export const generateRequestSchema = z.object({
  conversationId: z.string(),
  toneOverride: z.enum(TONES).optional(),
  regenerate: z.boolean().optional(),
});

export const memoryUpdateSchema = z.object({
  id: z.string(),
  value: z.string().max(2000).optional(),
  verified: z.boolean().optional(),
  deleted: z.boolean().optional(),
});
