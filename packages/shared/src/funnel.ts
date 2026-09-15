import type { FunnelStage, Intent, RecommendedAction } from "./enums.js";

const ORDER: FunnelStage[] = [
  "NEW_FAN",
  "RAPPORT",
  "INTEREST",
  "OFFER",
  "OBJECTION",
  "PURCHASE",
  "FOLLOW_UP",
];

export function funnelIndex(stage: FunnelStage): number {
  return ORDER.indexOf(stage);
}

export function canTransition(from: FunnelStage, to: FunnelStage): boolean {
  if (from === to || to === "FOLLOW_UP") return true;
  if (from === "FOLLOW_UP") {
    return to === "RAPPORT" || to === "INTEREST" || to === "OFFER";
  }
  if (from === "OBJECTION") {
    return to === "OFFER" || to === "RAPPORT" || to === "PURCHASE";
  }
  if (from === "PURCHASE") {
    return to === "OFFER";
  }
  const delta = funnelIndex(to) - funnelIndex(from);
  return delta >= -1 && delta <= 2;
}

export function playbookFor(
  stage: FunnelStage,
  intent: Intent,
  unansweredFollowUps = 0,
  purchasedPpvCount = 0,
): string {
  if (purchasedPpvCount >= 3) return "AFTERCARE";
  if (unansweredFollowUps > 0) return "NO_RESPONSE_FOLLOW_UP";
  if (intent === "COMPLAINT" || intent === "REFUND") return "COMPLAINT_REFUND";
  if (intent === "PRICE_OBJECTION") return "PRICE_OBJECTION";
  if (intent === "PURCHASE_INTEREST" || intent === "CONTENT_REQUEST") {
    return stage === "OFFER" ? "PRESENTING_PPV" : "INTRODUCING_PRODUCT";
  }
  if (intent === "SEXTING") return "SEXTING";
  if (intent === "FLIRT") return "FLIRTING";
  switch (stage) {
    case "NEW_FAN":
      return "NEW_SUBSCRIBER_GREETING";
    case "RAPPORT":
      return "BUILDING_RAPPORT";
    case "INTEREST":
      return "IDENTIFYING_INTERESTS";
    case "OFFER":
      return "PRESENTING_PPV";
    case "OBJECTION":
      return "PRICE_OBJECTION";
    case "PURCHASE":
      return "POST_PURCHASE";
    case "FOLLOW_UP":
      return "NO_RESPONSE_FOLLOW_UP";
  }
}

export function recommendedActionFor(input: {
  intent: Intent;
  stage: FunnelStage;
  offerCooldownActive: boolean;
  rapportPriority: boolean;
}): RecommendedAction {
  const { intent, stage, offerCooldownActive, rapportPriority } = input;
  if (intent === "UNSAFE") return "BLOCK";
  if (intent === "COMPLAINT" || intent === "REFUND") return "REQUEST_HUMAN_REVIEW";
  if (intent === "PRICE_OBJECTION") return "ANSWER_OBJECTION";
  if (rapportPriority && stage !== "OFFER") return "BUILD_RAPPORT";
  if (
    (intent === "PURCHASE_INTEREST" || intent === "CONTENT_REQUEST") &&
    !offerCooldownActive
  ) {
    return "PRESENT_OFFER";
  }
  if (intent === "SEXTING" && (stage === "RAPPORT" || stage === "INTEREST")) {
    return "ESCALATE_EXPLICITNESS";
  }
  if (stage === "NEW_FAN" || stage === "RAPPORT") return "BUILD_RAPPORT";
  return "REPLY";
}

export const OFFER_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const MAX_OFFERS_PER_DAY = 3;
