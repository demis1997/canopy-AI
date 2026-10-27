import { tooSimilar } from "./replies.js";

export type ConversationStage =
  | "INTRODUCTION"
  | "FLIRTING"
  | "MUTUAL_INTEREST"
  | "INTIMATE_CONVERSATION"
  | "CONTENT_OFFER"
  | "AFTERCARE_RETENTION";
export type ConversationIntent =
  | "CASUAL_CONVERSATION"
  | "FLIRTING"
  | "ROMANTIC_INTEREST"
  | "INTIMATE_INTEREST"
  | "CONTENT_PURCHASE_INTEREST"
  | "OBJECTION_HESITATION"
  | "DISENGAGEMENT";
type Message = { authorType: string; body: string };
export const isAssistantMessage = (message: Message): boolean =>
  ["CREATOR", "CHATTER", "ASSISTANT"].includes(message.authorType);
const normalized = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const deflection =
  /\b(maybe maybe not|youre trouble|you are trouble|wouldnt you like to know|wouldn t you like to know|keep guessing|earn it|if youre lucky)\b/i;
export function isGenericDeflection(text: string): boolean {
  return deflection.test(normalized(text));
}

const rhetorical =
  /\b(can you handle|are you ready|wouldnt you like|want to find out|guess what|what would you do|oh really)\b/i;

export function classifyConversationIntent(
  text: string,
  history: Message[] = [],
): ConversationIntent {
  const t = normalized(text);
  if (/\b(stop|leave me alone|bye|goodbye|not interested|dont message|dont want to talk)\b/.test(t))
    return "DISENGAGEMENT";
  if (
    /\b(no thanks|not now|slow down|uncomfortable|too fast|too expensive|cant afford|maybe later|not buying|dont want|not comfortable|rather not)\b/.test(
      t,
    )
  )
    return "OBJECTION_HESITATION";
  if (
    /\b(how much|price|buy|purchase|unlock|show me what you have|what do you have|send me (?:your |the )?(?:content|photos|videos|set)|send (it|the (video|photos|set))|show me (your|the) (content|videos|photos)|what (content|videos|photos) do you have)\b/.test(
      t,
    )
  )
    return "CONTENT_PURCHASE_INTEREST";
  if (
    /\b(kiss|cuddle|hold me|hold you|close to you|closer to you|intimate|intimacy|talk dirty|sext|turn me on|turned on|horny)\b/.test(
      t,
    )
  )
    return "INTIMATE_INTEREST";
  if (
    /\b(i (really )?(like|want|adore|love) you|feel connected|feel safe|feelings for you|romantic|affection|miss you|care about you)\b/.test(
      t,
    )
  )
    return "ROMANTIC_INTEREST";
  if (/\b(cute|gorgeous|beautiful|handsome|flirt|chemistry|attracted|sexy|tease me)\b/.test(t))
    return "FLIRTING";
  if (/^(yes|yeah|me too|i do|id like that|please do|that sounds nice)$/.test(t)) {
    const last = history.filter(isAssistantMessage).at(-1)?.body;
    if (last) {
      const context = classifyConversationIntent(last);
      if (["ROMANTIC_INTEREST", "INTIMATE_INTEREST"].includes(context)) return context;
    }
  }
  return "CASUAL_CONVERSATION";
}

export type ProgressionState = {
  stage: ConversationStage;
  intent: ConversationIntent;
  turnsInStage: number;
  interestTurns: number;
  purchaseCount: number;
  lastTurnKey: string;
  previousStage: ConversationStage;
};
const stages: ConversationStage[] = [
  "INTRODUCTION",
  "FLIRTING",
  "MUTUAL_INTEREST",
  "INTIMATE_CONVERSATION",
  "CONTENT_OFFER",
  "AFTERCARE_RETENTION",
];
export function readProgression(value?: string): ProgressionState | undefined {
  try {
    const state = JSON.parse(value ?? "null") as ProgressionState | null;
    if (
      state &&
      stages.includes(state.stage) &&
      stages.includes(state.previousStage) &&
      typeof state.lastTurnKey === "string" &&
      typeof state.intent === "string" &&
      [state.turnsInStage, state.interestTurns, state.purchaseCount].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      )
    )
      return state;
  } catch {
    /* Invalid old memory starts a fresh state. */
  }
  return undefined;
}

