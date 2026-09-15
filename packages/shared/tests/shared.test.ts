import { describe, expect, it } from "vitest";
import { assertPermission, hasPermission, AuthorizationError } from "../src/permissions.js";
import { canTransition, recommendedActionFor } from "../src/funnel.js";
import { generationOutputSchema } from "../src/schemas.js";
import { maskSecret } from "../src/redaction.js";
import { parseProductCsv, eligibleProducts } from "../src/catalog.js";
import { ladderPrice, nextSendAttempt, followUpPhase, isFirstPpv, ladderSendAttempt } from "../src/crm.js";
import { splitReplyBubbles, collectOperatorRejections, parseOperatorRejectReason, containsMeetSpeak, scrubMeetSpeak, looksLikeOfflineAsk, looksLikePetNamePushback, looksLikeFanInvitesQuestions, looksLikeInvertedCuriosity, looksLikeNoPitchAsk, looksLikeAgeAsk, looksLikeAreYouReal, looksLikeInventedAboutHimCallout, creatorAgeFromText, stripUnauthorizedPetNames, stripCatalogMentions, bannedCatalogNames, wantsNoPitch, doubleOneTrailingEmoji } from "../src/replies.js";

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

  it("coerces messy enums, extra options, and string prices", () => {
    const result = generationOutputSchema.parse({
      intent: "flirty-chat",
      funnelStage: "rapport",
      explicitnessLevel: "suggestive",
      recommendedAction: "reply-now",
      replyOptions: [
        { messages: ["Hey baby", "tell me"], tone: "sassy", internalReason: "ok" },
        { messages: ["second"], tone: "PLAYFUL", internalReason: "x" },
        { messages: ["third"], tone: "PLAYFUL", internalReason: "x" },
        { messages: ["dropped"], tone: "PLAYFUL", internalReason: "x" },
      ],
      recommendedProductId: null,
      approvedPrice: "12",
      requiresHumanReview: "true",
      riskFlags: [],
      memoryUpdates: [],
      suggestedFunnelTransition: "nope",
    });
    expect(result.intent).toBe("UNCERTAIN");
    expect(result.funnelStage).toBe("RAPPORT");
    expect(result.recommendedAction).toBe("REPLY");
    expect(result.replyOptions).toHaveLength(3);
    expect(result.replyOptions[0]!.tone).toBe("PLAYFUL");
    expect(result.replyOptions[0]!.messages[0]).toBe("hey baby");
    expect(result.approvedPrice).toBe(12);
    expect(result.suggestedFunnelTransition).toBeNull();
  });
});

describe("reply bubbles", () => {
  it("joins a messages array into newline text", () => {
    const result = generationOutputSchema.parse({
      intent: "FLIRT",
      funnelStage: "RAPPORT",
      explicitnessLevel: "FLIRTY",
      recommendedAction: "REPLY",
      replyOptions: [
        {
          messages: ["hmm i see", "well what i think is that your cock is a good size", "I would have a great time on it"],
          tone: "PLAYFUL",
          internalReason: "ack then continue",
        },
      ],
      recommendedProductId: null,
      approvedPrice: null,
      requiresHumanReview: true,
      riskFlags: [],
      memoryUpdates: [],
      suggestedFunnelTransition: null,
    });
    expect(result.replyOptions[0]!.messages).toHaveLength(3);
    expect(result.replyOptions[0]!.messages[2]).toBe("i would have a great time on it");
    expect(result.replyOptions[0]!.text).toContain("\n");
  });

  it("fills messages from newline text", () => {
    const result = generationOutputSchema.parse({
      intent: "FLIRT",
      funnelStage: "RAPPORT",
      explicitnessLevel: "FLIRTY",
      recommendedAction: "REPLY",
      replyOptions: [{ text: "hmm i see\nwant the next one?", tone: "PLAYFUL", internalReason: "split" }],
      recommendedProductId: null,
      approvedPrice: null,
      requiresHumanReview: true,
      riskFlags: [],
      memoryUpdates: [],
      suggestedFunnelTransition: null,
    });
    expect(result.replyOptions[0]!.messages).toEqual(["hmm i see", "want the next one?"]);
  });

  it("splits leftover paragraphs into sentence bubbles", () => {
    expect(
      splitReplyBubbles("hmm i see. well what i think is that your cock is a good size. I would have a great time on it", {
        splitSentences: true,
      }),
    ).toEqual([
      "hmm i see.",
      "well what i think is that your cock is a good size.",
      "I would have a great time on it",
    ]);
  });
});

