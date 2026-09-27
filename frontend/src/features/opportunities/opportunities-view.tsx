"use client";

import { HandshakeIcon, PlusIcon, SearchXIcon } from "lucide-react";
import { useState } from "react";

import { FilterSelect, Pagination, SearchInput, TableCard } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/api";
import { useOwnerFilter } from "@/features/users/owner-filter";
import { describeError } from "@/lib/api/errors";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useListParams } from "@/lib/use-list-params";

import { useOpportunities, usePipelineSummary, type OpportunityStage } from "./api";
import { OPEN_STAGES, STAGE_LABELS, STAGES } from "./labels";
import { OpportunitiesTable } from "./opportunities-table";
import { OpportunityFormDialog } from "./opportunity-form-dialog";
import { PipelineSummaryCards } from "./pipeline-summary";

const STAGE_ITEMS: Record<string, string> = { ALL: "All stages", OPEN: "Open", ...STAGE_LABELS };
const STATUS_ITEMS = { active: "Active", archived: "Archived" };

function stagesFor(filter: string | undefined): OpportunityStage[] | undefined {
  if (filter === "OPEN") return OPEN_STAGES;
  return filter && (STAGES as string[]).includes(filter) ? [filter as OpportunityStage] : undefined;
}

export function OpportunitiesView() {
  const { get, page, update, setPage } = useListParams();
  const { data: me } = useMe();
  const seesAll = me?.permissions.accessAllSalesRecords ?? false;
  const archived = get("status") === "archived";
  const owner = useOwnerFilter(seesAll ? get("owner") : undefined);
  const q = useDebouncedValue(get("q")?.trim() || undefined, 300);
  const sort = get("sort");
  const stageFilter = get("stage");
  const { data, error, isPending, isFetching, refetch } = useOpportunities({
    q,
    stage: stagesFor(stageFilter),
    ownerId: owner.ownerId,
    archived,
    page,
    size: 25,
    sort,
  });
  const summary = usePipelineSummary({ ownerId: owner.ownerId });
  const [creating, setCreating] = useState(false);
  const hasFilters = !!get("q") || !!stageFilter || (seesAll && !!get("owner")) || archived;

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon data-icon="inline-start" />
      New opportunity
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Opportunities"
        description={seesAll ? "Every deal in your organisation's pipeline." : "Your deals, from first contact to close."}
        actions={newButton}
      />

      <PipelineSummaryCards
        className="mt-6"
        summary={summary.data}
        loading={summary.isPending}
        scopeNote={seesAll ? (owner.ownerId ? "Totals for the selected owner." : undefined) : "Totals for your own opportunities."}
      />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          label="Search opportunities"
          placeholder="Search name or number…"
          value={get("q") ?? ""}
          onChange={(value) => update({ q: value || undefined })}
        />
        <FilterSelect label="Filter by stage" items={STAGE_ITEMS} value={stageFilter} onChange={(value) => update({ stage: value })} />
        {seesAll && (
          <FilterSelect label="Filter by owner" items={owner.items} value={get("owner")} onChange={(value) => update({ owner: value })} />
        )}
        <FilterSelect
          label="Filter by status"
          items={STATUS_ITEMS}
          value={archived ? "archived" : undefined}
          onChange={(value) => update({ status: value })}
          className="sm:w-32"
        />
      </div>

      <TableCard refreshing={isFetching && !isPending}>
        {error && !data ? (
          <ErrorState title="Couldn't load opportunities" message={describeError(error)} onRetry={() => refetch()} />
        ) : data && data.content.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchXIcon}
              title="No opportunities match"
              description="Try a different search, stage or status."
              action={
                <Button variant="outline" onClick={() => update({ q: undefined, stage: undefined, owner: undefined, status: undefined })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={HandshakeIcon}
              title="No opportunities yet"
              description="Opportunities are the deals you're working. Create one against an account to start your pipeline."
              action={newButton}
            />
          )
        ) : (
          <OpportunitiesTable
            opportunities={data?.content}
            loading={isPending}
            sort={sort}
            onSort={(s) => update({ sort: s })}
            showOwner={seesAll}
          />
        )}
        {data && <Pagination page={data.page} size={data.size} totalElements={data.totalElements} totalPages={data.totalPages} onPage={setPage} />}
      </TableCard>

      <OpportunityFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
