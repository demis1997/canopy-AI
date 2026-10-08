import {
  looksLikeContentAsk,
  looksLikeDirectCreatorQuestion,
  looksLikeDirectUnlockPitch,
  looksLikePrematureVideoPitch,
  looksLikeSextAsk,
  looksLikeTeaseAsk,
} from "./replies.js";
import {
  containsSexualLanguage,
  detectOperationalIntent,
  determineResponseMode,
  looksLikeFlirtyTurn,
  looksLikePurchaseSignal,
  type OperationalRoute,
  type ResponseMode,
} from "./operational-intent.js";

export type SalesReadiness =
  | "CONNECTING"
  | "WARMING"
  | "FLIRTING"
  | "SEXUAL_MOMENTUM"
  | "BUYING_SIGNAL"
  | "ACTIVE_SALE"
  | "AFTERCARE";

export type TurnIntensity = "NEUTRAL" | "WARM" | "FLIRTY" | "SUGGESTIVE" | "EXPLICIT" | "OFFER";

export type ConversationPacing = {
  previousAskedQuestion: boolean;
  consecutiveQuestionTurns: number;
  consecutiveSalesOrIntakeTurns: number;
  recentOpeners: string[];
  recentUsedEmoji: boolean;
  recentBubbleCount: number;
};

export type TurnDecision = {
  responseMode: ResponseMode;
  salesReadiness: SalesReadiness;
  latestTurnIntensity: TurnIntensity;
  intakeOpportunity: boolean;
  buyingSignals: string[];
  allowPitch: boolean;
  allowPrice: boolean;
  allowExplicit: boolean;
  allowIntakeQuestion: boolean;
  debugExplanation: string;
};

const GREETING = /^(hey+|hi+|hello|heya|yo|sup|morning|evening)(\s|$|[!?.])/i;

const WELLBEING_ASK =
  /\b(how are you|how r u|hows it going|how’s it going|how have you been|how u been|you good|u good)\b/i;

const EMOTION =
  /\b(awful|horrible|terrible|rough day|bad day|sad|tired|stressed|lonely|miss(ed)? you|had a (bad|shit|rough) (day|night))\b/i;

const WORK_TALK = /\b(work|job|shift|boss|office|meeting|clients?)\b/i;

const PLACE_TALK = /\b(weather|rain|snow|city|town|from|visiting|travel)\b/i;

const AGE_TALK = /\b(birthday|turning \d{2}|years? old|my age)\b/i;

const INTAKE_QUESTION =
  /\b(how many hands|how old are you|where are you from|what do you do for (a living|work)|taking control|told what to do|something personal|submitting like a good boy)\b/i;

const OPENER = /^(heyy+|mmm+|good\.|oh really|ok so)/i;

export function looksLikeGreeting(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (looksLikeSextAsk(t) || looksLikePurchaseSignal(t) || looksLikeTeaseAsk(t)) return false;
  return (
    GREETING.test(t) ||
    WELLBEING_ASK.test(t) ||
    /^(hey+|hi+)\s*(how are you|hows it going)?\??$/i.test(t)
  );
}

export function looksLikeWellbeingAsk(text: string): boolean {
  return WELLBEING_ASK.test(text);
}

export function looksLikeEmotionalStatement(text: string): boolean {
  return EMOTION.test(text);
}

export function classifyTurnIntensity(text: string): TurnIntensity {
  if (looksLikePurchaseSignal(text) || looksLikeContentAsk(text)) return "OFFER";
  if (looksLikeSextAsk(text)) return "EXPLICIT";
  if (looksLikeTeaseAsk(text)) return "SUGGESTIVE";
  if (looksLikeFlirtyTurn(text)) return "FLIRTY";
  if (looksLikeEmotionalStatement(text) || /\b(nice|cool|lol|haha|thanks|thank you)\b/i.test(text))
    return "WARM";
  return "NEUTRAL";
}

