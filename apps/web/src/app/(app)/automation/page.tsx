import { prisma } from "@canopy/database";
import { Badge, Card } from "@/components/ui/card";
import { ReviewControls, EmergencyStopAll } from "@/components/platform-controls";
import type { AutomationDecision } from "@canopy/shared";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";

export default async function AutomationReviewPage() {
  const { allowed, ctx } = await guardOrgPage("automation.review");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const [actions, accounts] = await Promise.all([
    prisma.automationAction.findMany({
      where: { organizationId: ctx.tenant.organizationId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        platformConversation: true,
        platformAccount: { include: { creator: true, policy: true } },
      },
    }),
    prisma.platformAccount.findMany({
      where: { organizationId: ctx.tenant.organizationId },
      select: { id: true, autonomyMode: true, displayName: true, creator: { select: { displayName: true } } },
    }),
  ]);
  const triggers = await prisma.platformMessage.findMany({
    where: {
      organizationId: ctx.tenant.organizationId,
      id: { in: actions.map((a) => a.triggerMessageId).filter(Boolean) as string[] },
    },
  });
  const triggerById = new Map(triggers.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configure"
        title="Automation"
        description="Autonomous text is on by default. Pause an individual chat from the conversation page. Account emergency stop still halts every thread."
        actions={<EmergencyStopAll accountIds={accounts.map((a) => a.id)} />}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="text-sm font-medium">Autonomous (default)</div>
          <p className="mt-1 text-sm text-white/50">
            Replies send in-thread automatically. Pause any chat from the conversation page.
          </p>
        </Card>
        <Card>
          <div className="text-sm font-medium">Approval queue</div>
          <p className="mt-1 text-sm text-white/50">Low-confidence or safety-flagged replies still wait for a human.</p>
        </Card>
        <Card>
          <div className="text-sm font-medium">Account stop</div>
          <p className="mt-1 text-sm text-white/50">
            Emergency stop / PAUSED halts every creator account. MOCK driver never contacts OnlyFans.
          </p>
        </Card>
      </div>
      <Card className="text-sm text-white/60">
        Per-account kill switch is PAUSED / Emergency stop. Allowed creators, operating hours, max actions/hour,
        cooldown, minimum confidence, price ceiling, forbidden topics and escalation triggers live on each account
        policy under Platform. Autonomous text is on unless ONLYFANS_AUTONOMOUS_TEXT=false. Pause a single
        conversation with “Pause this chat”. Account PAUSED / Emergency stop still stops everything.
      </Card>
      {accounts.length ? (
        <Card>
          <div className="text-sm font-medium">Accounts</div>
          <ul className="mt-2 space-y-1 text-sm">
            {accounts.map((a) => (
              <li key={a.id}>
                {a.creator.displayName} · {a.autonomyMode}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
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
              {action.platformConversation.humanTakeover ? <Badge tone="warn">Human takeover</Badge> : null}
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
              <div>
                Product / price: {payload?.productId ?? "none"} {payload?.price ?? ""}
              </div>
              <div>Safety flags: {(payload?.safetyFlags ?? []).join(", ") || "none"}</div>
              <div>Reason: {action.escalationReason ?? payload?.reason}</div>
            </div>
            {action.status === "APPROVAL_REQUIRED" || action.status === "SCHEDULED" ? (
              <ReviewControls actionId={action.id} />
            ) : null}
          </Card>
        );
      })}
      {!actions.length ? <EmptyState title="No automation actions yet" body="Queued, approved and dry-run actions appear here." /> : null}
    </div>
  );
}