// Progress tracks fan signals, never permission to override age, consent, or persona boundaries.
// The stable input message ID makes retries and operator rewrites idempotent.
export function advanceProgression(input: {
  previous?: ProgressionState;
  text: string;
  history?: Message[];
  turnKey: string;
  purchaseCount?: number;
  meaningfulInteraction?: boolean;
}): ProgressionState {
  let previous = input.previous;
  // Bootstrap existing threads from completed fan turns. Pending consecutive fan
  // messages form one turn and must not count as several progression signals.
  if (!previous) {
    let pending: string[] = [];
    for (const [index, message] of (input.history ?? []).entries()) {
      if (message.authorType === "SUBSCRIBER") pending.push(message.body);
      else if (isAssistantMessage(message) && pending.length) {
        previous = advanceProgression({
          previous,
          text: pending.join("\n"),
          turnKey: `history:${index}`,
        });
        pending = [];
      }
    }
  }
  const purchaseCount = input.purchaseCount ?? previous?.purchaseCount ?? 0;
  if (previous?.lastTurnKey === input.turnKey && previous.purchaseCount === purchaseCount)
    return previous;
  const intent = classifyConversationIntent(input.text, input.history);
  let stage = previous?.stage ?? "INTRODUCTION";
  let interestTurns = previous?.interestTurns ?? 0;
  if (intent === "DISENGAGEMENT" || intent === "OBJECTION_HESITATION") {
    stage = "INTRODUCTION";
    interestTurns = 0;
  } else if (intent === "CONTENT_PURCHASE_INTEREST") stage = "CONTENT_OFFER";
  else if (purchaseCount > (previous?.purchaseCount ?? 0) || input.meaningfulInteraction)
    stage = "AFTERCARE_RETENTION";
  else if (["FLIRTING", "ROMANTIC_INTEREST", "INTIMATE_INTEREST"].includes(intent)) {
    interestTurns += 1;
    if (
      (intent === "INTIMATE_INTEREST" && interestTurns >= 2) ||
      (intent === "ROMANTIC_INTEREST" && interestTurns >= 3) ||
      previous?.stage === "INTIMATE_CONVERSATION"
    )
      stage = "INTIMATE_CONVERSATION";
    else if (intent === "ROMANTIC_INTEREST" || interestTurns >= 2) stage = "MUTUAL_INTEREST";
    else stage = "FLIRTING";
  } else if (stage === "CONTENT_OFFER") stage = "INTRODUCTION";
  return {
    stage,
    intent,
    interestTurns,
    purchaseCount,
    lastTurnKey: input.turnKey,
    previousStage: previous?.stage ?? "INTRODUCTION",
    turnsInStage: stage === previous?.stage ? previous.turnsInStage + 1 : 1,
  };
}

