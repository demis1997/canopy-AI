import { z } from "zod";
import { FUNNEL_STAGES } from "./enums.js";

export const AUTONOMY_MODES = ["COPILOT", "HYBRID", "AUTOPILOT", "PAUSED"] as const;
export type AutonomyMode = (typeof AUTONOMY_MODES)[number];

export const AUTOMATION_ACTIONS = ["SEND_TEXT", "SEND_PPV", "ESCALATE", "DO_NOT_REPLY"] as const;
export type AutomationActionKind = (typeof AUTOMATION_ACTIONS)[number];

export const automationDecisionSchema = z.object({
  action: z.enum(AUTOMATION_ACTIONS),
  messages: z.array(z.string().min(1).max(2000)).max(3),
  productId: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  confidence: z.number().min(0).max(1),
  funnelStage: z.enum(FUNNEL_STAGES).or(z.string()),
  reason: z.string().max(500),
  scheduledDelaySeconds: z.number().int().min(0).max(3600),
  safetyFlags: z.array(z.string()),
});

export type AutomationDecision = z.infer<typeof automationDecisionSchema>;

export type FeatureFlags = {
  browserIntegration: boolean;
  autonomousText: boolean;
  autonomousPpv: boolean;
  mockPlatform: boolean;
};

export const automationPolicyPatchSchema = z.object({
  minimumConfidence: z.number().min(0).max(1).optional(),
  maximumPpvPriceCents: z.number().int().min(0).max(1_000_000).optional(),
  minimumReplyDelaySeconds: z.number().int().min(0).max(3600).optional(),
  maximumReplyDelaySeconds: z.number().int().min(0).max(3600).optional(),
  maximumMessagesPerHourPerFan: z.number().int().min(0).max(200).optional(),
  welcomeEnabled: z.boolean().optional(),
  followUpsEnabled: z.boolean().optional(),
  ppvEnabled: z.boolean().optional(),
  humanTakeoverMinutes: z.number().int().min(1).max(24 * 60).optional(),
  allowedLanguages: z.array(z.string().min(2).max(8)).optional(),
  allowedProductIds: z.array(z.string()).optional(),
});

export function readFeatureFlags(env: NodeJS.Dict<string> = process.env): FeatureFlags {
  const truthy = (value: string | undefined, fallback = false) =>
    value == null ? fallback : /^(1|true|yes|on)$/i.test(value);
  return {
    browserIntegration: truthy(env.ONLYFANS_BROWSER_INTEGRATION, false),
    autonomousText: truthy(env.ONLYFANS_AUTONOMOUS_TEXT, true),
    autonomousPpv: truthy(env.ONLYFANS_AUTONOMOUS_PPV, false),
    mockPlatform: truthy(env.ONLYFANS_MOCK_PLATFORM, true),
  };
}

export type QuietHours = {
  startHour: number;
  endHour: number;
  timezone?: string;
};

export type AutomationPolicySnapshot = {
  minimumConfidence: number;
  maximumPpvPriceCents: number;
  minimumReplyDelaySeconds: number;
  maximumReplyDelaySeconds: number;
  maximumMessagesPerHourPerFan: number;
  welcomeEnabled: boolean;
  followUpsEnabled: boolean;
  ppvEnabled: boolean;
  quietHours: QuietHours | null;
  allowedProductIds: string[];
  humanTakeoverMinutes: number;
  allowedLanguages: string[];
};

export function defaultAutomationPolicy(): AutomationPolicySnapshot {
  return {
    minimumConfidence: 0.72,
    maximumPpvPriceCents: 5000,
    minimumReplyDelaySeconds: 8,
    maximumReplyDelaySeconds: 45,
    maximumMessagesPerHourPerFan: 8,
    welcomeEnabled: false,
    followUpsEnabled: false,
    ppvEnabled: false,
    quietHours: null,
    allowedProductIds: [],
    humanTakeoverMinutes: 30,
    allowedLanguages: ["en"],
  };
}

export function idempotencyKey(input: {
  platformAccountId: string;
  externalConversationId: string;
  triggerExternalMessageId: string;
  actionType: string;
}): string {
  return [
    input.platformAccountId,
    input.externalConversationId,
    input.triggerExternalMessageId,
    input.actionType,
  ].join(":");
}

export function inQuietHours(now: Date, hours: QuietHours | null): boolean {
  if (!hours) return false;
  const hour = now.getUTCHours();
  if (hours.startHour === hours.endHour) return false;
  if (hours.startHour < hours.endHour) {
    return hour >= hours.startHour && hour < hours.endHour;
  }
  return hour >= hours.startHour || hour < hours.endHour;
}

