import { describe, expect, it } from "vitest";
import { assertPermission, hasPermission, AuthorizationError } from "../src/permissions.js";
import { canTransition, recommendedActionFor } from "../src/funnel.js";
import { generationOutputSchema } from "../src/schemas.js";
import { maskSecret } from "../src/redaction.js";
import { parseProductCsv, eligibleProducts } from "../src/catalog.js";

describe("permissions", () => {
  it("allows chatters to generate but not manage the org", () => {
    expect(hasPermission("CHATTER", "conversations.generate")).toBe(true);
    expect(hasPermission("CHATTER", "org.manage")).toBe(false);
  });

  it("blocks creators from inviting team members", () => {
    expect(() => assertPermission("CREATOR", "team.invite")).toThrow(AuthorizationError);
  });

  it("gives platform admins aggregate analytics only", () => {
    expect(hasPermission("PLATFORM_ADMIN", "analytics.view_aggregate")).toBe(true);
    expect(hasPermission("PLATFORM_ADMIN", "conversations.view")).toBe(false);
  });
});

describe("funnel", () => {
  it("allows small forward jumps and rejects large skips", () => {
    expect(canTransition("NEW_FAN", "RAPPORT")).toBe(true);
    expect(canTransition("NEW_FAN", "PURCHASE")).toBe(false);
  });

  it("does not constantly pressure sales during rapport", () => {
    expect(
      recommendedActionFor({
        intent: "CASUAL_CHAT",
        stage: "RAPPORT",
        offerCooldownActive: false,
        rapportPriority: true,
      }),
    ).toBe("BUILD_RAPPORT");
  });
});

describe("generation schema", () => {
  it("rejects malformed provider output", () => {
    const result = generationOutputSchema.safeParse({ intent: "NOPE" });
    expect(result.success).toBe(false);
  });
});

describe("redaction", () => {
  it("never redisplays a full secret", () => {
    expect(maskSecret("sk-live-abcdefghijk")).toBe("••••hijk");
  });
});

describe("catalog eligibility", () => {
  const base = {
    id: "p1",
    creatorId: "maya",
    name: "Sunset set",
    description: "",
    mediaType: "PHOTO" as const,
    standardPrice: 12,
    minimumPrice: 10,
    tags: ["tease"],
    available: true,
    source: "DEMO_SEED" as const,
    timesSold: 4,
    conversionRate: 0.4,
    mediaIds: ["m1"],
    previewIds: ["pv1"],
  };

  it("hides products the subscriber already bought", () => {
    const result = eligibleProducts({
      products: [base],
      creatorId: "maya",
      purchasedProductIds: ["p1"],
    });
    expect(result.eligible).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBe("ALREADY_PURCHASED");
  });
});

describe("csv import", () => {
  it("validates product rows before import", () => {
    const rows = parseProductCsv(
      [
        "external_id,creator,name,description,content_type,standard_price,minimum_price,tags,media_reference,preview_reference,availability",
        "vault-1,Maya,Sunset set,tease,PHOTO,12,10,tease|gfe,media-1,prev-1,true",
        "vault-2,Maya,,bad,GIF,-1,50,x,m,p,true",
      ].join("\n"),
    );
    expect(rows[0]?.errors).toEqual([]);
    expect(rows[1]?.errors.length).toBeGreaterThan(0);
  });
});
