import { prisma } from "@canopy/database";
import { Card, Badge } from "@/components/ui/card";
import { AutonomySelect, EmergencyStopButton, PolicyForm } from "@/components/platform-controls";
import { readFeatureFlags } from "@canopy/shared";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";
import { ExtensionOnboarding } from "@/components/extension-onboarding";

export default async function PlatformPage() {
  const { allowed, ctx } = await guardOrgPage("platform.connect");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const flags = readFeatureFlags();
  const accounts = await prisma.platformAccount.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    include: {
      policy: true,
      creator: true,
      actions: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  const creators = await prisma.creator.findMany({
    where: { organizationId: ctx.tenant.organizationId, active: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configure"
        title="Platform & extension"
        description="Connect OnlyFansAPI from Products & vault. Copilot mode requires approval for every reply. Canopy stores the provider API key encrypted and never collects creator passwords."
      />
      <Card className="space-y-2 text-sm text-white/70">
        <div className="font-medium text-white">Automatic reply setup</div>
        <p>
          Connecting an account and selecting Autopilot do not start the message worker. The worker
          must be running to receive fan messages and send replies. For a local test, keep the
          worker computer awake; closing it stops automatic replies.
        </p>
        <p>
          After changing the encryption key, reconnect your platform and saved AI-provider
          credentials. The website and worker must use the same database and encryption key.
        </p>
      </Card>
      <ExtensionOnboarding />
      <Card className="text-sm text-white/70">
        Flags: browser={String(flags.browserIntegration)} · autonomous text=
        {String(flags.autonomousText)} · autonomous PPV={String(flags.autonomousPpv)} · mock=
        {String(flags.mockPlatform)}. Automatic sending requires Hybrid or Autopilot mode. Pause a
        single chat from the conversation thread. Account emergency stop still wins.
      </Card>
      {accounts.map((account) => (
        <Card key={account.id} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-medium">{account.creator.displayName}</div>
              <div className="text-xs text-white/45">
                {account.displayName} · {account.driver} · last seen{" "}
                {account.lastHeartbeatAt?.toISOString() ?? "never"}
              </div>
            </div>
            <EmergencyStopButton accountId={account.id} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone={account.connectionStatus === "CONNECTED" ? "good" : "warn"}>
              {account.connectionStatus}
            </Badge>
            <Badge>{account.autonomyMode}</Badge>
            {account.manualInterventionReason ? (
              <Badge tone="bad">{account.manualInterventionReason}</Badge>
            ) : null}
          </div>
          <p role="status" className="text-sm text-white/70">
            {account.manualInterventionReason?.includes("(402)")
              ? "OnlyFansAPI credits are exhausted. Restore provider credits before restarting the worker."
              : !account.lastHeartbeatAt
                ? "Worker has not checked in. Automatic replies are not ready yet."
                : Date.now() - account.lastHeartbeatAt.getTime() > 120_000
                  ? "Worker check-in is overdue. Check that the worker computer is awake and the worker is running."
                  : "Worker checked in recently. Replies still follow your account policy and AI-provider checks."}
          </p>
          <AutonomySelect accountId={account.id} value={account.autonomyMode} />
          {account.policy ? <PolicyForm accountId={account.id} policy={account.policy} /> : null}
          <div>
            <div className="mb-2 text-xs text-white/45">Recent automation actions</div>
            <ul className="space-y-1 text-xs text-white/70">
              {account.actions.map((action) => (
                <li key={action.id}>
                  {action.status} · {action.actionType} · {action.escalationReason ?? "ok"} ·{" "}
                  {action.createdAt.toISOString()}
                </li>
              ))}
              {!account.actions.length ? (
                <li>None yet. Review the full queue on /automation.</li>
              ) : null}
            </ul>
          </div>
        </Card>
      ))}
      {!accounts.length ? (
        <EmptyState
          title="No platform account yet"
          body={`Create one for ${creators[0]?.displayName ?? "a creator"} from the API or re-seed the demo agency.`}
        />
      ) : null}
    </div>
  );
}
