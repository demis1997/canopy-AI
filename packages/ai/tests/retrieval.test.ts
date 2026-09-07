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
});
