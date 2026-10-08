import { prisma, MemoryCategory } from "@canopy/database";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { resolveOrganizationProvider } from "../../ai-provider";
import type { BackgroundJob } from "../contracts";

const memoryCategory = z.nativeEnum(MemoryCategory);

export async function processConversationJob(
  job: Extract<BackgroundJob, { name: "summarize-conversation" | "extract-memories" }>,
) {
  const { name, payload } = job;
  if (name === "summarize-conversation" && payload.conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: payload.conversationId, organizationId: payload.organizationId },
      select: { id: true },
    });
    if (!conversation) throw new Error("Conversation not found in organization");
    const messages = await prisma.message.findMany({
      where: {
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    });
    const existing = await prisma.conversationSummary.findFirst({
      where: { organizationId: payload.organizationId, conversationId: payload.conversationId },
    });
    const { provider } = await resolveOrganizationProvider(payload.organizationId);
    const result = await provider.summarizeConversation({
      requestId: randomUUID(),
      messages: messages.reverse().map((m) => ({ authorType: m.authorType, body: m.body })),
      previousSummary: existing?.summary,
    });
    await prisma.conversationSummary.upsert({
      where: { conversationId: payload.conversationId },
      update: { summary: result.summary, messageCount: messages.length },
      create: {
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
        summary: result.summary,
        messageCount: messages.length,
      },
    });
  }

  if (name === "extract-memories" && payload.conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: payload.conversationId, organizationId: payload.organizationId },
    });
    if (!conversation) throw new Error("Conversation not found in organization");
    const messages = await prisma.message.findMany({
      where: {
        organizationId: payload.organizationId,
        conversationId: payload.conversationId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
    });
    const { provider } = await resolveOrganizationProvider(payload.organizationId);
    const extracted = await provider.extractMemories({
      requestId: randomUUID(),
      messages: messages.reverse().map((m) => ({
        id: m.id,
        authorType: m.authorType,
        body: m.body,
      })),
    });
    const fanMessageIds = new Set(
      messages.filter((m) => m.authorType === "SUBSCRIBER").map((m) => m.id),
    );
    for (const update of extracted.updates) {
      if (update.confidence < 0.5 || !fanMessageIds.has(update.sourceMessageId)) continue;
      const category = memoryCategory.safeParse(update.category);
      if (!category.success) continue;
      await prisma.subscriberMemory.create({
        data: {
          organizationId: payload.organizationId,
          subscriberId: conversation.subscriberId,
          creatorId: conversation.creatorId,
          category: category.data,
          key: update.key.slice(0, 80),
          value: update.value.slice(0, 500),
          sourceMessageId: update.sourceMessageId,
          confidence: update.confidence,
          verified: false,
          sensitivity: "INTERNAL",
        },
      });
    }
  }
}
