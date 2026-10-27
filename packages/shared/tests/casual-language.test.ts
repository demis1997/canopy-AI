import { expect, it } from "vitest";
import {
  containsSexualLanguage,
  decideConversationTurn,
  looksLikeSextAsk,
  maskCasualProfanity,
  resolvePersonaControls,
  personaStyleCodes,
  validateReplyGrounding,
  detectOperationalIntent,
} from "../src/index.js";
it.each([
  "What the fuck, that bus is late",
  "Oh fuck, I missed the train",
  "For fuck's sake, another cancelled train",
  "For fucks sake, another cancelled train",
  "Fuck yeah, I finished the task",
  "That was fucking exhausting",
  "Fuck your alarm, it woke me up",
  "Fuck my commute",
  "That must suck, sorry about your day",
  "This will suck, but the commute is temporary",
])("keeps ordinary profanity in natural conversation: %s", (text) => {
  expect(looksLikeSextAsk(text)).toBe(false);
  expect(containsSexualLanguage(text)).toBe(false);
  expect(decideConversationTurn({ subscriberText: text }).responseMode).toBe("NATURAL");
});
it("does not let an idiom hide a directed sexual request", () => {
  for (const text of [
    "fuck me",
    "fuck you",
    "what the fuck me",
    "fucking your body",
    "that must suck your body",
  ]) {
    expect(maskCasualProfanity(text)).toBe(text);
    expect(containsSexualLanguage(text)).toBe(true);
  }
});
it("permits ordinary profanity in an ALLOW reply even if the fan did not swear", () => {
  const reply = "What the fuck, that cancellation is annoying.";
  expect(
    personaStyleCodes(
      reply,
      "The bus was cancelled",
      resolvePersonaControls({ casualProfanity: "ALLOW" }),
    ),
  ).toEqual([]);
  expect(
    validateReplyGrounding({
      reply,
      turn: "The bus was cancelled",
      operational: detectOperationalIntent("The bus was cancelled"),
      mode: "NATURAL",
      recommendedProductId: null,
    }),
  ).toEqual({ ok: true });
  expect(
    personaStyleCodes(
      reply,
      "The bus was cancelled",
      resolvePersonaControls({ casualProfanity: "AVOID" }),
    ),
  ).toContain("PERSONA_PROFANITY");
});
