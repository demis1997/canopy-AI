import { randomUUID } from "node:crypto";
import {
  prisma,
  requireTenant,
  tenantDb,
  decryptSecret,
  type AdultStatus,
  type Prisma,
} from "@canopy/database";
import {
  createLLMProvider,
  evaluateSafety,
  containsPromptInjection,
  validateProductsAndPrices,
  resolveFunnel,
  PROMPT_VERSION,
  ProviderError,
  personaLooksTrans,
  retrieveTraining,
  pricingContextFrom,
  type LLMProvider,
  type GenerationInput,
} from "@canopy/ai";
import {
  eligibleProducts,
  collectOperatorRejections,
  followUpPhase,
  playbookFor,
  readFeatureFlags,
  splitReplyBubbles,
  type CatalogProduct,
} from "@canopy/shared";
import { enqueueJob } from "./queue";

const TOKEN_USD_PER_MILLION = 0.5;

function looksLikeRefusal(text: string): boolean {
  return /\b(no thanks|nah|too expensive|too much|cheaper|discount|maybe later|not buying|pass)\b/i.test(
    text,
  );
}

async function generateRepliesWithRetry(provider: LLMProvider, input: GenerationInput) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await provider.generateReplies(input);
    } catch (error) {
      lastError = error;
      const code = error instanceof ProviderError ? error.code : "UNKNOWN";
      if (code === "INVALID_KEY" || code === "UNAUTHORIZED") throw error;
    }
  }
  throw lastError;
}

function providerFailureMessage(code: string): string {
  switch (code) {
    case "TIMEOUT":
      return "The model took too long. Hit generate again — a page reload is not required.";
    case "RATE_LIMIT":
      return "Venice is rate-limiting. Wait a few seconds, then generate again.";
    case "INVALID_JSON":
      return "The model returned a messy reply. Hit generate again.";
    case "UNAVAILABLE":
      return "Venice was briefly down. Hit generate again.";
    case "INVALID_KEY":
      return "The Venice API key was rejected. Check AI provider settings.";
    case "CIRCUIT_OPEN":
      return "The provider is cooling down. Generate again in a few seconds.";
    default:
      return "The model missed that send. Hit generate again — a reload is not required.";
  }
}

export async function recordAnalytics(input: {
  organizationId: string;
  type:
    | "MESSAGE_RECEIVED"
    | "GENERATION_REQUESTED"
    | "SUGGESTIONS_PRODUCED"
    | "SUGGESTION_ACCEPTED"
    | "SUGGESTION_EDITED"
    | "FUNNEL_TRANSITION"
    | "OFFER_PRESENTED"
    | "PURCHASE"
    | "REFUND"
    | "COMPLAINT"
    | "ESCALATION"
    | "SAFETY_BLOCK"
    | "HUMAN_QUALITY_RATING"
    | "OVERRIDE"
    | "AUTOMATION_DECISION"
    | "AUTOMATION_SENT"
    | "AUTOMATION_ESCALATED";
  creatorId?: string;
  chatterId?: string;
  conversationId?: string;
  model?: string;
  playbook?: string;
  numericValue?: number;
  metadata?: Record<string, unknown>;
}) {
  await prisma.analyticsEvent.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      creatorId: input.creatorId,
      chatterId: input.chatterId,
      conversationId: input.conversationId,
      model: input.model,
      playbook: input.playbook,
      numericValue: input.numericValue,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });
}

export async function addSubscriberMessage(input: {
  organizationId: string;
  conversationId: string;
  text: string;
  chatterId?: string;
}) {
  const tenant = requireTenant(input.organizationId);
  const db = tenantDb(tenant);
  const conversation = await db.conversations.findFirst({
    where: { id: input.conversationId },
  });
  if (!conversation) throw new Error("Conversation not found");

  const message = await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      authorType: "SUBSCRIBER",
      body: input.text,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });
  await recordAnalytics({
    organizationId: input.organizationId,
    type: "MESSAGE_RECEIVED",
    creatorId: conversation.creatorId,
    chatterId: input.chatterId,
    conversationId: conversation.id,
    numericValue: 1,
  });
  return { conversation, message };
}

