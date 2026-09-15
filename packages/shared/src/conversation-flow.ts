import type { FanDominance } from "./crm.js";
import { AFTERCARE_AFTER_PURCHASES, assessSpendLikelihood } from "./crm.js";
import {
  ABOUT_HIM_VARIANTS,
  ageReplyVariants,
  looksLikeAgeAsk,
  looksLikeContentAsk,
  looksLikeFanInvitesQuestions,
  looksLikeLocationAsk,
  looksLikeRelationshipAsk,
  locationReplyVariants,
  relationshipReplyVariants,
} from "./replies.js";

export const SUB_DOM_QUESTION = [
  "let me ask you a naughty question now tho",
  "what turns you on, being in charge or submitting like a good boy?",
].join("\n");

export const AFTERCARE_QUOTES = [
  "that was so good, seriously felt like cloud nine, haha",
  "i want to get to know you more than just on a sexual note, because thats only gonna bring us closer together",
  "and if we are closer together.. that means even our fun is gonna be spicier and spicier as we progress",
];

export type FlowPhase =
  | "NEW_FAN_INTAKE"
  | "EXISTING_FAN_INTAKE"
  | "SUB_DOM_TRANSITION"
  | "SELLING_SEQUENCE"
  | "AFTERCARE";

export type FlowStep =
  | "ASK_HOW_ARE_YOU"
  | "ANSWER_HOW_ARE_YOU"
  | "ASK_BUNDLE"
  | "VIBE_CHECK"
  | "ASK_AGE"
  | "ASK_LOCATION"
  | "ASK_JOB"
  | "ASSESS_SPENDING"
  | "ASK_SUB_DOM"
  | "WARMUP"
  | "SEND_PRODUCT"
  | "FOLLOW_UP_PRODUCT"
  | "ASK_WHAT_HE_WANTS"
  | "AFTERCARE";

export type FlowQuestion = "HOW_ARE_YOU" | "VIBE" | "AGE" | "LOCATION" | "JOB" | "SUB_DOM" | "BUNDLE";

export type ConversationFlowState = {
  phase: FlowPhase;
  step: FlowStep;
  currentQuestion?: FlowQuestion;
  askedCurrentQuestionCount: number;
  welcomePurchased: boolean;
  fanType: "NEW" | "EXISTING";
  fanIsJerking: boolean | null;
  dominance: FanDominance;
  intake: {
    age?: number;
    location?: string;
    job?: string;
  };
  spendingAssessment?: "LOW" | "HIGH";
  warmupStep: number;
  productsSent: number;
  productsPurchased: number;
  unpaidProductId?: string;
  allowedSkipToNextProduct: boolean;
  skipped?: {
    age?: boolean;
    location?: boolean;
    job?: boolean;
  };
};

export type FlowDeviation = "ANSWERED" | "ANSWERED_PLUS_EXTRA" | "REFUSED" | "IGNORED" | null;

export type FlowMustAnswer =
  | "relationship"
  | "creator-age"
  | "creator-location"
  | "how-are-you"
  | "about-him"
  | "what-doing"
  | null;

export type FlowFacts = {
  extra: Record<string, string>;
  location?: string;
  dominance?: FanDominance;
  notesAppend?: string;
};

export type FlowTransition = {
  previous: ConversationFlowState;
  next: ConversationFlowState;
  deviation: FlowDeviation;
  intent: string;
  facts: FlowFacts;
  mustAnswer: FlowMustAnswer;
  closer: string | null;
  quotedLines: string[];
  variants: string[];
  beatId: string;
  skipPitch: boolean;
  sellContent: boolean;
};

export type FanIntakeVars = {
  name?: string;
  age?: number | null;
  city?: string | null;
};

export type FanIntakeBeat = {
  id: string;
  variants: string[];
  skipPitch?: boolean;
};

export type FanIntakeInput = {
  subscriberText: string;
  recentMessages: { authorType: string; body: string }[];
  fanNotes?: {
    location?: string;
    notes?: string;
    extra?: Record<string, string>;
    dominance?: string;
  } | null;
  subscriberName?: string;
  creatorAge?: number | null;
  creatorCity?: string | null;
  boughtWelcome?: boolean;
  existingFan?: boolean;
  skipKeys?: Array<"howare" | "vibe" | "age" | "city" | "job" | "subdom" | "warmup">;
  productsPurchased?: number;
  productsSent?: number;
  unpaidProductId?: string;
  allowedSkipToNextProduct?: boolean;
};

const FLOW_STEPS: FlowStep[] = [
  "ASK_HOW_ARE_YOU",
  "ANSWER_HOW_ARE_YOU",
  "ASK_BUNDLE",
  "VIBE_CHECK",
  "ASK_AGE",
  "ASK_LOCATION",
  "ASK_JOB",
  "ASSESS_SPENDING",
  "ASK_SUB_DOM",
  "WARMUP",
  "SEND_PRODUCT",
  "FOLLOW_UP_PRODUCT",
  "ASK_WHAT_HE_WANTS",
  "AFTERCARE",
];

const FLOW_PHASES: FlowPhase[] = [
  "NEW_FAN_INTAKE",
  "EXISTING_FAN_INTAKE",
  "SUB_DOM_TRANSITION",
  "SELLING_SEQUENCE",
  "AFTERCARE",
];

const FLOW_QUESTIONS: FlowQuestion[] = ["HOW_ARE_YOU", "VIBE", "AGE", "LOCATION", "JOB", "SUB_DOM", "BUNDLE"];

export function firstName(displayName: string | undefined | null): string {
  const raw = (displayName ?? "").replace(/\(.*?\)/g, "").trim();
  const token = raw.split(/\s+/)[0] ?? "";
  return token && !/^fan$/i.test(token) ? token : "babe";
}

export function looksLikePacingPushback(text: string): boolean {
  return /\b((why\??\s+)?we just started|just started talking|too many questions|slow down|chill with the questions)\b/i.test(
    text,
  );
}