describe("operator reject reasons", () => {
  it("parses the typed reason off the stored internal note", () => {
    expect(parseOperatorRejectReason("Ack then sell · rejected: dont call fans losers")).toBe(
      "dont call fans losers",
    );
  });

  it("keeps unique discarded drafts even without a typed reason", () => {
    const rows = collectOperatorRejections([
      { text: "kneel loser", internalReason: "domme · rejected: dont call fans losers" },
      { text: "earn it loser", internalReason: "tease · rejected: dont call fans losers" },
      { text: "hi baby", internalReason: "rapport · rejected: too generic" },
      { text: "ok", internalReason: "no reason stored" },
    ]);
    expect(rows.map((r) => r.reason)).toEqual([
      "dont call fans losers",
      "dont call fans losers",
      "too generic",
      "Not a fit",
    ]);
  });

  it("flags meet-speak including leetspeak", () => {
    expect(containsMeetSpeak("wanna meetup later")).toBe(true);
    expect(containsMeetSpeak("you're asking about meetups?")).toBe(true);
    expect(containsMeetSpeak("m33tup?")).toBe(true);
    expect(containsMeetSpeak("nahh i dont do irl babe")).toBe(false);
    expect(containsMeetSpeak(scrubMeetSpeak("lets meet up"))).toBe(false);
    expect(looksLikeOfflineAsk("Do you do meetups with fans or not?")).toBe(true);
    expect(looksLikePetNamePushback("Why are you calling me a good boy?")).toBe(true);
    expect(looksLikeFanInvitesQuestions("What do you wanna know about me?")).toBe(true);
    expect(looksLikeInvertedCuriosity("oh? you're curious about me?")).toBe(true);
    expect(looksLikeNoPitchAsk("stop mentioning the shower set because fan is just interested in conversating")).toBe(
      true,
    );
    expect(stripUnauthorizedPetNames("i'm 28, good boy 💋")).toBe("i'm 28 💋");
    expect(stripCatalogMentions("this ppv Shower set for $40 if you want more", ["Shower set"])).not.toMatch(
      /shower set|\$40/i,
    );
    expect(
      bannedCatalogNames(
        [{ text: "shower set $40", reason: "stop mentioning the shower set" }],
        [{ id: "p1", name: "Shower set (DEMO)" }],
      ).ids,
    ).toEqual(["p1"]);
    expect(
      wantsNoPitch([
        {
          text: "shower set $40",
          reason: "stop mentioning the shower set because fan is just interested in conversating",
        },
      ]),
    ).toBe(true);
    expect(doubleOneTrailingEmoji("oh? curious about my age hmmm? 😏")).toBe("oh? curious about my age hmmm? 😏😏");
    expect(looksLikeAgeAsk("How old are you?")).toBe(true);
    expect(looksLikeAgeAsk("hi how old do i have to be to talk like this")).toBe(false);
    expect(looksLikeAreYouReal("Are you real?")).toBe(true);
    expect(looksLikeInventedAboutHimCallout("I'm a what? And I never said I'm 28")).toBe(true);
    expect(creatorAgeFromText("Fictional 28-year-old fitness creator")).toBe(28);
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

describe("price ladder and aftercare", () => {
  it("uses list, then mid, then the floor", () => {
    expect(
      ladderPrice({
        standardPrice: 25,
        minimumPrice: 20,
        discountLimitPercent: 20,
        sendAttempt: 1,
      }).kind,
    ).toBe("LIST");
    expect(
      ladderPrice({
        standardPrice: 25,
        minimumPrice: 20,
        discountLimitPercent: 20,
        sendAttempt: 2,
      }).price,
    ).toBe(22.5);
    expect(
      ladderPrice({
        standardPrice: 25,
        minimumPrice: 20,
        discountLimitPercent: 20,
        sendAttempt: 3,
      }).price,
    ).toBe(20);
  });

  it("counts the next unpaid send", () => {
    expect(nextSendAttempt(0)).toBe(1);
    expect(nextSendAttempt(1)).toBe(2);
    expect(nextSendAttempt(2)).toBe(3);
  });

  it("never discounts the first PPV or anything $10 and under", () => {
    expect(isFirstPpv(8, 0)).toBe(true);
    expect(isFirstPpv(25, 0)).toBe(true);
    expect(isFirstPpv(8, 3)).toBe(true);
    expect(isFirstPpv(25, 1)).toBe(false);
    expect(
      ladderSendAttempt({
        standardPrice: 8,
        unansweredFollowUps: 5,
        purchasedPpvCount: 0,
        offeredUnpaid: true,
      }),
    ).toBe(1);
  });

  it("holds list until he goes silent on a later PPV", () => {
    expect(
      ladderSendAttempt({
        standardPrice: 25,
        unansweredFollowUps: 1,
        purchasedPpvCount: 1,
        offeredUnpaid: true,
      }),
    ).toBe(1);
    expect(
      ladderSendAttempt({
        standardPrice: 25,
        unansweredFollowUps: 2,
        purchasedPpvCount: 1,
        offeredUnpaid: true,
      }),
    ).toBe(2);
    expect(
      ladderSendAttempt({
        standardPrice: 25,
        unansweredFollowUps: 3,
        purchasedPpvCount: 1,
        offeredUnpaid: true,
      }),
    ).toBe(3);
  });

  it("applies aftercare after the second unlock, not after unanswered nudges", () => {
    expect(followUpPhase(4, 0)).toBe("FOLLOW_UP");
    expect(followUpPhase(0, 1)).toBe("NONE");
    expect(followUpPhase(0, 2)).toBe("AFTERCARE");
  });

  it("applies max discount per product, not per creator", () => {
    const gym = ladderPrice({
      standardPrice: 25,
      minimumPrice: 18,
      discountLimitPercent: 20,
      sendAttempt: 3,
    });
    const shower = ladderPrice({
      standardPrice: 40,
      minimumPrice: 30,
      discountLimitPercent: 10,
      sendAttempt: 3,
    });
    expect(gym.price).toBe(20);
    expect(shower.price).toBe(36);
  });
});
