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
it("includes the full ten-message outbound reference even when prompt history is shorter", () => {
  const input = {
    requestId: "history",
    persona: {
      displayName: "Maya",
      tone: "warm",
      typicalMessageLength: "SHORT",
      conversationControls: {},
    },
    recentMessages: [{ authorType: "SUBSCRIBER", body: "hi" }],
    alreadySent: Array.from({ length: 10 }, (_, i) => `Earlier creator statement ${i}`),
    memories: [],
    products: [],
    funnelStage: "RAPPORT",
    playbook: "RAPPORT",
    retrievedExamples: [],
  } as unknown as GenerationInput;
  const prompt = composeGenerationPrompt(input);
  expect(String(prompt[1]?.content)).toContain("Earlier creator statement 0");
  expect(String(prompt[1]?.content)).toContain("Earlier creator statement 9");
});
it("does not expose sales context when backend pitching is disabled despite buying readiness", () => {
  const input = {
    requestId: "opt-out",
    persona: {
      displayName: "Maya",
      tone: "warm",
      typicalMessageLength: "SHORT",
      conversationControls: {},
    },
    recentMessages: [{ authorType: "SUBSCRIBER", body: "just chat" }],
    memories: [],
    products: [],
    funnelStage: "OFFER",
    playbook: "RAPPORT",
    retrievedExamples: [],
    allowPitch: false,
    responseMode: "NATURAL",
    salesReadiness: "BUYING_SIGNAL",
    sellTarget: { productId: "p1", name: "Real item", price: 15, reason: "CONTEXT" },
  } as unknown as GenerationInput;
  const text = String(composeGenerationPrompt(input)[1]?.content);
  expect(text).not.toContain("<valid_products>");
  expect(text).not.toContain("<pricing_policy>");
  expect(text).not.toContain("<sell_target>");
});
it("rejects question-led reopenings after a conclusion and enforces configured length", () => {
  const session = { stage: "CONCLUSION" } as import("@canopy/shared").ConversationSession;
  const result = rankConversationResponses(draft(["What are you doing?", "Enjoy your evening."]), {
    turn: "bye",
    history: [],
    session,
  });
  expect(result.output.replyOptions[0]?.text).toBe("Enjoy your evening.");
  const long = rankConversationResponses(
    draft([Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ")]),
    { turn: "hello", history: [], messageLength: "SHORT" },
  );
  expect(long.evaluations[0]?.codes).toContain("PERSONA_MESSAGE_LENGTH");
  expect(long.output.replyOptions).toEqual([]);
});
