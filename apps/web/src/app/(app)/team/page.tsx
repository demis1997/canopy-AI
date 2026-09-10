import { prisma } from "@canopy/database";
import { Badge, Card } from "@/components/ui/card";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";

export default async function TeamPage() {
  const { allowed, ctx } = await guardOrgPage("team.invite");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
  const members = await prisma.organizationMembership.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    include: { user: true },
  });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Optimize" title="Team" description="Users, roles and performance seats for this agency." />
      {members.length ? (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-white/40">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-white/[0.06]">
                  <td className="px-5 py-3">
                    {m.user.name} {m.user.isDemo ? <Badge tone="warn">DEMO</Badge> : null}
                  </td>
                  <td>{m.user.email}</td>
                  <td>{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="No members" body="Invite operators from your identity provider workflow." />
      )}
    </div>
  );
}
