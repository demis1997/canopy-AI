import { z } from "zod";
import { resolvePersonaControls, type PersonaControls } from "./persona-controls.js";
import { type ConversationSession, sessionObjectives } from "./conversation-session.js";

export const subscriberPreferenceSchema = z.enum([
  "UNKNOWN",
  "PREFERS_LEADING",
  "PREFERS_FOLLOWING",
  "FLEXIBLE",
  "NEUTRAL",
]);
export type SubscriberPreference = z.infer<typeof subscriberPreferenceSchema>;
export const SUBSCRIBER_PERSONA_KEY = "subscriber_persona_v1";
const stateSchema = z.object({
  version: z.literal(1),
  preference: subscriberPreferenceSchema,
  confidence: z.number().min(0).max(1),
  evidence: z
    .array(
      z.object({
        turnKey: z.string(),
        preference: subscriberPreferenceSchema,
        source: z.enum(["EXPLICIT", "CONTEXTUAL"]),
      }),
    )
    .max(8),
  activePersona: z.enum(["DEFAULT", "SOFT_PLAYFUL", "CONFIDENT_ASSERTIVE"]),
  questionAsked: z.boolean(),
  lastTurnKey: z.string(),
  lastSeenAt: z.string(),
  boundaries: z.array(z.string()).max(12),
  lastObjective: z.string(),
});
export type SubscriberPersonaState = z.infer<typeof stateSchema>;
export function readSubscriberPersona(value?: string): SubscriberPersonaState | undefined {
  try {
    return stateSchema.parse(JSON.parse(value ?? "null"));
  } catch {
    return undefined;
  }
}
export function isDynamicPreferenceQuestion(text: string): boolean {
  return (
    /\?/.test(text) &&
    /\b(lead|leading|take charge|in charge|follow|following)\b/i.test(text) &&
    /\b(prefer|rather|like|want|comfortable)\b|\b(?:me or you|you or me|who(?:s| is))\b/i.test(
      normalize(text),
    )
  );
}
const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ");

