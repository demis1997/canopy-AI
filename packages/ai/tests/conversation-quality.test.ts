import { describe, expect, it } from "vitest";
import { composeGenerationPrompt } from "../src/prompts/compose.js";
import { retrieveTraining } from "../src/training/retrieve.js";
import { MockLLMProvider } from "../src/provider/mock.js";
import { applyReplyGuards } from "../src/pipeline/validate-output.js";
import { decideConversationTurn, detectOperationalIntent, validateQualityGrounding } from "@canopy/shared";
import type { GenerationInput } from "../src/provider/types.js";

const persona = {
  displayName: "Maya",
  biography: "Adult creator who likes indie pop and late-night walks",
  authorisedBackstory: "She likes indie pop, cooking, and sleep. Favourite colour is green.",
  personality: "playful",
  tone: "teasing",
  typicalMessageLength: "SHORT",
  preferredEmojis: ["😌"],
  frequentlyUsedPhrases: [],
  preferredExplicitVocabulary: ["cock"],
  prohibitedWords: [],
  preferredCompliments: [],
  allowedExplicitness: "EXPLICIT" as const,
  style: "PLAYFUL",
  interests: ["indie pop", "cooking"],
  contentBoundaries: [],
  claimsNeverToMake: [],
  customContentRules: "",
  offlineMeetingPolicy: "never",
  discountLimitPercent: 10,
  approvedExampleMessages: [],
};

function genInput(message: string, extras: Partial<GenerationInput> = {}): GenerationInput {
  const decision = decideConversationTurn({
    subscriberText: message,
    recentMessages: extras.recentMessages ?? [{ authorType: "SUBSCRIBER", body: message }],
    purchasedPpvCount: extras.followUpPhase === "AFTERCARE" ? 1 : undefined,
    followUpPhase: extras.followUpPhase,
  });
  return {
    requestId: extras.requestId ?? "req_1",
    persona,
    recentMessages: extras.recentMessages ?? [{ authorType: "SUBSCRIBER", body: message }],
    memories: [],
    products: [
      {
        id: "prod_1",
        name: "Shower set",
        description: "demo",
        standardPrice: 9,
        minimumPrice: 9,
        available: true,
        explicitnessCategory: "EXPLICIT",
      },
    ],
    funnelStage: "RAPPORT",
    playbook: "BUILDING_RAPPORT",
    retrievedExamples: [],
    promptVersionId: "pv1",
    model: "mock",
    responseMode: extras.responseMode ?? decision.responseMode,
    salesReadiness: extras.salesReadiness ?? decision.salesReadiness,
    latestTurnIntensity: extras.latestTurnIntensity ?? decision.latestTurnIntensity,
    intakeOpportunity: extras.intakeOpportunity ?? decision.intakeOpportunity,
    allowPitch: extras.allowPitch ?? decision.allowPitch,
    buyingSignals: extras.buyingSignals ?? decision.buyingSignals,
    latestFanTurn: message,
    ...extras,
  };
}

const SEX = /\b(pussy|cock|fuck|suck|cum|horny|stroke|dick|jerk|sext)\b/i;
const INTAKE = /\b(how many hands|how old are you|where are you from|what do you do for (a living|work)|taking control|told what to do)\b/i;
const PITCH = /\$\s*\d+|unlock|ppv|video/i;

describe("natural greeting quality", () => {
  it("answers hey how are you without sex, pitch, or intake", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(genInput("hey how are you?"));
    const text = result.output.replyOptions[0]?.text ?? "";
    expect(text).toMatch(/\b(good|well|okay|ok|fine|relaxing|alright|pretty)\b/i);
    expect(text).not.toMatch(SEX);
    expect(text).not.toMatch(PITCH);
    expect(text).not.toMatch(INTAKE);
    expect(result.output.recommendedProductId).toBeNull();
  });

  it("acknowledges a bad work day before any question", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(genInput("work was awful today"));
    const text = result.output.replyOptions[0]?.text ?? "";
    const first = text.split("\n")[0] ?? text;
    expect(first).toMatch(/rough|suck|sorry|awful|hear/i);
    expect(first).not.toMatch(/\?/);
    expect(text).not.toMatch(SEX);
    expect(text).not.toMatch(PITCH);
  });

  it("answers music questions from authorised persona data", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(genInput("what music do you like?"));
    const text = result.output.replyOptions[0]?.text ?? "";
    expect(text.toLowerCase()).toMatch(/indie pop|music/);
    expect(text).not.toMatch(PITCH);
  });

  it("does not copy the same greeting twice", async () => {
    const mock = new MockLLMProvider();
    const a = await mock.generateReplies(genInput("hey how are you?", { requestId: "a" }));
    const b = await mock.generateReplies(genInput("hey how are you?", { requestId: "b" }));
    expect(a.output.replyOptions[0]?.text).not.toBe(b.output.replyOptions[0]?.text);
  });

  it("does not jump sexually on a short answer", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(genInput("lol ok"));
    expect(result.output.replyOptions[0]?.text).not.toMatch(SEX);
  });

  it("answers a greeting without hands age city job or sub/dom", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(genInput("hey"));
    const text = result.output.replyOptions.map((row) => row.text).join("\n");
    expect(text).not.toMatch(INTAKE);
  });

  it("uses a statement after two consecutive question-led turns", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(
      genInput("yeah", {
        recentMessages: [
          { authorType: "CREATOR", body: "how was your day?" },
          { authorType: "SUBSCRIBER", body: "ok" },
          { authorType: "CREATOR", body: "what do you do?" },
          { authorType: "SUBSCRIBER", body: "yeah" },
        ],
      }),
    );
    expect(result.output.replyOptions[0]?.text).not.toMatch(/\?/);
  });

  it("may ask a job question when work is mentioned without distress", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(genInput("i work in finance downtown"));
    expect(result.output.replyOptions[0]?.text.toLowerCase()).toMatch(/work|job/);
  });
});

