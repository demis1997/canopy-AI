import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui/card";

export default async function TeamPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const members = await prisma.organizationMembership.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    include: { user: true },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
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
              <tr key={m.id} className="border-t border-white/5">
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
    </div>
  );
}
