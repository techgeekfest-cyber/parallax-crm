import type { Role } from "@/features/auth/api";
import { ROLE_LABELS } from "@/features/auth/roles";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<Role, string> = {
  ADMIN: "bg-primary/10 text-primary ring-primary/25",
  SALES_MANAGER: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
  SALES_REP: "bg-muted text-foreground/80 ring-border",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", ROLE_STYLES[role])}>
      {ROLE_LABELS[role]}
    </span>
  );
}
