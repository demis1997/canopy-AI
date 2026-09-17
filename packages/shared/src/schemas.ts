import { z } from "zod";
import {
  EXPLICITNESS_LEVELS,
  FUNNEL_STAGES,
  INTENTS,
  RECOMMENDED_ACTIONS,
  TONES,
  MEMORY_CATEGORIES,
} from "./enums.js";
import { normalizeReplyBubbles } from "./replies.js";

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const v = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function coercePrice(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceBool(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return fallback;
}

const replyOptionSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const o = raw as Record<string, unknown>;
    const next = normalizeReplyBubbles(o);
    return {
      ...o,
      text: next.text,
      messages: next.messages,
      tone: pickEnum(o.tone, TONES, "PLAYFUL"),
      internalReason: typeof o.internalReason === "string" ? o.internalReason : "",
    };
  },
  z.object({
    text: z.string().min(1).max(2000),
    messages: z.array(z.string().min(1).max(280)).min(1).max(3),
    tone: z.enum(TONES),
    internalReason: z.string().max(500),
  }),
);

export const generationOutputSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const options = Array.isArray(o.replyOptions) ? o.replyOptions.slice(0, 3) : o.replyOptions;
  const suggested = o.suggestedFunnelTransition;
  const suggestedOk =
    typeof suggested === "string" &&
    (FUNNEL_STAGES as readonly string[]).includes(suggested.trim().toUpperCase().replace(/[\s-]+/g, "_"));
  return {
    ...o,
    intent: pickEnum(o.intent, INTENTS, "UNCERTAIN"),
    funnelStage: pickEnum(o.funnelStage, FUNNEL_STAGES, "RAPPORT"),
    explicitnessLevel: pickEnum(o.explicitnessLevel, EXPLICITNESS_LEVELS, "SUGGESTIVE"),
    recommendedAction: pickEnum(o.recommendedAction, RECOMMENDED_ACTIONS, "REPLY"),
    replyOptions: options,
    recommendedProductId: o.recommendedProductId ?? null,
    approvedPrice: coercePrice(o.approvedPrice),
    requiresHumanReview: coerceBool(o.requiresHumanReview, true),
    riskFlags: Array.isArray(o.riskFlags) ? o.riskFlags.map(String) : [],
    memoryUpdates: Array.isArray(o.memoryUpdates) ? o.memoryUpdates : [],
    suggestedFunnelTransition: suggestedOk ? pickEnum(suggested, FUNNEL_STAGES, "RAPPORT") : null,
  };
}, z.object({
  intent: z.enum(INTENTS),
  funnelStage: z.enum(FUNNEL_STAGES),
  explicitnessLevel: z.enum(EXPLICITNESS_LEVELS),
  recommendedAction: z.enum(RECOMMENDED_ACTIONS),
  replyOptions: z.array(replyOptionSchema).min(1).max(3),
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
}));

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
  favouriteColor: z.string().max(80).default(""),
  favouriteFlowers: z.string().max(80).default(""),
});

export type PersonaInput = z.infer<typeof personaInputSchema>;

export const productInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(4000).default(""),
  mediaType: z.enum(["PHOTO", "VIDEO", "AUDIO", "TEXT", "BUNDLE", "CUSTOM"]),
  creatorId: z.string(),
  standardPrice: z.number().positive(),
  minimumPrice: z.number().positive(),
  secondPrice: z.number().positive().nullable().optional(),
  discountLimitPercent: z.number().min(0).max(100).default(10),
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

export const REWRITE_STYLES = ["SHORTER", "WARMER", "PLAYFUL", "SALES"] as const;

export const selectReplySchema = z.object({
  conversationId: z.string(),
  generationId: z.string(),
  replyOptionId: z.string(),
  editedText: z.string().max(2000).optional(),
  inserted: z.boolean().default(false),
  discard: z.boolean().optional(),
  rejectReason: z.string().max(2000).optional(),
});

export const generateRequestSchema = z.object({
  conversationId: z.string(),
  toneOverride: z.enum(TONES).optional(),
  rewriteStyle: z.enum(REWRITE_STYLES).optional(),
  regenerate: z.boolean().optional(),
});

export const memoryUpdateSchema = z.object({
  id: z.string(),
  value: z.string().max(2000).optional(),
  verified: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export const sequenceStepInputSchema = z.object({
  body: z.string().min(1).max(2000),
  mediaHint: z.enum(["TEXT", "VOICE", "PHOTO", "PPV"]).default("TEXT"),
  delayMinutes: z.number().int().min(0).max(7 * 24 * 60).default(0),
  productId: z.string().nullable().optional(),
  priceTier: z.number().int().min(1).max(3).default(1),
});

export const sequenceInputSchema = z.object({
  creatorId: z.string(),
  name: z.string().min(1).max(120),
  kind: z.enum(["STARTER", "TEASER", "VOICE", "PHOTO", "SEXTING", "PPV", "FOLLOW_UP", "AFTERCARE"]),
  description: z.string().max(2000).default(""),
  active: z.boolean().default(true),
  steps: z.array(sequenceStepInputSchema).min(1).max(20),
});

export const fanNoteInputSchema = z.object({
  creatorId: z.string(),
  subscriberId: z.string(),
  realName: z.string().max(120).default(""),
  location: z.string().max(120).default(""),
  dominance: z.enum(["UNKNOWN", "SUBMISSIVE", "DOMINANT", "SWITCH"]).default("UNKNOWN"),
  preferredTone: z.string().max(80).default(""),
  notes: z.string().max(8000).default(""),
  extra: z.record(z.string()).default({}),
});

export const conversationPatchSchema = z.object({
  mutedAi: z.boolean().optional(),
  activeSequenceId: z.string().nullable().optional(),
  advanceSequence: z.boolean().optional(),
  insertSequenceStep: z.boolean().optional(),
  noReplyFollowUp: z.boolean().optional(),
  markPurchased: z.boolean().optional(),
  clearChat: z.boolean().optional(),
});
