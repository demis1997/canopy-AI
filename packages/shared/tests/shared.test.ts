import { describe, expect, it } from "vitest";
import { assertPermission, hasPermission, AuthorizationError } from "../src/permissions.js";
import { canTransition, recommendedActionFor } from "../src/funnel.js";
import { generationOutputSchema } from "../src/schemas.js";
import { maskSecret } from "../src/redaction.js";
import { ladderPrice, nextSendAttempt, followUpPhase, isFirstPpv, ladderSendAttempt, sequenceDropPrice, nextLockedDropPolicy, assessSpendLikelihood } from "../src/crm.js";
import { parseProductCsv, eligibleProducts, matchSellTarget, boughtWelcomeMessage, pickSequenceDropProduct } from "../src/catalog.js";
import { splitReplyBubbles, collectOperatorRejections, parseOperatorRejectReason, containsMeetSpeak, scrubMeetSpeak, looksLikeOfflineAsk, looksLikePetNamePushback, looksLikeFanInvitesQuestions, looksLikeInvertedCuriosity, looksLikeNoPitchAsk, looksLikeAgeAsk, looksLikeAreYouReal, looksLikeInventedAboutHimCallout, looksLikeConfirmedInventedAboutHimCallout, looksLikeLocationAsk, looksLikeDirectUnlockPitch, looksLikeAimlessRapport, looksLikeRelationshipAsk, pitchIsTooEarly, creatorAgeFromText, creatorCityFromText, rotateVariants, threadIsOnOfflineAsk, stripUnauthorizedPetNames, stripCatalogMentions, bannedCatalogNames, wantsNoPitch, doubleOneTrailingEmoji } from "../src/replies.js";

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
    expect(
      parseOperatorRejectReason("rapport · rejected: too abrupt\nwait for him to answer first"),
    ).toBe("too abrupt\nwait for him to answer first");
  });

  it("turns a typed reject reason into a prompt rule with the bad example", async () => {
    const { operatorRejectLesson, formatOperatorRejectionPrompt } = await import("../src/replies.js");
    expect(operatorRejectLesson("dont ask the sub/dom question yet", "what turns you on being in charge")).toMatch(
      /dont ask the sub\/dom question yet/i,
    );
    expect(operatorRejectLesson("too abrupt, wait for him")).toMatch(/Never repeat this mistake: too abrupt/i);
    expect(operatorRejectLesson("stop mentioning the dick clip")).toMatch(/^stop mentioning the dick clip/i);
    const prompt = formatOperatorRejectionPrompt([
      { text: "kneel loser", reason: "dont call fans losers" },
    ]);
    expect(prompt).toMatch(/OPERATOR CORRECTIONS/i);
    expect(prompt).toMatch(/dont call fans losers/);
    expect(prompt).toMatch(/kneel loser/);
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
    expect(looksLikeFanInvitesQuestions("what do you want to know about me?")).toBe(true);
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
    expect(looksLikeInventedAboutHimCallout("you just said you're 29")).toBe(false);
    expect(looksLikeInventedAboutHimCallout("Im asking are you single?")).toBe(false);
    expect(looksLikeInventedAboutHimCallout("are you single?")).toBe(false);
    expect(looksLikeInventedAboutHimCallout("how old are you?")).toBe(false);
    expect(looksLikeRelationshipAsk("Im asking are you single?")).toBe(true);
    expect(looksLikeRelationshipAsk("are you taken")).toBe(true);
    expect(looksLikeRelationshipAsk("Are you single??")).toBe(true);
    expect(looksLikeRelationshipAsk("r u single")).toBe(true);
    expect(looksLikeRelationshipAsk("u got a bf")).toBe(true);
    expect(looksLikeRelationshipAsk("you single rn?")).toBe(true);
    expect(looksLikeRelationshipAsk("do you have a boyfriend?")).toBe(true);
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
    expect(beat?.variants.join("\n")).toMatch(/dive deeper|personal|read you/i);
    expect(beat?.variants.join("\n")).not.toMatch(/how old/i);
    expect(beat?.variants.join("\n")).not.toMatch(/taking control|told what to do|being in charge or submitting/i);
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
    expect(beat?.variants.join("\n")).toMatch(/personal|read you|dive deeper/i);
    expect(beat?.variants.join("\n")).not.toMatch(/taking control|told what to do|being in charge or submitting|good boy/i);
  });

  it("answers are-you-single about her instead of owning a mixup about him", async () => {
    const { inferFanIntake } = await import("../src/fan-flow.js");
    const beat = inferFanIntake({
      subscriberText: "Im asking are you single?",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with?" }],
    });
    expect(beat?.id).toBe("her_single");
    expect(beat?.variants.join("\n")).toMatch(/im single|no bf|single on here/i);
    expect(beat?.variants.join("\n")).not.toMatch(/talking about me|that was about me|mixed it up/i);
  });
});

