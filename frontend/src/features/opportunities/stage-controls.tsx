"use client";

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon, TrophyIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useTransitionStage, type Opportunity, type OpportunityStage } from "./api";
import { isClosed, OPEN_STAGES, STAGE_DEFAULT_PROBABILITY, STAGE_LABELS } from "./labels";
import { describeTransitionError, moveKind, moveLabel } from "./stage-workflow";

/**
 * The stage path (Prospecting → … → Closed) with the moves the server says are allowed right now. Advancing or
 * stepping back happens immediately; closing and reopening ask for confirmation and an optional note.
 */
export function StageControls({ opportunity }: { opportunity: Opportunity }) {
  const transition = useTransitionStage();
  const [confirming, setConfirming] = useState<OpportunityStage | null>(null);
  const stage = opportunity.stage;
  const allowed = opportunity.allowedStages;
  const reachedIndex = isClosed(stage) ? closedFromIndex(opportunity) : OPEN_STAGES.indexOf(stage);

  async function move(toStage: OpportunityStage, note?: string) {
    try {
      const saved = await transition.mutateAsync({ id: opportunity.id, toStage, version: opportunity.version, note });
      toast.success(`${saved.name} moved to ${STAGE_LABELS[saved.stage]}`, {
        description: `Probability is now ${saved.probability}%.`,
      });
      setConfirming(null);
    } catch (error) {
      toast.error("Stage not changed", { description: describeTransitionError(error) });
      setConfirming(null);
    }
  }

  const open = allowed.filter((s) => !isClosed(s));
  const forward = open.filter((s) => moveKind(stage, s) === "forward");
  const back = open.filter((s) => moveKind(stage, s) === "back");
  const reopen = open.filter((s) => moveKind(stage, s) === "reopen");

  return (
    <section aria-label="Stage" className="rounded-xl border bg-card p-4 shadow-xs">
      <ol className="grid grid-cols-5 gap-1" aria-label="Stage path">
        {[...OPEN_STAGES, (stage === "CLOSED_LOST" ? "CLOSED_LOST" : "CLOSED_WON") as OpportunityStage].map((step, index) => {
          const current = step === stage;
          const done = index < reachedIndex;
          return (
            <li
              key={step}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex h-8 min-w-0 items-center justify-center gap-1 px-2 text-xs font-medium first:rounded-l-lg last:rounded-r-lg",
                "[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%,8px_50%)] first:[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%)] last:[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,8px_50%)]",
                current
                  ? step === "CLOSED_LOST"
                    ? "bg-muted-foreground text-background"
                    : step === "CLOSED_WON"
                      ? "bg-emerald-600 text-white"
                      : "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done && !current && <CheckIcon className="size-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{index === OPEN_STAGES.length && !isClosed(stage) ? "Closed" : STAGE_LABELS[step]}</span>
            </li>
          );
        })}
      </ol>

      {allowed.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {back.map((s) => (
            <Button key={s} variant="ghost" size="sm" disabled={transition.isPending} onClick={() => move(s)}>
              <ChevronLeftIcon data-icon="inline-start" />
              {moveLabel(stage, s)}
            </Button>
          ))}
          <span className="flex-1" />
          {reopen.length > 0 && (
            <Button variant="outline" size="sm" disabled={transition.isPending} onClick={() => setConfirming(reopen[reopen.length - 1])}>
              <RotateCcwIcon data-icon="inline-start" />
              Reopen…
            </Button>
          )}
          {allowed.includes("CLOSED_LOST") && (
            <Button variant="outline" size="sm" disabled={transition.isPending} onClick={() => setConfirming("CLOSED_LOST")}>
              <XIcon data-icon="inline-start" />
              Mark lost
            </Button>
          )}
          {allowed.includes("CLOSED_WON") && (
            <Button size="sm" disabled={transition.isPending} onClick={() => setConfirming("CLOSED_WON")}>
              <TrophyIcon data-icon="inline-start" />
              Mark won
            </Button>
          )}
          {forward.map((s) => (
            <Button key={s} size="sm" disabled={transition.isPending} onClick={() => move(s)}>
              {moveLabel(stage, s)}
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          ))}
        </div>
      )}

      <CloseDialog
        key={confirming ?? "closed"}
        opportunity={opportunity}
        toStage={confirming}
        reopenChoices={reopen}
        pending={transition.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={move}
      />
    </section>
  );
}

/**
 * For a closed deal, how far along the path it got: the open stages up to the one it was closed from (from the
 * persisted stage history) count as done. A deal recorded as already closed has no such stage.
 */
function closedFromIndex(opportunity: Opportunity): number {
  const closing = [...opportunity.stageHistory].reverse().find((entry) => entry.toStage === opportunity.stage);
  const from = closing?.fromStage;
  return from && !isClosed(from) ? OPEN_STAGES.indexOf(from) + 1 : 0;
}

function CloseDialog({
  opportunity,
  toStage,
  reopenChoices,
  pending,
  onCancel,
  onConfirm,
}: {
  opportunity: Opportunity;
  toStage: OpportunityStage | null;
  reopenChoices: OpportunityStage[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (toStage: OpportunityStage, note?: string) => void;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const [reopenInto, setReopenInto] = useState<OpportunityStage | null>(null);
  const kind = toStage ? moveKind(opportunity.stage, toStage) : null;
  const target = kind === "reopen" ? (reopenInto ?? toStage) : toStage;

  const title = kind === "won" ? "Mark this deal as won?" : kind === "lost" ? "Mark this deal as lost?" : "Reopen this deal?";
  const description =
    kind === "won"
      ? "Its probability becomes 100% and it counts towards closed-won totals."
      : kind === "lost"
        ? "Its probability becomes 0% and it leaves the open pipeline. You can reopen it later."
        : "Choose where the deal really stands now. Its probability resets to that stage's default.";

  return (
    <Dialog
      open={toStage !== null}
      onOpenChange={(next) => {
        if (!next && !pending) {
          setNote("");
          setReopenInto(null);
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {opportunity.name}. {description}
          </DialogDescription>
        </DialogHeader>
        {kind === "reopen" && (
          <div role="radiogroup" aria-label="Reopen into" className="grid grid-cols-2 gap-2">
            {reopenChoices.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={target === s}
                onClick={() => setReopenInto(s)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  target === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
                )}
              >
                <span className="font-medium">{STAGE_LABELS[s]}</span>
                <span className="block text-xs text-muted-foreground">{STAGE_DEFAULT_PROBABILITY[s]}% probability</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-note`} className="flex items-baseline gap-1.5">
            {kind === "lost" ? "Why was it lost?" : "Note"}
            <span className="text-xs font-normal text-muted-foreground">optional</span>
          </Label>
          <Textarea id={`${id}-note`} rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
          <p className="text-xs text-muted-foreground">Saved on the activity timeline.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={kind === "lost" ? "destructive" : "default"}
            disabled={pending || !target}
            onClick={() => target && onConfirm(target, note.trim() || undefined)}
          >
            {pending ? "Saving…" : kind === "won" ? "Mark won" : kind === "lost" ? "Mark lost" : `Reopen in ${target ? STAGE_LABELS[target] : "…"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
