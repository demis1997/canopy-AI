import { prisma, type Prisma } from "@canopy/database";

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