describe("conversation flow state machine", () => {
  it("answers are you single during vibe check, records both hands, and advances to age", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "both haha are you single?",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with?" }],
    });
    expect(flow.mustAnswer).toBe("relationship");
    expect(flow.next.step).toBe("ASK_AGE");
    expect(flow.next.fanIsJerking).toBe(false);
    expect(flow.deviation).toBe("ANSWERED_PLUS_EXTRA");
    expect(flow.variants.join("\n")).toMatch(/im single|no bf|single on here/i);
    expect(flow.variants.join("\n")).toMatch(/how old/i);
    expect(flow.variants.join("\n")).not.toMatch(/my bad|talking about me|mixed it up/i);
  });

  it("stores fan age, answers her age, and advances to location", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "im 32 what about you?",
      recentMessages: [{ authorType: "CHATTER", body: "mmm how old are you? feel curious idk why" }],
      creatorAge: 28,
    });
    expect(flow.facts.extra.fan_age).toBe("32");
    expect(flow.mustAnswer).toBe("creator-age");
    expect(flow.next.step).toBe("ASK_LOCATION");
    expect(flow.variants.join("\n")).toMatch(/\bim 28\b|old enough/);
    expect(flow.variants.join("\n")).toMatch(/where are you from/i);
  });

  it("stores location, answers her city, and advances to job", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "miami, where do you live?",
      recentMessages: [{ authorType: "CHATTER", body: "where are you from btw" }],
      creatorCity: "coastal city",
    });
    expect(flow.facts.location ?? flow.facts.extra.fan_city).toMatch(/miami/i);
    expect(flow.mustAnswer).toBe("creator-location");
    expect(flow.next.step).toBe("ASK_JOB");
    expect(flow.variants.join("\n")).toMatch(/coast|water|i live|not telling|secret/i);
  });

  it("skips age after a refusal and keeps location pending instead of asking it immediately", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "rather not say",
      recentMessages: [{ authorType: "CHATTER", body: "how old are you?" }],
    });
    expect(flow.deviation).toBe("REFUSED");
    expect(flow.next.skipped?.age).toBe(true);
    expect(flow.next.step).toBe("ASK_LOCATION");
    expect(flow.askPending).toBe(false);
    expect(flow.next.resumeHoldTurns).toBeGreaterThanOrEqual(1);
    expect(flow.variants.join("\n")).toMatch(/no worries|no rush|fair/i);
    expect(flow.variants.join("\n")).not.toMatch(/where are you from/i);
  });

  it("skips an already asked age question after a topic change and holds location for a later turn", async () => {
    const { advanceConversationFlow, serializeFlowState } = await import("../src/conversation-flow.js");
    const first = advanceConversationFlow({
      subscriberText: "anyway whats your favorite color lol",
      recentMessages: [{ authorType: "CHATTER", body: "how old are you?" }],
      fanNotes: { extra: { flow_step: "ASK_AGE", flow_phase: "NEW_FAN_INTAKE", current_question: "AGE", asked_current_question_count: "1", status_age: "asked" } },
    });
    expect(first.next.step).toBe("ASK_LOCATION");
    expect(first.next.stepStatus?.AGE).toBe("skipped");
    expect(first.askPending).toBe(false);
    expect(first.variants.join("\n")).not.toMatch(/how old are you/i);
    expect(first.variants.join("\n")).not.toMatch(/where are you from/i);
    expect(first.variants.join("\n")).not.toMatch(/^wait$/im);
    const second = advanceConversationFlow({
      subscriberText: "yeah",
      recentMessages: [
        { authorType: "CHATTER", body: "how old are you?" },
        { authorType: "CHATTER", body: "lol ok" },
      ],
      fanNotes: { extra: serializeFlowState(first.next) },
    });
    expect(second.next.step).toBe("ASK_LOCATION");
    expect(second.askPending).toBe(true);
    expect(second.variants.join("\n")).toMatch(/where are you from/i);
    expect(second.variants.join("\n")).not.toMatch(/how old are you/i);
  });

  it("asks only the missing job for an existing fan who already has age and city", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "both free",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with, haha?" }],
      existingFan: true,
      fanNotes: { extra: { fan_age: "34", fan_city: "dallas" }, location: "dallas" },
    });
    expect(flow.next.step).toBe("ASK_JOB");
    expect(flow.variants.join("\n")).toMatch(/for a living/i);
    expect(flow.variants.join("\n")).not.toMatch(/how old are you/i);
  });

  it("reacts to not jerking off now without forcing age, and keeps age as the next pending objective", async () => {
    const { advanceConversationFlow, serializeFlowState } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "Well, I'm not jerking off now",
      recentMessages: [
        { authorType: "CHATTER", body: "how many hands are you typing with, haha? you can be honest with me" },
      ],
      existingFan: true,
    });
    expect(flow.deviation).toBe("ANSWERED");
    expect(flow.next.step).toBe("ASK_AGE");
    expect(flow.next.fanIsJerking).toBe(false);
    expect(flow.next.stepStatus?.VIBE).toBe("completed");
    expect(flow.next.stepStatus?.AGE).not.toBe("asked");
    expect(flow.next.stepStatus?.AGE).not.toBe("completed");
    expect(flow.next.resumeHoldTurns).toBeGreaterThanOrEqual(1);
    expect(flow.askPending).toBe(false);
    expect(flow.closer).toBeNull();
    expect(flow.variants.join("\n")).not.toMatch(/how old/i);
    expect(flow.variants.join("\n")).not.toMatch(/how many hands|typing with/i);
    expect(flow.variants.join("\n")).not.toMatch(/^wait$/im);

    const resume = advanceConversationFlow({
      subscriberText: "haha yeah",
      recentMessages: [
        { authorType: "CHATTER", body: "how many hands are you typing with, haha? you can be honest with me" },
        { authorType: "SUBSCRIBER", body: "Well, I'm not jerking off now" },
        { authorType: "CHATTER", body: "haha i caught you at the wrong time then" },
      ],
      existingFan: true,
      fanNotes: { extra: serializeFlowState(flow.next) },
    });
    expect(resume.next.step).toBe("ASK_AGE");
    expect(resume.askPending).toBe(true);
    expect(resume.next.resumeHoldTurns).toBe(0);
    expect(resume.variants.join("\n")).toMatch(/how old/i);
    expect(resume.variants.join("\n")).not.toMatch(/how many hands|typing with/i);
  });

  it("advances on a direct vibe answer", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "one hand busy yeah",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with?" }],
    });
    expect(flow.deviation).toBe("ANSWERED");
    expect(flow.next.fanIsJerking).toBe(true);
    expect(flow.next.step).toBe("ASK_PERSONAL_PERMISSION");
    expect(flow.next.stepStatus?.PERSONAL_PERMISSION).toBe("asked");
    expect(flow.variants.join("\n")).not.toMatch(/how many hands/i);
    expect(flow.variants.join("\n")).not.toMatch(/taking control|told what to do|being in charge or submitting/i);
  });

  it("advances after a topic change instead of repeating the vibe question", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "anyway whats your favorite color lol",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with, haha?" }],
    });
    expect(flow.next.step).toBe("ASK_AGE");
    expect(flow.askPending).toBe(false);
    expect(flow.next.stepStatus?.VIBE).toMatch(/skipped|completed/);
    expect(flow.next.resumeHoldTurns).toBeGreaterThanOrEqual(1);
    expect(flow.variants.join("\n")).not.toMatch(/how old/i);
    expect(flow.variants.join("\n")).not.toMatch(/how many hands|typing with/i);
  });

  it("advances after a joke instead of repeating the vibe question", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "lol maybe i'm typing with my nose",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with?" }],
    });
    expect(flow.next.step).toBe("ASK_AGE");
    expect(flow.askPending).toBe(false);
    expect(flow.variants.join("\n")).not.toMatch(/how many hands|typing with|how old/i);
  });

  it("advances after a sexual interruption instead of repeating the vibe question", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "i'm so hard for you rn",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with, haha?" }],
    });
    expect(flow.next.step).toBe("ASK_AGE");
    expect(flow.askPending).toBe(false);
    expect(flow.variants.join("\n")).not.toMatch(/how many hands|typing with|how old/i);
  });

  it("advances after a short reply instead of repeating the vibe question", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "haha",
      recentMessages: [{ authorType: "CHATTER", body: "how many hands are you typing with?" }],
    });
    expect(flow.next.step).toBe("ASK_AGE");
    expect(flow.askPending).toBe(false);
    expect(flow.variants.join("\n")).not.toMatch(/how many hands|typing with|how old/i);
  });

  it("stays in natural conversation when every intake objective is already asked", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "lol anyway",
      recentMessages: [
        { authorType: "CHATTER", body: "what turns you on, being in charge or submitting like a good boy?" },
      ],
      fanNotes: {
        extra: {
          flow_step: "ASK_SUB_DOM",
          flow_phase: "SUB_DOM_TRANSITION",
          current_question: "SUB_DOM",
          asked_current_question_count: "1",
          status_vibe: "completed",
          status_age: "completed",
          status_location: "completed",
          status_job: "completed",
          status_sub_dom: "asked",
          fan_age: "32",
          fan_city: "miami",
          fan_job: "doctor",
        },
      },
    });
    expect(flow.next.step).toBe("SEND_PRODUCT");
    expect(flow.closer).toBeNull();
    expect(flow.variants.join("\n")).not.toMatch(/being in charge or submitting|how many hands|how old are you/i);
  });

  it("reacts to occupation then asks personal permission without the sub/dom question", async () => {
    const { advanceConversationFlow, serializeFlowState, PERSONAL_PERMISSION_EXAMPLES } = await import(
      "../src/conversation-flow.js"
    );
    expect(new Set(PERSONAL_PERMISSION_EXAMPLES).size).toBeGreaterThan(1);
    const flow = advanceConversationFlow({
      subscriberText: "I'm a carpenter",
      recentMessages: [{ authorType: "CHATTER", body: "what do u do for a living? just curiouss" }],
    });
    expect(flow.facts.extra.fan_job).toMatch(/carpenter/i);
    expect(flow.next.step).toBe("ASK_PERSONAL_PERMISSION");
    expect(flow.next.currentQuestion).toBe("PERSONAL_PERMISSION");
    expect(flow.next.stepStatus?.JOB).toBe("completed");
    expect(flow.next.stepStatus?.PERSONAL_PERMISSION).toBe("asked");
    expect(flow.askPending).toBe(true);
    expect(flow.variants.join("\n")).toMatch(/personal|read you|dive deeper/i);
    expect(flow.variants.join("\n")).not.toMatch(/taking control|told what to do|being in charge or submitting|good boy/i);
    expect(flow.closer).not.toMatch(/taking control|told what to do|being in charge or submitting|good boy/i);
    for (const variant of flow.variants) {
      expect(variant).not.toMatch(/taking control|told what to do|being in charge or submitting/i);
    }

    const granted = advanceConversationFlow({
      subscriberText: "sure",
      recentMessages: [
        { authorType: "CHATTER", body: "what do u do for a living? just curiouss" },
        { authorType: "SUBSCRIBER", body: "I'm a carpenter" },
        { authorType: "CHATTER", body: "you know, i cant quite read you yet\nmind if i ask you something a little personal?" },
      ],
      fanNotes: { extra: { ...serializeFlowState(flow.next), fan_job: "carpenter" } },
    });
    expect(granted.next.step).toBe("ASK_SUB_DOM");
    expect(granted.next.stepStatus?.PERSONAL_PERMISSION).toBe("completed");
    expect(granted.next.stepStatus?.SUB_DOM).toBe("asked");
    expect(granted.variants.join("\n")).toMatch(/taking control|told what to do/i);
    expect(granted.variants.join("\n")).not.toMatch(/submitting like a good boy/i);
    expect(granted.variants.join("\n")).not.toMatch(/personal|read you|dive deeper/i);
  });

  it("treats what? as receptive and then asks the natural sub/dom question", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "what?",
      recentMessages: [
        { authorType: "CHATTER", body: "you know, i cant quite read you yet\nmind if i ask you something a little personal?" },
      ],
      fanNotes: {
        extra: {
          flow_step: "ASK_PERSONAL_PERMISSION",
          flow_phase: "SUB_DOM_TRANSITION",
          current_question: "PERSONAL_PERMISSION",
          asked_current_question_count: "1",
          status_job: "completed",
          status_personal_permission: "asked",
          fan_job: "carpenter",
        },
      },
    });
    expect(flow.deviation).toBe("ANSWERED");
    expect(flow.next.step).toBe("ASK_SUB_DOM");
    expect(flow.variants.join("\n")).toMatch(/taking control|told what to do/i);
    expect(flow.variants.join("\n")).not.toMatch(/submitting like a good boy/i);
  });

  it("does not force the sub/dom question when the fan refuses the personal ask", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "thats too personal",
      recentMessages: [
        { authorType: "CHATTER", body: "mind if i ask you something a little personal?" },
      ],
      fanNotes: {
        extra: {
          flow_step: "ASK_PERSONAL_PERMISSION",
          flow_phase: "SUB_DOM_TRANSITION",
          current_question: "PERSONAL_PERMISSION",
          asked_current_question_count: "1",
          status_personal_permission: "asked",
        },
      },
    });
    expect(flow.deviation).toBe("REFUSED");
    expect(flow.next.stepStatus?.PERSONAL_PERMISSION).toBe("skipped");
    expect(flow.next.stepStatus?.SUB_DOM).toBe("skipped");
    expect(flow.askPending).toBe(false);
    expect(flow.variants.join("\n")).not.toMatch(/taking control|told what to do|being in charge or submitting/i);
  });

  it("holds the sub/dom question when the fan jokes or changes the subject after permission", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const flow = advanceConversationFlow({
      subscriberText: "lol wait are you a cop",
      recentMessages: [
        { authorType: "CHATTER", body: "mind if i ask you something a little personal?" },
      ],
      fanNotes: {
        extra: {
          flow_step: "ASK_PERSONAL_PERMISSION",
          flow_phase: "SUB_DOM_TRANSITION",
          current_question: "PERSONAL_PERMISSION",
          asked_current_question_count: "1",
          status_personal_permission: "asked",
        },
      },
    });
    expect(flow.askPending).toBe(false);
    expect(flow.next.resumeHoldTurns).toBeGreaterThanOrEqual(1);
    expect(flow.next.step).toBe("ASK_SUB_DOM");
    expect(flow.variants.join("\n")).not.toMatch(/taking control|told what to do|being in charge or submitting/i);
  });

  it("does not treat jerking off as a vibe hit when the fan says they are not doing that", async () => {
    const { looksLikeJerking, looksLikeNotJerking, looksLikeStandaloneFiller, repeatsAskedSequenceObjective } =
      await import("../src/conversation-flow.js");
    expect(looksLikeNotJerking("Well, I'm not jerking off now", true)).toBe(true);
    expect(looksLikeJerking("Well, I'm not jerking off now")).toBe(false);
    expect(looksLikeJerking("yeah im jerking off")).toBe(true);
    expect(looksLikeStandaloneFiller("wait")).toBe(true);
    expect(looksLikeStandaloneFiller("wait let me send u something")).toBe(false);
    expect(
      repeatsAskedSequenceObjective("so both hands free or nah?", [
        { authorType: "CHATTER", body: "how many hands are you typing with, haha?" },
      ]),
    ).toBe(true);
  });

  it("actually teases when the fan waits on a tell-hook instead of repeating it", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const { looksLikeWaitingForReveal, looksLikeTellHook } = await import("../src/replies.js");
    expect(looksLikeWaitingForReveal("I am waiting for it")).toBe(true);
    expect(looksLikeWaitingForReveal("What are you going to tell me?")).toBe(true);
    const flow = advanceConversationFlow({
      subscriberText: "What are you going to tell me?",
      recentMessages: [
        { authorType: "CHATTER", body: "anyway" },
        { authorType: "CHATTER", body: "i was gonna tell u something" },
        { authorType: "SUBSCRIBER", body: "I am waiting for it" },
        { authorType: "CHATTER", body: "anyway" },
        { authorType: "CHATTER", body: "i was gonna tell u something" },
      ],
      fanNotes: {
        extra: {
          flow_step: "SEND_PRODUCT",
          flow_phase: "SELLING_SEQUENCE",
        },
      },
    });
    expect(flow.skipPitch).toBe(true);
    expect(flow.beatId).toBe("tell_reveal");
    expect(flow.variants.join("\n")).not.toMatch(/gonna tell u something/i);
    expect(flow.variants.some(looksLikeTellHook)).toBe(false);
    expect(flow.variants.join("\n")).toMatch(/mouth on u|start slow|shot something filthy/i);
  });

  it("lets a dominant fan lead after he says yes to proving himself", async () => {
    const { advanceConversationFlow } = await import("../src/conversation-flow.js");
    const { looksLikeWrongDominanceFlip, FAN_DOMINANT_FOLLOW_VARIANTS } = await import("../src/replies.js");
    const flow = advanceConversationFlow({
      subscriberText: "Yes.",
      recentMessages: [
        { authorType: "SUBSCRIBER", body: "I prefer being in charge" },
        { authorType: "CHATTER", body: "well in that case i just want to see if you can properly do it hehe" },
        { authorType: "CHATTER", body: "so are you going to prove yourself now?" },
      ],
      fanNotes: {
        dominance: "DOMINANT",
        extra: {
          flow_step: "SEND_PRODUCT",
          flow_phase: "SELLING_SEQUENCE",
          fan_dominance: "DOMINANT",
        },
      },
    });
    expect(flow.skipPitch).toBe(true);
    expect(flow.beatId).toBe("dom_prove_yes");
    expect(flow.variants).toEqual(FAN_DOMINANT_FOLLOW_VARIANTS);
    expect(flow.variants.join("\n")).toMatch(/your move|show me|let u lead/i);
    expect(flow.variants.some((text) => looksLikeWrongDominanceFlip(text, "DOMINANT"))).toBe(false);
  });
});

