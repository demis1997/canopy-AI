import { describe, expect, it } from "vitest";
import {
  advanceProgression,
  classifyConversationIntent,
  conversationQualityMetrics,
  evaluateConversationResponse,
  readProgression,
  type ProgressionState,
} from "../src/conversation-progression.js";
import { decideConversationTurn } from "../src/conversation-quality.js";

describe("fan-driven conversation progression", () => {
  it("simulates an adult conversation through all six stages and respects hesitation", () => {
    let previous: ProgressionState | undefined;
    const turns = [
      ["hello", "INTRODUCTION", 0],
      ["you are gorgeous", "FLIRTING", 0],
      ["I really like you", "MUTUAL_INTEREST", 0],
      ["I want to cuddle close to you", "INTIMATE_CONVERSATION", 0],
      ["what is the price of your photos?", "CONTENT_OFFER", 0],
      ["thanks, that was lovely", "AFTERCARE_RETENTION", 1],
      ["slow down please", "INTRODUCTION", 1],
    ] as const;
    turns.forEach(([text, expected, purchaseCount], index) => {
      previous = advanceProgression({ previous, text, turnKey: String(index), purchaseCount });
      expect(previous.stage).toBe(expected);
    });
  });
  it("does not manufacture intimacy from time spent chatting", () => {
    let previous: ProgressionState | undefined;
    for (let i = 0; i < 30; i++)
      previous = advanceProgression({ previous, text: "I like cooking", turnKey: String(i) });
    expect(previous?.stage).toBe("INTRODUCTION");
  });
  it("makes rewrites idempotent and remembers state across history truncation", () => {
    const previous = advanceProgression({ text: "you are cute", turnKey: "m1" });
    expect(advanceProgression({ previous, text: "you are cute", turnKey: "m1" })).toBe(previous);
    const next = advanceProgression({
      previous: readProgression(JSON.stringify(previous)),
      text: "I want to kiss you",
      turnKey: "m2",
      history: [],
    });
    expect(next.stage).toBe("INTIMATE_CONVERSATION");
    expect(readProgression('{"stage":"FAKE"}')).toBeUndefined();
  });
  it.each([
    ["hi", "CASUAL_CONVERSATION"],
    ["you are cute", "FLIRTING"],
    ["I like you", "ROMANTIC_INTEREST"],
    ["hold me close", "INTIMATE_INTEREST"],
    ["how much is it?", "CONTENT_PURCHASE_INTEREST"],
    ["not now", "OBJECTION_HESITATION"],
    ["stop messaging me", "DISENGAGEMENT"],
    ["I don't want to buy", "OBJECTION_HESITATION"],
  ])("classifies %s", (text, intent) => expect(classifyConversationIntent(text)).toBe(intent));
  it("grounds a short agreement in the previous creator message", () => {
    expect(
      classifyConversationIntent("me too", [{ authorType: "CHATTER", body: "I like you" }]),
    ).toBe("ROMANTIC_INTEREST");
    expect(
      classifyConversationIntent("yes", [{ authorType: "CHATTER", body: "How was work?" }]),
    ).toBe("CASUAL_CONVERSATION");
  });
  it("honours hesitation before purchase words and preserves operational routing", () => {
    expect(decideConversationTurn({ subscriberText: "I don't want to buy" }).allowPitch).toBe(
      false,
    );
    expect(
      decideConversationTurn({ subscriberText: "I like you, but are you a bot?" }).responseMode,
    ).toBe("OPERATIONAL");
  });
});

describe("ten assistant message quality window", () => {
  const history = Array.from({ length: 10 }, (_, i) => ({
    authorType: "CHATTER",
    body: `A distinct statement number ${i}`,
  }));
  it("detects repeats ten assistant messages back despite intervening fan messages", () => {
    const interleaved = history.flatMap((m) => [
      m,
      ...Array.from({ length: 6 }, () => ({ authorType: "SUBSCRIBER", body: "hello" })),
    ]);
    expect(
      evaluateConversationResponse({ reply: history[0]!.body, turn: "hi", history: interleaved })
        .codes,
    ).toContain("REPEATED_RESPONSE");
    expect(
      evaluateConversationResponse({
        reply: "An old unique statement",
        turn: "hi",
        history: [{ authorType: "CHATTER", body: "An old unique statement" }, ...history],
      }).codes,
    ).not.toContain("REPEATED_RESPONSE");
  });
  it.each(["you're trouble", "maybe, maybe not", "wouldn't you like to know?"])(
    "penalizes %s",
    (reply) => {
      const result = evaluateConversationResponse({ reply, turn: "I like you", history: [] });
      expect(result.deflection).toBe(true);
      expect(result.score).toBeLessThan(60);
    },
  );
  it("detects repeated rhetorical questions and emoji saturation", () => {
    const history = ["Are you ready? 😌", "Can you handle it? 😌", "Oh really? 😌"].map((body) => ({
      authorType: "CHATTER",
      body,
    }));
    const result = evaluateConversationResponse({
      reply: "Want to find out? 😌",
      turn: "I want to be close to you",
      history,
    });
    expect(result.codes).toEqual(
      expect.arrayContaining([
        "REPEATED_RHETORICAL_QUESTION",
        "EMOJI_OVERUSE",
        "UNANSWERED_INTEREST",
      ]),
    );
  });
  it("distinguishes a direct affectionate reply from evasion and pressure", () => {
    expect(
      evaluateConversationResponse({
        reply: "I like the warmth in what you said. I'm enjoying this conversation.",
        turn: "I like you",
        history: [],
      }).score,
    ).toBe(100);
    expect(
      evaluateConversationResponse({ reply: "Buy it now", turn: "not now", history: [] }).codes,
    ).toContain("PURCHASE_PRESSURE");
  });
  it("reports metrics from actual creator messages, ignoring system messages", () => {
    const metrics = conversationQualityMetrics([
      { authorType: "SYSTEM", body: "maybe maybe not" },
      { authorType: "SUBSCRIBER", body: "I like you" },
      { authorType: "CHATTER", body: "you're trouble" },
      { authorType: "SUBSCRIBER", body: "I mean it" },
      { authorType: "CHATTER", body: "you're trouble" },
    ]);
    expect(metrics.assistantSampleSize).toBe(2);
    expect(metrics.deflectionRate).toBe(1);
    expect(metrics.repetitionRate).toBe(0.5);
  });
});
it("respects withdrawn interest", () => {
  expect(
    evaluateConversationResponse({
      reply: "I want to kiss you",
      turn: "not comfortable",
      history: [],
    }).codes,
  ).toContain("CONSENT_PACING_MISMATCH");
  expect(
    evaluateConversationResponse({
      reply: "Of course, we can slow down. No pressure.",
      turn: "not comfortable",
      history: [],
    }).score,
  ).toBe(100);
});
it("uses existing sent history and moves repeated romantic interest into emotional intimacy", () => {
  const history = [
    { authorType: "SUBSCRIBER", body: "I like you" },
    { authorType: "CHATTER", body: "I enjoy your warmth" },
    { authorType: "SUBSCRIBER", body: "I feel connected to you" },
    { authorType: "CHATTER", body: "I appreciate you sharing that" },
    { authorType: "SUBSCRIBER", body: "I really like you" },
  ];
  expect(advanceProgression({ history, text: "I really like you", turnKey: "new" }).stage).toBe(
    "INTIMATE_CONVERSATION",
  );
});
