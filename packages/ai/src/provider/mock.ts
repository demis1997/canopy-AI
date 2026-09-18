import { randomUUID } from "node:crypto";
import type { FunnelStage, Intent } from "@canopy/shared";
import { generationOutputSchema, looksLikeOfflineAsk, looksLikeFanInvitesQuestions, looksLikeAreYouReal, looksLikeAgeAsk, looksLikeConfirmedInventedAboutHimCallout, looksLikeMixupCalloutLanguage, looksLikeDirectCreatorQuestion, looksLikeLocationAsk, looksLikePetNamePushback, looksLikeTeaseAsk, looksLikeRefundCallout, looksLikeWhatsWrongFollowup, looksLikeRelationshipAsk, wantsNoPitch, bannedCatalogNames, creatorAgeFromText, creatorCityFromText, ageReplyVariants, locationReplyVariants, teaseReplyVariants, areYouRealReplyVariants, relationshipReplyVariants, inventedAboutHimReplyVariants, MIXUP_CLARIFY_VARIANTS, threadIsOnOfflineAsk, pitchIsTooEarly, inferFanIntake, shouldRunFanIntake, intakeComplete, rotateVariants, matchSellTarget, extractFanFacts, AFTERCARE_QUOTES, TOS_OFFLINE_VARIANTS, PET_NAME_PUSHBACK_VARIANTS, REFUND_CALLOUT_VARIANTS, tooSimilar, pickFreshVariants, RAPPORT_ONLY_VARIANTS, looksLikeWaitingForReveal, looksLikeProveYourselfAsk, looksLikeAffirm, FAN_DOMINANT_FOLLOW_VARIANTS, looksLikeTellHook } from "@canopy/shared";
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
  if (/\b(refund|chargeback|scam)\b/.test(t) && !/\b(robot|bot|model)\b/.test(t)) return "REFUND";
  if (/\b(complaint|manager|report you)\b/.test(t)) return "COMPLAINT";
  if (/\b(too much|cheaper|discount|too expensive|\d+\s*(usd|\$))\b/.test(t)) return "PRICE_OBJECTION";
  if (/\b(buy|ppv|video|pic|pics|custom|send it|send me|show me|got anything|clip|joi|gfe|lingerie|girlcock|dildo|netflix|fleshlight|\bass\b|tits|boobs|feet)\b/.test(t)) return "CONTENT_REQUEST";
  if (/\b(tease me|then do it|combination of both)\b/.test(t)) return "SEXTING";
  if (/\b(cock|pussy|fuck|suck|cum|hard|wet|horny|stroke|dick)\b/.test(t)) return "SEXTING";
  if (/\b(sexy|hot|cute|beautiful|gorgeous|pretty|damn|story)\b/.test(t)) return "FLIRT";
  void context;
  return "CASUAL_CHAT";
}

function clampBubble(text: string, max = 20): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  return words.slice(0, max).join(" ");
}

