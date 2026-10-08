import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, encryptSecret, lastFour } from "@canopy/database";
import { createLLMProvider, readProviderEnv, ProviderError } from "@canopy/ai";
import { requireUser, jsonError, requirePerm } from "@/lib/session";
import { getProviderConfiguration, resolveProviderCredential } from "@/server/ai-provider";

async function requireAdmin() {
  const ctx = await requireUser();
  requirePerm(ctx, "settings.ai_provider");
  return ctx;
}

function inferProvider(baseUrl: string, explicit?: string) {
  if (explicit && ["venice", "openrouter", "openai"].includes(explicit)) return explicit;
  if (/openrouter\.ai/i.test(baseUrl)) return "openrouter";
  if (/api\.openai\.com/i.test(baseUrl)) return "openai";
  return "venice";
}

export async function GET() {
  try {
    const ctx = await requireAdmin();
    const env = readProviderEnv();
    const config = await getProviderConfiguration(ctx.organizationId);
    const providerName = config?.provider || env.name;
    const credential = await resolveProviderCredential(ctx.organizationId, providerName);
    return NextResponse.json({
      config,
      provider: providerName,
      generationModel: config?.generationModel || env.model || "",
      classificationModel: config?.classificationModel || "",
      baseUrl: config?.baseUrl || env.baseURL,
      keyLastFour: credential.keyLastFour,
      maskedKey: credential.keyLastFour ? `••••${credential.keyLastFour}` : null,
      mockMode: !credential.apiKey,
      lastHealthOk: config?.lastHealthOk ?? null,
      lastLatencyMs: config?.lastLatencyMs ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin();
    const env = readProviderEnv();
    const body = z
      .object({
        apiKey: z.string().optional(),
        baseUrl: z.string().url().optional(),
        generationModel: z.string().optional(),
        classificationModel: z.string().optional(),
        provider: z.enum(["venice", "openrouter", "openai"]).optional(),
        action: z.enum(["save", "test-key", "list-models", "health", "test-generation"]),
      })
      .parse(await request.json());

    const baseURL = body.baseUrl || env.baseURL || "https://api.venice.ai/api/v1";
    const providerName = inferProvider(baseURL, body.provider ?? env.name);
    const { apiKey } = await resolveProviderCredential(
      ctx.organizationId,
      providerName,
      body.apiKey,
    );

    if (body.action === "save") {
      if (body.apiKey) {
        await prisma.apiCredential.create({
          data: {
            organizationId: ctx.organizationId,
            provider: providerName,
            encryptedKey: encryptSecret(body.apiKey),
            keyLastFour: lastFour(body.apiKey),
          },
        });
      }
      const existing = await prisma.lLMProviderConfiguration.findFirst({
        where: { organizationId: ctx.organizationId ?? null },
      });
      const data = {
        provider: providerName,
        baseUrl: baseURL,
        generationModel: body.generationModel ?? existing?.generationModel ?? "",
        classificationModel: body.classificationModel ?? existing?.classificationModel ?? "",
        isActive: true,
      };
      const saved = existing
        ? await prisma.lLMProviderConfiguration.update({ where: { id: existing.id }, data })
        : await prisma.lLMProviderConfiguration.create({
            data: { ...data, organizationId: ctx.organizationId },
          });
      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "CONFIGURE_PROVIDER",
          entityType: "LLMProviderConfiguration",
          entityId: saved.id,
          metadata: { provider: providerName, generationModel: saved.generationModel },
        },
      });
      return NextResponse.json({
        saved: true,
        provider: providerName,
        generationModel: saved.generationModel,
        classificationModel: saved.classificationModel,
        keyLastFour: body.apiKey ? lastFour(body.apiKey) : undefined,
      });
    }

    const { provider, mode } = createLLMProvider({
      apiKey,
      baseURL,
      provider: providerName,
      defaultModel: body.generationModel || env.model,
      forceMock: !apiKey,
    });

    if (body.action === "list-models" || body.action === "test-key") {
      const models = await provider.listModels();
      return NextResponse.json({ models, mockMode: mode === "mock", provider: mode });
    }
    if (body.action === "health") {
      const health = await provider.healthCheck();
      const existing = await prisma.lLMProviderConfiguration.findFirst({
        where: { organizationId: ctx.organizationId ?? null },
      });
      if (existing) {
        await prisma.lLMProviderConfiguration.update({
          where: { id: existing.id },
          data: {
            lastHealthCheckAt: new Date(),
            lastHealthOk: health.ok,
            lastLatencyMs: health.latencyMs,
            lastError: health.error ?? null,
          },
        });
      }
      return NextResponse.json({ ...health, mockMode: mode === "mock", provider: mode });
    }

    const models = await provider.listModels().catch(() => []);
    const gen = await provider.generateReplies({
      requestId: "admin-test",
      model:
        body.generationModel ||
        env.model ||
        models.find((m) => m.recommended)?.id ||
        models[0]?.id ||
        "mock",
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
      recentMessages: [
        { authorType: "SUBSCRIBER", body: "Reply with a one-sentence hello for a health check." },
      ],
      memories: [],
      products: [],
      funnelStage: "RAPPORT",
      playbook: "BUILDING_RAPPORT",
      retrievedExamples: [],
    });
    return NextResponse.json({
      mockMode: mode === "mock",
      provider: mode,
      model: gen.model,
      latencyMs: gen.latencyMs,
      promptTokens: gen.promptTokens,
      completionTokens: gen.completionTokens,
      sample: gen.output.replyOptions[0]?.text,
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json(
        { error: error.message, code: error.code, requestId: error.requestId },
        { status: error.status && error.status >= 400 ? error.status : 502 },
      );
    }
    return jsonError(error);
  }
}
