import { prisma, requireTenant, tenantDb } from "@canopy/database";
import { recordAnalytics } from "../analytics";

export async function addSubscriberMessage(input: {
  organizationId: string;
  conversationId: string;
  text: string;
  chatterId?: string;
  sentAt?: Date;
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
      createdAt: input.sentAt,
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
