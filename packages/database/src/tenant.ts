import { TenantIsolationError } from "@canopy/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./client.js";

export type TenantContext = {
  organizationId: string;
};

export function requireTenant(organizationId: string | null | undefined): TenantContext {
  if (!organizationId) {
    throw new TenantIsolationError("Every data operation requires an organizationId");
  }
  return { organizationId };
}

export function scopedWhere<T extends Record<string, unknown>>(
  ctx: TenantContext,
  where: T = {} as T,
): T & { organizationId: string } {
  return { ...where, organizationId: ctx.organizationId };
}

export function tenantDb(ctx: TenantContext, client: PrismaClient = prisma) {
  return {
    ctx,
    client,
    creators: {
      findMany: (args: Prisma.CreatorFindManyArgs = {}) =>
        client.creator.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
      findFirst: (args: Prisma.CreatorFindFirstArgs = {}) =>
        client.creator.findFirst({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
      findUniqueOrThrowScoped: async (id: string) => {
        const row = await client.creator.findFirst({
          where: scopedWhere(ctx, { id }),
        });
        if (!row) throw new TenantIsolationError("Creator not found in this organization");
        return row;
      },
    },
    subscribers: {
      findMany: (args: Prisma.SubscriberFindManyArgs = {}) =>
        client.subscriber.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
      findFirst: (args: Prisma.SubscriberFindFirstArgs = {}) =>
        client.subscriber.findFirst({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    conversations: {
      findMany: (args: Prisma.ConversationFindManyArgs = {}) =>
        client.conversation.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
      findFirst: (args: Prisma.ConversationFindFirstArgs = {}) =>
        client.conversation.findFirst({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    messages: {
      findMany: (args: Prisma.MessageFindManyArgs = {}) =>
        client.message.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    memories: {
      findMany: (args: Prisma.SubscriberMemoryFindManyArgs = {}) =>
        client.subscriberMemory.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    products: {
      findMany: (args: Prisma.ProductFindManyArgs = {}) =>
        client.product.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
      findFirst: (args: Prisma.ProductFindFirstArgs = {}) =>
        client.product.findFirst({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    promptTemplates: {
      findMany: (args: Prisma.PromptTemplateFindManyArgs = {}) =>
        client.promptTemplate.findMany({
          ...args,
          where: {
            OR: [
              scopedWhere(ctx, args.where ?? {}),
              { ...(args.where ?? {}), organizationId: null, isSystem: true },
            ],
          },
        }),
    },
    analytics: {
      findMany: (args: Prisma.AnalyticsEventFindManyArgs = {}) =>
        client.analyticsEvent.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
      count: (args: Prisma.AnalyticsEventCountArgs = {}) =>
        client.analyticsEvent.count({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    trainingDocuments: {
      findMany: (args: Prisma.TrainingDocumentFindManyArgs = {}) =>
        client.trainingDocument.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    platformAccounts: {
      findMany: (args: Prisma.PlatformAccountFindManyArgs = {}) =>
        client.platformAccount.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
      findFirst: (args: Prisma.PlatformAccountFindFirstArgs = {}) =>
        client.platformAccount.findFirst({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    platformConversations: {
      findMany: (args: Prisma.PlatformConversationFindManyArgs = {}) =>
        client.platformConversation.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
    automationActions: {
      findMany: (args: Prisma.AutomationActionFindManyArgs = {}) =>
        client.automationAction.findMany({
          ...args,
          where: scopedWhere(ctx, args.where ?? {}),
        }),
    },
  };
}

export async function assertSameOrganization(
  ctx: TenantContext,
  recordOrgId: string | null | undefined,
): Promise<void> {
  if (!recordOrgId || recordOrgId !== ctx.organizationId) {
    throw new TenantIsolationError("Cross-organization access is denied");
  }
}
