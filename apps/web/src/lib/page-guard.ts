import type { Permission } from "@canopy/shared";
import { hasPermission } from "@canopy/shared";
import { requireOrgUser } from "@/lib/session";

export async function guardOrgPage(permission: Permission | Permission[]) {
  const ctx = await requireOrgUser();
  const perms = Array.isArray(permission) ? permission : [permission];
  const allowed = Boolean(
    ctx.isPlatformAdmin || (ctx.tenant && perms.some((perm) => hasPermission(ctx.role, perm))),
  );
  return { allowed, ctx };
}
