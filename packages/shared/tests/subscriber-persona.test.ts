import { describe, expect, it } from "vitest";
import {
  advanceSubscriberPersona,
  detectSubscriberPreference,
  readSubscriberPersona,
  routeSubscriberPersona,
  subscriberPersonaResponseCodes,
  resolvePersonaControls,
  reduceConversationSession,
  readConversationSession,
  sessionAllowsSales,
  subscriberPersonaObjective,
} from "../src/index.js";
const now = "2026-10-27T10:00:00Z";
const turn = (
  text: string,
  previous?: ReturnType<typeof advanceSubscriberPersona>,
  key = text,
  history: { authorType: string; body: string }[] = [],
) => advanceSubscriberPersona({ text, previous, turnKey: key, history, now });
describe("subscriber preference evidence", () => {
  it.each([
    ["I prefer taking the lead", "PREFERS_LEADING"],
    ["I like to lead", "PREFERS_LEADING"],
    ["I want you to lead", "PREFERS_FOLLOWING"],
    ["I prefer following", "PREFERS_FOLLOWING"],
    ["I’d rather you lead", "PREFERS_FOLLOWING"],
    ["I’d like to lead", "PREFERS_LEADING"],
    ["I prefer not to lead", "PREFERS_FOLLOWING"],
    ["I don't want to lead", "PREFERS_FOLLOWING"],
    ["I am flexible", "FLEXIBLE"],
    ["No preference", "NEUTRAL"],
  ])("classifies %s", (text, expected) => {
    expect(turn(text).preference).toBe(expected);
  });
  it("does not infer preference from demographic, identity, spend or casual language", () => {
    for (const text of [
      "I'm a man",
      "I spent $200",
      "I'm a shy person",
      "What the fuck, my train is late",
      "I manage a team",
      "I prefer leading my team",
      "I like following at work",
      "yes",
    ])
      expect(turn(text).preference).toBe("UNKNOWN");
  });
  it("uses a short contextual answer only after an actual preference question", () => {
    expect(detectSubscriberPreference("you")).toBeUndefined();
    const state = turn("you", undefined, "answer", [
      { authorType: "CHATTER", body: "Do you prefer taking the lead or having me lead?" },
    ]);
    expect(state).toMatchObject({
      preference: "PREFERS_FOLLOWING",
      questionAsked: true,
      confidence: 0.85,
    });
    expect(subscriberPersonaResponseCodes("Do you prefer taking the lead?", state)).toContain(
      "REPEATED_DYNAMIC_PREFERENCE_QUESTION",
    );
  });
  it("allows corrections, including a correction later in the same turn", () => {
    const leading = turn("I prefer leading");
    const following = turn("Actually I like following", leading);
    expect(following.preference).toBe("PREFERS_FOLLOWING");
    expect(following.evidence).toHaveLength(2);
    expect(turn("I prefer leading, but actually I want you to lead").preference).toBe(
      "PREFERS_FOLLOWING",
    );
    expect(turn("No preference", following).activePersona).toBe("DEFAULT");
  });
  it("is idempotent and remembers preference across sessions and days", () => {
    const state = turn("I like following");
    const retained = readSubscriberPersona(JSON.stringify(state));
    expect(
      advanceSubscriberPersona({
        previous: retained,
        text: "Hi again",
        turnKey: "return",
        history: [],
        now: "2026-11-04T10:00:00Z",
      }),
    ).toMatchObject({ preference: "PREFERS_FOLLOWING", activePersona: "CONFIDENT_ASSERTIVE" });
    expect(turn("I like following", state).evidence).toHaveLength(1);
    expect(readSubscriberPersona("broken")).toBeUndefined();
  });
  it("keeps subscriber states independent", () => {
    const a = turn("I like following");
    const b = turn("Hello");
    expect(b.preference).toBe("UNKNOWN");
    expect(a.preference).toBe("PREFERS_FOLLOWING");
  });
});
describe("persona overlay and conversation facts", () => {
  it.each(["AVOID", "MIRROR", "ALLOW"] as const)(
    "preserves %s and configured vocabulary",
    (casualProfanity) => {
      const base = resolvePersonaControls({
        casualProfanity,
        preferredVocabulary: ["lovely"],
        maxQuestions: 0,
      });
      const following = routeSubscriberPersona(turn("I want you to lead"), base);
      const leading = routeSubscriberPersona(turn("Let me lead"), base);
      expect(following.controls).toMatchObject({
        characterization: "ASSERTIVE",
        directness: "DIRECT",
        casualProfanity,
        maxQuestions: 0,
        preferredVocabulary: ["lovely"],
      });
      expect(leading.controls).toMatchObject({
        characterization: "SOFT",
        pacing: "GRADUAL",
        casualProfanity,
      });
      expect(base.characterization).toBe("NEUTRAL");
      expect(routeSubscriberPersona(turn("Either way works"), base).controls).toEqual(base);
    },
  );
  it("retains explicit boundaries and stops sales on topic change", () => {
    expect(turn("Don't use pet names").boundaries).toEqual(["Don't use pet names"]);
    let state = reduceConversationSession(undefined, {
      type: "OFFER_SENT",
      id: "offer",
      productId: "catalog-item",
    });
    state = reduceConversationSession(state, {
      type: "FAN_TURN",
      key: "topic",
      text: "Anyway, what music do you like?",
    });
    expect(state.topicChanged).toBe(true);
    expect(sessionAllowsSales(state, "CASUAL_CONVERSATION", resolvePersonaControls())).toBe(false);
  });
  it("remembers a declined offer without assuming payment or repitching", () => {
    let state = reduceConversationSession(undefined, {
      type: "OFFER_SENT",
      id: "offer",
      productId: "catalog-item",
    });
    state = reduceConversationSession(state, {
      type: "FAN_TURN",
      key: "decline",
      text: "No thanks, not buying",
    });
    expect(state.lastOffer?.status).toBe("DECLINED");
    expect(state.declinedProductIds).toContain("catalog-item");
    expect(state.purchasedProductIds).toEqual([]);
    expect(readConversationSession(JSON.stringify(state))).toEqual(state);
  });
  it("only confirms backend purchases and preserves the post-purchase branch", () => {
    let state = reduceConversationSession(undefined, {
      type: "OFFER_SENT",
      id: "offer",
      productId: "catalog-item",
    });
    state = reduceConversationSession(state, {
      type: "FAN_TURN",
      key: "claimed",
      text: "I bought that",
    });
    expect(state.purchasedProductIds).toEqual([]);
    state = reduceConversationSession(state, {
      type: "PURCHASE_CONFIRMED",
      productId: "catalog-item",
    });
    expect(state).toMatchObject({
      stage: "PURCHASE_CONFIRMATION",
      lastOffer: { status: "PURCHASED" },
    });
    expect(sessionAllowsSales(state, "CONTENT_PURCHASE_INTEREST", resolvePersonaControls())).toBe(
      false,
    );
    state = reduceConversationSession(state, {
      type: "FAN_TURN",
      key: "thanks",
      text: "Thanks, that was nice",
    });
    expect(state.stage).toBe("POST_PURCHASE");
  });
  it("makes preference discovery optional and does not reopen it for neutral subscribers", () => {
    const session = reduceConversationSession(undefined, {
      type: "FAN_TURN",
      key: "hi",
      text: "hello",
    });
    expect(subscriberPersonaObjective(turn("Hello"), session)).toContain("may ask once");
    expect(subscriberPersonaObjective(turn("No preference"), session)).toContain("Do not ask");
  });
});
it("does not promote uncertain or hypothetical preferences", () => {
  expect(turn("I'm not sure I want you to lead").preference).toBe("UNKNOWN");
  expect(turn("Maybe I prefer leading").preference).toBe("UNKNOWN");
});
it("upgrades an older saved session without replaying an offer", () => {
  const session = reduceConversationSession(undefined, {
    type: "OFFER_SENT",
    id: "old-offer",
    productId: "item",
  });
  const legacy = { ...session };
  delete legacy.lastOffer;
  const upgraded = reduceConversationSession(legacy, {
    type: "OFFER_SENT",
    id: "old-offer",
    productId: "item",
  });
  expect(upgraded.lastOffer?.productId).toBe("item");
  expect(upgraded.seenOfferIds).toHaveLength(1);
});

it("does not confuse unrelated topic preferences with conversational dynamics", () => {
  const state = turn("I like leading");
  expect(turn("No preference on pizza toppings", state).preference).toBe("PREFERS_LEADING");
  expect(turn("Either way works for the playlist", state).preference).toBe("PREFERS_LEADING");
});