export function looksLikeWontAnswer(text: string): boolean {
  return /\b(dont wanna (say|answer|tell)|don'?t (want to|wanna) (say|answer)|none of (your|ur) business|skip( that| this)?|next question|rather not|not telling|idk|i don'?t know|private)\b/i.test(
    text,
  );
}

export function looksLikeJerking(text: string): boolean {
  return /\b(jerk|stroking|one (hand|of them) busy|just one|left hand|right hand|busy yeah|yeah one)\b/i.test(text);
}

export function looksLikeHandsFree(text: string): boolean {
  return /\b(both(\s+hands)?(\s+free)?|hands free|neither|not busy|nope|two hands)\b/i.test(text);
}

export function looksLikeWillBuyNext(text: string): boolean {
  return /\b(i('ll| will)|im gonna|gonna) (buy|get|unlock|take) (it|that|the next)|send the next (one|ppv)|ill take the next\b/i.test(
    text,
  );
}

export function looksLikeInterestingJob(text: string): boolean {
  return /\b(doctor|surgeon|lawyer|attorney|engineer|software|dev|founder|ceo|owner|entrepreneur|finance|banker|pilot|architect|producer|director|investor)\b/i.test(
    text,
  );
}

export function looksLikeAsksBack(text: string): boolean {
  return /\b(hbu|wbu|what about you|how about you|and you|you\??)\s*$/i.test(text) || /\b(hbu|wbu|what about you|how about you)\b/i.test(text);
}

export function looksLikeHowAreAsk(text: string): boolean {
  return /\b(how are you|hows it going|hbu|wbu|what about you|how about you)\b/i.test(text);
}

export function looksLikeWhatDoing(text: string): boolean {
  return /\bwhat (are you|are u|r u) doing\b/i.test(text);
}

export function looksLikeWhatLike(text: string): boolean {
  return /\bwhat do (you|u) like\b/i.test(text);
}

export function isExistingFan(input: {
  funnelStage?: string;
  purchasedPpvCount?: number;
  priorCreatorMessages?: number;
  extra?: Record<string, string>;
  ageKnown?: boolean;
  cityKnown?: boolean;
  jobKnown?: boolean;
}): boolean {
  if (input.extra?.phase1_done === "true") return true;
  if ((input.purchasedPpvCount ?? 0) > 0) return true;
  if (input.ageKnown || input.cityKnown || input.jobKnown) return true;
  if ((input.priorCreatorMessages ?? 0) >= 2 && (input.funnelStage ?? "NEW_FAN") !== "NEW_FAN") return true;
  return false;
}

function asked(re: RegExp, messages: { authorType: string; body: string }[]): boolean {
  return messages.some((m) => m.authorType !== "SUBSCRIBER" && re.test(m.body));
}

function notesBlob(notes?: { location?: string; notes?: string; extra?: Record<string, string> } | null): string {
  if (!notes) return "";
  return `${notes.location ?? ""} ${notes.notes ?? ""} ${Object.values(notes.extra ?? {}).join(" ")}`.toLowerCase();
}

function hasNote(blob: string, extra: Record<string, string> | undefined, key: "age" | "city" | "job"): boolean {
  if (extra?.[`fan_${key}`] || extra?.[key]) return true;
  if (key === "age") return /\b(fan_age|age\s*[:=]\s*\d{2})\b/i.test(blob);
  if (key === "city") return /\b(fan_city|lives in|from [a-z]{3,})\b/i.test(blob);
  return /\b(fan_job|works? as)\b/i.test(blob);
}

function looksCloseToCreator(text: string, creatorCity: string | null): boolean {
  if (/\b(close|nearby|same (city|town|state)|not far|around here)\b/i.test(text)) return true;
  if (creatorCity && new RegExp(`\\b${creatorCity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
    return true;
  }
  return false;
}

export function extractFanFacts(input: {
  subscriberText: string;
  recentMessages: { authorType: string; body: string }[];
  creatorCity?: string | null;
  currentQuestion?: FlowQuestion;
}): FlowFacts {
  const last = input.subscriberText.trim();
  const extra: Record<string, string> = {};
  const notes: string[] = [];
  let location: string | undefined;
  let dominance: FanDominance | undefined;
  const q = input.currentQuestion;
  const ageMatch = last.match(/\b(1[89]|[2-6]\d)\b/);
  if ((q === "AGE" || asked(/how old are you/i, input.recentMessages)) && ageMatch && !looksLikeAgeAsk(last)) {
    extra.fan_age = ageMatch[1]!;
    notes.push(`age: ${ageMatch[1]}`);
  } else if (q === "AGE" && ageMatch) {
    extra.fan_age = ageMatch[1]!;
    notes.push(`age: ${ageMatch[1]}`);
  }
  if (q === "LOCATION" || asked(/where are you from/i, input.recentMessages)) {
    const city = last
      .replace(/[?!.,]/g, " ")
      .replace(/\b(im|i'm|i am|from|in|near|live|around|the|what about you|wbu|hbu|where do you live)\b/gi, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 3)
      .join(" ");
    if (city && !/^(yes|yeah|nah|idk|you|what|about|single|taken)\b/i.test(city)) {
      extra.fan_city = city.toLowerCase();
      location = city;
      notes.push(`city: ${city}`);
    }
  }
  if (q === "JOB" || asked(/what do u do for a living|for a living/i, input.recentMessages)) {
    const job = last.replace(/[?!]/g, "").replace(/\b(wbu|hbu|what about you)\b/gi, "").trim().slice(0, 80);
    if (job.length >= 3 && !looksLikeWontAnswer(job) && !looksLikeRelationshipAsk(job)) {
      extra.fan_job = job;
      notes.push(`job: ${job}`);
    }
  }
  if (q === "SUB_DOM" || asked(/being in charge or submitting|take charge or you doing it/i, input.recentMessages)) {
    if (/\b(both|switch|either|depends)\b/i.test(last)) dominance = "SWITCH";
    else if (/\b(submit|submissive|good boy|you in charge|u in charge|you take charge)\b/i.test(last)) {
      dominance = "SUBMISSIVE";
    } else if (/\b(in charge|dominat|im the dom|i'?m dom|i like (to )?control)\b/i.test(last)) {
      dominance = "DOMINANT";
    }
    if (dominance) extra.fan_dominance = dominance;
  }
  if (q === "VIBE") {
    if (looksLikeJerking(last)) extra.fan_jerking = "true";
    else if (looksLikeHandsFree(last)) extra.fan_jerking = "false";
  }
  return { extra, location, dominance, notesAppend: notes.length ? notes.join("; ") : undefined };
}

function asQuestion(step: FlowStep): FlowQuestion | undefined {
  if (step === "ASK_HOW_ARE_YOU") return "HOW_ARE_YOU";
  if (step === "VIBE_CHECK") return "VIBE";
  if (step === "ASK_AGE") return "AGE";
  if (step === "ASK_LOCATION") return "LOCATION";
  if (step === "ASK_JOB") return "JOB";
  if (step === "ASK_SUB_DOM") return "SUB_DOM";
  if (step === "ASK_BUNDLE") return "BUNDLE";
  return undefined;
}

function phaseFor(step: FlowStep, state: ConversationFlowState, override?: FlowPhase): FlowPhase {
  if (override) return override;
  if (step === "AFTERCARE") return "AFTERCARE";
  if (step === "ASK_SUB_DOM") return "SUB_DOM_TRANSITION";
  if (step === "WARMUP" || step === "SEND_PRODUCT" || step === "FOLLOW_UP_PRODUCT") return "SELLING_SEQUENCE";
  if (step === "ASK_WHAT_HE_WANTS") return state.phase;
  return state.fanType === "EXISTING" ? "EXISTING_FAN_INTAKE" : state.phase;
}

function goTo(
  state: ConversationFlowState,
  step: FlowStep,
  extras: Partial<ConversationFlowState> = {},
): ConversationFlowState {
  const currentQuestion = asQuestion(step);
  return {
    ...state,
    ...extras,
    phase: phaseFor(step, state, extras.phase),
    step,
    currentQuestion,
    askedCurrentQuestionCount: extras.askedCurrentQuestionCount ?? (currentQuestion ? 1 : 0),
  };
}

function missingIntakeStep(state: ConversationFlowState): FlowStep | null {
  if (!state.intake.age && !state.skipped?.age) return "ASK_AGE";
  if (!state.intake.location && !state.skipped?.location) return "ASK_LOCATION";
  if (!state.intake.job && !state.skipped?.job) return "ASK_JOB";
  return null;
}

function afterIntake(state: ConversationFlowState): ConversationFlowState {
  const spendingAssessment = assessSpendLikelihood({
    age: state.intake.age != null ? String(state.intake.age) : null,
    city: state.intake.location ?? null,
    job: state.intake.job ?? null,
  });
  if (state.dominance === "UNKNOWN") {
    return goTo(state, "ASK_SUB_DOM", { spendingAssessment, phase: "SUB_DOM_TRANSITION" });
  }
  if (state.welcomePurchased && state.warmupStep < 5) {
    return goTo(state, "WARMUP", { spendingAssessment, phase: "SELLING_SEQUENCE" });
  }
  if (state.unpaidProductId && !state.allowedSkipToNextProduct) {
    return goTo(state, "FOLLOW_UP_PRODUCT", { spendingAssessment, phase: "SELLING_SEQUENCE" });
  }
  return goTo(state, "SEND_PRODUCT", { spendingAssessment, phase: "SELLING_SEQUENCE" });
}

function afterVibe(state: ConversationFlowState, jerking: boolean): ConversationFlowState {
  const next = { ...state, fanIsJerking: jerking };
  if (jerking) {
    return goTo(next, "ASK_SUB_DOM", { phase: "SUB_DOM_TRANSITION" });
  }
  const missing = missingIntakeStep(next);
  if (missing) return goTo(next, missing);
  return afterIntake(next);
}

export function serializeFlowState(state: ConversationFlowState): Record<string, string> {
  return {
    flow_phase: state.phase,
    flow_step: state.step,
    current_question: state.currentQuestion ?? "",
    asked_current_question_count: String(state.askedCurrentQuestionCount),
    fan_jerking: state.fanIsJerking == null ? "" : state.fanIsJerking ? "true" : "false",
    warmup_step: String(state.warmupStep),
    spending_assessment: state.spendingAssessment ?? "",
    skipped_age: state.skipped?.age ? "true" : "",
    skipped_location: state.skipped?.location ? "true" : "",
    skipped_job: state.skipped?.job ? "true" : "",
  };
}

function parseStep(value: string | undefined): FlowStep | null {
  return FLOW_STEPS.includes(value as FlowStep) ? (value as FlowStep) : null;
}

function parsePhase(value: string | undefined): FlowPhase | null {
  return FLOW_PHASES.includes(value as FlowPhase) ? (value as FlowPhase) : null;
}

function parseQuestion(value: string | undefined): FlowQuestion | undefined {
  return FLOW_QUESTIONS.includes(value as FlowQuestion) ? (value as FlowQuestion) : undefined;
}

export function hydrateFlowState(input: FanIntakeInput): ConversationFlowState {
  const extra = input.fanNotes?.extra ?? {};
  const blob = notesBlob(input.fanNotes);
  const welcomePurchased = Boolean(input.boughtWelcome || extra.bought_welcome === "true");
  const fanType: "NEW" | "EXISTING" = input.existingFan ? "EXISTING" : "NEW";
  const dominanceRaw = (input.fanNotes?.dominance ?? extra.fan_dominance ?? "UNKNOWN").toUpperCase();
  const dominance: FanDominance =
    dominanceRaw === "SUBMISSIVE" || dominanceRaw === "DOMINANT" || dominanceRaw === "SWITCH"
      ? dominanceRaw
      : "UNKNOWN";
  const age = extra.fan_age ? Number(extra.fan_age) : undefined;
  const location = input.fanNotes?.location || extra.fan_city || undefined;
  const job = extra.fan_job || undefined;
  const productsPurchased = input.productsPurchased ?? 0;
  const productsSent = input.productsSent ?? 0;
  const us = input.recentMessages.filter((m) => m.authorType !== "SUBSCRIBER");
  const base: ConversationFlowState = {
    phase: fanType === "EXISTING" ? "EXISTING_FAN_INTAKE" : "NEW_FAN_INTAKE",
    step: welcomePurchased ? "ASK_BUNDLE" : "ASK_HOW_ARE_YOU",
    currentQuestion: welcomePurchased ? "BUNDLE" : "HOW_ARE_YOU",
    askedCurrentQuestionCount: 0,
    welcomePurchased,
    fanType,
    fanIsJerking: extra.fan_jerking === "true" ? true : extra.fan_jerking === "false" ? false : null,
    dominance,
    intake: {
      age: Number.isFinite(age) ? age : hasNote(blob, extra, "age") ? 0 : undefined,
      location: location || (hasNote(blob, extra, "city") ? input.fanNotes?.location : undefined),
      job: job || (hasNote(blob, extra, "job") ? extra.fan_job : undefined),
    },
    spendingAssessment: extra.spending_assessment === "HIGH" || extra.spending_assessment === "LOW" ? extra.spending_assessment : undefined,
    warmupStep: Number(extra.warmup_step ?? 0) || 0,
    productsSent,
    productsPurchased,
    unpaidProductId: input.unpaidProductId,
    allowedSkipToNextProduct: Boolean(input.allowedSkipToNextProduct),
    skipped: {
      age: extra.skipped_age === "true",
      location: extra.skipped_location === "true",
      job: extra.skipped_job === "true",
    },
  };
  if (base.intake.age === 0) delete base.intake.age;

  if (productsPurchased >= AFTERCARE_AFTER_PURCHASES) {
    return { ...base, phase: "AFTERCARE", step: "AFTERCARE", currentQuestion: undefined, askedCurrentQuestionCount: 0 };
  }

  const savedStep = parseStep(extra.flow_step);
  const savedPhase = parsePhase(extra.flow_phase);
  if (savedStep && savedPhase) {
    return {
      ...base,
      phase: savedPhase,
      step: savedStep,
      currentQuestion: parseQuestion(extra.current_question) ?? asQuestion(savedStep),
      askedCurrentQuestionCount: Number(extra.asked_current_question_count ?? 0) || 0,
    };
  }

  if (welcomePurchased) {
    if (dominance === "UNKNOWN") {
      if (asked(/enjoy(ed)? (that |the )?bundle/i, us) || us.length > 2) {
        return goTo(base, "ASK_SUB_DOM", { phase: "SUB_DOM_TRANSITION" });
      }
      return goTo(base, "ASK_BUNDLE", { phase: "NEW_FAN_INTAKE" });
    }
    if (base.warmupStep < 5) return goTo(base, "WARMUP", { phase: "SELLING_SEQUENCE" });
    if (base.unpaidProductId && !base.allowedSkipToNextProduct) {
      return goTo(base, "FOLLOW_UP_PRODUCT", { phase: "SELLING_SEQUENCE" });
    }
    return goTo(base, "SEND_PRODUCT", { phase: "SELLING_SEQUENCE" });
  }

  if (fanType === "EXISTING" && !asked(/how have you been|how u been/i, us) && us.length === 0) {
    return goTo(base, "ASK_HOW_ARE_YOU", { phase: "EXISTING_FAN_INTAKE" });
  }
  if (asked(/how many hands/i, us)) return goTo(base, "VIBE_CHECK");
  if (asked(/how old are you/i, us) && !base.intake.age && !base.skipped?.age) return goTo(base, "ASK_AGE");
  if (asked(/where are you from/i, us) && !base.intake.location && !base.skipped?.location) {
    return goTo(base, "ASK_LOCATION");
  }
  if (asked(/for a living/i, us) && !base.intake.job && !base.skipped?.job) return goTo(base, "ASK_JOB");
  if (asked(/being in charge or submitting/i, us) && dominance === "UNKNOWN") {
    return goTo(base, "ASK_SUB_DOM", { phase: "SUB_DOM_TRANSITION" });
  }
  if (asked(/how are you|hows it going|how have you been|saw u here|doing great actually/i, us)) {
    return goTo(base, "ASK_HOW_ARE_YOU");
  }
  if (us.length === 0) {
    return goTo(base, fanType === "EXISTING" ? "ASK_HOW_ARE_YOU" : "ASK_HOW_ARE_YOU");
  }
  return goTo(base, "VIBE_CHECK");
}

function joinBubbles(parts: Array<string | null | undefined>): string {
  return parts
    .flatMap((part) => (part ? part.split("\n") : []))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
}

function withCloser(leads: string[], closer: string | null): string[] {
  if (!closer) return leads;
  return leads.map((lead) => joinBubbles([lead, closer]));
}

function vibeLine(state: ConversationFlowState): string {
  return state.fanType === "EXISTING"
    ? ["how many hands are you typing with, haha?", "you can be honest with me"].join("\n")
    : "how many hands are you typing with?";
}

function ageLine(): string {
  return ["mmm how old are you?", "feel curious idk why"].join("\n");
}

function locationLine(): string {
  return ["where are you from btw", "lets see how close or far we are"].join("\n");
}

function jobLine(): string {
  return ["soo last question then", "what do u do for a living? just curiouss"].join("\n");
}

function closerFor(step: FlowStep, state: ConversationFlowState): string | null {
  if (step === "VIBE_CHECK") return vibeLine(state);
  if (step === "ASK_AGE") return "how old are u btw?";
  if (step === "ASK_LOCATION") return "where are you from btw";
  if (step === "ASK_JOB") return "what do u do for a living";
  if (step === "ASK_SUB_DOM") return SUB_DOM_QUESTION.split("\n").at(-1) ?? SUB_DOM_QUESTION;
  if (step === "ASK_WHAT_HE_WANTS") return "so what do you actually want rn";
  if (step === "WARMUP" && state.warmupStep === 0) return "are you ready for me";
  return null;
}

function beatIdFor(step: FlowStep, mustAnswer: FlowMustAnswer): string {
  if (mustAnswer === "relationship") return "her_single";
  if (mustAnswer === "creator-age") return "her_age_tease";
  if (mustAnswer === "creator-location") return "her_city";
  if (mustAnswer === "about-him") return "about_him";
  if (mustAnswer === "how-are-you") return stateBeat(step, true);
  return stateBeat(step, false);
}

function stateBeat(step: FlowStep, howAreBack: boolean): string {
  if (howAreBack && step === "VIBE_CHECK") return "gym";
  switch (step) {
    case "ASK_HOW_ARE_YOU":
      return "how_are";
    case "ANSWER_HOW_ARE_YOU":
      return "gym";
    case "ASK_BUNDLE":
      return "welcome_bundle";
    case "VIBE_CHECK":
      return "vibe";
    case "ASK_AGE":
      return "his_age";
    case "ASK_LOCATION":
      return "location";
    case "ASK_JOB":
      return "job";
    case "ASK_SUB_DOM":
      return "subdom";
    case "WARMUP":
      return "warmup_ready";
    case "ASK_WHAT_HE_WANTS":
      return "ignore";
    case "AFTERCARE":
      return "aftercare";
    case "FOLLOW_UP_PRODUCT":
      return "follow_up";
    default:
      return "flow";
  }
}

function directMustAnswer(text: string, current: FlowQuestion | undefined): FlowMustAnswer {
  if (looksLikeRelationshipAsk(text)) return "relationship";
  if (looksLikeAgeAsk(text)) return "creator-age";
  if (looksLikeLocationAsk(text)) return "creator-location";
  if (looksLikeFanInvitesQuestions(text)) return "about-him";
  if (looksLikeWhatDoing(text) || looksLikeWhatLike(text)) return "what-doing";
  if (current === "HOW_ARE_YOU" && looksLikeHowAreAsk(text)) return "how-are-you";
  if (current === "AGE" && looksLikeAsksBack(text)) return "creator-age";
  if (current === "LOCATION" && (looksLikeAsksBack(text) || looksLikeLocationAsk(text))) return "creator-location";
  return null;
}

function leadForMustAnswer(
  must: FlowMustAnswer,
  input: FanIntakeInput,
  nextStep: FlowStep,
  nextState: ConversationFlowState,
): string[] {
  const closer = closerFor(nextStep, nextState);
  if (must === "relationship") return relationshipReplyVariants(closer);
  if (must === "creator-age") {
    const ageLineText = input.creatorAge != null ? `im ${input.creatorAge}` : "old enough";
    return withCloser(
      [
        ["wait let me send u something", ageLineText].join("\n"),
        ["hold on", ageLineText].join("\n"),
      ],
      closer,
    );
  }
  if (must === "creator-location") return withCloser(locationReplyVariants(input.creatorCity ?? null), closer);
  if (must === "about-him") return withCloser(ABOUT_HIM_VARIANTS, closer);
  if (must === "how-are-you") {
    if (nextState.fanType === "EXISTING") {
      return withCloser(
        [["oh ive been great and its good to see you here", "really happy that were talking now"].join("\n")],
        closer,
      );
    }
    return withCloser(
      [
        ["im doing great actually", "was about to get ready to go to the gym and saw u here"].join("\n"),
        ["good tbh", "was getting ready for the gym and saw u"].join("\n"),
      ],
      closer,
    );
  }
  if (must === "what-doing") return withCloser([["just here talking to u"].join("\n")], closer);
  return closer ? [closer] : ["ok"];
}

function ignoreOnce(
  previous: ConversationFlowState,
  mustAnswer: FlowMustAnswer,
  input: FanIntakeInput,
): { next: ConversationFlowState; closer: string | null; variants: string[]; beatId: string; skipPitch: boolean } {
  if (previous.askedCurrentQuestionCount >= 2) {
    const next = goTo(previous, "ASK_WHAT_HE_WANTS", { askedCurrentQuestionCount: 0, currentQuestion: undefined });
    const closer = closerFor("ASK_WHAT_HE_WANTS", next);
    const leads = mustAnswer ? leadForMustAnswer(mustAnswer, input, "ASK_WHAT_HE_WANTS", next) : [closer ?? "so what do you actually want rn"];
    return { next, closer, variants: leads, beatId: mustAnswer ? beatIdFor("ASK_WHAT_HE_WANTS", mustAnswer) : "ignore", skipPitch: !looksLikeContentAsk(input.subscriberText) };
  }
  const next = { ...previous, askedCurrentQuestionCount: previous.askedCurrentQuestionCount + 1 };
  const closer = closerFor(previous.step, next);
  const reask =
    previous.step === "ASK_AGE"
      ? ["wait i still wanna know", "how old are you?"].join("\n")
      : previous.step === "ASK_LOCATION"
        ? ["ok but", "where are you from btw"].join("\n")
        : previous.step === "ASK_JOB"
          ? ["still curious", "what do u do for a living"].join("\n")
          : previous.step === "VIBE_CHECK"
            ? ["wait", vibeLine(previous)].join("\n")
            : previous.step === "ASK_SUB_DOM"
              ? SUB_DOM_QUESTION
              : closer;
  const variants = mustAnswer ? leadForMustAnswer(mustAnswer, input, previous.step, next) : [reask ?? "ok"];
  return {
    next,
    closer: reask,
    variants,
    beatId: mustAnswer ? beatIdFor(previous.step, mustAnswer) : `${stateBeat(previous.step, false)}_reaffirm`,
    skipPitch: true,
  };
}

export function advanceConversationFlow(input: FanIntakeInput): FlowTransition {
  const previous = hydrateFlowState(input);
  const last = input.subscriberText.trim();
  const facts = extractFanFacts({
    subscriberText: last,
    recentMessages: input.recentMessages,
    creatorCity: input.creatorCity,
    currentQuestion: previous.currentQuestion,
  });
  const nextBase: ConversationFlowState = {
    ...previous,
    intake: {
      age: facts.extra.fan_age ? Number(facts.extra.fan_age) : previous.intake.age,
      location: facts.location ?? previous.intake.location,
      job: facts.extra.fan_job ?? previous.intake.job,
    },
    dominance: facts.dominance ?? previous.dominance,
    fanIsJerking:
      facts.extra.fan_jerking === "true" ? true : facts.extra.fan_jerking === "false" ? false : previous.fanIsJerking,
  };
  const mustAnswer = directMustAnswer(last, previous.currentQuestion);
  const refused = looksLikeWontAnswer(last) || looksLikePacingPushback(last);
  const answeredCurrent =
    (previous.currentQuestion === "VIBE" && (looksLikeJerking(last) || looksLikeHandsFree(last))) ||
    (previous.currentQuestion === "AGE" && Boolean(facts.extra.fan_age)) ||
    (previous.currentQuestion === "LOCATION" && Boolean(facts.location || facts.extra.fan_city)) ||
    (previous.currentQuestion === "JOB" && Boolean(facts.extra.fan_job)) ||
    (previous.currentQuestion === "SUB_DOM" && Boolean(facts.dominance)) ||
    (previous.currentQuestion === "HOW_ARE_YOU" && last.length > 0 && !mustAnswer) ||
    (previous.currentQuestion === "BUNDLE" && last.length > 0);
  const extraOnAnswer = Boolean(mustAnswer && answeredCurrent);
  const deviation: FlowDeviation = refused
    ? "REFUSED"
    : extraOnAnswer
      ? "ANSWERED_PLUS_EXTRA"
      : answeredCurrent
        ? "ANSWERED"
        : last
          ? "IGNORED"
          : null;

  if (previous.productsPurchased >= AFTERCARE_AFTER_PURCHASES) {
    const next = goTo(nextBase, "AFTERCARE", { phase: "AFTERCARE" });
    return finish(previous, next, deviation, mustAnswer, facts, input, AFTERCARE_QUOTES[0] ?? null, AFTERCARE_QUOTES, "aftercare", true);
  }

  if (looksLikeContentAsk(last) && previous.askedCurrentQuestionCount >= 2) {
    const next = goTo(nextBase, previous.unpaidProductId ? "FOLLOW_UP_PRODUCT" : "SEND_PRODUCT", {
      phase: "SELLING_SEQUENCE",
    });
    return finish(previous, next, "IGNORED", mustAnswer, facts, input, null, [], "content", false, true);
  }

  if (refused) {
    const skipped = { ...nextBase.skipped };
    if (previous.currentQuestion === "AGE") skipped.age = true;
    if (previous.currentQuestion === "LOCATION") skipped.location = true;
    if (previous.currentQuestion === "JOB") skipped.job = true;
    const skippedState = { ...nextBase, skipped };
    const onward =
      previous.currentQuestion === "VIBE"
        ? afterVibe(skippedState, false)
        : previous.currentQuestion === "AGE"
          ? goTo(skippedState, missingIntakeStep(skippedState) ?? "ASK_LOCATION")
          : previous.currentQuestion === "LOCATION"
            ? goTo(skippedState, missingIntakeStep(skippedState) ?? "ASK_JOB")
            : previous.currentQuestion === "JOB"
              ? afterIntake(skippedState)
              : afterVibe(skippedState, false);
    const closer = closerFor(onward.step, onward);
    const variants = [
      joinBubbles(["ok no rush", closer]),
      joinBubbles(["ok ok no rush", closer]),
      joinBubbles(["lol fair", closer]),
    ];
    return finish(previous, onward, "REFUSED", mustAnswer, facts, input, closer, [], "pacing", true, false, variants);
  }

  if (previous.step === "ASK_HOW_ARE_YOU" || previous.step === "ANSWER_HOW_ARE_YOU") {
    const askBack = looksLikeHowAreAsk(last);
    const next = goTo(nextBase, "VIBE_CHECK", {
      phase: nextBase.fanType === "EXISTING" ? "EXISTING_FAN_INTAKE" : "NEW_FAN_INTAKE",
    });
    const closer = vibeLine(next);
    const quoted = [closer];
    const variants = askBack
      ? leadForMustAnswer(nextBase.fanType === "EXISTING" ? "how-are-you" : "how-are-you", input, "VIBE_CHECK", next)
      : nextBase.fanType === "EXISTING"
        ? [
            ["hey", "how have you been"].join("\n"),
            ["hey", "how u been"].join("\n"),
          ]
        : [
            [`heyy ${firstName(input.subscriberName)}`, "how are you"].join("\n"),
            [`heyy ${firstName(input.subscriberName)}`, "hows it going"].join("\n"),
          ];
    if (previous.step === "ASK_HOW_ARE_YOU" && input.recentMessages.filter((m) => m.authorType !== "SUBSCRIBER").length === 0) {
      if (mustAnswer) {
        return finish(
          previous,
          goTo(nextBase, "ASK_HOW_ARE_YOU"),
          "IGNORED",
          mustAnswer,
          facts,
          input,
          nextBase.fanType === "EXISTING" ? "how have you been" : "how are you",
          [],
          beatIdFor("ASK_HOW_ARE_YOU", mustAnswer),
          true,
          false,
          leadForMustAnswer(mustAnswer, input, "ASK_HOW_ARE_YOU", nextBase),
        );
      }
      return finish(
        previous,
        goTo(nextBase, "ASK_HOW_ARE_YOU"),
        deviation,
        mustAnswer,
        facts,
        input,
        nextBase.fanType === "EXISTING" ? "how have you been" : "how are you",
        [],
        nextBase.fanType === "EXISTING" ? "existing_opener" : "how_are",
        true,
        false,
        nextBase.fanType === "EXISTING"
          ? [
              ["hey", "how have you been"].join("\n"),
              ["hey", "how u been"].join("\n"),
            ]
          : [
              [`heyy ${firstName(input.subscriberName)}`, "how are you"].join("\n"),
              [`heyy ${firstName(input.subscriberName)}`, "hows it going"].join("\n"),
            ],
      );
    }
    return finish(
      previous,
      next,
      askBack ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
      askBack ? "how-are-you" : mustAnswer,
      facts,
      input,
      closer,
      quoted,
      askBack ? (nextBase.fanType === "EXISTING" ? "existing_askback" : "gym") : "vibe",
      true,
      false,
      askBack ? undefined : withCloser(["ok"], closer),
    );
  }

  if (previous.step === "ASK_BUNDLE") {
    const next = goTo(nextBase, "ASK_SUB_DOM", { phase: "SUB_DOM_TRANSITION" });
    const variants = [
      ["hope you enjoyed that bundle", SUB_DOM_QUESTION].join("\n"),
      ["so did that bundle hit", SUB_DOM_QUESTION].join("\n"),
    ];
    return finish(previous, next, "ANSWERED", mustAnswer, facts, input, SUB_DOM_QUESTION, [SUB_DOM_QUESTION], "welcome_bundle", true, false, variants);
  }

  if (previous.step === "VIBE_CHECK") {
    if (looksLikeJerking(last) || looksLikeHandsFree(last)) {
      const jerking = looksLikeJerking(last);
      const next = afterVibe(nextBase, jerking);
      const dive = jerking
        ? nextBase.fanType === "EXISTING" && nextBase.dominance === "UNKNOWN"
          ? [
              "well i was really expecting that...",
              "in that case, can i ask you something since i cant quite read you?",
            ].join("\n")
          : "can i ask you something before we dive deeper?"
        : closerFor(next.step, next);
      const quoted = dive ? [dive] : [];
      const variants = mustAnswer
        ? leadForMustAnswer(mustAnswer, input, next.step, next)
        : jerking
          ? [dive ?? SUB_DOM_QUESTION, ["wait", dive ?? SUB_DOM_QUESTION].join("\n")]
          : next.step === "ASK_AGE"
            ? [
                ["ok", "mmm how old are you? feel curious idk why"].join("\n"),
                ["nice", "mmm how old are you? feel curious idk why"].join("\n"),
              ]
            : next.step === "ASK_JOB"
              ? [jobLine()]
              : next.step === "ASK_LOCATION"
                ? [locationLine()]
                : [SUB_DOM_QUESTION];
      return finish(
        previous,
        jerking && next.step === "ASK_SUB_DOM" ? next : next,
        extraOnAnswer ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
        mustAnswer,
        facts,
        input,
        jerking ? dive : closerFor(next.step, next),
        quoted,
        jerking ? "vibe_yes" : next.step === "ASK_AGE" ? "vibe_no" : beatIdFor(next.step, mustAnswer),
        true,
        false,
        variants,
      );
    }
    const ignored = ignoreOnce(nextBase, mustAnswer, input);
    return finish(previous, ignored.next, "IGNORED", mustAnswer, facts, input, ignored.closer, [], ignored.beatId, ignored.skipPitch, looksLikeContentAsk(last), ignored.variants);
  }

  if (previous.step === "ASK_AGE") {
    if (facts.extra.fan_age) {
      const onward = nextBase.intake.location || nextBase.skipped?.location
        ? goTo(nextBase, nextBase.intake.job || nextBase.skipped?.job ? afterIntake(nextBase).step : "ASK_JOB")
        : goTo(nextBase, "ASK_LOCATION");
      const closer = closerFor(onward.step, onward);
      const variants = mustAnswer
        ? leadForMustAnswer(mustAnswer, input, onward.step, onward)
        : withCloser(["ok"], closer);
      return finish(previous, onward, extraOnAnswer ? "ANSWERED_PLUS_EXTRA" : "ANSWERED", mustAnswer, facts, input, closer, [], mustAnswer ? beatIdFor(onward.step, mustAnswer) : "location", true, false, variants);
    }
    const ignored = ignoreOnce(nextBase, mustAnswer, input);
    return finish(previous, ignored.next, "IGNORED", mustAnswer, facts, input, ignored.closer, [], ignored.beatId, ignored.skipPitch, false, ignored.variants);
  }

  if (previous.step === "ASK_LOCATION") {
    if (facts.location || facts.extra.fan_city) {
      const close = looksCloseToCreator(last, input.creatorCity ?? null);
      const react = close
        ? ["oh thats interesting", "i dont talk to a lot of people that are pretty close to me"].join("\n")
        : ["oh deal breaker, just kidding haha", "its cool were gonna still talk on here anyways"].join("\n");
      const onward =
        !nextBase.intake.job && !nextBase.skipped?.job ? goTo(nextBase, "ASK_JOB") : afterIntake(nextBase);
      const closer = closerFor(onward.step, onward);
      const herCity = mustAnswer === "creator-location" ? locationReplyVariants(input.creatorCity ?? null)[0] : null;
      const variants = mustAnswer
        ? leadForMustAnswer(mustAnswer, input, onward.step, onward)
        : [joinBubbles([react, closer])];
      return finish(
        previous,
        onward,
        extraOnAnswer ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
        mustAnswer,
        facts,
        input,
        closer,
        [react],
        mustAnswer === "creator-location" ? "her_city" : "location_react",
        true,
        false,
        herCity ? withCloser([herCity], closer) : variants,
      );
    }
    const ignored = ignoreOnce(nextBase, mustAnswer, input);
    return finish(previous, ignored.next, "IGNORED", mustAnswer, facts, input, ignored.closer, [], ignored.beatId, ignored.skipPitch, false, ignored.variants);
  }

  if (previous.step === "ASK_JOB") {
    if (facts.extra.fan_job) {
      const interesting = looksLikeInterestingJob(last) || looksLikeAsksBack(last);
      const react = interesting
        ? "thank gosh haha finally somebody interesting on this platform lol i thought such ppl dont exist anymore lool"
        : "thats fine, props to you for working anyways, its cool that you have a job afterall";
      const onward = afterIntake(nextBase);
      const closer = closerFor(onward.step, onward);
      return finish(
        previous,
        onward,
        extraOnAnswer ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
        mustAnswer,
        facts,
        input,
        closer,
        [react],
        "job_react",
        true,
        false,
        mustAnswer ? leadForMustAnswer(mustAnswer, input, onward.step, onward) : [joinBubbles([react, closer])],
      );
    }
    const ignored = ignoreOnce(nextBase, mustAnswer, input);
    return finish(previous, ignored.next, "IGNORED", mustAnswer, facts, input, ignored.closer, [], ignored.beatId, ignored.skipPitch, false, ignored.variants);
  }

  if (previous.step === "ASK_SUB_DOM") {
    if (facts.dominance === "SWITCH") {
      const line = [
        "im kind of the same, but if you really were to decide",
        "what do you feel like being now, letting me take charge or you doing it?",
      ].join("\n");
      return finish(previous, nextBase, "ANSWERED", mustAnswer, facts, input, line, [line], "switch_now", true, false, [line]);
    }
    if (facts.dominance === "SUBMISSIVE") {
      const line = [
        "figured that a long time ago, it was just a matter of time till you were going to admit it",
        "ready to finally surrender to me now?",
      ].join("\n");
      const next = goTo(nextBase, nextBase.welcomePurchased ? "WARMUP" : "SEND_PRODUCT", { phase: "SELLING_SEQUENCE" });
      return finish(previous, next, "ANSWERED", mustAnswer, facts, input, null, [line], "sub_yes", false, false, [line]);
    }
    if (facts.dominance === "DOMINANT") {
      const line = [
        "well in that case i just want to see if you can properly do it hehe",
        "so are you going to prove yourself now?",
      ].join("\n");
      const next = goTo(nextBase, nextBase.welcomePurchased ? "WARMUP" : "SEND_PRODUCT", { phase: "SELLING_SEQUENCE" });
      return finish(previous, next, "ANSWERED", mustAnswer, facts, input, null, [line], "dom_yes", false, false, [line]);
    }
    if (!asked(/being in charge or submitting/i, input.recentMessages)) {
      return finish(previous, nextBase, deviation, mustAnswer, facts, input, SUB_DOM_QUESTION, [SUB_DOM_QUESTION], "subdom", true, false, [SUB_DOM_QUESTION]);
    }
    const ignored = ignoreOnce(nextBase, mustAnswer, input);
    return finish(previous, ignored.next, "IGNORED", mustAnswer, facts, input, ignored.closer, [], ignored.beatId, ignored.skipPitch, false, ignored.variants);
  }

  if (previous.step === "WARMUP") {
    const step = previous.warmupStep;
    const variants =
      step <= 0
        ? ["are you ready for me", ["soo", "are you ready for me"].join("\n")]
        : step === 1
          ? [
              ["dont get too excited.. i havent done anything yet", "im just getting warmed up", "wait i shot something earlier"].join("\n"),
            ]
          : step === 2
            ? ["this is gonna be fun"]
            : step === 3
              ? ["u have no idea"]
              : [["one more before i send the real thing", "wait let me send u something"].join("\n")];
    const next =
      step >= 4
        ? goTo({ ...nextBase, warmupStep: 5 }, nextBase.unpaidProductId && !nextBase.allowedSkipToNextProduct ? "FOLLOW_UP_PRODUCT" : "SEND_PRODUCT")
        : goTo({ ...nextBase, warmupStep: step + 1 }, "WARMUP", { phase: "SELLING_SEQUENCE" });
    return finish(previous, next, "ANSWERED", mustAnswer, facts, input, variants[0] ?? null, variants, `warmup_${step}`, step >= 4 ? false : true, false, variants);
  }

  if (previous.unpaidProductId && !previous.allowedSkipToNextProduct) {
    const next = goTo(nextBase, "FOLLOW_UP_PRODUCT", { phase: "SELLING_SEQUENCE" });
    return finish(previous, next, deviation, mustAnswer, facts, input, null, [], "follow_up", true);
  }

  if (mustAnswer) {
    const missing = missingIntakeStep(nextBase);
    const onward = missing ? goTo(nextBase, missing) : nextBase;
    const closer = closerFor(onward.step, onward);
    return finish(previous, onward, "IGNORED", mustAnswer, facts, input, closer, [], beatIdFor(onward.step, mustAnswer), true, false, leadForMustAnswer(mustAnswer, input, onward.step, onward));
  }

  return finish(previous, nextBase, deviation, null, facts, input, null, [], "flow", false);
}

function finish(
  previous: ConversationFlowState,
  next: ConversationFlowState,
  deviation: FlowDeviation,
  mustAnswer: FlowMustAnswer,
  facts: FlowFacts,
  input: FanIntakeInput,
  closer: string | null,
  quotedLines: string[],
  beatId: string,
  skipPitch: boolean,
  sellContent = false,
  variants?: string[],
): FlowTransition {
  const resolved = variants ?? (mustAnswer ? leadForMustAnswer(mustAnswer, input, next.step, next) : closer ? [closer] : []);
  return {
    previous,
    next,
    deviation,
    intent: mustAnswer ?? next.step,
    facts,
    mustAnswer,
    closer,
    quotedLines,
    variants: resolved,
    beatId,
    skipPitch,
    sellContent,
  };
}

export function inferFanIntake(input: FanIntakeInput, _skipPacing = false): FanIntakeBeat | null {
  const transition = advanceConversationFlow(input);
  if (!transition.variants.length) return null;
  if (transition.next.phase === "SELLING_SEQUENCE" && transition.beatId === "flow" && !transition.mustAnswer) {
    return null;
  }
  return {
    id: transition.beatId,
    variants: transition.variants,
    skipPitch: transition.skipPitch,
  };
}

export function fillFanFlow(template: string, vars: FanIntakeVars): string {
  return template
    .replace(/\{name\}/gi, vars.name || "babe")
    .replace(/\{age\}/gi, vars.age != null ? String(vars.age) : "old enough")
    .replace(/\{cityReveal\}/gi, vars.city ? `im in ${vars.city}` : "anyway were both here");
}

export function logFlowDebug(payload: Record<string, unknown>): void {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const env = proc?.env ?? {};
  if (env.NODE_ENV === "production" || (env.NODE_ENV !== "development" && env.CANOPY_FLOW_LOG !== "1")) return;
  console.info("[canopy-flow]", JSON.stringify(payload));
}
