import { cn } from "@/lib/utils";

import type { OpportunityStage } from "./api";
import { STAGE_LABELS, STAGES } from "./labels";

const STAGE_STYLES: Record<OpportunityStage, string> = {
  PROSPECTING: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
  QUALIFICATION: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-300",
  PROPOSAL: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
  NEGOTIATION: "bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-300",
  CLOSED_WON: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  CLOSED_LOST: "bg-muted text-muted-foreground ring-border",
};

export function StageBadge({ stage, className }: { stage: OpportunityStage; className?: string }) {
  const step = STAGES.indexOf(stage);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STAGE_STYLES[stage], className)}>
      {/* A tiny progress indicator for open stages: filled pips show how far along the pipeline the deal is. */}
      {step < 4 && (
        <span className="flex gap-0.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("size-1 rounded-full bg-current", i > step && "opacity-25")} />
          ))}
        </span>
      )}
      {STAGE_LABELS[stage]}
    </span>
  );
}
