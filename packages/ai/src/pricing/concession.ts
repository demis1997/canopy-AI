import type { Intent } from "@canopy/shared";
import { ladderPrice, ladderSendAttempt, unpaidOfferCount } from "@canopy/shared";

export type OfferSnapshot = {
  productId: string;
  productName: string;
  price: number;
  listPrice: number;
  accepted: boolean | null;
};

export type ProductLadder = {
  productId: string;
  productName: string;
  sendAttempt: number;
  listPrice: number;
  secondPrice: number;
  minimumPrice: number;
  allowedPrice: number;
  kind: "LIST" | "SECOND" | "MINIMUM";
};

export type PricingContext = {
  concessionAllowed: boolean;
  lastOffer: {
    productName: string;
    price: number;
    listPrice: number;
    declined: boolean;
  } | null;
  ladder: ProductLadder[];
  purchasedPpvCount?: number;
  unansweredFollowUps?: number;
};

export function priceFloor(
  standardPrice: number,
  minimumPrice: number,
  discountLimitPercent: number,
): number {
  return (
    Math.round(Math.max(minimumPrice, standardPrice * (1 - discountLimitPercent / 100)) * 100) / 100
  );
}

export function resolveOfferPrice(input: {
  standardPrice: number;
  minimumPrice: number;
  discountLimitPercent: number;
  concessionAllowed: boolean;
  sendAttempt?: number;
  secondPrice?: number | null;
}): { price: number; kind: "LIST" | "SECOND" | "MINIMUM" | "CONCESSION" } {
  const attempt = input.sendAttempt ?? 1;
  const resolved = ladderPrice({
    standardPrice: input.standardPrice,
    minimumPrice: input.minimumPrice,
    discountLimitPercent: input.discountLimitPercent,
    sendAttempt: attempt,
    secondPrice: input.secondPrice,
  });
  if (resolved.kind === "MINIMUM" && input.concessionAllowed && attempt >= 3) {
    return { price: resolved.price, kind: "CONCESSION" };
  }
  return resolved;
}

/** Discount only after a later PPV sat unpaid and the fan went silent. Never on the first PPV. */
export function concessionAllowedFrom(input: {
  offers: OfferSnapshot[];
  intent: Intent;
  productId?: string;
  unansweredFollowUps?: number;
  purchasedPpvCount?: number;
  standardPrice?: number;
}): boolean {
  const attempt = ladderSendAttempt({
    standardPrice: input.standardPrice ?? 99,
    unansweredFollowUps: input.unansweredFollowUps ?? 0,
    purchasedPpvCount: input.purchasedPpvCount ?? 0,
    offeredUnpaid: input.productId
      ? unpaidOfferCount(input.offers, input.productId) >= 1
      : input.offers.some((o) => o.accepted !== true),
  });
  return attempt >= 2;
}

export function pricingContextFrom(input: {
  offers: OfferSnapshot[];
  intent: Intent;
  products: {
    id: string;
    name: string;
    standardPrice: number;
    minimumPrice: number;
    secondPrice?: number | null;
    discountLimitPercent?: number;
  }[];
  discountLimitPercent?: number;
  unansweredFollowUps?: number;
  purchasedPpvCount?: number;
}): PricingContext {
  const last = [...input.offers].reverse()[0] ?? null;
  const unansweredFollowUps = input.unansweredFollowUps ?? 0;
  const purchasedPpvCount = input.purchasedPpvCount ?? 0;
  const ladder: ProductLadder[] = input.products.map((product) => {
    const discount = product.discountLimitPercent ?? input.discountLimitPercent ?? 10;
    const sendAttempt = ladderSendAttempt({
      standardPrice: product.standardPrice,
      unansweredFollowUps,
      purchasedPpvCount,
      offeredUnpaid: unpaidOfferCount(input.offers, product.id) >= 1,
    });
    const resolved = ladderPrice({
      standardPrice: product.standardPrice,
      minimumPrice: product.minimumPrice,
      discountLimitPercent: discount,
      sendAttempt,
      secondPrice: product.secondPrice,
    });
    return {
      productId: product.id,
      productName: product.name,
      sendAttempt,
      listPrice: product.standardPrice,
      secondPrice: ladderPrice({
        standardPrice: product.standardPrice,
        minimumPrice: product.minimumPrice,
        discountLimitPercent: discount,
        sendAttempt: 2,
        secondPrice: product.secondPrice,
      }).price,
      minimumPrice: product.minimumPrice,
      allowedPrice: resolved.price,
      kind: resolved.kind,
    };
  });
  return {
    concessionAllowed: ladder.some((row) => row.sendAttempt >= 2) || concessionAllowedFrom(input),
    lastOffer: last
      ? {
          productName: last.productName,
          price: last.price,
          listPrice: last.listPrice,
          declined: last.accepted === false,
        }
      : null,
    ladder,
    purchasedPpvCount,
    unansweredFollowUps,
  };
}
