import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

export default async function SecurityPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
      <Card className="text-sm text-white/70">
        Sessions use HTTP-only JWT cookies. Extension tokens expire in 12 hours and are stored hashed.
        Provider keys are encrypted with AES-256-GCM. CSRF is handled by Auth.js. Rate limits apply to
        generation endpoints.
      </Card>
      <Card>
        <div className="text-sm font-medium">Recent audit log</div>
        <ul className="mt-3 space-y-1 text-xs text-white/50">
          {logs.map((l) => (
            <li key={l.id}>
              {l.createdAt.toISOString()} · {l.action} · {l.entityType}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
