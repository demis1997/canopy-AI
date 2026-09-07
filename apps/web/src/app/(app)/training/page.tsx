import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui/card";
import { TrainingInbox } from "@/components/training-inbox";

export default async function TrainingPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const chunks = await prisma.trainingChunk.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    include: { document: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Training materials</h1>
      <p className="text-sm text-white/50">
        Agency manuals (sexting rules, trans terminology, chatter chapters) are retrieved into every
        generation. Chunks stay pending until a manager approves them. Do not upload founder-legal
        PDFs or raw fan IDs — paste anonymized examples only.
      </p>
      <TrainingInbox
        chunks={chunks.map((c) => ({
          id: c.id,
          title: c.document.title,
          content: c.content,
          status: c.status,
        }))}
      />
      <div className="grid gap-3">
        {chunks.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{c.document.title}</div>
              <Badge tone={c.status === "APPROVED" ? "good" : c.status === "REJECTED" ? "bad" : "warn"}>
                {c.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-white/60">{c.content.slice(0, 280)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
