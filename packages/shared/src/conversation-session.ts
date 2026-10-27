import { z } from "zod";
import { classifyConversationIntent, type ConversationIntent } from "./conversation-progression.js";
import { resolvePersonaControls, type PersonaControls } from "./persona-controls.js";

export const sessionStageSchema = z.enum([
  "OPENING",
  "PERSONA_DISCOVERY",
  "RAPPORT",
  "FLIRTING",
  "FREE_CONTENT",
  "PPV_OFFER",
  "PURCHASE_CONFIRMATION",
  "POST_PURCHASE",
  "OPTIONAL_OFFER",
  "CONCLUSION",
  "FOLLOW_UP",
]);
const sessionSchema = z.object({
  version: z.literal(1),
  stage: sessionStageSchema,
  lastTurnKey: z.string(),
  turns: z.number().int().nonnegative(),
  salesOptOut: z.boolean(),
  declinedProductIds: z.array(z.string()),
  purchasedProductIds: z.array(z.string()),
  seenOfferIds: z.array(z.string()),
  awaitingOfferId: z.string().optional(),
  followUps: z.number().int().nonnegative(),
  returningSubscriber: z.boolean(),
  topicChanged: z.boolean(),
});
export type ConversationSession = z.infer<typeof sessionSchema>;
export type SessionEvent =
  | {
      type: "FAN_TURN";
      key: string;
      text: string;
      history?: { authorType: string; body: string }[];
    }
  | { type: "OFFER_SENT"; id: string; productId: string }
  | { type: "OFFER_DECLINED"; productId: string }
  | { type: "PURCHASE_CONFIRMED"; productId: string }
  | { type: "FREE_CONTENT_SENT"; approvedMediaId: string }
  | { type: "NO_RESPONSE" }
  | { type: "RETURNING_SUBSCRIBER" };
