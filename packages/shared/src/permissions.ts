import type { Role } from "./enums.js";

export type Permission =
  | "org.manage"
  | "org.suspend"
  | "team.invite"
  | "creators.manage"
  | "creators.view_assigned"
  | "creators.edit_own_persona"
  | "products.manage"
  | "training.manage"
  | "training.approve"
  | "conversations.view"
  | "conversations.generate"
  | "conversations.escalate"
  | "analytics.view"
  | "analytics.view_aggregate"
  | "settings.retention"
  | "settings.security"
  | "settings.ai_provider"
  | "admin.platform"
  | "escalations.review"
  | "platform.connect"
  | "automation.review";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  PLATFORM_ADMIN: [
    "admin.platform",
    "org.manage",
    "org.suspend",
    "settings.ai_provider",
    "analytics.view_aggregate",
  ],
  AGENCY_OWNER: [
    "org.manage",
    "team.invite",
    "creators.manage",
    "products.manage",
    "training.manage",
    "training.approve",
    "conversations.view",
    "conversations.generate",
    "conversations.escalate",
    "analytics.view",
    "settings.retention",
    "settings.security",
    "settings.ai_provider",
    "escalations.review",
    "platform.connect",
    "automation.review",
  ],
  MANAGER: [
    "creators.manage",
    "products.manage",
    "training.approve",
    "conversations.view",
    "conversations.generate",
    "conversations.escalate",
    "analytics.view",
    "escalations.review",
    "automation.review",
  ],
  CHATTER: [
    "creators.view_assigned",
    "conversations.view",
    "conversations.generate",
    "conversations.escalate",
  ],
  CREATOR: ["creators.edit_own_persona", "products.manage", "conversations.view", "analytics.view"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(`Role ${role} cannot ${permission}`);
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class TenantIsolationError extends Error {
  readonly status = 403;
  constructor(message = "Tenant context is required") {
    super(message);
    this.name = "TenantIsolationError";
  }
}
