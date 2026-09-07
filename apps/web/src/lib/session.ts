import { NextResponse } from "next/server";
import type { Permission, Role } from "@canopy/shared";
import { AuthorizationError, TenantIsolationError, hasPermission } from "@canopy/shared";
import { requireTenant } from "@canopy/database";
import { auth } from "./auth";

export type SessionContext = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string | null;
  isPlatformAdmin: boolean;
};

export async function getContext(): Promise<SessionContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    organizationId: session.user.organizationId,
    isPlatformAdmin: session.user.isPlatformAdmin,
  };
}

export async function requireUser(): Promise<SessionContext> {
  const ctx = await getContext();
  if (!ctx) {
    throw new AuthorizationError("Authentication required");
  }
  return ctx;
}

export async function requireOrgUser() {
  const ctx = await requireUser();
  if (!ctx.organizationId) {
    return { ...ctx, tenant: null as ReturnType<typeof requireTenant> | null };
  }
  const tenant = requireTenant(ctx.organizationId);
  return { ...ctx, tenant };
}

export function requirePerm(ctx: SessionContext, permission: Permission) {
  if (!hasPermission(ctx.role, permission) && !ctx.isPlatformAdmin) {
    throw new AuthorizationError(`Missing permission ${permission}`);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof TenantIsolationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[canopy]", error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
