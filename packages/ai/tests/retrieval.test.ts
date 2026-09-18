import { describe, expect, it } from "vitest";
import { retrieveTraining, personaLooksTrans } from "../src/training/retrieve.js";

describe("agency training retrieval", () => {
  it("always surfaces the 20-30 word hard rule for sexting", () => {
    const hits = retrieveTraining({
      message: "i'm so hard for you, show me",
      intent: "SEXTING",
      funnelStage: "INTEREST",
      transPersona: false,
    });
    expect(hits.some((h) => /20–30 words|20-30 words/.test(h))).toBe(true);
  });

  it("holds price on objections", () => {
    const hits = retrieveTraining({
      message: "that's too expensive can you do $5",
      intent: "PRICE_OBJECTION",
      funnelStage: "OBJECTION",
      transPersona: false,
    });
    expect(hits.join(" ").toLowerCase()).toMatch(/hold|never go below|discount/);
  });

  it("does not tell chatters to interview about being single", () => {
    const hits = retrieveTraining({
      message: "hey",
      intent: "CASUAL_CHAT",
      funnelStage: "NEW_FAN",
      transPersona: false,
      allowSexting: false,
      responseMode: "NATURAL",
    });
    const blob = hits.join(" ").toLowerCase();
    expect(blob).toMatch(/at most one question/);
    expect(blob).not.toMatch(/weave one question at a time: age/);
    expect(blob).not.toMatch(/sexting master|how many hands/);
  });

  it("hides trans vocabulary from cis personas", () => {
    const hits = retrieveTraining({
      message: "hey",
      intent: "CASUAL_CHAT",
      funnelStage: "NEW_FAN",
      transPersona: false,
    });
    expect(hits.join(" ").toLowerCase()).not.toContain("girlcock");
  });

  it("includes trans terms when the persona is trans", () => {
    expect(personaLooksTrans({ preferredExplicitVocabulary: ["girlcock"] })).toBe(true);
    const hits = retrieveTraining({
      message: "you're so hot",
      intent: "FLIRT",
      funnelStage: "RAPPORT",
      transPersona: true,
    });
    expect(hits.join(" ").toLowerCase()).toMatch(/girlcock|tgirl|trans/);
  });

  it("does not retrieve sexting chunks for a natural turn", () => {
    const hits = retrieveTraining({
      message: "how old are you?",
      intent: "CASUAL_CHAT",
      funnelStage: "RAPPORT",
      transPersona: false,
      allowSexting: false,
    });
    expect(hits.join(" ").toLowerCase()).not.toMatch(/sexting master|girlcock|stroke/);
  });
});
