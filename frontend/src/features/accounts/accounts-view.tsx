"use client";

import { Building2Icon, PlusIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FilterSelect, Pagination, SearchInput, SortableHead, TableCard } from "@/components/data-table";
import { OwnerName } from "@/components/owner-name";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOwnerFilter } from "@/features/users/owner-filter";
import { describeError } from "@/lib/api/errors";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useListParams } from "@/lib/use-list-params";

import { AccountTierBadge, AccountTypeBadge } from "./account-badges";
import { AccountFormDialog } from "./account-form-dialog";
import { useAccounts, type AccountType } from "./api";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "./labels";

const DEFAULT_SORT = "name,asc";
const TYPE_ITEMS = { ALL: "All types", ...ACCOUNT_TYPE_LABELS };
const STATUS_ITEMS = { active: "Active", archived: "Archived" };

export function AccountsView() {
  const { get, page, update, setPage } = useListParams();
  const typeParam = get("type");
  const type = typeParam && (ACCOUNT_TYPES as string[]).includes(typeParam) ? (typeParam as AccountType) : undefined;
  const archived = get("status") === "archived";
  const owner = useOwnerFilter(get("owner"));
  const q = useDebouncedValue(get("q")?.trim() || undefined, 300);
  const sort = get("sort");
  const { data, error, isPending, isFetching, refetch } = useAccounts(
    { q, type, ownerId: owner.ownerId, archived, page, size: 25, sort },
    { enabled: owner.ready },
  );
  const [creating, setCreating] = useState(false);
  const hasFilters = !!get("q") || !!type || !!get("owner") || archived;

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon data-icon="inline-start" />
      New account
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Accounts"
        description={
          data && (data.totalElements > 0 || hasFilters)
            ? `${data.totalElements.toLocaleString("en-US")} ${archived ? "archived" : hasFilters ? "matching" : "active"} ${data.totalElements === 1 ? "account" : "accounts"}`
            : "The organisations you sell to."
        }
        actions={newButton}
      />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          label="Search accounts"
          placeholder="Search name, website, industry…"
          value={get("q") ?? ""}
          onChange={(value) => update({ q: value || undefined })}
        />
        <FilterSelect label="Filter by type" items={TYPE_ITEMS} value={type} onChange={(value) => update({ type: value })} className="sm:w-36" />
        <FilterSelect label="Filter by owner" items={owner.items} value={get("owner")} onChange={(value) => update({ owner: value })} />
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
          <ErrorState title="Couldn't load accounts" message={describeError(error)} onRetry={() => refetch()} />
        ) : data && data.content.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchXIcon}
              title="No accounts match"
              description="Try a different search, type, owner or status."
              action={
                <Button variant="outline" onClick={() => update({ q: undefined, type: undefined, owner: undefined, status: undefined })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Building2Icon}
              title="No accounts yet"
              description="Accounts are the companies you do business with. Add one to start tracking its contacts and deals."
              action={newButton}
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead field="name" label="Account" sort={sort} defaultSort={DEFAULT_SORT} onSort={(s) => update({ sort: s })} />
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Tier</TableHead>
                <SortableHead field="industry" label="Industry" sort={sort} defaultSort={DEFAULT_SORT} onSort={(s) => update({ sort: s })} className="hidden md:table-cell" />
                <SortableHead field="employeeCount" label="Employees" sort={sort} defaultSort={DEFAULT_SORT} onSort={(s) => update({ sort: s })} align="right" className="hidden xl:table-cell" />
                <SortableHead field="annualRevenue" label="Revenue" sort={sort} defaultSort={DEFAULT_SORT} onSort={(s) => update({ sort: s })} align="right" className="hidden lg:table-cell" />
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending || !data
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3" colSpan={7}>
                        <Skeleton className="h-8 w-80" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.content.map((account) => (
                    <TableRow key={account.id} className="group relative">
                      <TableCell className="py-3">
                        <Link
                          href={`/accounts/${account.id}`}
                          className="font-medium after:absolute after:inset-0 focus-visible:outline-none group-hover:text-primary"
                        >
                          {account.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{account.website ?? account.number}</div>
                      </TableCell>
                      <TableCell>
                        <AccountTypeBadge type={account.type} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <AccountTierBadge tier={account.tier} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{account.industry ?? "—"}</TableCell>
                      <TableCell className="hidden text-right text-muted-foreground tabular-nums xl:table-cell">
                        {formatNumber(account.employeeCount)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatCurrency(account.annualRevenue)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <OwnerName owner={account.owner} />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
        {data && <Pagination page={data.page} size={data.size} totalElements={data.totalElements} totalPages={data.totalPages} onPage={setPage} />}
      </TableCard>

      <AccountFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
