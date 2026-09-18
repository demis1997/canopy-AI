import { looksLikeAreYouReal, looksLikeContentAsk, looksLikeDirectCreatorQuestion, looksLikeDirectUnlockPitch, looksLikePrematureVideoPitch, looksLikeSextAsk, looksLikeTeaseAsk } from "./replies.js";

export type OperationalIntent =
  | "HUMAN_REQUEST"
  | "AI_SUSPICION"
  | "COMPLAINT"
  | "SUPPORT_REQUEST"
  | "STOP_AUTOMATION"
  | "NONE";

export type ResponseMode = "OPERATIONAL" | "SUPPORT" | "NATURAL" | "FLIRTY" | "EXPLICIT" | "SALES";

export type OperationalRoute = {
  intent: OperationalIntent;
  confidence: number;
  shouldGenerate: boolean;
  shouldPauseAutomation: boolean;
  requiresHumanReview: boolean;
  allowSexual: boolean;
  matchedSignals: string[];
};

export type OperationalGenerationPlan = {
  skipClassify: boolean;
  skipGenerate: boolean;
  skipTraining: boolean;
  pauseAutomation: boolean;
  muteAi: boolean;
  humanTakeover: boolean;
  requireHumanReview: boolean;
  allowSexual: boolean;
  chatterMessage: string;
};

export type PendingFanTurn = {
  messageIds: string[];
  messages: { id: string; body: string }[];
  combinedText: string;
  newestMessageId: string | null;
  oldestMessageId: string | null;
};

const HUMAN_IDIOM =
  /\b(only human|human nature|human being|human after all|to err is human|human error)\b/i;

const HANDOFF_PHRASE =
  /\b((redirect|transfer|connect|switch|pass)( me)?( to)?|let me (speak|talk|chat)|speak( to| with)|talk( to| with)|get me|put me through|hand( me)? over)\b/i;

const HUMAN_TARGET =
  /\b((a |the |an )?(real |actual |live )?(human|person|agent|rep|representative|someone|somebody|operator|moderator|manager|staff|creator)|support)\b/i;

const STOP_BOT =
  /\b(stop (the )?(bot|ai|automation)|turn off (the )?(bot|ai|automation)|disable (the )?(bot|ai))\b/i;

const WANT_PERSON =
  /\b(i (want|need) (a |the )?(real |actual )?(human|person|agent|someone)|i want a person)\b/i;

const SUPPORT_ASK =
  /\b((need|want) (help|support|assistance)|customer support|billing (issue|help)|payment (issue|problem)|account (issue|locked))\b/i;

const COMPLAINT_ASK =
  /\b(chargeback|better business|lawyer|sue you|report (you|this)|scam|ripoff|rip off|this is fraud)\b/i;

