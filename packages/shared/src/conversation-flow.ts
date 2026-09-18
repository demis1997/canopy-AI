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
  looksLikeSextAsk,
  looksLikeTeaseAsk,
  locationReplyVariants,
  relationshipReplyVariants,
  FAN_DOMINANT_FOLLOW_VARIANTS,
  FAN_SUBMISSIVE_FOLLOW_VARIANTS,
  looksLikeAffirm,
  looksLikeProveYourselfAsk,
  looksLikeSurrenderAsk,
  looksLikeWaitingForReveal,
} from "./replies.js";

export const PERSONAL_PERMISSION_EXAMPLES = [
  ["you know, i cant quite read you yet", "mind if i ask you something a little personal?"].join("\n"),
  "can i ask you something before we dive deeper?",
  "youre kinda hard to read.. is it ok if i ask u something personal",
  "i was gonna ask you something a little personal, that cool?",
];

export function supportsSubDomGoodBoyTone(input: {
  subscriberText?: string;
  recentMessages?: { authorType: string; body: string }[];
  dominance?: string;
}): boolean {
  if ((input.dominance ?? "").toUpperCase() === "SUBMISSIVE") return true;
  const blob = `${input.subscriberText ?? ""} ${(input.recentMessages ?? []).map((m) => m.body).join(" ")}`;
  return /\b(good boy|behave|submit to (you|u|me)|call me (sir|daddy))\b/i.test(blob);
}

export function subDomQuestion(input?: {
  subscriberText?: string;
  recentMessages?: { authorType: string; body: string }[];
  dominance?: string;
}): string {
  if (input && supportsSubDomGoodBoyTone(input)) {
    return "what turns you on, being in charge or submitting like a good boy?";
  }
  return "are you usually the one taking control, or do you like being told what to do?";
}

export const SUB_DOM_QUESTION = subDomQuestion();

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
  | "ASK_PERSONAL_PERMISSION"
  | "ASK_SUB_DOM"
  | "WARMUP"
  | "SEND_PRODUCT"
  | "FOLLOW_UP_PRODUCT"
  | "ASK_WHAT_HE_WANTS"
  | "AFTERCARE";

export type FlowQuestion =
  | "HOW_ARE_YOU"
  | "VIBE"
  | "AGE"
  | "LOCATION"
  | "JOB"
  | "PERSONAL_PERMISSION"
  | "SUB_DOM"
  | "BUNDLE";

export type StepStatus = "not_started" | "asked" | "answered" | "skipped" | "completed";

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
  stepStatus: Partial<Record<FlowQuestion, StepStatus>>;
  resumeHoldTurns: number;
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
  askPending: boolean;
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
  skipKeys?: Array<"howare" | "vibe" | "age" | "city" | "job" | "permission" | "subdom" | "warmup">;
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
  "ASK_PERSONAL_PERMISSION",
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

const FLOW_QUESTIONS: FlowQuestion[] = [
  "HOW_ARE_YOU",
  "VIBE",
  "AGE",
  "LOCATION",
  "JOB",
  "PERSONAL_PERMISSION",
  "SUB_DOM",
  "BUNDLE",
];

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

