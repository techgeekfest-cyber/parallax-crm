"use client";

import { UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./theme-toggle";

// Navigation grows as modules ship; only live modules are listed.
const NAV_ITEMS = [{ href: "/leads", label: "Leads", icon: UsersRoundIcon }] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const nav = NAV_ITEMS.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className={cn("size-4", active && "text-primary")} />
        {label}
      </Link>
    );
  });

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center px-4">
          <Link href="/leads" aria-label="ParallaxCRM home">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-2 py-3">
          <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">CRM</p>
          {nav}
        </nav>
        <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </aside>

      <header className="flex h-14 items-center justify-between gap-4 border-b bg-sidebar px-4 md:hidden">
        <Link href="/leads" aria-label="ParallaxCRM home">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label="Main" className="flex gap-1">
            {nav}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
