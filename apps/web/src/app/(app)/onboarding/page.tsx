import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { z } from "zod";

export default async function OnboardingPage() {
  const ctx = await requireOrgUser();
  if (ctx.tenant) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-3xl font-semibold">Create your organization</h1>
      <Card>
        <form action={createOrg} className="space-y-3">
          <input
            name="name"
            required
            placeholder="Agency name"
            className="h-9 w-full rounded-md border border-white/10 bg-ink-900 px-3 text-sm"
          />
          <button className="h-9 rounded-md bg-canopy-500 px-3 text-sm text-ink-950">Continue</button>
        </form>
      </Card>
    </div>
  );
}

async function createOrg(formData: FormData) {
  "use server";
  const ctx = await requireOrgUser();
  const name = z.string().min(2).parse(formData.get("name"));
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const org = await prisma.organization.create({
    data: {
      name,
      slug: `${slug}-${Date.now().toString(36)}`,
      memberships: { create: { userId: ctx.userId, role: "AGENCY_OWNER" } },
      retentionPolicy: { create: {} },
    },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "Organization",
      entityId: org.id,
    },
  });
  redirect("/dashboard");
}
