import { expect, it } from "vitest";
import { rankConversationResponses } from "../src/pipeline/rank-responses.js";
import { applyReplyGuards } from "../src/pipeline/validate-output.js";
import { retrieveTraining } from "../src/training/retrieve.js";
import { composeGenerationPrompt } from "../src/prompts/compose.js";
import type { GenerationOutput } from "@canopy/shared";
import type { GenerationInput } from "../src/provider/types.js";
const draft = (texts: string[]): GenerationOutput => ({
  intent: "FLIRT",
  funnelStage: "INTEREST",
  explicitnessLevel: "FLIRTY",
  recommendedAction: "REPLY",
  replyOptions: texts.map((text) => ({
    text,
    messages: [text],
    tone: "ROMANTIC",
    internalReason: "context",
  })),
  recommendedProductId: null,
  approvedPrice: null,
  requiresHumanReview: true,
  riskFlags: [],
  memoryUpdates: [],
  suggestedFunnelTransition: null,
});
it("selects a substantive candidate over catchphrases without changing approval", () => {
  const result = rankConversationResponses(
    draft(["maybe, maybe not", "I like how open you're being with me."]),
    { turn: "I like you", history: [] },
  );
  expect(result.output.replyOptions.map((o) => o.text)).toEqual([
    "I like how open you're being with me.",
  ]);
  expect(result.output.requiresHumanReview).toBe(true);
  expect(result.evaluations[0]?.score).toBeLessThan(result.evaluations[1]!.score);
});
it("requests contextual retry if every candidate fails", () => {
  const result = rankConversationResponses(draft(["you're trouble", "maybe maybe not"]), {
    turn: "I like you",
    history: [],
  });
  expect(result.output.replyOptions).toEqual([]);
  expect(result.output.riskFlags).toContain("CONTEXT_REGEN_REQUIRED");
  expect(result.output.recommendedAction).toBe("REQUEST_HUMAN_REVIEW");
});
it("preserves a valid non-graphic answer to a tease request", () => {
  const output = draft(["i like that confidence. You've got my attention."]);
  expect(
    applyReplyGuards(output, "tease me", {
      contextualRecovery: true,
      responseMode: "FLIRTY",
      intakeOpportunity: false,
    }).replyOptions,
  ).toEqual(output.replyOptions);
});
it("retrieval excludes legacy pressure, mandatory teasing and fabricated live claims", () => {
  const hits = retrieveTraining({
    message: "how much for photos?",
    intent: "CONTENT_REQUEST",
    funnelStage: "OFFER",
    transPersona: false,
    responseMode: "SALES",
    allowSexting: false,
    allowPricing: true,
    nonGraphicRomance: true,
  });
  expect(hits.join(" ")).not.toMatch(
    /actually sext|light pressure|filming this part right now|Never skip teasing|Hint at the clip and let him ask/i,
  );
});
it.each(["Playful", "Confident", "Affectionate", "Direct", "Shy", "Assertive"])(
  "injects %s personality and boundaries without mandatory agency teasing",
  (personality) => {
    const input: GenerationInput = {
      requestId: "test",
      persona: {
        displayName: "Maya",
        biography: "Adult creator",
        authorisedBackstory: "Likes music",
        personality,
        tone: personality,
        typicalMessageLength: "SHORT",
        preferredEmojis: [],
        frequentlyUsedPhrases: [],
        preferredExplicitVocabulary: [],
        prohibitedWords: [],
        preferredCompliments: [],
        allowedExplicitness: "FLIRTY",
        style: personality,
        interests: [],
        contentBoundaries: ["No roleplay"],
        claimsNeverToMake: ["I am filming live"],
        customContentRules: "No custom requests",
        offlineMeetingPolicy: "never",
        discountLimitPercent: 0,
        approvedExampleMessages: [],
      },
      recentMessages: [{ authorType: "SUBSCRIBER", body: "I like you" }],
      memories: [],
      products: [],
      funnelStage: "INTEREST",
      playbook: "RAPPORT",
      retrievedExamples: [],
      promptVersionId: "test",
      model: "qwen",
      responseMode: "FLIRTY",
    };
    const prompt = composeGenerationPrompt(input);
    expect(String(prompt[1]?.content)).toContain(`"personality":"${personality}"`);
    expect(String(prompt[1]?.content)).toContain("No roleplay");
    expect(String(prompt[0]?.content)).toContain("non-graphic");
    expect(String(prompt[0]?.content)).not.toContain("Tease before PPV");
  },
);
it("rejects prohibited persona words and individually ungrounded candidates", () => {
  const ranked = rankConversationResponses(
    draft([
      "sweetie, I like your honesty",
      "A response about something else",
      "I like your honesty",
    ]),
    {
      turn: "I like you",
      history: [],
      prohibitedWords: ["sweetie"],
      groundingCodes: (reply) => (reply.includes("something else") ? ["IGNORED_QUESTION"] : []),
    },
  );
  expect(ranked.output.replyOptions.map((option) => option.text)).toEqual(["I like your honesty"]);
  expect(ranked.evaluations[0]?.codes).toContain("PERSONA_PROHIBITED_WORD");
  expect(ranked.evaluations[1]?.codes).toContain("IGNORED_QUESTION");
});
