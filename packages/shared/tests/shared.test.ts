import { describe, expect, it } from "vitest";
import { assertPermission, hasPermission, AuthorizationError } from "../src/permissions.js";
import { canTransition, recommendedActionFor } from "../src/funnel.js";
import { generationOutputSchema } from "../src/schemas.js";
import { maskSecret } from "../src/redaction.js";
import { ladderPrice, nextSendAttempt, followUpPhase, isFirstPpv, ladderSendAttempt, sequenceDropPrice, nextLockedDropPolicy, assessSpendLikelihood } from "../src/crm.js";
import { parseProductCsv, eligibleProducts, matchSellTarget, boughtWelcomeMessage, pickSequenceDropProduct } from "../src/catalog.js";
import { splitReplyBubbles, collectOperatorRejections, parseOperatorRejectReason, containsMeetSpeak, scrubMeetSpeak, looksLikeOfflineAsk, looksLikePetNamePushback, looksLikeFanInvitesQuestions, looksLikeInvertedCuriosity, looksLikeNoPitchAsk, looksLikeAgeAsk, looksLikeAreYouReal, looksLikeInventedAboutHimCallout, looksLikeLocationAsk, looksLikeDirectUnlockPitch, looksLikeAimlessRapport, pitchIsTooEarly, creatorAgeFromText, creatorCityFromText, rotateVariants, threadIsOnOfflineAsk, stripUnauthorizedPetNames, stripCatalogMentions, bannedCatalogNames, wantsNoPitch, doubleOneTrailingEmoji } from "../src/replies.js";

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
    expect(looksLikePetNamePushback("Stop calling me a loser")).toBe(true);
    expect(looksLikePetNamePushback("No, so please stop using it")).toBe(true);
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
    expect(looksLikeAreYouReal("I'm talking to a robot")).toBe(true);
    expect(looksLikeAreYouReal("So you are a bot?")).toBe(true);
    expect(looksLikeInventedAboutHimCallout("I'm a what? And I never said I'm 28")).toBe(true);
    expect(looksLikeInventedAboutHimCallout("What do you mean 29 is perfect? You just said you're 29")).toBe(true);
    expect(looksLikeLocationAsk("Where are you from?")).toBe(true);
    expect(creatorCityFromText("Lives in a coastal city, has a rescue cat")).toBe("coastal city");
    const firsts = new Set(
      ["a", "bb", "hello", "world", "irl-1", "irl-2", "seed-9"].map((seed) => rotateVariants(["a", "b", "c", "d", "e", "f"], seed)[0]),
    );
    expect(firsts.size).toBeGreaterThan(1);
    expect(
      threadIsOnOfflineAsk([
        { authorType: "SUBSCRIBER", body: "do you do IRL stuff? I pay a lot of money" },
        { authorType: "CHATTER", body: "nahh i dont do irl babe its against tos" },
        { authorType: "SUBSCRIBER", body: "Where are you from?" },
      ]),
    ).toBe(false);
    expect(threadIsOnOfflineAsk([{ authorType: "SUBSCRIBER", body: "So do you do IRL stuff?" }])).toBe(true);
    expect(stripUnauthorizedPetNames("29 is a great age, loserr. why's it perfect")).not.toMatch(/loser/i);
    expect(creatorAgeFromText("Fictional 28-year-old fitness creator")).toBe(28);
    expect(looksLikeDirectUnlockPitch("unlock the girlcock video for $28 and I'll show you what i mean")).toBe(true);
    expect(looksLikeAimlessRapport("mmm yeah keep talking\ntell me more babe")).toBe(true);
    expect(looksLikeAimlessRapport("anyway\ni was gonna tell u something")).toBe(false);
    expect(
      pitchIsTooEarly({
        funnelStage: "INTEREST",
        fanMessageCount: 2,
        subscriberText: "How can you make me forget it?",
        threadOnOffline: true,
      }),
    ).toBe(true);
    expect(
      pitchIsTooEarly({
        funnelStage: "OFFER",
        fanMessageCount: 8,
        subscriberText: "can you send the video",
      }),
    ).toBe(false);
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

  it("sells the default video unless context fits another catalog item better", () => {
    const engagement = { ...base, id: "engagement", name: "Engagement pic", standardPrice: 8, minimumPrice: 8, mediaType: "PHOTO" as const, tags: ["engagement"] };
    const dick = { ...base, id: "dick", name: "Dick — playing with girlcock", description: "Short girlcock tease.", standardPrice: 19, minimumPrice: 18, mediaType: "VIDEO" as const, tags: ["dick", "girlcock"] };
    const ass = { ...base, id: "ass", name: "Ass", description: "Ass video.", standardPrice: 25, minimumPrice: 25, mediaType: "VIDEO" as const, tags: ["ass"] };
    const custom = { ...base, id: "custom", name: "Custom video", description: "He orders a custom.", standardPrice: 80, minimumPrice: 70, mediaType: "CUSTOM" as const, tags: ["custom"] };
    const products = [engagement, dick, ass, custom];
    expect(matchSellTarget({ products, subscriberTexts: ["hey"] })?.product.id).toBe("engagement");
    expect(matchSellTarget({ products, subscriberTexts: ["hey"], sequenceProductId: "dick" })?.reason).toBe("SEQUENCE");
    expect(matchSellTarget({ products, subscriberTexts: ["got any girlcock vids?"] })?.product.id).toBe("dick");
    expect(matchSellTarget({ products, subscriberTexts: ["show me ur ass"] })?.product.id).toBe("ass");
    expect(matchSellTarget({ products, subscriberTexts: ["can i order a custom video"] })?.product.id).toBe("custom");
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

  it("applies aftercare after the third sequence unlock, not after unanswered nudges", () => {
    expect(followUpPhase(4, 0)).toBe("FOLLOW_UP");
    expect(followUpPhase(0, 1)).toBe("NONE");
    expect(followUpPhase(0, 2)).toBe("NONE");
    expect(followUpPhase(0, 3)).toBe("AFTERCARE");
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

describe("thread lessons", () => {
  it("remembers are-you-real was already answered so the next sext is not ofcourse", async () => {
    const { inferThreadLessons } = await import("../src/thread-lessons.js");
    const lessons = inferThreadLessons([
      { authorType: "SUBSCRIBER", body: "Are you real?" },
      { authorType: "CREATOR", body: "ofcourse im real\nnot a bot" },
      { authorType: "SUBSCRIBER", body: "i'm so hard for you" },
    ]);
    expect(lessons.answeredAreYouReal).toBe(true);
    expect(lessons.bans.join(" ")).toMatch(/sext back|speech/i);
  });
});

describe("fan flow pdf", () => {
  it("starts unpaid new fans by asking how he is", async () => {
    const { inferFanIntake } = await import("../src/fan-flow.js");
    const beat = inferFanIntake({
      subscriberText: "hey",
      recentMessages: [],
      subscriberName: "Alex",
    });
    expect(beat?.id).toBe("how_are");
    expect(beat?.variants.join("\n")).toMatch(/how are you|hows it going/i);
  });

  it("jumps from jerking to the dive-deeper line instead of remaining intake", async () => {
    const { inferFanIntake } = await import("../src/fan-flow.js");
    const beat = inferFanIntake({
      subscriberText: "one hand busy yeah",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with?" }],
    });
    expect(beat?.id).toBe("vibe_yes");
    expect(beat?.variants.join("\n")).toMatch(/dive deeper/i);
    expect(beat?.variants.join("\n")).not.toMatch(/how old/i);
  });

  it("uses the close vs far location lines", async () => {
    const { inferFanIntake } = await import("../src/fan-flow.js");
    const close = inferFanIntake({
      subscriberText: "miami actually",
      recentMessages: [{ authorType: "CHATTER", body: "where are you from btw" }],
      creatorCity: "Miami",
    });
    expect(close?.variants.join("\n")).toMatch(/pretty close to me/i);
    const far = inferFanIntake({
      subscriberText: "london",
      recentMessages: [{ authorType: "CHATTER", body: "where are you from btw" }],
      creatorCity: "Miami",
    });
    expect(far?.variants.join("\n")).toMatch(/deal breaker/i);
  });

  it("skips to the welcome bundle then sub/dom check", async () => {
    const { inferFanIntake } = await import("../src/fan-flow.js");
    const beat = inferFanIntake({
      subscriberText: "hey",
      recentMessages: [],
      boughtWelcome: true,
    });
    expect(beat?.id).toBe("welcome_bundle");
    expect(beat?.variants.join("\n")).toMatch(/bundle/i);
    expect(beat?.variants.join("\n")).toMatch(/submitting like a good boy/i);
  });
});

describe("sequence ladder", () => {
  it("never prices the next drop at or below the last one", () => {
    expect(sequenceDropPrice({ boughtWelcome: false, spendTier: "LOW", purchasedSequenceCount: 0 })).toBe(7);
    expect(
      sequenceDropPrice({ boughtWelcome: false, spendTier: "LOW", purchasedSequenceCount: 1, previousPrice: 7 }),
    ).toBe(17);
    expect(sequenceDropPrice({ boughtWelcome: true, spendTier: "HIGH", purchasedSequenceCount: 0 })).toBe(8);
    expect(
      sequenceDropPrice({ boughtWelcome: true, spendTier: "HIGH", purchasedSequenceCount: 1, previousPrice: 8 }),
    ).toBe(15);
    expect(sequenceDropPrice({ boughtWelcome: false, spendTier: "LOW", purchasedSequenceCount: 6 })).toBeNull();
  });

  it("blocks a third locked drop while two sit unpaid", () => {
    expect(nextLockedDropPolicy({ unpaidLockedCount: 1, promisedNext: false })).toBe("FOLLOW_UP");
    expect(nextLockedDropPolicy({ unpaidLockedCount: 1, promisedNext: true })).toBe("ALLOW_NEXT");
    expect(nextLockedDropPolicy({ unpaidLockedCount: 2, promisedNext: true })).toBe("STOP");
  });

  it("treats doctors as high spend and welcome purchases as the welcome path", () => {
    expect(assessSpendLikelihood({ job: "doctor" })).toBe("HIGH");
    expect(assessSpendLikelihood({ job: "retail" })).toBe("LOW");
    expect(
      boughtWelcomeMessage({
        purchasedProductIds: ["p1"],
        products: [{ id: "p1", name: "Welcome bundle", tags: ["welcome"] }],
      }),
    ).toBe(true);
    expect(
      pickSequenceDropProduct(
        [
          { id: "a", name: "Engagement", standardPrice: 8, available: true },
          { id: "b", name: "Ass", standardPrice: 25, available: true },
        ],
        17,
        8,
      )?.id,
    ).toBe("b");
  });
});
