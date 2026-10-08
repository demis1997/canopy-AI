import { describe, expect, it } from "vitest";
import {
  collectPendingFanTurn,
  containsSexualLanguage,
  detectOperationalIntent,
  determineResponseMode,
  isGenerationStale,
  operationalGenerationPlan,
  shouldOpenEscalation,
  validateReplyGrounding,
} from "../src/operational-intent.js";

describe("detectOperationalIntent", () => {
  it("routes redirect me to a human", () => {
    expect(detectOperationalIntent("redirect me to a human").intent).toBe("HUMAN_REQUEST");
  });

  it("routes combined AI suspicion plus handoff as HUMAN_REQUEST", () => {
    const route = detectOperationalIntent("im talking to an ai redirect me to a human");
    expect(route.intent).toBe("HUMAN_REQUEST");
    expect(route.shouldGenerate).toBe(false);
    expect(route.shouldPauseAutomation).toBe(true);
    expect(route.allowSexual).toBe(false);
  });

  it("routes let me talk to a real person", () => {
    expect(detectOperationalIntent("let me talk to a real person").intent).toBe("HUMAN_REQUEST");
  });

  it("routes are you a bot as AI_SUSPICION without a transfer", () => {
    const route = detectOperationalIntent("are you a bot?");
    expect(route.intent).toBe("AI_SUSPICION");
    expect(route.shouldGenerate).toBe(false);
    expect(route.allowSexual).toBe(false);
  });

  it("does not trip on you're only human or human nature", () => {
    expect(detectOperationalIntent("you're only human").intent).toBe("NONE");
    expect(detectOperationalIntent("that's just human nature").intent).toBe("NONE");
  });

  it("keeps HUMAN_REQUEST during an explicit sexual exchange", () => {
    const route = detectOperationalIntent("fuck that im talking to an ai redirect me to a human");
    expect(route.intent).toBe("HUMAN_REQUEST");
    expect(operationalGenerationPlan(route).skipGenerate).toBe(true);
    expect(operationalGenerationPlan(route).skipClassify).toBe(true);
    expect(operationalGenerationPlan(route).skipTraining).toBe(true);
  });

  it("keeps HUMAN_REQUEST during a sales ask", () => {
    expect(detectOperationalIntent("how much is the ppv? actually redirect me to a human").intent).toBe(
      "HUMAN_REQUEST",
    );
  });
});

describe("response mode and grounding", () => {
  it("does not force EXPLICIT from historical context when the latest turn is a question", () => {
    const operational = detectOperationalIntent("how old are you?");
    expect(determineResponseMode({ operational, subscriberText: "how old are you?" })).toBe("NATURAL");
  });

  it("rejects unrelated sexual output for a neutral message", () => {
    const operational = detectOperationalIntent("how was your day");
    const mode = determineResponseMode({ operational, subscriberText: "how was your day" });
    expect(containsSexualLanguage("i keep thinking about my mouth on u")).toBe(true);
    expect(
      validateReplyGrounding({
        reply: "i keep thinking about my mouth on u",
        turn: "how was your day",
        operational,
        mode,
      }).ok,
    ).toBe(false);
  });

  it("rejects sexual output for support and complaint turns", () => {
    const support = detectOperationalIntent("I need help with my billing issue");
    expect(support.intent).toBe("SUPPORT_REQUEST");
    expect(
      validateReplyGrounding({
        reply: "i keep thinking about my mouth on u",
        turn: "I need help with my billing issue",
        operational: support,
        mode: "SUPPORT",
      }).code,
    ).toBe("SEXUAL_NOT_ALLOWED");
  });

  it("forbids any generated reply on a human request", () => {
    const operational = detectOperationalIntent("im talking to an ai redirect me to a human");
    expect(
      validateReplyGrounding({
        reply: "i keep thinking about my mouth on u",
        turn: "im talking to an ai redirect me to a human",
        operational,
        mode: "OPERATIONAL",
      }).code,
    ).toBe("IGNORED_HUMAN_REQUEST");
  });
});

describe("collectPendingFanTurn", () => {
  it("combines two rapid subscriber messages since the last creator send", () => {
    const turn = collectPendingFanTurn({
      messages: [
        { id: "c1", authorType: "CHATTER", body: "hey" },
        { id: "s1", authorType: "SUBSCRIBER", body: "wait" },
        { id: "s2", authorType: "SUBSCRIBER", body: "im talking to an ai redirect me to a human" },
      ],
    });
    expect(turn.messageIds).toEqual(["s1", "s2"]);
    expect(turn.combinedText).toContain("wait");
    expect(turn.combinedText).toContain("redirect me to a human");
    expect(detectOperationalIntent(turn.combinedText).intent).toBe("HUMAN_REQUEST");
  });

  it("does not include messages older than the last creator response", () => {
    const turn = collectPendingFanTurn({
      messages: [
        { id: "s0", authorType: "SUBSCRIBER", body: "old" },
        { id: "c1", authorType: "CHATTER", body: "hey" },
        { id: "s1", authorType: "SUBSCRIBER", body: "new" },
      ],
      triggerMessageId: "s1",
    });
    expect(turn.messageIds).toEqual(["s1"]);
  });
});

describe("stale generation and escalation idempotency", () => {
  it("marks output stale when a newer subscriber message exists", () => {
    expect(
      isGenerationStale({ newestInputMessageId: "s1", newerSubscriberMessageId: "s2" }),
    ).toBe(true);
    expect(
      isGenerationStale({ newestInputMessageId: "s1", newerSubscriberMessageId: null }),
    ).toBe(false);
  });

  it("does not open a second escalation when one is already open", () => {
    expect(shouldOpenEscalation(true)).toBe(false);
    expect(shouldOpenEscalation(false)).toBe(true);
  });
});

describe("speaker continuity", () => {
  it("does not resurrect an answered fan turn when an old trigger is retried", () => {
    const messages = [
      { id: "fan-1", authorType: "SUBSCRIBER", body: "how are you?" },
      { id: "creator-1", authorType: "CHATTER", body: "I'm good" },
    ];
    expect(collectPendingFanTurn({ messages, triggerMessageId: "fan-1" }).combinedText).toBe("");
    expect(collectPendingFanTurn({ messages }).combinedText).toBe("");
  });
  it("collects only the actual fan's new words after a creator reply", () => {
    expect(collectPendingFanTurn({ messages: [
      { id: "fan-1", authorType: "SUBSCRIBER", body: "how are you?" },
      { id: "creator-1", authorType: "CHATTER", body: "I'm good" },
      { id: "fan-2", authorType: "SUBSCRIBER", body: "what are you doing?" },
    ] }).combinedText).toBe("what are you doing?");
  });
});

it("rejects attributing the creator's wellbeing to a fan who only asked how are you", () => {
  const operational = detectOperationalIntent("how are you?");
  expect(validateReplyGrounding({ reply: "im good, oh youre good nice", turn: "how are you?", operational, mode: "NATURAL" })).toEqual({ ok: false, code: "SPEAKER_ATTRIBUTION" });
  expect(validateReplyGrounding({ reply: "im good, how about you?", turn: "how are you?", operational, mode: "NATURAL" }).ok).toBe(true);
});