export async function generateForConversation(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
  toneOverride?: "PLAYFUL" | "ROMANTIC" | "TEASING" | "DOMINANT" | "SUBMISSIVE" | "DIRECT";
  rewriteStyle?: "SHORTER" | "WARMER" | "PLAYFUL" | "SALES";
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

  const latest = await prisma.message.findFirst({
    where: { conversationId: conversation.id, organizationId: tenant.organizationId },
    orderBy: { createdAt: "desc" },
  });
  const subscriberText = latest?.authorType === "SUBSCRIBER" ? latest.body : "";

  await recordAnalytics({
    organizationId: tenant.organizationId,
    type: "GENERATION_REQUESTED",
    creatorId: conversation.creatorId,
    chatterId: input.userId,
    conversationId: conversation.id,
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

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id, organizationId: tenant.organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const recent = messages.reverse();

  const memories = await prisma.subscriberMemory.findMany({
    where: {
      organizationId: tenant.organizationId,
      subscriberId: conversation.subscriberId,
      creatorId: conversation.creatorId,
      deletedAt: null,
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
    select: { productId: true },
  });
  const purchasedProductIds = purchases.map((p) => p.productId);
  const purchasedPpvCount = purchases.length;
  const catalog: CatalogProduct[] = productRows.map((p) => ({
    id: p.id,
    creatorId: p.creatorId,
    organizationId: p.organizationId,
    name: p.name,
    description: p.description,
    mediaType: p.mediaType,
    standardPrice: p.standardPriceCents / 100,
    minimumPrice: p.minimumPriceCents / 100,
    secondPrice:
      p.secondPriceCents != null ? p.secondPriceCents / 100 : null,
    discountLimitPercent: p.discountLimitPercent,
    bundlePrice: p.bundlePriceCents != null ? p.bundlePriceCents / 100 : null,
    tags: p.tags,
    available: p.available,
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

  const config = await prisma.lLMProviderConfiguration.findFirst({
    where: { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }] },
    orderBy: { organizationId: "desc" },
  });

  const providerName = config?.provider || process.env.AI_PROVIDER || process.env.LLM_PROVIDER || "venice";
  let apiKey = process.env.AI_API_KEY || process.env.LLM_API_KEY || "";
  if (!apiKey) {
    const cred = await prisma.apiCredential.findFirst({
      where: {
        provider: { in: [providerName, "venice", "openrouter", "openai"] },
        OR: [{ organizationId: tenant.organizationId }, { organizationId: null }],
      },
      orderBy: { createdAt: "desc" },
    });
    if (cred) apiKey = decryptSecret(cred.encryptedKey);
  }

  const { provider, mode } = createLLMProvider({
    apiKey,
    baseURL: config?.baseUrl || process.env.AI_BASE_URL || process.env.LLM_BASE_URL,
    provider: providerName,
    defaultModel: config?.generationModel || process.env.AI_MODEL || process.env.LLM_MODEL,
  });

  const model = config?.generationModel || process.env.AI_MODEL || process.env.LLM_MODEL || "";
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

    const examples = retrieveTraining({
      message: subscriberText,
      intent: classified.intent,
      funnelStage: conversation.funnelStage,
      transPersona,
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
    });

    const discardedRows = await prisma.replyOption.findMany({
      where: { organizationId: tenant.organizationId, outcome: "DISCARDED" },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { text: true, internalReason: true },
    });
    const operatorRejections = collectOperatorRejections(discardedRows);

    const result = await generateRepliesWithRetry(provider, {
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
        available: p.available,
        explicitnessCategory:
          productRows.find((row) => row.id === p.id)?.explicitnessCategory ?? "SUGGESTIVE",
      })),
      funnelStage: conversation.funnelStage,
      playbook: playbookFor(
        conversation.funnelStage,
        classified.intent,
        conversation.unansweredFollowUps,
        purchasedPpvCount,
      ),
      retrievedExamples: examples,
      operatorRejections,
      toneOverride: input.toneOverride,
      rewriteStyle: input.rewriteStyle,
      pricing,
      followUpPhase: followUpPhase(conversation.unansweredFollowUps, purchasedPpvCount),
      fanNotes: fanNote
        ? {
            realName: fanNote.realName,
            location: fanNote.location,
            dominance: fanNote.dominance,
            preferredTone: fanNote.preferredTone,
            notes: fanNote.notes,
            extra: (fanNote.extra as Record<string, string>) ?? {},
            spend: (creatorSpend._sum.amountCents ?? conversation.subscriber.spendCents) / 100,
          }
        : conversation.subscriber.notes
          ? {
              realName: "",
              location: "",
              dominance: "UNKNOWN",
              preferredTone: "",
              notes: conversation.subscriber.notes,
              extra: {},
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
                ? { body: step.body, mediaHint: step.mediaHint, priceTier: step.priceTier }
                : { body: "", mediaHint: "TEXT", priceTier: 1 };
            })(),
            remaining: conversation.activeSequence.steps
              .slice(conversation.activeSequenceStep + 1)
              .map((s) => s.body),
          }
        : null,
    });

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

    const validated = validateProductsAndPrices(
      result.output,
      products.map((p) => ({
        id: p.id,
        standardPrice: p.standardPrice,
        minimumPrice: p.minimumPrice,
        secondPrice: p.secondPrice,
        discountLimitPercent: p.discountLimitPercent,
        sendAttempt: pricing.ladder.find((row) => row.productId === p.id)?.sendAttempt,
        available: p.available,
        creatorId: p.creatorId,
        resaleAllowed: p.resaleAllowed,
      })),
      10,
      pricing.concessionAllowed,
      { creatorId: conversation.creatorId, purchasedProductIds, subscriberText },
    );

    const nextFunnel = resolveFunnel({
      state: funnelState,
      intent: validated.output.intent,
      suggested: validated.output.suggestedFunnelTransition,
    });

    const status = validated.ok ? "COMPLETED" : "INVALID";
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
      },
    });

    const replyOptions = await Promise.all(
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
      validationErrors: validated.errors,
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
      chatterMessage: validated.ok
        ? ""
        : "Model suggested an invalid product or price. Offer removed. Human review required.",
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

function levenshtein(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i]![j] =
        a[i - 1] === b[j - 1]
          ? m[i - 1]![j - 1]!
          : 1 + Math.min(m[i - 1]![j]!, m[i]![j - 1]!, m[i - 1]![j - 1]!);
    }
  }
  return m[a.length]![b.length]!;
}

