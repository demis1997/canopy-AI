import { prisma } from "@canopy/database";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ProviderSettings } from "@/components/provider-settings";

export default async function AdminPage() {
  const ctx = await requireUser();
  if (!ctx.isPlatformAdmin) redirect("/dashboard");
  const orgs = await prisma.organization.findMany({ orderBy: { createdAt: "desc" } });
  const generations = await prisma.generation.count();
  const failures = await prisma.generation.count({ where: { status: "FAILED" } });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Platform admin</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs text-white/45">Organizations</div>
          <div className="mt-2 text-2xl">{orgs.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-white/45">Generations</div>
          <div className="mt-2 text-2xl">{generations}</div>
        </Card>
        <Card>
          <div className="text-xs text-white/45">Provider failures</div>
          <div className="mt-2 text-2xl">{failures}</div>
        </Card>
      </div>
      <Card>
        <div className="text-sm font-medium">Agencies</div>
        <ul className="mt-3 space-y-2 text-sm">
          {orgs.map((o) => (
            <li key={o.id}>
              {o.name} · {o.status} {o.isDemo ? "(DEMO)" : ""}
            </li>
          ))}
        </ul>
      </Card>
      <ProviderSettings />
    </div>
  );
}
