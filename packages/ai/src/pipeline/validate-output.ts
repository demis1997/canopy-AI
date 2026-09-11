import type { GenerationOutput } from "@canopy/shared";
import { generationOutputSchema, ladderPrice, defaultSecondPrice, FIRST_PPV_MAX_DOLLARS } from "@canopy/shared";

function stripFences(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

export function parseGenerationOutput(
  text: string,
): { success: true; data: GenerationOutput } | { success: false; error: string } {
  const cleaned = stripFences(text);
  try {
    const json = JSON.parse(cleaned);
    const parsed = generationOutputSchema.safeParse(json);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "invalid json" };
  }
}

export function validateProductsAndPrices(
  output: GenerationOutput,
  catalog: {
    id: string;
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
  opts?: { creatorId?: string; purchasedProductIds?: string[] },
): { ok: boolean; output: GenerationOutput; errors: string[] } {
  const errors: string[] = [];
  let next = { ...output };

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
