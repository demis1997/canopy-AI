import { prisma } from "@canopy/database";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";
import { Card } from "@/components/ui/card";

export default async function SecurityPage() {
  const { allowed, ctx } = await guardOrgPage("settings.security");
  if (!ctx.tenant) return <AccessDenied />;
  if (!allowed) return <AccessDenied />;
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configure"
        title="Security"
        description="Sessions, audit events and access controls. Secrets are redacted."
      />
      <Card className="text-sm text-white/70">
        HTTP-only JWT cookies, 12-hour extension tokens stored hashed, AES-256-GCM provider keys,
        Auth.js CSRF, and generation rate limits.
      </Card>
      <Card>
        <div className="text-sm font-medium">Recent audit log</div>
        {logs.length ? (
          <ul className="mt-3 space-y-1 text-xs text-white/50">
            {logs.map((l) => (
              <li key={l.id}>
                {l.createdAt.toISOString()} · {l.action} · {l.entityType}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No audit events yet" body="Logins, provider changes and sends appear here." />
        )}
      </Card>
    </div>
  );
}
