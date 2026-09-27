"use client";

import { PlusIcon, SearchXIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Pagination, SearchInput, SortableHead } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMe } from "@/features/auth/api";
import { useAssignableUsers } from "@/features/users/api";
import { describeError } from "@/lib/api/errors";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

import { useLeads, type LeadListParams, type LeadStatus } from "./api";
import { CreateLeadDialog } from "./create-lead-dialog";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUSES } from "./labels";
import { LeadStatusBadge } from "./lead-status-badge";

const PAGE_SIZE = 25;
const ALL_STATUSES = "ALL";
const ALL_OWNERS = "ALL";
const STATUS_FILTER_ITEMS = { [ALL_STATUSES]: "All statuses", ...LEAD_STATUS_LABELS };


/**
 * List state lives in the URL, so views are shareable and survive refresh and the back button. Updates use the native
 * History API, which Next.js syncs into useSearchParams without a server round trip.
 */
function useLeadListParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const status = searchParams.get("status");
  const owner = searchParams.get("owner") ?? undefined;
  const params: LeadListParams & { owner?: string } = {
    owner,
    q: searchParams.get("q") ?? undefined,
    status: status && (LEAD_STATUSES as string[]).includes(status) ? (status as LeadStatus) : undefined,
    page: Math.max(0, Number(searchParams.get("page") ?? "1") - 1) || 0,
    size: PAGE_SIZE,
    sort: searchParams.get("sort") ?? undefined,
  };

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Any change other than paging returns to the first page.
      if (!("page" in patch)) next.delete("page");
      const query = next.toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname, searchParams],
  );

  return { params, update };
}

export function LeadsView() {
  const { params, update } = useLeadListParams();
  const { data: me } = useMe();
  const seesAll = me?.permissions.accessAllSalesRecords ?? false;
  const assignable = useAssignableUsers(seesAll);
  // The URL updates on every keystroke; only the request waits for typing to pause.
  const q = useDebouncedValue(params.q?.trim() || undefined, 300);
  const { owner, ...listParams } = params;
  const ownerId = !seesAll ? undefined : owner === "me" ? me?.id : owner;
  const { data, error, isPending, isFetching, refetch } = useLeads({ ...listParams, q, ownerId });
  const [createOpen, setCreateOpen] = useState(false);
  const hasFilters = !!params.q || !!params.status || (seesAll && !!owner);
  const ownerFilterItems = {
    [ALL_OWNERS]: "All owners",
    me: "My leads",
    ...Object.fromEntries((assignable.data?.content ?? []).filter((u) => u.id !== me?.id).map((u) => [u.id, u.fullName])),
  };

  const newLeadButton = (
    <Button onClick={() => setCreateOpen(true)}>
      <PlusIcon data-icon="inline-start" />
      New lead
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Leads"
        description={
          data && (data.totalElements > 0 || hasFilters)
            ? `${data.totalElements.toLocaleString("en-US")} ${hasFilters ? "matching" : "active"} ${data.totalElements === 1 ? "lead" : "leads"}`
            : seesAll
              ? "Prospects your team is qualifying before they become customers."
              : "Your prospects, before they become customers."
        }
        actions={newLeadButton}
      />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          label="Search leads"
          placeholder="Search name, company, email…"
          value={params.q ?? ""}
          onChange={(value) => update({ q: value || undefined })}
        />
        <Select
          items={STATUS_FILTER_ITEMS}
          value={params.status ?? ALL_STATUSES}
          onValueChange={(value) => update({ status: value && value !== ALL_STATUSES ? value : undefined })}
        >
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {LEAD_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {seesAll && (
          <Select
            items={ownerFilterItems}
            value={owner ?? ALL_OWNERS}
            onValueChange={(value) => update({ owner: value && value !== ALL_OWNERS ? value : undefined })}
          >
            <SelectTrigger aria-label="Filter by owner" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ownerFilterItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div
        className={cn(
          "mt-4 overflow-hidden rounded-xl border bg-card shadow-xs transition-opacity",
          isFetching && !isPending && "opacity-70",
        )}
      >
        {error && !data ? (
          <ErrorState title="Couldn't load leads" message={describeError(error)} onRetry={() => refetch()} />
        ) : data && data.content.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchXIcon}
              title="No leads match"
              description="Try a different search term or status."
              action={
                <Button variant="outline" onClick={() => update({ q: undefined, status: undefined, owner: undefined })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={UsersRoundIcon}
              title="No leads yet"
              description="Leads are the people and companies you are trying to win. Add your first one to start building your pipeline."
              action={newLeadButton}
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead defaultSort="createdAt,desc" field="lastName" label="Lead" sort={params.sort} onSort={(sort) => update({ sort })} />
                <SortableHead
                  defaultSort="createdAt,desc"
                  field="company"
                  label="Company"
                  className="hidden sm:table-cell"
                  sort={params.sort}
                  onSort={(sort) => update({ sort })}
                />
                <SortableHead defaultSort="createdAt,desc" field="status" label="Status" sort={params.sort} onSort={(sort) => update({ sort })} />
                <SortableHead
                  defaultSort="createdAt,desc"
                  field="estimatedValue"
                  label="Est. value"
                  align="right"
                  className="hidden sm:table-cell"
                  sort={params.sort}
                  onSort={(sort) => update({ sort })}
                />
                {seesAll && <TableHead className="hidden lg:table-cell">Sales rep</TableHead>}
                <TableHead className="hidden 2xl:table-cell">Source</TableHead>
                <SortableHead
                  defaultSort="createdAt,desc"
                  field="createdAt"
                  label="Created"
                  className="hidden md:table-cell"
                  sort={params.sort}
                  onSort={(sort) => update({ sort })}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending || !data
                ? Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} withOwner={seesAll} />)
                : data.content.map((lead) => (
                    <TableRow key={lead.id} className="group relative">
                      <TableCell className="py-3">
                        {/* The stretched link makes the whole row clickable while staying a real, focusable link. */}
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium after:absolute after:inset-0 focus-visible:outline-none group-hover:text-primary"
                        >
                          {lead.fullName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          <span className="sm:hidden">{lead.company}</span>
                          <span className="hidden sm:inline">{lead.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{lead.company}</TableCell>
                      <TableCell>
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {formatCurrency(lead.estimatedValue)}
                      </TableCell>
                      {seesAll && (
                        <TableCell className="hidden lg:table-cell">
                          {lead.owner ? (
                            <span className={cn(!lead.owner.active && "text-muted-foreground")}>
                              {lead.owner.fullName}
                              {!lead.owner.active && " (inactive)"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                        {lead.source ? LEAD_SOURCE_LABELS[lead.source] : "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatDate(lead.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}

        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            size={data.size}
            totalElements={data.totalElements}
            totalPages={data.totalPages}
            onPage={(page) => update({ page: String(page + 1) })}
          />
        )}
      </div>

      <CreateLeadDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function SkeletonRow({ withOwner }: { withOwner: boolean }) {
  return (
    <TableRow>
      <TableCell className="py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1.5 h-3 w-40" />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Skeleton className="ml-auto h-4 w-16" />
      </TableCell>
      {withOwner && (
        <TableCell className="hidden lg:table-cell">
          <Skeleton className="h-4 w-24" />
        </TableCell>
      )}
      <TableCell className="hidden 2xl:table-cell">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  );
}
