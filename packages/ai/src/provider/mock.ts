import { randomUUID } from "node:crypto";
import type { FunnelStage, Intent } from "@canopy/shared";
import { generationOutputSchema } from "@canopy/shared";
import { ProviderError } from "./errors.js";
import { resolveOfferPrice } from "../pricing/concession.js";
import type {
  AvailableModel,
  ClassificationInput,
  ConversationSummaryResult,
  GenerationInput,
  GenerationResult,
  IntentResult,
  LLMProvider,
  MemoryExtractionInput,
  MemoryExtractionResult,
  ProviderHealth,
  SummaryInput,
} from "./types.js";

function classify(text: string, context = ""): Intent {
  const t = text.toLowerCase();
  if (/\b(refund|chargeback|scam)\b/.test(t)) return "REFUND";
  if (/\b(complaint|manager|report you)\b/.test(t)) return "COMPLAINT";
  if (/\b(too much|cheaper|discount|too expensive|\d+\s*(usd|\$))\b/.test(t)) return "PRICE_OBJECTION";
  if (/\b(buy|ppv|video|pic|pics|custom|send it|send me|show me)\b/.test(t)) return "CONTENT_REQUEST";
  if (/\b(cock|pussy|fuck|suck|cum|hard|wet|horny|stroke|dick)\b/.test(t)) return "SEXTING";
  if (/\b(sexy|hot|cute|beautiful|gorgeous|pretty|damn|story)\b/.test(t)) return "FLIRT";
  const blob = `${t} ${context.toLowerCase()}`;
  if (/\b(cock|pussy|fuck|hard|wet|horny)\b/.test(blob)) return "SEXTING";
  if (/\b(sexy|hot|cute|beautiful|hey|hi)\b/.test(blob)) return "FLIRT";
  return "CASUAL_CHAT";
}

function clampChat(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 32) return text.trim();
  return `${words.slice(0, 30).join(" ")}?`;
}

function withQuestion(text: string): string {
  if (text.includes("?")) return clampChat(text);
  return clampChat(`${text.replace(/[.!]*$/, "")}?`);
}

function catalogName(name: string): string {
  return name.replace(/\s*\(DEMO\)\s*/gi, "").trim();
}

function pickProduct(input: GenerationInput, intent: Intent) {
  const available = input.products.filter((p) => p.available);
  if (intent === "SEXTING" || intent === "CONTENT_REQUEST") {
    return (
      available.find(
        (p) => p.explicitnessCategory === "EXPLICIT" || p.explicitnessCategory === "VERY_EXPLICIT",
      ) ?? available[0]
    );
  }
  return available[0];
}

function emojiOf(input: GenerationInput): string {
  const e = input.persona.preferredEmojis[0];
  if (!e || e === "—") return "";
  return ` ${e}`;
}

function repliesFor(input: GenerationInput, intent: Intent) {
  const last =
    input.recentMessages.filter((m) => m.authorType === "SUBSCRIBER").at(-1)?.body ?? "";
  const explicit =
    input.persona.allowedExplicitness === "EXPLICIT" ||
    input.persona.allowedExplicitness === "VERY_EXPLICIT";
  const body = input.persona.preferredExplicitVocabulary[0] ?? "cock";
  const compliment = input.persona.preferredCompliments[0];
  const product = pickProduct(input, intent);
  const style = input.persona.style;
  const emoji = emojiOf(input);
  const offer = product
    ? resolveOfferPrice({
        standardPrice: product.standardPrice,
        minimumPrice: product.minimumPrice,
        discountLimitPercent: input.persona.discountLimitPercent,
        concessionAllowed: Boolean(input.pricing?.concessionAllowed),
      })
    : null;
  const item = product ? catalogName(product.name) : "this set";
  const price = offer?.price ?? product?.standardPrice ?? 25;

  const pitch =
    offer?.kind === "CONCESSION"
      ? `${item} at $${price} and that's the floor`
      : `${item} for $${price}`;

  const dominant = {
    flirt: withQuestion(
      `you think that impresses me? cute. earn it. ${pitch} if you want more of me`,
    ),
    sext: withQuestion(
      `${compliment ?? "nice cock"}. kneel. ${pitch} — you don't get the rest for free`,
    ),
    sell: withQuestion(`don't haggle. ${pitch}. you buying or wasting my time`),
    chat: withQuestion(`hi. don't be boring. tell me what you want while ${pitch}`),
  };
  const romantic = {
    flirt: withQuestion(`hi baby that got me${emoji} i'd show you more — ${pitch} if you want it`),
    sext: withQuestion(`slow down for me… talk like that and ${pitch} just for you`),
    sell: withQuestion(`i made this for someone patient. ${pitch}. you want it`),
    chat: withQuestion(`hey… i like you already${emoji} ${pitch} if you want something mine`),
  };
  const playful = {
    flirt: withQuestion(
      `mmm you liked that? i'm trouble and you know it${emoji} ${pitch} if you want the rest`,
    ),
    sext: withQuestion(
      `yeah? tell me what you'd do with this ${body}. ${pitch} when you can't wait`,
    ),
    sell: withQuestion(`ok you're not subtle. ${pitch} — teasing or the full thing`),
    chat: withQuestion(`hey trouble. say that again and i'll get mean${emoji} ${pitch}`),
  };
  const voice = style === "DOMINANT" ? dominant : style === "ROMANTIC" ? romantic : playful;
  const tone = (
    style === "DOMINANT" ? "DOMINANT" : style === "ROMANTIC" ? "ROMANTIC" : "PLAYFUL"
  ) as "DOMINANT" | "ROMANTIC" | "PLAYFUL";

  if (intent === "PRICE_OBJECTION") {
    if (offer?.kind === "CONCESSION" && product) {
      return [
        {
          text: withQuestion(`okay. $${price} for ${item} and that's the floor — you getting it`),
          tone: "DIRECT" as const,
          internalReason: "List price already refused; one approved concession",
        },
        {
          text: withQuestion(`$${price} is as low as i go. you want ${item} or not`),
          tone: style === "DOMINANT" ? ("DOMINANT" as const) : ("TEASING" as const),
          internalReason: "Close at floor",
        },
      ];
    }
    return [
      {
        text: withQuestion(
          `i hear you but i don't open with discounts. ${item} is $${product?.standardPrice ?? 25}`,
        ),
        tone: "DIRECT" as const,
        internalReason: "Hold list price",
      },
      {
        text: voice.flirt,
        tone: "TEASING" as const,
        internalReason: "Tease while holding list price",
      },
    ];
  }

  if (intent === "CONTENT_REQUEST" || intent === "PURCHASE_INTEREST") {
    return [
      { text: voice.sell, tone, internalReason: "Answer the ask with a list-price catalog item" },
      { text: voice.sext, tone: "TEASING" as const, internalReason: "Keep him hot while selling" },
      { text: voice.flirt, tone, internalReason: "Flirt then close" },
    ];
  }

  if (intent === "SEXTING" && explicit) {
    return [
      { text: voice.sext, tone: "TEASING" as const, internalReason: "Sext back, then pitch" },
      { text: voice.sell, tone, internalReason: "PPV is the payoff" },
      {
        text: withQuestion(`fuck keep talking like that. ${pitch} when you're done being shy`),
        tone: "DIRECT" as const,
        internalReason: "Match explicit energy and sell",
      },
    ];
  }

  return [
    { text: voice.flirt, tone, internalReason: "Flirt back and name a real product" },
    {
      text: last.toLowerCase().includes("hi") ? voice.chat : voice.sell,
      tone: "TEASING" as const,
      internalReason: "Keep momentum toward a sale",
    },
    {
      text: explicit ? voice.sext : voice.chat,
      tone: "DIRECT" as const,
      internalReason: "Escalate or stay flirty",
    },
  ];
}

