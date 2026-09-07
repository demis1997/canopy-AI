"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Package,
  GraduationCap,
  AlertTriangle,
  BarChart3,
  Settings,
  Shield,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@canopy/shared";
import { hasPermission } from "@canopy/shared";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "analytics.view" as const },
  { href: "/conversations", label: "Conversations", icon: MessageSquare, perm: "conversations.view" as const },
  { href: "/creators", label: "Creators", icon: Users, perm: "creators.view_assigned" as const },
  { href: "/products", label: "Products", icon: Package, perm: "products.manage" as const },
  { href: "/training", label: "Training", icon: GraduationCap, perm: "training.approve" as const },
  { href: "/escalations", label: "Escalations", icon: AlertTriangle, perm: "conversations.escalate" as const },
  { href: "/automation", label: "Automation", icon: AlertTriangle, perm: "automation.review" as const },
  { href: "/team", label: "Team", icon: Users, perm: "team.invite" as const },
  { href: "/analytics", label: "Analytics", icon: BarChart3, perm: "analytics.view" as const },
  { href: "/settings/organization", label: "Organization", icon: Settings, perm: "org.manage" as const },
  { href: "/settings/ai-provider", label: "AI provider", icon: Shield, perm: "settings.ai_provider" as const },
  { href: "/settings/platform", label: "Platform", icon: Shield, perm: "platform.connect" as const },
  { href: "/settings/security", label: "Security", icon: Shield, perm: "settings.security" as const },
  { href: "/settings/data-retention", label: "Retention", icon: Settings, perm: "settings.retention" as const },
  { href: "/admin", label: "Admin", icon: Shield, perm: "admin.platform" as const },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: Role; isPlatformAdmin: boolean };
}) {
  const pathname = usePathname();
  const items = NAV.filter((item) => user.isPlatformAdmin || hasPermission(user.role, item.perm) || item.perm === "creators.view_assigned" && (hasPermission(user.role, "creators.manage") || hasPermission(user.role, "creators.edit_own_persona") || hasPermission(user.role, "creators.view_assigned")));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-white/8 bg-ink-900/90">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="h-8 w-8 rounded-lg bg-canopy-500/20 ring-1 ring-canopy-500/40" />
          <div>
            <div className="text-sm font-semibold tracking-tight">Canopy</div>
            <div className="text-[11px] text-white/40">Copilot</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white",
                  active && "bg-canopy-500/10 text-canopy-300",
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/8 p-4">
          <div className="truncate text-sm">{user.name}</div>
          <div className="truncate text-[11px] text-white/40">{user.role}</div>
          <button
            className="mt-3 flex items-center gap-2 text-xs text-white/50 hover:text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