export function detectUnexpectedLanguage(text: string, allowed: string[]): boolean {
  if (!allowed.length) return false;
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 8) return false;
  const cyrillic = (letters.match(/\p{Script=Cyrillic}/gu) ?? []).length / letters.length;
  const latin = (letters.match(/\p{Script=Latin}/gu) ?? []).length / letters.length;
  if (allowed.includes("ru") && cyrillic > 0.5) return false;
  if (allowed.includes("en") && latin > 0.5) return false;
  if (cyrillic > 0.5 && !allowed.includes("ru")) return true;
  return false;
}

const MEETING =
  /\b(meet (up|me)|come over|my (hotel|place|house)|whats?app|telegram|kik|snapchat|real life)\b/i;
const CUSTOM =
  /\b(custom (video|pic|content)|make me a|shoot (a )?video of|write my name)\b/i;

export function extraAutomationFlags(text: string): string[] {
  const flags: string[] = [];
  if (MEETING.test(text)) flags.push("OFFLINE_MEETING");
  if (CUSTOM.test(text)) flags.push("CUSTOM_CONTENT");
  return flags;
}

export type DeliveryGateInput = {
  expectedAccountId: string;
  actualAccountId: string;
  expectedFanId: string;
  actualFanId: string;
  autonomyMode: AutonomyMode;
  flags: FeatureFlags;
  humanTakeover: boolean;
  lockedUntil: Date | null;
  newerMessageAfterTrigger: boolean;
  alreadySentForTrigger: boolean;
  messagesSentLastHour: number;
  policy: AutomationPolicySnapshot;
  decision: AutomationDecision;
  safetyAllowed: boolean;
  bannedWordHit: boolean;
  humanApproved?: boolean;
  product?: {
    id: string;
    approvedForAutomation: boolean;
    alreadyPurchased: boolean;
    platformMediaReference: string | null;
    minimumPriceCents: number;
    maximumPriceCents: number | null;
    standardPriceCents: number;
  } | null;
  now?: Date;
};

export type DeliveryGateResult = {
  ok: boolean;
  reason: string;
  flags: string[];
};

export function evaluateDeliveryGates(input: DeliveryGateInput): DeliveryGateResult {
  const flags: string[] = [...input.decision.safetyFlags];
  const now = input.now ?? new Date();

  if (input.expectedAccountId !== input.actualAccountId) {
    return { ok: false, reason: "ACCOUNT_MISMATCH", flags: [...flags, "ACCOUNT_MISMATCH"] };
  }
  if (input.expectedFanId !== input.actualFanId) {
    return { ok: false, reason: "FAN_MISMATCH", flags: [...flags, "FAN_MISMATCH"] };
  }
  if (input.autonomyMode === "PAUSED") {
    return { ok: false, reason: "AUTONOMY_FORBIDS_SEND", flags: [...flags, "AUTONOMY"] };
  }
  if (!input.humanApproved && input.autonomyMode === "COPILOT" && !input.flags.autonomousText) {
    return { ok: false, reason: "AUTONOMY_FORBIDS_SEND", flags: [...flags, "AUTONOMY"] };
  }
  if (!input.humanApproved && !input.flags.autonomousText) {
    return { ok: false, reason: "AUTONOMOUS_TEXT_DISABLED", flags: [...flags, "FEATURE_FLAG"] };
  }
  if (input.decision.action === "SEND_PPV" && !input.flags.autonomousPpv) {
    return { ok: false, reason: "AUTONOMOUS_PPV_DISABLED", flags: [...flags, "FEATURE_FLAG"] };
  }
  if (input.humanTakeover || (input.lockedUntil && input.lockedUntil > now)) {
    return { ok: false, reason: "HUMAN_TAKEOVER", flags: [...flags, "HUMAN_TAKEOVER"] };
  }
  if (input.newerMessageAfterTrigger) {
    return { ok: false, reason: "NEWER_MESSAGE", flags: [...flags, "STALE"] };
  }
  if (input.alreadySentForTrigger) {
    return { ok: false, reason: "DUPLICATE_TRIGGER", flags: [...flags, "DUPLICATE"] };
  }
  if (input.messagesSentLastHour >= input.policy.maximumMessagesPerHourPerFan) {
    return { ok: false, reason: "RATE_LIMIT", flags: [...flags, "RATE_LIMIT"] };
  }
  if (inQuietHours(now, input.policy.quietHours)) {
    return { ok: false, reason: "QUIET_HOURS", flags: [...flags, "QUIET_HOURS"] };
  }
  if (!input.safetyAllowed || input.bannedWordHit) {
    return { ok: false, reason: "SAFETY_BLOCK", flags: [...flags, "SAFETY"] };
  }
  if (input.decision.confidence < input.policy.minimumConfidence) {
    return { ok: false, reason: "LOW_CONFIDENCE", flags: [...flags, "LOW_CONFIDENCE"] };
  }
  if (input.decision.action === "SEND_PPV") {
    if (!input.policy.ppvEnabled) {
      return { ok: false, reason: "PPV_DISABLED", flags: [...flags, "PPV"] };
    }
    const product = input.product;
    if (!product || !product.approvedForAutomation || !product.platformMediaReference) {
      return { ok: false, reason: "UNMAPPED_VAULT", flags: [...flags, "UNMAPPED_VAULT"] };
    }
    if (product.alreadyPurchased) {
      return { ok: false, reason: "ALREADY_PURCHASED", flags: [...flags, "ALREADY_PURCHASED"] };
    }
    const priceCents = Math.round((input.decision.price ?? 0) * 100);
    if (priceCents > input.policy.maximumPpvPriceCents) {
      return { ok: false, reason: "PPV_PRICE_LIMIT", flags: [...flags, "PPV_PRICE"] };
    }
    if (priceCents < product.minimumPriceCents) {
      return { ok: false, reason: "BELOW_MINIMUM_PRICE", flags: [...flags, "PPV_PRICE"] };
    }
    if (product.maximumPriceCents != null && priceCents > product.maximumPriceCents) {
      return { ok: false, reason: "ABOVE_MAXIMUM_PRICE", flags: [...flags, "PPV_PRICE"] };
    }
    if (
      input.policy.allowedProductIds.length &&
      !input.policy.allowedProductIds.includes(product.id)
    ) {
      return { ok: false, reason: "PRODUCT_NOT_ALLOWED", flags: [...flags, "PRODUCT"] };
    }
  }
  if (input.decision.action === "ESCALATE" || input.decision.action === "DO_NOT_REPLY") {
    return { ok: false, reason: input.decision.action, flags };
  }
  return { ok: true, reason: "OK", flags };
}

