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
  petNamesAllowed,
  stripUnauthorizedPetNames,
  wantsNoPitch,
  bannedCatalogNames,
  catalogDisplayName,
  stripCatalogMentions,
  doubleOneTrailingEmoji,
  normalizeReplyBubbles,
  TOS_OFFLINE_VARIANTS,
  PET_NAME_PUSHBACK_FALLBACK,
  ABOUT_HIM_VARIANTS,
  RAPPORT_ONLY_VARIANTS,
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

function replaceAllOptions(output: GenerationOutput, texts: string[]): GenerationOutput {
  const next = mapOptionTexts(output, (_text, i) => texts[i] ?? texts[0]!);
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

export type ReplyGuardExtras = {
  rejections?: OperatorRejection[];
  catalog?: { id: string; name?: string }[];
  conversationId?: string;
  dominance?: string;
};

export function applyReplyGuards(
  output: GenerationOutput,
  subscriberText = "",
  extras?: ReplyGuardExtras,
): GenerationOutput {
  let next = scrubOfflineAsks(output);
  if (looksLikeOfflineAsk(subscriberText)) {
    next = replaceAllOptions(next, TOS_OFFLINE_VARIANTS);
  } else if (looksLikePetNamePushback(subscriberText)) {
    next = replaceAllOptions(next, [PET_NAME_PUSHBACK_FALLBACK, PET_NAME_PUSHBACK_FALLBACK, PET_NAME_PUSHBACK_FALLBACK]);
  } else if (
    looksLikeFanInvitesQuestions(subscriberText) &&
    next.replyOptions.some(
      (o) => looksLikeInvertedCuriosity(o.text) || o.messages.some(looksLikeInvertedCuriosity),
    )
  ) {
    next = replaceAllOptions(next, ABOUT_HIM_VARIANTS);
  }

  if (!petNamesAllowed({ subscriberText, dominance: extras?.dominance })) {
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

  return mapOptionTexts(next, (text) => doubleOneTrailingEmoji(text));
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
  },
): { ok: boolean; output: GenerationOutput; errors: string[] } {
  const errors: string[] = [];
  let next = applyReplyGuards({ ...output }, opts?.subscriberText ?? "", {
    rejections: opts?.rejections,
    catalog,
    conversationId: opts?.conversationId,
    dominance: opts?.dominance,
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
