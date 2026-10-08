export const SEQUENCE_KINDS = [
  "STARTER",
  "TEASER",
  "VOICE",
  "PHOTO",
  "SEXTING",
  "PPV",
  "FOLLOW_UP",
  "AFTERCARE",
] as const;
export type SequenceKind = (typeof SEQUENCE_KINDS)[number];

export const SEQUENCE_STEP_MEDIA = ["TEXT", "VOICE", "PHOTO", "PPV"] as const;
export type SequenceStepMedia = (typeof SEQUENCE_STEP_MEDIA)[number];

export const FAN_DOMINANCE = ["UNKNOWN", "SUBMISSIVE", "DOMINANT", "SWITCH"] as const;
export type FanDominance = (typeof FAN_DOMINANCE)[number];

/** Kept for older copy. Aftercare is now tied to the 3rd sequence unlock, not unanswered nudges. */
export const AFTERCARE_AFTER_FOLLOW_UPS = 3;
export const AFTERCARE_AFTER_PURCHASES = 3;
export const FIRST_PPV_MAX_DOLLARS = 10;
export const SEQUENCE_DROP_CAP = 6;
export const WELCOME_FIRST_SEQUENCE_PRICE = 8;
export const WELCOME_SEQUENCE_LADDER = [15, 35, 75, 115, 175, 199] as const;
export const UNPAID_LOW_LADDER = [7, 17, 37, 65, 109, 179] as const;
export const UNPAID_HIGH_LADDER = [12, 25, 49, 99, 149, 199] as const;
/** First silent nudge still sells list. Discount only after they go quiet again. */
export const DISCOUNT_AFTER_SILENT_FOLLOW_UPS = 2;

export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function defaultSecondPrice(standardPrice: number, minimumPrice: number): number {
  return money((standardPrice + minimumPrice) / 2);
}

export function nextSendAttempt(unpaidOfferCount: number): number {
  return Math.max(1, unpaidOfferCount + 1);
}

export function unpaidOfferCount(
  offers: { productId: string; accepted: boolean | null }[],
  productId: string,
): number {
  return offers.filter((offer) => offer.productId === productId && offer.accepted !== true).length;
}

/** First PPV is the cheap intro (always ≤ $10) or the first unlock with this creator. Never discount it. */
export function isFirstPpv(standardPrice: number, purchasedPpvCount = 0): boolean {
  return purchasedPpvCount < 1 || standardPrice <= FIRST_PPV_MAX_DOLLARS + 0.009;
}

/** 1 = list, 2 = mid, 3 = floor. Discount only after they stop replying, and never on the first PPV. */
export function ladderSendAttempt(input: {
  standardPrice: number;
  unansweredFollowUps: number;
  purchasedPpvCount: number;
  offeredUnpaid?: boolean;
}): number {
  if (isFirstPpv(input.standardPrice, input.purchasedPpvCount)) return 1;
  if (!input.offeredUnpaid) return 1;
  if (input.unansweredFollowUps < DISCOUNT_AFTER_SILENT_FOLLOW_UPS) return 1;
  if (input.unansweredFollowUps === DISCOUNT_AFTER_SILENT_FOLLOW_UPS) return 2;
  return 3;
}

export function ladderPrice(input: {
  standardPrice: number;
  minimumPrice: number;
  discountLimitPercent: number;
  sendAttempt: number;
  secondPrice?: number | null;
}): { price: number; kind: "LIST" | "SECOND" | "MINIMUM" } {
  const floor = money(
    Math.max(input.minimumPrice, input.standardPrice * (1 - input.discountLimitPercent / 100)),
  );
  const second = money(
    Math.min(
      input.standardPrice,
      Math.max(
        floor,
        input.secondPrice ?? defaultSecondPrice(input.standardPrice, input.minimumPrice),
      ),
    ),
  );
  if (input.sendAttempt <= 1) return { price: money(input.standardPrice), kind: "LIST" };
  if (input.sendAttempt === 2) return { price: second, kind: "SECOND" };
  return { price: floor, kind: "MINIMUM" };
}

export function followUpPhase(
  unansweredFollowUps: number,
  purchasedPpvCount = 0,
): "NONE" | "FOLLOW_UP" | "AFTERCARE" {
  if (purchasedPpvCount >= AFTERCARE_AFTER_PURCHASES) return "AFTERCARE";
  if (unansweredFollowUps <= 0) return "NONE";
  return "FOLLOW_UP";
}

export function assessSpendLikelihood(input: {
  age?: string | null;
  city?: string | null;
  job?: string | null;
}): "LOW" | "HIGH" {
  const job = (input.job ?? "").toLowerCase();
  const city = (input.city ?? "").toLowerCase();
  const age = Number(input.age);
  const highJob =
    /\b(doctor|surgeon|lawyer|attorney|engineer|software|founder|ceo|owner|entrepreneur|finance|banker|pilot|architect|producer|investor)\b/.test(
      job,
    );
  const highCity =
    /\b(nyc|new york|la|los angeles|miami|london|sf|san francisco|chicago|dubai|sydney)\b/.test(
      city,
    );
  const highAge = Number.isFinite(age) && age >= 30;
  if (highJob || highCity || highAge) return "HIGH";
  return "LOW";
}

export function sequenceDropPrice(input: {
  boughtWelcome: boolean;
  spendTier: "LOW" | "HIGH";
  purchasedSequenceCount: number;
  previousPrice?: number | null;
}): number | null {
  if (input.purchasedSequenceCount >= SEQUENCE_DROP_CAP) return null;
  const ladder = input.boughtWelcome
    ? input.purchasedSequenceCount === 0
      ? [WELCOME_FIRST_SEQUENCE_PRICE]
      : WELCOME_SEQUENCE_LADDER
    : input.spendTier === "HIGH"
      ? UNPAID_HIGH_LADDER
      : UNPAID_LOW_LADDER;
  const index =
    input.boughtWelcome && input.purchasedSequenceCount > 0
      ? input.purchasedSequenceCount - 1
      : input.purchasedSequenceCount;
  const raw = ladder[Math.min(index, ladder.length - 1)];
  if (raw == null) return null;
  const floor = input.previousPrice != null ? input.previousPrice + 0.01 : 0;
  return money(Math.max(raw, floor));
}

export function nextLockedDropPolicy(input: {
  unpaidLockedCount: number;
  promisedNext: boolean;
  honoredPromise?: boolean;
}): "FOLLOW_UP" | "ALLOW_NEXT" | "STOP" {
  if (input.unpaidLockedCount >= 2) return "STOP";
  if (input.unpaidLockedCount <= 0) return "ALLOW_NEXT";
  if (input.promisedNext && !input.honoredPromise) return "ALLOW_NEXT";
  return "FOLLOW_UP";
}