export class MockLLMProvider implements LLMProvider {
  readonly labelled = true;

  async listModels(): Promise<AvailableModel[]> {
    return [
      {
        id: "mock-qwen3-32b-uncensored",
        name: "Mock Qwen 32B uncensored (local mock — not Venice)",
        uncensored: true,
        recommended: true,
        parameterHint: "32B",
      },
      {
        id: "mock-classifier",
        name: "Mock classifier (local mock — not Venice)",
        uncensored: false,
        recommended: false,
      },
    ];
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, latencyMs: 3, requestId: randomUUID() };
  }

  async classifyIntent(input: ClassificationInput): Promise<IntentResult> {
    return {
      intent: classify(input.message, input.recentContext),
      confidence: 0.7,
      latencyMs: 4,
      model: "mock-classifier",
    };
  }

  async generateReplies(input: GenerationInput): Promise<GenerationResult> {
    if (input.model === "force-invalid-json") {
      throw new ProviderError("Invalid JSON from provider", "INVALID_JSON", 502, input.requestId);
    }
    const last = input.recentMessages.filter((m) => m.authorType === "SUBSCRIBER").at(-1)?.body ?? "";
    const intent = classify(
      last,
      input.recentMessages.map((m) => m.body).join(" "),
    );
    const product = pickProduct(input, intent) ?? null;
    const pitching = intent !== "COMPLAINT" && intent !== "REFUND" && intent !== "UNSAFE";
    const offer = product
      ? resolveOfferPrice({
          standardPrice: product.standardPrice,
          minimumPrice: product.minimumPrice,
          discountLimitPercent: input.persona.discountLimitPercent,
          concessionAllowed: Boolean(input.pricing?.concessionAllowed),
        })
      : null;
    const output = generationOutputSchema.parse({
      intent,
      funnelStage: input.funnelStage,
      explicitnessLevel: input.persona.allowedExplicitness,
      recommendedAction:
        intent === "PRICE_OBJECTION"
          ? "ANSWER_OBJECTION"
          : pitching
            ? "PRESENT_OFFER"
            : "REPLY",
      replyOptions: repliesFor(input, intent),
      recommendedProductId: pitching ? (product?.id ?? null) : null,
      approvedPrice: pitching ? (offer?.price ?? product?.standardPrice ?? null) : null,
      requiresHumanReview: true,
      riskFlags: [],
      memoryUpdates: [],
      suggestedFunnelTransition: (pitching ? "OFFER" : input.funnelStage) as FunnelStage,
    });
    return {
      output,
      rawText: JSON.stringify(output),
      latencyMs: 12,
      promptTokens: 400,
      completionTokens: 180,
      model: "mock-qwen3-32b-uncensored",
      requestId: input.requestId,
      repaired: false,
    };
  }

  async summarizeConversation(input: SummaryInput): Promise<ConversationSummaryResult> {
    const last = input.messages.at(-1)?.body ?? "";
    return {
      summary: `Rolling summary (mock): ${input.messages.length} messages. Latest fan direction: ${last.slice(0, 80)}`,
      latencyMs: 5,
      promptTokens: 100,
      completionTokens: 40,
    };
  }

  async extractMemories(input: MemoryExtractionInput): Promise<MemoryExtractionResult> {
    const fan = input.messages.filter((m) => m.authorType === "SUBSCRIBER").at(-1);
    if (!fan) return { updates: [], latencyMs: 2 };
    return {
      updates: [
        {
          category: "LAST_INTERACTION",
          key: "last_fan_message",
          value: "Subscriber messaged (value stored separately from raw log redaction)",
          confidence: 0.9,
          sourceMessageId: fan.id,
        },
      ],
      latencyMs: 3,
    };
  }
}
