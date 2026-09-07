import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { hasPermission } from "@canopy/shared";
import { redirect } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { AutonomySelect, EmergencyStopButton, PolicyForm } from "@/components/platform-controls";
import { readFeatureFlags } from "@canopy/shared";

export default async function PlatformSettingsPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  if (!hasPermission(ctx.role, "platform.connect") && !ctx.isPlatformAdmin) redirect("/dashboard");
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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Platform connection</h1>
        <p className="mt-2 max-w-3xl text-sm text-amber-200">
          Unofficial browser integration. It is not supported by OnlyFans and can stop working if the
          site changes. Canopy never stores the creator password. Login, 2FA and CAPTCHA must be
          completed by the creator in a local browser window.
        </p>
      </div>
      <Card className="text-sm text-white/70">
        Flags: browser={String(flags.browserIntegration)} · autonomous text={String(flags.autonomousText)} ·
        autonomous PPV={String(flags.autonomousPpv)} · mock={String(flags.mockPlatform)}
      </Card>
      {accounts.map((account) => (
        <Card key={account.id} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-medium">{account.creator.displayName}</div>
              <div className="text-xs text-white/45">
                {account.displayName} · {account.driver} · {account.id}
              </div>
            </div>
            <EmergencyStopButton accountId={account.id} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone={account.connectionStatus === "CONNECTED" ? "good" : "warn"}>{account.connectionStatus}</Badge>
            <Badge>{account.autonomyMode}</Badge>
            {account.manualInterventionReason ? <Badge tone="bad">{account.manualInterventionReason}</Badge> : null}
          </div>
          <div className="grid gap-2 text-sm text-white/70 md:grid-cols-2">
            <div>Last heartbeat: {account.lastHeartbeatAt?.toISOString() ?? "never"}</div>
            <div>Last inbox sync: {account.lastInboxSyncAt?.toISOString() ?? "never"}</div>
          </div>
          <AutonomySelect accountId={account.id} value={account.autonomyMode} />
          <p className="text-xs text-white/45">
            Manual connect: <code>pnpm --filter @canopy/web platform:connect -- --account {account.id}</code>
          </p>
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
              {!account.actions.length ? <li>None yet. Review the full queue on /automation.</li> : null}
            </ul>
          </div>
        </Card>
      ))}
      {!accounts.length ? (
        <Card className="text-sm text-white/60">
          No platform account yet. Create one for {creators[0]?.displayName ?? "a creator"} from the API
          or re-seed the demo agency.
        </Card>
      ) : null}
    </div>
  );
}
