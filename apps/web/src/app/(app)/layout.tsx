import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@canopy/database";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const org = session.user.organizationId
    ? await prisma.organization.findUnique({ where: { id: session.user.organizationId } })
    : null;
  const escalationCount = session.user.organizationId
    ? await prisma.escalation.count({
        where: { organizationId: session.user.organizationId, status: { in: ["OPEN", "IN_REVIEW"] } },
      })
    : 0;
  const extensionConnected = session.user.id
    ? await prisma.extensionToken.count({
        where: { userId: session.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      })
    : 0;
  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        isPlatformAdmin: session.user.isPlatformAdmin,
      }}
      workspace={{ name: org?.name ?? "Platform", isDemo: org?.isDemo ?? false }}
      escalationCount={escalationCount}
      extensionConnected={extensionConnected > 0}
    >
      {children}
    </AppShell>
  );
}
