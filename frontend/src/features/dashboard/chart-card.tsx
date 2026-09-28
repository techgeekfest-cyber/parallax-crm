"use client";

import { BarChart3Icon, TableIcon } from "lucide-react";
import { useState } from "react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A chart with a table view of the same numbers — the accessible alternative, and the place exact values live.
 * `empty` replaces both when there is nothing meaningful to plot.
 */
export function ChartCard({
  title,
  description,
  chart,
  table,
  empty,
  footer,
  className,
}: {
  title: string;
  description?: string;
  chart: React.ReactNode;
  table: React.ReactNode;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {!empty && (
          <CardAction>
            <div role="group" aria-label={`${title} view`} className="flex rounded-lg border p-0.5">
              {(
                [
                  ["chart", "Chart", BarChart3Icon],
                  ["table", "Table", TableIcon],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    view === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {empty ?? (view === "chart" ? chart : table)}
        {footer}
      </CardContent>
    </Card>
  );
}

export function ChartEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid h-56 place-items-center rounded-lg border border-dashed px-6 text-center">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Tooltip body: values lead, labels follow; series keyed by a short stroke of their colour. */
export function ChartTooltip({ title, rows }: { title: string; rows: { label: string; value: string; color: string; faded?: boolean }[] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: row.color, opacity: row.faded ? 0.4 : 1 }} aria-hidden="true" />
          <span className="font-semibold tabular-nums">{row.value}</span>
          <span className="text-muted-foreground">{row.label}</span>
        </p>
      ))}
    </div>
  );
}
