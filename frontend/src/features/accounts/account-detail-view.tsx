"use client";

import { ArrowLeftIcon, ArchiveIcon, ContactRoundIcon, ExternalLinkIcon, HandshakeIcon, PencilIcon, PlusIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AddressBlock, DetailItem, DetailSkeleton, Empty } from "@/components/detail";
import { OwnerName } from "@/components/owner-name";
import { ArchiveButton } from "@/components/record-actions";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTimeline } from "@/features/activities/activity-timeline";
import { useContacts } from "@/features/contacts/api";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import { ContactsTable } from "@/features/contacts/contacts-table";
import { useMe } from "@/features/auth/api";
import { useOpportunities, usePipelineSummary } from "@/features/opportunities/api";
import { OpportunitiesTable } from "@/features/opportunities/opportunities-table";
import { OpportunityFormDialog } from "@/features/opportunities/opportunity-form-dialog";
import { PipelineSummaryCards } from "@/features/opportunities/pipeline-summary";
import { describeError, isApiError } from "@/lib/api/errors";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

import { AccountTierBadge, AccountTypeBadge } from "./account-badges";
import { AccountFormDialog } from "./account-form-dialog";
import { useAccount, useArchiveAccount, type Account } from "./api";
import { FUNDING_ROUND_LABELS, GROWTH_STAGE_LABELS, SUPPORT_LEVEL_LABELS } from "./labels";

