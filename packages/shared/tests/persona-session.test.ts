import { describe, expect, it } from "vitest";
import {
  applyPersonaCasing,
  personaControlsSchema,
  personaStyleCodes,
  resolvePersonaControls,
} from "../src/persona-controls.js";
import {
  readConversationSession,
  reduceConversationSession,
  sessionAllowsSales,
} from "../src/conversation-session.js";
import { containsSexualLanguage } from "../src/operational-intent.js";
import { decideConversationTurn } from "../src/conversation-quality.js";
import { normalizeReplyBubbles } from "../src/replies.js";
import { personaInputSchema } from "../src/schemas.js";

const controls = resolvePersonaControls();
describe("independent persona voice controls", () => {
  it("preserves capitalisation and ordinary words across schema normalisation", () => {
    expect(normalizeReplyBubbles({ messages: ["Damn, that traffic sounds awful."] }).text).toBe(
      "Damn, that traffic sounds awful.",
    );
    expect(applyPersonaCasing("I Like Your Playlist", controls)).toBe("I Like Your Playlist");
    expect(
      applyPersonaCasing("I Like Your Playlist", resolvePersonaControls({ casing: "LOWERCASE" })),
    ).toBe("i like your playlist");
  });
  it("keeps casually profane conversation out of the sexual routing path", () => {
    for (const text of [
      "Fuck this traffic",
      "What a fucking day",
      "That was hard work",
      "Damn, traffic was awful",
    ]) {
      expect(containsSexualLanguage(text)).toBe(false);
      expect(decideConversationTurn({ subscriberText: text }).responseMode).toBe("NATURAL");
    }
  });
  it("validates configuration without admitting a policy bypass", () => {
    expect(personaControlsSchema.safeParse({ disableSafety: true }).success).toBe(false);
    expect(personaControlsSchema.safeParse({ maxQuestions: 9 }).success).toBe(false);
    expect(
      personaInputSchema.parse({
        displayName: "Maya",
        conversationControls: { directness: "DIRECT", casualProfanity: "ALLOW" },
      }).conversationControls.directness,
    ).toBe("DIRECT");
  });
  it("supports avoid, mirror and allow without rewriting words", () => {
    expect(personaStyleCodes("Damn, traffic is awful", "traffic was hell", controls)).toEqual([]);
    expect(personaStyleCodes("Damn, traffic is awful", "traffic was bad", controls)).toContain(
      "PERSONA_PROFANITY",
    );
    expect(
      personaStyleCodes(
        "Damn, traffic is awful",
        "traffic was bad",
        resolvePersonaControls({ casualProfanity: "ALLOW" }),
      ),
    ).toEqual([]);
    expect(
      personaStyleCodes("Damn", "damn", resolvePersonaControls({ casualProfanity: "AVOID" })),
    ).toContain("PERSONA_PROFANITY");
  });
  it("enforces emoji, question and vocabulary preferences independently", () => {
    const codes = personaStyleCodes(
      "sweetie, ready? 😏",
      "hello",
      resolvePersonaControls({
        maxQuestions: 0,
        emojiFrequency: "NONE",
        avoidedVocabulary: ["sweetie"],
      }),
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        "PERSONA_QUESTION_LIMIT",
        "PERSONA_EMOJI_LIMIT",
        "PERSONA_AVOIDED_VOCABULARY",
      ]),
    );
  });
});

