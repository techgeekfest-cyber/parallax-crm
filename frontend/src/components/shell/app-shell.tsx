"use client";

import {
  Building2Icon,
  ContactRoundIcon,
  HandshakeIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { usePermissions, type Permissions } from "@/features/auth/api";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type NavItem = { href: string; label: string; icon: LucideIcon; visible?: (permissions: Permissions) => boolean };

// Navigation grows as modules ship; only live modules are listed, and only to people who can use them.
const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "CRM",
    items: [
      { href: "/leads", label: "Leads", icon: UsersRoundIcon },
      { href: "/accounts", label: "Accounts", icon: Building2Icon },
      { href: "/contacts", label: "Contacts", icon: ContactRoundIcon },
      { href: "/opportunities", label: "Opportunities", icon: HandshakeIcon },
    ],
  },
  { label: "Team", items: [{ href: "/sales-reps", label: "Sales reps", icon: TrophyIcon }] },
  {
    label: "Workspace",
    items: [{ href: "/users", label: "Users", icon: ShieldCheckIcon, visible: (p) => p.viewUsers }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const permissions = usePermissions();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.visible || (permissions && item.visible(permissions))),
  })).filter((section) => section.items.length > 0);

  const link = ({ href, label, icon: Icon }: NavItem) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className={cn("size-4", active && "text-primary")} />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/leads" aria-label="ParallaxCRM home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-4 px-2 py-3">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {section.label}
              </p>
              {section.items.map(link)}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <UserMenu />
        </div>
      </aside>

      <header className="border-b bg-sidebar md:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/leads" aria-label="ParallaxCRM home">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu compact />
          </div>
        </div>
        {/* Every section's links in one row that scrolls sideways on narrow screens. */}
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
          {sections.flatMap((section) => section.items).map(link)}
        </nav>
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