export function analyzePacing(
  recentMessages: { authorType: string; body: string }[],
): ConversationPacing {
  const creator = recentMessages.filter((row) => row.authorType !== "SUBSCRIBER");
  const last = [...creator].reverse();
  let consecutiveQuestionTurns = 0;
  for (const row of last) {
    if (/\?/.test(row.body) || INTAKE_QUESTION.test(row.body)) consecutiveQuestionTurns += 1;
    else break;
  }
  let consecutiveSalesOrIntakeTurns = 0;
  for (const row of last) {
    if (
      INTAKE_QUESTION.test(row.body) ||
      looksLikeDirectUnlockPitch(row.body) ||
      /\$\s*\d+/.test(row.body)
    ) {
      consecutiveSalesOrIntakeTurns += 1;
    } else break;
  }
  const recent = creator.slice(-4);
  return {
    previousAskedQuestion: Boolean(
      creator.at(-1) &&
      (/\?/.test(creator.at(-1)!.body) || INTAKE_QUESTION.test(creator.at(-1)!.body)),
    ),
    consecutiveQuestionTurns,
    consecutiveSalesOrIntakeTurns,
    recentOpeners: recent.map((row) =>
      row.body.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase(),
    ),
    recentUsedEmoji: recent.some((row) => /\p{Extended_Pictographic}/u.test(row.body)),
    recentBubbleCount: (creator.at(-1)?.body ?? "").split("\n").filter(Boolean).length,
  };
}

export function detectBuyingSignals(text: string): string[] {
  const signals: string[] = [];
  if (/\b(how much|price|cost)\b/i.test(text)) signals.push("price");
  if (/\b(show me|send (it|me)|got anything|what do you have)\b/i.test(text))
    signals.push("show-me");
  if (/\b(ppv|unlock|buy|purchase)\b/i.test(text)) signals.push("purchase");
  if (looksLikeContentAsk(text)) signals.push("content");
  return [...new Set(signals)];
}

function intakeFitsNaturally(text: string): "job" | "location" | "age" | "dominance" | null {
  if (WORK_TALK.test(text)) return "job";
  if (PLACE_TALK.test(text)) return "location";
  if (AGE_TALK.test(text)) return "age";
  if (looksLikeSextAsk(text) || looksLikeTeaseAsk(text)) return "dominance";
  return null;
}

export function decideIntakeOpportunity(opts: {
  subscriberText: string;
  operational: OperationalRoute;
  responseMode: ResponseMode;
  pacing: ConversationPacing;
  recentMessages: { authorType: string; body: string }[];
}): boolean {
  const text = opts.subscriberText.trim();
  if (!text) return false;
  if (
    opts.operational.intent === "HUMAN_REQUEST" ||
    opts.operational.intent === "AI_SUSPICION" ||
    opts.operational.intent === "STOP_AUTOMATION" ||
    opts.operational.intent === "COMPLAINT" ||
    opts.operational.intent === "SUPPORT_REQUEST"
  ) {
    return false;
  }
  if (
    opts.responseMode === "OPERATIONAL" ||
    opts.responseMode === "SUPPORT" ||
    opts.responseMode === "NATURAL"
  ) {
    if (!intakeFitsNaturally(text) || looksLikeGreeting(text) || looksLikeWellbeingAsk(text))
      return false;
  }
  if (
    looksLikeDirectCreatorQuestion(text) ||
    looksLikeWellbeingAsk(text) ||
    looksLikeEmotionalStatement(text) ||
    /\?/.test(text)
  ) {
    return false;
  }
  if (looksLikeGreeting(text) && !intakeFitsNaturally(text)) return false;
  if (
    opts.pacing.previousAskedQuestion &&
    INTAKE_QUESTION.test(
      opts.recentMessages.filter((m) => m.authorType !== "SUBSCRIBER").at(-1)?.body ?? "",
    )
  ) {
    return false;
  }
  if (opts.pacing.consecutiveQuestionTurns >= 2) return false;
  if (opts.pacing.consecutiveSalesOrIntakeTurns >= 2) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && !intakeFitsNaturally(text)) return false;
  return Boolean(intakeFitsNaturally(text));
}

