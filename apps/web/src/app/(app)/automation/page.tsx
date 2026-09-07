import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { hasPermission } from "@canopy/shared";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui/card";
import { ReviewControls } from "@/components/platform-controls";
import type { AutomationDecision } from "@canopy/shared";

export default async function AutomationReviewPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  if (!hasPermission(ctx.role, "automation.review") && !ctx.isPlatformAdmin) redirect("/dashboard");
  const actions = await prisma.automationAction.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      platformConversation: true,
      platformAccount: { include: { creator: true } },
    },
  });
  const triggers = await prisma.platformMessage.findMany({
    where: {
      organizationId: ctx.tenant.organizationId,
      id: { in: actions.map((a) => a.triggerMessageId).filter(Boolean) as string[] },
    },
  });
  const triggerById = new Map(triggers.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Automation review</h1>
      {actions.map((action) => {
        const payload = action.generatedPayload as AutomationDecision | null;
        const trigger = action.triggerMessageId ? triggerById.get(action.triggerMessageId) : null;
        return (
          <Card key={action.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={action.status === "FAILED" ? "bad" : action.status === "SENT" ? "good" : "warn"}>
                {action.status}
              </Badge>
              <Badge>{action.actionType}</Badge>
              {action.platformConversation.humanTakeover ? <Badge tone="warn">Human takeover active</Badge> : null}
            </div>
            <div className="text-sm text-white/70">
              {action.platformAccount.creator.displayName} · {action.platformConversation.externalFanDisplayName}
            </div>
            <div className="text-xs text-white/45">Trigger (fan)</div>
            <p className="text-sm">{trigger?.body ?? "—"}</p>
            <div className="text-xs text-white/45">Proposed response</div>
            <p className="text-sm">{payload?.messages?.join("\n") ?? "—"}</p>
            <div className="grid gap-1 text-xs text-white/50 md:grid-cols-2">
              <div>Decision: {payload?.action}</div>
              <div>Funnel: {payload?.funnelStage}</div>
              <div>Confidence: {action.confidence ?? payload?.confidence}</div>
              <div>Product / price: {payload?.productId ?? "none"} {payload?.price ?? ""}</div>
              <div>Safety flags: {(payload?.safetyFlags ?? []).join(", ") || "none"}</div>
              <div>Reason: {action.escalationReason ?? payload?.reason}</div>
            </div>
            {action.status === "APPROVAL_REQUIRED" || action.status === "SCHEDULED" ? (
              <ReviewControls actionId={action.id} />
            ) : null}
          </Card>
        );
      })}
      {!actions.length ? <Card className="text-sm text-white/50">No automation actions yet.</Card> : null}
    </div>
  );
}
