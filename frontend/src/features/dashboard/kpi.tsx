import { InfoIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * A stat tile: label, value and one line of context. `empty` swaps the context for an honest reason when the value
 * can't be computed (no closed deals, no quota) — the value itself then reads "—".
 */
export function KpiTile({
  label,
  value,
  context,
  empty,
  hint,
  size = "lg",
  children,
}: {
  label: string;
  value?: string;
  context?: React.ReactNode;
  empty?: string;
  /** What the figure means, shown on hover/focus of the info icon. */
  hint?: string;
  size?: "lg" | "sm";
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 shadow-xs" role="group" aria-label={label}>
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {hint && (
          <span className="group/hint relative inline-flex" tabIndex={0} aria-label={hint}>
            <InfoIcon className="size-3.5 opacity-60" aria-hidden="true" />
            <span
              role="tooltip"
              className="pointer-events-none absolute top-5 left-1/2 z-20 hidden w-56 -translate-x-1/2 rounded-lg border bg-popover p-2 text-xs font-normal text-popover-foreground shadow-md group-hover/hint:block group-focus/hint:block"
            >
              {hint}
            </span>
          </span>
        )}
      </p>
      {value === undefined ? (
        <Skeleton className={cn("mt-2", size === "lg" ? "h-8 w-32" : "h-6 w-20")} />
      ) : (
        <p className={cn("mt-1 truncate font-semibold tracking-tight", size === "lg" ? "text-2xl sm:text-3xl" : "text-xl")}>{value}</p>
      )}
      {children}
      <p className="mt-1 truncate text-xs text-muted-foreground">{value === undefined ? " " : (empty ?? context)}</p>
    </div>
  );
}

/** Progress toward a target. Past 100% the bar stays full; the number says by how much. */
export function Meter({ percent, label }: { percent: number; label: string }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  );
}
