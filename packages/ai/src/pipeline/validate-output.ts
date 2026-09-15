import type { GenerationOutput, OperatorRejection } from "@canopy/shared";
import {
  generationOutputSchema,
  ladderPrice,
  defaultSecondPrice,
  FIRST_PPV_MAX_DOLLARS,
  containsMeetSpeak,
  looksLikeOfflineAsk,
  looksLikePetNamePushback,
  looksLikeFanInvitesQuestions,
  looksLikeInvertedCuriosity,
  looksLikeAgeAsk,
  looksLikeAreYouReal,
  looksLikeConfirmedInventedAboutHimCallout,
  looksLikeMixupCalloutLanguage,
  looksLikeDirectCreatorQuestion,
  looksLikeMixupApology,
  looksLikeLocationAsk,
  looksLikeSexualPivot,
  looksLikePacingPushback,
  looksLikeTeaseAsk,
  looksLikeMetaTease,
  looksLikeRefundTalk,
  looksLikeRefundAsk,
  looksLikeRefundCallout,
  looksLikeInventedBeach,
  looksLikeWhatsWrongFollowup,
  looksLikeSextAsk,
  looksLikeStaleAreYouReal,
  looksLikeRelationshipAsk,
  answersRelationshipAsk,
  answersAgeAsk,
  answersLocationAsk,
  inventedAboutHimReplyVariants,
  MIXUP_CLARIFY_VARIANTS,
  petNamesAllowed,
  stripUnauthorizedPetNames,
  wantsNoPitch,
  bannedCatalogNames,
  catalogDisplayName,
  pitchIsTooEarly,
  rewriteDirectUnlockPitch,
  stripCatalogMentions,
  ageReplyVariants,
  locationReplyVariants,
  pickFreshVariants,
  tooSimilar,
  teaseReplyVariants,
  normalizeReplyBubbles,
  TOS_OFFLINE_VARIANTS,
  TOS_OFFLINE_FOLLOWUP_VARIANTS,
  PET_NAME_PUSHBACK_FALLBACK,
  PET_NAME_PUSHBACK_VARIANTS,
  ABOUT_HIM_VARIANTS,
  looksLikeAimlessRapport,
  RAPPORT_ONLY_VARIANTS,
  areYouRealReplyVariants,
  looksLikeWeakAreYouReal,
  SOFT_TEASE_VARIANTS,
  REFUND_CALLOUT_VARIANTS,
  relationshipReplyVariants,
} from "@canopy/shared";

