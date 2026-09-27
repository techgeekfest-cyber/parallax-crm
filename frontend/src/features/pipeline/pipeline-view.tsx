"use client";

import { KanbanIcon, ListIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { FilterSelect, SearchInput } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth/api";
import type { OpportunityStage } from "@/features/opportunities/api";
import { STAGE_LABELS } from "@/features/opportunities/labels";
import { OpportunityFormDialog } from "@/features/opportunities/opportunity-form-dialog";
import { PipelineSummaryCards } from "@/features/opportunities/pipeline-summary";
import { describeTransitionError } from "@/features/opportunities/stage-workflow";
import { useOwnerFilter } from "@/features/users/owner-filter";
import { describeError } from "@/lib/api/errors";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useListParams } from "@/lib/use-list-params";

import { useMoveOpportunity, usePipeline, type PipelineCard } from "./api";
import { PipelineBoard } from "./pipeline-board";

export function PipelineView() {
  const { get, update } = useListParams();
  const { data: me } = useMe();
  const seesAll = me?.permissions.accessAllSalesRecords ?? false;
  const owner = useOwnerFilter(seesAll ? get("owner") : undefined);
  const q = useDebouncedValue(get("q")?.trim() || undefined, 300);
  const params = { q, ownerId: owner.ownerId };
  const pipeline = usePipeline(params, { enabled: owner.ready });
  const move = useMoveOpportunity(params);
  const [creating, setCreating] = useState(false);
  const board = pipeline.data;
  const isEmpty = board && board.columns.every((column) => column.count === 0);

  function handleMove(card: PipelineCard, toStage: OpportunityStage) {
    move.mutate(
      { card, toStage },
      {
        onSuccess: (saved) => toast.success(`${saved.name} moved to ${STAGE_LABELS[saved.stage]}`),
        onError: (error) => toast.error(`${card.name} wasn't moved`, { description: describeTransitionError(error) }),
      },
    );
  }

  function handleRejected(card: PipelineCard, toStage: OpportunityStage) {
    const options = card.allowedStages.map((stage) => STAGE_LABELS[stage]).join(", ");
    toast.error(`${card.name} can't move from ${STAGE_LABELS[card.stage]} to ${STAGE_LABELS[toStage]}`, {
      description: `Deals move one stage at a time. From ${STAGE_LABELS[card.stage]} it can go to: ${options}.`,
    });
  }

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon data-icon="inline-start" />
      New opportunity
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Pipeline"
        description={seesAll ? "Every open and closed deal, by stage. Drag a card to move it." : "Your deals by stage. Drag a card to move it."}
        actions={
          <>
            <Button variant="outline" render={<Link href="/opportunities" />} nativeButton={false}>
              <ListIcon data-icon="inline-start" />
              List view
            </Button>
            {newButton}
          </>
        }
      />

      <PipelineSummaryCards
        className="mt-6"
        summary={board?.totals}
        loading={pipeline.isPending}
        scopeNote={seesAll ? (owner.ownerId ? "Totals for the selected owner." : undefined) : "Totals for your own opportunities."}
      />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          label="Search pipeline"
          placeholder="Search name or number…"
          value={get("q") ?? ""}
          onChange={(value) => update({ q: value || undefined })}
        />
        {seesAll && <FilterSelect label="Filter by owner" items={owner.items} value={get("owner")} onChange={(value) => update({ owner: value })} />}
        {pipeline.isFetching && !pipeline.isPending && <span className="text-xs text-muted-foreground" role="status">Updating…</span>}
      </div>

      <div className="mt-4">
        {pipeline.isPending ? (
          <div className="grid auto-cols-[17.5rem] grid-flow-col gap-3 overflow-hidden" aria-busy="true" aria-label="Loading pipeline">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : pipeline.error && !board ? (
          <ErrorState title="Couldn't load the pipeline" message={describeError(pipeline.error)} onRetry={() => pipeline.refetch()} />
        ) : isEmpty && !get("q") ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon={KanbanIcon}
              title="Your pipeline is empty"
              description="Create an opportunity, or convert a qualified lead, and it appears here in its stage."
              action={newButton}
            />
          </div>
        ) : board ? (
          <PipelineBoard
            board={board}
            showOwner={seesAll}
            onMove={handleMove}
            onRejectedMove={handleRejected}
            movingCardId={move.isPending ? move.variables?.card.id : undefined}
          />
        ) : null}
      </div>

      <OpportunityFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