function looksLikeHumanRequest(text: string): boolean {
  const t = text.trim();
  if (!t || HUMAN_IDIOM.test(t)) return false;
  if (/\b(redirect|transfer|connect) me to (a |the )?(human|person|agent|someone|manager|support|moderator|creator)\b/i.test(t)) {
    return true;
  }
  if (WANT_PERSON.test(t) && (HANDOFF_PHRASE.test(t) || HUMAN_TARGET.test(t))) {
    return true;
  }
  if (HANDOFF_PHRASE.test(t) && HUMAN_TARGET.test(t)) return true;
  if (STOP_BOT.test(t)) return true;
  if (/\b(speak with the actual (creator|person)|talk to a real (human|person)|let me talk to a real person)\b/i.test(t)) {
    return true;
  }
  if (/\b(i('m| am|m) talking to an? (ai|bot|robot).{0,80}(human|person|redirect|transfer))\b/i.test(t)) {
    return true;
  }
  return false;
}

function looksLikeAiSuspicion(text: string): boolean {
  if (looksLikeHumanRequest(text)) return false;
  if (looksLikeAreYouReal(text)) return true;
  return /\b(talking to an? (ai|bot|robot)|this is (an? )?(ai|bot)|you('re| are) (an? )?(ai|bot|robot)|is this (an? )?(ai|bot))\b/i.test(
    text,
  );
}

function looksLikeStopAutomation(text: string): boolean {
  if (looksLikeHumanRequest(text)) return false;
  return STOP_BOT.test(text) || /\b(stop (messaging|texting|replying) me|leave me alone)\b/i.test(text);
}

function looksLikeSupportRequest(text: string): boolean {
  if (looksLikeHumanRequest(text)) return false;
  return SUPPORT_ASK.test(text);
}

function looksLikeComplaint(text: string): boolean {
  if (looksLikeHumanRequest(text)) return false;
  return COMPLAINT_ASK.test(text);
}

export function detectOperationalIntent(text: string): OperationalRoute {
  const t = text.trim();
  if (!t) {
    return {
      intent: "NONE",
      confidence: 0,
      shouldGenerate: true,
      shouldPauseAutomation: false,
      requiresHumanReview: false,
      allowSexual: true,
      matchedSignals: [],
    };
  }

  if (looksLikeHumanRequest(t)) {
    return {
      intent: "HUMAN_REQUEST",
      confidence: 0.99,
      shouldGenerate: false,
      shouldPauseAutomation: true,
      requiresHumanReview: true,
      allowSexual: false,
      matchedSignals: ["human-request"],
    };
  }
  if (looksLikeStopAutomation(t)) {
    return {
      intent: "STOP_AUTOMATION",
      confidence: 0.95,
      shouldGenerate: false,
      shouldPauseAutomation: true,
      requiresHumanReview: true,
      allowSexual: false,
      matchedSignals: ["stop-automation"],
    };
  }
  if (looksLikeComplaint(t)) {
    return {
      intent: "COMPLAINT",
      confidence: 0.92,
      shouldGenerate: true,
      shouldPauseAutomation: true,
      requiresHumanReview: true,
      allowSexual: false,
      matchedSignals: ["complaint"],
    };
  }
  if (looksLikeSupportRequest(t)) {
    return {
      intent: "SUPPORT_REQUEST",
      confidence: 0.9,
      shouldGenerate: true,
      shouldPauseAutomation: true,
      requiresHumanReview: true,
      allowSexual: false,
      matchedSignals: ["support"],
    };
  }
  if (looksLikeAiSuspicion(t)) {
    return {
      intent: "AI_SUSPICION",
      confidence: 0.93,
      shouldGenerate: false,
      shouldPauseAutomation: true,
      requiresHumanReview: true,
      allowSexual: false,
      matchedSignals: ["ai-suspicion"],
    };
  }
  return {
    intent: "NONE",
    confidence: 0,
    shouldGenerate: true,
    shouldPauseAutomation: false,
    requiresHumanReview: false,
    allowSexual: true,
    matchedSignals: [],
  };
}

export function operationalGenerationPlan(route: OperationalRoute): OperationalGenerationPlan {
  if (route.intent === "HUMAN_REQUEST" || route.intent === "STOP_AUTOMATION") {
    return {
      skipClassify: true,
      skipGenerate: true,
      skipTraining: true,
      pauseAutomation: true,
      muteAi: true,
      humanTakeover: true,
      requireHumanReview: true,
      allowSexual: false,
      chatterMessage:
        route.intent === "HUMAN_REQUEST"
          ? "Fan requested a human. AI paused."
          : "Fan asked to stop the bot. AI paused.",
    };
  }
  if (route.intent === "AI_SUSPICION") {
    return {
      skipClassify: true,
      skipGenerate: true,
      skipTraining: true,
      pauseAutomation: true,
      muteAi: false,
      humanTakeover: false,
      requireHumanReview: true,
      allowSexual: false,
      chatterMessage: "Fan asked if this is AI. Human review required.",
    };
  }
  if (route.intent === "COMPLAINT" || route.intent === "SUPPORT_REQUEST") {
    return {
      skipClassify: false,
      skipGenerate: false,
      skipTraining: false,
      pauseAutomation: true,
      muteAi: false,
      humanTakeover: false,
      requireHumanReview: true,
      allowSexual: false,
      chatterMessage: "",
    };
  }
  return {
    skipClassify: false,
    skipGenerate: false,
    skipTraining: false,
    pauseAutomation: false,
    muteAi: false,
    humanTakeover: false,
    requireHumanReview: false,
    allowSexual: true,
    chatterMessage: "",
  };
}

export function collectPendingFanTurn(opts: {
  messages: { id: string; authorType: string; body: string; createdAt?: Date | string }[];
  triggerMessageId?: string;
  maxMessages?: number;
  maxChars?: number;
}): PendingFanTurn {
  const maxMessages = opts.maxMessages ?? 12;
  const maxChars = opts.maxChars ?? 4000;
  const chronological = [...opts.messages];
  const triggerIndex = opts.triggerMessageId
    ? chronological.findIndex((row) => row.id === opts.triggerMessageId)
    : -1;
  const cutoff = triggerIndex >= 0 ? chronological.slice(0, triggerIndex + 1) : chronological;
  let lastCreator = -1;
  for (let i = cutoff.length - 1; i >= 0; i -= 1) {
    if (cutoff[i]!.authorType !== "SUBSCRIBER") {
      lastCreator = i;
      break;
    }
  }
  const pending = cutoff.slice(lastCreator + 1).filter((row) => row.authorType === "SUBSCRIBER");
  const limited: { id: string; body: string }[] = [];
  let chars = 0;
  for (const row of pending) {
    if (limited.length >= maxMessages) break;
    const body = row.body.slice(0, maxChars);
    if (chars + body.length > maxChars && limited.length) break;
    limited.push({ id: row.id, body });
    chars += body.length + 1;
  }
  return {
    messageIds: limited.map((row) => row.id),
    messages: limited,
    combinedText: limited.map((row) => row.body).join("\n").slice(0, maxChars),
    newestMessageId: limited.at(-1)?.id ?? null,
    oldestMessageId: limited[0]?.id ?? null,
  };
}

export function looksLikeFlirtyTurn(text: string): boolean {
  const t = text.trim();
  if (!t || containsSexualLanguage(t)) return false;
  if (/^(hey+|hi+|hello|heya|yo|sup)(\s|$|[!?.])/i.test(t) && !/\b(hot|cute|sexy|beautiful|gorgeous|pretty|damn|mmm)\b/i.test(t)) {
    return false;
  }
  return /\b(hot|cute|sexy|beautiful|gorgeous|pretty|damn|mmm)\b/i.test(t);
}

export function looksLikePurchaseSignal(text: string): boolean {
  return /\b(i('ll| will) buy|send it|how much|price|unlock|ppv|want (the|that) (vid|video|clip|pic))\b/i.test(text) ||
    looksLikeContentAsk(text);
}

export function determineResponseMode(opts: {
  operational: OperationalRoute;
  subscriberText: string;
}): ResponseMode {
  if (
    opts.operational.intent === "HUMAN_REQUEST" ||
    opts.operational.intent === "STOP_AUTOMATION" ||
    opts.operational.intent === "AI_SUSPICION"
  ) {
    return "OPERATIONAL";
  }
  if (opts.operational.intent === "COMPLAINT" || opts.operational.intent === "SUPPORT_REQUEST") {
    return "SUPPORT";
  }
  if (looksLikeSextAsk(opts.subscriberText) || looksLikeTeaseAsk(opts.subscriberText)) return "EXPLICIT";
  if (looksLikePurchaseSignal(opts.subscriberText)) return "SALES";
  if (looksLikeFlirtyTurn(opts.subscriberText)) return "FLIRTY";
  return "NATURAL";
}

export function containsSexualLanguage(text: string): boolean {
  return /\b(pussy|cock|girlcock|fuck|suck|cum|horny|stroke|dick|mouth on|on my knees|leaking|jerk|sext|shot something filthy|beg a little|dont u dare finish)\b/i.test(
    text,
  );
}

export function latestTurnAllowsSexual(turn: string, mode: ResponseMode): boolean {
  if (mode === "OPERATIONAL" || mode === "SUPPORT" || mode === "NATURAL") return false;
  if (mode === "FLIRTY") return false;
  return looksLikeSextAsk(turn) || looksLikeTeaseAsk(turn) || mode === "EXPLICIT" || mode === "SALES";
}

export function isGenerationStale(opts: {
  newestInputMessageId: string | null;
  newerSubscriberMessageId: string | null;
}): boolean {
  return Boolean(opts.newestInputMessageId && opts.newerSubscriberMessageId && opts.newerSubscriberMessageId !== opts.newestInputMessageId);
}

export type GroundingFailure = {
  ok: false;
  code: string;
};

export type GroundingResult = { ok: true } | GroundingFailure;

export function validateReplyGrounding(opts: {
  reply: string;
  turn: string;
  operational: OperationalRoute;
  mode: ResponseMode;
  recommendedProductId?: string | null;
}): GroundingResult {
  const reply = opts.reply.trim();
  if (opts.operational.intent === "HUMAN_REQUEST" && reply) {
    return { ok: false, code: "IGNORED_HUMAN_REQUEST" };
  }
  if (!opts.operational.shouldGenerate && reply) {
    return { ok: false, code: "OPERATIONAL_FORBIDS_GENERATION" };
  }
  if (!opts.operational.allowSexual && containsSexualLanguage(reply)) {
    return { ok: false, code: "SEXUAL_NOT_ALLOWED" };
  }
  if (!latestTurnAllowsSexual(opts.turn, opts.mode) && containsSexualLanguage(reply)) {
    return { ok: false, code: "SEXUAL_NOT_ALLOWED" };
  }
  const pitchingDisabled = opts.mode === "OPERATIONAL" || opts.mode === "SUPPORT" || opts.mode === "NATURAL" || !opts.operational.allowSexual;
  if (pitchingDisabled && (opts.recommendedProductId || looksLikeDirectUnlockPitch(reply) || looksLikePrematureVideoPitch(reply))) {
    return { ok: false, code: "PITCH_DISABLED" };
  }
  if (looksLikeDirectCreatorQuestion(opts.turn) && containsSexualLanguage(reply) && !looksLikeSextAsk(opts.turn)) {
    return { ok: false, code: "IGNORED_QUESTION" };
  }
  return { ok: true };
}

export function shouldOpenEscalation(existingOpen: boolean): boolean {
  return !existingOpen;
}
