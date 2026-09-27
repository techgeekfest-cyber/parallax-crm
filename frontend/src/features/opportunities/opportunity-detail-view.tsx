"use client";

import { ArchiveIcon, ArrowLeftIcon, ArrowRightIcon, PencilIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DetailItem, DetailSkeleton, Empty } from "@/components/detail";
import { OwnerName } from "@/components/owner-name";
import { ArchiveButton } from "@/components/record-actions";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { NoAccessState } from "@/components/states/no-access-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAD_SOURCE_LABELS } from "@/features/leads/labels";
import { describeError, isApiError } from "@/lib/api/errors";
import { formatCalendarDate, formatCurrency, formatDateTime } from "@/lib/format";

import { useArchiveOpportunity, useOpportunity, type Opportunity } from "./api";
import { OPPORTUNITY_TYPE_LABELS } from "./labels";
import { OpportunityFormDialog } from "./opportunity-form-dialog";
import { StageBadge } from "./stage-badge";

export function OpportunityDetailView({ id }: { id: string }) {
  const { data: opportunity, error, isPending, refetch } = useOpportunity(id);
  const archive = useArchiveOpportunity();
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Opportunities
      </Link>

      {isPending ? (
        <DetailSkeleton label="Loading opportunity" />
      ) : error ? (
        isApiError(error, "PERMISSION_DENIED") ? (
          <NoAccessState what="this opportunity" />
        ) : isApiError(error, "RECORD_NOT_FOUND") || isApiError(error, "BAD_REQUEST") ? (
          <EmptyState
            icon={SearchXIcon}
            title="Opportunity not found"
            description="The link may be incorrect."
            action={<Button variant="outline" render={<Link href="/opportunities" />} nativeButton={false}>Back to opportunities</Button>}
          />
        ) : (
          <ErrorState title="Couldn't load this opportunity" message={describeError(error)} onRetry={() => refetch()} />
        )
      ) : (
        <>
          <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight">{opportunity.name}</h1>
                <StageBadge stage={opportunity.stage} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <Link href={`/accounts/${opportunity.account.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                  {opportunity.account.name}
                </Link>{" "}
                · <span className="font-mono text-xs">{opportunity.number}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {opportunity.permissions.canEdit && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Button>
              )}
              {opportunity.permissions.canArchive && (
                <ArchiveButton
                  archived={opportunity.archived}
                  recordType="opportunity"
                  recordName={opportunity.name}
                  consequence="It stops counting towards pipeline totals."
                  onToggle={(toArchive) => archive.mutateAsync({ id: opportunity.id, archive: toArchive })}
                />
              )}
            </div>
          </header>

          {opportunity.archived && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <ArchiveIcon className="size-4" />
              Archived {opportunity.archivedAt ? formatDateTime(opportunity.archivedAt) : ""}. It no longer counts towards pipeline totals.
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Figure label="Amount" value={formatCurrency(opportunity.amount, { precise: true })} />
            <Figure label="Probability" value={`${opportunity.probability}%`} />
            <Figure label="Weighted" value={formatCurrency(opportunity.weightedAmount, { precise: true })} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <DetailItem label="Expected close">{formatCalendarDate(opportunity.closeDate)}</DetailItem>
                  <DetailItem label="Closed">{opportunity.closedAt ? formatDateTime(opportunity.closedAt) : <Empty label="Still open" />}</DetailItem>
                  <DetailItem label="Type">{opportunity.type ? OPPORTUNITY_TYPE_LABELS[opportunity.type] : <Empty />}</DetailItem>
                  <DetailItem label="Lead source">{opportunity.leadSource ? LEAD_SOURCE_LABELS[opportunity.leadSource] : <Empty />}</DetailItem>
                  <DetailItem label="Owner">
                    <OwnerName owner={opportunity.owner} />
                  </DetailItem>
                  <DetailItem label="Next step">{opportunity.nextStep ?? <Empty />}</DetailItem>
                  <DetailItem label="Description" className="sm:col-span-2">
                    {opportunity.description ? (
                      <span className="block whitespace-pre-wrap">{opportunity.description}</span>
                    ) : (
                      <Empty label="No description" />
                    )}
                  </DetailItem>
                </dl>
              </CardContent>
            </Card>
            <StageHistory opportunity={opportunity} />
          </div>

          <OpportunityFormDialog open={editing} onOpenChange={setEditing} opportunity={opportunity} />
        </>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function StageHistory({ opportunity }: { opportunity: Opportunity }) {
  const entries = [...opportunity.stageHistory].reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage history</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative grid gap-4 border-l pl-4">
          {entries.map((entry, index) => (
            <li key={`${entry.changedAt}-${index}`} className="relative">
              <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.fromStage ? (
                  <>
                    <StageBadge stage={entry.fromStage} />
                    <ArrowRightIcon className="size-3 text-muted-foreground" aria-label="to" />
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Created in</span>
                )}
                <StageBadge stage={entry.toStage} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(entry.amount)} at {entry.probability}% · {entry.changedBy?.fullName ?? "System"} ·{" "}
                {formatDateTime(entry.changedAt)}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
