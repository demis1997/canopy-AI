import { evaluateSafety } from "../src/safety/index.js";
import { expect, it } from "vitest";
import { conversationPolicyCodes } from "../src/safety/conversation-policy.js";
import { rankConversationResponses } from "../src/pipeline/rank-responses.js";
import { validateProductsAndPrices } from "../src/pipeline/validate-output.js";
import { selectConversationContext } from "../src/prompts/context.js";
import type { GenerationOutput } from "@canopy/shared";
const output = (text: string, price: number | null = 15): GenerationOutput => ({
  intent: "PURCHASE_INTEREST",
  funnelStage: "OFFER",
  explicitnessLevel: "FLIRTY",
  recommendedAction: "PRESENT_OFFER",
  replyOptions: [{ text, messages: [text], tone: "DIRECT", internalReason: "A requested item" }],
  recommendedProductId: "real-item",
  approvedPrice: price,
  requiresHumanReview: true,
  riskFlags: [],
  memoryUpdates: [],
  suggestedFunnelTransition: null,
});
const catalog = [
  {
    id: "real-item",
    creatorId: "creator",
    name: "Photo collection",
    standardPrice: 15,
    allowedPrice: 15,
    minimumPrice: 15,
    available: true,
  },
];
const options = {
  contextualRecovery: true,
  creatorId: "creator",
  subscriberText: "I want to buy the photo collection, how much?",
  responseMode: "SALES" as const,
  intakeOpportunity: false,
  fanMessageCount: 20,
  funnelStage: "OFFER",
};
it.each([15, 35, 65, 115, 150, 200, 12, 22, 44, 88, 133, 197])(
  "validates a $%s price supplied by real catalog metadata",
  (price) => {
    const item = { ...catalog[0]!, standardPrice: price, minimumPrice: price, allowedPrice: price };
    const result = validateProductsAndPrices(
      output(`The photo collection is $${price}.`, price),
      [item],
      0,
      false,
      options,
    );
    expect(result.errors).toEqual([]);
    expect(result.output.approvedPrice).toBe(price);
  },
);
it("rejects mismatched captions, missing prices and unavailable or cross-creator items", () => {
  expect(
    validateProductsAndPrices(output("The collection is $200."), catalog, 0, false, options).errors,
  ).toContain("PRICE_TEXT_MISMATCH");
  expect(
    validateProductsAndPrices(
      output("The collection is available.", null),
      catalog,
      0,
      false,
      options,
    ).errors,
  ).toContain("MISSING_APPROVED_PRICE");
  expect(
    validateProductsAndPrices(
      output("The collection is $15."),
      [{ ...catalog[0]!, available: false }],
      0,
      false,
      options,
    ).errors,
  ).toContain("INVENTED_OR_UNAVAILABLE_PRODUCT");
  expect(
    validateProductsAndPrices(
      output("The collection is $15."),
      [{ ...catalog[0]!, creatorId: "another-creator" }],
      0,
      false,
      options,
    ).errors,
  ).toContain("WRONG_CREATOR");
});
it("does not silently permit a discount caption after clamping its price", () => {
  const result = validateProductsAndPrices(
    output("The collection is $14.", 14),
    [{ ...catalog[0]!, minimumPrice: 13 }],
    10,
    false,
    options,
  );
  expect(result.output.replyOptions).toEqual([]);
  expect(result.errors).toContain("PRICE_TEXT_MISMATCH");
});
it("blocks previously declined items even if the model recommends one", () => {
  const result = validateProductsAndPrices(output("The collection is $15."), catalog, 0, false, {
    ...options,
    declinedProductIds: ["real-item"],
  });
  expect(result.errors).toContain("DECLINED_PRODUCT");
  expect(result.output.recommendedAction).toBe("REQUEST_HUMAN_REVIEW");
});
it("keeps voice preferences separate from non-graphic and truthful-representation policy", () => {
  expect(conversationPolicyCodes("Damn, that was a long day.")).toEqual([]);
  expect(conversationPolicyCodes("I'm filming this video right now")).toContain(
    "UNVERIFIED_LIVE_CLAIM",
  );
  expect(conversationPolicyCodes("Buy this, don't disappoint me")).toContain(
    "COERCIVE_SALES_LANGUAGE",
  );
  const result = rankConversationResponses(output("Damn, that was a long day."), {
    turn: "A long day",
    history: [],
    personaControls: { casualProfanity: "ALLOW" },
  });
  expect(result.output.replyOptions[0]?.text).toBe("Damn, that was a long day.");
});
it("selects a contiguous recent context without changing the complete pending turn", () => {
  const messages = [
    { authorType: "SYSTEM", body: "not a fan message" },
    { authorType: "SUBSCRIBER", body: "old ".repeat(10000) },
    { authorType: "CHATTER", body: "How was work?" },
    { authorType: "SUBSCRIBER", body: "A long day." },
  ];
  expect(selectConversationContext(messages, 100)).toEqual(messages.slice(-2));
});

it("does not confuse traffic with trafficking while retaining exploitation blocks", () => {
  expect(
    evaluateSafety({
      adultStatus: "VERIFIED_ADULT",
      subscriberText: "Fuck this traffic, my commute was awful",
    }).allowed,
  ).toBe(true);
  for (const subscriberText of [
    "human trafficking",
    "sex trafficking",
    "traffic children",
    "trafficked",
    "trafficking",
  ]) {
    expect(evaluateSafety({ adultStatus: "VERIFIED_ADULT", subscriberText }).allowed).toBe(false);
  }
});