export function looksLikeNotJerking(text: string, vibeContext = false): boolean {
  if (/\bnot (even )?(jerking|stroking)( off)?\b/i.test(text)) return true;
  if (/\bi'?m not (jerking|stroking)/i.test(text)) return true;
  if (/\b(not jerking|aint jerking|aren'?t jerking)\b/i.test(text)) return true;
  if (
    vibeContext &&
    /\b(not (right )?now|not rn|maybe later|later|not at the moment|caught me at (a |the )?bad time)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

export function looksLikeJerking(text: string): boolean {
  if (looksLikeNotJerking(text, true)) return false;
  return /\b(jerking( off)?|stroking|one (hand|of them) busy|just one|left hand|right hand|busy yeah|yeah one)\b/i.test(
    text,
  );
}

export function looksLikeHandsFree(text: string): boolean {
  if (looksLikeNotJerking(text, true)) return true;
  return /\b(both(\s+hands)?(\s+free)?|hands free|neither|not busy|nope|two hands)\b/i.test(text);
}

export function interpretVibe(text: string): "jerking" | "not_jerking" | null {
  if (looksLikeNotJerking(text, true)) return "not_jerking";
  if (looksLikeJerking(text)) return "jerking";
  if (looksLikeHandsFree(text)) return "not_jerking";
  return null;
}

const OBJECTIVE_QUESTION_PATTERNS: Record<FlowQuestion, RegExp> = {
  HOW_ARE_YOU: /\b(how are you|hows it going|how have you been|how u been)\b/i,
  VIBE: /\b(how many hands|hands are you typing|typing with|both hands free|both free or|one hand or two|hands are u typing)\b/i,
  AGE: /\b(how old (are you|are u|r u)|what(?:'?s| is) (?:your|ur) age|mmm how old)\b/i,
  LOCATION: /\b(where (are you|are u|r u) from|where do (you|u) live)\b/i,
  JOB: /\b(what do (you|u) do for a living|for a living)\b/i,
  PERSONAL_PERMISSION:
    /\b(ask (you|u) something|something (a little |kinda |kind of )?personal|cant quite read you|can'?t quite read you|mind if i ask|before we dive deeper|is that ok if i ask)\b/i,
  SUB_DOM:
    /\b(taking control|told what to do|being in charge or submitting|what turns you on.{0,40}(charge|control|told)|in charge or you doing it|letting me take charge)\b/i,
  BUNDLE: /\benjoy(ed)? (that |the )?bundle\b/i,
};

const STEP_STATUSES: StepStatus[] = ["not_started", "asked", "answered", "skipped", "completed"];

export function sequenceObjectiveOf(text: string): FlowQuestion | null {
  for (const question of FLOW_QUESTIONS) {
    if (OBJECTIVE_QUESTION_PATTERNS[question].test(text)) return question;
  }
  return null;
}

export function askedSequenceObjectives(messages: { authorType: string; body: string }[]): FlowQuestion[] {
  const found: FlowQuestion[] = [];
  for (const message of messages) {
    if (message.authorType === "SUBSCRIBER") continue;
    const objective = sequenceObjectiveOf(message.body);
    if (objective && !found.includes(objective)) found.push(objective);
  }
  return found;
}

export function alreadySentObjectives(
  messages: { authorType: string; body: string }[],
  previous?: ConversationFlowState,
): FlowQuestion[] {
  const sent = askedSequenceObjectives(messages);
  if (!previous) return sent;
  for (const question of FLOW_QUESTIONS) {
    const status = previous.stepStatus?.[question];
    if (
      (status === "asked" || status === "answered" || status === "skipped" || status === "completed") &&
      !sent.includes(question)
    ) {
      sent.push(question);
    }
  }
  if (
    previous.currentQuestion &&
    previous.askedCurrentQuestionCount >= 1 &&
    !sent.includes(previous.currentQuestion) &&
    asked(OBJECTIVE_QUESTION_PATTERNS[previous.currentQuestion], messages)
  ) {
    sent.push(previous.currentQuestion);
  }
  return sent;
}

export function repeatsAskedSequenceObjective(
  text: string,
  messages: { authorType: string; body: string }[],
  previous?: ConversationFlowState,
): boolean {
  const objective = sequenceObjectiveOf(text);
  if (!objective) return false;
  return alreadySentObjectives(messages, previous).includes(objective);
}

export function looksLikeStandaloneFiller(text: string): boolean {
  return /^(wait|hold on|hold up|ok wait|wait wait|hmm+|uh+|umm+)[.!?…]*$/i.test(text.trim());
}

export function questionAlreadyAsked(
  question: FlowQuestion | undefined,
  state: ConversationFlowState,
  messages: { authorType: string; body: string }[],
): boolean {
  if (!question) return false;
  const status = state.stepStatus?.[question];
  if (status === "asked" || status === "answered" || status === "skipped" || status === "completed") return true;
  return asked(OBJECTIVE_QUESTION_PATTERNS[question], messages);
}

export function looksLikePermissionGrant(text: string): boolean {
  const t = text.trim();
  if (/^(what+|huh+|like what|what do you mean)\??$/i.test(t)) return true;
  if (/\b(what\??|like what)\s*$/i.test(t) && t.split(/\s+/).length <= 5) return true;
  if (looksLikeFanInvitesQuestions(t)) return true;
  return (
    /\b(sure|yeah|yea|yes|yep|yup|ok|okay|alright|aite|go ahead|go for it|ask( away| me)?|do it|why not|i don'?t mind|idm|ofc|of course|fine|hit me|cool)\b/i.test(
      t,
    ) && !looksLikeWontAnswer(t) && !looksLikeUncomfortablePersonal(t)
  );
}

export function looksLikeUncomfortablePersonal(text: string): boolean {
  return (
    looksLikeWontAnswer(text) ||
    looksLikePacingPushback(text) ||
    /\b(too personal|thats personal|that'?s personal|kinda weird|too weird|uncomfortable|dont ask( me)? that|not answering that)\b/i.test(
      text,
    )
  );
}

export function looksLikeDirectHandsAnswer(text: string): boolean {
  return /\b(both(\s+hands)?(\s+free)?|hands free|two hands|neither|not busy)\b/i.test(text);
}

export function shouldHoldForNaturalResume(opts: {
  deviation: FlowDeviation;
  currentQuestion?: FlowQuestion;
  subscriberText: string;
}): boolean {
  const last = opts.subscriberText;
  if (opts.deviation === "IGNORED" || opts.deviation === "REFUSED") return true;
  if (opts.currentQuestion === "VIBE" && looksLikeNotJerking(last, true) && !looksLikeDirectHandsAnswer(last)) {
    return true;
  }
  return false;
}

export function shouldResumePendingObjective(opts: {
  holdTurns: number;
  subscriberText: string;
  mustAnswer: FlowMustAnswer;
}): boolean {
  if (opts.mustAnswer) return false;
  if (opts.holdTurns <= 0) return false;
  if (looksLikeSextAsk(opts.subscriberText) || looksLikeTeaseAsk(opts.subscriberText) || looksLikeContentAsk(opts.subscriberText)) {
    return false;
  }
  return false;
}

function holdPending(state: ConversationFlowState): ConversationFlowState {
  const question = state.currentQuestion;
  const stepStatus = { ...state.stepStatus };
  if (question) stepStatus[question] = "not_started";
  return {
    ...state,
    resumeHoldTurns: (state.resumeHoldTurns ?? 0) + 1,
    askedCurrentQuestionCount: 0,
    stepStatus,
  };
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
  if (q === "SUB_DOM" || asked(OBJECTIVE_QUESTION_PATTERNS.SUB_DOM, input.recentMessages)) {
    if (/\b(both|switch|either|depends)\b/i.test(last)) dominance = "SWITCH";
    else if (/\b(submit|submissive|good boy|you in charge|u in charge|you take charge)\b/i.test(last)) {
      dominance = "SUBMISSIVE";
    } else if (/\b(in charge|dominat|im the dom|i'?m dom|i like (to )?control)\b/i.test(last)) {
      dominance = "DOMINANT";
    }
    if (dominance) extra.fan_dominance = dominance;
  }
  if (q === "VIBE") {
    const vibe = interpretVibe(last);
    if (vibe === "jerking") extra.fan_jerking = "true";
    else if (vibe === "not_jerking") extra.fan_jerking = "false";
  }
  return { extra, location, dominance, notesAppend: notes.length ? notes.join("; ") : undefined };
}

function asQuestion(step: FlowStep): FlowQuestion | undefined {
  if (step === "ASK_HOW_ARE_YOU") return "HOW_ARE_YOU";
  if (step === "VIBE_CHECK") return "VIBE";
  if (step === "ASK_AGE") return "AGE";
  if (step === "ASK_LOCATION") return "LOCATION";
  if (step === "ASK_JOB") return "JOB";
  if (step === "ASK_PERSONAL_PERMISSION") return "PERSONAL_PERMISSION";
  if (step === "ASK_SUB_DOM") return "SUB_DOM";
  if (step === "ASK_BUNDLE") return "BUNDLE";
  return undefined;
}

function phaseFor(step: FlowStep, state: ConversationFlowState, override?: FlowPhase): FlowPhase {
  if (override) return override;
  if (step === "AFTERCARE") return "AFTERCARE";
  if (step === "ASK_PERSONAL_PERMISSION" || step === "ASK_SUB_DOM") return "SUB_DOM_TRANSITION";
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
  const stepStatus: Partial<Record<FlowQuestion, StepStatus>> = {
    ...state.stepStatus,
    ...(extras.stepStatus ?? {}),
  };
  return {
    ...state,
    ...extras,
    phase: phaseFor(step, state, extras.phase),
    step,
    currentQuestion,
    askedCurrentQuestionCount: extras.askedCurrentQuestionCount ?? (currentQuestion ? 1 : 0),
    stepStatus,
    resumeHoldTurns: extras.resumeHoldTurns ?? state.resumeHoldTurns,
  };
}

function intakeLocked(state: ConversationFlowState, field: "age" | "location" | "job"): boolean {
  const question: FlowQuestion = field === "age" ? "AGE" : field === "location" ? "LOCATION" : "JOB";
  const status = state.stepStatus?.[question];
  if (status === "asked" || status === "answered" || status === "skipped" || status === "completed") return true;
  return Boolean(state.skipped?.[field]);
}

function missingIntakeStep(state: ConversationFlowState): FlowStep | null {
  if (!state.intake.age && !intakeLocked(state, "age")) return "ASK_AGE";
  if (!state.intake.location && !intakeLocked(state, "location")) return "ASK_LOCATION";
  if (!state.intake.job && !intakeLocked(state, "job")) return "ASK_JOB";
  return null;
}

function afterIntake(state: ConversationFlowState): ConversationFlowState {
  const spendingAssessment = assessSpendLikelihood({
    age: state.intake.age != null ? String(state.intake.age) : null,
    city: state.intake.location ?? null,
    job: state.intake.job ?? null,
  });
  const perm = state.stepStatus?.PERSONAL_PERMISSION;
  const sub = state.stepStatus?.SUB_DOM;
  if (state.dominance === "UNKNOWN" && perm !== "skipped" && sub !== "skipped") {
    if (perm === "completed" || perm === "answered") {
      return goTo(state, "ASK_SUB_DOM", { spendingAssessment, phase: "SUB_DOM_TRANSITION" });
    }
    return goTo(state, "ASK_PERSONAL_PERMISSION", { spendingAssessment, phase: "SUB_DOM_TRANSITION" });
  }
  if (state.welcomePurchased && state.warmupStep < 5) {
    return goTo(state, "WARMUP", { spendingAssessment, phase: "SELLING_SEQUENCE" });
  }
  if (state.unpaidProductId && !state.allowedSkipToNextProduct) {
    return goTo(state, "FOLLOW_UP_PRODUCT", { spendingAssessment, phase: "SELLING_SEQUENCE" });
  }
  return goTo(state, "SEND_PRODUCT", { spendingAssessment, phase: "SELLING_SEQUENCE" });
}

function afterVibe(state: ConversationFlowState, jerking: boolean, vibeStatus: StepStatus = "completed"): ConversationFlowState {
  const next = {
    ...state,
    fanIsJerking: jerking,
    stepStatus: { ...state.stepStatus, VIBE: vibeStatus },
  };
  if (jerking) {
    return afterIntake(next);
  }
  const missing = missingIntakeStep(next);
  if (missing) return goTo(next, missing);
  return afterIntake(next);
}

export function serializeFlowState(state: ConversationFlowState): Record<string, string> {
  const extra: Record<string, string> = {
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
    resume_hold_turns: String(state.resumeHoldTurns ?? 0),
  };
  for (const question of FLOW_QUESTIONS) {
    const status = state.stepStatus?.[question];
    if (status && status !== "not_started") extra[`status_${question.toLowerCase()}`] = status;
  }
  return extra;
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

function parseStepStatus(value: string | undefined): StepStatus | undefined {
  return STEP_STATUSES.includes(value as StepStatus) ? (value as StepStatus) : undefined;
}

function hydrateStepStatus(
  extra: Record<string, string>,
  messages: { authorType: string; body: string }[],
): Partial<Record<FlowQuestion, StepStatus>> {
  const status: Partial<Record<FlowQuestion, StepStatus>> = {};
  for (const question of FLOW_QUESTIONS) {
    const saved = parseStepStatus(extra[`status_${question.toLowerCase()}`]);
    if (saved) status[question] = saved;
    else if (asked(OBJECTIVE_QUESTION_PATTERNS[question], messages)) status[question] = "asked";
  }
  return status;
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
    stepStatus: hydrateStepStatus(extra, us),
    resumeHoldTurns: Number(extra.resume_hold_turns ?? 0) || 0,
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
      resumeHoldTurns: Number(extra.resume_hold_turns ?? 0) || 0,
    };
  }

  if (welcomePurchased) {
    if (dominance === "UNKNOWN") {
      if (asked(/enjoy(ed)? (that |the )?bundle/i, us) || us.length > 2) {
        return afterIntake(base);
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
  if (asked(OBJECTIVE_QUESTION_PATTERNS.PERSONAL_PERMISSION, us) && dominance === "UNKNOWN") {
    return goTo(base, "ASK_PERSONAL_PERMISSION", { phase: "SUB_DOM_TRANSITION" });
  }
  if (asked(OBJECTIVE_QUESTION_PATTERNS.SUB_DOM, us) && dominance === "UNKNOWN") {
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
  if (step === "ASK_PERSONAL_PERMISSION") return "mind if i ask you something a little personal?";
  if (step === "ASK_SUB_DOM") return subDomQuestion({ dominance: state.dominance });
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
    case "ASK_PERSONAL_PERMISSION":
      return "personal_permission";
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
  askPending = true,
): string[] {
  const closer = askPending ? closerFor(nextStep, nextState) : null;
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

function markQuestion(
  state: ConversationFlowState,
  question: FlowQuestion | undefined,
  status: StepStatus,
): ConversationFlowState {
  if (!question) return state;
  return { ...state, stepStatus: { ...state.stepStatus, [question]: status } };
}

function advanceAfterUnresolved(
  state: ConversationFlowState,
  question: FlowQuestion | undefined,
  last: string,
): ConversationFlowState {
  if (question === "VIBE") {
    const vibe = interpretVibe(last);
    return afterVibe(state, vibe === "jerking", vibe ? "completed" : "skipped");
  }
  if (question === "AGE") {
    const skippedState = markQuestion(
      { ...state, skipped: { ...state.skipped, age: true } },
      "AGE",
      "skipped",
    );
    const missing = missingIntakeStep(skippedState);
    return missing ? goTo(skippedState, missing) : afterIntake(skippedState);
  }
  if (question === "LOCATION") {
    const skippedState = markQuestion(
      { ...state, skipped: { ...state.skipped, location: true } },
      "LOCATION",
      "skipped",
    );
    const missing = missingIntakeStep(skippedState);
    return missing ? goTo(skippedState, missing) : afterIntake(skippedState);
  }
  if (question === "JOB") {
    const skippedState = markQuestion(
      { ...state, skipped: { ...state.skipped, job: true } },
      "JOB",
      "skipped",
    );
    return afterIntake(skippedState);
  }
  if (question === "PERSONAL_PERMISSION") {
    return goTo(markQuestion(state, "PERSONAL_PERMISSION", "skipped"), "ASK_SUB_DOM", {
      phase: "SUB_DOM_TRANSITION",
    });
  }
  if (question === "SUB_DOM") {
    const skippedState = markQuestion(state, "SUB_DOM", "skipped");
    return goTo(
      skippedState,
      skippedState.welcomePurchased && skippedState.warmupStep < 5 ? "WARMUP" : "SEND_PRODUCT",
      { phase: "SELLING_SEQUENCE" },
    );
  }
  if (question === "BUNDLE") {
    return afterIntake(markQuestion(state, "BUNDLE", "skipped"));
  }
  if (question === "HOW_ARE_YOU") {
    return goTo(markQuestion(state, "HOW_ARE_YOU", "skipped"), "VIBE_CHECK");
  }
  return state;
}

function recoverPastAsked(
  previous: ConversationFlowState,
  nextBase: ConversationFlowState,
  mustAnswer: FlowMustAnswer,
  input: FanIntakeInput,
  last: string,
): { next: ConversationFlowState; closer: string | null; variants: string[]; beatId: string; skipPitch: boolean } {
  const question = previous.currentQuestion;
  const holdTurns = previous.resumeHoldTurns ?? 0;
  const resume = shouldResumePendingObjective({ holdTurns, subscriberText: last, mustAnswer });

  if (!questionAlreadyAsked(question, previous, input.recentMessages) && question) {
    if (holdTurns > 0 && !resume) {
      const held = holdPending(goTo(nextBase, previous.step, { resumeHoldTurns: holdTurns }));
      return {
        next: held,
        closer: null,
        variants: mustAnswer ? leadForMustAnswer(mustAnswer, input, previous.step, nextBase, false) : [],
        beatId: mustAnswer ? beatIdFor(previous.step, mustAnswer) : stateBeat(previous.step, false),
        skipPitch: true,
      };
    }
    const next = goTo(nextBase, previous.step, { resumeHoldTurns: 0 });
    const closer = closerFor(previous.step, next);
    return {
      next,
      closer,
      variants: mustAnswer ? leadForMustAnswer(mustAnswer, input, previous.step, next) : closer ? [closer] : [],
      beatId: mustAnswer ? beatIdFor(previous.step, mustAnswer) : stateBeat(previous.step, false),
      skipPitch: true,
    };
  }

  const next = advanceAfterUnresolved(nextBase, question, last);
  const startHold = shouldHoldForNaturalResume({
    deviation: "IGNORED",
    currentQuestion: question,
    subscriberText: last,
  });
  if ((startHold && holdTurns === 0) || (holdTurns > 0 && !resume)) {
    const held = holdPending({ ...next, resumeHoldTurns: holdTurns });
    return {
      next: held,
      closer: null,
      variants: mustAnswer ? leadForMustAnswer(mustAnswer, input, next.step, next, false) : [],
      beatId: mustAnswer ? beatIdFor(next.step, mustAnswer) : stateBeat(next.step, false),
      skipPitch: true,
    };
  }
  const askedNext = goTo(next, next.step, { resumeHoldTurns: 0 });
  const rawCloser = closerFor(askedNext.step, askedNext);
  const closerObjective = rawCloser ? sequenceObjectiveOf(rawCloser) : null;
  const closer =
    rawCloser && closerObjective && alreadySentObjectives(input.recentMessages, previous).includes(closerObjective)
      ? null
      : rawCloser;
  const variants = mustAnswer
    ? leadForMustAnswer(mustAnswer, input, askedNext.step, askedNext)
    : closer
      ? withCloser(["ok"], closer)
      : [];
  return {
    next: askedNext,
    closer,
    variants,
    beatId: mustAnswer ? beatIdFor(askedNext.step, mustAnswer) : stateBeat(askedNext.step, false),
    skipPitch: Boolean(closer) && askedNext.step !== "SEND_PRODUCT" && askedNext.step !== "FOLLOW_UP_PRODUCT",
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
  const refused =
    looksLikeWontAnswer(last) ||
    looksLikePacingPushback(last) ||
    (previous.currentQuestion === "PERSONAL_PERMISSION" && looksLikeUncomfortablePersonal(last));
  const answeredCurrent =
    (previous.currentQuestion === "VIBE" && interpretVibe(last) != null) ||
    (previous.currentQuestion === "AGE" && Boolean(facts.extra.fan_age)) ||
    (previous.currentQuestion === "LOCATION" && Boolean(facts.location || facts.extra.fan_city)) ||
    (previous.currentQuestion === "JOB" && Boolean(facts.extra.fan_job)) ||
    (previous.currentQuestion === "PERSONAL_PERMISSION" &&
      looksLikePermissionGrant(last) &&
      !looksLikeUncomfortablePersonal(last)) ||
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
    const skippedState = {
      ...nextBase,
      skipped,
      stepStatus:
        previous.currentQuestion === "PERSONAL_PERMISSION"
          ? { ...nextBase.stepStatus, PERSONAL_PERMISSION: "skipped" as const, SUB_DOM: "skipped" as const }
          : nextBase.stepStatus,
    };
    const onward =
      previous.currentQuestion === "VIBE"
        ? afterVibe(skippedState, false)
        : previous.currentQuestion === "AGE"
          ? goTo(skippedState, missingIntakeStep(skippedState) ?? "ASK_LOCATION")
          : previous.currentQuestion === "LOCATION"
            ? goTo(skippedState, missingIntakeStep(skippedState) ?? "ASK_JOB")
            : previous.currentQuestion === "JOB" || previous.currentQuestion === "PERSONAL_PERMISSION"
              ? afterIntake(skippedState)
              : afterVibe(skippedState, false);
    const held = holdPending(onward);
    const variants = mustAnswer
      ? leadForMustAnswer(mustAnswer, input, onward.step, onward, false)
      : ["ok no rush", "ok ok no rush", "lol fair"];
    return finish(previous, held, "REFUSED", mustAnswer, facts, input, null, [], "pacing", true, false, variants);
  }

  const lastUs = [...input.recentMessages].reverse().find((message) => message.authorType !== "SUBSCRIBER")?.body ?? "";
  if (looksLikeWaitingForReveal(last)) {
    const variants = [
      ["ok", "i keep thinking about my mouth on u", "i shot something filthy earlier"].join("\n"),
      ["fine", "id start slow then get mean", "wanna see"].join("\n"),
    ];
    return finish(
      previous,
      goTo(nextBase, previous.unpaidProductId ? "FOLLOW_UP_PRODUCT" : "SEND_PRODUCT", { phase: "SELLING_SEQUENCE" }),
      extraOnAnswer ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
      mustAnswer,
      facts,
      input,
      null,
      variants,
      "tell_reveal",
      true,
      false,
      variants,
    );
  }
  if (looksLikeProveYourselfAsk(lastUs) && looksLikeAffirm(last)) {
    return finish(
      previous,
      goTo(nextBase, nextBase.welcomePurchased ? "WARMUP" : "SEND_PRODUCT", { phase: "SELLING_SEQUENCE" }),
      "ANSWERED",
      mustAnswer,
      facts,
      input,
      null,
      FAN_DOMINANT_FOLLOW_VARIANTS,
      "dom_prove_yes",
      true,
      false,
      FAN_DOMINANT_FOLLOW_VARIANTS,
    );
  }
  if (looksLikeSurrenderAsk(lastUs) && looksLikeAffirm(last)) {
    return finish(
      previous,
      goTo(nextBase, nextBase.welcomePurchased ? "WARMUP" : "SEND_PRODUCT", { phase: "SELLING_SEQUENCE" }),
      "ANSWERED",
      mustAnswer,
      facts,
      input,
      null,
      FAN_SUBMISSIVE_FOLLOW_VARIANTS,
      "sub_prove_yes",
      true,
      false,
      FAN_SUBMISSIVE_FOLLOW_VARIANTS,
    );
  }

  if (previous.step === "ASK_HOW_ARE_YOU" || previous.step === "ANSWER_HOW_ARE_YOU") {
    const askBack = looksLikeHowAreAsk(last);
    if (previous.step === "ASK_HOW_ARE_YOU" && input.recentMessages.filter((m) => m.authorType !== "SUBSCRIBER").length === 0) {
      if (mustAnswer) {
        return finish(
          previous,
          holdPending(goTo(nextBase, "ANSWER_HOW_ARE_YOU")),
          "IGNORED",
          mustAnswer,
          facts,
          input,
          null,
          [],
          beatIdFor("ANSWER_HOW_ARE_YOU", mustAnswer),
          true,
          false,
          leadForMustAnswer(mustAnswer, input, "ANSWER_HOW_ARE_YOU", nextBase, false),
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
    const answered = holdPending(goTo(nextBase, "ANSWER_HOW_ARE_YOU", {
      phase: nextBase.fanType === "EXISTING" ? "EXISTING_FAN_INTAKE" : "NEW_FAN_INTAKE",
    }));
    const answerVariants = askBack
      ? leadForMustAnswer("how-are-you", input, "ANSWER_HOW_ARE_YOU", answered, false)
      : [
          "heyy im good just relaxing a little",
          "im good actually just taking it easy for a bit",
        ];
    return finish(
      previous,
      answered,
      askBack ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
      askBack ? "how-are-you" : mustAnswer,
      facts,
      input,
      null,
      [],
      askBack ? (nextBase.fanType === "EXISTING" ? "existing_askback" : "gym") : "how_are_reply",
      true,
      false,
      answerVariants,
    );
  }

  if (previous.step === "ASK_BUNDLE") {
    const next = afterIntake(nextBase);
    const closer = closerFor(next.step, next);
    const variants = [
      joinBubbles(["hope you enjoyed that bundle", closer]),
      joinBubbles(["so did that bundle hit", closer]),
    ];
    return finish(previous, next, "ANSWERED", mustAnswer, facts, input, closer, PERSONAL_PERMISSION_EXAMPLES, "welcome_bundle", true, false, variants);
  }

  if (previous.step === "VIBE_CHECK") {
    const vibe = interpretVibe(last);
    if (vibe) {
      const jerking = vibe === "jerking";
      const next = afterVibe(markQuestion(nextBase, "VIBE", "completed"), jerking);
      const direct = jerking || looksLikeDirectHandsAnswer(last);
      if (!direct) {
        const held = holdPending(next);
        return finish(
          previous,
          held,
          extraOnAnswer ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
          mustAnswer,
          facts,
          input,
          null,
          [],
          "vibe_no",
          true,
          false,
          mustAnswer ? leadForMustAnswer(mustAnswer, input, next.step, next, false) : [],
        );
      }
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
          ? PERSONAL_PERMISSION_EXAMPLES
          : next.step === "ASK_AGE"
            ? [
                ["ok", "mmm how old are you? feel curious idk why"].join("\n"),
                ["nice", "mmm how old are you? feel curious idk why"].join("\n"),
              ]
            : next.step === "ASK_JOB"
              ? [jobLine()]
              : next.step === "ASK_LOCATION"
                ? [locationLine()]
                : next.step === "ASK_PERSONAL_PERMISSION"
              ? PERSONAL_PERMISSION_EXAMPLES
              : next.step === "ASK_SUB_DOM"
                ? [subDomQuestion(input)]
                : [];
      return finish(
        previous,
        goTo(next, next.step, { resumeHoldTurns: 0 }),
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
    const recovered = recoverPastAsked(previous, nextBase, mustAnswer, input, last);
    return finish(
      previous,
      recovered.next,
      "IGNORED",
      mustAnswer,
      facts,
      input,
      recovered.closer,
      [],
      recovered.beatId,
      recovered.skipPitch,
      looksLikeContentAsk(last),
      recovered.variants,
    );
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
    const recovered = recoverPastAsked(previous, nextBase, mustAnswer, input, last);
    return finish(previous, recovered.next, "IGNORED", mustAnswer, facts, input, recovered.closer, [], recovered.beatId, recovered.skipPitch, false, recovered.variants);
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
    const recovered = recoverPastAsked(previous, nextBase, mustAnswer, input, last);
    return finish(previous, recovered.next, "IGNORED", mustAnswer, facts, input, recovered.closer, [], recovered.beatId, recovered.skipPitch, false, recovered.variants);
  }

  if (previous.step === "ASK_JOB") {
    if (facts.extra.fan_job) {
      const interesting = looksLikeInterestingJob(last) || looksLikeAsksBack(last);
      const react = interesting
        ? "thank gosh haha finally somebody interesting on this platform lol i thought such ppl dont exist anymore lool"
        : "thats fine, props to you for working anyways, its cool that you have a job afterall";
      const onward = afterIntake(nextBase);
      const closer = closerFor(onward.step, onward);
      const permissionVariants = PERSONAL_PERMISSION_EXAMPLES.map((example) => joinBubbles([react, example]));
      return finish(
        previous,
        onward,
        extraOnAnswer ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
        mustAnswer,
        facts,
        input,
        closer,
        [react, ...PERSONAL_PERMISSION_EXAMPLES],
        "job_react",
        true,
        false,
        mustAnswer ? leadForMustAnswer(mustAnswer, input, onward.step, onward) : permissionVariants,
      );
    }
    const recovered = recoverPastAsked(previous, nextBase, mustAnswer, input, last);
    return finish(previous, recovered.next, "IGNORED", mustAnswer, facts, input, recovered.closer, [], recovered.beatId, recovered.skipPitch, false, recovered.variants);
  }

  if (previous.step === "ASK_PERSONAL_PERMISSION") {
    if (looksLikePermissionGrant(last) && !looksLikeUncomfortablePersonal(last)) {
      const next = goTo(markQuestion(nextBase, "PERSONAL_PERMISSION", "completed"), "ASK_SUB_DOM", {
        phase: "SUB_DOM_TRANSITION",
        resumeHoldTurns: 0,
      });
      const question = subDomQuestion({
        subscriberText: last,
        recentMessages: input.recentMessages,
        dominance: nextBase.dominance,
      });
      return finish(
        previous,
        next,
        extraOnAnswer ? "ANSWERED_PLUS_EXTRA" : "ANSWERED",
        mustAnswer,
        facts,
        input,
        question,
        [question],
        "subdom",
        true,
        false,
        mustAnswer ? leadForMustAnswer(mustAnswer, input, next.step, next) : [question],
      );
    }
    const recovered = recoverPastAsked(previous, nextBase, mustAnswer, input, last);
    return finish(previous, recovered.next, "IGNORED", mustAnswer, facts, input, recovered.closer, [], recovered.beatId, recovered.skipPitch, false, recovered.variants);
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
    if (!asked(OBJECTIVE_QUESTION_PATTERNS.SUB_DOM, input.recentMessages)) {
      const question = subDomQuestion({
        subscriberText: last,
        recentMessages: input.recentMessages,
        dominance: nextBase.dominance,
      });
      return finish(previous, nextBase, deviation, mustAnswer, facts, input, question, [question], "subdom", true, false, [question]);
    }
    const recovered = recoverPastAsked(previous, nextBase, mustAnswer, input, last);
    return finish(previous, recovered.next, "IGNORED", mustAnswer, facts, input, recovered.closer, [], recovered.beatId, recovered.skipPitch, false, recovered.variants);
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
  let resolvedNext = next;
  const holding = (resolvedNext.resumeHoldTurns ?? 0) > 0;
  if (previous.currentQuestion && next.step !== previous.step) {
    const current = next.stepStatus?.[previous.currentQuestion];
    if (!current || current === "asked" || current === "not_started") {
      const status: StepStatus =
        deviation === "REFUSED" || deviation === "IGNORED"
          ? "skipped"
          : deviation === "ANSWERED" || deviation === "ANSWERED_PLUS_EXTRA"
            ? "completed"
            : "asked";
      resolvedNext = markQuestion(next, previous.currentQuestion, status);
    }
  }
  if (resolvedNext.currentQuestion && !holding) {
    const status = resolvedNext.stepStatus?.[resolvedNext.currentQuestion];
    if (!status || status === "not_started") {
      resolvedNext = markQuestion(resolvedNext, resolvedNext.currentQuestion, "asked");
    }
  }
  const pending = resolvedNext.currentQuestion;
  const sent = alreadySentObjectives(input.recentMessages, previous);
  const stripList = [
    ...sent,
    ...(holding && pending ? [pending] : []),
    ...(resolvedNext.currentQuestion === "PERSONAL_PERMISSION" || resolvedNext.step === "ASK_PERSONAL_PERMISSION"
      ? (["SUB_DOM"] as FlowQuestion[])
      : []),
  ];
  const resolved = variants ?? (mustAnswer ? leadForMustAnswer(mustAnswer, input, resolvedNext.step, resolvedNext, !holding) : closer && !holding ? [closer] : []);
  const cleanedVariants = resolved
    .map((text) => stripRepeatedObjectivesAndFiller(text, stripList))
    .filter(Boolean);
  const closerObjective = closer ? sequenceObjectiveOf(closer) : null;
  const cleanedCloser =
    holding || (closer && closerObjective && stripList.includes(closerObjective)) ? null : closer;
  return {
    previous,
    next: resolvedNext,
    deviation,
    intent: mustAnswer ?? resolvedNext.step,
    facts,
    mustAnswer,
    closer: cleanedCloser,
    quotedLines,
    variants: cleanedVariants,
    beatId,
    skipPitch,
    sellContent,
    askPending: Boolean(cleanedCloser) && !holding,
  };
}

export function stripRepeatedObjectivesAndFiller(text: string, alreadySent: FlowQuestion[]): string {
  const bubbles = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const kept = bubbles.filter((bubble) => {
    if (looksLikeStandaloneFiller(bubble)) return false;
    const objectives = FLOW_QUESTIONS.filter((question) => OBJECTIVE_QUESTION_PATTERNS[question].test(bubble));
    if (objectives.some((objective) => alreadySent.includes(objective))) return false;
    return true;
  });
  const fallback = bubbles.filter((bubble) => {
    if (looksLikeStandaloneFiller(bubble)) return false;
    const objectives = FLOW_QUESTIONS.filter((question) => OBJECTIVE_QUESTION_PATTERNS[question].test(bubble));
    return !objectives.length;
  });
  return (kept.length ? kept : fallback).join("\n");
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