export function determineSalesReadiness(opts: {
  operational: OperationalRoute;
  subscriberText: string;
  intensity: TurnIntensity;
  purchasedPpvCount?: number;
  unpaidOffer?: boolean;
  followUpPhase?: string;
}): SalesReadiness {
  if (opts.operational.intent !== "NONE") return "CONNECTING";
  if (
    (opts.followUpPhase === "AFTERCARE" || (opts.purchasedPpvCount ?? 0) >= 1) &&
    opts.intensity !== "OFFER" &&
    opts.intensity !== "EXPLICIT"
  ) {
    if (opts.intensity === "NEUTRAL" || opts.followUpPhase === "AFTERCARE") return "AFTERCARE";
  }
  if (
    opts.unpaidOffer &&
    (opts.intensity === "OFFER" || looksLikePurchaseSignal(opts.subscriberText))
  )
    return "ACTIVE_SALE";
  if (opts.intensity === "OFFER" || looksLikePurchaseSignal(opts.subscriberText))
    return "BUYING_SIGNAL";
  if (opts.intensity === "EXPLICIT" || looksLikeSextAsk(opts.subscriberText))
    return "SEXUAL_MOMENTUM";
  if (opts.intensity === "SUGGESTIVE" || opts.intensity === "FLIRTY") return "FLIRTING";
  if (opts.intensity === "WARM" && !looksLikeGreeting(opts.subscriberText)) return "WARMING";
  return "CONNECTING";
}

export function decideConversationTurn(opts: {
  subscriberText: string;
  operational?: OperationalRoute;
  recentMessages?: { authorType: string; body: string }[];
  purchasedPpvCount?: number;
  unpaidOffer?: boolean;
  followUpPhase?: string;
}): TurnDecision {
  const operational = opts.operational ?? detectOperationalIntent(opts.subscriberText);
  const intensity = classifyTurnIntensity(opts.subscriberText);
  const pacing = analyzePacing(opts.recentMessages ?? []);
  const buyingSignals = detectBuyingSignals(opts.subscriberText);
  const salesReadiness = determineSalesReadiness({
    operational,
    subscriberText: opts.subscriberText,
    intensity,
    purchasedPpvCount: opts.purchasedPpvCount,
    unpaidOffer: opts.unpaidOffer,
    followUpPhase: opts.followUpPhase,
  });
  let responseMode = determineResponseMode({
    operational,
    subscriberText: opts.subscriberText,
  });
  if (looksLikeGreeting(opts.subscriberText) && intensity !== "OFFER" && intensity !== "EXPLICIT") {
    responseMode = "NATURAL";
  }
  if (salesReadiness === "AFTERCARE" && (intensity === "NEUTRAL" || intensity === "WARM"))
    responseMode = "NATURAL";
  if (salesReadiness === "CONNECTING" || salesReadiness === "WARMING") {
    if (responseMode === "EXPLICIT" || responseMode === "SALES") responseMode = "NATURAL";
  }
  if (salesReadiness === "BUYING_SIGNAL" || salesReadiness === "ACTIVE_SALE")
    responseMode = "SALES";
  if (operational.intent === "COMPLAINT" || operational.intent === "SUPPORT_REQUEST")
    responseMode = "SUPPORT";
  if (
    operational.intent === "HUMAN_REQUEST" ||
    operational.intent === "AI_SUSPICION" ||
    operational.intent === "STOP_AUTOMATION"
  ) {
    responseMode = "OPERATIONAL";
  }

  const intakeOpportunity = decideIntakeOpportunity({
    subscriberText: opts.subscriberText,
    operational,
    responseMode,
    pacing,
    recentMessages: opts.recentMessages ?? [],
  });
  const allowPitch = salesReadiness === "BUYING_SIGNAL" || salesReadiness === "ACTIVE_SALE";
  const allowPrice = allowPitch;
  const allowExplicit =
    responseMode === "EXPLICIT" ||
    responseMode === "SALES" ||
    salesReadiness === "SEXUAL_MOMENTUM" ||
    salesReadiness === "BUYING_SIGNAL" ||
    salesReadiness === "ACTIVE_SALE";
  const debugExplanation = (() => {
    if (
      responseMode === "NATURAL" &&
      looksLikeGreeting(opts.subscriberText) &&
      looksLikeWellbeingAsk(opts.subscriberText)
    ) {
      return "Mode NATURAL because the fan greeted and asked how the creator was. No buying or sexual signal. Intake paused.";
    }
    if (responseMode === "NATURAL" && looksLikeGreeting(opts.subscriberText)) {
      return "Mode NATURAL because the fan greeted. No buying or sexual signal. Intake paused.";
    }
    if (responseMode === "SUPPORT") {
      return `Mode SUPPORT because the fan raised a ${operational.intent.toLowerCase()} issue. No pitch.`;
    }
    if (responseMode === "OPERATIONAL") {
      return `Mode OPERATIONAL because ${operational.intent}. Generation must not continue the sales funnel.`;
    }
    return `Mode ${responseMode} because the fan turn intensity is ${intensity} and sales readiness is ${salesReadiness}. Buying signals: ${buyingSignals.join(",") || "none"}. Intake ${intakeOpportunity ? "allowed" : "paused"}.`;
  })();

  return {
    responseMode,
    salesReadiness,
    latestTurnIntensity: intensity,
    intakeOpportunity,
    buyingSignals,
    allowPitch,
    allowPrice,
    allowExplicit,
    allowIntakeQuestion: intakeOpportunity,
    debugExplanation,
  };
}

