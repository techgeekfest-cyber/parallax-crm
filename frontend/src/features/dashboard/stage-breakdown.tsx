import { STAGE_LABELS } from "@/features/opportunities/labels";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { StageFigure } from "./api";
import { formatMoneyCompact, formatRate } from "./format";

const OPEN = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"];

/**
 * Deals by stage as horizontal bars — one hue, length = value, so the stages compare by magnitude. Open stages share
 * the open pipeline; the two closed stages cover the period. Every number is also written out, so the bars never
 * carry information alone.
 */
export function StageBreakdown({ stages, periodLabel }: { stages: StageFigure[]; periodLabel: string }) {
  const open = stages.filter((s) => OPEN.includes(s.stage));
  const closed = stages.filter((s) => !OPEN.includes(s.stage));
  const maxOpen = Math.max(0, ...open.map((s) => s.amount));
  const maxClosed = Math.max(0, ...closed.map((s) => s.count));

  return (
    <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
      <section aria-labelledby="stages-open">
        <h3 id="stages-open" className="text-xs font-medium text-muted-foreground">
          Open pipeline now
        </h3>
        <StageRows
          rows={open}
          fraction={(s) => (maxOpen > 0 ? s.amount / maxOpen : 0)}
          detail={(s) => `${formatCurrency(s.weightedAmount)} weighted`}
          share={(s) => (s.sharePercent === undefined ? undefined : `${formatRate(s.sharePercent)} of value`)}
        />
      </section>
      <section aria-labelledby="stages-closed">
        <h3 id="stages-closed" className="text-xs font-medium text-muted-foreground">
          Closed · {periodLabel.toLowerCase()}
        </h3>
        <StageRows
          rows={closed}
          fraction={(s) => (maxClosed > 0 ? s.count / maxClosed : 0)}
          muted={(s) => s.stage === "CLOSED_LOST"}
          share={(s) => (s.sharePercent === undefined ? undefined : `${formatRate(s.sharePercent)} of closed`)}
        />
      </section>
    </div>
  );
}

function StageRows({
  rows,
  fraction,
  detail,
  share,
  muted,
}: {
  rows: StageFigure[];
  fraction: (s: StageFigure) => number;
  detail?: (s: StageFigure) => string;
  share: (s: StageFigure) => string | undefined;
  muted?: (s: StageFigure) => boolean;
}) {
  return (
    <ul className="mt-2 grid gap-3">
      {rows.map((s) => {
        const width = fraction(s) * 100;
        const shareText = share(s);
        return (
          <li key={s.stage} className="grid gap-1" data-stage={s.stage}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{STAGE_LABELS[s.stage]}</span>
              <span className="text-right tabular-nums">
                <span className="font-medium" title={formatCurrency(s.amount, { precise: true })}>
                  {formatMoneyCompact(s.amount)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {s.count} {s.count === 1 ? "deal" : "deals"}
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted" aria-hidden="true">
              {width > 0 && (
                <div
                  className={cn("h-full rounded-full", muted?.(s) ? "bg-muted-foreground/45" : "bg-primary")}
                  style={{ width: `max(${width}%, 0.5rem)` }}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {[shareText, detail?.(s)].filter(Boolean).join(" · ") || "Nothing here yet"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
