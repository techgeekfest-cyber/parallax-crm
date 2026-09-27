import { ArrowDownIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/format";

import type { StageHistoryEntry } from "./api";
import { STAGE_LABELS } from "./labels";
import { StageBadge } from "./stage-badge";

/**
 * Every stage the deal entered, oldest first, read from the persisted stage history: who moved it, when, and the
 * amount and probability at that moment.
 */
export function StageHistory({ entries }: { entries: StageHistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage history</CardTitle>
        <CardDescription>
          {entries.length === 1 ? "No stage changes yet." : `${entries.length - 1} stage change${entries.length === 2 ? "" : "s"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-1" aria-label="Stage history">
          {entries.map((entry, index) => (
            <li key={`${entry.changedAt}-${index}`}>
              {index > 0 && <ArrowDownIcon className="my-1 ml-3 size-3.5 text-muted-foreground" aria-hidden="true" />}
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StageBadge stage={entry.toStage} />
                  <span className="text-xs text-muted-foreground">
                    {entry.fromStage ? `from ${STAGE_LABELS[entry.fromStage]}` : "Created"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatCurrency(entry.amount)}</span> at{" "}
                  <span className="tabular-nums">{entry.probability}%</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{entry.changedBy?.fullName ?? "System"}</p>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={entry.changedAt}>{formatDateTime(entry.changedAt)}</time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
