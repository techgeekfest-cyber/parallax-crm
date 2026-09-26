import { cn } from "@/lib/utils";

import type { LeadStatus } from "./api";
import { LEAD_STATUS_LABELS } from "./labels";

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
  CONTACTED: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
  QUALIFIED: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  DISQUALIFIED: "bg-muted text-muted-foreground ring-border",
  CONVERTED: "bg-primary/10 text-primary ring-primary/25",
};

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}
