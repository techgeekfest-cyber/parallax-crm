"use client";

import { ArchiveIcon, ArrowLeftIcon, Building2Icon, FlagIcon, PencilIcon, SearchXIcon } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_TYPE_LABELS } from "@/features/accounts/labels";
import { ActivityTimeline } from "@/features/activities/activity-timeline";
import { useContacts } from "@/features/contacts/api";
import { LEAD_SOURCE_LABELS } from "@/features/leads/labels";
import { describeError, isApiError } from "@/lib/api/errors";
import { formatCalendarDate, formatCurrency, formatDateTime } from "@/lib/format";

import { useArchiveOpportunity, useOpportunity, type Opportunity } from "./api";
import { OPPORTUNITY_TYPE_LABELS } from "./labels";
import { OpportunityFormDialog } from "./opportunity-form-dialog";
import { StageBadge } from "./stage-badge";
import { StageControls } from "./stage-controls";
import { StageHistory } from "./stage-history";

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

          {!opportunity.archived && (
            <div className="mt-6">
              <StageControls opportunity={opportunity} />
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Figure label="Amount" value={formatCurrency(opportunity.amount, { precise: true })} />
            <Figure label="Probability" value={`${opportunity.probability}%`} />
            <Figure label="Weighted" value={formatCurrency(opportunity.weightedAmount, { precise: true })} />
            <Figure label="Expected close" value={formatCalendarDate(opportunity.closeDate)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="grid content-start gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                    <FlagIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Next step</p>
                      <p className="text-sm">{opportunity.nextStep ?? <Empty label="No next step planned" />}</p>
                    </div>
                  </div>
                  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <DetailItem label="Closed">{opportunity.closedAt ? formatDateTime(opportunity.closedAt) : <Empty label="Still open" />}</DetailItem>
                    <DetailItem label="Owner">
                      <OwnerName owner={opportunity.owner} />
                    </DetailItem>
                    <DetailItem label="Type">{opportunity.type ? OPPORTUNITY_TYPE_LABELS[opportunity.type] : <Empty />}</DetailItem>
                    <DetailItem label="Lead source">{opportunity.leadSource ? LEAD_SOURCE_LABELS[opportunity.leadSource] : <Empty />}</DetailItem>
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
              <ActivityTimeline
                target={{ type: "opportunity", id: opportunity.id }}
                canLog={!!opportunity.permissions.canEdit && !opportunity.archived}
              />
            </div>
            <div className="grid content-start gap-4">
              <RelatedAccount opportunity={opportunity} />
              <StageHistory entries={opportunity.stageHistory} />
            </div>
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

/** The deal's account and the people there, so the next call is one click away. */
function RelatedAccount({ opportunity }: { opportunity: Opportunity }) {
  const contacts = useContacts({ accountId: opportunity.account.id, page: 0, size: 5, sort: "lastName,asc" });
  const people = contacts.data?.content ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Link href={`/accounts/${opportunity.account.id}`} className="group flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Building2Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium group-hover:text-primary group-hover:underline">{opportunity.account.name}</span>
            <span className="block text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[opportunity.account.type]}</span>
          </span>
        </Link>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Contacts</p>
          {contacts.isPending ? (
            <Skeleton className="mt-2 h-10 w-full" />
          ) : people.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No contacts at this account yet.</p>
          ) : (
            <ul className="mt-1.5 grid gap-2" aria-label="Contacts at this account">
              {people.map((contact) => (
                <li key={contact.id} className="min-w-0 text-sm">
                  <Link href={`/contacts/${contact.id}`} className="font-medium hover:text-primary hover:underline">
                    {contact.fullName}
                  </Link>
                  {contact.primary && <span className="ml-1.5 text-xs text-primary">Primary</span>}
                  <span className="block truncate text-xs text-muted-foreground">{[contact.title, contact.email].filter(Boolean).join(" · ") || "No title or email"}</span>
                </li>
              ))}
            </ul>
          )}
          {(contacts.data?.totalElements ?? 0) > people.length && (
            <Link href={`/accounts/${opportunity.account.id}`} className="mt-2 inline-block text-xs text-primary hover:underline">
              All {contacts.data?.totalElements} contacts
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
