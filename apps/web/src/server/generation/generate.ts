import { randomUUID } from "node:crypto";
import { prisma, requireTenant, type AdultStatus, type Prisma } from "@canopy/database";
import {
  evaluateSafety,
  containsPromptInjection,
  validateProductsAndPrices,
  resolveFunnel,
  PROMPT_VERSION,
  ProviderError,
  personaLooksTrans,
  retrieveTrainingMeta,
  pricingContextFrom,
  type GenerationInput,
} from "@canopy/ai";
import {
  eligibleProducts,
  collectOperatorRejections,
  operatorRejectLessons,
  creatorAgeFromText,
  creatorCityFromText,
  followUpPhase,
  assessSpendLikelihood,
  boughtWelcomeMessage,
  advanceConversationFlow,
  serializeFlowState,
  alreadySentObjectives,
  logFlowDebug,
  inferThreadLessons,
  intakeComplete,
  isExistingFan,
  mergeThreadLessonMemory,
  fanSentMedia,
  looksLikeOfflineAsk,
  looksLikePacingPushback,
  looksLikeWillBuyNext,
  matchSellTarget,
  nextLockedDropPolicy,
  pickSequenceDropProduct,
  playbookFor,
  sequenceDropPrice,
  shouldRunFanIntake,
  splitReplyBubbles,
  threadBannedPetNames,
  threadIsOnOfflineAsk,
  collectPendingFanTurn,
  detectOperationalIntent,
  determineResponseMode,
  operationalGenerationPlan,
  validateReplyGrounding,
  decideConversationTurn,
  validateQualityGrounding,
  analyzePacing,
  type CatalogProduct,
} from "@canopy/shared";
import { persistOperationalSkip } from "../operational-handoff";

import { recordAnalytics } from "../analytics";
import { resolveOrganizationProvider } from "../ai-provider";
import { generateRepliesWithRetry, providerFailureMessage } from "./provider-errors";

const TOKEN_USD_PER_MILLION = 0.5;

function looksLikeRefusal(text: string): boolean {
  return /\b(no thanks|nah|too expensive|too much|cheaper|discount|maybe later|not buying|pass)\b/i.test(
    text,
  );
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      String(item ?? ""),
    ]),
  );
}

