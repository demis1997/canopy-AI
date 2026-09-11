import type { FunnelStage, MediaType, ProductSource } from "./enums.js";

export type CatalogProduct = {
  id: string;
  creatorId: string;
  organizationId?: string;
  name: string;
  description: string;
  mediaType: MediaType;
  standardPrice: number;
  minimumPrice: number;
  secondPrice?: number | null;
  discountLimitPercent?: number;
  bundlePrice?: number | null;
  tags: string[];
  available: boolean;
  source: ProductSource;
  timesSold: number;
  conversionRate: number;
  lastSyncedAt?: string | null;
  resaleAllowed?: boolean;
  mediaIds: string[];
  previewIds: string[];
  externalId?: string | null;
};

export type EligibilityResult = {
  eligible: CatalogProduct[];
  rejected: { product: CatalogProduct; reason: string }[];
};

export function eligibleProducts(input: {
  products: CatalogProduct[];
  creatorId: string;
  purchasedProductIds: string[];
  funnelStage?: FunnelStage;
}): EligibilityResult {
  const rejected: EligibilityResult["rejected"] = [];
  const eligible: CatalogProduct[] = [];
  for (const product of input.products) {
    if (product.creatorId !== input.creatorId) {
      rejected.push({ product, reason: "WRONG_CREATOR" });
      continue;
    }
    if (!product.available) {
      rejected.push({ product, reason: "UNAVAILABLE" });
      continue;
    }
    if (input.purchasedProductIds.includes(product.id) && !product.resaleAllowed) {
      rejected.push({ product, reason: "ALREADY_PURCHASED" });
      continue;
    }
    eligible.push(product);
  }
  return { eligible, rejected };
}

export type ProductValidationCheck = {
  exists: boolean;
  correctCreator: boolean;
  available: boolean;
  notAlreadyPurchased: boolean;
  priceInRange: boolean;
};

export function validateRecommendedOffer(input: {
  product: CatalogProduct | undefined;
  creatorId: string;
  purchasedProductIds: string[];
  recommendedPrice: number | null;
  concessionAllowed?: boolean;
}): { ok: boolean; checks: ProductValidationCheck; errors: string[] } {
  const product = input.product;
  const checks: ProductValidationCheck = {
    exists: Boolean(product),
    correctCreator: product?.creatorId === input.creatorId,
    available: Boolean(product?.available),
    notAlreadyPurchased: product
      ? !input.purchasedProductIds.includes(product.id) || Boolean(product.resaleAllowed)
      : false,
    priceInRange: false,
  };
  const errors: string[] = [];
  if (!checks.exists) errors.push("INVENTED_OR_UNAVAILABLE_PRODUCT");
  if (product && !checks.correctCreator) errors.push("WRONG_CREATOR");
  if (product && !checks.available) errors.push("UNAVAILABLE");
  if (product && !checks.notAlreadyPurchased) errors.push("ALREADY_PURCHASED");
  if (product && input.recommendedPrice != null) {
    const floor = input.concessionAllowed ? product.minimumPrice : product.standardPrice;
    checks.priceInRange =
      input.recommendedPrice + 0.009 >= floor &&
      input.recommendedPrice - 0.009 <= product.standardPrice;
    if (!checks.priceInRange) errors.push("UNAUTHORISED_PRICE");
  } else if (product && input.recommendedPrice == null) {
    checks.priceInRange = true;
  }
  return { ok: errors.length === 0, checks, errors };
}

export const CSV_PRODUCT_COLUMNS = [
  "external_id",
  "creator",
  "name",
  "description",
  "content_type",
  "standard_price",
  "minimum_price",
  "discount_limit_percent",
  "tags",
  "media_reference",
  "preview_reference",
  "availability",
] as const;

export type CsvProductRow = {
  external_id: string;
  creator: string;
  name: string;
  description: string;
  content_type: string;
  standard_price: number;
  minimum_price: number;
  discount_limit_percent: number;
  tags: string[];
  media_reference: string;
  preview_reference: string;
  availability: boolean;
  errors: string[];
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseProductCsv(text: string): CsvProductRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (name: string) => header.indexOf(name);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const errors: string[] = [];
    const content = (cols[idx("content_type")] ?? "").toUpperCase();
    const standard = Number(cols[idx("standard_price")]);
    const minimum = Number(cols[idx("minimum_price")]);
    const name = cols[idx("name")] ?? "";
    const creator = cols[idx("creator")] ?? "";
    if (!name) errors.push("Missing name");
    if (!creator) errors.push("Missing creator");
    if (!["PHOTO", "VIDEO", "AUDIO", "TEXT", "BUNDLE", "CUSTOM"].includes(content)) {
      errors.push("Invalid content_type");
    }
    if (!Number.isFinite(standard) || standard <= 0) errors.push("Invalid standard_price");
    if (!Number.isFinite(minimum) || minimum <= 0) errors.push("Invalid minimum_price");
    if (Number.isFinite(standard) && Number.isFinite(minimum) && minimum > standard) {
      errors.push("minimum_price exceeds standard_price");
    }
    const discountIdx = idx("discount_limit_percent");
    const discount = discountIdx >= 0 ? Number(cols[discountIdx]) : 10;
    if (discountIdx >= 0 && (!Number.isFinite(discount) || discount < 0 || discount > 100)) {
      errors.push("Invalid discount_limit_percent");
    }
    const availabilityRaw = (cols[idx("availability")] ?? "true").toLowerCase();
    return {
      external_id: cols[idx("external_id")] ?? "",
      creator,
      name,
      description: cols[idx("description")] ?? "",
      content_type: content,
      standard_price: standard,
      minimum_price: minimum,
      discount_limit_percent: Number.isFinite(discount) ? discount : 10,
      tags: (cols[idx("tags")] ?? "").split("|").map((t) => t.trim()).filter(Boolean),
      media_reference: cols[idx("media_reference")] ?? "",
      preview_reference: cols[idx("preview_reference")] ?? "",
      availability: availabilityRaw !== "false" && availabilityRaw !== "0",
      errors,
    };
  });
}