describe("mode specific prompts and retrieval", () => {
  it("keeps NATURAL prompts free of PPV price and dominance scripts", () => {
    const system = String(composeGenerationPrompt(genInput("hey how are you?"))[0]?.content ?? "");
    const user = String(composeGenerationPrompt(genInput("hey how are you?"))[1]?.content ?? "");
    expect(system).toMatch(/long-term objective is to build enough interest/);
    expect(system).toMatch(/NATURAL turn/);
    expect(system).not.toMatch(/Every send has a job on the sales sequence/);
    expect(system).not.toMatch(/taking control/);
    expect(user).not.toMatch(/<pricing_policy>/);
    expect(user).not.toMatch(/<valid_products>/);
  });

  it("retrieves natural chunks and excludes sexting and pricing for NATURAL", () => {
    const hits = retrieveTraining({
      message: "hey how are you?",
      intent: "CASUAL_CHAT",
      funnelStage: "NEW_FAN",
      transPersona: false,
      allowSexting: false,
      allowPricing: false,
      responseMode: "NATURAL",
    });
    const blob = hits.join(" ").toLowerCase();
    expect(blob).toMatch(/greet|how she is|at most one question/);
    expect(blob).not.toMatch(/sexting master/);
    expect(blob).not.toMatch(/agency floor prices/);
    expect(blob).not.toMatch(/how many hands/);
  });

  it("retrieves pricing material only for SALES buying signals", () => {
    const hits = retrieveTraining({
      message: "show me what you have and how much",
      intent: "CONTENT_REQUEST",
      funnelStage: "OFFER",
      transPersona: false,
      allowSexting: false,
      allowPricing: true,
      responseMode: "SALES",
      salesReadiness: "BUYING_SIGNAL",
    });
    expect(hits.join(" ").toLowerCase()).toMatch(/price|ppv|list/);
  });
});

describe("explicit and sales mock paths", () => {
  it("matches a direct explicit request", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(genInput("fuck me, talk dirty"));
    expect(result.output.replyOptions[0]?.text.toLowerCase()).toMatch(/cock|fuck|kneel|hard|wet|tell me/);
  });

  it("pitches when the fan asks for content and price", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(genInput("show me what you have and how much"));
    expect(result.output.recommendedProductId).toBe("prod_1");
    expect(result.output.approvedPrice).toBe(9);
  });

  it("stays aftercare/natural after a purchase plus ordinary chat", async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateReplies(
      genInput("hey how are you", { followUpPhase: "AFTERCARE", salesReadiness: "AFTERCARE" }),
    );
    const text = result.output.replyOptions[0]?.text ?? "";
    expect(result.output.recommendedProductId).toBeNull();
    expect(text).not.toMatch(PITCH);
    expect(text).toMatch(/\b(good|well|okay|fun|easy|glad|hanging)\b/i);
  });
});

describe("operational routing still wins", () => {
  it("clears HUMAN_REQUEST options", () => {
    const guarded = applyReplyGuards(
      {
        intent: "SEXTING",
        funnelStage: "OFFER",
        explicitnessLevel: "EXPLICIT",
        recommendedAction: "PRESENT_OFFER",
        replyOptions: [{ text: "kneel", messages: ["kneel"], tone: "TEASING", internalReason: "x" }],
        recommendedProductId: "prod_1",
        approvedPrice: 9,
        requiresHumanReview: false,
        riskFlags: [],
        memoryUpdates: [],
        suggestedFunnelTransition: null,
      },
      "im talking to an ai redirect me to a human",
    );
    expect(guarded.replyOptions).toEqual([]);
    expect(detectOperationalIntent("im talking to an ai redirect me to a human").intent).toBe("HUMAN_REQUEST");
  });

  it("clears AI suspicion options", () => {
    const guarded = applyReplyGuards(
      {
        intent: "SEXTING",
        funnelStage: "OFFER",
        explicitnessLevel: "EXPLICIT",
        recommendedAction: "PRESENT_OFFER",
        replyOptions: [{ text: "prove myself", messages: ["prove myself"], tone: "TEASING", internalReason: "x" }],
        recommendedProductId: "prod_1",
        approvedPrice: 9,
        requiresHumanReview: false,
        riskFlags: [],
        memoryUpdates: [],
        suggestedFunnelTransition: null,
      },
      "are you a bot?",
    );
    expect(guarded.replyOptions).toEqual([]);
    expect(guarded.riskFlags).toContain("AI_SUSPICION");
  });

  it("fails grounding on an unrelated sexual draft", () => {
    const decision = decideConversationTurn({ subscriberText: "hey how are you?" });
    expect(
      validateQualityGrounding({
        reply: "i keep thinking about my mouth on u",
        turn: "hey how are you?",
        decision,
      }).ok,
    ).toBe(false);
  });
});
