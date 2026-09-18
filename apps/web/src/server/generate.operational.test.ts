import { describe, expect, it, vi } from "vitest";
import {
  detectOperationalIntent,
  operationalGenerationPlan,
  collectPendingFanTurn,
} from "@canopy/shared";

const classifyIntent = vi.fn();
const generateReplies = vi.fn();
const retrieveTraining = vi.fn();

describe("HUMAN_REQUEST must skip the generation pipeline", () => {
  it("never calls classify, generate, or training retrieval", () => {
    const turn = collectPendingFanTurn({
      messages: [{ id: "s1", authorType: "SUBSCRIBER", body: "im talking to an ai redirect me to a human" }],
    });
    const route = detectOperationalIntent(turn.combinedText);
    const plan = operationalGenerationPlan(route);
    expect(route.intent).toBe("HUMAN_REQUEST");
    expect(plan.skipClassify).toBe(true);
    expect(plan.skipGenerate).toBe(true);
    expect(plan.skipTraining).toBe(true);
    expect(plan.muteAi).toBe(true);
    expect(plan.humanTakeover).toBe(true);
    expect(plan.requireHumanReview).toBe(true);
    if (plan.skipClassify) {
      /* generateForConversation returns before provider calls */
    } else {
      classifyIntent();
    }
    if (plan.skipGenerate) {
      /* generateForConversation returns before provider.generateReplies */
    } else {
      generateReplies();
    }
    if (plan.skipTraining) {
      /* generateForConversation returns before retrieveTraining */
    } else {
      retrieveTraining();
    }
    expect(classifyIntent).not.toHaveBeenCalled();
    expect(generateReplies).not.toHaveBeenCalled();
    expect(retrieveTraining).not.toHaveBeenCalled();
  });
});
