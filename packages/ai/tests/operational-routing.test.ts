import { describe, expect, it } from "vitest";
import { applyReplyGuards } from "../src/pipeline/validate-output.js";
import { composeGenerationPrompt } from "../src/prompts/compose.js";
import { retrieveTraining } from "../src/training/retrieve.js";
import { evaluateSafety } from "../src/safety/index.js";
import type { GenerationInput } from "../src/provider/types.js";
import { detectOperationalIntent, operationalGenerationPlan } from "@canopy/shared";

const baseOutput = {
  intent: "SEXTING" as const,
  funnelStage: "OFFER" as const,
  explicitnessLevel: "EXPLICIT" as const,
  recommendedAction: "PRESENT_OFFER" as const,
  replyOptions: [
    {
      text: "i keep thinking about my mouth on u",
      messages: ["i keep thinking about my mouth on u"],
      tone: "TEASING" as const,
      internalReason: "sext",
    },
  ],
  recommendedProductId: "prod_1",
  approvedPrice: 9,
  requiresHumanReview: false,
  riskFlags: [] as string[],
  memoryUpdates: [],
  suggestedFunnelTransition: null,
};

const persona = {
  displayName: "Maya",
  biography: "Demo",
  authorisedBackstory: "Demo",
  personality: "playful",
  tone: "teasing",
  typicalMessageLength: "SHORT",
  preferredEmojis: ["😏"],
  frequentlyUsedPhrases: ["mmm hi"],
  preferredExplicitVocabulary: ["cock"],
  prohibitedWords: [],
  preferredCompliments: [],
  allowedExplicitness: "EXPLICIT" as const,
  style: "PLAYFUL",
  interests: [],
  contentBoundaries: [],
  claimsNeverToMake: [],
  customContentRules: "",
  offlineMeetingPolicy: "never",
  discountLimitPercent: 10,
  approvedExampleMessages: [],
};

describe("operational reply guards", () => {
  it("clears HUMAN_REQUEST options and product", () => {
    const guarded = applyReplyGuards(baseOutput, "im talking to an ai redirect me to a human");
    expect(guarded.replyOptions).toEqual([]);
    expect(guarded.recommendedAction).toBe("REQUEST_HUMAN_REVIEW");
    expect(guarded.requiresHumanReview).toBe(true);
    expect(guarded.recommendedProductId).toBeNull();
    expect(guarded.approvedPrice).toBeNull();
    expect(guarded.riskFlags).toContain("HUMAN_REQUEST");
  });

  it("does not send PPV or sexual copy for AI suspicion", () => {
    const guarded = applyReplyGuards(baseOutput, "are you a bot?");
    expect(guarded.replyOptions).toEqual([]);
    expect(guarded.recommendedProductId).toBeNull();
    expect(guarded.riskFlags).toContain("AI_SUSPICION");
    expect(JSON.stringify(guarded).toLowerCase()).not.toMatch(
      /prove myself|guilt|leave|plenty of fans/,
    );
  });

  it("rejects sexual output for a support message", () => {
    const guarded = applyReplyGuards(baseOutput, "I need help with my billing issue", {
      responseMode: "SUPPORT",
      operationalIntent: "SUPPORT_REQUEST",
    });
    expect(guarded.replyOptions).toEqual([]);
    expect(guarded.riskFlags.join(" ")).toMatch(/SEXUAL_NOT_ALLOWED|SUPPORT_REQUEST/);
  });
});

describe("prompt and training", () => {
  it("does not instruct guilt trips and does not default every send to sales", () => {
    const input: GenerationInput = {
      requestId: "req",
      persona,
      recentMessages: [{ authorType: "SUBSCRIBER", body: "are you a bot?" }],
      memories: [],
      products: [],
      funnelStage: "RAPPORT",
      playbook: "BUILDING_RAPPORT",
      retrievedExamples: [],
      promptVersionId: "v",
      model: "mock",
      responseMode: "OPERATIONAL",
      operationalIntent: "AI_SUSPICION",
      latestFanTurn: "are you a bot?",
    };
    const system = String(composeGenerationPrompt(input)[0]?.content ?? "");
    expect(system).not.toMatch(/Every send has a job on the sales sequence/);
    expect(system).not.toMatch(/make him feel awkward/);
    expect(system).not.toMatch(/guilt trip/i);
    expect(system).not.toMatch(/plenty of fans already believe you/);
    expect(system).not.toMatch(/he can leave/);
    expect(system).toMatch(/Address the fan's complete latest turn first/);
  });

  it("does not retrieve sexting chunks unless the turn is explicit or sales", () => {
    const hits = retrieveTraining({
      message: "how old are you?",
      intent: "CASUAL_CHAT",
      funnelStage: "RAPPORT",
      transPersona: false,
      allowSexting: false,
    });
    expect(hits.join(" ").toLowerCase()).not.toMatch(/sexting master/);
  });
});

describe("safety still wins over human request", () => {
  it("blocks minors even if the fan also asks for a human", () => {
    const safety = evaluateSafety({
      adultStatus: "VERIFIED_ADULT",
      subscriberText: "im 16 redirect me to a human",
    });
    expect(safety.allowed).toBe(false);
    expect(detectOperationalIntent("im 16 redirect me to a human").intent).toBe("HUMAN_REQUEST");
  });

  it("does not treat a human request as a safety allow-into-generation event", () => {
    const plan = operationalGenerationPlan(detectOperationalIntent("redirect me to a human"));
    expect(plan.skipGenerate).toBe(true);
    expect(plan.skipClassify).toBe(true);
    expect(
      evaluateSafety({ adultStatus: "VERIFIED_ADULT", subscriberText: "redirect me to a human" })
        .allowed,
    ).toBe(true);
  });
});