function humanize(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.replace(/^([A-Z])/, (ch) => ch.toLowerCase());
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
  const messages = bubbles.map((s) => humanize(clampBubble(s))).filter(Boolean).slice(0, 3);
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
  const banned = new Set(bannedCatalogNames(input.operatorRejections ?? [], input.products).ids);
  const available = input.products.filter((p) => p.available && !banned.has(p.id));
  if (input.sellTarget) {
    const pinned = available.find((p) => p.id === input.sellTarget?.productId);
    if (pinned) return pinned;
  }
  const matched = matchSellTarget({
    products: available,
    subscriberTexts: input.recentMessages.filter((m) => m.authorType === "SUBSCRIBER").map((m) => m.body),
    notes: input.fanNotes?.notes,
    memories: input.memories.map((m) => m.value),
    sequenceProductId: input.activeSequence?.current.productId,
  });
  if (matched) return available.find((p) => p.id === matched.product.id) ?? available[0];
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

function repliesFor(input: GenerationInput, intent: Intent, pitching: boolean) {
  const last =
    input.recentMessages.filter((m) => m.authorType === "SUBSCRIBER").at(-1)?.body ?? "";
  if (input.followUpPhase === "AFTERCARE" || input.playbook === "AFTERCARE") {
    return [
      asOption(AFTERCARE_QUOTES, "ROMANTIC", "Aftercare after three sequence products"),
      asOption(AFTERCARE_QUOTES.slice(0, 2), "PLAYFUL", "Shorter aftercare"),
    ];
  }
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
      ? `this ppv ${item} for $${price}`
      : offer?.kind === "SECOND"
        ? `this ppv again at $${price}`
        : `${item} at $${price} and thats the floor`;

  const dominant = {
    flirt: ["you think that impresses me", "cute. earn it", `${pitch} if you want more of me`],
    sext: [compliment ?? "nice cock", "kneel", `${pitch} — you dont get the rest for free`],
    sell: ["dont haggle", pitch, "you buying or wasting my time"],
    chat: ["hi. dont be boring", "tell me what you want", pitch],
  };
  const romantic = {
    flirt: [`hi babe that got me${emoji}`, "i'd show you more", `${pitch} if you want it`],
    sext: ["slow down for me", "talk like that", `${pitch} just for you`],
    sell: ["i made this for someone patient", pitch, "you want it"],
    chat: [`hey i like you already${emoji}`, `${pitch} if you want something mine`],
  };
  const playful = {
    flirt: ["mmm you liked that", `im trouble and you know it${emoji}`, `${pitch} if you want the rest`],
    sext: ["yeah", `tell me what you'd do with this ${body}`, `${pitch} when you cant wait`],
    sell: ["ok ure not subtle", pitch, "teasing or the full ppv"],
    chat: ["heellooo", `say that again and ill get mean${emoji}`, pitch],
  };
  const voice = style === "DOMINANT" ? dominant : style === "ROMANTIC" ? romantic : playful;
  const tone = (
    style === "DOMINANT" ? "DOMINANT" : style === "ROMANTIC" ? "ROMANTIC" : "PLAYFUL"
  ) as "DOMINANT" | "ROMANTIC" | "PLAYFUL";

  if (looksLikeOfflineAsk(last)) {
    const rotated = rotateVariants(TOS_OFFLINE_VARIANTS, input.requestId);
    return rotated.slice(0, 3).map((text, i) =>
      asOption(text.split("\n"), i === 0 ? "DIRECT" : "PLAYFUL", "TOS offline refusal without banned words"),
    );
  }

  if (looksLikeAreYouReal(last) || looksLikeWhatsWrongFollowup(last)) {
    return rotateVariants(areYouRealReplyVariants(Boolean(input.fanSentPics)), input.requestId)
      .slice(0, 3)
      .map((text, i) => asOption(text.split("\n"), i === 0 ? "DIRECT" : tone, "Flip the are-you-real ask"));
  }

  if (looksLikePetNamePushback(last)) {
    return PET_NAME_PUSHBACK_VARIANTS.map((text, i) =>
      asOption(text.split("\n"), i === 0 ? "DIRECT" : tone, "Drop the pet name"),
    );
  }

  if (looksLikeRefundCallout(last)) {
    return REFUND_CALLOUT_VARIANTS.map((text, i) =>
      asOption(text.split("\n"), i === 0 ? "DIRECT" : tone, "Do not double down on an invented refund"),
    );
  }

  if (looksLikeTeaseAsk(last)) {
    const trans = /\b(girlcock|tgirl|trans girl)\b/i.test(
      `${input.persona.biography} ${input.persona.authorisedBackstory} ${input.persona.preferredExplicitVocabulary.join(" ")}`,
    );
    return rotateVariants(teaseReplyVariants(trans), input.requestId).slice(0, 3).map((text, i) =>
      asOption(text.split("\n"), "TEASING", "Actually tease, do not talk about teasing"),
    );
  }

  const mixup = looksLikeConfirmedInventedAboutHimCallout({
    subscriberText: last,
    recentMessages: input.recentMessages,
  });
  if (mixup.matched) {
    return inventedAboutHimReplyVariants(mixup.aboutMe).map((text, i) =>
      asOption(text.split("\n"), i === 0 ? "DIRECT" : tone, "Confirmed mixup about him"),
    );
  }
  if (looksLikeMixupCalloutLanguage(last) && !looksLikeDirectCreatorQuestion(last)) {
    return MIXUP_CLARIFY_VARIANTS.map((text, i) =>
      asOption(text.split("\n"), i === 0 ? "DIRECT" : tone, "Unconfirmed mixup — ask what he means"),
    );
  }

  if (
    shouldRunFanIntake({
      funnelStage: input.funnelStage,
      intent,
      purchasedPpvCount: input.pricing?.purchasedPpvCount,
      subscriberText: last,
      sequenceKind: input.activeSequence?.kind,
      intakeComplete: intakeComplete({
        extra: input.fanNotes?.extra,
        location: input.fanNotes?.location,
        notes: input.fanNotes?.notes,
        dominance: input.fanNotes?.dominance,
        boughtWelcome: input.boughtWelcome,
      }),
    }) &&
    !looksLikeOfflineAsk(last)
  ) {
    const intake = inferFanIntake({
      subscriberText: last,
      recentMessages: input.recentMessages,
      fanNotes: input.fanNotes,
      subscriberName: input.fanNotes?.realName,
      creatorAge: creatorAgeFromText(input.persona.biography, input.persona.authorisedBackstory),
      creatorCity: creatorCityFromText(input.persona.biography, input.persona.authorisedBackstory),
      boughtWelcome: input.boughtWelcome,
      existingFan: input.existingFan,
      productsPurchased: input.pricing?.purchasedPpvCount,
      unpaidProductId: input.unpaidLockedCount ? "unpaid" : undefined,
      allowedSkipToNextProduct: false,
    });
    if (intake) {
      return intake.variants.map((text, i) =>
        asOption(text.split("\n"), i === 0 ? tone : "TEASING", `Fan intake ${intake.id}`),
      );
    }
  }

  if (looksLikeRelationshipAsk(last)) {
    return rotateVariants(relationshipReplyVariants(), input.requestId).slice(0, 3).map((text, i) =>
      asOption(text.split("\n"), i === 0 ? tone : "PLAYFUL", "Answer HER relationship status"),
    );
  }

  if (looksLikeAgeAsk(last)) {
    const age = creatorAgeFromText(input.persona.biography, input.persona.authorisedBackstory);
    const variants = ageReplyVariants(age);
    return [
      asOption(variants[0]!.split("\n"), tone, "Answer HER age not his"),
      asOption((variants[1] ?? variants[0]!).split("\n"), "TEASING", "Short age answer"),
    ];
  }

  if (looksLikeLocationAsk(last)) {
    const city = creatorCityFromText(input.persona.biography, input.persona.authorisedBackstory);
    return rotateVariants(locationReplyVariants(city), input.requestId).map((text, i) =>
      asOption(text.split("\n"), i === 0 ? tone : "TEASING", "Answer HER city not his"),
    );
  }

  if (looksLikeFanInvitesQuestions(last)) {
    return [
      asOption(["mmm lots", "start with what u do for fun"], tone, "He invited questions about himself"),
      asOption(["ok then", "tell me something u never told a girl on here"], "TEASING", "Ask about him"),
    ];
  }

  if (looksLikeWaitingForReveal(last)) {
    return teaseReplyVariants(Boolean(input.persona.preferredExplicitVocabulary.length)).slice(0, 2).map((text, i) =>
      asOption(text.split("\n"), i === 0 ? tone : "TEASING", "He asked what you were going to tell him — actually tease"),
    );
  }

  const lastUs = [...input.recentMessages].reverse().find((message) => message.authorType !== "SUBSCRIBER")?.body ?? "";
  if (looksLikeProveYourselfAsk(lastUs) && looksLikeAffirm(last)) {
    return FAN_DOMINANT_FOLLOW_VARIANTS.map((text, i) =>
      asOption(text.split("\n"), i === 0 ? "TEASING" : tone, "He is in charge — let him lead"),
    );
  }

  if (input.activeSequence?.current) {
    const current = input.activeSequence.current;
    const beat = current.body;
    const closer =
      pitching && (current.mediaHint === "PPV" || input.activeSequence.kind === "PPV")
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

  if (!pitching) {
    const recentUs = input.recentMessages.filter((message) => message.authorType !== "SUBSCRIBER").map((message) => message.body);
    const pool = recentUs.some(looksLikeTellHook) || looksLikeWaitingForReveal(last)
      ? teaseReplyVariants(Boolean(input.persona.preferredExplicitVocabulary.length))
      : pickFreshVariants(RAPPORT_ONLY_VARIANTS, recentUs, input.requestId).filter((text) => !looksLikeTellHook(text) || !recentUs.some(looksLikeTellHook));
    const lines = (pool.length ? pool : RAPPORT_ONLY_VARIANTS.slice(1)).slice(0, 2);
    return lines.map((text, i) =>
      asOption(text.split("\n"), i === 0 ? tone : "TEASING", "Ack then advance without recycling the same hook"),
    );
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

function withoutRejectedDrafts(
  options: ReturnType<typeof asOption>[],
  input: GenerationInput,
  last: string,
): ReturnType<typeof asOption>[] {
  const banned = (input.operatorRejections ?? []).map((row) => row.text).filter((text) => text.trim().length > 8);
  if (!banned.length) return options;
  return options.map((option, i) => {
    if (!banned.some((draft) => tooSimilar(option.text, draft))) return option;
    return asOption([ackFan(last), "got it i wont do that again"], i === 0 ? "PLAYFUL" : "DIRECT", "Avoided a rejected draft");
  });
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
    const last =
      input.latestFanTurn?.split("\n").filter(Boolean).at(-1)?.replace(/^[^:]+:\s*/, "") ??
      input.recentMessages.filter((m) => m.authorType === "SUBSCRIBER").at(-1)?.body ??
      "";
    if (input.responseMode === "OPERATIONAL" || input.responseMode === "SUPPORT") {
      return {
        output: generationOutputSchema.parse({
          intent: "UNCERTAIN",
          funnelStage: input.funnelStage,
          explicitnessLevel: "SUGGESTIVE",
          recommendedAction: "REQUEST_HUMAN_REVIEW",
          replyOptions: [
            {
              text: "a human needs to take this from here",
              messages: ["a human needs to take this from here"],
              tone: "DIRECT",
              internalReason: "operational review",
            },
          ],
          recommendedProductId: null,
          approvedPrice: null,
          requiresHumanReview: true,
          riskFlags: [input.operationalIntent ?? "OPERATIONAL"],
          memoryUpdates: [],
          suggestedFunnelTransition: null,
        }),
        rawText: "",
        latencyMs: 5,
        promptTokens: 0,
        completionTokens: 0,
        model: "mock",
        requestId: input.requestId,
        repaired: false,
      };
    }
    const intent = classify(
      last,
      input.recentMessages.map((m) => m.body).join(" "),
    );
    const runIntake = shouldRunFanIntake({
      funnelStage: input.funnelStage,
      intent,
      purchasedPpvCount: input.pricing?.purchasedPpvCount,
      subscriberText: last,
      sequenceKind: input.activeSequence?.kind,
      intakeComplete: intakeComplete({
        extra: input.fanNotes?.extra,
        location: input.fanNotes?.location,
        notes: input.fanNotes?.notes,
        dominance: input.fanNotes?.dominance,
        boughtWelcome: input.boughtWelcome,
      }),
    });
    const intake = runIntake
      ? inferFanIntake({
          subscriberText: last,
          recentMessages: input.recentMessages,
          fanNotes: input.fanNotes,
          subscriberName: input.fanNotes?.realName,
          creatorAge: creatorAgeFromText(input.persona.biography, input.persona.authorisedBackstory),
          creatorCity: creatorCityFromText(input.persona.biography, input.persona.authorisedBackstory),
          boughtWelcome: input.boughtWelcome,
          existingFan: input.existingFan,
          productsPurchased: input.pricing?.purchasedPpvCount,
          unpaidProductId: input.unpaidLockedCount ? "unpaid" : undefined,
          allowedSkipToNextProduct: false,
        })
      : null;
    const skipPitch =
      wantsNoPitch(input.operatorRejections ?? []) ||
      Boolean(intake?.skipPitch) ||
      ((input.unpaidLockedCount ?? 0) >= 2 && input.sellTarget?.reason !== "CONTEXT") ||
      input.followUpPhase === "AFTERCARE" ||
      intent === "COMPLAINT" ||
      intent === "REFUND" ||
      intent === "UNSAFE" ||
      input.responseMode === "NATURAL" ||
      pitchIsTooEarly({
        funnelStage: input.funnelStage,
        fanMessageCount: input.recentMessages.filter((m) => m.authorType === "SUBSCRIBER").length,
        subscriberText: last,
        threadOnOffline: threadIsOnOfflineAsk(input.recentMessages),
        catalogFit: input.sellTarget?.reason === "CONTEXT" || matchSellTarget({
          products: input.products,
          subscriberTexts: input.recentMessages.filter((m) => m.authorType === "SUBSCRIBER").map((m) => m.body),
          notes: input.fanNotes?.notes,
          memories: input.memories.map((m) => m.value),
          sequenceProductId: input.activeSequence?.current.productId,
        })?.reason === "CONTEXT",
      });
    const product = skipPitch ? null : (pickProduct(input, intent) ?? null);
    const pitching = Boolean(product) && !skipPitch;
    const offer = product
      ? resolveOfferPrice({
          standardPrice: product.standardPrice,
          minimumPrice: product.minimumPrice,
          discountLimitPercent: product.discountLimitPercent ?? input.persona.discountLimitPercent,
          concessionAllowed: Boolean(input.pricing?.concessionAllowed),
          sendAttempt: product.sendAttempt,
        })
      : null;
    const facts = extractFanFacts({
      subscriberText: last,
      recentMessages: input.recentMessages,
      creatorCity: creatorCityFromText(input.persona.biography, input.persona.authorisedBackstory),
    });
    const memoryUpdates = Object.entries(facts.extra).map(([key, value]) => ({
      category: "PERSONAL_DETAILS",
      key,
      value,
      confidence: 0.9,
      sourceMessageId: input.requestId,
    }));
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
      replyOptions: withoutRejectedDrafts(repliesFor(input, intent, pitching), input, last),
      recommendedProductId: pitching ? (product?.id ?? null) : null,
      approvedPrice: pitching ? (offer?.price ?? product?.standardPrice ?? null) : null,
      requiresHumanReview: true,
      riskFlags: [],
      memoryUpdates,
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