export async function selectReply(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
  generationId: string;
  replyOptionId: string;
  editedText?: string;
  inserted: boolean;
  discard?: boolean;
  rejectReason?: string;
}) {
  const tenant = requireTenant(input.organizationId);
  const option = await prisma.replyOption.findFirst({
    where: {
      id: input.replyOptionId,
      organizationId: tenant.organizationId,
      generationId: input.generationId,
    },
    include: { generation: true },
  });
  if (!option || option.generation.conversationId !== input.conversationId) {
    throw new Error("Reply option not found");
  }

  if (input.discard) {
    await prisma.replyOption.update({
      where: { id: option.id },
      data: {
        outcome: "DISCARDED",
        selectedById: input.userId,
        internalReason: input.rejectReason
          ? `${option.internalReason} · rejected: ${input.rejectReason}`
          : option.internalReason,
      },
    });
    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "OVERRIDE",
      conversationId: input.conversationId,
      chatterId: input.userId,
      metadata: { reason: input.rejectReason ?? "discarded" },
    });
    return { discarded: true as const };
  }

  const nextText = input.editedText ?? option.text;
  const edited = option.originalText.trim() !== nextText.trim();
  const distance = levenshtein(option.originalText, nextText);
  const bubbles = splitReplyBubbles(nextText, { splitSentences: true });
  const bodies = bubbles.length ? bubbles : [nextText.trim()].filter(Boolean);

  const now = Date.now();
  const created = [];
  for (let i = 0; i < bodies.length; i += 1) {
    created.push(
      await prisma.message.create({
        data: {
          organizationId: tenant.organizationId,
          conversationId: input.conversationId,
          authorType: "CHATTER",
          authorUserId: input.userId,
          body: bodies[i]!,
          aiAssisted: true,
          createdAt: new Date(now + i),
        },
      }),
    );
  }
  const message = created[created.length - 1];
  if (!message) throw new Error("Reply text was empty");

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: new Date() },
  });

  await prisma.replyOption.update({
    where: { id: option.id },
    data: {
      text: nextText,
      outcome: input.inserted ? "INSERTED" : edited ? "EDITED" : "SELECTED",
      editDistance: distance,
      selectedById: input.userId,
      messageId: message.id,
    },
  });

  const conversation = await prisma.conversation.findFirstOrThrow({
    where: { id: input.conversationId, organizationId: tenant.organizationId },
  });

  if (option.generation.funnelStage && option.generation.funnelStage !== conversation.funnelStage) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { funnelStage: option.generation.funnelStage },
    });
    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "FUNNEL_TRANSITION",
      creatorId: conversation.creatorId,
      chatterId: input.userId,
      conversationId: conversation.id,
      metadata: { from: conversation.funnelStage, to: option.generation.funnelStage },
    });
  }

  if (option.generation.recommendedProductId && option.generation.approvedPriceCents) {
    await prisma.offer.create({
      data: {
        organizationId: tenant.organizationId,
        conversationId: conversation.id,
        productId: option.generation.recommendedProductId,
        priceCents: option.generation.approvedPriceCents,
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastOfferAt: new Date(),
        offerCountToday: { increment: 1 },
        rapportPriority: false,
      },
    });
    await recordAnalytics({
      organizationId: tenant.organizationId,
      type: "OFFER_PRESENTED",
      creatorId: conversation.creatorId,
      conversationId: conversation.id,
      numericValue: option.generation.approvedPriceCents / 100,
    });
  }

  await recordAnalytics({
    organizationId: tenant.organizationId,
    type: edited ? "SUGGESTION_EDITED" : "SUGGESTION_ACCEPTED",
    creatorId: conversation.creatorId,
    chatterId: input.userId,
    conversationId: conversation.id,
    numericValue: distance,
  });

  try {
    await enqueueJob("summarize-conversation", {
      organizationId: tenant.organizationId,
      conversationId: conversation.id,
    });
    await enqueueJob("extract-memories", {
      organizationId: tenant.organizationId,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("background jobs failed after auto-send", error);
  }

  return {
    messageId: message.id,
    messageIds: created.map((m) => m.id),
    editDistance: distance,
    edited,
  };
}

export async function handleFanTurn(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
  text: string;
  autoReply?: boolean;
  toneOverride?: "PLAYFUL" | "ROMANTIC" | "TEASING" | "DOMINANT" | "SUBMISSIVE" | "DIRECT";
}) {
  const { message } = await addSubscriberMessage({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    text: input.text,
    chatterId: input.userId,
  });
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    select: { mutedAi: true },
  });
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { unansweredFollowUps: 0 },
  });
  const flags = readFeatureFlags();
  const autoReply = input.autoReply !== false && !conversation?.mutedAi && flags.autonomousText;
  if (!autoReply) {
    return { subscriberMessageId: message.id, autoSent: false as const, muted: Boolean(conversation?.mutedAi) };
  }

  const generation = await generateForConversation({
    organizationId: input.organizationId,
    userId: input.userId,
    conversationId: input.conversationId,
    toneOverride: input.toneOverride,
  });

  const option = generation.replyOptions[0];
  const failed = "failed" in generation && generation.failed === true;
  const action = "recommendedAction" in generation ? generation.recommendedAction : undefined;
  const canSend =
    !generation.blocked &&
    !failed &&
    action !== "BLOCK" &&
    Boolean(option);

  if (!canSend || !option || !generation.generationId) {
    return {
      subscriberMessageId: message.id,
      autoSent: false as const,
      generation,
    };
  }

  const selected = await selectReply({
    organizationId: input.organizationId,
    userId: input.userId,
    conversationId: input.conversationId,
    generationId: generation.generationId,
    replyOptionId: option.id,
    editedText: option.text,
    inserted: true,
  });

  return {
    subscriberMessageId: message.id,
    autoSent: true as const,
    sentText: option.text,
    messageId: selected.messageId,
    generation,
  };
}