export function AccountDetailView({ id }: { id: string }) {
  const { data: account, error, isPending, refetch } = useAccount(id);
  const archive = useArchiveAccount();
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Accounts
      </Link>

      {isPending ? (
        <DetailSkeleton label="Loading account" />
      ) : error ? (
        isApiError(error, "RECORD_NOT_FOUND") || isApiError(error, "BAD_REQUEST") ? (
          <EmptyState
            icon={SearchXIcon}
            title="Account not found"
            description="The link may be incorrect."
            action={<Button variant="outline" render={<Link href="/accounts" />} nativeButton={false}>Back to accounts</Button>}
          />
        ) : (
          <ErrorState title="Couldn't load this account" message={describeError(error)} onRetry={() => refetch()} />
        )
      ) : (
        <>
          <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
                <AccountTypeBadge type={account.type} />
                <AccountTierBadge tier={account.tier} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono text-xs">{account.number}</span> · {SUPPORT_LEVEL_LABELS[account.supportLevel]}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {account.permissions.canEdit && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Button>
              )}
              {account.permissions.canArchive && (
                <ArchiveButton
                  archived={account.archived}
                  recordType="account"
                  recordName={account.name}
                  consequence="Its contacts and opportunities stay available, but no new ones can be added to it."
                  onToggle={(toArchive) => archive.mutateAsync({ id: account.id, archive: toArchive })}
                />
              )}
            </div>
          </header>

          {account.archived && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <ArchiveIcon className="size-4" />
              Archived {account.archivedAt ? formatDateTime(account.archivedAt) : ""}. Restore it to edit or add records.
            </p>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                  <DetailItem label="Industry">{account.industry ?? <Empty />}</DetailItem>
                  <DetailItem label="Employees">{account.employeeCount != null ? formatNumber(account.employeeCount) : <Empty />}</DetailItem>
                  <DetailItem label="Annual revenue">{account.annualRevenue != null ? formatCurrency(account.annualRevenue) : <Empty />}</DetailItem>
                  <DetailItem label="Website">
                    {account.website ? (
                      <a
                        href={account.website.startsWith("http") ? account.website : `https://${account.website}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                      >
                        {account.website}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    ) : (
                      <Empty />
                    )}
                  </DetailItem>
                  <DetailItem label="Phone">{account.phone ?? <Empty />}</DetailItem>
                  <DetailItem label="Owner">
                    <OwnerName owner={account.owner} />
                  </DetailItem>
                </dl>
              </CardContent>
            </Card>

            <ProfileCard account={account} />

            <Card>
              <CardHeader>
                <CardTitle>Billing address</CardTitle>
              </CardHeader>
              <CardContent>
                <AddressBlock address={account.billingAddress} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Shipping address</CardTitle>
              </CardHeader>
              <CardContent>
                <AddressBlock address={account.shippingAddress} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Record</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4">
                  <DetailItem label="Created">{formatDateTime(account.createdAt)}</DetailItem>
                  <DetailItem label="Last updated">{formatDateTime(account.updatedAt)}</DetailItem>
                </dl>
              </CardContent>
            </Card>
          </div>

          <AccountPipeline account={account} />
          <AccountContacts account={account} />
          <AccountOpportunities account={account} />
          <ActivityTimeline className="mt-6" target={{ type: "account", id: account.id }} canLog={!account.archived} />

          <AccountFormDialog open={editing} onOpenChange={setEditing} account={account} />
        </>
      )}
    </div>
  );
}

function ProfileCard({ account }: { account: Account }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {account.type === "ENTERPRISE" ? "Enterprise" : account.type === "SMB" ? "Business" : "Startup"} profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          {account.enterprise && (
            <>
              <DetailItem label="Enterprise ID">{account.enterprise.enterpriseId ?? <Empty />}</DetailItem>
              <DetailItem label="Global employees">
                {account.enterprise.globalEmployeeCount != null ? formatNumber(account.enterprise.globalEmployeeCount) : <Empty />}
              </DetailItem>
              <DetailItem label="Account manager">
                {account.accountManager ? <OwnerName owner={account.accountManager} /> : <Empty label="None" />}
              </DetailItem>
              <DetailItem label="Subsidiaries">
                {account.enterprise.subsidiaries?.length ? (
                  <span className="whitespace-normal">{account.enterprise.subsidiaries.join(", ")}</span>
                ) : (
                  <Empty label="None" />
                )}
              </DetailItem>
            </>
          )}
          {account.smb && (
            <>
              <DetailItem label="Business type">{account.smb.businessType ?? <Empty />}</DetailItem>
              <DetailItem label="Years in business">{account.smb.yearsInBusiness ?? <Empty />}</DetailItem>
              <DetailItem label="Owner">{account.smb.ownerName ?? <Empty />}</DetailItem>
              <DetailItem label="Local business">{account.smb.localBusiness ? "Yes" : "No"}</DetailItem>
            </>
          )}
          {account.startup && (
            <>
              <DetailItem label="Funding round">
                {account.startup.fundingRound ? FUNDING_ROUND_LABELS[account.startup.fundingRound] : <Empty />}
              </DetailItem>
              <DetailItem label="Total funding">
                {account.startup.totalFunding != null ? formatCurrency(account.startup.totalFunding) : <Empty />}
              </DetailItem>
              <DetailItem label="Growth stage">
                {account.startup.growthStage ? GROWTH_STAGE_LABELS[account.startup.growthStage] : <Empty />}
              </DetailItem>
              <DetailItem label="Months to profitability">{account.startup.monthsToProfitability ?? <Empty />}</DetailItem>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function AccountPipeline({ account }: { account: Account }) {
  const { data: me } = useMe();
  const summary = usePipelineSummary({ accountId: account.id });
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold tracking-tight">Pipeline</h2>
      <PipelineSummaryCards
        className="mt-3"
        summary={summary.data}
        loading={summary.isPending}
        scopeNote={me && !me.permissions.accessAllSalesRecords ? "Totals include only your own opportunities." : undefined}
      />
    </section>
  );
}

function AccountContacts({ account }: { account: Account }) {
  const [adding, setAdding] = useState(false);
  const { data, isPending } = useContacts({ accountId: account.id, page: 0, size: 50 });
  return (
    <section className="mt-8">
      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Contacts</CardTitle>
          <CardDescription>{data ? `${data.totalElements} at this account` : " "}</CardDescription>
          {!account.archived && (
            <CardAction>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <PlusIcon data-icon="inline-start" />
                Add contact
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <div className="border-t">
          {data && data.content.length === 0 ? (
            <EmptyState className="py-10" icon={ContactRoundIcon} title="No contacts yet" description="Add the people you work with at this account." />
          ) : (
            <ContactsTable contacts={data?.content} loading={isPending} showAccount={false} />
          )}
        </div>
      </Card>
      <ContactFormDialog open={adding} onOpenChange={setAdding} account={{ id: account.id, name: account.name }} />
    </section>
  );
}

function AccountOpportunities({ account }: { account: Account }) {
  const [adding, setAdding] = useState(false);
  const { data: me } = useMe();
  const { data, isPending } = useOpportunities({ accountId: account.id, page: 0, size: 50, sort: "closeDate,asc" });
  return (
    <section className="mt-6">
      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Opportunities</CardTitle>
          <CardDescription>
            {data ? `${data.totalElements} ${me?.permissions.accessAllSalesRecords ? "" : "of yours "}on this account` : " "}
          </CardDescription>
          {!account.archived && (
            <CardAction>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <PlusIcon data-icon="inline-start" />
                New opportunity
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <div className="border-t">
          {data && data.content.length === 0 ? (
            <EmptyState className="py-10" icon={HandshakeIcon} title="No opportunities yet" description="Track a potential deal with this account." />
          ) : (
            <OpportunitiesTable opportunities={data?.content} loading={isPending} showAccount={false} showOwner={me?.permissions.accessAllSalesRecords} />
          )}
        </div>
      </Card>
      <OpportunityFormDialog open={adding} onOpenChange={setAdding} account={{ id: account.id, name: account.name }} />
    </section>
  );
}