export function readConversationSession(value?: string): ConversationSession | undefined {
  try {
    return sessionSchema.parse(JSON.parse(value ?? "null"));
  } catch {
    return undefined;
  }
}
export function initialConversationSession(): ConversationSession {
  return {
    version: 1,
    stage: "OPENING",
    lastTurnKey: "",
    turns: 0,
    salesOptOut: false,
    declinedProductIds: [],
    purchasedProductIds: [],
    seenOfferIds: [],
    followUps: 0,
    returningSubscriber: false,
    topicChanged: false,
  };
}
const unique = (values: string[]) => [...new Set(values)];
export function reduceConversationSession(
  previous: ConversationSession | undefined,
  event: SessionEvent,
  controls: PersonaControls = resolvePersonaControls(),
): ConversationSession {
  const state = { ...(previous ?? initialConversationSession()) };
  if (event.type === "RETURNING_SUBSCRIBER")
    return { ...state, returningSubscriber: true, stage: "RAPPORT" };
  if (event.type === "OFFER_SENT") {
    if (state.seenOfferIds.includes(event.id)) return state;
    // Delivery events are backend facts, not LLM recommendations or consent.
    return {
      ...state,
      seenOfferIds: unique([...state.seenOfferIds, event.id]),
      awaitingOfferId: event.id,
      stage: "PPV_OFFER",
      followUps: 0,
    };
  }
  if (event.type === "OFFER_DECLINED")
    return {
      ...state,
      declinedProductIds: unique([...state.declinedProductIds, event.productId]),
      awaitingOfferId: undefined,
      stage: "RAPPORT",
    };
  if (event.type === "PURCHASE_CONFIRMED") {
    if (state.purchasedProductIds.includes(event.productId)) return state;
    return {
      ...state,
      purchasedProductIds: unique([...state.purchasedProductIds, event.productId]),
      awaitingOfferId: undefined,
      stage: "PURCHASE_CONFIRMATION",
      followUps: 0,
    };
  }
  if (event.type === "FREE_CONTENT_SENT") return { ...state, stage: "FREE_CONTENT" };
  if (event.type === "NO_RESPONSE") {
    if (state.salesOptOut || state.stage === "CONCLUSION") return state;
    const followUps = state.followUps + 1;
    return {
      ...state,
      followUps,
      stage: followUps > controls.maxFollowUps ? "CONCLUSION" : "FOLLOW_UP",
    };
  }
  if (state.lastTurnKey === event.key) return state;
  state.lastTurnKey = event.key;
  state.turns += 1;
  state.topicChanged = false;
  state.followUps = 0;
  const text = event.text.toLowerCase().replace(/[’']/g, "");
  const intent = classifyConversationIntent(event.text, event.history);
  if (
    /\b(no (more )?(sales|offers|ppv)|stop (offering|selling|pitching)|dont (sell|pitch|offer)|just (want to )?(talk|chat)|ordinary conversation)\b/.test(
      text,
    )
  )
    state.salesOptOut = true;
  // Only a new, explicit shopping request reopens sales, not a short yes or an unrelated reply.
  else if (
    intent === "CONTENT_PURCHASE_INTEREST" &&
    /\b(buy|purchase|how much|price|show me (?:your|the) (?:content|photos|videos))\b/.test(text)
  )
    state.salesOptOut = false;
  if (intent === "DISENGAGEMENT") state.stage = "CONCLUSION";
  else if (intent === "OBJECTION_HESITATION" || state.salesOptOut) state.stage = "RAPPORT";
  else if (
    /\b(change (the )?(subject|topic)|anyway|something else|lets talk about|how was your day|what music|your hobbies)\b/.test(
      text,
    ) ||
    (intent === "CASUAL_CONVERSATION" &&
      ["PPV_OFFER", "OPTIONAL_OFFER", "FREE_CONTENT", "FLIRTING"].includes(state.stage))
  ) {
    state.topicChanged = true;
    state.stage = "RAPPORT";
  } else if (state.stage === "PURCHASE_CONFIRMATION") state.stage = "POST_PURCHASE";
  else if (intent === "CONTENT_PURCHASE_INTEREST")
    state.stage = state.purchasedProductIds.length ? "OPTIONAL_OFFER" : "PPV_OFFER";
  else if (["FLIRTING", "ROMANTIC_INTEREST", "INTIMATE_INTEREST"].includes(intent))
    state.stage = "FLIRTING";
  else if (state.stage === "OPENING") state.stage = "PERSONA_DISCOVERY";
  else if (["PERSONA_DISCOVERY", "CONCLUSION", "FOLLOW_UP"].includes(state.stage))
    state.stage = "RAPPORT";
  return state;
}
export function sessionAllowsSales(
  state: ConversationSession,
  intent: ConversationIntent,
  controls: PersonaControls,
): boolean {
  return (
    controls.allowSales &&
    controls.maxOffers > state.seenOfferIds.length &&
    !state.salesOptOut &&
    !state.topicChanged &&
    !["CONCLUSION", "PURCHASE_CONFIRMATION", "POST_PURCHASE"].includes(state.stage) &&
    intent === "CONTENT_PURCHASE_INTEREST"
  );
}
export const sessionObjectives: Record<ConversationSession["stage"], string> = {
  OPENING: "Respond to the greeting without a pitch.",
  PERSONA_DISCOVERY: "Learn a preference only if relevant; no mandatory intake checklist.",
  RAPPORT: "Answer the current topic. Keep declined offers and sales opt-outs respected.",
  FLIRTING:
    "Match the configured tone with a direct, non-graphic response; no repeating tease questions.",
  FREE_CONTENT:
    "Discuss only approved free media that the backend actually delivered; no assumed media delivery.",
  PPV_OFFER:
    "Answer a shopping request with one available catalog item and the backend-approved price. Purchase is optional.",
  PURCHASE_CONFIRMATION:
    "Acknowledge a backend-confirmed purchase. Do not assume delivery or propose another purchase.",
  POST_PURCHASE:
    "Engage warmly about the purchase or the current topic without an immediate upsell.",
  OPTIONAL_OFFER:
    "Offer another eligible item only on a fresh shopping request, never as a mandatory next step.",
  CONCLUSION: "Respect the ending. A brief warm closing is sufficient; no new question or offer.",
  FOLLOW_UP:
    "No response is not consent. At most the configured optional follow-ups, subject to existing send permissions.",
};
