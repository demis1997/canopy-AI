"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
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
  PanelLeft,
  Bell,
  Search,
  Plug,
  Sparkles,
  Lock,
  Database,
  Bot,
} from "lucide-react";
import { CanopyMark } from "@/components/brand/canopy-mark";
import { cn } from "@/lib/utils";
import type { Role } from "@canopy/shared";
import { hasPermission } from "@canopy/shared";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm: Parameters<typeof hasPermission>[1];
  adminOnly?: boolean;
};

const GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: "operate",
    label: "Operate",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "conversations.view" },
      {
        href: "/conversations",
        label: "Conversations",
        icon: MessageSquare,
        perm: "conversations.view",
      },
      {
        href: "/escalations",
        label: "Escalations",
        icon: AlertTriangle,
        perm: "conversations.escalate",
      },
      { href: "/creators", label: "Creators", icon: Users, perm: "creators.view_assigned" },
    ],
  },
  {
    id: "optimize",
    label: "Optimize",
    items: [
      { href: "/products", label: "Products", icon: Package, perm: "products.manage" },
      { href: "/sequences", label: "Sequences", icon: Sparkles, perm: "conversations.view" },
      { href: "/training", label: "Training", icon: GraduationCap, perm: "training.approve" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, perm: "analytics.view" },
      { href: "/team", label: "Team", icon: Users, perm: "team.invite" },
    ],
  },
  {
    id: "configure",
    label: "Configure",
    items: [
      { href: "/automation", label: "Automation", icon: Bot, perm: "automation.review" },
      { href: "/organization", label: "Organization", icon: Settings, perm: "org.manage" },
      { href: "/ai-provider", label: "AI provider", icon: Sparkles, perm: "settings.ai_provider" },
      { href: "/platform", label: "Platform", icon: Plug, perm: "platform.connect" },
      { href: "/security", label: "Security", icon: Lock, perm: "settings.security" },
      { href: "/retention", label: "Retention", icon: Database, perm: "settings.retention" },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/admin", label: "Admin", icon: Shield, perm: "admin.platform", adminOnly: true },
    ],
  },
];

function canSee(user: { role: Role; isPlatformAdmin: boolean }, item: NavItem) {
  if (item.adminOnly) return user.isPlatformAdmin;
  if (user.isPlatformAdmin) return true;
  if (item.perm === "creators.view_assigned") {
    return (
      hasPermission(user.role, "creators.view_assigned") ||
      hasPermission(user.role, "creators.manage") ||
      hasPermission(user.role, "creators.edit_own_persona")
    );
  }
  return hasPermission(user.role, item.perm);
}

export function AppShell({
  children,
  user,
  workspace,
  escalationCount = 0,
  extensionConnected = false,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: Role; isPlatformAdmin: boolean };
  workspace: { name: string; isDemo: boolean };
  escalationCount?: number;
  extensionConnected?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("canopy.nav.collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((v) => {
      window.localStorage.setItem("canopy.nav.collapsed", v ? "0" : "1");
      return !v;
    });
  }

  return (
    <div className="flex min-h-screen bg-charcoal">
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/95 backdrop-blur-sm transition-[width]",
          collapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex items-center gap-2 px-3 py-4", collapsed && "justify-center")}>
          <CanopyMark size={28} />
          {collapsed ? null : (
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium tracking-[0.18em] text-bone">
                CANOPY
              </div>
              <div className="truncate text-[11px] text-mist">
                {workspace.name}
                {workspace.isDemo ? " · DEMO" : ""}
              </div>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {collapsed ? null : (
            <Link
              href="/organization"
              className="mb-1 block rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left"
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/30">Workspace</div>
              <div className="truncate text-sm">{workspace.name}</div>
            </Link>
          )}
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => canSee(user, item));
            if (!items.length) return null;
            return (
              <div key={group.id}>
                {collapsed ? null : (
                  <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={cn(
                          "flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-sm text-white/60 transition hover:bg-white/[0.04] hover:text-white",
                          collapsed && "justify-center px-0",
                          active && "bg-leaf/10 text-bone",
                        )}
                      >
                        <Icon size={16} />
                        {collapsed ? null : item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] px-2 py-2 text-xs text-white/40 hover:bg-white/[0.04] hover:text-white"
          >
            <PanelLeft size={14} />
            {collapsed ? null : "Collapse"}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-charcoal/90 px-4 backdrop-blur md:px-6">
          <form action="/conversations" className="relative min-w-0 flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="h-9 w-full rounded-[10px] border border-white/[0.06] bg-white/[0.03] pl-9 pr-3 text-sm outline-none placeholder:text-white/30 focus:border-leaf/40"
            />
          </form>
          <Link
            href="/platform"
            className="hidden items-center gap-1.5 rounded-full border border-white/[0.06] px-2.5 py-1 text-[11px] text-white/50 md:inline-flex"
            title="Extension status"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                extensionConnected ? "bg-sunfleck" : "bg-brass",
              )}
            />
            {extensionConnected ? "Extension connected" : "Extension"}
          </Link>
          <Link
            href="/escalations"
            className="relative rounded-[10px] p-2 text-white/50 hover:bg-white/[0.04]"
          >
            <Bell size={16} />
            {escalationCount ? (
              <span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] text-white">
                {escalationCount}
              </span>
            ) : null}
          </Link>
          <div className="hidden min-w-0 text-right sm:block">
            <div className="truncate text-sm">{user.name}</div>
            <div className="truncate text-[11px] text-white/40">{user.role}</div>
          </div>
          <button
            type="button"
            className="rounded-[10px] p-2 text-white/50 hover:bg-white/[0.04] hover:text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