export async function generateForConversation(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
  toneOverride?: "PLAYFUL" | "ROMANTIC" | "TEASING" | "DOMINANT" | "SUBMISSIVE" | "DIRECT";
  rewriteStyle?: "SHORTER" | "WARMER" | "PLAYFUL" | "SALES";
  triggerMessageId?: string;
  staleRetry?: boolean;
}) {
  const requestId = randomUUID();
  const tenant = requireTenant(input.organizationId);
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: tenant.organizationId },
    include: {
      creator: { include: { personas: { where: { isActive: true }, take: 1 } } },
      subscriber: true,
      summary: true,
      offers: { include: { product: true }, orderBy: { createdAt: "asc" } },
      activeSequence: { include: { steps: { orderBy: { position: "asc" } } } },
    },
  });
  if (!conversation) throw new Error("Conversation not found");

  const persona = conversation.creator.personas[0];
  if (!persona) throw new Error("Creator has no active persona");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenant.organizationId },
  });
  if (org.status === "SUSPENDED") {
    throw new Error("Organization is suspended");
  }

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id, organizationId: tenant.organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 40,
  });
  const recent = history.reverse();
  const pendingTurn = collectPendingFanTurn({
    messages: recent,
    triggerMessageId: input.triggerMessageId,
  });
  const subscriberText = pendingTurn.combinedText;
  const inputMessageIds = pendingTurn.messageIds;
  if (!subscriberText.trim()) {
    return {
      blocked: false as const,
      generationId: null,
      replyOptions: [],
      skippedGeneration: true as const,
    };
  }

  await recordAnalytics({
    organizationId: tenant.organizationId,
    type: "GENERATION_REQUESTED",
    creatorId: conversation.creatorId,
    chatterId: input.userId,
    conversationId: conversation.id,
    metadata: { requestId, inputMessageIds },
  });

  const pre = evaluateSafety({
    adultStatus: conversation.adultStatus as AdultStatus,
    subscriberText,
  });

  if (containsPromptInjection(subscriberText)) {
    pre.flags.push("PROMPT_INJECTION");
  }

  if (!pre.allowed) {
    const generation = await prisma.generation.create({
      data: {
        organizationId: tenant.organizationId,
        conversationId: conversation.id,
        requestedById: input.userId,
        provider: process.env.AI_PROVIDER ?? process.env.LLM_PROVIDER ?? "venice",
        model: process.env.AI_MODEL || process.env.LLM_MODEL || "blocked",
        status: "BLOCKED",
        recommendedAction: "BLOCK",
        requiresHumanReview: true,
        riskFlags: pre.flags,
        requestId,
        inputMessageIds,
        operationalIntent: detectOperationalIntent(subscriberText).intent,
        responseMode: determineResponseMode({
          operational: detectOperationalIntent(subscriberText),
          subscriberText,
        }),
        diagnostics: {
          inputMessageIds,
          operationalIntent: detectOperationalIntent(subscriberText).intent,
          generationSkipped: true,
          stale: false,
          requestId,
        } as Prisma.InputJsonValue,
      },
    });
    const escalation = await prisma.escalation.create({
      data: {
        organizationId: tenant.organizationId,
        conversationId: conversation.id,
        openedById: input.userId,
        reason: pre.reason ?? "MANUAL",
        summary: pre.chatterMessage,
        riskEvent: { flags: pre.flags, retainedText: false, requestId },
      },
    });
    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "SAFETY_BLOCK",
      creatorId: conversation.creatorId,
      chatterId: input.userId,
      conversationId: conversation.id,
    });
    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "ESCALATION",
      creatorId: conversation.creatorId,
      conversationId: conversation.id,
    });
    return {
      blocked: true as const,
      generationId: generation.id,
      escalationId: escalation.id,
      chatterMessage: pre.chatterMessage,
      flags: pre.flags,
      replyOptions: [],
      mockMode: !process.env.LLM_API_KEY,
    };
  }

  const operational = detectOperationalIntent(subscriberText);
  let decision = decideConversationTurn({
    subscriberText,
    operational,
    recentMessages: recent,
  });
  let plan = operationalGenerationPlan(operational);
  if (conversation.mutedAi) {
    plan = {
      ...plan,
      skipClassify: true,
      skipGenerate: true,
      skipTraining: true,
      pauseAutomation: true,
      requireHumanReview: true,
      allowSexual: false,
      chatterMessage: plan.chatterMessage || "Fan requested a human. AI paused.",
    };
  }
  let responseMode = decision.responseMode;
  if (plan.skipGenerate) {
    const platform = await prisma.platformConversation.findFirst({
      where: { canopyConversationId: conversation.id, organizationId: tenant.organizationId },
      include: { platformAccount: { include: { policy: true } } },
    });
    return persistOperationalSkip({
      organizationId: tenant.organizationId,
      conversationId: conversation.id,
      creatorId: conversation.creatorId,
      userId: input.userId,
      requestId,
      provider: process.env.AI_PROVIDER ?? process.env.LLM_PROVIDER ?? "venice",
      model: process.env.AI_MODEL || process.env.LLM_MODEL || "skipped",
      mockMode: !process.env.LLM_API_KEY,
      route: operational,
      plan,
      responseMode,
      inputMessageIds,
      flags: [...pre.flags, operational.intent],
      takeoverMinutes: platform?.platformAccount.policy?.humanTakeoverMinutes,
    });
  }

  const fanMessageCount = await prisma.message.count({
    where: {
      conversationId: conversation.id,
      organizationId: tenant.organizationId,
      authorType: "SUBSCRIBER",
    },
  });

  const memories = await prisma.subscriberMemory.findMany({
    where: {
      organizationId: tenant.organizationId,
      subscriberId: conversation.subscriberId,
      creatorId: conversation.creatorId,
      deletedAt: null,
      OR: [{ sourceMessageId: null }, { sourceMessage: { authorType: "SUBSCRIBER" } }],
    },
    orderBy: { lastConfirmedAt: "desc" },
    take: 25,
  });
  const fanNote = await prisma.fanNote.findUnique({
    where: {
      creatorId_subscriberId: {
        creatorId: conversation.creatorId,
        subscriberId: conversation.subscriberId,
      },
    },
  });
  const creatorSpend = await prisma.purchase.aggregate({
    where: {
      organizationId: tenant.organizationId,
      subscriberId: conversation.subscriberId,
      refunded: false,
      conversation: { creatorId: conversation.creatorId },
    },
    _sum: { amountCents: true },
  });

  const productRows = await prisma.product.findMany({
    where: {
      organizationId: tenant.organizationId,
      creatorId: conversation.creatorId,
      available: true,
    },
    include: { media: true, previews: true },
  });
  const purchases = await prisma.purchase.findMany({
    where: {
      organizationId: tenant.organizationId,
      subscriberId: conversation.subscriberId,
      refunded: false,
      conversation: { creatorId: conversation.creatorId },
    },
    select: {
      productId: true,
      amountCents: true,
      product: { select: { media: { select: { mediaId: true } } } },
    },
  });
  const ownedMediaIds = new Set(purchases.flatMap((p) => p.product.media.map((m) => m.mediaId)));
  const purchasedProductIds = [
    ...new Set([
      ...purchases.map((p) => p.productId),
      ...productRows
        .filter((p) => !p.resaleAllowed && p.media.some((m) => ownedMediaIds.has(m.mediaId)))
        .map((p) => p.id),
    ]),
  ];
  const purchasedPpvCount = purchases.length;
  const previousPurchasePrice = Math.max(0, ...purchases.map((p) => p.amountCents / 100));
  const earlyUnpaid = conversation.offers.some(
    (offer) => offer.accepted !== true && !purchasedProductIds.includes(offer.productId),
  );
  decision = decideConversationTurn({
    subscriberText,
    operational,
    recentMessages: recent,
    purchasedPpvCount,
    unpaidOffer: earlyUnpaid,
    followUpPhase: followUpPhase(conversation.unansweredFollowUps, purchasedPpvCount),
  });
  responseMode = decision.responseMode;
  const catalog: CatalogProduct[] = productRows.map((p) => ({
    id: p.id,
    creatorId: p.creatorId,
    organizationId: p.organizationId,
    name: p.name,
    description: p.description,
    mediaType: p.mediaType,
    standardPrice: p.standardPriceCents / 100,
    minimumPrice: p.minimumPriceCents / 100,
    secondPrice: p.secondPriceCents != null ? p.secondPriceCents / 100 : null,
    discountLimitPercent: p.discountLimitPercent,
    bundlePrice: p.bundlePriceCents != null ? p.bundlePriceCents / 100 : null,
    tags: p.tags,
    available: p.available && p.sourceAvailable !== false,
    source: p.source,
    timesSold: p.timesSold,
    conversionRate: p.conversionRate,
    lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
    resaleAllowed: p.resaleAllowed,
    mediaIds: p.media.map((m) => m.mediaId),
    previewIds: p.previews.map((m) => m.mediaId),
    externalId: p.externalId,
  }));
  const { eligible: products } = eligibleProducts({
    products: catalog,
    creatorId: conversation.creatorId,
    purchasedProductIds,
    funnelStage: conversation.funnelStage,
  });

  const dbChunks = await prisma.trainingChunk.findMany({
    where: {
      organizationId: tenant.organizationId,
      status: "APPROVED",
      OR: [{ creatorId: conversation.creatorId }, { creatorId: null }],
    },
    take: 80,
  });
  const transPersona = personaLooksTrans(persona);

  const { provider, mode, model } = await resolveOrganizationProvider(tenant.organizationId);
  const demoSales = conversation.creator.isDemo;
  const funnelState = {
    stage: conversation.funnelStage,
    lastOfferAt: demoSales ? null : conversation.lastOfferAt,
    offerCountToday: demoSales ? 0 : conversation.offerCountToday,
    rapportPriority: demoSales ? false : conversation.rapportPriority,
  };

  try {
    let classified;
    try {
      classified = await provider.classifyIntent({
        message: subscriberText,
        recentContext: recent.map((m) => `${m.authorType}: ${m.body}`).join("\n"),
        funnelStage: conversation.funnelStage,
        requestId,
      });
    } catch {
      classified = {
        intent: "UNCERTAIN" as const,
        confidence: 0.3,
        latencyMs: 0,
        model: model || "unknown",
      };
    }

    if (classified.intent === "PRICE_OBJECTION" || looksLikeRefusal(subscriberText)) {
      const open = [...conversation.offers].reverse().find((o) => o.accepted === null);
      if (open) {
        await prisma.offer.update({ where: { id: open.id }, data: { accepted: false } });
        open.accepted = false;
      }
    }

    const pricing = pricingContextFrom({
      offers: conversation.offers.map((o) => ({
        productId: o.productId,
        productName: o.product.name,
        price: o.priceCents / 100,
        listPrice: o.product.standardPriceCents / 100,
        accepted: o.accepted,
      })),
      intent: classified.intent,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        standardPrice: p.standardPrice,
        minimumPrice: p.minimumPrice,
        secondPrice: p.secondPrice,
        discountLimitPercent: p.discountLimitPercent,
      })),
      unansweredFollowUps: conversation.unansweredFollowUps,
      purchasedPpvCount,
    });

    const funnel = resolveFunnel({
      state: funnelState,
      intent: classified.intent,
      suggested: conversation.funnelStage,
    });

    const allowSexting =
      decision.allowExplicit && (responseMode === "EXPLICIT" || responseMode === "SALES");
    const retrieved = retrieveTrainingMeta(
      {
        message: subscriberText,
        intent: classified.intent,
        funnelStage: conversation.funnelStage,
        transPersona,
        allowSexting,
        allowPricing: decision.allowPrice || decision.buyingSignals.includes("price"),
        responseMode,
        salesReadiness: decision.salesReadiness,
        extraChunks: [
          ...persona.approvedExampleMessages.map((content) => ({
            content,
            tags: ["approved-example"],
          })),
          ...dbChunks.map((c) => ({
            content: c.content,
            intent: c.intent,
            funnelStage: c.funnelStage,
            tags: [
              c.documentType.toLowerCase(),
              ...(/girlcock|tgirl|trans girl|ladycock/i.test(c.content) ? ["trans"] : []),
            ],
          })),
        ],
      },
      responseMode === "NATURAL" || responseMode === "OPERATIONAL" || responseMode === "SUPPORT"
        ? 4
        : 6,
    );
    const examples = retrieved.examples;

    const discardedRows = await prisma.replyOption.findMany({
      where: { organizationId: tenant.organizationId, outcome: "DISCARDED" },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        text: true,
        internalReason: true,
        generation: { select: { conversationId: true } },
      },
    });
    const threadLessons = mergeThreadLessonMemory(
      inferThreadLessons(recent.map((m) => ({ authorType: m.authorType, body: m.body }))),
      memories.find((m) => m.key === "thread_lessons")?.value,
    );
    const fanHasSentPics = fanSentMedia(
      recent.map((m) => ({ authorType: m.authorType, body: m.body, attachments: m.attachments })),
    );
    const discarded = collectOperatorRejections(
      discardedRows.map((row) => ({
        text: row.text,
        internalReason: row.internalReason,
        conversationId: row.generation.conversationId,
      })),
      20,
    );
    const threadFirst = [
      ...discarded.filter((row) => row.conversationId === conversation.id),
      ...discarded.filter((row) => row.conversationId !== conversation.id),
    ];
    const operatorRejections = [
      ...threadFirst,
      ...threadLessons.bans.map((reason) => ({
        text: "",
        reason,
        conversationId: conversation.id,
      })),
    ];
    for (const lesson of operatorRejectLessons(threadFirst)) {
      if (!threadLessons.bans.includes(lesson)) threadLessons.bans.push(lesson);
    }

    const creatorAge = creatorAgeFromText(persona.biography, persona.authorisedBackstory);
    const creatorCity = creatorCityFromText(persona.biography, persona.authorisedBackstory);
    const threadOnOffline = threadIsOnOfflineAsk(recent);
    const sequenceProductId =
      conversation.activeSequence?.steps[conversation.activeSequenceStep]?.productId ??
      conversation.activeSequence?.steps.find((s) => s.productId)?.productId ??
      null;
    const extra = stringRecord(fanNote?.extra);
    const boughtWelcomeEarly = boughtWelcomeMessage({
      extra,
      products,
      purchasedProductIds,
    });
    const unpaidOffer = [...conversation.offers]
      .reverse()
      .find((offer) => offer.accepted !== true && !purchasedProductIds.includes(offer.productId));
    const unpaidLockedCount = new Set(
      conversation.offers
        .filter(
          (offer) => offer.accepted !== true && !purchasedProductIds.includes(offer.productId),
        )
        .map((offer) => offer.productId),
    ).size;
    const lockPolicy = nextLockedDropPolicy({
      unpaidLockedCount,
      promisedNext: looksLikeWillBuyNext(subscriberText),
      honoredPromise: extra.honored_next_promise === "true",
    });
    const flow = advanceConversationFlow({
      subscriberText,
      recentMessages: recent.map((m) => ({ authorType: m.authorType, body: m.body })),
      fanNotes: fanNote
        ? {
            location: fanNote.location,
            notes: fanNote.notes,
            extra,
            dominance: fanNote.dominance,
          }
        : null,
      subscriberName: conversation.subscriber.displayName,
      creatorAge,
      creatorCity,
      boughtWelcome: boughtWelcomeEarly,
      existingFan: isExistingFan({
        funnelStage: conversation.funnelStage,
        purchasedPpvCount: boughtWelcomeEarly
          ? Math.max(0, purchasedPpvCount - 1)
          : purchasedPpvCount,
        priorCreatorMessages: recent.filter((m) => m.authorType !== "SUBSCRIBER").length,
        extra,
        ageKnown: Boolean(extra.fan_age),
        cityKnown: Boolean(fanNote?.location || extra.fan_city),
        jobKnown: Boolean(extra.fan_job),
      }),
      productsPurchased: purchasedPpvCount,
      productsSent: conversation.offers.length,
      unpaidProductId: unpaidOffer?.productId,
      allowedSkipToNextProduct: lockPolicy === "ALLOW_NEXT",
    });
    const facts = flow.facts;
    const mergedExtra =
      responseMode === "SUPPORT"
        ? { ...extra, ...facts.extra }
        : { ...extra, ...facts.extra, ...serializeFlowState(flow.next) };
    if (facts.dominance) mergedExtra.fan_dominance = facts.dominance;
    if (flow.next.fanIsJerking != null)
      mergedExtra.fan_jerking = flow.next.fanIsJerking ? "true" : "false";
    logFlowDebug({
      phase: flow.next.phase,
      step: flow.next.step,
      previousStep: flow.previous.step,
      intent: flow.mustAnswer ?? flow.intent,
      deviation: flow.deviation,
      facts: facts.extra,
      appliedGuard: null,
      replaced: false,
    });
    if (
      Object.keys(facts.extra).length ||
      facts.location ||
      facts.dominance ||
      facts.notesAppend ||
      extra.flow_step !== mergedExtra.flow_step
    ) {
      const nextNotes = [fanNote?.notes, facts.notesAppend].filter(Boolean).join("\n").trim();
      await prisma.fanNote.upsert({
        where: {
          creatorId_subscriberId: {
            creatorId: conversation.creatorId,
            subscriberId: conversation.subscriberId,
          },
        },
        create: {
          organizationId: tenant.organizationId,
          creatorId: conversation.creatorId,
          subscriberId: conversation.subscriberId,
          location: facts.location ?? "",
          dominance: facts.dominance ?? "UNKNOWN",
          notes: nextNotes,
          extra: mergedExtra,
        },
        update: {
          extra: mergedExtra,
          ...(facts.location ? { location: facts.location } : {}),
          ...(facts.dominance ? { dominance: facts.dominance } : {}),
          ...(facts.notesAppend ? { notes: nextNotes } : {}),
        },
      });
    }
    const boughtWelcome = boughtWelcomeMessage({
      extra: mergedExtra,
      products,
      purchasedProductIds,
    });
    const existingFan = isExistingFan({
      funnelStage: conversation.funnelStage,
      purchasedPpvCount: boughtWelcome ? Math.max(0, purchasedPpvCount - 1) : purchasedPpvCount,
      priorCreatorMessages: recent.filter((m) => m.authorType !== "SUBSCRIBER").length,
      extra: mergedExtra,
      ageKnown: Boolean(mergedExtra.fan_age),
      cityKnown: Boolean(fanNote?.location || facts.location || mergedExtra.fan_city),
      jobKnown: Boolean(mergedExtra.fan_job),
    });
    const sellable = products.map((p) => ({
      id: p.id,
      name: p.name.replace(/\s*\(DEMO\)\s*/gi, "").trim(),
      description: p.description,
      tags: p.tags,
      mediaType: p.mediaType,
      standardPrice: p.standardPrice,
      allowedPrice: pricing.ladder.find((row) => row.productId === p.id)?.allowedPrice,
      available: p.available && p.sourceAvailable !== false,
    }));
    let sellMatch = matchSellTarget({
      products: sellable,
      subscriberTexts: recent.filter((m) => m.authorType === "SUBSCRIBER").map((m) => m.body),
      notes: `${fanNote?.notes ?? ""} ${facts.notesAppend ?? ""} ${conversation.subscriber.notes ?? ""}`,
      memories: memories.map((m) => m.value),
      sequenceProductId,
    });
    const spendTier =
      flow.next.spendingAssessment ??
      assessSpendLikelihood({
        age: mergedExtra.fan_age,
        city: facts.location ?? fanNote?.location ?? mergedExtra.fan_city,
        job: mergedExtra.fan_job,
      });
    if (sellMatch?.reason !== "CONTEXT") {
      if (lockPolicy === "STOP") {
        sellMatch = null;
      } else if (lockPolicy === "FOLLOW_UP") {
        const unpaid = [...conversation.offers]
          .reverse()
          .find(
            (offer) => offer.accepted !== true && !purchasedProductIds.includes(offer.productId),
          );
        const product = sellable.find((row) => row.id === unpaid?.productId);
        if (product) sellMatch = { product, reason: "SEQUENCE" };
      } else {
        const target = sequenceDropPrice({
          boughtWelcome,
          spendTier,
          purchasedSequenceCount: purchasedPpvCount,
          previousPrice: previousPurchasePrice || null,
        });
        if (target != null) {
          const picked = pickSequenceDropProduct(sellable, target, previousPurchasePrice || null);
          if (picked) {
            sellMatch = {
              product: picked,
              reason: sequenceProductId === picked.id ? "SEQUENCE" : "DEFAULT",
            };
          }
        } else {
          sellMatch = null;
        }
      }
    }
    const notesForIntake = {
      location: facts.location ?? fanNote?.location,
      notes: [fanNote?.notes, facts.notesAppend].filter(Boolean).join("\n"),
      extra: mergedExtra,
      dominance: facts.dominance ?? fanNote?.dominance,
    };
    let fanIntake =
      (shouldRunFanIntake({
        funnelStage: conversation.funnelStage,
        intent: classified.intent,
        purchasedPpvCount,
        subscriberText,
        sequenceKind: conversation.activeSequence?.kind,
        intakeComplete: intakeComplete({
          extra: mergedExtra,
          location: notesForIntake.location,
          notes: notesForIntake.notes,
          dominance: notesForIntake.dominance,
          boughtWelcome,
        }),
      }) ||
        looksLikePacingPushback(subscriberText)) &&
      !looksLikeOfflineAsk(subscriberText) &&
      sellMatch?.reason !== "CONTEXT"
        ? { id: flow.beatId, variants: flow.variants, skipPitch: flow.skipPitch }
        : null;
    if (fanIntake?.id === "ignore" || fanIntake?.skipPitch || flow.skipPitch) {
      if (sellMatch?.reason !== "CONTEXT") sellMatch = null;
    }
    if (flow.sellContent && sellMatch?.reason !== "CONTEXT") {
      /* keep sequence/default match for an explicit content request after intake is abandoned */
    }
    if (
      responseMode === "OPERATIONAL" ||
      responseMode === "SUPPORT" ||
      responseMode === "NATURAL"
    ) {
      sellMatch = null;
      fanIntake = null;
    }
    if (!decision.allowPitch && sellMatch?.reason !== "CONTEXT") sellMatch = null;
    if (!decision.allowPitch) sellMatch = null;
    if (!decision.intakeOpportunity) fanIntake = null;

    const generationInput: GenerationInput = {
      requestId,
      model: model || "mock-qwen3-32b-uncensored",
      promptVersionId: PROMPT_VERSION,
      persona: {
        displayName: persona.displayName,
        biography: persona.biography,
        authorisedBackstory: persona.authorisedBackstory,
        personality: persona.personality,
        tone: persona.tone,
        typicalMessageLength: persona.typicalMessageLength,
        preferredEmojis: persona.preferredEmojis,
        frequentlyUsedPhrases: persona.frequentlyUsedPhrases,
        preferredExplicitVocabulary: persona.preferredExplicitVocabulary,
        prohibitedWords: persona.prohibitedWords,
        preferredCompliments: persona.preferredCompliments,
        allowedExplicitness: persona.allowedExplicitness,
        style: persona.style,
        interests: persona.interests,
        contentBoundaries: persona.contentBoundaries,
        claimsNeverToMake: persona.claimsNeverToMake,
        customContentRules: persona.customContentRules,
        offlineMeetingPolicy: persona.offlineMeetingPolicy,
        discountLimitPercent: persona.discountLimitPercent,
        approvedExampleMessages: persona.approvedExampleMessages,
        favouriteColor: persona.favouriteColor,
        favouriteFlowers: persona.favouriteFlowers,
      },
      recentMessages: recent.map((m) => ({ authorType: m.authorType, body: m.body })),
      summary: conversation.summary?.summary,
      memories: memories.map((m) => ({
        category: m.category,
        key: m.key,
        value: m.verified ? m.value : `${m.value} (unverified guess, confidence ${m.confidence})`,
        confidence: m.confidence,
        verified: m.verified,
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name.replace(/\s*\(DEMO\)\s*/gi, "").trim(),
        description: p.description,
        standardPrice: p.standardPrice,
        minimumPrice: p.minimumPrice,
        secondPrice: p.secondPrice,
        discountLimitPercent: p.discountLimitPercent,
        sendAttempt: pricing.ladder.find((row) => row.productId === p.id)?.sendAttempt,
        allowedPrice: pricing.ladder.find((row) => row.productId === p.id)?.allowedPrice,
        available: p.available && p.sourceAvailable !== false,
        tags: p.tags,
        mediaType: p.mediaType,
        explicitnessCategory:
          productRows.find((row) => row.id === p.id)?.explicitnessCategory ?? "SUGGESTIVE",
      })),
      funnelStage: conversation.funnelStage,
      playbook: fanIntake
        ? "FAN_INTAKE_FLOW"
        : playbookFor(
            conversation.funnelStage,
            classified.intent,
            conversation.unansweredFollowUps,
            purchasedPpvCount,
          ),
      retrievedExamples: examples,
      operatorRejections,
      threadLessons: threadLessons.bans,
      fanSentPics: fanHasSentPics,
      toneOverride: input.toneOverride,
      rewriteStyle: input.rewriteStyle,
      pricing,
      followUpPhase: followUpPhase(conversation.unansweredFollowUps, purchasedPpvCount),
      fanIntakeBeat: fanIntake?.variants[0],
      conversationFlow: {
        phase: flow.next.phase,
        step: flow.next.step,
        previousStep: flow.previous.step,
        mustAnswer: flow.mustAnswer,
        closer: flow.closer,
        quotedLines: flow.quotedLines,
        deviation: flow.deviation,
        askPending: Boolean(
          flow.askPending &&
          decision.intakeOpportunity &&
          responseMode !== "NATURAL" &&
          responseMode !== "SUPPORT" &&
          responseMode !== "OPERATIONAL",
        ),
        pendingQuestion: flow.next.currentQuestion,
        resumeHoldTurns: flow.next.resumeHoldTurns,
        skipPitch:
          flow.skipPitch ||
          !decision.allowPitch ||
          responseMode === "NATURAL" ||
          responseMode === "SUPPORT",
      },
      boughtWelcome,
      existingFan,
      unpaidLockedCount,
      sellTarget: sellMatch
        ? {
            productId: sellMatch.product.id,
            name: sellMatch.product.name,
            price: sellMatch.product.allowedPrice ?? sellMatch.product.standardPrice,
            reason: sellMatch.reason,
          }
        : null,
      fanNotes:
        fanNote ||
        facts.notesAppend ||
        facts.location ||
        facts.dominance ||
        Object.keys(facts.extra).length
          ? {
              realName: fanNote?.realName ?? "",
              location: facts.location ?? fanNote?.location ?? "",
              dominance: facts.dominance ?? fanNote?.dominance ?? "UNKNOWN",
              preferredTone: fanNote?.preferredTone ?? "",
              notes: [fanNote?.notes, facts.notesAppend].filter(Boolean).join("\n"),
              extra: mergedExtra,
              spend: (creatorSpend._sum.amountCents ?? conversation.subscriber.spendCents) / 100,
            }
          : conversation.subscriber.notes
            ? {
                realName: "",
                location: "",
                dominance: "UNKNOWN",
                preferredTone: "",
                notes: conversation.subscriber.notes,
                extra: mergedExtra,
                spend: (creatorSpend._sum.amountCents ?? conversation.subscriber.spendCents) / 100,
              }
            : null,
      activeSequence: conversation.activeSequence
        ? {
            name: conversation.activeSequence.name,
            kind: conversation.activeSequence.kind,
            stepIndex: conversation.activeSequenceStep,
            current: (() => {
              const step =
                conversation.activeSequence.steps[conversation.activeSequenceStep] ??
                conversation.activeSequence.steps[0];
              return step
                ? {
                    body: step.body,
                    mediaHint: step.mediaHint,
                    priceTier: step.priceTier,
                    productId: step.productId,
                  }
                : { body: "", mediaHint: "TEXT", priceTier: 1 };
            })(),
            remaining: conversation.activeSequence.steps
              .slice(conversation.activeSequenceStep + 1)
              .map((s) => s.body),
          }
        : fanIntake
          ? {
              name: "New / existing fan flow",
              kind: "STARTER",
              stepIndex: 0,
              current: { body: fanIntake.variants[0] ?? "", mediaHint: "TEXT", priceTier: 1 },
              remaining: [],
            }
          : null,
      responseMode,
      operationalIntent: operational.intent,
      latestFanTurn: pendingTurn.messages.map((row) => `${row.id}: ${row.body}`).join("\n"),
      inputMessageIds,
      salesReadiness: decision.salesReadiness,
      latestTurnIntensity: decision.latestTurnIntensity,
      intakeOpportunity: decision.intakeOpportunity,
      allowPitch: decision.allowPitch,
      buyingSignals: decision.buyingSignals,
    };

    const generateOnce = (correctiveRetry = false, codes: string[] = []) =>
      generateRepliesWithRetry(provider, {
        ...generationInput,
        correctiveRetry,
        correctiveCodes: codes,
      });

    let result = await generateOnce(false);

    const post = evaluateSafety({
      adultStatus: conversation.adultStatus as AdultStatus,
      subscriberText,
      generatedTexts: result.output.replyOptions.map((o) => o.text),
    });
    if (!post.allowed) {
      const generation = await prisma.generation.create({
        data: {
          organizationId: tenant.organizationId,
          conversationId: conversation.id,
          requestedById: input.userId,
          provider: mode,
          model: result.model,
          status: "BLOCKED",
          latencyMs: result.latencyMs,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          requestId,
          riskFlags: post.flags,
          recommendedAction: "BLOCK",
          requiresHumanReview: true,
        },
      });
      await prisma.escalation.create({
        data: {
          organizationId: tenant.organizationId,
          conversationId: conversation.id,
          openedById: input.userId,
          reason: post.reason ?? "SAFETY_POST_CHECK",
          summary: post.chatterMessage,
          riskEvent: { flags: post.flags, retainedText: false, requestId },
        },
      });
      await recordAnalytics({
        organizationId: tenant.organizationId,
        type: "SAFETY_BLOCK",
        creatorId: conversation.creatorId,
        conversationId: conversation.id,
      });
      return {
        blocked: true as const,
        generationId: generation.id,
        chatterMessage: post.chatterMessage,
        flags: post.flags,
        replyOptions: [],
        mockMode: mode === "mock",
      };
    }

    const validateOpts = {
      creatorId: conversation.creatorId,
      purchasedProductIds,
      subscriberText,
      rejections: operatorRejections,
      conversationId: conversation.id,
      dominance: facts.dominance ?? fanNote?.dominance,
      creatorAge,
      creatorCity,
      funnelStage: conversation.funnelStage,
      fanMessageCount,
      threadOnOffline,
      fanIntake: fanIntake?.variants,
      flowPlan: {
        mustAnswer: flow.mustAnswer,
        closer: flow.closer,
        variants: flow.variants,
        phase: flow.next.phase,
        step: flow.next.step,
        previousStep: flow.previous.step,
        deviation: flow.deviation,
        facts: flow.facts.extra,
        askedObjectives: alreadySentObjectives(
          recent.map((m) => ({ authorType: m.authorType, body: m.body })),
          flow.previous,
        ),
        askPending: Boolean(
          flow.askPending &&
          decision.intakeOpportunity &&
          responseMode !== "NATURAL" &&
          responseMode !== "SUPPORT" &&
          responseMode !== "OPERATIONAL",
        ),
        pendingQuestion: flow.next.currentQuestion,
        skipPitch:
          flow.skipPitch ||
          !decision.allowPitch ||
          responseMode === "NATURAL" ||
          responseMode === "SUPPORT",
      },
      variantSeed: requestId,
      recentOutbound: recent
        .filter((m) => m.authorType !== "SUBSCRIBER")
        .slice(-8)
        .map((m) => m.body),
      recentMessages: recent.map((m) => ({ authorType: m.authorType, body: m.body })),
      transPersona,
      threadBannedPetNames: threadBannedPetNames(recent) || threadLessons.bannedPetNames,
      threadLessons,
      fanSentPics: fanHasSentPics,
      sellTarget: sellMatch
        ? {
            productId: sellMatch.product.id,
            name: sellMatch.product.name,
            price: sellMatch.product.allowedPrice ?? sellMatch.product.standardPrice,
            reason: sellMatch.reason,
          }
        : undefined,
      operationalIntent: operational.intent,
      responseMode,
      salesReadiness: decision.salesReadiness,
      intakeOpportunity: decision.intakeOpportunity,
    };

    const catalogForValidate = products.map((p) => ({
      id: p.id,
      name: p.name,
      standardPrice: p.standardPrice,
      minimumPrice: p.minimumPrice,
      secondPrice: p.secondPrice,
      discountLimitPercent: p.discountLimitPercent,
      sendAttempt: pricing.ladder.find((row) => row.productId === p.id)?.sendAttempt,
      available: p.available && p.sourceAvailable !== false,
      creatorId: p.creatorId,
      resaleAllowed: p.resaleAllowed,
    }));

    const groundingCodesFor = (output: typeof result.output) =>
      output.replyOptions.flatMap((opt) => {
        const check = validateReplyGrounding({
          reply: opt.text,
          turn: subscriberText,
          operational,
          mode: responseMode,
          recommendedProductId: output.recommendedProductId,
        });
        const quality = validateQualityGrounding({
          reply: opt.text,
          turn: subscriberText,
          decision,
          recommendedProductId: output.recommendedProductId,
          pacing: analyzePacing(recent),
        });
        return [...(check.ok ? [] : [check.code]), ...(quality.ok ? [] : [quality.code])];
      });

    let validated = validateProductsAndPrices(
      result.output,
      catalogForValidate,
      10,
      pricing.concessionAllowed,
      validateOpts,
    );
    let groundingCodes = groundingCodesFor(validated.output);
    if (groundingCodes.length || !validated.output.replyOptions.length) {
      result = await generateOnce(true, groundingCodes);
      const postRetry = evaluateSafety({
        adultStatus: conversation.adultStatus as AdultStatus,
        subscriberText,
        generatedTexts: result.output.replyOptions.map((o) => o.text),
      });
      if (!postRetry.allowed) {
        groundingCodes = ["SAFETY_POST_CHECK"];
        validated = {
          ok: false,
          errors: ["SAFETY_POST_CHECK"],
          output: {
            ...validated.output,
            replyOptions: [],
            recommendedProductId: null,
            approvedPrice: null,
            recommendedAction: "REQUEST_HUMAN_REVIEW",
            requiresHumanReview: true,
            riskFlags: [...validated.output.riskFlags, ...postRetry.flags],
          },
        };
      } else {
        validated = validateProductsAndPrices(
          result.output,
          catalogForValidate,
          10,
          pricing.concessionAllowed,
          validateOpts,
        );
        groundingCodes = groundingCodesFor(validated.output);
        if (groundingCodes.length) {
          validated = {
            ok: false,
            errors: [...validated.errors, ...groundingCodes],
            output: {
              ...validated.output,
              replyOptions: [],
              recommendedProductId: null,
              approvedPrice: null,
              recommendedAction: "REQUEST_HUMAN_REVIEW",
              requiresHumanReview: true,
              riskFlags: [...validated.output.riskFlags, ...groundingCodes],
            },
          };
        }
      }
    }

    const newestInput = pendingTurn.newestMessageId
      ? recent.find((row) => row.id === pendingTurn.newestMessageId)
      : null;
    const newerSubscriber = newestInput
      ? await prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            organizationId: tenant.organizationId,
            authorType: { in: ["SUBSCRIBER", "CHATTER", "CREATOR"] },
            createdAt: { gt: newestInput.createdAt },
            id: { notIn: inputMessageIds },
          },
          orderBy: { createdAt: "desc" },
        })
      : null;
    if (newerSubscriber && !input.staleRetry) {
      await prisma.generation.create({
        data: {
          organizationId: tenant.organizationId,
          conversationId: conversation.id,
          requestedById: input.userId,
          provider: mode,
          model: result.model,
          status: "STALE",
          recommendedAction: "REQUEST_HUMAN_REVIEW",
          requiresHumanReview: true,
          requestId,
          inputMessageIds,
          operationalIntent: operational.intent,
          responseMode,
          diagnostics: {
            inputMessageIds,
            operationalIntent: operational.intent,
            responseMode,
            generationSkipped: false,
            stale: true,
            requestId,
          } as Prisma.InputJsonValue,
        },
      });
      return generateForConversation({
        ...input,
        triggerMessageId: newerSubscriber.id,
        staleRetry: true,
      });
    }

    const nextFunnel = resolveFunnel({
      state: funnelState,
      intent: validated.output.intent,
      suggested: validated.output.suggestedFunnelTransition,
    });

    const status = newerSubscriber ? "STALE" : validated.ok ? "COMPLETED" : "INVALID";
    const diagnostics: Prisma.InputJsonValue = {
      inputMessageIds,
      operationalIntent: operational.intent,
      responseMode,
      salesReadiness: decision.salesReadiness,
      latestTurnIntensity: decision.latestTurnIntensity,
      intakeOpportunity: decision.intakeOpportunity,
      buyingSignals: decision.buyingSignals,
      retrievedTrainingTags: retrieved.chunks.flatMap((chunk) => chunk.tags),
      guardFailureCodes: [...validated.errors, ...groundingCodes],
      classifierIntent: classified.intent,
      classifierConfidence: classified.confidence,
      trainingChunks: retrieved.chunks,
      guardsApplied: validated.output.riskFlags.filter((flag) => flag.startsWith("GUARD:")),
      validationFailureCodes: [...validated.errors, ...groundingCodes],
      generationSkipped: false,
      stale: Boolean(newerSubscriber),
      requestId,
      ...(process.env.NODE_ENV === "development"
        ? { debugExplanation: decision.debugExplanation }
        : {}),
    };
    const generation = await prisma.generation.create({
      data: {
        organizationId: tenant.organizationId,
        conversationId: conversation.id,
        requestedById: input.userId,
        provider: mode,
        model: result.model,
        status,
        intent: validated.output.intent,
        funnelStage: nextFunnel.stage,
        recommendedAction: validated.output.recommendedAction,
        recommendedProductId: validated.output.recommendedProductId,
        approvedPriceCents:
          validated.output.approvedPrice != null
            ? Math.round(validated.output.approvedPrice * 100)
            : null,
        requiresHumanReview: true,
        riskFlags: validated.output.riskFlags,
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        estimatedCostUsd:
          ((result.promptTokens + result.completionTokens) / 1_000_000) * TOKEN_USD_PER_MILLION,
        requestId,
        validationErrors: validated.errors,
        inputMessageIds,
        operationalIntent: operational.intent,
        responseMode,
        diagnostics,
      },
    });

    const replyOptions =
      status === "STALE"
        ? []
        : await Promise.all(
            validated.output.replyOptions.map((opt) =>
              prisma.replyOption.create({
                data: {
                  organizationId: tenant.organizationId,
                  generationId: generation.id,
                  text: opt.text,
                  originalText: opt.text,
                  tone: opt.tone,
                  internalReason: opt.internalReason,
                },
              }),
            ),
          );

    if (threadLessons.bans.length) {
      const existing = await prisma.subscriberMemory.findFirst({
        where: {
          organizationId: tenant.organizationId,
          subscriberId: conversation.subscriberId,
          creatorId: conversation.creatorId,
          key: "thread_lessons",
          deletedAt: null,
        },
      });
      const value = threadLessons.bans.join("\n").slice(0, 4000);
      if (existing) {
        await prisma.subscriberMemory.update({
          where: { id: existing.id },
          data: { value, confidence: 1, verified: true, lastConfirmedAt: new Date() },
        });
      } else {
        await prisma.subscriberMemory.create({
          data: {
            organizationId: tenant.organizationId,
            subscriberId: conversation.subscriberId,
            creatorId: conversation.creatorId,
            category: "BOUNDARIES",
            key: "thread_lessons",
            value,
            confidence: 1,
            verified: true,
            sensitivity: "INTERNAL",
          },
        });
      }
    }

    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "SUGGESTIONS_PRODUCED",
      creatorId: conversation.creatorId,
      chatterId: input.userId,
      conversationId: conversation.id,
      model: result.model,
      playbook: funnel.playbook,
      numericValue: result.latencyMs,
      metadata: {
        tokens: result.promptTokens + result.completionTokens,
        repaired: result.repaired,
      },
    });

    return {
      blocked: false as const,
      escalated: validated.output.recommendedAction === "REQUEST_HUMAN_REVIEW",
      mockMode: mode === "mock",
      generationId: generation.id,
      status,
      confidence: classified.confidence,
      intent: validated.output.intent,
      funnelStage: nextFunnel.stage,
      recommendedAction: validated.output.recommendedAction,
      recommendedProductId: validated.output.recommendedProductId,
      approvedPrice: validated.output.approvedPrice,
      requiresHumanReview: true,
      riskFlags: validated.output.riskFlags,
      validationErrors: [...validated.errors, ...groundingCodes],
      latencyMs: result.latencyMs,
      tokenUsage: {
        prompt: result.promptTokens,
        completion: result.completionTokens,
      },
      replyOptions: replyOptions.map((o) => ({
        id: o.id,
        text: o.text,
        messages: splitReplyBubbles(o.text),
        tone: o.tone,
        internalReason: o.internalReason,
      })),
      chatterMessage:
        validated.output.recommendedAction === "REQUEST_HUMAN_REVIEW"
          ? plan.chatterMessage || "Human review required."
          : validated.ok
            ? ""
            : "Model suggested an invalid product or price. Offer removed. Human review required.",
      operationalIntent: operational.intent,
      responseMode,
      skippedGeneration: false,
    };
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "UNKNOWN";
    const generation = await prisma.generation.create({
      data: {
        organizationId: tenant.organizationId,
        conversationId: conversation.id,
        requestedById: input.userId,
        provider: mode,
        model: model || "unknown",
        status: "FAILED",
        requestId,
        validationErrors: [code],
        requiresHumanReview: true,
      },
    });
    return {
      blocked: false as const,
      failed: true as const,
      mockMode: mode === "mock",
      generationId: generation.id,
      chatterMessage: providerFailureMessage(code),
      flags: [code],
      replyOptions: [],
    };
  }
}