// Deliberately accepts conversational text only: no identity, demographics or spend inputs.
export function detectSubscriberPreference(
  text: string,
  precedingCreatorMessage?: string,
):
  | {
      preference: SubscriberPreference;
      confidence: number;
      source: "EXPLICIT" | "CONTEXTUAL";
    }
  | undefined {
  const value = normalize(text);
  // The latest explicit clause wins when someone corrects themselves in the same turn.
  const clauses = value.split(/[.!?;]|\b(?:but|actually|instead)\b/).reverse();
  for (const clause of clauses) {
    if (/\b(not sure|dont know|unsure|might|maybe|what if)\b/.test(clause)) continue;
    // Occupational leadership and third-party quotations are not conversational preferences.
    if (
      /\b(?:lead(?:ing)? (?:my|our|the) (?:team|department|company|project)|(?:at|for) work|my (?:friend|partner) (?:said|says|prefers))\b/.test(
        clause,
      )
    )
      continue;
    const dynamicContext =
      /\b(lead|leading|following|being led|dynamic|in charge|take charge)\b/.test(clause) ||
      Boolean(precedingCreatorMessage && isDynamicPreferenceQuestion(precedingCreatorMessage));
    const genericAnswer =
      /^\s*(?:(?:i have )?no preference|i dont have a preference|neither|(?:im|i am) flexible|either (?:way(?: works| is fine)?|works|is fine)|both (?:work|are fine)|i (?:like|enjoy|prefer) (?:both|switching)|(?:lets )?keep (?:it|things) neutral|i prefer (?:a )?neutral)\s*,?\s*$/.test(
        clause,
      );
    let preference: SubscriberPreference | undefined;
    if (
      (dynamicContext || genericAnswer) &&
      /\b(no preference|neither|keep (?:it|things) neutral|prefer (?:a )?neutral|dont have a preference)\b/.test(
        clause,
      )
    )
      preference = "NEUTRAL";
    else if (
      (dynamicContext || genericAnswer) &&
      /\b(either (?:way|works|is fine)|both (?:work|are fine)|(?:im|i am) flexible|(?:i like|i enjoy|i prefer) (?:both|switching))\b/.test(
        clause,
      )
    )
      preference = "FLEXIBLE";
    else if (
      /\b(?:(?:i|id|i would) (?:prefer|like|want|enjoy|rather) (?:you |someone else )(?:to )?(?:lead|leading|taking (?:the )?lead|take (?:the )?lead|take charge)|(?:you|please) (?:can |should )?(?:take the lead|take charge)|i (?:prefer|like|enjoy) (?:to follow|following|being led)|i (?:(?:dont|do not) (?:want|like) to|prefer not to) (?:lead|take charge))\b/.test(
        clause,
      )
    )
      preference = "PREFERS_FOLLOWING";
    else if (
      /\b(?:(?:i|id|i would) (?:prefer|like|want|enjoy|rather) (?:to )?(?:lead|leading|taking (?:the )?lead|taking charge|take the lead|take charge|being in charge|in charge)|let me (?:lead|take the lead)|(?:dont|do not) (?:lead me|take charge))\b/.test(
        clause,
      )
    )
      preference = "PREFERS_LEADING";
    if (preference) return { preference, confidence: 0.98, source: "EXPLICIT" };
  }
  if (precedingCreatorMessage && isDynamicPreferenceQuestion(precedingCreatorMessage)) {
    if (/^(?:me|myself|ill lead|taking the lead|leading|i will lead)[,.! ]*$/.test(value))
      return { preference: "PREFERS_LEADING", confidence: 0.85, source: "CONTEXTUAL" };
    if (/^(?:you|you lead|following|being led|you can lead)[,.! ]*$/.test(value))
      return { preference: "PREFERS_FOLLOWING", confidence: 0.85, source: "CONTEXTUAL" };
  }
  return undefined;
}
export function advanceSubscriberPersona(input: {
  previous?: SubscriberPersonaState;
  turnKey: string;
  text: string;
  history: { authorType: string; body: string }[];
  now: string;
}): SubscriberPersonaState {
  const previous = input.previous;
  const state: SubscriberPersonaState = previous
    ? { ...previous }
    : {
        version: 1,
        preference: "UNKNOWN",
        confidence: 0,
        evidence: [],
        activePersona: "DEFAULT",
        questionAsked: false,
        lastTurnKey: "",
        lastSeenAt: "",
        boundaries: [],
        lastObjective: "Respond to the current topic.",
      };
  const creatorMessages = input.history.filter((m) =>
    ["CREATOR", "CHATTER"].includes(m.authorType),
  );
  state.questionAsked ||= creatorMessages.some((m) => isDynamicPreferenceQuestion(m.body));
  if (state.lastTurnKey === input.turnKey) return state;
  const detected = detectSubscriberPreference(input.text, creatorMessages.at(-1)?.body);
  if (detected) {
    state.preference = detected.preference;
    state.confidence = detected.confidence;
    state.evidence = [
      ...state.evidence,
      { turnKey: input.turnKey, preference: detected.preference, source: detected.source },
    ].slice(-8);
  }
  // Explicit boundaries are retained as subscriber statements, never interpreted as consent.
  const boundaries = input.text
    .split(/[.!?]/)
    .filter((clause) =>
      /\b(dont|do not|stop|no more|not comfortable|rather not|no (?:pet names|offers|sales))\b/i.test(
        normalize(clause),
      ),
    )
    .filter((clause) => !detectSubscriberPreference(clause))
    .map((clause) => clause.trim().slice(0, 240));
  state.boundaries = [...new Set([...state.boundaries, ...boundaries])].slice(-12);
  state.lastTurnKey = input.turnKey;
  state.lastSeenAt = input.now;
  state.activePersona =
    state.preference === "PREFERS_LEADING"
      ? "SOFT_PLAYFUL"
      : state.preference === "PREFERS_FOLLOWING"
        ? "CONFIDENT_ASSERTIVE"
        : "DEFAULT";
  return state;
}
export function routeSubscriberPersona(
  state: SubscriberPersonaState,
  base: PersonaControls,
): {
  controls: PersonaControls;
  instruction: string;
} {
  if (state.activePersona === "SOFT_PLAYFUL")
    return {
      controls: resolvePersonaControls({ ...base, characterization: "SOFT", pacing: "GRADUAL" }),
      instruction:
        "Use a softer, playful variation of the creator's own voice. Let the subscriber choose direction and pace. Answer substantively without coy deflections. Do not invent submission, obedience or consent.",
    };
  if (state.activePersona === "CONFIDENT_ASSERTIVE")
    return {
      controls: resolvePersonaControls({
        ...base,
        characterization: "ASSERTIVE",
        directness: "DIRECT",
        pacing: "RESPONSIVE",
      }),
      instruction:
        "Use a confident, assertive variation of the creator's own voice. Offer clear, respectful conversational direction without orders, pressure or assumptions of consent. Respect boundaries and topic changes immediately.",
    };
  return {
    controls: { ...base },
    instruction:
      "Use the default configured creator voice. Do not assume a preferred dynamic. FLEXIBLE means no fixed route, not permission to escalate.",
  };
}
export function subscriberPersonaObjective(
  state: SubscriberPersonaState,
  session: ConversationSession,
): string {
  return `${sessionObjectives[session.stage]} ${state.preference === "UNKNOWN" && !state.questionAsked && !session.topicChanged && ["PERSONA_DISCOVERY", "FLIRTING"].includes(session.stage) ? "If relevant, you may ask once whether they prefer taking the lead or having you lead; answering is optional." : "Do not ask a dynamic preference question; continue the current topic."}`;
}

export function subscriberPersonaResponseCodes(
  text: string,
  state?: SubscriberPersonaState,
): string[] {
  return state &&
    (state.preference !== "UNKNOWN" || state.questionAsked) &&
    isDynamicPreferenceQuestion(text)
    ? ["REPEATED_DYNAMIC_PREFERENCE_QUESTION"]
    : [];
}