describe("backend event driven optional sales sessions", () => {
  it("follows opening, discovery, rapport, free content, offer, purchase and engagement", () => {
    let state = reduceConversationSession(undefined, { type: "FAN_TURN", key: "1", text: "hi" });
    expect(state.stage).toBe("PERSONA_DISCOVERY");
    state = reduceConversationSession(state, { type: "FAN_TURN", key: "2", text: "I like music" });
    expect(state.stage).toBe("RAPPORT");
    state = reduceConversationSession(state, {
      type: "FREE_CONTENT_SENT",
      approvedMediaId: "preview-1",
    });
    expect(state.stage).toBe("FREE_CONTENT");
    state = reduceConversationSession(state, {
      type: "OFFER_SENT",
      id: "offer-1",
      productId: "real-item",
    });
    expect(state.stage).toBe("PPV_OFFER");
    state = reduceConversationSession(state, {
      type: "PURCHASE_CONFIRMED",
      productId: "real-item",
    });
    expect(state.stage).toBe("PURCHASE_CONFIRMATION");
    state = reduceConversationSession(state, {
      type: "FAN_TURN",
      key: "3",
      text: "That was lovely, thanks",
    });
    expect(state.stage).toBe("POST_PURCHASE");
    state = reduceConversationSession(state, {
      type: "FAN_TURN",
      key: "4",
      text: "How much for another set?",
    });
    expect(state.stage).toBe("OPTIONAL_OFFER");
  });
  it("keeps a sales opt-out across persisted state, rewrites and unrelated turns", () => {
    let state = reduceConversationSession(undefined, {
      type: "FAN_TURN",
      key: "a",
      text: "just want to chat, no more offers",
    });
    expect(state.salesOptOut).toBe(true);
    state = readConversationSession(JSON.stringify(state))!;
    state = reduceConversationSession(state, { type: "FAN_TURN", key: "b", text: "yes" });
    expect(state.salesOptOut).toBe(true);
    expect(sessionAllowsSales(state, "CONTENT_PURCHASE_INTEREST", controls)).toBe(false);
    state = reduceConversationSession(state, {
      type: "FAN_TURN",
      key: "c",
      text: "I would like to buy photos now",
    });
    expect(state.salesOptOut).toBe(false);
  });
  it("remembers a declined item and honours topic changes", () => {
    let state = reduceConversationSession(undefined, {
      type: "OFFER_SENT",
      id: "o1",
      productId: "p1",
    });
    state = reduceConversationSession(state, { type: "OFFER_DECLINED", productId: "p1" });
    expect(state.declinedProductIds).toContain("p1");
    state = reduceConversationSession(state, {
      type: "FAN_TURN",
      key: "change",
      text: "Anyway, what music do you like?",
    });
    expect(state.stage).toBe("RAPPORT");
    expect(state.topicChanged).toBe(true);
    expect(sessionAllowsSales(state, "CASUAL_CONVERSATION", controls)).toBe(false);
  });
  it("does not interpret purchase claims or silence as confirmed purchases", () => {
    let state = reduceConversationSession(undefined, {
      type: "FAN_TURN",
      key: "claim",
      text: "I bought it",
    });
    expect(state.purchasedProductIds).toEqual([]);
    state = reduceConversationSession(state, { type: "NO_RESPONSE" });
    expect(state.stage).toBe("FOLLOW_UP");
    state = reduceConversationSession(state, { type: "NO_RESPONSE" });
    expect(state.stage).toBe("CONCLUSION");
    expect(state.purchasedProductIds).toEqual([]);
    state = reduceConversationSession(state, { type: "NO_RESPONSE" });
    expect(state.followUps).toBe(2);
  });
  it("concludes on disengagement, supports returning subscribers and idempotent events", () => {
    let state = reduceConversationSession(undefined, { type: "FAN_TURN", key: "bye", text: "bye" });
    expect(state.stage).toBe("CONCLUSION");
    state = reduceConversationSession(state, { type: "RETURNING_SUBSCRIBER" });
    expect(state.returningSubscriber).toBe(true);
    state = reduceConversationSession(state, { type: "OFFER_SENT", id: "o1", productId: "p1" });
    expect(
      reduceConversationSession(state, { type: "OFFER_SENT", id: "o1", productId: "p1" }),
    ).toEqual(state);
    state = reduceConversationSession(state, { type: "PURCHASE_CONFIRMED", productId: "p1" });
    expect(
      reduceConversationSession(state, { type: "PURCHASE_CONFIRMED", productId: "p1" }),
    ).toEqual(state);
  });
  it("rejects corrupt saved state and enforces creator sales limits", () => {
    expect(readConversationSession('{"stage":"x"}')).toBeUndefined();
    const state = reduceConversationSession(undefined, {
      type: "FAN_TURN",
      key: "shop",
      text: "how much?",
    });
    expect(
      sessionAllowsSales(
        state,
        "CONTENT_PURCHASE_INTEREST",
        resolvePersonaControls({ allowSales: false }),
      ),
    ).toBe(false);
    expect(
      sessionAllowsSales(
        state,
        "CONTENT_PURCHASE_INTEREST",
        resolvePersonaControls({ maxOffers: 0 }),
      ),
    ).toBe(false);
  });
});
