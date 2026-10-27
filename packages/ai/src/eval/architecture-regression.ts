/** Offline engineering comparison. No model calls, credentials, payments or message sends. */
import { execFileSync } from "node:child_process";
import ts from "typescript";
import {
  normalizeReplyBubbles,
  containsSexualLanguage,
  looksLikeSextAsk,
  reduceConversationSession,
  resolvePersonaControls,
} from "@canopy/shared";
import { evaluateSafety } from "../safety/index.js";
import { rankConversationResponses } from "../pipeline/rank-responses.js";
import type { GenerationOutput } from "@canopy/shared";
const baselineRef = process.env.CANOPY_EVAL_BASELINE || "e842ca09";
const moduleUrl = (source: string) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const source = (path: string) =>
  execFileSync("git", ["show", `${baselineRef}:${path}`], { encoding: "utf8" });
const oldReplies = await import(moduleUrl(source("packages/shared/src/replies.ts")));
const oldRouting = await import(
  moduleUrl(
    source("packages/shared/src/operational-intent.ts").replace(
      '"./replies.js"',
      JSON.stringify(moduleUrl(source("packages/shared/src/replies.ts"))),
    ),
  )
);
const oldSafety = await import(moduleUrl(source("packages/ai/src/safety/index.ts")));
const started = performance.now();
const comparisons = [
  {
    id: "preserve-creator-casing",
    before: oldReplies.normalizeReplyBubbles({ text: "Damn, that sounds awful." }).text,
    after: normalizeReplyBubbles({ text: "Damn, that sounds awful." }).text,
    expected: "Damn, that sounds awful.",
  },
  {
    id: "ordinary-profanity-not-sexual",
    before: oldRouting.containsSexualLanguage("Fuck this traffic"),
    after: containsSexualLanguage("Fuck this traffic"),
    expected: false,
  },
  {
    id: "ordinary-profanity-not-a-request",
    before: oldReplies.looksLikeSextAsk("Fuck this traffic"),
    after: looksLikeSextAsk("Fuck this traffic"),
    expected: false,
  },
  {
    id: "traffic-is-not-trafficking",
    before: oldSafety.evaluateSafety({
      adultStatus: "VERIFIED_ADULT",
      subscriberText: "Traffic was awful",
    }).allowed,
    after: evaluateSafety({ adultStatus: "VERIFIED_ADULT", subscriberText: "Traffic was awful" })
      .allowed,
    expected: true,
  },
];
const styleCases = [
  {
    id: "playful",
    controls: { playfulness: 0.9 },
    reply: "That playlist has excellent taste. I may steal a song.",
    turn: "I made a playlist",
  },
  {
    id: "confident",
    controls: { characterization: "ASSERTIVE" as const, directness: "DIRECT" as const },
    reply: "I enjoy your honesty. Keep being yourself.",
    turn: "I like talking to you",
  },
  {
    id: "soft",
    controls: { characterization: "SOFT" as const },
    reply: "I'm glad you shared that. We can take our time.",
    turn: "I feel comfortable here",
  },
  {
    id: "profanity",
    controls: { casualProfanity: "ALLOW" as const },
    reply: "Damn, that commute sounds awful.",
    turn: "The commute was bad",
  },
];
const styleResults = styleCases.map((row) => {
  const option = {
    text: row.reply,
    messages: [row.reply],
    tone: "DIRECT" as const,
    internalReason: "Authored test fixture",
  };
  const output: GenerationOutput = {
    intent: "CASUAL_CHAT",
    funnelStage: "RAPPORT",
    explicitnessLevel: "FLIRTY",
    recommendedAction: "REPLY",
    replyOptions: [option],
    recommendedProductId: null,
    approvedPrice: null,
    requiresHumanReview: true,
    riskFlags: [],
    memoryUpdates: [],
    suggestedFunnelTransition: null,
  };
  const ranked = rankConversationResponses(output, {
    turn: row.turn,
    history: [],
    personaControls: row.controls,
  });
  return { id: row.id, preserved: ranked.output.replyOptions[0]?.text === row.reply };
});
const scenarios = [
  { id: "declines-ppv", text: "No thanks, no more offers", expected: "RAPPORT", optedOut: true },
  {
    id: "changes-topic",
    text: "Anyway, what music do you like?",
    expected: "RAPPORT",
    optedOut: false,
  },
  { id: "ordinary-conversation", text: "Just want to chat", expected: "RAPPORT", optedOut: true },
  {
    id: "sets-boundary",
    text: "slow down, I'm not comfortable",
    expected: "RAPPORT",
    optedOut: false,
  },
].map((row) => {
  const offer = reduceConversationSession(undefined, {
    type: "OFFER_SENT",
    id: "real-offer",
    productId: "real-item",
  });
  const state = reduceConversationSession(
    offer,
    { type: "FAN_TURN", key: row.id, text: row.text },
    resolvePersonaControls(),
  );
  return { id: row.id, passed: state.stage === row.expected && state.salesOptOut === row.optedOut };
});
let state = reduceConversationSession(undefined, {
  type: "PURCHASE_CONFIRMED",
  productId: "real-item",
});
scenarios.push({ id: "backend-purchase", passed: state.stage === "PURCHASE_CONFIRMATION" });
state = reduceConversationSession(state, { type: "NO_RESPONSE" });
state = reduceConversationSession(state, { type: "NO_RESPONSE" });
scenarios.push({ id: "stops-responding", passed: state.stage === "CONCLUSION" });
const passed =
  comparisons.every((c) => c.after === c.expected) &&
  styleResults.every((c) => c.preserved) &&
  scenarios.every((c) => c.passed);
console.log(
  JSON.stringify(
    {
      baselineRef,
      kind: "deterministic-engineering-comparison-not-live-model-quality",
      comparisons,
      styleResults,
      scenarios,
      elapsedMs: Number((performance.now() - started).toFixed(2)),
      passed,
    },
    null,
    2,
  ),
);
if (!passed) process.exitCode = 1;