export function replyLooksLikeIntakeQuestion(text: string): boolean {
  return INTAKE_QUESTION.test(text);
}

export function replyRepeatsRecentOpener(text: string, pacing: ConversationPacing): boolean {
  const opener = text.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
  return Boolean(opener) && pacing.recentOpeners.filter((row) => row === opener).length >= 2;
}

export function validateQualityGrounding(opts: {
  reply: string;
  turn: string;
  decision: TurnDecision;
  recommendedProductId?: string | null;
  pacing?: ConversationPacing;
}): { ok: true } | { ok: false; code: string } {
  const reply = opts.reply.trim();
  const decision = opts.decision;
  if (!decision.allowExplicit && containsSexualLanguage(reply))
    return { ok: false, code: "SEXUAL_NOT_ALLOWED" };
  if (
    !decision.allowPitch &&
    (opts.recommendedProductId ||
      looksLikeDirectUnlockPitch(reply) ||
      looksLikePrematureVideoPitch(reply) ||
      /\$\s*\d+/.test(reply))
  ) {
    return { ok: false, code: "PITCH_DISABLED" };
  }
  if (opts.pacing && opts.pacing.consecutiveQuestionTurns >= 2 && /\?/.test(reply)) {
    return { ok: false, code: "TOO_MANY_QUESTIONS" };
  }
  if (!decision.allowIntakeQuestion && replyLooksLikeIntakeQuestion(reply)) {
    return { ok: false, code: "INTAKE_NOT_OPPORTUNE" };
  }
  if (
    looksLikeWellbeingAsk(opts.turn) &&
    !/\b(good|well|okay|ok|fine|chillin|relaxing|alright|great|pretty)\b/i.test(reply)
  ) {
    return { ok: false, code: "IGNORED_QUESTION" };
  }
  if (looksLikeEmotionalStatement(opts.turn)) {
    const first = reply.split("\n")[0] ?? reply;
    if (
      replyLooksLikeIntakeQuestion(reply) ||
      looksLikeDirectUnlockPitch(reply) ||
      containsSexualLanguage(reply)
    ) {
      return { ok: false, code: "IGNORED_EMOTION" };
    }
    if (
      /\?/.test(first) &&
      !/\b(sorry|rough|awful|sucks|hear you|sounds|hard|stress)\b/i.test(first)
    ) {
      return { ok: false, code: "IGNORED_EMOTION" };
    }
  }
  if (
    (/\?/.test(opts.turn) || looksLikeDirectCreatorQuestion(opts.turn)) &&
    replyLooksLikeIntakeQuestion(reply)
  ) {
    return { ok: false, code: "IGNORED_QUESTION" };
  }
  if (
    looksLikeDirectCreatorQuestion(opts.turn) &&
    containsSexualLanguage(reply) &&
    !looksLikeSextAsk(opts.turn)
  ) {
    return { ok: false, code: "IGNORED_QUESTION" };
  }
  if (
    /\bmusic\b/i.test(opts.turn) &&
    !/\b(music|song|listen|playlist|indie|pop|rock|hip ?hop)\b/i.test(reply)
  ) {
    return { ok: false, code: "IGNORED_QUESTION" };
  }
  if (
    decision.responseMode === "NATURAL" &&
    (looksLikeGreeting(opts.turn) || looksLikeWellbeingAsk(opts.turn)) &&
    containsSexualLanguage(reply)
  ) {
    return { ok: false, code: "SEXUAL_NOT_ALLOWED" };
  }
  return { ok: true };
}

export { OPENER };
