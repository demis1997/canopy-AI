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

function clampBubble(text: string, max = 14): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  return words.slice(0, max).join(" ");
}

function humanize(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.replace(/^(?!i\b)([A-Z])/, (ch) => ch.toLowerCase());
}

function withHook(text: string, index: number): string {
  const clipped = humanize(clampBubble(text)).replace(/[.!?]+$/, "");
  if (/\b(tell me|show me|unlock|say it|wanna|or not)\b/i.test(clipped) || clipped.includes("?")) {
    return clipped;
  }
  const hooks = ["tell me", "or not", "show me", "say it"];
  return `${clipped} ${hooks[index % hooks.length]}`;
}

function asOption(
  bubbles: string[],
  tone: "PLAYFUL" | "ROMANTIC" | "TEASING" | "DOMINANT" | "DIRECT",
  reason: string,
) {
  const messages = bubbles.map((s) => humanize(clampBubble(s))).filter(Boolean).slice(0, 4);
  if (messages.length) {
    messages[messages.length - 1] = withHook(messages[messages.length - 1]!, reason.length);
  }
  return { text: messages.join("\n"), tone, internalReason: reason };
}

function ackFan(last: string): string {
  const t = last.trim();
  if (!t) return "mmm yeah?";
  const snippet = t.replace(/[?!.,]/g, "").split(/\s+/).filter(Boolean).slice(0, 8).join(" ").toLowerCase();
  return snippet ? `hmm ${snippet}` : "hmm i see";
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
        discountLimitPercent: product.discountLimitPercent ?? input.persona.discountLimitPercent,
        concessionAllowed: Boolean(input.pricing?.concessionAllowed),
        sendAttempt: product.sendAttempt,
        secondPrice: product.secondPrice,
      })
    : null;
  const item = product ? catalogName(product.name) : "this set";
  const price = offer?.price ?? product?.standardPrice ?? 25;

  const pitch =
    offer?.kind === "LIST"
      ? `${item} for $${price}`
      : offer?.kind === "SECOND"
        ? `${item} again at $${price}`
        : `${item} at $${price} and that's the floor`;

  const dominant = {
    flirt: ["you think that impresses me", "cute. earn it", `${pitch} if you want more of me`],
    sext: [compliment ?? "nice cock", "kneel", `${pitch} — you dont get the rest for free`],
    sell: ["dont haggle", pitch, "you buying or wasting my time"],
    chat: ["hi. dont be boring", "tell me what you want", pitch],
  };
  const romantic = {
    flirt: [`hi baby that got me${emoji}`, "i'd show you more", `${pitch} if you want it`],
    sext: ["slow down for me", "talk like that", `${pitch} just for you`],
    sell: ["i made this for someone patient", pitch, "you want it"],
    chat: [`hey… i like you already${emoji}`, `${pitch} if you want something mine`],
  };
  const playful = {
    flirt: ["mmm you liked that", `im trouble and you know it${emoji}`, `${pitch} if you want the rest`],
    sext: ["yeah", `tell me what you'd do with this ${body}`, `${pitch} when you cant wait`],
    sell: ["ok you're not subtle", pitch, "teasing or the full thing"],
    chat: ["hey trouble", `say that again and i'll get mean${emoji}`, pitch],
  };
  const voice = style === "DOMINANT" ? dominant : style === "ROMANTIC" ? romantic : playful;
  const tone = (
    style === "DOMINANT" ? "DOMINANT" : style === "ROMANTIC" ? "ROMANTIC" : "PLAYFUL"
  ) as "DOMINANT" | "ROMANTIC" | "PLAYFUL";

  if (input.activeSequence?.current) {
    const current = input.activeSequence.current;
    const beat = current.body;
    const closer =
      current.mediaHint === "PPV" || input.activeSequence.kind === "PPV"
        ? pitch
        : current.mediaHint === "VOICE"
          ? "sending that voice"
          : "want me to keep going";
    return [
      asOption([ackFan(last), beat, closer], tone, "Ack his last line, then only the current sequence beat"),
      asOption(
        [last.trim() ? "wait what" : "mmm", beat],
        "TEASING",
        "Shorter ack then the same beat",
      ),
    ];
  }

  if (intent === "PRICE_OBJECTION") {
    if (offer?.kind === "CONCESSION" && product) {
      return [
        asOption(
          ["okay", `$${price} for ${item}`, "that's the floor — you getting it"],
          "DIRECT",
          "List price already refused; one approved concession",
        ),
        asOption(
          [`$${price} is as low as i go`, `you want ${item} or not`],
          style === "DOMINANT" ? "DOMINANT" : "TEASING",
          "Close at floor",
        ),
      ];
    }
    return [
      asOption(
        ["i hear you", "i don't open with discounts", `${item} is $${product?.standardPrice ?? 25}`],
        "DIRECT",
        "Hold list price",
      ),
      asOption(voice.flirt, "TEASING", "Tease while holding list price"),
    ];
  }

  if (intent === "CONTENT_REQUEST" || intent === "PURCHASE_INTEREST") {
    return [
      asOption(voice.sell, tone, "Answer the ask with a list-price catalog item"),
      asOption(voice.sext, "TEASING", "Keep him hot while selling"),
      asOption(voice.flirt, tone, "Flirt then close"),
    ];
  }

  if (intent === "SEXTING" && explicit) {
    return [
      asOption(voice.sext, "TEASING", "Sext back, then pitch"),
      asOption(voice.sell, tone, "PPV is the payoff"),
      asOption(
        ["fuck keep talking like that", pitch, "when you're done being shy"],
        "DIRECT",
        "Match explicit energy and sell",
      ),
    ];
  }

  return [
    asOption(voice.flirt, tone, "Flirt back and name a real product"),
    asOption(
      last.toLowerCase().includes("hi") ? voice.chat : voice.sell,
      "TEASING",
      "Keep momentum toward a sale",
    ),
    asOption(explicit ? voice.sext : voice.chat, "DIRECT", "Escalate or stay flirty"),
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
          discountLimitPercent: product.discountLimitPercent ?? input.persona.discountLimitPercent,
          concessionAllowed: Boolean(input.pricing?.concessionAllowed),
          sendAttempt: product.sendAttempt,
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
