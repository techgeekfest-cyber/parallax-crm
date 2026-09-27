"use client";

import { ArrowLeftIcon, Building2Icon, CheckCircle2Icon, ContactRoundIcon, HandshakeIcon, MailIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { NoAccessState } from "@/components/states/no-access-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline } from "@/features/activities/activity-timeline";
import { describeError, isApiError } from "@/lib/api/errors";
import { formatCurrency, formatDateTime } from "@/lib/format";

import { useLead, type Lead } from "./api";
import { LeadActions } from "./lead-actions";
import { LEAD_SOURCE_LABELS } from "./labels";
import { LeadStatusBadge } from "./lead-status-badge";

export function LeadDetailView({ id }: { id: string }) {
  const { data: lead, error, isPending, refetch } = useLead(id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Leads
      </Link>

      {isPending ? (
        <DetailSkeleton />
      ) : error ? (
        isApiError(error, "PERMISSION_DENIED") ? (
          <NoAccessState what="this lead" />
        ) : isApiError(error, "RECORD_NOT_FOUND") || isApiError(error, "BAD_REQUEST") ? (
          <EmptyState
            icon={SearchXIcon}
            title="Lead not found"
            description="It may have been archived, or the link is incorrect."
            action={<Button variant="outline" render={<Link href="/leads" />} nativeButton={false}>Back to leads</Button>}
          />
        ) : (
          <ErrorState title="Couldn't load this lead" message={describeError(error)} onRetry={() => refetch()} />
        )
      ) : (
        <>
          <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight">{lead.fullName}</h1>
                <LeadStatusBadge status={lead.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {lead.company} · <span className="font-mono text-xs">{lead.number}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" render={<a href={`mailto:${lead.email}`} />} nativeButton={false}>
                <MailIcon data-icon="inline-start" />
                Email
              </Button>
              <LeadActions lead={lead} />
            </div>
          </header>

          {lead.conversion && <ConversionCard conversion={lead.conversion} />}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Detail label="Email">
                    <a href={`mailto:${lead.email}`} className="hover:text-primary hover:underline">
                      {lead.email}
                    </a>
                  </Detail>
                  <Detail label="Phone">{lead.phone ?? <Muted>Not provided</Muted>}</Detail>
                  <Detail label="Company">{lead.company}</Detail>
                  <Detail label="Source">
                    {lead.source ? LEAD_SOURCE_LABELS[lead.source] : <Muted>Not recorded</Muted>}
                  </Detail>
                  <Detail label="Estimated value">
                    <span className="tabular-nums">
                      {lead.estimatedValue !== undefined ? (
                        formatCurrency(lead.estimatedValue, { precise: true })
                      ) : (
                        <Muted>Not estimated</Muted>
                      )}
                    </span>
                  </Detail>
                  <Detail label="Lead number">
                    <span className="font-mono text-xs">{lead.number}</span>
                  </Detail>
                  <Detail label="Owner">
                    {lead.owner ? (
                      <>
                        {lead.owner.fullName}
                        {!lead.owner.active && <Muted> (inactive)</Muted>}
                      </>
                    ) : (
                      <Muted>Unassigned</Muted>
                    )}
                  </Detail>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Record</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4">
                  <Detail label="Created">{formatDateTime(lead.createdAt)}</Detail>
                  <Detail label="Last updated">{formatDateTime(lead.updatedAt)}</Detail>
                </dl>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {lead.notes ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes on this lead yet.</p>
                )}
              </CardContent>
            </Card>

            <ActivityTimeline className="lg:col-span-3" target={{ type: "lead", id: lead.id }} canLog />
          </div>
        </>
      )}
    </div>
  );
}

/** Where a converted lead went: links to the account, contact and opportunity it became. */
function ConversionCard({ conversion }: { conversion: NonNullable<Lead["conversion"]> }) {
  const records = [
    { label: "Account", icon: Building2Icon, record: conversion.account, href: (id: string) => `/accounts/${id}` },
    { label: "Contact", icon: ContactRoundIcon, record: conversion.contact, href: (id: string) => `/contacts/${id}` },
    { label: "Opportunity", icon: HandshakeIcon, record: conversion.opportunity, href: (id: string) => `/opportunities/${id}` },
  ];
  return (
    <section aria-label="Conversion" className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden="true" />
        Converted {formatDateTime(conversion.convertedAt)}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {records.map(({ label, icon: Icon, record, href }) => (
          <li key={label} className="min-w-0 rounded-lg border bg-card px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </span>
            {record ? (
              <Link href={href(record.id)} className="block truncate text-sm font-medium hover:text-primary hover:underline">
                {record.name}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">Not available</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading lead">
      <Skeleton className="mt-5 h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 rounded-xl lg:col-span-2" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  );
}