export type AutonomyRouting = {
  status: "APPROVAL_REQUIRED" | "SCHEDULED" | "CANCELLED";
  reason: string;
};

export function routeAutonomy(input: {
  mode: AutonomyMode;
  flags: FeatureFlags;
  decision: AutomationDecision;
  policy: AutomationPolicySnapshot;
  humanTakeover: boolean;
  gate: DeliveryGateResult;
}): AutonomyRouting {
  if (input.mode === "PAUSED") {
    return { status: "CANCELLED", reason: "PAUSED" };
  }
  if (input.humanTakeover) {
    return { status: "APPROVAL_REQUIRED", reason: "HUMAN_TAKEOVER" };
  }
  if (input.decision.action === "ESCALATE" || input.decision.action === "DO_NOT_REPLY") {
    return { status: "APPROVAL_REQUIRED", reason: input.decision.reason || input.decision.action };
  }
  if (!input.flags.autonomousText) {
    return { status: "APPROVAL_REQUIRED", reason: "COPILOT_OR_FLAG" };
  }
  if (input.decision.action === "SEND_PPV" && !input.flags.autonomousPpv) {
    return { status: "APPROVAL_REQUIRED", reason: "PPV_FLAG" };
  }
  if (!input.gate.ok) {
    return { status: "APPROVAL_REQUIRED", reason: input.gate.reason };
  }
  if (input.mode === "COPILOT" || input.mode === "HYBRID" || input.mode === "AUTOPILOT") {
    return { status: "SCHEDULED", reason: input.mode };
  }
  return { status: "APPROVAL_REQUIRED", reason: "DEFAULT" };
}

export function confidenceFromGeneration(input: {
  blocked: boolean;
  failed?: boolean;
  validationErrors?: string[];
  riskFlags?: string[];
  recommendedAction?: string;
}): number {
  if (input.blocked || input.failed) return 0.1;
  if (input.recommendedAction === "BLOCK" || input.recommendedAction === "REQUEST_HUMAN_REVIEW") {
    return 0.35;
  }
  let score = 0.86;
  score -= (input.validationErrors?.length ?? 0) * 0.12;
  score -= (input.riskFlags?.length ?? 0) * 0.08;
  return Math.max(0.05, Math.min(0.95, score));
}
