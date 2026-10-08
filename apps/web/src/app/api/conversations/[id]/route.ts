import { NextResponse } from "next/server";
import { prisma } from "@canopy/database";
import {
  AFTERCARE_AFTER_PURCHASES,
  conversationPatchSchema,
  followUpPhase,
  splitReplyBubbles,
} from "@canopy/shared";
import { jsonError, requireOrgUser, requirePerm } from "@/lib/session";
import { assignedCreatorIds } from "@/lib/access";
import { clearConversationThread } from "@/server/conversations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.generate");
    const { id } = await params;
    const body = conversationPatchSchema.parse(await request.json());
    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
      include: {
        subscriber: true,
        activeSequence: { include: { steps: { orderBy: { position: "asc" } } } },
      },
    });
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const allowed = await assignedCreatorIds(ctx);
    if (allowed && !allowed.includes(conversation.creatorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (body.clearChat) {
      const result = await clearConversationThread({
        organizationId: ctx.tenant.organizationId,
        conversationId: conversation.id,
      });
      if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(result);
    }

    const data: {
      mutedAi?: boolean;
      activeSequenceId?: string | null;
      activeSequenceStep?: number;
      unansweredFollowUps?: number;
      funnelStage?: "PURCHASE";
    } = {};
    if (body.mutedAi != null) data.mutedAi = body.mutedAi;

    if (body.activeSequenceId !== undefined) {
      if (body.activeSequenceId) {
        const sequence = await prisma.sequence.findFirst({
          where: {
            id: body.activeSequenceId,
            organizationId: ctx.tenant.organizationId,
            creatorId: conversation.creatorId,
          },
        });
        if (!sequence) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
      }
      data.activeSequenceId = body.activeSequenceId;
      data.activeSequenceStep = 0;
    }

    if (body.noReplyFollowUp) {
      const nextCount = conversation.unansweredFollowUps + 1;
      data.unansweredFollowUps = nextCount;
      const purchaseCount = await prisma.purchase.count({
        where: {
          organizationId: ctx.tenant.organizationId,
          subscriberId: conversation.subscriberId,
          refunded: false,
          conversation: { creatorId: conversation.creatorId },
        },
      });
      const kind =
        followUpPhase(nextCount, purchaseCount) === "AFTERCARE" ? "AFTERCARE" : "FOLLOW_UP";
      const sequence = await prisma.sequence.findFirst({
        where: {
          organizationId: ctx.tenant.organizationId,
          creatorId: conversation.creatorId,
          kind,
          active: true,
        },
        include: { steps: { orderBy: { position: "asc" } } },
      });
      if (sequence) {
        data.activeSequenceId = sequence.id;
        data.activeSequenceStep =
          kind === "FOLLOW_UP"
            ? Math.min(Math.max(nextCount - 1, 0), Math.max(sequence.steps.length - 1, 0))
            : 0;
      }
    }

    if (body.markPurchased) {
      const offer = await prisma.offer.findFirst({
        where: { conversationId: conversation.id, organizationId: ctx.tenant.organizationId },
        orderBy: { createdAt: "desc" },
        include: { product: true },
      });
      if (!offer) {
        return NextResponse.json({ error: "No PPV offer to unlock" }, { status: 400 });
      }
      const already = await prisma.purchase.findFirst({
        where: {
          organizationId: ctx.tenant.organizationId,
          conversationId: conversation.id,
          productId: offer.productId,
          refunded: false,
        },
      });
      if (!already) {
        await prisma.purchase.create({
          data: {
            organizationId: ctx.tenant.organizationId,
            conversationId: conversation.id,
            subscriberId: conversation.subscriberId,
            productId: offer.productId,
            amountCents: offer.priceCents,
          },
        });
        await prisma.offer.update({ where: { id: offer.id }, data: { accepted: true } });
        await prisma.message.create({
          data: {
            organizationId: ctx.tenant.organizationId,
            conversationId: conversation.id,
            authorType: "SYSTEM",
            body: `${conversation.subscriber.displayName} unlocked ${offer.product.name} · $${(offer.priceCents / 100).toFixed(0)}`,
          },
        });
      }
      const purchaseCount = await prisma.purchase.count({
        where: {
          organizationId: ctx.tenant.organizationId,
          subscriberId: conversation.subscriberId,
          refunded: false,
          conversation: { creatorId: conversation.creatorId },
        },
      });
      data.funnelStage = "PURCHASE";
      data.unansweredFollowUps = 0;
      const kind = purchaseCount >= AFTERCARE_AFTER_PURCHASES ? "AFTERCARE" : null;
      if (kind) {
        const sequence = await prisma.sequence.findFirst({
          where: {
            organizationId: ctx.tenant.organizationId,
            creatorId: conversation.creatorId,
            kind,
            active: true,
          },
        });
        if (sequence) {
          data.activeSequenceId = sequence.id;
          data.activeSequenceStep = 0;
        }
      }
    }

    if (body.advanceSequence && conversation.activeSequence) {
      const last = conversation.activeSequence.steps.length - 1;
      data.activeSequenceStep = Math.min(conversation.activeSequenceStep + 1, Math.max(last, 0));
    }

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data,
      include: { activeSequence: { include: { steps: { orderBy: { position: "asc" } } } } },
    });

    if (body.mutedAi != null) {
      await prisma.platformConversation.updateMany({
        where: { canopyConversationId: conversation.id, organizationId: ctx.tenant.organizationId },
        data: {
          humanTakeover: body.mutedAi,
          automationLockedUntil: body.mutedAi
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : null,
        },
      });
    }

    let inserted: { id: string; body: string } | null = null;
    if (body.insertSequenceStep && updated.activeSequence) {
      const step = updated.activeSequence.steps[updated.activeSequenceStep];
      if (step) {
        const bubbles = splitReplyBubbles(step.body, { splitSentences: true });
        const bodies = bubbles.length ? bubbles : [step.body];
        const now = Date.now();
        const created = [];
        for (let i = 0; i < bodies.length; i += 1) {
          created.push(
            await prisma.message.create({
              data: {
                organizationId: ctx.tenant.organizationId,
                conversationId: updated.id,
                authorType: "CHATTER",
                authorUserId: ctx.userId,
                body: bodies[i]!,
                aiAssisted: false,
                createdAt: new Date(now + i),
              },
            }),
          );
        }
        const message = created[created.length - 1];
        if (message) {
          await prisma.conversation.update({
            where: { id: updated.id },
            data: { lastMessageAt: new Date() },
          });
          inserted = { id: message.id, body: bodies.join("\n") };
        }
      }
    }

    const purchasedPpvCount = await prisma.purchase.count({
      where: {
        organizationId: ctx.tenant.organizationId,
        subscriberId: updated.subscriberId,
        refunded: false,
        conversation: { creatorId: updated.creatorId },
      },
    });

    return NextResponse.json({
      id: updated.id,
      mutedAi: updated.mutedAi,
      activeSequenceId: updated.activeSequenceId,
      activeSequenceStep: updated.activeSequenceStep,
      unansweredFollowUps: updated.unansweredFollowUps,
      purchasedPpvCount,
      aftercareAfter: AFTERCARE_AFTER_PURCHASES,
      inserted,
      currentStep: updated.activeSequence?.steps[updated.activeSequenceStep] ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
