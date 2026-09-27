"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { PipelineSummary } from "./api";

/** Open, weighted and won totals — computed by the backend from the opportunities the viewer can see. */
export function PipelineSummaryCards({
  summary,
  loading,
  scopeNote,
  className,
}: {
  summary?: PipelineSummary;
  loading: boolean;
  scopeNote?: string;
  className?: string;
}) {
  const stats = [
    { label: "Open pipeline", value: summary && formatCurrency(summary.openAmount), sub: summary && `${summary.openCount} open` },
    { label: "Weighted pipeline", value: summary && formatCurrency(summary.weightedAmount), sub: "Amount × probability" },
    { label: "Closed won", value: summary && formatCurrency(summary.wonAmount), sub: summary && `${summary.wonCount} won · ${summary.lostCount} lost` },
  ];
  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
          {loading || !summary ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{loading ? " " : stat.sub}</p>
        </div>
      ))}
      {scopeNote && <p className="text-xs text-muted-foreground sm:col-span-3">{scopeNote}</p>}
    </div>
  );
}