export type ResponseEvaluation = {
  score: number;
  codes: string[];
  repetition: boolean;
  deflection: boolean;
  relevance: number;
};
export function evaluateConversationResponse(input: {
  reply: string;
  turn: string;
  history: Message[];
  intent?: ConversationIntent;
}): ResponseEvaluation {
  const recent = input.history
    .filter(isAssistantMessage)
    .slice(-10)
    .map((m) => m.body);
  const reply = normalized(input.reply);
  const intent = input.intent ?? classifyConversationIntent(input.turn, input.history);
  const codes: string[] = [];
  if (!reply) codes.push("EMPTY_RESPONSE");
  if (recent.some((text) => tooSimilar(input.reply, text) || normalized(text) === reply))
    codes.push("REPEATED_RESPONSE");
  const isDeflection = deflection.test(reply);
  if (isDeflection) codes.push("GENERIC_DEFLECTION");
  const questions = input.reply.match(/[^.!?\n]*\?/g) ?? [];
  if (
    questions.some((question) =>
      recent.some((text) => normalized(text).includes(normalized(question))),
    ) ||
    (rhetorical.test(reply) &&
      recent.filter((text) => rhetorical.test(normalized(text))).length >= 2)
  )
    codes.push("REPEATED_RHETORICAL_QUESTION");
  const emojiCount = (input.reply.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (
    emojiCount > 2 ||
    (emojiCount > 0 &&
      recent.slice(-3).length === 3 &&
      recent.slice(-3).every((text) => /\p{Extended_Pictographic}/u.test(text)))
  )
    codes.push("EMOJI_OVERUSE");
  const directInterest = ["ROMANTIC_INTEREST", "INTIMATE_INTEREST"].includes(intent);
  if (directInterest && /\?/.test(input.reply) && (rhetorical.test(reply) || isDeflection))
    codes.push("UNANSWERED_INTEREST");
  if (
    directInterest &&
    /^(?:haha |lol |oh |mmm )?(?:nice|cool|sounds fun|okay|ok|tell me more|keep talking|im listening)[ .!]*$/.test(
      reply,
    )
  )
    codes.push("UNANSWERED_INTEREST");
  if (
    /\b(buy|pay|unlock)\b/.test(reply) &&
    (intent === "OBJECTION_HESITATION" || intent === "DISENGAGEMENT")
  )
    codes.push("PURCHASE_PRESSURE");
  if (
    ["OBJECTION_HESITATION", "DISENGAGEMENT"].includes(intent) &&
    ["FLIRTING", "ROMANTIC_INTEREST", "INTIMATE_INTEREST"].includes(
      classifyConversationIntent(input.reply),
    ) &&
    !/\b(no pressure|slow down|respect|comfortable|stop|wont|dont have to|take your time)\b/.test(
      reply,
    )
  )
    codes.push("CONSENT_PACING_MISMATCH");
  const repetition = codes.some((code) =>
    ["REPEATED_RESPONSE", "REPEATED_RHETORICAL_QUESTION"].includes(code),
  );
  const relevance = codes.some((code) =>
    ["EMPTY_RESPONSE", "GENERIC_DEFLECTION", "UNANSWERED_INTEREST", "PURCHASE_PRESSURE"].includes(
      code,
    ),
  )
    ? 0
    : 1;
  return {
    score: Math.max(
      0,
      100 - codes.reduce((n, code) => n + (code === "EMOJI_OVERUSE" ? 20 : 60), 0),
    ),
    codes,
    repetition,
    deflection: isDeflection,
    relevance,
  };
}

export function conversationQualityMetrics(history: Message[]) {
  const assistant = history.filter(isAssistantMessage).slice(-10);
  const evaluations = assistant.map((message) => {
    const index = history.indexOf(message);
    const preceding = history.slice(0, index);
    return evaluateConversationResponse({
      reply: message.body,
      turn: preceding.filter((m) => m.authorType === "SUBSCRIBER").at(-1)?.body ?? "",
      history: preceding,
    });
  });
  const rate = (predicate: (evaluation: ResponseEvaluation) => boolean) =>
    evaluations.length ? evaluations.filter(predicate).length / evaluations.length : 0;
  return {
    assistantSampleSize: evaluations.length,
    repetitionRate: rate((e) => e.repetition),
    deflectionRate: rate((e) => e.deflection),
    responseRelevance: rate((e) => e.relevance === 1),
    fanEngagement: assistant.length
      ? history.slice(history.indexOf(assistant[0]!)).filter((m) => m.authorType === "SUBSCRIBER")
          .length / assistant.length
      : 0,
  };
}
