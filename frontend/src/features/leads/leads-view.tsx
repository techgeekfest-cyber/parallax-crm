"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
const STATUS_FILTER_ITEMS = { [ALL_STATUSES]: "All statuses", ...LEAD_STATUS_LABELS };

type SortField = "lastName" | "company" | "status" | "estimatedValue" | "createdAt";

/**
 * List state lives in the URL, so views are shareable and survive refresh and the back button. Updates use the native
 * History API, which Next.js syncs into useSearchParams without a server round trip.
 */
function useLeadListParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const status = searchParams.get("status");
  const params: LeadListParams = {
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
  // The URL updates on every keystroke; only the request waits for typing to pause.
  const q = useDebouncedValue(params.q?.trim() || undefined, 300);
  const { data, error, isPending, isFetching, refetch } = useLeads({ ...params, q });
  const [createOpen, setCreateOpen] = useState(false);
  const hasFilters = !!params.q || !!params.status;

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
            : "Prospects you are qualifying before they become customers."
        }
        actions={newLeadButton}
      />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBox value={params.q ?? ""} onChange={(value) => update({ q: value || undefined })} />
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
                <Button variant="outline" onClick={() => update({ q: undefined, status: undefined })}>
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
                <SortableHead field="lastName" label="Lead" sort={params.sort} onSort={(sort) => update({ sort })} />
                <SortableHead
                  field="company"
                  label="Company"
                  className="hidden sm:table-cell"
                  sort={params.sort}
                  onSort={(sort) => update({ sort })}
                />
                <SortableHead field="status" label="Status" sort={params.sort} onSort={(sort) => update({ sort })} />
                <SortableHead
                  field="estimatedValue"
                  label="Est. value"
                  align="right"
                  className="hidden sm:table-cell"
                  sort={params.sort}
                  onSort={(sort) => update({ sort })}
                />
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <SortableHead
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
                ? Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)
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
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
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

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Search leads"
        placeholder="Search name, company, email…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-8"
      />
    </div>
  );
}

function SortableHead({
  field,
  label,
  sort,
  onSort,
  align = "left",
  className,
}: {
  field: SortField;
  label: string;
  sort?: string;
  onSort: (sort: string | undefined) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const [sortField, direction] = (sort ?? "createdAt,desc").split(",");
  const active = sortField === field;
  const Icon = !active ? ChevronsUpDownIcon : direction === "desc" ? ArrowDownIcon : ArrowUpIcon;
  // Cycle: ascending → descending → back to the default order.
  const next = !active ? `${field},asc` : direction === "desc" ? undefined : `${field},desc`;

  return (
    <TableHead
      className={cn(align === "right" && "text-right", className)}
      aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(next)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

function SkeletonRow() {
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
      <TableCell className="hidden lg:table-cell">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  );
}

function Pagination({
  page,
  size,
  totalElements,
  totalPages,
  onPage,
}: {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const from = page * size + 1;
  const to = Math.min(totalElements, (page + 1) * size);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        <span className="tabular-nums">
          {from}–{to}
        </span>{" "}
        of <span className="tabular-nums">{totalElements.toLocaleString("en-US")}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>
          Next
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}
