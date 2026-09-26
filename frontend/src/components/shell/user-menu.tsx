"use client";

import { ChevronsUpDownIcon, LogOutIcon, UserRoundCogIcon } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogout, useMe } from "@/features/auth/api";
import { initials, ROLE_LABELS } from "@/features/auth/roles";
import { cn } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-xs font-semibold text-primary ring-1 ring-primary/20 ring-inset",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data: me } = useMe();
  const logout = useLogout();

  if (!me) {
    return compact ? <Skeleton className="size-8 rounded-lg" /> : <Skeleton className="h-12 w-full rounded-lg" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-2.5 rounded-lg text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "p-0.5" : "w-full p-2",
        )}
      >
        <Avatar name={me.fullName} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{me.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[me.role]}</span>
            </span>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="py-1.5">
            <span className="block truncate text-sm font-medium text-foreground">{me.fullName}</span>
            <span className="block truncate font-normal">{me.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserRoundCogIcon />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
