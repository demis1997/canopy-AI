import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, encryptSecret, lastFour, decryptSecret } from "@canopy/database";
import { createLLMProvider, VeniceLLMProvider } from "@canopy/ai";
import { requireUser, jsonError, requirePerm } from "@/lib/session";
import { maskSecret } from "@canopy/shared";

async function requireAdmin() {
  const ctx = await requireUser();
  requirePerm(ctx, "settings.ai_provider");
  return ctx;
}

export async function GET() {
  try {
    const ctx = await requireAdmin();
    const config = await prisma.lLMProviderConfiguration.findFirst({
      where: ctx.organizationId
        ? { OR: [{ organizationId: ctx.organizationId }, { organizationId: null }] }
        : { organizationId: null },
      orderBy: { organizationId: "desc" },
    });
    const cred = await prisma.apiCredential.findFirst({
      where: { provider: "venice", organizationId: ctx.organizationId ?? null },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      config,
      keyLastFour: cred?.keyLastFour ?? (process.env.LLM_API_KEY ? lastFour(process.env.LLM_API_KEY) : null),
      maskedKey: cred ? `••••${cred.keyLastFour}` : process.env.LLM_API_KEY ? maskSecret(process.env.LLM_API_KEY) : null,
      mockMode: !process.env.LLM_API_KEY && !cred,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin();
    const body = z
      .object({
        apiKey: z.string().optional(),
        baseUrl: z.string().url().optional(),
        generationModel: z.string().optional(),
        classificationModel: z.string().optional(),
        action: z.enum(["save", "test-key", "list-models", "health", "test-generation"]),
      })
      .parse(await request.json());

    let apiKey = process.env.LLM_API_KEY ?? "";
    const stored = await prisma.apiCredential.findFirst({
      where: { provider: "venice", organizationId: ctx.organizationId ?? null },
    });
    if (stored) apiKey = decryptSecret(stored.encryptedKey);
    if (body.apiKey) apiKey = body.apiKey;

    const baseURL = body.baseUrl ?? process.env.LLM_BASE_URL ?? "https://api.venice.ai/api/v1";

    if (body.action === "save") {
      if (body.apiKey) {
        await prisma.apiCredential.create({
          data: {
            organizationId: ctx.organizationId,
            provider: "venice",
            encryptedKey: encryptSecret(body.apiKey),
            keyLastFour: lastFour(body.apiKey),
          },
        });
      }
      const existing = await prisma.lLMProviderConfiguration.findFirst({
        where: { organizationId: ctx.organizationId ?? null },
      });
      const data = {
        provider: "venice",
        baseUrl: baseURL,
        generationModel: body.generationModel ?? existing?.generationModel ?? "",
        classificationModel: body.classificationModel ?? existing?.classificationModel ?? "",
        isActive: true,
      };
      if (existing) {
        await prisma.lLMProviderConfiguration.update({ where: { id: existing.id }, data });
      } else {
        await prisma.lLMProviderConfiguration.create({
          data: { ...data, organizationId: ctx.organizationId },
        });
      }
      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "CONFIGURE_PROVIDER",
          entityType: "LLMProviderConfiguration",
        },
      });
      return NextResponse.json({ saved: true, keyLastFour: body.apiKey ? lastFour(body.apiKey) : stored?.keyLastFour });
    }

    if (!apiKey) {
      const { provider } = createLLMProvider({ forceMock: true });
      if (body.action === "list-models") return NextResponse.json({ models: await provider.listModels(), mockMode: true });
      if (body.action === "health") return NextResponse.json({ ...(await provider.healthCheck()), mockMode: true });
      if (body.action === "test-key" || body.action === "test-generation") {
        const gen = await provider.generateReplies({
          requestId: "admin-test",
          model: "mock",
          promptVersionId: "admin",
          persona: {
            displayName: "Test",
            biography: "",
            authorisedBackstory: "",
            personality: "direct",
            tone: "short",
            typicalMessageLength: "SHORT",
            preferredEmojis: [],
            frequentlyUsedPhrases: ["hey"],
            preferredExplicitVocabulary: [],
            prohibitedWords: [],
            preferredCompliments: [],
            allowedExplicitness: "FLIRTY",
            style: "DIRECT",
            interests: [],
            contentBoundaries: [],
            claimsNeverToMake: [],
            customContentRules: "",
            offlineMeetingPolicy: "",
            discountLimitPercent: 0,
            approvedExampleMessages: [],
          },
          recentMessages: [{ authorType: "SUBSCRIBER", body: "hey, how are you" }],
          memories: [],
          products: [],
          funnelStage: "RAPPORT",
          playbook: "BUILDING_RAPPORT",
          retrievedExamples: [],
        });
        return NextResponse.json({
          mockMode: true,
          latencyMs: gen.latencyMs,
          promptTokens: gen.promptTokens,
          completionTokens: gen.completionTokens,
          sample: gen.output.replyOptions[0]?.text,
        });
      }
    }

    const venice = new VeniceLLMProvider({ apiKey, baseURL, defaultModel: body.generationModel });
    if (body.action === "test-key" || body.action === "list-models") {
      const models = await venice.listModels();
      return NextResponse.json({ models, mockMode: false });
    }
    if (body.action === "health") {
      return NextResponse.json({ ...(await venice.healthCheck()), mockMode: false });
    }
    const gen = await venice.generateReplies({
      requestId: "admin-test",
      model: body.generationModel || process.env.LLM_MODEL || modelsFallback(await venice.listModels()),
      promptVersionId: "admin",
      persona: {
        displayName: "Test",
        biography: "Private health check. Do not be explicit.",
        authorisedBackstory: "",
        personality: "brief",
        tone: "neutral",
        typicalMessageLength: "SHORT",
        preferredEmojis: [],
        frequentlyUsedPhrases: [],
        preferredExplicitVocabulary: [],
        prohibitedWords: [],
        preferredCompliments: [],
        allowedExplicitness: "FLIRTY",
        style: "DIRECT",
        interests: [],
        contentBoundaries: [],
        claimsNeverToMake: [],
        customContentRules: "",
        offlineMeetingPolicy: "",
        discountLimitPercent: 0,
        approvedExampleMessages: [],
      },
      recentMessages: [{ authorType: "SUBSCRIBER", body: "Reply with a one-sentence hello for a health check." }],
      memories: [],
      products: [],
      funnelStage: "RAPPORT",
      playbook: "BUILDING_RAPPORT",
      retrievedExamples: [],
    });
    return NextResponse.json({
      mockMode: false,
      latencyMs: gen.latencyMs,
      promptTokens: gen.promptTokens,
      completionTokens: gen.completionTokens,
      sample: gen.output.replyOptions[0]?.text,
    });
  } catch (error) {
    return jsonError(error);
  }
}

function modelsFallback(models: { id: string; recommended?: boolean }[]) {
  return models.find((m) => m.recommended)?.id ?? models[0]?.id ?? "";
}
