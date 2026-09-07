import type { Intent } from "@canopy/shared";

export type OfferSnapshot = {
  productId: string;
  productName: string;
  price: number;
  listPrice: number;
  accepted: boolean | null;
};

export type PricingContext = {
  concessionAllowed: boolean;
  lastOffer: {
    productName: string;
    price: number;
    listPrice: number;
    declined: boolean;
  } | null;
};

export function priceFloor(
  standardPrice: number,
  minimumPrice: number,
  discountLimitPercent: number,
): number {
  return Math.round(
    Math.max(minimumPrice, standardPrice * (1 - discountLimitPercent / 100)) * 100,
  ) / 100;
}

export function resolveOfferPrice(input: {
  standardPrice: number;
  minimumPrice: number;
  discountLimitPercent: number;
  concessionAllowed: boolean;
}): { price: number; kind: "LIST" | "CONCESSION" } {
  if (!input.concessionAllowed) {
    return { price: input.standardPrice, kind: "LIST" };
  }
  return {
    price: priceFloor(input.standardPrice, input.minimumPrice, input.discountLimitPercent),
    kind: "CONCESSION",
  };
}

/** Discount only after a list-price offer was refused or the fan objects to price. */
export function concessionAllowedFrom(input: {
  offers: OfferSnapshot[];
  intent: Intent;
}): boolean {
  const last = [...input.offers].reverse().find((o) => o.accepted !== true);
  if (!last) return false;
  const wasList = last.price >= last.listPrice - 0.009;
  if (!wasList) return false;
  return last.accepted === false || input.intent === "PRICE_OBJECTION";
}

export function pricingContextFrom(input: {
  offers: OfferSnapshot[];
  intent: Intent;
}): PricingContext {
  const last = [...input.offers].reverse()[0] ?? null;
  return {
    concessionAllowed: concessionAllowedFrom(input),
    lastOffer: last
      ? {
          productName: last.productName,
          price: last.price,
          listPrice: last.listPrice,
          declined: last.accepted === false,
        }
      : null,
  };
}