describe("conversation patch schema", () => {
  it("accepts a per-chat clearChat flag", async () => {
    const { conversationPatchSchema } = await import("../src/schemas.js");
    expect(conversationPatchSchema.parse({ clearChat: true })).toEqual({ clearChat: true });
  });
});

describe("confirmed mixup classifier", () => {
  it("requires a prior creator attribution before treating a callout as invented-about-him", () => {
    expect(
      looksLikeConfirmedInventedAboutHimCallout({
        subscriberText: "i never said i'm 29",
        recentMessages: [],
      }).matched,
    ).toBe(false);
    expect(
      looksLikeConfirmedInventedAboutHimCallout({
        subscriberText: "are you single?",
        recentMessages: [{ authorType: "CREATOR", body: "29 is perfect" }],
      }).matched,
    ).toBe(false);
    expect(
      looksLikeConfirmedInventedAboutHimCallout({
        subscriberText: "i never said i'm 29",
        recentMessages: [{ authorType: "CREATOR", body: "29 is perfect" }],
      }).matched,
    ).toBe(true);
    expect(
      looksLikeConfirmedInventedAboutHimCallout({
        subscriberText: "i never said i'm 29",
        recentMessages: [{ authorType: "CREATOR", body: "29 is perfect" }],
      }).aboutMe,
    ).toBe(false);
    expect(
      looksLikeConfirmedInventedAboutHimCallout({
        subscriberText: "i never said i'm from london",
        recentMessages: [{ authorType: "CREATOR", body: "so you're from london" }],
      }).matched,
    ).toBe(true);
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
    let previous = 0;
    for (let i = 0; i < 6; i += 1) {
      const price = sequenceDropPrice({
        boughtWelcome: false,
        spendTier: "LOW",
        purchasedSequenceCount: i,
        previousPrice: previous || null,
      });
      expect(price).toBeGreaterThan(previous);
      previous = price!;
    }
    expect(sequenceDropPrice({ boughtWelcome: false, spendTier: "LOW", purchasedSequenceCount: 6, previousPrice: previous })).toBeNull();
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
