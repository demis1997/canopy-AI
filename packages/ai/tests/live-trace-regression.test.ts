import { expect, it } from "vitest";
import { composeGenerationPrompt } from "../src/prompts/compose.js";
import { conversationPolicyCodes } from "../src/safety/conversation-policy.js";
import { evaluateReplyCandidates } from "../src/pipeline/evaluate-replies.js";
import {
  advanceSubscriberPersona,
  routeSubscriberPersona,
  resolvePersonaControls,
  reduceConversationSession,
  decideConversationTurn,
  detectOperationalIntent,
  type GenerationOutput,
} from "@canopy/shared";
import type { GenerationInput } from "../src/provider/types.js";
const input = (history: GenerationInput["recentMessages"]): GenerationInput => ({
  requestId: "synthetic",
  model: "test",
  promptVersionId: "test",
  recentMessages: history,
  persona: {
    displayName: "Synthetic",
    biography: "Adult",
    authorisedBackstory: "Likes music",
    personality: "direct",
    tone: "casual",
    typicalMessageLength: "SHORT",
    preferredEmojis: [],
    frequentlyUsedPhrases: ["you're trouble", "Lovely"],
    preferredExplicitVocabulary: [],
    prohibitedWords: [],
    preferredCompliments: [],
    allowedExplicitness: "FLIRTY",
    style: "DIRECT",
    interests: [],
    contentBoundaries: [],
    claimsNeverToMake: [],
    customContentRules: "",
    offlineMeetingPolicy: "No offline meetings",
    discountLimitPercent: 0,
    approvedExampleMessages: [],
    conversationControls: { casualProfanity: "ALLOW" },
  },
  memories: [],
  products: [],
  funnelStage: "RAPPORT",
  playbook: "RAPPORT",
  retrievedExamples: [],
  responseMode: "NATURAL",
  allowPitch: false,
});
it("repeats the no-question constraint at the final instruction after question-led history", () => {
  const prompt = composeGenerationPrompt(
    input([
      { authorType: "CHATTER", body: "Can you handle it?" },
      { authorType: "CHATTER", body: "Are you ready?" },
      { authorType: "SUBSCRIBER", body: "Can we talk about my cancelled train?" },
    ]),
  );
  expect(String(prompt[0]?.content)).toContain("question_budget=0");
  expect(String(prompt.at(-1)?.content)).toContain("NO QUESTIONS OR QUESTION MARKS");
});
it("does not inject banned stock phrases as preferred vocabulary or a sales objective in ordinary chat", () => {
  const prompt = composeGenerationPrompt(
    input([{ authorType: "SUBSCRIBER", body: "I want normal conversation" }]),
  );
  expect(String(prompt[1]?.content)).toContain('"frequentlyUsedPhrases":["Lovely"]');
  expect(String(prompt[0]?.content)).toContain("This turn has no commercial objective");
});
it("preserves ALLOW profanity through exactly the production validation path", () => {
  const turn = "The bus was cancelled again";
  const output: GenerationOutput = {
    intent: "CASUAL_CHAT",
    funnelStage: "RAPPORT",
    explicitnessLevel: "FLIRTY",
    recommendedAction: "REPLY",
    replyOptions: [
      {
        text: "What the fuck, that's annoying.",
        messages: ["What the fuck, that's annoying."],
        tone: "DIRECT",
        internalReason: "React to commute",
      },
    ],
    recommendedProductId: null,
    approvedPrice: null,
    requiresHumanReview: true,
    riskFlags: [],
    memoryUpdates: [],
    suggestedFunnelTransition: null,
  };
  const evaluated = evaluateReplyCandidates(output, {
    turn,
    history: [{ authorType: "SUBSCRIBER", body: turn }],
    personaControls: { casualProfanity: "ALLOW" },
    decision: decideConversationTurn({ subscriberText: turn }),
    operational: detectOperationalIntent(turn),
    catalog: [],
    guardOptions: {
      contextualRecovery: true,
      responseMode: "NATURAL",
      subscriberText: turn,
      intakeOpportunity: false,
    },
  });
  expect(evaluated.validation.ok).toBe(true);
  expect(evaluated.validation.output.replyOptions[0]?.text).toBe(output.replyOptions[0]!.text);
  expect(evaluated.evaluations[0]?.candidates[0]?.checks.policy).toEqual([]);
  expect(evaluated.evaluations[0]?.candidates[0]?.checks.grounding).toEqual([]);
});
it("leaves exploitation and coercive-payment policy in place regardless of allowed ordinary profanity", () => {
  expect(conversationPolicyCodes("What the fuck, that bus was late")).toEqual([]);
  expect(conversationPolicyCodes("Don't disappoint me, you owe me")).toContain(
    "COERCIVE_SALES_LANGUAGE",
  );
  expect(conversationPolicyCodes("fuck me")).toContain("GRAPHIC_CONTENT");
});

it.each(["I like leading", "I like following"])(
  "injects the subscriber route without changing policy or profanity: %s",
  (text) => {
    const subscriberPersona = advanceSubscriberPersona({
      text,
      turnKey: "pref",
      history: [],
      now: "2026-10-27T12:00:00Z",
    });
    const request = input([{ authorType: "SUBSCRIBER", body: text }]);
    request.subscriberPersona = subscriberPersona;
    request.persona.conversationControls = routeSubscriberPersona(
      subscriberPersona,
      resolvePersonaControls({ casualProfanity: "ALLOW" }),
    ).controls;
    request.conversationSession = reduceConversationSession(undefined, {
      type: "FAN_TURN",
      text,
      key: "pref",
    });
    const prompt = composeGenerationPrompt(request);
    expect(String(prompt[0]?.content)).toContain("Subscriber routing:");
    expect(String(prompt[0]?.content)).toContain("Preference is not consent");
    expect(String(prompt[0]?.content)).toContain('"casualProfanity":"ALLOW"');
    expect(String(prompt[1]?.content)).toContain(subscriberPersona.activePersona);
    expect(String(prompt[0]?.content)).toContain("All replies must be non-graphic");
  },
);
