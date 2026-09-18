import { describe, expect, it } from "vitest";
import {
  collectPendingFanTurn,
  decideConversationTurn,
  detectOperationalIntent,
  validateQualityGrounding,
} from "../src/index.js";

describe("conversation quality decisions", () => {
  it("routes hey how are you to NATURAL without sex or pitch", () => {
    const turn = decideConversationTurn({ subscriberText: "hey how are you?" });
    expect(turn.responseMode).toBe("NATURAL");
    expect(turn.salesReadiness).toBe("CONNECTING");
    expect(turn.intakeOpportunity).toBe(false);
    expect(turn.allowPitch).toBe(false);
    expect(turn.debugExplanation).toMatch(/greeted and asked how the creator was/i);
  });

  it("acknowledges emotion as NATURAL and pauses intake", () => {
    const turn = decideConversationTurn({ subscriberText: "work was awful today" });
    expect(turn.responseMode).toBe("NATURAL");
    expect(turn.intakeOpportunity).toBe(false);
    expect(turn.latestTurnIntensity).toBe("WARM");
  });

  it("keeps a historically explicit thread NATURAL on a greeting", () => {
    const turn = decideConversationTurn({
      subscriberText: "hey how are you?",
      recentMessages: [
        { authorType: "SUBSCRIBER", body: "i want to fuck you" },
        { authorType: "CREATOR", body: "then tell me how hard you are" },
        { authorType: "SUBSCRIBER", body: "hey how are you?" },
      ],
    });
    expect(turn.responseMode).toBe("NATURAL");
    expect(turn.allowExplicit).toBe(false);
  });

  it("routes a direct explicit request to EXPLICIT", () => {
    const turn = decideConversationTurn({ subscriberText: "fuck me, talk dirty" });
    expect(turn.responseMode).toBe("EXPLICIT");
    expect(turn.salesReadiness).toBe("SEXUAL_MOMENTUM");
    expect(turn.allowPitch).toBe(false);
  });

  it("routes a content plus price ask to SALES / BUYING_SIGNAL", () => {
    const turn = decideConversationTurn({ subscriberText: "show me what you have and how much" });
    expect(turn.responseMode).toBe("SALES");
    expect(turn.salesReadiness).toBe("BUYING_SIGNAL");
    expect(turn.allowPitch).toBe(true);
    expect(turn.buyingSignals.length).toBeGreaterThan(0);
  });

  it("allows job intake when the fan mentions work naturally", () => {
    const turn = decideConversationTurn({ subscriberText: "i work in finance downtown" });
    expect(turn.intakeOpportunity).toBe(true);
    expect(turn.responseMode).toBe("NATURAL");
  });

  it("does not allow intake on a greeting alone", () => {
    const turn = decideConversationTurn({ subscriberText: "hey" });
    expect(turn.intakeOpportunity).toBe(false);
    expect(turn.responseMode).toBe("NATURAL");
  });

  it("blocks another question after two question-led AI turns", () => {
    const turn = decideConversationTurn({
      subscriberText: "yeah",
      recentMessages: [
        { authorType: "CREATOR", body: "how was your day?" },
        { authorType: "SUBSCRIBER", body: "ok" },
        { authorType: "CREATOR", body: "what do you do?" },
        { authorType: "SUBSCRIBER", body: "yeah" },
      ],
    });
    expect(turn.intakeOpportunity).toBe(false);
    const grounded = validateQualityGrounding({
      reply: "where are you from?",
      turn: "yeah",
      decision: turn,
      pacing: {
        previousAskedQuestion: true,
        consecutiveQuestionTurns: 2,
        consecutiveSalesOrIntakeTurns: 0,
        recentOpeners: ["how was", "what do"],
        recentUsedEmoji: false,
        recentBubbleCount: 1,
      },
    });
    expect(grounded).toEqual({ ok: false, code: "TOO_MANY_QUESTIONS" });
  });

  it("does not treat a short answer as a sexual jump", () => {
    const turn = decideConversationTurn({ subscriberText: "lol ok" });
    expect(turn.responseMode).toBe("NATURAL");
    expect(turn.allowExplicit).toBe(false);
  });

  it("answers a topic change during a sales sequence first", () => {
    const turn = decideConversationTurn({
      subscriberText: "anyway what music do you like?",
      unpaidOffer: true,
      recentMessages: [
        { authorType: "CREATOR", body: "this ppv is $9 if you want it" },
        { authorType: "SUBSCRIBER", body: "anyway what music do you like?" },
      ],
    });
    expect(turn.responseMode).toBe("NATURAL");
    expect(turn.allowPitch).toBe(false);
  });

  it("routes a complaint during an active sale to SUPPORT", () => {
    const turn = decideConversationTurn({
      subscriberText: "this is fraud i want a chargeback",
      unpaidOffer: true,
    });
    expect(turn.responseMode).toBe("SUPPORT");
    expect(detectOperationalIntent("this is fraud i want a chargeback").intent).toBe("COMPLAINT");
    expect(turn.allowPitch).toBe(false);
  });

  it("uses AFTERCARE then NATURAL after a purchase plus ordinary chat", () => {
    const turn = decideConversationTurn({
      subscriberText: "hey how are you",
      purchasedPpvCount: 1,
      followUpPhase: "AFTERCARE",
    });
    expect(turn.salesReadiness).toBe("AFTERCARE");
    expect(turn.responseMode).toBe("NATURAL");
  });

  it("treats double text as one complete turn", () => {
    const pending = collectPendingFanTurn({
      messages: [
        { id: "1", authorType: "SUBSCRIBER", body: "hey" },
        { id: "2", authorType: "SUBSCRIBER", body: "how are you" },
      ],
    });
    const turn = decideConversationTurn({ subscriberText: pending.combinedText });
    expect(pending.combinedText).toMatch(/hey[\s\S]*how are you/);
    expect(turn.responseMode).toBe("NATURAL");
    expect(turn.intakeOpportunity).toBe(false);
  });
});

describe("quality grounding", () => {
  const natural = decideConversationTurn({ subscriberText: "hey how are you?" });

  it("rejects an unrelated sexual draft", () => {
    expect(
      validateQualityGrounding({
        reply: "i keep thinking about my mouth on u",
        turn: "hey how are you?",
        decision: natural,
      }),
    ).toEqual({ ok: false, code: "SEXUAL_NOT_ALLOWED" });
  });

  it("rejects a product pitch without a buying signal", () => {
    expect(
      validateQualityGrounding({
        reply: "unlock the video for $9",
        turn: "hey how are you?",
        decision: natural,
        recommendedProductId: "prod_1",
      }),
    ).toEqual({ ok: false, code: "PITCH_DISABLED" });
  });

  it("rejects intake while a direct question is unanswered", () => {
    const turn = decideConversationTurn({ subscriberText: "what music do you like?" });
    expect(
      validateQualityGrounding({
        reply: "how many hands are you typing with?",
        turn: "what music do you like?",
        decision: turn,
      }).ok,
    ).toBe(false);
  });

  it("rejects a greeting reply that skips answering how she is", () => {
    expect(
      validateQualityGrounding({
        reply: "anyway tell me about you",
        turn: "hey how are you?",
        decision: natural,
      }),
    ).toEqual({ ok: false, code: "IGNORED_QUESTION" });
  });
});