function stripFences(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

export function extractJsonObject(text: string): string {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

export function parseGenerationOutput(
  text: string,
): { success: true; data: GenerationOutput } | { success: false; error: string } {
  const cleaned = extractJsonObject(text);
  try {
    const json = JSON.parse(cleaned);
    const parsed = generationOutputSchema.safeParse(json);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: scrubOfflineAsks(parsed.data) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "invalid json" };
  }
}

function mapOptionTexts(
  output: GenerationOutput,
  fn: (text: string, index: number) => string,
): GenerationOutput {
  const options = output.replyOptions.map((o, i) => {
    const cleaned = normalizeReplyBubbles({ text: fn(o.text, i) });
    return {
      ...o,
      text: cleaned.text,
      messages: cleaned.messages,
    };
  });
  return { ...output, replyOptions: options };
}

function replaceAllOptions(
  output: GenerationOutput,
  texts: string[],
  seed?: string | null,
  recent: string[] = [],
): GenerationOutput {
  const pool = pickFreshVariants(texts, recent, seed);
  const next = mapOptionTexts(output, (_text, i) => pool[i] ?? pool[0]!);
  return {
    ...next,
    replyOptions: next.replyOptions.map((o) => ({
      ...o,
      internalReason: "guarded reply — no invented pitch or banned wording",
    })),
    recommendedProductId: null,
    approvedPrice: null,
  };
}

function scrubOfflineAsks(output: GenerationOutput): GenerationOutput {
  if (!output.replyOptions.some((o) => containsMeetSpeak(o.text) || o.messages.some(containsMeetSpeak))) {
    return output;
  }
  return replaceAllOptions(output, TOS_OFFLINE_VARIANTS);
}

export type AppliedGuard =
  | "relationship"
  | "age"
  | "location"
  | "about-him"
  | "invented-about-him"
  | "invented-about-him-clarify"
  | "offline"
  | "refund"
  | "tease"
  | "are-you-real"
  | "pet-name"
  | "intake"
  | "pacing"
  | "offline-followup"
  | null;

const LOCKED_GUARDS = new Set<AppliedGuard>([
  "relationship",
  "age",
  "location",
  "about-him",
  "invented-about-him",
  "invented-about-him-clarify",
  "offline",
  "refund",
  "tease",
  "are-you-real",
  "pet-name",
]);

function envFlag(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

function isGuardDebug(): boolean {
  return envFlag("NODE_ENV") === "development" || envFlag("CANOPY_GUARD_LOG") === "1";
}

function logGuardDebug(payload: Record<string, unknown>): void {
  if (envFlag("NODE_ENV") === "production" || !isGuardDebug()) return;
  console.info("[canopy-guard]", JSON.stringify(payload));
}

export type ReplyGuardExtras = {
  rejections?: OperatorRejection[];
  catalog?: { id: string; name?: string }[];
  conversationId?: string;
  dominance?: string;
  creatorAge?: number | null;
  funnelStage?: string;
  fanMessageCount?: number;
  threadOnOffline?: boolean;
  fanIntake?: string[];
  variantSeed?: string | null;
  creatorCity?: string | null;
  recentOutbound?: string[];
  recentMessages?: { authorType: string; body: string }[];
  transPersona?: boolean;
  threadBannedPetNames?: boolean;
  threadLessons?: {
    answeredAreYouReal?: boolean;
    bannedPetNames?: boolean;
    bannedRefunds?: boolean;
    bannedBeach?: boolean;
    heWantsTease?: boolean;
  };
  fanSentPics?: boolean;
  sellTarget?: { productId: string; name: string; price: number; reason?: "CONTEXT" | "DEFAULT" | "SEQUENCE" };
};

function firstText(output: GenerationOutput): string {
  return output.replyOptions[0]?.text ?? "";
}

export function applyReplyGuards(
  output: GenerationOutput,
  subscriberText = "",
  extras?: ReplyGuardExtras,
): GenerationOutput {
  const seed = extras?.variantSeed;
  const recent = extras?.recentOutbound ?? [];
  const recentMessages =
    extras?.recentMessages ??
    recent.map((body) => ({ authorType: "CREATOR", body }));
  const teasePool = teaseReplyVariants(Boolean(extras?.transPersona));
  const swap = (current: GenerationOutput, pool: string[]) => replaceAllOptions(current, pool, seed, recent);

  let next = scrubOfflineAsks(output);
  let applied: AppliedGuard = null;
  let replaced = false;
  let reason = "kept-model-output";

  const confirmMixup = looksLikeConfirmedInventedAboutHimCallout({
    subscriberText,
    recentMessages,
  });
  const hits: Record<string, boolean> = {
    offline: looksLikeOfflineAsk(subscriberText),
    "pet-name": looksLikePetNamePushback(subscriberText),
    "are-you-real": looksLikeAreYouReal(subscriberText) || looksLikeWhatsWrongFollowup(subscriberText),
    refund: looksLikeRefundCallout(subscriberText),
    relationship: looksLikeRelationshipAsk(subscriberText),
    tease: looksLikeTeaseAsk(subscriberText),
    pacing: looksLikePacingPushback(subscriberText) && Boolean(extras?.fanIntake?.length),
    location: looksLikeLocationAsk(subscriberText),
    age: looksLikeAgeAsk(subscriberText),
    "about-him": looksLikeFanInvitesQuestions(subscriberText),
    "direct-creator-question": looksLikeDirectCreatorQuestion(subscriberText),
    "confirmed-mixup": confirmMixup.matched,
    "mixup-language": looksLikeMixupCalloutLanguage(subscriberText),
  };
  const matched = Object.entries(hits)
    .filter(([, hit]) => hit)
    .map(([name]) => name);

  if (hits.offline) {
    next = swap(next, TOS_OFFLINE_VARIANTS);
    applied = "offline";
    replaced = true;
    reason = "offline-tos";
  } else if (hits["pet-name"]) {
    next = swap(next, PET_NAME_PUSHBACK_VARIANTS);
    applied = "pet-name";
    replaced = true;
    reason = "pet-name-pushback";
  } else if (hits["are-you-real"]) {
    const weak = next.replyOptions.some((o) => looksLikeWeakAreYouReal(o.text) || o.messages.some(looksLikeWeakAreYouReal));
    if (weak) {
      next = swap(next, areYouRealReplyVariants(Boolean(extras?.fanSentPics)));
      replaced = true;
      reason = "are-you-real-weak-draft";
    } else {
      reason = "are-you-real-kept";
    }
    applied = "are-you-real";
  } else if (hits.refund) {
    next = swap(next, REFUND_CALLOUT_VARIANTS);
    applied = "refund";
    replaced = true;
    reason = "refund-callout";
  } else if (hits.relationship) {
    const pool =
      extras?.fanIntake?.[0] && answersRelationshipAsk(extras.fanIntake[0])
        ? extras.fanIntake
        : relationshipReplyVariants();
    if (!answersRelationshipAsk(firstText(next))) {
      next = swap(next, pool);
      replaced = true;
      reason = "relationship-fallback";
    } else {
      reason = "relationship-kept";
    }
    applied = "relationship";
  } else if (hits.tease) {
    next = swap(next, teasePool);
    applied = "tease";
    replaced = true;
    reason = "tease-ask";
  } else if (hits.pacing) {
    next = swap(next, extras!.fanIntake!);
    applied = "pacing";
    replaced = true;
    reason = "pacing-intake";
  } else if (hits.location) {
    const pool =
      extras?.fanIntake?.[0] && answersLocationAsk(extras.fanIntake[0])
        ? extras.fanIntake
        : locationReplyVariants(extras?.creatorCity ?? null);
    if (!answersLocationAsk(firstText(next))) {
      next = swap(next, pool);
      replaced = true;
      reason = "location-fallback";
    } else {
      reason = "location-kept";
    }
    applied = "location";
  } else if (hits.age) {
    const pool =
      extras?.fanIntake?.[0] && answersAgeAsk(extras.fanIntake[0], extras?.creatorAge ?? null)
        ? extras.fanIntake
        : ageReplyVariants(extras?.creatorAge ?? null);
    if (!answersAgeAsk(firstText(next), extras?.creatorAge ?? null)) {
      next = swap(next, pool);
      replaced = true;
      reason = "age-fallback";
    } else {
      reason = "age-kept";
    }
    applied = "age";
  } else if (
    hits["about-him"] &&
    (looksLikeMixupApology(firstText(next)) ||
      next.replyOptions.some((o) => looksLikeInvertedCuriosity(o.text) || o.messages.some(looksLikeInvertedCuriosity)))
  ) {
    next = swap(next, ABOUT_HIM_VARIANTS);
    applied = "about-him";
    replaced = true;
    reason = "about-him-fallback";
  } else if (hits["about-him"]) {
    applied = "about-him";
    reason = "about-him-kept";
  } else if (hits["confirmed-mixup"]) {
    next = swap(next, inventedAboutHimReplyVariants(confirmMixup.aboutMe));
    applied = "invented-about-him";
    replaced = true;
    reason = confirmMixup.aboutMe ? "confirmed-mixup-was-me" : "confirmed-mixup";
  } else if (hits["mixup-language"] && !hits["direct-creator-question"]) {
    next = swap(next, MIXUP_CLARIFY_VARIANTS);
    applied = "invented-about-him-clarify";
    replaced = true;
    reason = "unconfirmed-mixup-clarify";
  } else if (
    extras?.fanIntake?.length &&
    !looksLikeSextAsk(subscriberText) &&
    !hits.tease &&
    extras?.sellTarget?.reason !== "CONTEXT"
  ) {
    matched.push("intake");
    next = swap(next, extras.fanIntake);
    applied = "intake";
    replaced = true;
    reason = "fan-intake";
  } else if (extras?.threadOnOffline) {
    matched.push("offline-followup");
    next = swap(next, looksLikeSexualPivot(subscriberText) ? SOFT_TEASE_VARIANTS : TOS_OFFLINE_FOLLOWUP_VARIANTS);
    applied = "offline-followup";
    replaced = true;
    reason = "offline-followup";
  }

  const sextNow =
    looksLikeTeaseAsk(subscriberText) ||
    looksLikeSextAsk(subscriberText) ||
    Boolean(extras?.threadLessons?.heWantsTease && !looksLikeAreYouReal(subscriberText));
  const locked = LOCKED_GUARDS.has(applied);

  if (
    !locked &&
    !looksLikeAreYouReal(subscriberText) &&
    !looksLikeWhatsWrongFollowup(subscriberText) &&
    next.replyOptions.some((o) => looksLikeStaleAreYouReal(o.text) || o.messages.some(looksLikeStaleAreYouReal))
  ) {
    next = swap(
      next,
      sextNow ? teasePool : extras?.fanIntake?.length ? extras.fanIntake : RAPPORT_ONLY_VARIANTS,
    );
    replaced = true;
    reason = "stale-are-you-real";
  }

  if (
    !locked &&
    sextNow &&
    next.replyOptions.some((o) => looksLikeMetaTease(o.text) || o.messages.some(looksLikeMetaTease))
  ) {
    next = swap(next, teasePool);
    replaced = true;
    reason = "meta-tease";
  }

  if (
    !locked &&
    !looksLikeRefundAsk(subscriberText) &&
    !looksLikeRefundCallout(subscriberText) &&
    next.replyOptions.some((o) => looksLikeRefundTalk(o.text) || o.messages.some(looksLikeRefundTalk))
  ) {
    next = swap(
      next,
      looksLikeAreYouReal(subscriberText) || looksLikeWhatsWrongFollowup(subscriberText)
        ? areYouRealReplyVariants(Boolean(extras?.fanSentPics))
        : REFUND_CALLOUT_VARIANTS,
    );
    replaced = true;
    reason = "refund-leak";
  }

  if (
    !locked &&
    next.replyOptions.some((o) => looksLikeInventedBeach(o.text) || o.messages.some(looksLikeInventedBeach))
  ) {
    next = swap(next, inventedAboutHimReplyVariants(false));
    replaced = true;
    reason = "invented-beach-output";
  }

  if (
    !applied &&
    next.replyOptions.some((o) => recent.some((r) => tooSimilar(o.text, r) || o.messages.some((m) => tooSimilar(m, r))))
  ) {
    next = swap(next, looksLikeTeaseAsk(subscriberText) ? teasePool : extras?.fanIntake?.length ? extras.fanIntake : RAPPORT_ONLY_VARIANTS);
    replaced = true;
    reason = "duplicate-outbound";
  }

  logGuardDebug({
    subscriberText: envFlag("NODE_ENV") === "development" ? subscriberText : undefined,
    subscriberLen: subscriberText.length,
    classifiers: matched,
    selectedGuard: applied,
    replaced,
    reason,
  });

  if (!petNamesAllowed({
    subscriberText,
    dominance: extras?.dominance,
    threadBanned: extras?.threadBannedPetNames || extras?.threadLessons?.bannedPetNames,
  })) {
    next = mapOptionTexts(next, (text) => stripUnauthorizedPetNames(text));
  }

  const rejections = extras?.rejections ?? [];
  const catalog = extras?.catalog ?? [];
  if (rejections.length) {
    const noPitch = wantsNoPitch(rejections, extras?.conversationId);
    const banned = bannedCatalogNames(rejections, catalog, extras?.conversationId);
    if (noPitch || banned.names.length) {
      const namesToStrip = noPitch
        ? catalog.map((p) => catalogDisplayName(p.name ?? "")).filter((n) => n.length >= 3)
        : banned.names;
      const idsToDrop = new Set(noPitch ? catalog.map((p) => p.id) : banned.ids);
      const dropProduct =
        noPitch || (next.recommendedProductId != null && idsToDrop.has(next.recommendedProductId));
      next = mapOptionTexts(next, (text, i) => {
        const stripped = stripCatalogMentions(text, namesToStrip);
        return stripped.trim() ? stripped : RAPPORT_ONLY_VARIANTS[i % RAPPORT_ONLY_VARIANTS.length]!;
      });
      if (dropProduct) {
        next = {
          ...next,
          recommendedProductId: null,
          approvedPrice: null,
          recommendedAction:
            next.recommendedAction === "PRESENT_OFFER" || next.recommendedAction === "ESCALATE_EXPLICITNESS"
              ? "REPLY"
              : next.recommendedAction,
        };
      }
    }
  }

  const catalogNames = catalog.map((p) => catalogDisplayName(p.name ?? "")).filter((n) => n.length >= 3);
  if (
    pitchIsTooEarly({
      funnelStage: extras?.funnelStage,
      fanMessageCount: extras?.fanMessageCount,
      subscriberText,
      threadOnOffline: extras?.threadOnOffline,
    })
  ) {
    next = mapOptionTexts(next, (text, i) => {
      const stripped = stripCatalogMentions(text, catalogNames);
      return stripped.trim() ? stripped : RAPPORT_ONLY_VARIANTS[i % RAPPORT_ONLY_VARIANTS.length]!;
    });
    next = {
      ...next,
      recommendedProductId: null,
      approvedPrice: null,
      recommendedAction:
        next.recommendedAction === "PRESENT_OFFER" || next.recommendedAction === "ESCALATE_EXPLICITNESS"
          ? "REPLY"
          : next.recommendedAction,
    };
  }

  if (
    !looksLikeAreYouReal(subscriberText) &&
    !looksLikeOfflineAsk(subscriberText) &&
    !looksLikeTeaseAsk(subscriberText) &&
    next.replyOptions.some((o) => looksLikeAimlessRapport(o.text) || o.messages.some(looksLikeAimlessRapport))
  ) {
    next = swap(
      next,
      sextNow ? teasePool : extras?.fanIntake?.length ? extras.fanIntake : RAPPORT_ONLY_VARIANTS,
    );
  }

  if (
    extras?.sellTarget &&
    next.recommendedProductId &&
    next.recommendedProductId !== extras.sellTarget.productId &&
    (extras.catalog ?? []).some((p) => p.id === extras.sellTarget!.productId)
  ) {
    const namesToStrip = (extras.catalog ?? [])
      .filter((p) => p.id !== extras.sellTarget!.productId)
      .map((p) => catalogDisplayName(p.name ?? ""))
      .filter((n) => n.length >= 3);
    next = mapOptionTexts(next, (text) => stripCatalogMentions(text, namesToStrip));
    next = {
      ...next,
      recommendedProductId: extras.sellTarget.productId,
      approvedPrice: extras.sellTarget.price,
    };
  }

  return mapOptionTexts(next, (text) => rewriteDirectUnlockPitch(text));
}

export function validateProductsAndPrices(
  output: GenerationOutput,
  catalog: {
    id: string;
    name?: string;
    standardPrice: number;
    minimumPrice: number;
    available: boolean;
    creatorId?: string;
    resaleAllowed?: boolean;
    secondPrice?: number | null;
    sendAttempt?: number;
    discountLimitPercent?: number;
  }[],
  discountLimitPercent = 10,
  concessionAllowed = false,
  opts?: {
    creatorId?: string;
    purchasedProductIds?: string[];
    subscriberText?: string;
    rejections?: OperatorRejection[];
    conversationId?: string;
    dominance?: string;
    creatorAge?: number | null;
    funnelStage?: string;
    fanMessageCount?: number;
    threadOnOffline?: boolean;
    fanIntake?: string[];
    variantSeed?: string | null;
    creatorCity?: string | null;
    recentOutbound?: string[];
    recentMessages?: { authorType: string; body: string }[];
    transPersona?: boolean;
    threadBannedPetNames?: boolean;
    threadLessons?: ReplyGuardExtras["threadLessons"];
    fanSentPics?: boolean;
    sellTarget?: ReplyGuardExtras["sellTarget"];
  },
): { ok: boolean; output: GenerationOutput; errors: string[] } {
  const errors: string[] = [];
  let next = applyReplyGuards({ ...output }, opts?.subscriberText ?? "", {
    rejections: opts?.rejections,
    catalog,
    conversationId: opts?.conversationId,
    dominance: opts?.dominance,
    creatorAge: opts?.creatorAge,
    funnelStage: opts?.funnelStage,
    fanMessageCount: opts?.fanMessageCount,
    threadOnOffline: opts?.threadOnOffline,
    fanIntake: opts?.fanIntake,
    variantSeed: opts?.variantSeed,
    creatorCity: opts?.creatorCity,
    recentOutbound: opts?.recentOutbound,
    recentMessages: opts?.recentMessages,
    transPersona: opts?.transPersona,
    threadBannedPetNames: opts?.threadBannedPetNames,
    threadLessons: opts?.threadLessons,
    fanSentPics: opts?.fanSentPics,
    sellTarget: opts?.sellTarget,
  });

  if (next.recommendedProductId) {
    const product = catalog.find((p) => p.id === next.recommendedProductId);
    if (!product || !product.available) {
      errors.push("INVENTED_OR_UNAVAILABLE_PRODUCT");
      next = {
        ...next,
        recommendedProductId: null,
        approvedPrice: null,
        requiresHumanReview: true,
        riskFlags: [...next.riskFlags, "INVALID_PRODUCT"],
        recommendedAction: "REQUEST_HUMAN_REVIEW",
      };
    } else if (opts?.creatorId && product.creatorId && product.creatorId !== opts.creatorId) {
      errors.push("WRONG_CREATOR");
      next = {
        ...next,
        recommendedProductId: null,
        approvedPrice: null,
        requiresHumanReview: true,
        riskFlags: [...next.riskFlags, "WRONG_CREATOR"],
        recommendedAction: "REQUEST_HUMAN_REVIEW",
      };
    } else if (
      opts?.purchasedProductIds?.includes(product.id) &&
      !product.resaleAllowed
    ) {
      errors.push("ALREADY_PURCHASED");
      next = {
        ...next,
        recommendedProductId: null,
        approvedPrice: null,
        requiresHumanReview: true,
        riskFlags: [...next.riskFlags, "ALREADY_PURCHASED"],
        recommendedAction: "REQUEST_HUMAN_REVIEW",
      };
    } else if (next.approvedPrice != null) {
      const intro = product.standardPrice <= FIRST_PPV_MAX_DOLLARS + 0.009;
      const attempt = intro ? 1 : (product.sendAttempt ?? 1);
      const limit = product.discountLimitPercent ?? discountLimitPercent;
      const minAllowed = ladderPrice({
        standardPrice: product.standardPrice,
        minimumPrice: product.minimumPrice,
        discountLimitPercent: limit,
        sendAttempt: attempt,
        secondPrice: product.secondPrice,
      }).price;
      const absoluteFloor = Math.max(
        product.minimumPrice,
        product.standardPrice * (1 - limit / 100),
      );
      if (next.approvedPrice > product.standardPrice + 0.009) {
        errors.push("UNAUTHORISED_PRICE");
        next = {
          ...next,
          recommendedProductId: null,
          approvedPrice: null,
          requiresHumanReview: true,
          riskFlags: [...next.riskFlags, "INVALID_PRICE"],
          recommendedAction: "REQUEST_HUMAN_REVIEW",
        };
      } else if (next.approvedPrice < absoluteFloor - 0.009) {
        errors.push("UNAUTHORISED_PRICE");
        next = {
          ...next,
          recommendedProductId: null,
          approvedPrice: null,
          requiresHumanReview: true,
          riskFlags: [...next.riskFlags, "INVALID_PRICE"],
          recommendedAction: "REQUEST_HUMAN_REVIEW",
        };
      } else if (attempt <= 1 && next.approvedPrice < product.standardPrice - 0.009) {
        next = {
          ...next,
          approvedPrice: product.standardPrice,
          riskFlags: [...next.riskFlags, "EARLY_DISCOUNT_CLAMPED"],
        };
      } else if (attempt === 2 && next.approvedPrice < minAllowed - 0.009) {
        next = {
          ...next,
          approvedPrice: minAllowed,
          riskFlags: [...next.riskFlags, "LADDER_PRICE_CLAMPED"],
        };
      }
    }
  } else if (next.approvedPrice != null) {
    errors.push("PRICE_WITHOUT_PRODUCT");
    next = { ...next, approvedPrice: null, requiresHumanReview: true };
  }

  const inventedInText = next.replyOptions.some((opt) =>
    /\$\s*\d+/.test(opt.text) &&
    !catalog.some((p) => opt.text.includes(String(p.standardPrice))),
  );
  if (inventedInText && next.recommendedProductId === null && /\$\s*\d+/.test(next.replyOptions.map((o) => o.text).join(" "))) {
    const prices = next.replyOptions.flatMap((o) => [...o.text.matchAll(/\$\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])));
    const allowed = new Set(
      catalog.flatMap((p) => [p.standardPrice, p.minimumPrice, p.secondPrice ?? defaultSecondPrice(p.standardPrice, p.minimumPrice)]),
    );
    if (prices.some((p) => ![...allowed].some((a) => Math.abs(a - p) < 0.05))) {
      errors.push("INVENTED_PRICE_IN_TEXT");
      next = {
        ...next,
        requiresHumanReview: true,
        riskFlags: [...next.riskFlags, "INVALID_PRICE_IN_TEXT"],
      };
    }
  }

  return { ok: errors.length === 0, output: next, errors };
}
