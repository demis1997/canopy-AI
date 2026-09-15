import { NextResponse } from "next/server";
import { z } from "zod";
import {
  eligibleProducts,
  generationOutputSchema,
  validateRecommendedOffer,
  type CatalogProduct,
} from "@canopy/shared";
import { MockLLMProvider, PROMPT_VERSION, validateProductsAndPrices } from "@canopy/ai";

const bodySchema = z.object({
  creatorId: z.string(),
  subscriberMessage: z.string(),
  recentMessages: z.array(z.object({ authorType: z.string(), body: z.string() })),
  funnelStage: z.enum(["NEW_FAN", "RAPPORT", "INTEREST", "OFFER", "OBJECTION", "PURCHASE", "FOLLOW_UP"]),
  purchasedProductIds: z.array(z.string()).default([]),
  products: z.array(
    z.object({
      id: z.string(),
      creatorId: z.string(),
      name: z.string(),
      description: z.string(),
      mediaType: z.enum(["PHOTO", "VIDEO", "AUDIO", "TEXT", "BUNDLE", "CUSTOM"]),
      standardPrice: z.number(),
      minimumPrice: z.number(),
      bundlePrice: z.number().nullable().optional(),
      tags: z.array(z.string()),
      available: z.boolean(),
      source: z.enum(["DEMO_SEED", "MANUAL", "CSV_IMPORT", "MEDIA_UPLOAD", "PLATFORM_VAULT_SYNC"]),
      timesSold: z.number(),
      conversionRate: z.number(),
      mediaIds: z.array(z.string()),
      previewIds: z.array(z.string()),
      externalId: z.string().nullable().optional(),
      resaleAllowed: z.boolean().optional(),
    }),
  ),
  persona: z.object({
    displayName: z.string(),
    style: z.string(),
    personality: z.string().optional(),
  }),
  toneOverride: z.enum(["PLAYFUL", "ROMANTIC", "TEASING", "DOMINANT", "SUBMISSIVE", "DIRECT"]).optional(),
  concessionAllowed: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const catalog: CatalogProduct[] = body.products;
  const { eligible, rejected } = eligibleProducts({
    products: catalog,
    creatorId: body.creatorId,
    purchasedProductIds: body.purchasedProductIds,
    funnelStage: body.funnelStage,
  });
  const mock = new MockLLMProvider();
  const classified = await mock.classifyIntent({
    message: body.subscriberMessage,
    recentContext: body.recentMessages.map((m) => `${m.authorType}: ${m.body}`).join("\n"),
    funnelStage: body.funnelStage,
    requestId: "demo",
  });
  const result = await mock.generateReplies({
    requestId: "demo-gen",
    model: "demo-model",
    promptVersionId: PROMPT_VERSION,
    persona: {
      displayName: body.persona.displayName,
      biography: "",
      authorisedBackstory: "",
      personality: body.persona.personality ?? body.persona.style,
      tone: body.persona.style,
      typicalMessageLength: "SHORT",
      preferredEmojis: ["😏"],
      frequentlyUsedPhrases: [],
      preferredExplicitVocabulary: [],
      prohibitedWords: [],
      preferredCompliments: [],
      allowedExplicitness: "SUGGESTIVE",
      style: body.persona.style.includes("Dominant") ? "DOMINANT" : body.persona.style.includes("Romantic") ? "ROMANTIC" : "PLAYFUL",
      interests: [],
      contentBoundaries: [],
      claimsNeverToMake: [],
      customContentRules: "",
      offlineMeetingPolicy: "Never arrange offline meetings.",
      discountLimitPercent: 20,
      approvedExampleMessages: [],
    },
    recentMessages: body.recentMessages,
    memories: [],
    products: eligible.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      standardPrice: p.standardPrice,
      minimumPrice: p.minimumPrice,
      available: p.available,
      explicitnessCategory: "SUGGESTIVE",
    })),
    funnelStage: body.funnelStage,
    playbook: "PRESENTING_PPV",
    retrievedExamples: ["Tease then name a real catalog item at list price."],
    toneOverride: body.toneOverride,
    pricing: { concessionAllowed: Boolean(body.concessionAllowed), lastOffer: null, ladder: [] },
  });
  const validated = validateProductsAndPrices(
    result.output,
    eligible.map((p) => ({
      id: p.id,
      name: p.name,
      standardPrice: p.standardPrice,
      minimumPrice: p.minimumPrice,
      available: p.available,
      creatorId: p.creatorId,
      resaleAllowed: p.resaleAllowed,
    })),
    20,
    Boolean(body.concessionAllowed),
    { creatorId: body.creatorId, purchasedProductIds: body.purchasedProductIds, subscriberText: body.subscriberMessage },
  );
  const schemaCheck = generationOutputSchema.safeParse(validated.output);
  const product = eligible.find((p) => p.id === validated.output.recommendedProductId);
  const offerCheck = validateRecommendedOffer({
    product,
    creatorId: body.creatorId,
    purchasedProductIds: body.purchasedProductIds,
    recommendedPrice: validated.output.approvedPrice,
    concessionAllowed: Boolean(body.concessionAllowed),
  });
  return NextResponse.json({
    mockMode: true,
    promptVersion: PROMPT_VERSION,
    model: "Demo model",
    intent: classified.intent,
    funnelStage: validated.output.funnelStage,
    recommendedAction: validated.output.recommendedAction,
    riskFlags: validated.output.riskFlags,
    validationErrors: validated.errors,
    schemaValid: schemaCheck.success,
    eligibleProductIds: eligible.map((p) => p.id),
    rejected: rejected.map((r) => ({ id: r.product.id, reason: r.reason })),
      suggestions: validated.output.replyOptions.map((opt, i) => ({
      id: `sug_${i}`,
      text: opt.text,
      messages: opt.messages,
      tone: opt.tone,
      recommendedAction: validated.output.recommendedAction,
      productId: validated.output.recommendedProductId,
      price: validated.output.approvedPrice,
      internalReason: opt.internalReason,
    })),
    product: product
      ? {
          id: product.id,
          externalId: product.externalId,
          source: product.source,
          creatorId: product.creatorId,
          standardPrice: product.standardPrice,
          minimumPrice: product.minimumPrice,
          recommendedPrice: validated.output.approvedPrice,
          checks: offerCheck.checks,
          mediaIds: product.mediaIds,
          previewIds: product.previewIds,
        }
      : null,
  });
}
